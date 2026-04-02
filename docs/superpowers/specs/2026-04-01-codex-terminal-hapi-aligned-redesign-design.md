# Codex 终端 Hapi 对齐重构设计

## 1. 背景

当前 `apps/web` 里的 Codex 终端链路已经暴露出三个结构性问题：

1. 页面层同时承担项目加载、会话创建、输出流读取、xterm 渲染和输入发送，职责过重。
2. 终端输出一度走 `SSE`，随后又回落到 polling，连接协议和页面状态绑定过深，排障成本高。
3. 终端渲染问题经常需要同时检查 PTY、流控制器、xterm 容器和输入桥接，边界不清晰。

用户已明确要求参考 `hapi` 的终端实现思路重构“整个终端启动、渲染流程”，但本轮范围固定在终端子系统，不扩展到整站会话模型。

## 2. 参考结论

本设计参考以下 `hapi` 公开实现：

- `web/src/routes/sessions/terminal.tsx`
- `web/src/hooks/useTerminalSocket.ts`
- `web/src/components/Terminal/TerminalView.tsx`

对应仓库：

- https://github.com/tiann/hapi

本轮不照搬 `hapi` 的 `Socket.IO` 终端协议，但吸收它的两个核心原则：

1. 页面编排与终端连接状态机必须分离。
2. xterm 宿主组件只负责 mount、resize、write、focus，不负责 session 生命周期。

## 3. 目标

本次设计固定以下目标：

1. 终端输出固定改为单独 polling 请求，不再让终端输出走 `SSE`。
2. 页面层、连接层、渲染层、输入层四层解耦。
3. 会话启动、恢复、关闭、重启流程统一收口，不再散落在 view 和 stream controller 中。
4. `cursor`、轮询节奏、missing session、closed/failed 状态统一由终端连接层维护。
5. 终端输入继续支持 xterm 键盘输入和显式输入框，两者都走同一写入通道。

## 4. 非目标

本次明确不做以下事情：

1. 不把后端改造成 `Socket.IO` 或 websocket 终端服务。
2. 不重构整站 session 页面、消息流或全局事件模型。
3. 不引入静默 fallback，例如 polling 失败后偷偷切回 `SSE`。
4. 不修改现有后端接口路径和响应字段。

## 5. 总体方案

终端子系统拆成四层。

### 5.1 页面层

`CodexTerminalPageModel` 负责页面编排，只做：

- 当前项目读取
- 项目上下文生成
- terminal session 创建、恢复、关闭、重启
- 侧栏概览加载
- 把 `sessionId`、`workingDirectory`、`status` 提供给终端子组件

页面层不再直接管理 polling、cursor 或 chunk 消费。

### 5.2 连接层

`TerminalConnection` 负责终端连接状态机，只做：

- `start(sessionId, cursor)`
- 串行 polling `/api/codex/terminal/sessions/{id}/stream`
- 推进 `cursor`
- 输出增量分发
- 输入写入
- stop / restart / missing-session 清理

连接层是终端行为的唯一真相源。

### 5.3 渲染层

`TerminalViewport` 负责 xterm mount，只做：

- mount / destroy
- appendOutput
- clear
- focus
- fit / resize 观测
- 键盘输入桥接

渲染层不感知 session create / restore / close。

### 5.4 输入层

`TerminalComposer` 负责显式输入框和发送按钮，只做：

- 文本输入
- Enter 发送
- 发送后清空
- 发送后焦点回终端

后续若要追加快捷键面板，只允许落在这一层。

## 6. 状态机

连接层固定维护以下状态：

- `idle`
- `booting`
- `streaming`
- `closed`
- `failed`

只允许以下流转：

- `idle -> booting -> streaming`
- `streaming -> closed`
- `booting -> failed`
- `streaming -> failed`
- `failed -> booting`
- `closed -> booting`
- `any -> idle`

其中：

- `booting` 表示 session 已经存在，但首轮输出尚未稳定进入增量消费。
- `streaming` 表示终端输出正在被单独 polling 请求持续拉取。
- `closed` 表示后端会话结束且 backlog 已消费完。
- `failed` 表示读流失败、输入失败或 session 校验失败。

## 7. 启动与恢复流程

### 7.1 首次启动

1. 页面挂载后读取当前项目。
2. 若无当前项目，页面只显示错误，不启动终端。
3. 若有当前项目，生成项目上下文。
4. 页面创建新的 terminal session。
5. 页面把 `sessionId + cursor=0` 交给 `TerminalConnection.start(...)`。
6. 连接层进入 `booting`，随后通过 polling 拉取增量输出。

