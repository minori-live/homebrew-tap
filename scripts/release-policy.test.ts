import assert from "node:assert/strict"
import { test } from "node:test"
import { caskIdentity, parseRelease, updateCask } from "./release-policy.ts"

const oldDigest = "a".repeat(64)
const newDigest = "b".repeat(64)
const cask = `cask "example" do
  version "1.0.0"
  sha256 "${oldDigest}"
  app "Heron.app"
end
`

function release(version = "1.1.0", digest = newDigest) {
  const name = `Heron-${version}-mac-universal.dmg`
  return {
    draft: false,
    prerelease: false,
    tag_name: `v${version}`,
    assets: [
      {
        name,
        state: "uploaded",
        browser_download_url: `https://github.com/minori-live/heron/releases/download/v${version}/${name}`,
        size: 123,
        digest: `sha256:${digest}`
      }
    ]
  }
}

test("uses the GitHub DMG digest without a checksum catalog", () => {
  const next = updateCask(cask, parseRelease(release()))
  assert.deepEqual(caskIdentity(next), { version: "1.1.0", sha256: newDigest })
  assert.equal(
    next.replace('  version "1.1.0"', '  version "1.0.0"').replace(newDigest, oldDigest),
    cask
  )
})

test("a repeated release leaves the Cask unchanged", () => {
  assert.equal(updateCask(cask, parseRelease(release("1.0.0", oldDigest))), cask)
})

test("rejects downgrades and same-version digest changes", () => {
  assert.throws(() => updateCask(cask, parseRelease(release("0.9.0"))), /downgrade/)
  assert.throws(() => updateCask(cask, parseRelease(release("1.0.0"))), /Published bytes changed/)
})

test("requires GitHub's SHA-256 digest", () => {
  for (const digest of [
    undefined,
    null,
    "",
    `sha512:${newDigest}`,
    `sha256:${newDigest.slice(1)}`
  ]) {
    const metadata = release()
    assert.throws(
      () => parseRelease({ ...metadata, assets: [{ ...metadata.assets[0], digest }] }),
      /Invalid GitHub asset digest/
    )
  }
})

test("requires the uploaded Universal DMG at its canonical release URL", () => {
  const metadata = release()
  for (const override of [
    { name: "Heron-1.1.0-mac-x64.dmg" },
    { state: "new" },
    { browser_download_url: "https://example.com/Heron.dmg" },
    { size: 0 }
  ]) {
    assert.throws(() =>
      parseRelease({ ...metadata, assets: [{ ...metadata.assets[0], ...override }] })
    )
  }
})

test("requires a published stable release version", () => {
  const metadata = release()
  for (const override of [{ draft: true }, { prerelease: true }, { tag_name: "v1.1.0-beta.1" }]) {
    assert.throws(() => parseRelease({ ...metadata, ...override }))
  }
})
