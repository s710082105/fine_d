# FineReport 远程能力实现参考

## 目的

本文档归档 2026-04-02 删除实现代码前的最后一版关键链路，供下一轮重构时参考。重点覆盖三件事：

- 如何获取远程目录
- 如何获取数据连接
- 如何上传和下载远程文件

下文中的文件路径均指删除前的实现位置，用于帮助后续检索设计思路，不代表这些文件仍保留在仓库中。

## 总体结构

历史实现分成两条链路：

1. 目录和文件链路
   `FastAPI/CLI -> use case -> FineRemoteClient -> JVM bridge -> FineReport Designer 运行时`
2. 数据连接链路
   `FastAPI -> FineHttpClient -> /login -> /v10/config/connection/list/0`

这两条链路不要混用：

- 远程目录、文件读取、文件写回，走 `fine_remote` 桥接
- 数据连接列表、SQL 预览，走 HTTP API

## 远程目录获取

### 历史实现入口

- 本地 HTTP 路由：`apps/api/routes/remote.py`
- use case：`backend/application/remote/use_cases.py`
- gateway：`backend/adapters/fine/remote_overview_gateway.py`
- Python 客户端：`python/fine_remote/client.py`
- JVM 调用：`python/fine_remote/jvm.py`
- Java 桥接：`java/fine_remote/FrRemoteBridge.java`

### 调用链

1. `GET /api/remote/directories?path=reportlets/...`
2. `ListRemoteDirectoriesUseCase.list_directories(path=...)`
3. `FineRemoteOverviewGateway.list_directories(...)`
4. `FineRemoteClient.list_files(path)`
5. `JvmBridgeRunner.invoke("list", ...)`
6. `FrRemoteBridge.listFiles(...)`
7. FineReport `FileNodes.list(path)` 返回目录项

### 关键约束

- 根目录固定在 `reportlets`
- `path` 不能为空根外路径
- 禁止反斜杠 `\`
- 禁止 `.`、`..`
- 非 `reportlets` 开头的路径直接报 `remote.invalid_path`

### 目录接口示例

```bash
curl 'http://127.0.0.1:8000/api/remote/directories?path=reportlets'
```

预期响应形态：

```json
[
  {
    "name": "sales",
    "path": "/reportlets/sales",
    "isDirectory": true,
    "lock": null
  },
  {
    "name": "demo.cpt",
    "path": "/reportlets/demo.cpt",
    "isDirectory": false,
    "lock": null
  }
]
```

### 底层桥接示例

```bash
python -m fine_remote.cli list \
  --url http://127.0.0.1:8075/webroot/decision \
  --username admin \
  --password admin \
  --fine-home /Applications/FineReport \
  --path reportlets
```

输出形态：

```json
{
  "items": [
    {
      "path": "reportlets/demo.cpt",
      "directory": false,
      "lock": null
    }
  ]
}
```

## 数据连接获取

### 历史实现入口

- HTTP 路由：`apps/api/routes/datasource.py`
- use case：`backend/application/datasource/use_cases.py`
- HTTP 客户端：`backend/adapters/fine/http_client.py`
- 远程概览复用入口：`apps/api/routes/remote.py` + `backend/adapters/fine/remote_overview_gateway.py`

### 调用链

1. `GET /api/datasource/connections`
2. `DatasourceUseCases.list_connections()`
3. `FineHttpClient.list_connections()`
4. `POST /login` 获取 `accessToken`
5. `GET /v10/config/connection/list/0` 读取连接列表

远程概览页也会复用相同能力：

- `GET /api/remote/overview`
- 在取目录样本后，继续调用 `FineHttpClient.list_connections()`

### 字段映射

历史实现兼容以下字段名：

- 连接名：`name` 或 `connectionName`
- 数据库类型：`databaseType`、`type`、`driver`

最终对外统一成：

```json
{
  "name": "FRDemo",
  "database_type": "MYSQL"
}
```

### 接口示例

```bash
curl 'http://127.0.0.1:8000/api/datasource/connections'
```

预期响应形态：

```json
[
  {
    "name": "FRDemo",
    "database_type": "MYSQL"
  }
]
```

### HTTP 细节示例

登录请求：

```http
POST /login
Content-Type: application/json

