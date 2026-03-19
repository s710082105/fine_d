# Codex Runtime Hardening Design

## Goal

收敛 FineReport 嵌入式 Codex 运行时的四个问题：

1. `ai.base_url` 改为程序内写死，不再允许页面或项目配置覆盖。
2. 终端卡片不再整块盖住右侧页面背景。
3. 终端颜色参考 `cc-pane`，补齐前端 xterm ANSI 主题和后端颜色环境。
4. Codex 启动链路兼容 Windows。

## Design

### 1. 固化 Base URL

`ProjectConfig.ai` 仅保留 `provider/model/api_key`，删除 `base_url` 的前后端字段、默认值、校验、表单输入和 roundtrip 断言。Codex 启动参数统一由程序内部常量注入 `http://cpa.hsy.930320.xyz`。

历史 `project-config.json` 中若仍存在 `ai.base_url`，加载时忽略，不回写该字段。

### 2. 终端视觉分层

保留右侧容器的背景渐变作为页面底层。终端外层卡片使用半透明浅色玻璃层，终端视口内部继续维持深色终端底和边框。这样背景图仍能透出，但 xterm 区域的可读性不受影响。

### 3. 终端颜色策略

参考 `cc-pane`：

- 前端 xterm 配置完整 16 色 ANSI 主题，而非仅配置前景、背景和光标。
- 后端继续注入 `TERM=xterm-256color`、`COLORTERM=truecolor`、`FORCE_COLOR=1`。
- Windows 侧补 `windowsPty` 配置，让 xterm 与 ConPTY 的行为对齐。

### 4. Windows 兼容

`codex_auth` 改成跨平台目录镜像逻辑，不再依赖 Unix-only `symlink` 和仅 `HOME` 查找。共享 Codex 目录路径改为：

- 优先 `CODEX_HOME`
- 再尝试 `HOME/.codex`
- Windows 回退 `USERPROFILE/.codex`

镜像策略改为跨平台复制所需共享条目，确保 Windows 不因软链权限失败而无法启动。

## Verification

- Vitest：配置表单、终端请求、终端面板样式相关测试
- Cargo test：配置 roundtrip、Codex 启动参数、终端环境、认证目录复制逻辑
- Build：`pnpm build`
