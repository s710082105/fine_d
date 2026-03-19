# 后端模块与迁移计划

## 新增模块

### `src-tauri/src/domain/terminal_manager.rs`

- 基于 PTY 创建终端 session
- 保存 session id、pid、writer、size
- 管理关闭和清理

### `src-tauri/src/domain/terminal_event_bridge.rs`

- 把终端输出转成前端事件
- 推送状态、错误、退出码

### `src-tauri/src/commands/terminal.rs`

- `create_terminal_session`
- `write_terminal_input`
- `resize_terminal`
- `close_terminal_session`

## 需要替换的现有前端区域

- 用 `TerminalPanel` 替换当前 `ChatPanel`
- 删除右侧消息发送和恢复会话逻辑
- 保留左侧配置相关服务和同步相关服务

## 需要保留的现有后端能力

- 项目目录与配置读取能力
- 配置保存时的上下文补全能力
- 文件监听与本地/FTP/SFTP 同步能力

## 迁移顺序

1. 接入 `xterm.js`，先做静态终端面板。
2. 引入 PTY 管理器，打通本地 `codex` 启动。
3. 完成输入、输出、resize、关闭链路。
4. 用新面板替换现有右侧聊天面板。
5. 删除不再使用的聊天会话命令和前端状态。
6. 做回归验证。

## 验证范围

- 可在已保存项目目录下启动 Codex。
- 终端可正常输入并看到输出。
- 调整窗口大小后终端尺寸同步。
- 切项目时旧终端被关闭。
- 配置保存后右侧提示需要重启终端。
- `reportlets` 文件改动后自动同步不受影响。
