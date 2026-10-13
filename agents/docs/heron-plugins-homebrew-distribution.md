# Homebrew distribution (Heron Plugins)

Copy this document to `minori-live/heron-plugins/agents/docs/homebrew-distribution.md`
when opening the companion upstream PR. It mirrors Heron's publication contract.

## Release flow

1. Update VERSION and synchronize package versions using existing release tooling.
2. Push the matching v-prefixed tag. The publish workflow validates, signs,
   notarizes, and uploads installers to a draft Release.
3. Publish the reviewed Release. `notify-homebrew-tap.yml` notifies the Tap for
   non-prerelease v-prefixed releases.
4. The Tap re-reads the latest stable Release, validates its Universal DMG
   asset metadata, and updates its single `dsh0416/update-heron-plugins` PR.
   The required Tap utility check gates auto-merge.

Preparing an unreleased development version does not update the Cask. Drafts
and prereleases do not advance it. Preserve published assets; the Tap rejects
same-version asset digest changes and automatic downgrades. The Tap reads the
DMG digest supplied by GitHub's release API and writes it into the Cask.

macOS users can still download format-specific ZIPs manually. Homebrew installs
both VST3 and AUv2 from the Universal DMG via
[`minori-live/homebrew-tap`](https://github.com/minori-live/homebrew-tap):

```sh
brew install --cask minori-live/tap/heron-plugins
```

## Setup and recovery

Configure `TAP_SYNC_TOKEN` in this repository and `homebrew-tap` with a
fine-grained PAT whose resource owner is minori-live, whose only selected
repository is `homebrew-tap`, and whose permissions are Contents write and Pull
requests write. This repository uses it only to dispatch the Tap workflow.

Merge the Tap sync workflow onto its default branch, configure required checks
and auto-merge, and merge `notify-homebrew-tap.yml` here before relying on
automatic updates. Full setup instructions are owned by the Tap's
[maintenance guide](https://github.com/minori-live/homebrew-tap/blob/main/agents/docs/maintenance.md).

If notification fails, fix the reported credentials/configuration and run:

```sh
gh workflow run notify-homebrew-tap.yml --repo minori-live/heron-plugins --ref main
```

If notification succeeded but synchronization or PR checks failed, repair the
reported problem and run:

```sh
gh workflow run sync-heron-plugins.yml --repo minori-live/homebrew-tap --ref main
```

Both retries reconcile the latest stable Release without a tag input.
