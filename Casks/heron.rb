cask "heron" do
  version "0.5.2"
  sha256 "b64c26262a93f9487ac0146088b39eedc118e3ddbf9e8cb52005f90f7a352d29"

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

  app "Heron.app"

  caveats "Requires macOS 14.2 or later."
end
