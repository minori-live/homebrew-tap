cask "heron" do
  version "0.6.3"
  sha256 "7f706ef10ae7aee842615619bbc55906eb647e1765f63acff32c62e42f3fac4a"

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
