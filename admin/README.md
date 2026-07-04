# 管理端（Tauri）

桌面管理后台，通过 Rust 直连 CloudBase（云存储、云数据库）。

**环境变量、数据库初始化、云函数部署、多环境同步** 见项目根 [README.md](../README.md)。

## 开发

**Windows**（需 FFmpeg **shared** 库编译 Rust，与 `D:\ffmpeg` 里仅含 exe 的 essentials 版不同）：

```powershell
cd admin
pnpm dev:desktop
```

首次会自动下载 shared 库到 `D:\ffmpeg-dev\`（约 76MB）。`.env.development` 放在**项目根目录**。

**macOS / Linux**：

```bash
cd admin
pnpm tauri dev
```

### release 打包与环境变量（bundled-env）

安装包内会带上 **测试 / 正式** 两套 CloudBase 配置（`bundled-env/.env.test`、`.env.production`），供管理端切换环境，**不会**把 `.env.development` 打进包。

| 场景 | 环境文件从哪来 |
|------|----------------|
| **本地** `pnpm tauri:build` | 复制项目根目录的 `.env.test` / `.env.production`（自行维护，不提交 Git） |
| **GitHub CI** | ① `write-env-from-secrets.mjs` 用 Secrets 生成根目录 `.env.*`；② `build.rs` 若仍缺文件则**直接从构建进程环境变量**写入 `bundled-env/` |

因此 **不必**把密钥提交进 Git；在仓库 Secrets 配好即可，CI 打出来的安装包照样内置测试/正式环境。

## FFmpeg 动态链接（分类视频压缩）

三端统一走 `ffmpeg-next` 动态链接，构建时随包分发 ffmpeg 运行时库。

- **macOS**：`brew install ffmpeg dylibbundler`（编译期走 pkg-config）。**release 打包**请用 `pnpm tauri:build`（不是裸 `tauri build`）：先只打 `.app`（避开 CI 上 `bundle_dmg.sh` / AppleScript 失败），再由脚本嵌入 ffmpeg 并产出 `.dmg` / `.app.tar.gz`。有开发者证书时设 `APPLE_SIGNING_IDENTITY`。验收：`otool -L …/nanjia-beauty-admin` 中不应再出现 `/usr/local/opt/` 或 `/opt/homebrew/`。
- **Linux**：`brew install ffmpeg` 或系统包（走 pkg-config，`FFMPEG_DIR` 可选）。
- **Windows**：下载预编译 **shared** 库（8.1 分支，与 macOS brew / `ffmpeg-next 8.1` 对齐），把 `FFMPEG_DIR` 指向解压根目录（含 `include/ lib/ bin/`），并把 `bin` 加入 `PATH`：

  ```powershell
  # 下载 https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-n8.1-latest-win64-gpl-shared-8.1.zip 并解压
  $env:FFMPEG_DIR = "D:\ffmpeg-n8.1-latest-win64-gpl-shared-8.1"
  $env:LIBCLANG_PATH = "C:\Program Files\LLVM\bin"   # ffmpeg-sys-next bindgen 需要 libclang
  $env:PATH = "$env:FFMPEG_DIR\bin;$env:PATH"
  ```

  打包时需把 `bin\*.dll`（av*/sw* 运行时库）复制到 `src-tauri/ffmpeg/`，`tauri.windows.conf.json` 会将其打进安装包并置于 exe 同目录（CI 已自动处理）。

## 自动更新（GitHub Release）

release 版启动时会请求 GitHub Release 上的 `latest.json`，有新版本则弹出系统更新对话框。

清单地址：`https://github.com/kingning2/nanjia/releases/latest/download/latest.json`

### 配置

1. **GitHub Secrets**：见项目根 [README.md](../README.md#github-secrets私有公开仓库-ci-打包必填)（含 `TAURI_SIGNING_PRIVATE_KEY` 等）。**勿将 `.env.*` 提交进 Git。**
2. **仓库需公开**：客户端需能匿名拉取 Release 资源；私有仓库需另行配置 GitHub API + Token（当前未支持）。

### 发布流程

打 tag 后 CI 会：构建 → 上传安装包到 GitHub Release → 合并写入 `latest.json`（各平台工作流分别贡献 `darwin-aarch64` / `darwin-x86_64` / `windows-x86_64` 条目）。

本地手动补写单平台 manifest（可选，需 `gh` CLI 已登录且 Release 已存在）：

```bash
# 需先 pnpm -C admin tauri:build，并设置 TAURI_SIGNING_PRIVATE_KEY
node scripts/publish-admin-update.mjs --platform darwin-aarch64 --version 0.1.4 --tag v0.1.4
```

`platform` 取值：`darwin-aarch64` | `darwin-x86_64` | `windows-x86_64`。

### 无代码签名证书说明

未购买 Apple/Windows 代码签名时，更新包完整性仍由 Tauri Ed25519 签名保护；系统可能提示「无法验证开发者」，内部分发可接受。

## 目录

```
admin/
├── src/pages/           # 分类、项目、素材、首页设置、同步中心
├── src/services/        # Tauri invoke 封装
├── src-tauri/src/cloud/ # CloudBase HTTP 客户端
└── src-tauri/src/sync/  # 媒体冗余检查、环境迁移 sidecar 调用
```

## IDE

[VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
