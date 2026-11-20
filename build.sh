#!/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
APP="TrainingLog"
OUT="$ROOT/build"
STAGE="$OUT/Payload/$APP.app"
IPA="$ROOT/$APP-TrollStore.ipa"

echo "==> Toolchain"
SDK="$(xcrun --sdk iphoneos --show-sdk-path)"
CLANG="$(xcrun --sdk iphoneos --find clang)"
echo "    SDK   : $SDK"
echo "    clang : $CLANG"
xcodebuild -version | head -2 || true

echo "==> Clean"
rm -rf "$OUT" "$IPA"
mkdir -p "$STAGE/www"

echo "==> Compile arm64 Mach-O"
"$CLANG" -arch arm64 \
  -mios-version-min=15.0 \
  -isysroot "$SDK" \
  -fobjc-arc -Os -Wall \
  -framework Foundation -framework UIKit -framework WebKit -framework CoreGraphics \
  -o "$STAGE/$APP" "$ROOT/Sources/main.m"

echo "==> Assemble bundle"
cp "$ROOT/Resources/Info.plist" "$STAGE/Info.plist"
cp "$ROOT/Resources/bridge.js" "$STAGE/bridge.js"
cp "$ROOT/Resources/"Icon*.png "$STAGE/"
cp -R "$ROOT/www/." "$STAGE/www/"
printf 'APPL????' > "$STAGE/PkgInfo"

echo "==> Ad-hoc sign (TrollStore re-signs on install)"
codesign --force --sign - --timestamp=none "$STAGE/$APP" \
  || echo "    (ad-hoc sign skipped; TrollStore will re-sign on install)"

echo "==> Package IPA"
(cd "$OUT" && zip -qry "$IPA" Payload)

echo "==> Verify"
file "$STAGE/$APP"
plutil -lint "$STAGE/Info.plist"
unzip -t "$IPA" | tail -2
echo "    files in www: $(find "$STAGE/www" -type f | wc -l | tr -d ' ')"
echo "    IPA size    : $(du -h "$IPA" | cut -f1)"
echo "==> Done: $IPA"
