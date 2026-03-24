# 设计器远程数据与跨平台同步设计

## 背景

当前实现仍然把 `project-config.json.data_connections` 作为数据库主入口，并依赖 `./.codex/project-sync.sh` 与 shell 型 `post-commit` hook 处理同步。这与现状冲突：

- 真实连接信息已经存在于 FineReport 设计器远端配置中，不需要再在项目里重复维护。
- `fr-db` skill 运行在嵌入式 agent 环境中，不能直接调用前端 `invoke`。
- Windows 环境不能假设存在 `bash`/`sh.exe`，shell helper 与 `post-commit` 不能作为唯一主链路。

## 目标

1. 废弃 `data_connections`，项目配置只保留设计器远程连接所需的预览与设计器目录信息。
2. 新增基于 FineReport Decision HTTP 接口的远程数据能力，支持读取连接、列出现有数据集、预览现有数据集、试跑临时 SQL 数据集。
3. 为嵌入式 agent 生成平台感知 helper，使 `fr-db` skill 能直接从项目目录执行远程数据探测命令。
4. 同步 helper 改为平台感知，所有手工触发命令都返回机器可读 JSON；Git hook 只在可运行 shell 的环境启用，不再作为跨平台必经链路。

## 方案

### 1. 项目配置收敛

- 删除 Rust/TS 中的 `data_connections` 与 `DataConnectionProfile`。
- 继续复用 `preview.url/account/password` 作为 Decision 登录信息。
- `sync.designer_root` 继续承担本地设计器目录能力，用于文件桥接和 Java 运行环境定位。
- `project-context.md` / `project-rules.md` / `mappings.json` 不再注入本地数据库连接配置，改成强调“数据连接以设计器远端返回为准”。

### 2. 设计器远程数据客户端

新增 Rust 侧 FineReport Decision HTTP 客户端，覆盖：

- `POST /login`
- `GET /v10/config/connection/list/0`
- `GET /v10/dataset`
- `POST /v10/dataset/preview/exist`
- `POST /v10/dataset/preview`

返回模型统一使用 `camelCase`/JSON，可同时服务于：

- 前端配置页只读展示远端连接列表
- CLI 模式
- 未来更多基于设计器远程数据的宿主能力

### 3. 平台感知 helper

项目初始化阶段生成：

- Unix: `./.codex/project-sync.sh`、`./.codex/fr-data.sh`
- Windows: `./.codex/project-sync.cmd`、`./.codex/fr-data.cmd`

两个 helper 都只做参数转发，不做 silent fallback。命令返回标准 JSON，供 agent/skill 和宿主 UI 直接消费。

`fr-data` 支持：

- `list-connections`
- `list-datasets`
- `preview-dataset <dataset>`
- `preview-sql <connection> <sql>`

### 4. Git 同步链路

- 手工 `prepare-create` / `prepare-edit` 继续保留，并保证 JSON stdout。
- Windows 不再强依赖 `post-commit` hook。
- `post-commit` hook 仅在 Unix 且存在可用 shell 环境时安装。
- session 状态文案由“git post-commit sync enabled”改为描述真实模式：hook 或 watcher。

### 5. 前端与 skill

- “数据连接”页签改为只读远端连接列表，提供刷新，不再支持新增/编辑/删除/测试本地连接。
- `fr-db` skill 改为：
  - 先读取设计器远端连接
  - 再列数据集或试跑 SQL 做字段扫描
  - 参考其他报表只做样式/命名参考，字段和 SQL 以远端返回结果为准
  - 先判断系统类型，再使用 `.sh` 或 `.cmd`

## 影响范围

- Rust: `project_config`、`project_config` commands、context builder、project initializer、project git、CLI 入口
- TS: 项目配置类型、state、services、配置页签与测试
- Embedded: `fr-db`、`fr-create`、`fr-cpt`、`fr-fvs`、AGENTS、模板

## 风险与约束

- Decision HTTP 数据接口依赖设计器服务端版本；接口失败时必须透出原始错误。
- 临时 SQL 预览请求体需要与 FineReport 接口格式严格对齐，先以实测 v10 接口为准。
- Git hook 的跨平台能力受 Git 运行环境限制，不能继续承诺“所有环境提交后自动同步”。