{
  "username": "admin",
  "password": "admin",
  "validity": -1,
  "sliderToken": "",
  "origin": "",
  "encrypted": false
}
```

连接列表请求：

```http
GET /v10/config/connection/list/0
Authorization: Bearer <accessToken>
Accept: application/json
```

## 文件下载与上传

### 历史实现入口

- HTTP 路由：`apps/api/routes/sync.py`
- use case：`backend/application/sync/use_cases.py`
- gateway：`backend/adapters/fine/sync_gateway.py`
- 低层客户端：`python/fine_remote/client.py`
- 旧 Tauri 同步护栏：`src-tauri/src/domain/remote_sync_guard.rs`

### 支持的动作

- `pull_remote_file`
- `sync_file`
- `sync_directory`
- `verify_remote_state`
- `publish_project`

其中：

- `pull_remote_file`：远端拉本地
- `sync_file`：单文件本地推远端
- `sync_directory`：递归上传本地目录内所有文件
- `verify_remote_state`：逐个对比远端与本地内容
- `publish_project`：先 `sync_directory`，再 `verify_remote_state`

### 下载链路

1. `POST /api/sync/actions`
2. `SyncUseCases.dispatch("pull_remote_file", path)`
3. `FineSyncGateway.pull_remote_file(path)`
4. `_require_remote_file_ready(remote_path, "拉取")`
5. `FineRemoteClient.read_file(remote_path)`
6. `FrRemoteBridge.readFile(...)`
7. FineReport `WorkResource.readFully(path)`
8. 内容写回本地 `reportlets/<path>`

### 上传链路

1. `POST /api/sync/actions`
2. `SyncUseCases.dispatch("sync_file", path)` 或 `sync_directory`
3. `FineSyncGateway.sync_file(path)`
4. 先检查远端存在且未锁定
5. `FineRemoteClient.write_file(remote_path, content)`
6. `FrRemoteBridge.writeFile(...)`
7. FineReport `WorkResource.save(tempPath, path, content)`
8. 再次读取远端文件，比对字节是否与本地一致

### 同步接口示例

拉取远端文件：

```bash
curl -X POST 'http://127.0.0.1:8000/api/sync/actions' \
  -H 'Content-Type: application/json' \
  -d '{
    "action": "pull_remote_file",
    "target_path": "sales/report.cpt"
  }'
```

上传单文件：

```bash
curl -X POST 'http://127.0.0.1:8000/api/sync/actions' \
  -H 'Content-Type: application/json' \
  -d '{
    "action": "sync_file",
    "target_path": "sales/report.cpt"
  }'
```

发布整个项目：

```bash
curl -X POST 'http://127.0.0.1:8000/api/sync/actions' \
  -H 'Content-Type: application/json' \
  -d '{
    "action": "publish_project",
    "target_path": null
  }'
```

响应形态：

```json
{
  "action": "sync_file",
  "status": "verified",
  "target_path": "sales/report.cpt",
  "remote_path": "sales/report.cpt"
}
```

### 底层读写示例

下载：

```bash
python -m fine_remote.cli read \
  --url http://127.0.0.1:8075/webroot/decision \
  --username admin \
  --password admin \
  --fine-home /Applications/FineReport \
  --path reportlets/sales/report.cpt
```

上传：

```bash
python -m fine_remote.cli write \
  --url http://127.0.0.1:8075/webroot/decision \
  --username admin \
  --password admin \
  --fine-home /Applications/FineReport \
  --path reportlets/sales/report.cpt \
  --input-file /tmp/report.cpt
```

删除：

```bash
python -m fine_remote.cli delete \
  --url http://127.0.0.1:8075/webroot/decision \
  --username admin \
  --password admin \
  --fine-home /Applications/FineReport \
  --path reportlets/sales/report.cpt
```

## 旧 Tauri 链路里值得保留的语义

虽然本轮已经清空实现代码，但以下语义在下一次重构时仍建议保留：

- `prepare-edit` 的真实含义是“先把远端最新文件拉回本地，再开始编辑”
- `prepare-create` 的真实含义是“先确认远端同名文件不存在，再上传空白模板占位，然后拉回本地继续编辑”
- 上传后必须做远端回读校验，不能只依赖 `write` 返回成功
- 如果远端条目 `lock` 非空，应立即拒绝覆盖

## 依赖与踩坑

- `designer_root` 必须能找到 FineReport jars
  - `<designer_root>/webapps/webroot/WEB-INF/lib/*.jar`
  - `<designer_root>/lib/*.jar`
- Java 命令优先尝试 FineReport 自带运行时，再回退到系统 `java`
- JVM classpath 必须使用 `os.pathsep`，不能写死 `:`
- 目录和文件链路依赖 FineReport Designer 运行时类
  - `FileNodes`
  - `WorkResource`
  - `FineWorkspaceConnector`
- 数据连接链路依赖 HTTP 登录 token，不依赖 JVM bridge
- 远端路径必须被限制在 `reportlets` 根下，避免跨目录写入

## 后续重构建议

下一次重构时，优先恢复以下抽象边界：

- `remote directory browser`
- `data connection http client`
- `file sync gateway`
- `fine_remote bridge`
- `project/init/status/sync/preview` 统一 CLI 入口
