# Infinitoai Playwright 测试体系设计

## 目标

为 `Infinitoai` 补齐两层 Playwright 测试能力：

1. 本地稳定回归层：验证扩展可以被真实浏览器加载、核心 Side Panel UI 可用、关键稳定区域支持截图回归。
2. 真实链路层：在提供真实环境变量时，运行真实 OpenAI / 邮箱 / OAuth 场景的端到端测试，并保留可回放证据。

该设计优先保证“日常可稳定跑”的本地回归，再在同一套基座上扩展真实场景测试，避免把外部依赖波动带入每次本地回归。

## 现状

- 仓库当前没有 `package.json`、`playwright.config.*`、浏览器下载脚本或 e2e 命令入口。
- 仓库已有大量 `node:test` 单测，可作为 Playwright 落地后的补充验证层。
- 仓库已存在一个孤立调试脚本 `tools/playwright-tmailor-debug.js`，说明项目已经接受 Playwright 方向。
- `.gitignore` 已包含 `playwright-debug-artifacts/`，适合继续沿用 Playwright 调试产物目录。

## 设计原则

- 本地回归必须稳定、快速、默认可运行。
- 真实链路必须显式启用，不影响日常回归。
- 视觉回归只覆盖稳定区域，不覆盖日志区、动态计时、会频繁抖动的状态区域。
- 扩展级测试必须通过真实浏览器加载 unpacked extension，而不是只在 jsdom 中模拟。
- 失败时优先保留 `trace`、`video`、`screenshot`，保证可回放与定位。

## 总体方案

### 1. Playwright 基座

新增 Node + Playwright 基础设施，统一由 `npm` 管理：

- `package.json`
- `package-lock.json`
- `playwright.config.js`

Playwright 使用 Chromium persistent context 启动扩展，统一通过 `--disable-extensions-except` 和 `--load-extension` 加载仓库目录作为 unpacked extension。

### 2. 两个 Project 分层

在 Playwright 中定义两个项目：

#### `local-extension`

用途：本地稳定 smoke / UI 回归 / 截图回归。

覆盖内容：

- 扩展被浏览器成功加载
- `background.js` 对应 service worker 存活
- 可以拿到 extension id
- 可以打开 `sidepanel/sidepanel.html`
- Side Panel 核心表单和按钮可见
- `Source` / `Mail` 等配置项的显隐联动正常
- 稳定区域截图断言通过

默认策略：

- 本地和 CI 都可运行
- 默认启用 `trace on-first-retry`
- 失败时保留 screenshot

#### `real-flow`

用途：真实 OpenAI / 邮箱 / OAuth 场景验证。

覆盖内容：

- 使用真实环境变量配置 Side Panel
- 启动真实链路关键入口
- 对关键跳转、关键 UI 状态、关键流程里程碑做断言
- 失败时强制保留 `trace`、`video`、`screenshot`

默认策略：

- 未提供必要环境变量时 `skip`
- 不进入默认快速回归
- 通过显式命令或环境变量触发

## 文件结构

### 新增文件

- `package.json`
  - 管理 `@playwright/test`
  - 提供本地回归、真实链路、截图更新等脚本
- `playwright.config.js`
  - 定义 `local-extension` 与 `real-flow`
  - 定义输出目录、截图目录、重试和证据保留策略
- `tests/e2e/fixtures/extension-fixture.js`
  - 启动 persistent Chromium context
  - 加载 unpacked extension
  - 发现 extension id
  - 提供 service worker、Side Panel 页面辅助方法
- `tests/e2e/helpers/env.js`
  - 校验真实链路必需环境变量
  - 根据 provider 组合生成运行配置
- `tests/e2e/helpers/sidepanel.js`
  - 封装 Side Panel 打开、字段填写、显隐断言、稳定化等待
- `tests/e2e/local-extension.spec.js`
  - 本地 smoke、UI 联动、截图回归
- `tests/e2e/real-flow.spec.js`
  - 真实链路端到端测试
- `tests/e2e/.gitignore`
  - 忽略局部运行产物（如有必要）

### 新增目录

- `tests/e2e/fixtures/`
- `tests/e2e/helpers/`
- `tests/e2e/__screenshots__/`

### 文档更新

- `README.md`
  - 新增 Playwright 安装与运行说明
  - 新增真实链路环境变量说明
  - 新增截图基线更新说明

## 本地回归测试矩阵

首批本地回归只覆盖最稳定的扩展行为：

1. `loads unpacked extension and finds service worker`
   - 浏览器成功加载扩展
   - 存在 `background.js` 对应 service worker