### 7.2 恢复会话

1. 页面读取本地 `project_path + session_id + next_cursor`。
2. 调用 `getCodexTerminalSession(sessionId)` 验证会话是否存在。
3. 若 session 仍是 `running`，则交给连接层继续从保存的 `cursor` 开始拉流。
4. 若 session 为 `closed` 或 `failed`，清掉本地记录，不做半恢复。
5. 若后端返回 `codex.session_not_found`，连接层统一抛出 `sessionLost`，页面只负责清 storage、重置终端、提示用户重新创建。

## 8. 文件拆分

建议按以下文件落点实施：

- `apps/web/src/views/use-codex-terminal-workbench.ts`
  - 收缩为页面编排层
- `apps/web/src/components/terminal/use-terminal-connection.ts`
  - 新增，承载 polling、cursor、写入、停止和状态机
- `apps/web/src/components/terminal/terminal-connection-state.ts`
  - 新增，放状态类型与迁移判断
- `apps/web/src/components/TerminalSessionPanel.vue`
  - 退化为容器组件
- `apps/web/src/components/terminal/TerminalViewport.vue`
  - 新增，挂 xterm
- `apps/web/src/components/terminal/TerminalComposer.vue`
  - 新增，显式输入框
- `apps/web/src/components/terminal/xterm-adapter.ts`
  - 保留，但只保留 xterm 能力

以下旧职责需要拆出或删除：

- `resolvePreferredTransport`
- 终端输出走 `SSE` 的逻辑分支
- 页面层直接感知 transport 类型

## 9. 接口边界

本轮保留现有后端接口：

- `POST /api/codex/terminal/sessions`
- `GET /api/codex/terminal/sessions/{session_id}`
- `GET /api/codex/terminal/sessions/{session_id}/stream`
- `POST /api/codex/terminal/sessions/{session_id}/input`
- `DELETE /api/codex/terminal/sessions/{session_id}`

前端固定只使用 `/stream` 做终端输出读取。

`/events` 作为遗留接口保留在后端，本轮前端不再依赖它。

## 10. 测试方案

测试按三层拆开：

### 10.1 页面编排测试

保留并收缩 `codex-terminal-view.spec.ts`，只测：

- 项目加载
- session create / restore / restart
- missing session 时页面重置
- sidebar 加载不影响终端主链路

### 10.2 连接状态机测试

新增 `use-terminal-connection.spec.ts`，覆盖：

- polling 串行推进 `cursor`
- stop 后不再继续发起下一轮读取
- `codex.session_not_found` 会清 storage 并触发 `sessionLost`
- closed backlog 读完后进入 `closed`
- write 失败进入 `failed`

### 10.3 终端视图测试

保留并调整现有 `terminal-session-panel.spec.ts` / 新增 viewport 测试，覆盖：

- xterm mount 与 appendOutput
- clear / focus
- 输入框 Enter 发送
- session 切换时 reset

## 11. 实施切分

采用两阶段迁移。

### 第一阶段

1. 引入 `TerminalConnection`
2. 拆出 `TerminalViewport`
3. 拆出 `TerminalComposer`
4. 保持页面 API 入口和后端接口不变

目标是先把职责边界立住，并让终端稳定回到 polling 输出链路。

### 第二阶段

1. 删除旧的 `codex-terminal-stream-runtime`
2. 删除 `resolvePreferredTransport`
3. 删除前端所有终端 `SSE` 分支
4. 清理重复测试和过时 helper

目标是清空旧模型残留，避免未来继续双轨维护。

## 12. 风险与控制

主要风险：

1. 页面和连接层切分后，session restore 时机可能回归。
2. xterm mount 与 resize 重构后，首屏尺寸和焦点行为可能回归。
3. 第一阶段新旧结构并存时，测试会短暂重叠。

控制方式：

1. 先补连接状态机测试，再改实现。
2. 页面层只保留 session 编排，禁止继续长出 transport 细节。
3. 每阶段结束都跑前端测试和一次真实 API smoke。

## 13. 预期结果

完成后，本仓终端链路会从“页面驱动 transport + panel 混合承担渲染和输入”收敛成：

- 页面编排层
- 独立连接状态机
- 纯 xterm 视图层
- 纯输入层

这与 `hapi` 的终端子系统边界保持同方向演进，但仍保留本仓当前 Python API 和 Vue 页面结构，不额外扩大到整站重构。
