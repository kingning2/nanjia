#!/bin/bash
# ponytail: 未签名 Mac 应用的临时绕过脚本；根治方案是 Apple 签名 + 公证

set -e

APP_NAME="NANJIA BEAUTY.app"
DIR="$(cd "$(dirname "$0")" && pwd)"
APP_IN_DMG="$DIR/$APP_NAME"
APP_IN_APPLICATIONS="/Applications/$APP_NAME"

clear_quarantine() {
  if [ -e "$1" ]; then
    xattr -cr "$1"
  fi
}

echo "正在解除 macOS 下载隔离（不是修复损坏文件）..."
clear_quarantine "$DIR"
clear_quarantine "$APP_IN_DMG"
clear_quarantine "$APP_IN_APPLICATIONS"

if [ -d "$APP_IN_APPLICATIONS" ]; then
  echo "正在打开：$APP_IN_APPLICATIONS"
  open "$APP_IN_APPLICATIONS"
elif [ -d "$APP_IN_DMG" ]; then
  echo "正在打开：$APP_IN_DMG"
  echo "建议：把 $APP_NAME 拖到「应用程序」文件夹后再从启动台打开。"
  open "$APP_IN_DMG"
else
  echo "未找到 $APP_NAME。"
  echo "请先把应用拖到「应用程序」文件夹，或确保本脚本与 $APP_NAME 在同一目录（DMG 里）。"
  read -r -p "按回车键关闭..."
  exit 1
fi

echo "完成。"
sleep 2
