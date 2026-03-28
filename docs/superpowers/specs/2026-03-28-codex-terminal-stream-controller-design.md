# Codex 终端流控制器设计

## 1. 背景与问题

`apps/web` 当前 Codex 终端页已经从轮询补上了 `SSE`，但前端主状态仍然保留 `terminalOutput` 全量字符串，并在每次收到输出块时执行 `terminalOutput += chunk.output`。这会带来三个持续放大的问题：

1. 终端长时间运行后，页面响应式状态无限增长，字符串拼接和依赖更新成本持续上升。
2. 页面组件承担了会话生命周期、传输协议、游标推进和终端渲染四类职责，边界过重，后续继续演进困难。
3. 现有 `SSE` 与轮询虽然都使用相同后端接口，但前端没有统一的“终端输出控制器”抽象，恢复、停止、重启、切项目都依赖页面内分散判断。

这条链路虽然已经不是“整页刷新”，但仍没有真正解决“长时间输出累计导致前端越来越难处理”的根因。

## 2. 目标

本次设计固定以下目标：

1. `apps/web` 不再持有终端累计全文字符串。
2. 终端输出改为“增量块直接写入终端组件”。
3. `SSE` 与轮询统一收敛到单一前端控制器，不再由页面直接分支处理。
4. 保留当前后端 `cursor + chunk` 协议，避免本轮扩大到后端模型重写。
5. 继续支持会话恢复、会话关闭、重启会话、目录插入、输入透传。

## 3. 非目标

本次明确不做以下事情：

1. 不把后端重构成真正的 PTY 双向 socket 服务。
2. 不增加服务端终端 scrollback、快照或历史重放协议。
3. 不自动在 `SSE` 失败后静默切回轮询。
4. 不调整 `apps/api` 与 `backend` 对外 API 路径和字段名。

## 4. 总体方案

采用“页面编排层 + 终端流控制器 + 终端面板”三段式方案。

### 4.1 页面编排层

`apps/web/src/views/CodexTerminalView.vue` 与页面内组合函数
`apps/web/src/views/use-codex-terminal-workbench.ts` 共同承担页面编排职责：

1. 启动项目上下文生成。
2. 创建、恢复、关闭 Codex 终端会话。
3. 加载远程目录与连接概览。
4. 把用户输入与侧栏插入动作转发给终端控制器。

页面不再保存 `terminalOutput`，也不再直接处理 `SSE` 消息体或轮询 chunk。

### 4.2 终端流控制器

新增独立控制器模块，负责：

1. 管理当前 `sessionId`、`cursor`、`transport`、`lifecycleId`。
2. 封装 `SSE` 与轮询两种块来源。
3. 把块统一转换为 `onChunk(output)`、`onStatus(status)`、`onError(message)` 事件。
4. 负责停止旧 transport、丢弃过期回调、推进 `cursor`、维护恢复用游标。

控制器是本次重构的核心。它不负责真正渲染终端，只负责“把输出块可靠送到终端面板”。
控制器实例必须归属于当前页面实例，不能提升为模块级共享单例，否则一个页面的
`bumpLifecycle()` 会错误打断另一个页面的 transport。

### 4.3 终端面板

`TerminalSessionPanel.vue` 收敛为纯终端 UI 组件：

1. 只维护 xterm adapter 生命周期。
2. 暴露 `appendOutput(chunk)`、`reset()`、`focusTerminal()`。
3. 通过 `submitInput` 把键盘输入原样上抛。

终端面板不再接收 `output` 全量 prop，也不再做“根据已渲染长度切片”的补偿逻辑。

## 5. 前端状态模型

终端流控制器维护以下最小状态：

```ts
type TerminalTransport = 'idle' | 'sse' | 'polling'

type TerminalStreamState = {
  sessionId: string | null
  cursor: number
  transport: TerminalTransport
  lifecycleId: number
  stopped: boolean
}
```

