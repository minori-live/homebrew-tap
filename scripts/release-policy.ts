export const upstream = "minori-live/heron"
export const latestReleaseUrl = `https://api.github.com/repos/${upstream}/releases/latest`

export interface Asset {
  name: string
  url: string
  size: number
  sha256: string
}

export interface Release {
  tag: string
  version: string
  dmg: Asset
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Expected a GitHub release or asset object")
  }
  return value as Record<string, unknown>
}

function versionParts(version: string): bigint[] {
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)) {
    throw new Error(`Not a stable release version: ${version}`)
  }
  return version.split(".").map(BigInt)
}

export function compareVersions(left: string, right: string): number {
  const a = versionParts(left)
  const b = versionParts(right)
  for (let index = 0; index < 3; index++) {
    if (a[index]! < b[index]!) return -1
    if (a[index]! > b[index]!) return 1
  }
  return 0
}

function asset(assets: unknown[], tag: string, name: string): Asset {
  const matches = assets.map(record).filter((item) => item.name === name)
  if (matches.length !== 1) throw new Error(`Expected exactly one release asset: ${name}`)
  const item = matches[0]!
  const url = `https://github.com/${upstream}/releases/download/${tag}/${name}`
  if (item.state !== "uploaded" || item.browser_download_url !== url) {
    throw new Error(`Release asset is not uploaded at its canonical URL: ${name}`)
  }
  if (typeof item.size !== "number" || !Number.isSafeInteger(item.size) || item.size <= 0) {
    throw new Error(`Invalid release asset size: ${name}`)
  }
  if (typeof item.digest !== "string" || !/^sha256:[a-f0-9]{64}$/.test(item.digest)) {
    throw new Error(`Invalid GitHub asset digest: ${name}`)
  }
  return { name, url, size: item.size, sha256: item.digest.slice(7) }
}

export function parseRelease(value: unknown): Release {
  const release = record(value)
  if (release.draft !== false || release.prerelease !== false) {
    throw new Error("Only published, non-prerelease releases may update the cask")
  }
  if (typeof release.tag_name !== "string" || !release.tag_name.startsWith("v")) {
    throw new Error("Expected a v-prefixed release tag")
  }
  const tag = release.tag_name
  const version = tag.slice(1)
  versionParts(version)
  if (!Array.isArray(release.assets)) throw new Error("Missing release assets")
  return {
    tag,
    version,
    dmg: asset(release.assets, tag, `Heron-${version}-mac-universal.dmg`)
  }
}

export function caskIdentity(content: string): { version: string; sha256: string } {
  const versions = [...content.matchAll(/^  version "([^"]+)"$/gm)]
  const checksums = [...content.matchAll(/^  sha256 "([a-f0-9]{64})"$/gm)]
  if (versions.length !== 1 || checksums.length !== 1) {
    throw new Error("Expected one pinned version and SHA-256 in Casks/heron.rb")
  }
  const version = versions[0]![1]!
  versionParts(version)
  return { version, sha256: checksums[0]![1]! }
}

export function updateCask(content: string, release: Release): string {
  const current = caskIdentity(content)
  const sha256 = release.dmg.sha256
  const comparison = compareVersions(release.version, current.version)
  if (comparison < 0) throw new Error("Refusing to downgrade the cask")
  if (comparison === 0 && current.sha256 !== sha256) {
    throw new Error("Published bytes changed for the same version; manual investigation required")
  }
  return content
    .replace(/^  version "[^"]+"$/m, `  version "${release.version}"`)
    .replace(/^  sha256 "[a-f0-9]{64}"$/m, `  sha256 "${sha256}"`)
}
