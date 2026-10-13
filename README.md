# minori.live Homebrew Tap

Install [Heron](https://heron.minori.live/), a desktop digital audio workstation,
and [Heron Plugins](https://github.com/minori-live/heron-plugins) on Apple Silicon
or Intel Macs running macOS 14.2 or later.

## Heron

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

## Heron Plugins

Install the signed and notarized Universal macOS suite (VST3 and AUv2) with:

```sh
brew install --cask minori-live/tap/heron-plugins
```

Upgrade and uninstall with:

```sh
brew update
brew upgrade --cask minori-live/tap/heron-plugins
brew uninstall --cask minori-live/tap/heron-plugins
```

After installing or upgrading, quit your DAW, restart it, and rescan plug-ins.
Uninstall removes the suite bundles only; other plug-ins and DAW projects stay.

Heron embeds its own checksum-pinned VST3 suite and upgrades it with the
application. Use this cask for other DAWs, or when you want the AUv2 components.

## Release tracking

This Tap installs published Universal macOS assets from
[Heron](https://github.com/minori-live/heron/releases) and
[Heron Plugins](https://github.com/minori-live/heron-plugins/releases).
It has no independent application or plug-in version or build pipeline. Release
notifications update each cask through a checked pull request; there is no
scheduled sync.

For credential setup, required checks, local commands, and manual synchronization,
see [Tap maintenance](agents/docs/maintenance.md).
