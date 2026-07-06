# 小程序云函数部署说明

## 目录结构

```
cloud/
├── cf-shared/          # 共享模块（不是云函数，不会出现在函数列表）
└── functions/
    ├── portfolioHome/
    ├── projectDetail/
    └── materialCardDetail/
```

**不要**把 `cf-shared` 或旧的 `common` 当成云函数上传。微信开发者工具只会识别 `cloud/functions/` 下**有 `index.js` 的子目录**为云函数。

## 首次 / 依赖变更后：安装 node_modules

在项目根目录执行：

```bash
pnpm install:cf
```

`install:cf` 会把 `cf-shared` 复制到各函数目录下的 `cf-shared/`（`package.json` 使用 `file:./cf-shared`），**云端安装依赖**时才能解析到共享模块。各函数同时直接声明 `wx-server-sdk`（`cf-shared` 的运行时依赖，云端对 `file:` 包的传递依赖安装不可靠）。复制产物已加入 `.gitignore`，不要手动改各函数里的 `cf-shared/`。

或在每个函数目录分别执行 `npm install`（开发者工具上传时选「云端安装依赖」也会装，但**本地调试必须先本地安装**）。

## 正确上传方式

### 推荐：项目根目录一键部署（多账号 / 多环境）

```bash
pnpm deploy:cf:dev      # .env.development
pnpm deploy:cf:test     # .env.test
pnpm deploy:cf:prod     # .env.production
```

脚本会 `pnpm install:cf` → `tcb logout` → 用对应 `.env.*` 密钥 `tcb login` → `tcb fn deploy --all -e <envId>`。

单函数：`node scripts/deploy-cloud-functions.mjs --env test --fn portfolioHome`

### 微信开发者工具（小程序侧）
1. 微信开发者工具打开本项目，确认已开通云开发并选中与当前 `.env.*` 一致的云环境。
2. 在 `cloud/functions` **根目录**右键先**切换/选择云环境**，再对**单个函数**（如 `portfolioHome`）右键：
   - **上传并部署：云端安装依赖**（推荐）
3. 对其余函数重复上一步。

**不要**只对 `cloud/functions` 父文件夹点「同步」—— 容易把无效目录一并处理，且不会替每个函数安装依赖。

## 本地调试

1. 先执行 `pnpm install:cf`
2. 在云函数面板勾选「开启本地调试」
3. 环境变量选与小程序相同的云环境

若报 `Cannot find module 'wx-server-sdk'`，说明该函数目录下未安装依赖，重新执行 `pnpm install:cf`。

## 与管理端的关系

- **管理端（Tauri）**：直连云数据库读写内容，不经过云函数。
- **云函数**：仅给小程序 `wx.cloud.callFunction` 读数据用。
- 同步云函数**不会**在管理端出现数据；管理端需在 L1 分类页看到内容，请在管理端初始化数据库集合后自行录入，或从其他环境迁移。
