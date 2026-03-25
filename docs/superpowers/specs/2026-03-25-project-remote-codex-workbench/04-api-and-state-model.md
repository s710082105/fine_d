# 04. API 与状态模型

## 状态模型

### `current_project`

字段：

- `path`
- `name`

说明：

- 表示当前选中的本机项目目录。
- `name` 可由目录名派生，不要求单独维护显示名。

### `remote_profile`

字段：

- `base_url`
- `username`
- `password`

说明：

- 按项目目录维度保存。
- 一个项目目录首版只允许一套当前启用的远程参数。

### `remote_overview`

字段：

- `directory_entries`
- `data_connections`
- `last_loaded_at`

说明：

- 这是一个页面聚合态，不要求单独持久化。
- 由远程概览接口统一返回。

### `codex_terminal_session`

字段：

- `session_id`
- `status`
- `working_directory`

说明：

- 每次进入 `Codex` 页面新建一条。
- 首版不做多会话管理列表。

## API 设计

### `POST /api/project/select`

输入：

- `path`

输出：

- `current_project`
- `remote_profile`

用途：

- 切换当前项目目录，并带回已保存远程参数。

### `GET /api/project/current`

输出：

- `current_project`
- `remote_profile`

用途：

- 页面初始化。

### `PUT /api/project/remote-profile`

输入：

- `base_url`
- `username`
- `password`

输出：

- `remote_profile`

用途：

- 保存当前项目对应的远程参数。

### `POST /api/project/remote-profile/test`

输入：

- `base_url`
- `username`
- `password`

输出：

- `status`
- `message`

用途：

- 显式测试连接。

### `GET /api/remote/overview`

输出：

- `directory_entries`
- `data_connections`
- `last_loaded_at`

用途：

- 一次请求刷新两个面板。

## Codex 终端接口

### `POST /api/codex/terminal/sessions`

输入：

- `working_directory`

输出：

- `session_id`
- `status`

### `GET /api/codex/terminal/sessions/{session_id}`

输出：

- `session_id`
- `status`
- `working_directory`

### `GET /api/codex/terminal/sessions/{session_id}/stream`

输出：

- 终端输出流

### `POST /api/codex/terminal/sessions/{session_id}/input`

输入：

- `data`

输出：

- `accepted`

### `DELETE /api/codex/terminal/sessions/{session_id}`

输出：

- `status`

## 校验规则

- `path` 必须是存在的本机目录。
- `base_url` 必须是合法 `http/https` 地址。
- `username` 与 `password` 不允许空字符串保存。
- 若当前项目目录为空，则所有远程接口和 Codex 终端创建接口都必须显式失败。

## 实现约束

- 前端页面文案全部中文。
- 远程概览不得拆成多个隐式并发链路后再前端拼结果。
- Codex 页面不得实现自定义聊天协议。
- 错误必须直接暴露到页面，不能因为页面整洁而吞错。
