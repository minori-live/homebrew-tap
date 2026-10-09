cask "heron" do
  version "0.6.5"
  sha256 "94ded846df68fa30c399051efc2c2e0090e8aa3ea8f8aba270513da3403afc95"

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
