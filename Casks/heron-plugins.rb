cask "heron-plugins" do
  version "0.8.1"
  sha256 "8d0dedb4d142565c58b30c5d65a832a82bf4480c6ddc6c4afa7f7264faef9bb8"

  url "https://github.com/minori-live/heron-plugins/releases/download/v#{version}/heron-plugins-#{version}-macos-universal.dmg"
  name "Heron Plugins"
  desc "Audio plug-in suite for Heron and other DAWs"
  homepage "https://github.com/minori-live/heron-plugins"

  livecheck do
    url :url
    strategy :github_latest
  end

  depends_on macos: :sonoma

  # One combined cask installs VST3 and AUv2 from the notarized Universal DMG.
  audio_unit_plugin "Audio Units/Heron EQ.component"
  audio_unit_plugin "Audio Units/Heron Gain.component"
  audio_unit_plugin "Audio Units/Heron Metronome.component"
  audio_unit_plugin "Audio Units/Heron Sine.component"
  vst3_plugin "VST3/Heron EQ.vst3"
  vst3_plugin "VST3/Heron Gain.vst3"
  vst3_plugin "VST3/Heron Metronome.vst3"
  vst3_plugin "VST3/Heron Sine.vst3"

  uninstall delete: [
    "~/Library/Audio/Plug-Ins/Components/Heron EQ.component",
    "~/Library/Audio/Plug-Ins/Components/Heron Gain.component",
    "~/Library/Audio/Plug-Ins/Components/Heron Metronome.component",
    "~/Library/Audio/Plug-Ins/Components/Heron Sine.component",
    "~/Library/Audio/Plug-Ins/VST3/Heron EQ.vst3",
    "~/Library/Audio/Plug-Ins/VST3/Heron Gain.vst3",
    "~/Library/Audio/Plug-Ins/VST3/Heron Metronome.vst3",
    "~/Library/Audio/Plug-Ins/VST3/Heron Sine.vst3",
  ]

  # Leave DAW projects and other user plug-ins alone.
  zap rmdir: [
    "~/Library/Audio/Plug-Ins/Components",
    "~/Library/Audio/Plug-Ins/VST3",
  ]

  caveats <<~EOS
    Requires macOS 14.2 or later.

    Quit your DAW, then restart it and rescan plug-ins after installing or
    upgrading. Release macOS bundles are Developer ID signed and notarized;
    Homebrew does not strip quarantine attributes.
  EOS
end