页面保留以下响应式状态：

1. `session`
2. `errorMessage`
3. 侧栏与项目状态

以下状态不再保留在 Vue 响应式树内：

1. 终端累计输出全文
2. 已渲染字符长度
3. `EventSource` 与轮询定时器的分散引用

## 6. 数据流

### 6.1 首次启动

1. 页面确认当前项目。
2. 页面生成项目上下文。
3. 页面创建终端会话。
4. 页面把 `sessionId` 交给终端流控制器。
5. 控制器选择 `SSE` 或轮询。
6. 每个输出块到达后直接调用终端面板 `appendOutput(chunk.output)`。
7. 控制器推进 `cursor` 并持久化恢复信息。

### 6.2 恢复会话

1. 页面读取本地 `project_path + session_id + next_cursor`。
2. 先调用 `getCodexTerminalSession(session_id)` 验证会话是否仍存在。
3. 若存在，则从保存的 `cursor` 继续接流。
4. 若不存在，则清除本地存储并重新创建会话。

### 6.3 停止与切换

以下操作都必须先让控制器进入新 `lifecycleId`：

1. 手动重启
2. 手动关闭
3. 切项目
4. 页面卸载

旧 transport 收到的任何后续块都必须被丢弃，不允许再写入终端。

## 7. 错误处理

错误处理遵循“显式失败，不做静默降级”：

1. `codex.session_not_found`
   - 立即停止 transport
   - 清空本地恢复信息
   - 清空当前会话状态
2. 普通 `SSE` 或轮询错误
   - 保留当前终端已渲染内容
   - 更新 `errorMessage`
   - 停止当前 transport
3. 不自动把 `SSE` 失败切到轮询
   - 这会引入用户不可见的协议切换
   - 若后续需要保底机制，应作为显式策略单独设计

## 8. 后端边界

本轮后端只做边界对齐，不改协议语义。

保留现有接口：

1. `GET /api/codex/terminal/sessions/{session_id}`
2. `GET /api/codex/terminal/sessions/{session_id}/stream`
3. `GET /api/codex/terminal/sessions/{session_id}/events`
4. `POST /api/codex/terminal/sessions/{session_id}/input`
5. `DELETE /api/codex/terminal/sessions/{session_id}`

后端继续返回：

- `output`
- `next_cursor`
- `completed`
- `status`

本轮只要求前端不再把这些块重新累计为单个大字符串。

## 9. 测试方案

实现前先补前端测试，覆盖以下行为：

1. 首次创建会话后，输出块通过终端面板增量写入。
2. 刷新恢复会话时，从保存的 `cursor` 继续接流。
3. 生命周期切换后，旧 `SSE` 或旧轮询块不会继续写入终端。
4. `codex.session_not_found` 会清理本地 session 并重置页面状态。
5. 终端输入仍然原样透传给后端。
6. 侧栏插入文本后，终端焦点与输入能力保持正常。

同时补组件级测试：

1. `TerminalSessionPanel` 支持 `appendOutput()` 增量写入。
2. 会话切换时 `reset()` 会清空旧输出。
3. 不再依赖 `output` prop 触发写入。

## 10. 实施顺序

建议按以下顺序实施：

1. 先补 `CodexTerminalView` 与 `TerminalSessionPanel` 的测试，锁定新行为。
2. 新增终端流控制器并接管 `SSE` / 轮询。
3. 删除页面内 `terminalOutput` 累计状态和相关分支。
4. 重构 `TerminalSessionPanel` 为命令式增量写入接口。
5. 跑前端测试并做一次手动长输出验证。

## 11. 预期结果

完成后，当前主链路会从“可流式，但仍累计全文”收敛为“统一终端流控制器 + 终端组件增量消费”。

这不能等同于 `hapi` 那种独立 PTY socket 架构，但会先把当前最关键的性能和职责边界问题解决掉，并为后续继续演进到更纯粹的终端流协议保留接口位置。
