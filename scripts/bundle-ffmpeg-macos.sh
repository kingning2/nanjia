#!/usr/bin/env bash
# 将 Homebrew ffmpeg 动态库打入 .app/Contents/Frameworks，改写 install_name 并重新签名。
# 在 macOS 上于 `tauri build` 之后运行（CI 与本地 release 打包均会调用）。
set -euo pipefail

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "bundle-ffmpeg-macos: 非 macOS，跳过"
  exit 0
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BUNDLE_MACOS="$ROOT/admin/src-tauri/target/release/bundle/macos"
BIN_NAME="nanjia-beauty-admin"
HOMEBREW_RE='(/opt/homebrew/|/usr/local/opt/)'

usage() {
  echo "用法: $0 [--verify-only]"
  echo "  --verify-only  只检查可执行文件是否仍引用 Homebrew 路径"
}

VERIFY_ONLY=false
for arg in "$@"; do
  case "$arg" in
    --verify-only) VERIFY_ONLY=true ;;
    -h|--help) usage; exit 0 ;;
    *) echo "未知参数: $arg"; usage; exit 1 ;;
  esac
done

find_app_bundle() {
  find "$BUNDLE_MACOS" -maxdepth 1 -name '*.app' -print -quit 2>/dev/null || true
}

APP="$(find_app_bundle)"
if [[ -z "$APP" || ! -d "$APP" ]]; then
  echo "bundle-ffmpeg-macos: 未找到 .app（先运行 tauri build）: $BUNDLE_MACOS"
  exit 1
fi

EXE="$APP/Contents/MacOS/$BIN_NAME"
if [[ ! -f "$EXE" ]]; then
  echo "bundle-ffmpeg-macos: 可执行文件不存在: $EXE"
  exit 1
fi

has_homebrew_refs() {
  otool -L "$1" 2>/dev/null | grep -qE "$HOMEBREW_RE"
}

if ! has_homebrew_refs "$EXE"; then
  echo "bundle-ffmpeg-macos: 可执行文件已无 Homebrew 绝对路径，跳过"
  exit 0
fi

if $VERIFY_ONLY; then
  echo "bundle-ffmpeg-macos: 仍引用 Homebrew 路径:"
  otool -L "$EXE" | grep -E "$HOMEBREW_RE" || true
  exit 1
fi

if ! command -v dylibbundler >/dev/null 2>&1; then
  echo "bundle-ffmpeg-macos: 需要 dylibbundler，请执行: brew install dylibbundler"
  exit 1
fi

FRAMEWORKS="$APP/Contents/Frameworks"
mkdir -p "$FRAMEWORKS"

echo "bundle-ffmpeg-macos: 打包 ffmpeg 依赖 → $FRAMEWORKS"
dylibbundler -of -b -x "$EXE" -d "$FRAMEWORKS" -p @executable_path/../Frameworks/

IDENTITY="${APPLE_SIGNING_IDENTITY:--}"
echo "bundle-ffmpeg-macos: 重新签名 (identity=${IDENTITY})"

if [[ -d "$FRAMEWORKS" ]]; then
  while IFS= read -r -d '' lib; do
    codesign --force --sign "$IDENTITY" "$lib"
  done < <(find "$FRAMEWORKS" \( -name '*.dylib' -o -name '*.so' \) -print0)
fi

codesign --force --sign "$IDENTITY" "$EXE"
codesign --force --sign "$IDENTITY" "$APP"

if has_homebrew_refs "$EXE"; then
  echo "bundle-ffmpeg-macos: 失败，可执行文件仍引用 Homebrew 路径:"
  otool -L "$EXE" | grep -E "$HOMEBREW_RE" || true
  exit 1
fi

# 检查 Frameworks 内互相引用
while IFS= read -r -d '' lib; do
  if has_homebrew_refs "$lib"; then
    echo "bundle-ffmpeg-macos: 失败，$(basename "$lib") 仍引用 Homebrew 路径:"
    otool -L "$lib" | grep -E "$HOMEBREW_RE" || true
    exit 1
  fi
done < <(find "$FRAMEWORKS" \( -name '*.dylib' -o -name '*.so' \) -print0 2>/dev/null)

echo "bundle-ffmpeg-macos: install_name 已改写，开始重建分发包"

BUNDLE_ROOT="$ROOT/admin/src-tauri/target/release/bundle"
APP_NAME="$(basename "$APP")"

TAR_GZ="$BUNDLE_ROOT/macos/${APP_NAME}.tar.gz"
rm -f "$TAR_GZ"
tar -czf "$TAR_GZ" -C "$BUNDLE_MACOS" "$APP_NAME"
echo "bundle-ffmpeg-macos: 已重建 $TAR_GZ"

DMG_DIR="$BUNDLE_ROOT/dmg"
if [[ -d "$DMG_DIR" ]]; then
  DMG_FILE="$(find "$DMG_DIR" -maxdepth 1 -name '*.dmg' -print -quit || true)"
  if [[ -n "$DMG_FILE" ]]; then
    VOLNAME="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleName' "$APP/Contents/Info.plist" 2>/dev/null || echo "$APP_NAME")"
    STAGING="$(mktemp -d)"
    cp -R "$APP" "$STAGING/"
    rm -f "$DMG_FILE"
    hdiutil create -volname "$VOLNAME" -srcfolder "$STAGING" -ov -format UDZO "$DMG_FILE" >/dev/null
    rm -rf "$STAGING"
    echo "bundle-ffmpeg-macos: 已重建 $DMG_FILE"
  fi
fi

echo "bundle-ffmpeg-macos: 完成"
