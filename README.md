# minori.live Homebrew Tap

Install [Heron](https://heron.minori.live/), a desktop digital audio workstation,
on Apple Silicon or Intel Macs running macOS 14.2 or later:

```sh
brew install --cask minori-live/tap/heron
```

Heron can download and install updates from inside the application. To update
through Homebrew instead, close Heron and run:

```sh
brew update
brew upgrade --cask --greedy-auto-updates minori-live/tap/heron
```

Uninstall the application with:

```sh
brew uninstall --cask minori-live/tap/heron
```

The cask does not delete projects or application data during uninstall.

This Tap installs the signed and notarized Universal DMG from
[Heron's published releases](https://github.com/minori-live/heron/releases).
It has no independent application version or build pipeline. Release notifications
update the cask through a checked pull request; there is no scheduled sync.

For credential setup, required checks, local commands, and manual synchronization,
see [Tap maintenance](agents/docs/maintenance.md).
