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

type Fetcher = (url: string) => Promise<Response>
const caskPath = fileURLToPath(new URL("../Casks/heron.rb", import.meta.url))
const maximumManifestBytes = 1024 * 1024

// Public metadata and assets need no credentials. Never send the Tap write token
// to upstream downloads or their redirect targets.
const publicFetch: Fetcher = (url) => fetch(url, { signal: AbortSignal.timeout(300_000) })

async function latest(fetcher: Fetcher): Promise<Release> {
  const response = await fetcher(latestReleaseUrl)
  if (!response.ok) throw new Error(`Release lookup failed: HTTP ${response.status}`)
  return parseRelease(await response.json())
}

async function download(
  asset: Asset,
  fetcher: Fetcher,
  collect: boolean
): Promise<{ sha256: string; text: string }> {
  if (collect && asset.size > maximumManifestBytes) {
    throw new Error("SHA256SUMS exceeds the manifest size limit")
  }
  const response = await fetcher(asset.url)
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

export async function synchronize(options: {
  path: string
  check?: boolean
  fetcher?: Fetcher
}): Promise<{ changed: boolean; version: string }> {
  const fetcher = options.fetcher ?? publicFetch
  const content = await readFile(options.path, "utf8")
  const current = caskIdentity(content)
  const release = await latest(fetcher)
  if (compareVersions(release.version, current.version) < 0) {
    throw new Error("Refusing to downgrade the cask")
  }
  const manifest = await download(release.checksums, fetcher, true)
  const expectedSha256 = checksumFor(manifest.text, release.dmg.name)
  const dmg = await download(release.dmg, fetcher, false)
  if (dmg.sha256 !== expectedSha256) throw new Error("DMG does not match SHA256SUMS")
  const next = updateCask(content, release, dmg.sha256)

  // A new release or replacement asset during the download must not publish a
  // stale snapshot. A repeated notification or manual retry can reconcile it.
  const confirmed = await latest(fetcher)
  if (JSON.stringify(confirmed) !== JSON.stringify(release)) {
    throw new Error("Latest release changed during verification; retry synchronization")
  }
  const changed = next !== content
  if (options.check && changed) throw new Error("Cask does not match the latest stable release")
  if (changed) {
    const temporaryPath = `${options.path}.sync-${process.pid}`
    try {
      await writeFile(temporaryPath, next, { flag: "wx" })
      await rename(temporaryPath, options.path)
    } finally {
      await rm(temporaryPath, { force: true })
    }
  }
  return { changed, version: release.version }
}

if (import.meta.main) {
  try {
    const argumentsList = process.argv.slice(2)
    if (
      argumentsList.length > 1 ||
      (argumentsList.length === 1 && argumentsList[0] !== "--check")
    ) {
      throw new Error("Usage: node scripts/sync-heron.ts [--check]")
    }
    const result = await synchronize({ path: caskPath, check: argumentsList[0] === "--check" })
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
