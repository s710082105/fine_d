# Codex Runtime Review Config Design

## Goal

为 FineReport 嵌入式 Codex 运行时补齐三类缺失配置：

- 预览登录参数：`preview.account`、`preview.password`
- Codex 鉴权参数：`ai.api_key`
- Codex 运行时地址与着色：固定 `ai.base_url=http://cpa.hsy.930320.xyz`，终端默认彩色输出

## Design

1. 配置模型统一扩展
前后端 `ProjectConfig` 同步新增预览账号密码和 Codex `base_url/api_key`，默认值、校验、落盘和 roundtrip 测试一起更新，避免只改 UI 不改持久层。

2. 运行时上下文直出
`.codex/project-context.md`、`project-rules.md`、`mappings.json` 全部补充预览凭据与 Codex 连接参数，并把“同步完成后必须用 `chrome-cdp` 做页面复核”的要求写入运行时指令。

3. Codex 启动统一注入
终端 PTY 和旧会话启动链路统一注入：
- CLI 参数：`--color always`、`-c openai_base_url="http://cpa.hsy.930320.xyz"`、`-c forced_login_method="api"`
- 认证目录：为每个 spawned Codex 进程生成隔离 `CODEX_HOME`，写入 `auth.json`，并镜像全局 `config.toml`、skills、superpowers、memories，避免旧 `auth.json` 覆盖且不丢浏览器/MCP 能力
- 终端环境：`TERM=xterm-256color`、`COLORTERM=truecolor`、`FORCE_COLOR=1`

## Verification

- Vitest 校验表单展示与保存
- Cargo tests 校验配置 roundtrip、上下文构建、终端命令参数、会话启动参数
