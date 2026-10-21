cask "heron" do
  version "0.9.0"
  sha256 "90686cfa354f53a5aa52662a1c1efd8fdd3a3945e7572aecefa1aae1a90de5d6"

  url "https://github.com/minori-live/heron/releases/download/v#{version}/Heron-#{version}-mac-universal.dmg"
  name "Heron"
  desc "Digital audio workstation"
  homepage "https://heron.minori.live/"

  livecheck do
    url :url
    strategy :github_latest
  end

  auto_updates true
  depends_on macos: :sonoma

  # Preserve the application name documented by Heron while matching the DMG's case.
  app "heron.app", target: "Heron.app"

  caveats "Requires macOS 14.2 or later."
end
