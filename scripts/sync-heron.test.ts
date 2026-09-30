import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import type { TestContext } from "node:test"
import { compareVersions, latestReleaseUrl, parseRelease, checksumFor } from "./release-policy.ts"
import { synchronize } from "./sync-heron.ts"

function digest(bytes: string): string {
  return createHash("sha256").update(bytes).digest("hex")
}

function fixture(version: string, bytes = `Heron ${version}`) {
  const tag = `v${version}`
  const name = `Heron-${version}-mac-universal.dmg`
  const manifest = `${digest(bytes)}  ${name}\n`
  const url = (filename: string) =>
    `https://github.com/minori-live/heron/releases/download/${tag}/${filename}`
  const asset = (filename: string, content: string) => ({
    name: filename,
    browser_download_url: url(filename),
    state: "uploaded",
    size: Buffer.byteLength(content),
    digest: `sha256:${digest(content)}`
  })
  return {
    bytes,
    manifest,
    metadata: {
      tag_name: tag,
      draft: false,
      prerelease: false,
      assets: [asset(name, bytes), asset("SHA256SUMS", manifest)]
    }
  }
}

function cask(version: string, sha256 = digest(`Heron ${version}`)): string {
  return `cask "heron" do
  version "${version}"
  sha256 "${sha256}"

  url "https://github.com/minori-live/heron/releases/download/v#{version}/Heron-#{version}-mac-universal.dmg"
  depends_on macos: :sonoma
  app "Heron.app"
end
`
}

async function temporaryCask(context: TestContext, content: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "heron-cask-test-"))
  context.after(() => rm(directory, { recursive: true, force: true }))
  const path = join(directory, "heron.rb")
  await writeFile(path, content)
  return path
}

function fetcherFor(release: ReturnType<typeof fixture>, confirmed = release.metadata) {
  let lookups = 0
  return async (url: string): Promise<Response> => {
    if (url === latestReleaseUrl) {
      return Response.json(lookups++ === 0 ? release.metadata : confirmed)
    }
    const asset = release.metadata.assets.find((item) => item.browser_download_url === url)
    assert.ok(asset, `Unexpected download: ${url}`)
    return new Response(asset.name === "SHA256SUMS" ? release.manifest : release.bytes)
  }
}

test("synchronizes from published metadata without changing installation settings", async (context) => {
  const release = fixture("0.6.0")
  const original = cask("0.5.2")
  const path = await temporaryCask(context, original)
  const result = await synchronize({ path, fetcher: fetcherFor(release) })
  assert.deepEqual(result, { changed: true, version: "0.6.0" })
  assert.equal(await readFile(path, "utf8"), cask("0.6.0"))
})

test("repeated synchronization produces no change", async (context) => {
  const original = cask("0.5.2")
  const path = await temporaryCask(context, original)
  assert.deepEqual(await synchronize({ path, fetcher: fetcherFor(fixture("0.5.2")) }), {
    changed: false,
    version: "0.5.2"
  })
  assert.equal(await readFile(path, "utf8"), original)
})

test("check mode reports a stale cask without modifying it", async (context) => {
  const original = cask("0.5.2")
  const path = await temporaryCask(context, original)
  await assert.rejects(
    synchronize({ path, check: true, fetcher: fetcherFor(fixture("0.5.3")) }),
    /does not match the latest stable release/
  )
  assert.equal(await readFile(path, "utf8"), original)
})

test("failed downloads leave the previous cask available", async (context) => {
  const original = cask("0.5.2")
  const path = await temporaryCask(context, original)
  const release = fixture("0.5.3")
  await assert.rejects(
    synchronize({
      path,
      fetcher: async (url) =>
        url === latestReleaseUrl
          ? Response.json(release.metadata)
          : new Response(null, { status: 404 })
    }),
    /Asset download failed/
  )
  assert.equal(await readFile(path, "utf8"), original)
})

test("a DMG that disagrees with SHA256SUMS cannot update the cask", async (context) => {
  const original = cask("0.5.2")
  const path = await temporaryCask(context, original)
  const release = fixture("0.5.3")
  release.manifest = release.manifest.replace(digest(release.bytes), "a".repeat(64))
  release.metadata.assets[1]!.digest = `sha256:${digest(release.manifest)}`
  await assert.rejects(
    synchronize({ path, fetcher: fetcherFor(release) }),
    /does not match SHA256SUMS/
  )
  assert.equal(await readFile(path, "utf8"), original)
})

test("GitHub digest disagreement prevents publication", async (context) => {
  const original = cask("0.5.2")
  const path = await temporaryCask(context, original)
  const release = fixture("0.5.3")
  release.metadata.assets[0]!.digest = `sha256:${"b".repeat(64)}`
  await assert.rejects(
    synchronize({ path, fetcher: fetcherFor(release) }),
    /GitHub asset digest mismatch/
  )
  assert.equal(await readFile(path, "utf8"), original)
})

test("truncated downloads cannot publish a cask", async (context) => {
  const original = cask("0.5.2")
  const path = await temporaryCask(context, original)
  const release = fixture("0.5.3")
  release.bytes = release.bytes.slice(1)
  await assert.rejects(synchronize({ path, fetcher: fetcherFor(release) }), /size mismatch/)
  assert.equal(await readFile(path, "utf8"), original)
})

test("an older upstream target cannot downgrade an installed release", async (context) => {
  const original = cask("0.10.0")
  const path = await temporaryCask(context, original)
  await assert.rejects(synchronize({ path, fetcher: fetcherFor(fixture("0.9.0")) }), /downgrade/)
  assert.equal(await readFile(path, "utf8"), original)
})

test("replacement bytes at the same version require manual investigation", async (context) => {
  const original = cask("0.5.2")
  const path = await temporaryCask(context, original)
  await assert.rejects(
    synchronize({ path, fetcher: fetcherFor(fixture("0.5.2", "replacement")) }),
    /Published bytes changed/
  )
  assert.equal(await readFile(path, "utf8"), original)
})

test("a newer release appearing during verification prevents stale publication", async (context) => {
  const original = cask("0.5.2")
  const path = await temporaryCask(context, original)
  await assert.rejects(
    synchronize({ path, fetcher: fetcherFor(fixture("0.5.3"), fixture("0.5.4").metadata) }),
    /Latest release changed/
  )
  assert.equal(await readFile(path, "utf8"), original)
})

test("only stable published releases with canonical complete assets are accepted", () => {
  const release = fixture("0.5.3")
  assert.throws(() => parseRelease({ ...release.metadata, draft: true }), /published/)
  assert.throws(() => parseRelease({ ...release.metadata, prerelease: true }), /published/)
  assert.throws(() => parseRelease({ ...release.metadata, tag_name: "v0.5.3-beta.1" }), /stable/)
  assert.throws(() => parseRelease({ ...release.metadata, assets: [] }), /exactly one/)
  release.metadata.assets[0]!.browser_download_url = "https://example.com/heron.dmg"
  assert.throws(() => parseRelease(release.metadata), /canonical URL/)
})

test("duplicate checksum entries are ambiguous and must be rejected", () => {
  const release = fixture("0.5.3")
  assert.throws(
    () => checksumFor(release.manifest.repeat(2), release.metadata.assets[0]!.name),
    /exactly one/
  )
})

test("release ordering uses numeric components", () => {
  assert.equal(compareVersions("0.10.0", "0.9.9"), 1)
  assert.equal(compareVersions("1.0.0", "0.99.99"), 1)
  assert.equal(compareVersions("0.5.2", "0.5.2"), 0)
})
