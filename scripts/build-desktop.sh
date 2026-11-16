#!/usr/bin/env bash
# Build the DB Admin Tool desktop app (Tauri shell + bundled Node + Next.js standalone server).
#   ./scripts/build-desktop.sh            -> desktop/src-tauri/target/release/bundle/{macos,dmg}
#   ./scripts/build-desktop.sh --install  -> also copies the .app to /Applications
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$PWD"
TAURI_CLI="@tauri-apps/cli@2.12.5"

echo "▸ Next.js build"
npm run build

echo "▸ Assemble server bundle"
SERVER="$ROOT/desktop/build/server"
rm -rf "$SERVER" && mkdir -p "$(dirname "$SERVER")"
cp -R .next/standalone "$SERVER"
cp -R .next/static "$SERVER/.next/static"
cp -R public "$SERVER/public"
# Never ship local secrets or sessions that Next copies into standalone.
rm -rf "$SERVER/.env" "$SERVER"/.env.* "$SERVER/sessions"

echo "▸ Bundle Node runtime ($(node -v))"
TRIPLE="$(rustc -vV | sed -n 's/^host: //p')"
mkdir -p desktop/src-tauri/binaries
cp "$(node -p 'process.execPath')" "desktop/src-tauri/binaries/node-$TRIPLE"
chmod 755 "desktop/src-tauri/binaries/node-$TRIPLE"

echo "▸ Tauri build"
(cd desktop && npx -y "$TAURI_CLI" build --bundles app,dmg)

APP="desktop/src-tauri/target/release/bundle/macos/DB Admin Tool.app"
echo "✓ $APP"
ls desktop/src-tauri/target/release/bundle/dmg/*.dmg

if [[ "${1:-}" == "--install" ]]; then
  rm -rf "/Applications/DB Admin Tool.app"
  cp -R "$APP" /Applications/
  echo "✓ installed to /Applications/DB Admin Tool.app"
fi
