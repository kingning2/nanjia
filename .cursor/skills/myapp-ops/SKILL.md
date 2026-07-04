---
name: myapp-ops
description: 南嘉婚礼项目运维脚本手册——部署微信云函数、发布管理端桌面安装包（打 tag 触发 CI）、构建小程序、同步小程序配置、环境诊断。Use when 发布/部署/deploy、发版/打 tag/release、部署云函数、构建小程序 weapp、sync 项目配置、check-test-cf。
---

# 南嘉婚礼 · 运维脚本手册

所有命令在**仓库根目录**执行。脚本在 `scripts/*.mjs`，密钥读各环境 `.env.*`。

## 发布云函数

按环境登录 tcb 并部署 `cloud/functions/` 下全部云函数：

```bash
pnpm deploy:cf:dev     # development
pnpm deploy:cf:test    # test
pnpm deploy:cf:prod    # production
```

只部署单个函数（如改了 `portfolioHome`）：

```bash
node scripts/deploy-cloud-functions.mjs --env test --fn portfolioHome
```

首次或依赖变更后先装依赖：`pnpm install:cf`。
云函数列表：`portfolioHome` · `splashConfig` · `contactConfig` · `socialConfig` · `projectDetail` · `materialCardDetail` · `productCatalog`。

## 发布桌面安装包（打 tag）

`scripts/release.mjs` 一键：升版本号（`tauri.conf.json` + `Cargo.toml` + `Cargo.lock` 三处同步）→ 提交 → 推送 `github` 与 `origin`(Gitee) → 打 `vX.Y.Z` tag → 推 tag。推 tag 后触发三条 GitHub Actions（macOS ARM / macOS Intel / Windows x64）各自出包，互不影响。

```bash
pnpm release            # patch：0.1.2 → 0.1.3
pnpm release minor      # 0.1.2 → 0.2.0
pnpm release major      # 0.1.2 → 1.0.0
pnpm release 0.3.0      # 指定版本
pnpm release 0.3.0 --no-push   # 只本地提交+打 tag，不推送
```

要求：工作树必须干净（脚本会校验）；三处版本号须一致，否则脚本报错请先手动对齐。
校验脚本自身逻辑：`node scripts/release.mjs --self-check`。

## 构建小程序

```bash
pnpm dev:weapp          # 开发（watch，development）
pnpm build:test:weapp   # test 产物
pnpm build:weapp        # production 产物（build 前自动 sync 对应环境 project.config）
```

## 环境诊断

```bash
node scripts/check-test-cf.mjs   # 校验 test 环境：账号、网关、7 个云函数是否齐全可调用
```

## 同步小程序配置

`dev:weapp` / `build:*:weapp` 已自动执行；手动切环境：

```bash
node scripts/sync-project-config.mjs test   # development | test | production
```
