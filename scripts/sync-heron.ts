import { createHash } from "node:crypto"
import { appendFile, readFile, rename, rm, writeFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import {
  caskIdentity,
  checksumFor,
  compareVersions,
  latestReleaseUrl,
  parseRelease,
  updateCask
} from "./release-policy.ts"
import type { Asset, Release } from "./release-policy.ts"

const caskPath = fileURLToPath(new URL("../Casks/heron.rb", import.meta.url))
const maximumManifestBytes = 1024 * 1024

// Public metadata and assets need no credentials. Never send the Tap write token
// to upstream downloads or their redirect targets.
const publicFetch = (url: string) => fetch(url, { signal: AbortSignal.timeout(300_000) })

async function latest(): Promise<Release> {
  const response = await publicFetch(latestReleaseUrl)
  if (!response.ok) throw new Error(`Release lookup failed: HTTP ${response.status}`)
  return parseRelease(await response.json())
}

async function download(asset: Asset, collect: boolean): Promise<{ sha256: string; text: string }> {
  if (collect && asset.size > maximumManifestBytes) {
    throw new Error("SHA256SUMS exceeds the manifest size limit")
  }
  const response = await publicFetch(asset.url)
  if (!response.ok || !response.body) {
    throw new Error(`Asset download failed: ${asset.name}, HTTP ${response.status}`)
  }
  const hash = createHash("sha256")
  const chunks: Uint8Array[] = []
  let size = 0
  for await (const chunk of response.body) {
    size += chunk.length
    if (size > asset.size) throw new Error(`Downloaded asset exceeds declared size: ${asset.name}`)
    hash.update(chunk)
    if (collect) chunks.push(chunk)
  }
  if (size !== asset.size) throw new Error(`Downloaded asset size mismatch: ${asset.name}`)
  const sha256 = hash.digest("hex")
  if (asset.sha256 && asset.sha256 !== sha256) {
    throw new Error(`GitHub asset digest mismatch: ${asset.name}`)
  }
  return { sha256, text: collect ? Buffer.concat(chunks).toString("utf8") : "" }
}

async function synchronize(path: string): Promise<{ changed: boolean; version: string }> {
  const content = await readFile(path, "utf8")
  const current = caskIdentity(content)
  const release = await latest()
  if (compareVersions(release.version, current.version) < 0) {
    throw new Error("Refusing to downgrade the cask")
  }
  const manifest = await download(release.checksums, true)
  const expectedSha256 = checksumFor(manifest.text, release.dmg.name)
  if (release.dmg.sha256 && release.dmg.sha256 !== expectedSha256) {
    throw new Error("GitHub DMG digest does not match SHA256SUMS")
  }
  const next = updateCask(content, release, expectedSha256)
  const changed = next !== content
  // Repeated notifications compare release checksums without downloading the
  // installer again. Verify the actual DMG only when publishing a new version.
  if (changed) {
    const dmg = await download(release.dmg, false)
    if (dmg.sha256 !== expectedSha256) throw new Error("DMG does not match SHA256SUMS")
  }

  // A new release or replacement asset during the download must not publish a
  // stale snapshot. A repeated notification or manual retry can reconcile it.
  const confirmed = await latest()
  if (JSON.stringify(confirmed) !== JSON.stringify(release)) {
    throw new Error("Latest release changed during verification; retry synchronization")
  }
  if (changed) {
    const temporaryPath = `${path}.sync-${process.pid}`
    try {
      await writeFile(temporaryPath, next, { flag: "wx" })
      await rename(temporaryPath, path)
    } finally {
      await rm(temporaryPath, { force: true })
    }
  }
  return { changed, version: release.version }
}

if (import.meta.main) {
  try {
    if (process.argv.length > 2) {
      throw new Error("Usage: node scripts/sync-heron.ts")
    }
    const result = await synchronize(caskPath)
    if (process.env.GITHUB_OUTPUT) {
      await appendFile(
        process.env.GITHUB_OUTPUT,
        `changed=${result.changed}\nversion=${result.version}\n`
      )
    }
    console.log(
      `Heron ${result.version}: ${result.changed ? "updated cask" : "already synchronized"}`
    )
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Cask synchronization failed")
    process.exitCode = 1
  }
}
