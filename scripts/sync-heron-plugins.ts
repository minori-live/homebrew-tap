import { appendFile, readFile, rename, rm, writeFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { heronPlugins, latestReleaseApiUrl, parseRelease, updateCask } from "./release-policy.ts"
import type { Release } from "./release-policy.ts"

const caskPath = fileURLToPath(new URL("../Casks/heron-plugins.rb", import.meta.url))
const publicFetch = (url: string) => fetch(url, { signal: AbortSignal.timeout(300_000) })

async function latest(): Promise<Release> {
  const response = await publicFetch(latestReleaseApiUrl(heronPlugins))
  if (!response.ok) throw new Error(`Release lookup failed: HTTP ${response.status}`)
  return parseRelease(await response.json(), heronPlugins)
}

async function synchronize(path: string): Promise<{ changed: boolean; version: string }> {
  const content = await readFile(path, "utf8")
  const release = await latest()
  const next = updateCask(content, release)
  const changed = next !== content
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
      throw new Error("Usage: node scripts/sync-heron-plugins.ts")
    }
    const result = await synchronize(caskPath)
    if (process.env.GITHUB_OUTPUT) {
      await appendFile(
        process.env.GITHUB_OUTPUT,
        `changed=${result.changed}\nversion=${result.version}\n`
      )
    }
    console.log(
      `Heron Plugins ${result.version}: ${result.changed ? "updated cask" : "already synchronized"}`
    )
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Cask synchronization failed")
    process.exitCode = 1
  }
}
