# One-time: download FFmpeg shared libs for Tauri (include/lib/dll)
$ErrorActionPreference = "Stop"

$destRoot = "D:\ffmpeg-dev"
$marker = Join-Path $destRoot ".ready"

if (Test-Path $marker) {
  Write-Host ("FFmpeg shared ready: " + (Get-Content $marker -Raw))
  exit 0
}

New-Item -ItemType Directory -Force -Path $destRoot | Out-Null
$zip = Join-Path $env:TEMP "ffmpeg-shared-8.1.zip"
Write-Host "Downloading FFmpeg shared 8.1 (~76MB) ..."
curl.exe -L "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-n8.1-latest-win64-gpl-shared-8.1.zip" -o $zip
Expand-Archive -Path $zip -Force -DestinationPath $destRoot
$inner = Get-ChildItem $destRoot -Directory | Where-Object { Test-Path (Join-Path $_.FullName "include") } | Select-Object -First 1
if (-not $inner) { throw "No include/ dir after extract" }
Set-Content -Path $marker -Value $inner.FullName
Write-Host ("Done: " + $inner.FullName)
