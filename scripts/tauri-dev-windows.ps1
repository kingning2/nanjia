# Windows local dev: set FFMPEG_DIR / LIBCLANG_PATH, then pnpm tauri dev
$ErrorActionPreference = "Stop"

$Root = Split-Path $PSScriptRoot -Parent
& (Join-Path $PSScriptRoot "setup-ffmpeg-windows.ps1")

$ffmpegDir = (Get-Content "D:\ffmpeg-dev\.ready" -Raw).Trim()
$llvm = "C:\Program Files\LLVM\bin"
if (-not (Test-Path (Join-Path $llvm "clang.exe"))) {
  throw "LLVM/clang not found. Install with: winget install LLVM.LLVM"
}

$env:FFMPEG_DIR = $ffmpegDir
$env:LIBCLANG_PATH = $llvm
$env:PATH = "$ffmpegDir\bin;$env:PATH"

$envFile = Join-Path $Root ".env.development"
if (-not (Test-Path $envFile)) {
  throw "Missing $envFile - copy .env.development.example and fill in secrets"
}

Write-Host ("FFMPEG_DIR=" + $ffmpegDir)
Write-Host "Starting tauri dev ..."
Set-Location (Join-Path $Root "admin")
pnpm tauri dev
