# Tap maintenance

## Ownership and publication

Heron and Heron Plugins own VERSION, release tags, packaging, signing,
notarization, and release assets. This Tap owns installation instructions and
synchronization. Each Cask tracks the latest published stable Release selected by
that product's GitHub Releases API, not `main/VERSION`.

| Product       | Dispatch event                    | Sync workflow            | Cask                     | Asset                                     |
| ------------- | --------------------------------- | ------------------------ | ------------------------ | ----------------------------------------- |
| Heron         | `heron-release-published`         | `sync-heron.yml`         | `Casks/heron.rb`         | `Heron-<ver>-mac-universal.dmg`           |
| Heron Plugins | `heron-plugins-release-published` | `sync-heron-plugins.yml` | `Casks/heron-plugins.rb` | `heron-plugins-<ver>-macos-universal.dmg` |

Each product sends its dispatch after a stable Release is published. The Tap
treats that event only as a wake-up signal and queries upstream again. Delayed
older notifications therefore synchronize the current release. Drafts,
prereleases, incomplete assets, noncanonical URLs, downgrades, and changed bytes
at the same version are rejected.

`scripts/sync-heron.ts` and `scripts/sync-heron-plugins.ts` read the Universal
DMG's SHA-256 digest from GitHub's Releases API and write it into the matching
Cask. GitHub generates the digest when the asset is uploaded; Homebrew verifies
the installer during installation. Release metadata must remain unchanged before
the cask is replaced atomically. Only `version` and `sha256` are updated;
installation settings remain intact.

Successful synchronization creates or updates the fixed PR branch for that
product (`dsh0416/update-heron` or `dsh0416/update-heron-plugins`). Repeated
notifications create no additional PRs or commits. Required CI checks gate
auto-merge. Failures leave the published cask intact. The Tap can briefly lag a
release; there is no scheduled reconciliation.

## One-time credential setup

No custom GitHub App is required. Create a fine-grained personal access token:

1. Set resource owner to `minori-live` and select only `homebrew-tap`.
2. Grant **Contents: Read and write** and **Pull requests: Read and write**.
   Metadata read access is implicit. No Heron or Heron Plugins repository write
   access is needed.
3. Complete organization approval if the token is shown as pending.
4. Add the token as Actions secret `TAP_SYNC_TOKEN` in `minori-live/heron`,
   `minori-live/heron-plugins`, and `minori-live/homebrew-tap`, or use an
   organization secret visible to exactly these repositories.
5. Renew the token before expiration and replace the secrets.

Upstream repositories use the token only for repository dispatch. The Tap uses
it to push its release branch, create/update the PR, and enable auto-merge.
Public upstream metadata is fetched without credentials.

The default GITHUB_TOKEN is limited to its own repository. A PAT is needed for
the cross-repository notification and allows PR checks to run without the
approval required for PRs created using GITHUB_TOKEN. See
[GitHub's token documentation](https://docs.github.com/en/actions/concepts/security/github_token)
and [dispatch permissions](https://docs.github.com/en/rest/repos/repos#create-a-repository-dispatch-event).

## Required repository settings

After merging the initial Tap files and running **Check utilities** once:

1. Enable **Allow auto-merge** and **Allow squash merging** in Settings → General.
2. Add classic branch protection for `main`, requiring a pull request and the
   `Utilities` check.
3. Require the branch to be up to date before merging. Leave required approving
   reviews disabled if release PRs should merge without manual review.

Use the exact check name above. Keep the fixed automation branches outside the
protected branch pattern: updating their PRs may require a force push. Before
requesting auto-merge, each sync workflow checks that auto-merge is enabled and
the required `Utilities` check protects main. Missing settings fail the run and leave
the PR available for review.

If a newer stable release appears during synchronization, dispatch again to
refresh that same PR. Normal release notifications do this automatically; a lost
notification needs a manual retry. Intentional rollbacks and same-version
replacements require investigation and a reviewed change.

## Bootstrap and manual retry

Dispatch workflows must be on their repositories' default branches.

Run from any GitHub-authenticated checkout:

```sh
gh workflow run sync-heron.yml --repo minori-live/homebrew-tap --ref main
gh workflow run sync-heron-plugins.yml --repo minori-live/homebrew-tap --ref main
```

To retry an upstream notification instead:

```sh
gh workflow run notify-homebrew-tap.yml --repo minori-live/heron --ref main
gh workflow run notify-homebrew-tap.yml --repo minori-live/heron-plugins --ref main
```

Both paths reconcile the current stable Release without a manually supplied
version. Missing or expired credentials fail the workflow; replace the secret
and retry. There is no polling or scheduled fallback.

## Local validation

```sh
mise install
mise run check
```

`check` runs formatting, TypeScript checks and release-policy tests. CI also runs
`ruby -c` on every file under `Casks/`. Like
[HashiCorp's Tap CI](https://github.com/hashicorp/homebrew-tap/blob/main/.github/workflows/ci.yml),
Tap CI focuses on its utilities. It does not download, install, or start Heron
or the plug-ins. Upstream release pipelines own building, signing, and
notarization.

```sh
mise run sync
mise run sync:heron-plugins
```

These update each local Cask from the latest stable Release's DMG digest.

On macOS, tap the local checkout before checking or installing it:

```sh
brew tap minori-live/tap "$PWD"
brew style Casks/heron.rb Casks/heron-plugins.rb
brew audit --cask --new --online minori-live/tap/heron
brew audit --cask --new --online minori-live/tap/heron-plugins
brew install --cask minori-live/tap/heron
brew install --cask minori-live/tap/heron-plugins
brew uninstall --cask minori-live/tap/heron
brew uninstall --cask minori-live/tap/heron-plugins
```

Untap an existing minori.live Tap first, or Homebrew will keep its previous
checkout. Manual installation checks need a Mac; plug-in host validation also
needs a DAW.