2. `renders sidepanel shell with core controls`
   - 打开 `chrome-extension://<id>/sidepanel/sidepanel.html`
   - 断言核心输入区和按钮存在

3. `toggles source-specific UI sections`
   - 切换 `Source`
   - 验证 `33mail`、`TMailor`、`Mail`、`Inbucket` 等区域显隐联动

4. `keeps stable sidepanel form visually unchanged`
   - 仅对稳定表单区域做 `locator.toHaveScreenshot()`
   - 避免包含日志区、统计时间、滚动状态

## 真实链路测试矩阵

首批真实链路只实现一条“推荐主链”，其余 provider 通过环境变量切换，不一次铺满所有组合。

推荐默认真实配置优先级：

1. `Inbucket`
   - 最适合作为受控测试环境
   - 比 QQ / 163 / TMailor 更稳定
2. `TMailor`
   - 可作为真实公开链路候选
   - 但受 Cloudflare / captcha 波动影响更大
3. `QQ / 163`
   - 作为扩展场景保留
   - 不作为首批默认真实 e2e 主链

首批真实 e2e 目标：

- Side Panel 能正确写入真实配置
- 能触发真实链路入口步骤
- 对关键阶段做断言：
  - Step 1 产出 OAuth link
  - Step 2 / 3 进入真实 OpenAI 登录/注册流程
  - 邮箱链路进入预期 provider 页面或状态

说明：

- 首批真实链路不要求在设计阶段一次承诺“100% 自动通关 1-9 全步骤”，而是先实现一条真实可执行、可观察、可回放的主链。
- 如果环境稳定，后续再扩展到全流程 1-9 自动断言。

## 环境变量设计

真实链路使用环境变量门控，避免把敏感配置写死在仓库里。

首批建议变量：

- `PW_REAL_E2E=1`
- `PW_REAL_VPS_URL`
- `PW_REAL_VPS_CPA_PASSWORD`
- `PW_REAL_EMAIL_SOURCE`
- `PW_REAL_MAIL_PROVIDER`
- `PW_REAL_INBUCKET_HOST`
- `PW_REAL_INBUCKET_MAILBOX`
- `PW_REAL_HEADFUL=1`

规则：

- 未开启 `PW_REAL_E2E` 时，`real-flow` 直接跳过
- 缺少 provider 所需变量时，测试在启动前跳过并给出明确原因

## 视觉回归策略

视觉回归只在 `local-extension` 项目启用，避免真实网页波动污染基线。

首批截图策略：

- 优先 `locator.toHaveScreenshot()`
- 只截取 Side Panel 内稳定容器
- 固定 viewport
- 对动态内容设置稳定化预处理：
  - 清空日志区
  - 避免显示计时变化
  - 不截取滚动到底按钮等条件元素

## 调试与产物

Playwright 失败时保留：

- `trace`
- `screenshot`
- `video`（真实链路优先启用）

调试产物目录统一放入：

- `playwright-report/`
- `test-results/`
- `playwright-debug-artifacts/`

## 风险与取舍

### 风险 1：扩展 Side Panel 在自动化中的打开方式

真实浏览器中的 Side Panel 容器不如普通页面稳定，首批本地回归将直接打开 `sidepanel/sidepanel.html` 对应扩展页进行 UI 验证。

取舍：

- 优点：稳定、可截图、易定位
- 缺点：不是浏览器侧边栏容器本身

结论：

首批接受该取舍；真正的侧边栏壳体验可在后续增强。

### 风险 2：真实 OpenAI / 邮箱链路不稳定

真实链路容易受到验证码、风控、邮箱延迟、页面变更影响。

取舍：

- 将其放入独立 `real-flow` project
- 默认不阻塞本地快速回归

### 风险 3：仓库当前无 Node 项目基座

新增 `package.json` 会引入新的项目入口和依赖管理方式。

取舍：

- 采用最小 Node 基座
- 不重构现有 `node --test` 体系
- 保持单测与 Playwright 并存

## 验收标准

满足以下条件即视为该设计落地成功：

- 仓库新增可运行的 Playwright 命令
- `local-extension` 可在本地成功运行
- `local-extension` 至少包含 1 条截图断言
- `real-flow` 在变量齐全时可执行，并在变量缺失时明确跳过
- README 中包含运行方式、环境变量和截图基线说明

## 推荐执行顺序

1. 补 Node/Playwright 基础设施
2. 先写本地扩展 fixture
3. 先落 `local-extension` smoke 与截图回归
4. 再落 `real-flow` 环境变量门控与真实场景用例
5. 最后补 README 与执行命令说明
