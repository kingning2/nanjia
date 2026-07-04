# 南嘉婚礼策划工作室（Nanjia Beauty）

Taro 4 微信小程序 + Tauri 管理端 + 微信云开发云函数，三端共享 `share/types` 契约。

## 技术栈


| 端   | 技术                                                          |
| --- | ----------------------------------------------------------- |
| 小程序 | Taro 4 · React 18 · TypeScript · Sass · NutUI               |
| 管理端 | Tauri 2 · React · Ant Design Pro · Rust（CloudBase HTTP API） |
| 云端  | 微信云开发 · 文档型数据库 · 云存储 · 云函数                                  |


## 目录

```
share/types/          # 小程序 + 管理端 + 云函数 共用 DTO
src/                  # 小程序
admin/                # Tauri 管理端
cloud/functions/      # 云函数（portfolioHome、splashConfig 等 7 个）
cloud/cf-shared/      # 云函数共享模块
config/               # Taro 构建配置
```

## 快速开始

### 1. 安装依赖

```bash
pnpm install
cd admin && pnpm install
```

### 2. 环境变量（三环境，小程序与管理端共用）


| 文件 | 环境 | 版本库 |
| --- | --- | --- |
| `.env.development` | 开发 | 不提交（复制 `.env.development.example`） |
| `.env.test` | 测试 | 不提交（复制 `.env.test.example`） |
| `.env.production` | 正式 | 不提交（复制 `.env.production.example`） |
| `.env.*.example` | 模板 | 已入库（无真实密钥） |

本地首次配置：

```bash
cp .env.development.example .env.development
cp .env.test.example .env.test
cp .env.production.example .env.production
# 编辑上述文件，填入云环境 ID 与 CAM 密钥
```

**GitHub Actions 打包**从仓库 Secrets 生成 `.env.test` / `.env.production`（见下方 Secrets 列表），勿再把密钥提交进 Git。

每个文件需包含：


| 变量                      | 说明                       |
| ----------------------- | ------------------------ |
| `TARO_APP_CLOUD_ENV_ID` | 云环境 ID                   |
| `TARO_APP_ID`           | 小程序 AppID                |
| `CLOUDBASE_SECRET_ID`   | 腾讯云 CAM 密钥（仅管理端 Rust 读取） |
| `CLOUDBASE_SECRET_KEY`  | 同上                       |


多账号时，各环境文件分别填写**该云开发环境所属账号**的密钥。管理端顶部切换环境时会自动加载对应 `.env.*`。

### GitHub Secrets（私有/公开仓库 CI 打包必填）

在仓库 **Settings → Secrets and variables → Actions** 配置：

| Secret | 说明 |
| --- | --- |
| `TARO_APP_ID` | 小程序 AppID |
| `TARO_APP_CLOUD_ENV_ID` | 云环境 ID（测试/正式相同时填这一个即可） |
| `CLOUDBASE_SECRET_ID` | CAM SecretId |
| `CLOUDBASE_SECRET_KEY` | CAM SecretKey |
| `TAURI_SIGNING_PRIVATE_KEY` | 管理端自动更新签名私钥（Ed25519，更新清单走 GitHub Release） |

测试/正式使用**不同**云环境或密钥时，可额外配置 `TARO_APP_CLOUD_ENV_ID_TEST`、`CLOUDBASE_SECRET_ID_TEST` 等（见 `scripts/write-env-from-secrets.mjs`）。

> 若密钥曾提交进 Git 历史，请在 [腾讯云 CAM](https://console.cloud.tencent.com/cam/capi) **轮换禁用**旧密钥后再写入 Secrets。

### 3. 小程序开发

`pnpm dev:weapp` / `test:weapp` / `build:weapp` 会自动按环境同步 `project.config.json`（`project.config.dev.json` / `project.config.test.json` / `project.config.prod.json`）。

```bash
pnpm dev:weapp              # 开发环境（watch）
pnpm test:weapp             # 测试环境（watch）
pnpm build:test:weapp       # 测试环境（单次构建）
pnpm build:weapp            # 正式构建
```

微信开发者工具打开 `dist/`，确认 `project.config.json` 中 `appid` 与当前环境的 `TARO_APP_ID` 一致。

构建加速：已启用 Webpack5 持久化缓存（`cache.enable`）与开发/测试环境的依赖预构建（`prebundle`），二次编译会明显更快。

### 4. 管理端开发

```bash
cd admin && pnpm tauri dev
```

FFmpeg 视频压缩（Windows）见 [admin/README.md](./admin/README.md#ffmpeg-静态链接分类视频压缩)。

## 云数据库初始化

管理端**不会**在启动时自动建库。每个新云环境需在管理端 **设置** 中触发「初始化数据库」，或调用 Tauri 命令 `ensure_database`（仅创建 6 个集合，不导入示例数据）。

集合：`categories`、`projects`、`material_cards`、`material_details`、`media_files`、`home_settings`。

## 云函数部署

### 准备

```bash
pnpm install:cf   # 将 cf-shared 复制进各函数目录（每次改 cf-shared 后、部署前必跑）
```

### 方式 A：CloudBase CLI（推荐批量）

`cloudbaserc.json` 已配置 7 个函数。按环境自动 **logout → 密钥 login → 部署**：

```bash
pnpm deploy:cf:dev      # 读 .env.development
pnpm deploy:cf:test     # 读 .env.test
pnpm deploy:cf:prod     # 读 .env.production

# 仅部署单个函数
node scripts/deploy-cloud-functions.mjs --env test --fn portfolioHome

# 已跑过 install:cf 时可跳过依赖安装
node scripts/deploy-cloud-functions.mjs --env test --skip-install
```

脚本会读取对应 `.env.*` 里的 `CLOUDBASE_SECRET_*` 与 `TARO_APP_CLOUD_ENV_ID`，每次部署前先 `tcb logout` 再登录，避免多账号串环境。

手动方式（等价）：

```bash
tcb logout
tcb login --apiKeyId <SecretId> --apiKey <SecretKey>
tcb fn deploy --all --force -e <环境ID>
tcb fn list -e <环境ID>
```

常见报错 `env not found in list`：CLI 登录账号与 `.env.*` 里的环境 ID / 密钥不属于同一腾讯云账号。

### 方式 B：微信开发者工具

对每个 `cloud/functions/<函数名>` 右键 → **上传并部署：云端安装依赖**。

### 云函数列表

`portfolioHome` · `splashConfig` · `contactConfig` · `socialConfig` · `projectDetail` · `materialCardDetail` · `productCatalog`

## 多环境内容同步（管理端）

管理端 **同步中心** 支持开发 / 测试 / 正式之间云端直迁（内置 sidecar，无需本机备份）。

1. 项目根 `.env.*` 配好各环境 `TARO_APP_CLOUD_ENV_ID` 与 `CLOUDBASE_SECRET_*`
2. 各目标环境初始化数据库集合并部署云函数
3. 技术人员首次构建迁移 sidecar：`pnpm migrate:sidecar`
4. 管理端同步中心选择来源与目标 →「开始迁移」

## 提交规范

遵循 Conventional Commits，中文简述，按模块拆分提交。见 [.cursor/rules/git-commit-cn.mdc](./.cursor/rules/git-commit-cn.mdc)。

## 相关文档

- [admin/README.md](./admin/README.md) — 管理端开发细节
- [.cursor/rules/database-schema.mdc](./.cursor/rules/database-schema.mdc) — 云数据库集合结构
- [.cursor/rules/project-conventions.mdc](./.cursor/rules/project-conventions.mdc) — 项目通用规范

