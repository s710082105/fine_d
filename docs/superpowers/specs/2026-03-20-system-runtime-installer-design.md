# System Runtime Installer Design

## Goal

将产品策略从“软件内置 `node/python/codex`”切换为“软件只做环境检测与阻断，实际安装由用户手动执行平台安装脚本”。

目标平台：

- `macOS`
- `Windows`

目标组件：

- `git`
- `node`
- `python3`
- `codex`

## Replacement Scope

本设计替代同日的 bundled runtime 方向，后续不再把 `src-tauri/resources/runtime` 作为正式运行时依赖。

软件主链路切换为：

1. 启动时检查系统环境是否完整。
2. 若缺失，则阻断进入主界面。
3. 阻断页只展示缺失项、推荐脚本和执行说明。
4. 用户手动在系统终端执行安装脚本。
5. 安装完成后回到软件重新检查。

## Non-Goals

- 不在软件内直接执行安装脚本。
- 不在软件内做提权。
- 不内置离线安装包。
- 不维护第三方 exe 下载直链集合。
- 不同时维持 bundled runtime 与系统安装两套主流程。

## Product Behavior

### Startup Gate

启动门禁不再检查 bundled runtime 目录，而是检查系统命令：

- `git`
- `node`
- `python3`
- `codex`

同时继续检查同步链路依赖：

- `macOS/Linux` 的 `/bin/sh`
- `Windows` 的 `Git Bash/sh.exe`

只要有任一阻断项失败，就不进入主界面。

### Blocked View

阻断页展示以下信息：

- 缺失组件及已检测版本
- 平台同步依赖是否满足
- 当前平台推荐执行的安装脚本
- “官方源 / 国内源”由脚本启动后交互选择
- “请手动执行脚本，执行完成后返回软件重新检查”

软件本身不负责拉起安装器，不做 silent fallback。

## Installer Scripts

仓库内固定提供两套安装脚本：

- `scripts/install-runtime-macos.sh`
- `scripts/install-runtime-windows.cmd`
- `scripts/install-runtime-windows.ps1`

Windows 默认向用户暴露 `.cmd` 入口，由它负责以 `PowerShell -ExecutionPolicy Bypass -File` 拉起 `.ps1`，避免用户直接执行 `.ps1` 时被系统执行策略拦截。

### Shared Flow

两套脚本遵循相同流程：

1. 打印待安装组件列表。
2. 交互选择下载源：
   - `1. 官方源`
   - `2. 国内源`
3. 安装 `git`、`node`、`python3`、`codex`。
4. 安装完成后逐项执行版本验证。
5. 输出成功项、失败项和下一步排查信息。

### macOS Strategy

- 优先使用 `Homebrew`
- 如果未安装 `brew`，脚本先安装 `Homebrew`
- 然后执行：
  - `brew install git`
  - `brew install node`
  - `brew install python`
  - `npm install -g @openai/codex`
- 国内源模式：
  - `brew` 使用国内镜像环境变量
  - `npm registry` 切换到国内源
- 官方源模式：
  - 使用默认 `brew`
  - 使用默认 `npm registry`

### Windows Strategy

- 优先使用 `winget`
- 如果未检测到 `winget`，脚本直接失败并提示升级系统组件
- 然后执行：
  - `winget install Git.Git`
  - `winget install OpenJS.NodeJS.LTS`
  - `winget install Python.Python.3.12`
  - `npm install -g @openai/codex`
- 国内源模式：
  - 先执行 `winget source remove winget`
  - 再执行 `winget source add winget https://mirrors.ustc.edu.cn/winget-source --trust-level trusted`
  - `npm registry` 切换到国内源
  - 该流程需要管理员权限，脚本必须显式提示
- 官方源模式：
  - 先执行 `winget source reset winget`
  - `npm` 使用默认 registry

## Architecture Changes

### Rust

`check_runtime_prerequisites` 调整为检查系统环境，不再依赖 `src-tauri/resources/runtime`。

每个检查项返回：

- `key`
- `label`
- `status`
- `blocking`
- `message`
- `fix_hint`
- `detected_version`
- `script_path`

如果当前平台支持安装脚本，则阻断页可以直接展示对应脚本路径。

### Frontend

启动阻断页文案从“内置运行时缺失”改为“基础环境未安装完成”。

阻断页新增：

- 平台脚本路径展示
- 手动执行说明
- 官方源 / 国内源说明

终端启动重新依赖系统 `codex`，不再通过 bundled `node + cli.js` 拉起。

### Repository Cleanup

以下内容从主流程退出：

- `scripts/prepare-bundled-runtime.mjs`
- `runtime:prepare`
- `runtime:clean`
- `src-tauri/resources/runtime` 的正式运行时角色
- 预检中的 bundled runtime 校验
- 终端中的 bundled runtime 启动逻辑

## Validation

### Rust

- 缺少 `git/node/python3/codex` 时返回阻断
- 已安装时返回版本信息
- `Windows` 缺 `sh.exe` 时仍阻断
- 平台推荐脚本路径正确

### Frontend

- 阻断页显示环境缺失信息
- 阻断页显示当前平台安装脚本
- 不再显示 bundled runtime 缺失文案

### Manual

- `macOS` 脚本可在本机手动执行并完成安装/验证
- `Windows` 脚本语义、命令和提示与 `winget` 兼容

## Risks

- `macOS` 国内源镜像可用性可能波动，因此脚本必须显式输出当前采用的源配置。
- `Windows` 若系统未提供 `winget`，脚本只能失败并明确提示，不能 silently downgrade。
- `codex` 的全局安装依赖 `node/npm`，所以脚本必须严格保证安装顺序。
