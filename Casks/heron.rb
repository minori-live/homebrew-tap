cask "heron" do
  version "0.8.0"
  sha256 "70aa184ca21b33a448400ff7212cd3f52c58d8404dbb848856156aad59ebc39e"

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
