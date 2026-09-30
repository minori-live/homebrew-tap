# Tap maintenance

## Ownership and publication

Heron's main repository owns VERSION, release tags, packaging, signing,
notarization, and release assets. This Tap owns installation instructions and
synchronization. Its Cask tracks the latest published stable Release selected by
Heron's GitHub Releases API, not `main/VERSION`.

Heron sends `heron-release-published` after a stable Release is published. The Tap
treats that event only as a wake-up signal and queries upstream again. Delayed
older notifications therefore synchronize the current release. Drafts,
prereleases, incomplete assets, noncanonical URLs, downgrades, and changed bytes
at the same version are rejected.

For a new version, `scripts/sync-heron.ts` streams the Universal DMG and checks
its size and SHA-256 against SHA256SUMS and available GitHub asset digests.
Repeated notifications compare release checksums without downloading the DMG
again. Release metadata must remain unchanged before the cask is replaced
atomically. Only `version` and `sha256` are updated; installation settings remain
intact.

Successful synchronization creates or updates the single `dsh0416/update-heron`
PR. Repeated notifications create no additional PRs or commits. Required CI
checks gate auto-merge. Failures leave the published cask intact. The Tap can
briefly lag a release; there is no scheduled reconciliation.

## One-time credential setup

No custom GitHub App is required. Create a fine-grained personal access token:

1. Set resource owner to `minori-live` and select only `homebrew-tap`.
2. Grant **Contents: Read and write** and **Pull requests: Read and write**.
   Metadata read access is implicit. No Heron repository write access is needed.
3. Complete organization approval if the token is shown as pending.
4. Add the token as Actions secret `TAP_SYNC_TOKEN` in both `minori-live/heron`
   and `minori-live/homebrew-tap`, or use an organization secret visible to
   exactly these two repositories.
5. Renew the token before expiration and replace both secrets.

Heron uses the token only for repository dispatch. The Tap uses it to push its
release branch, create/update the PR, and enable auto-merge. Public upstream
metadata and downloads are fetched without credentials.

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

Use the exact check name above. Keep the fixed automation branch outside the
protected branch pattern: updating its PR may require a force push. Before
requesting auto-merge, the sync workflow checks that auto-merge is enabled and
the required `Utilities` check protects main. Missing settings fail the run and leave
the PR available for review.

If a newer stable release appears during synchronization, dispatch again to
refresh that same PR. Normal release notifications do this automatically; a lost
notification needs a manual retry. Intentional rollbacks and same-version
replacements require investigation and a reviewed change.

## Bootstrap and manual retry

Both dispatch workflows must be on their repositories' default branches. The
initial cask uses the published Heron 0.5.2 DMG; no new Heron release is needed.

Run from any GitHub-authenticated checkout:

```sh
gh workflow run sync-heron.yml --repo minori-live/homebrew-tap --ref main
```

To retry Heron's notification instead:

```sh
gh workflow run notify-homebrew-tap.yml --repo minori-live/heron --ref main
```

Both paths reconcile the current stable Release without a manually supplied
version. Missing or expired credentials fail the workflow; replace the secret
and retry. There is no polling or scheduled fallback.

## Local validation

```sh
mise install
mise run check
```

`check` runs formatting and TypeScript checks. CI also runs
`ruby -c Casks/heron.rb` to check Ruby syntax. Like
[HashiCorp's Tap CI](https://github.com/hashicorp/homebrew-tap/blob/main/.github/workflows/ci.yml),
Tap CI focuses on its utilities. It does not download, install, or start Heron.
Heron's release pipeline owns building, signing, and notarization.

`mise run sync` updates the local Cask from the latest stable Release and verifies
the actual DMG when the version changes.

On macOS, tap the local checkout before checking or installing it:

```sh
brew tap minori-live/tap "$PWD"
brew style Casks/heron.rb
brew install --cask minori-live/tap/heron
brew audit --cask --online minori-live/tap/heron
brew uninstall --cask minori-live/tap/heron
```

Untap an existing minori.live Tap first, or Homebrew will keep its previous
checkout. Manual installation checks need a Mac; audio-device validation also
needs the relevant devices.
