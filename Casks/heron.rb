cask "heron" do
  version "0.6.4"
  sha256 "5ee8217760bd5fa450cfebdf0c269d51972176a698fa3f9099d462a4baab8c13"

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
