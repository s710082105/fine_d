# Element Plus 远程目录树与连接摘要 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把项目远程工作台升级为基于 `Element Plus` 的标准交互界面，并补齐远程目录树懒加载与数据连接摘要字段。

**Architecture:** 后端先扩展远程数据模型和 API，再由前端基于新接口改造成 `Element Plus` 工作台。远程目录不再一次性只渲染平铺列表，而是通过单独的目录读取接口按节点懒加载；数据连接摘要只返回安全字段，不做 silent fallback。

**Tech Stack:** FastAPI, Pydantic, pytest, Vue 3, TypeScript, Element Plus, Vitest, Vite, pnpm, uv

---

## File Structure

### Backend

- Modify: `backend/domain/datasource/models.py`
  - 扩展连接摘要为 `name + database_type + host_or_url`。
- Modify: `backend/schemas/datasource.py`
  - 暴露新的连接响应模型字段。
- Modify: `backend/domain/remote/models.py`
  - 为目录项补 `name`，并为目录列表查询保留稳定模型。
- Modify: `backend/application/remote/use_cases.py`
  - 增加远程目录按路径读取用例。
- Modify: `backend/adapters/fine/http_client.py`
  - 解析连接类型与地址摘要。
- Modify: `backend/adapters/fine/remote_overview_gateway.py`
  - 增加根目录/子目录读取能力，并继续聚合概览。
- Modify: `backend/schemas/remote.py`
  - 增加目录节点响应模型和目录列表响应。
- Modify: `apps/api/routes/remote.py`
  - 新增 `GET /api/remote/directories`。
- Modify: `tests/test_remote_use_cases.py`
- Modify: `tests/test_remote_api.py`
- Modify: `tests/test_fine_http_client.py`

### Frontend

- Modify: `apps/web/package.json`
  - 新增 `element-plus`。
- Modify: `apps/web/src/main.ts`
  - 接入 `Element Plus` 和样式。
- Modify: `apps/web/src/lib/types.ts`
  - 扩展目录节点与数据连接摘要类型。
- Modify: `apps/web/src/lib/api.ts`
  - 增加目录懒加载请求。
- Modify: `apps/web/src/views/ProjectWorkbenchView.vue`
  - 用 `Element Plus` 表单、卡片、提示重构主工作台。
- Modify: `apps/web/src/components/RemoteDirectoryPanel.vue`
  - 改为 `el-tree` 懒加载目录树。
- Modify: `apps/web/src/components/DataConnectionPanel.vue`
  - 改为带元数据的摘要卡片/描述列表。
- Modify: `apps/web/src/__tests__/project-workbench-view.spec.ts`
- Modify: `apps/web/src/__tests__/remote-panels.spec.ts`

## Task 1: 扩展数据连接摘要模型

**Files:**
- Modify: `backend/domain/datasource/models.py`
- Modify: `backend/schemas/datasource.py`
- Modify: `backend/adapters/fine/http_client.py`
- Modify: `tests/test_fine_http_client.py`
- Modify: `tests/test_remote_api.py`
- Modify: `tests/test_remote_use_cases.py`

- [ ] **Step 1: 先写失败测试，锁定连接类型和地址摘要**

```python
def test_list_connections_extracts_type_and_host_url() -> None:
    payload = {
        "data": [
            {
                "name": "qzcs",
                "databaseType": "MYSQL",
                "url": "jdbc:mysql://127.0.0.1:3306/demo",
            }
        ]
    }

    result = _data_items(payload)

    assert _parse_connection(result[0]) == ConnectionSummary(
        name="qzcs",
        database_type="MYSQL",
        host_or_url="jdbc:mysql://127.0.0.1:3306/demo",
    )
```

```python
def test_remote_overview_response_includes_connection_metadata() -> None:
    assert response.json()["data_connections"] == [
        {
            "name": "qzcs",
            "database_type": "MYSQL",
            "host_or_url": "jdbc:mysql://127.0.0.1:3306/demo",
        }
    ]
```

- [ ] **Step 2: 运行后端测试，确认新字段当前不存在而失败**

Run: `cd /Users/wj/data/mcp/finereport && PYTHONPATH=python .venv/bin/python -m pytest tests/test_fine_http_client.py tests/test_remote_use_cases.py tests/test_remote_api.py -q`
Expected: FAIL with missing `database_type` / `host_or_url` fields

- [ ] **Step 3: 写最小实现**

```python
@dataclass(frozen=True, slots=True)
class ConnectionSummary:
    name: str
    database_type: str
    host_or_url: str
```

Rules:
- `database_type` 从 `databaseType/type/driver` 等候选字段中取第一个有效值
- `host_or_url` 优先取 `url/jdbcUrl`
- 如果只有 `host/port/database`，拼出只读摘要
- 密码和密钥字段不进响应模型

- [ ] **Step 4: 重跑测试，确认解析与 API 输出通过**

Run: `cd /Users/wj/data/mcp/finereport && PYTHONPATH=python .venv/bin/python -m pytest tests/test_fine_http_client.py tests/test_remote_use_cases.py tests/test_remote_api.py -q`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
cd /Users/wj/data/mcp/finereport
git add backend/domain/datasource/models.py backend/schemas/datasource.py backend/adapters/fine/http_client.py tests/test_fine_http_client.py tests/test_remote_use_cases.py tests/test_remote_api.py
git commit -m "feat: 扩展远程数据连接摘要"
```

## Task 2: 增加远程目录懒加载接口

**Files:**
- Modify: `backend/domain/remote/models.py`
- Modify: `backend/application/remote/use_cases.py`
- Modify: `backend/adapters/fine/remote_overview_gateway.py`
- Modify: `backend/schemas/remote.py`
- Modify: `apps/api/routes/remote.py`
- Modify: `tests/test_remote_use_cases.py`
- Modify: `tests/test_remote_api.py`

- [ ] **Step 1: 先写失败测试，锁定根目录与子目录读取**

```python
def test_list_remote_directories_returns_root_entries() -> None:
    result = use_case.list_directories(path=None)
    assert result[0].path == "/reportlets"
    assert result[0].name == "reportlets"
```

```python
def test_list_remote_directories_returns_children_of_requested_path() -> None:
    result = use_case.list_directories(path="/reportlets")
    assert result == [
        RemoteDirectoryEntry(
            name="demo.cpt",
            path="/reportlets/demo.cpt",
            is_directory=False,
            lock=None,
        )
    ]
```

```python
def test_get_remote_directories_endpoint_accepts_optional_path(client: TestClient) -> None:
    response = client.get("/api/remote/directories", params={"path": "/reportlets"})
    assert response.status_code == 200
```

- [ ] **Step 2: 跑目录相关测试，确认新用例和路由当前缺失而失败**

Run: `cd /Users/wj/data/mcp/finereport && PYTHONPATH=python .venv/bin/python -m pytest tests/test_remote_use_cases.py tests/test_remote_api.py -q`
Expected: FAIL with missing use case or route behavior

- [ ] **Step 3: 实现按路径读取目录**

Required behavior:
- 新增 `ListRemoteDirectoriesUseCase`
- `GET /api/remote/directories`
- `path` 为空时返回根节点
- `path` 有值时只返回该目录下一级子项
- 目录项增加 `name`

- [ ] **Step 4: 重跑测试，确认懒加载 API 稳定**

Run: `cd /Users/wj/data/mcp/finereport && PYTHONPATH=python .venv/bin/python -m pytest tests/test_remote_use_cases.py tests/test_remote_api.py -q`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
cd /Users/wj/data/mcp/finereport
git add backend/domain/remote/models.py backend/application/remote/use_cases.py backend/adapters/fine/remote_overview_gateway.py backend/schemas/remote.py apps/api/routes/remote.py tests/test_remote_use_cases.py tests/test_remote_api.py
git commit -m "feat: 增加远程目录懒加载接口"
```

## Task 3: 引入 Element Plus 并重构工作台 UI

**Files:**
- Modify: `apps/web/package.json`
- Modify: `apps/web/src/main.ts`
- Modify: `apps/web/src/lib/types.ts`
- Modify: `apps/web/src/lib/api.ts`
- Modify: `apps/web/src/views/ProjectWorkbenchView.vue`
- Modify: `apps/web/src/components/RemoteDirectoryPanel.vue`
- Modify: `apps/web/src/components/DataConnectionPanel.vue`
- Modify: `apps/web/src/__tests__/project-workbench-view.spec.ts`
- Modify: `apps/web/src/__tests__/remote-panels.spec.ts`

- [ ] **Step 1: 先写前端失败测试**

```ts
it('renders remote directory tree and loads children lazily', async () => {
  vi.mocked(getRemoteDirectories).mockResolvedValueOnce([
    { name: 'reportlets', path: '/reportlets', is_directory: true, lock: null }
  ])

  render(RemoteDirectoryPanel, { props: { loadEntries: getRemoteDirectories } })

  expect(await screen.findByText('reportlets')).toBeInTheDocument()
})
```

```ts
it('shows connection metadata in data connection panel', () => {
  render(DataConnectionPanel, {
    props: {
      connections: [
        { name: 'qzcs', database_type: 'MYSQL', host_or_url: '127.0.0.1:3306/demo' }
      ]
    }
  })

  expect(screen.getByText('MYSQL')).toBeInTheDocument()
  expect(screen.getByText('127.0.0.1:3306/demo')).toBeInTheDocument()
})
```

- [ ] **Step 2: 运行前端测试，确认新 UI/接口还未接入而失败**

Run: `cd /Users/wj/data/mcp/finereport && pnpm --dir apps/web exec vitest run apps/web/src/__tests__/remote-panels.spec.ts apps/web/src/__tests__/project-workbench-view.spec.ts`
Expected: FAIL with missing Element Plus render paths or missing directory API mocks

- [ ] **Step 3: 安装并接入 Element Plus**

Commands:

```bash
cd /Users/wj/data/mcp/finereport
pnpm --dir apps/web add element-plus
```

Implementation rules:
- 在 `main.ts` 中 `app.use(ElementPlus)`
- 表单、按钮、提示、卡片全部替换为 `Element Plus`
- 不改变中文文案和主流程顺序

- [ ] **Step 4: 实现目录树和连接摘要 UI**

Required behavior:
- `RemoteDirectoryPanel` 使用 `el-tree` 的懒加载
- `ProjectWorkbenchView` 负责根目录首次加载与错误提示
- `DataConnectionPanel` 展示名称、数据库类型、地址摘要

- [ ] **Step 5: 重跑前端测试**

Run: `cd /Users/wj/data/mcp/finereport && pnpm --dir apps/web exec vitest run apps/web/src/__tests__/remote-panels.spec.ts apps/web/src/__tests__/project-workbench-view.spec.ts`
Expected: PASS

- [ ] **Step 6: 提交**

```bash
cd /Users/wj/data/mcp/finereport
git add apps/web/package.json apps/web/pnpm-lock.yaml apps/web/src/main.ts apps/web/src/lib/types.ts apps/web/src/lib/api.ts apps/web/src/views/ProjectWorkbenchView.vue apps/web/src/components/RemoteDirectoryPanel.vue apps/web/src/components/DataConnectionPanel.vue apps/web/src/__tests__/project-workbench-view.spec.ts apps/web/src/__tests__/remote-panels.spec.ts
git commit -m "feat: 使用 Element Plus 重构远程工作台"
```

## Task 4: 全量验证与收口

**Files:**
- Modify: `README.md`
  - 如有必要，补充 `Element Plus` 和远程目录树说明。
- Modify: `docs/superpowers/specs/2026-03-25-element-plus-remote-tree-and-connection-metadata-design.md`
  - 若实现与设计有偏差，更新文档。

- [ ] **Step 1: 跑后端相关测试**

Run: `cd /Users/wj/data/mcp/finereport && PYTHONPATH=python .venv/bin/python -m pytest tests/test_fine_http_client.py tests/test_remote_use_cases.py tests/test_remote_api.py tests/test_project_api.py -q`
Expected: PASS

- [ ] **Step 2: 跑前端测试**

Run: `cd /Users/wj/data/mcp/finereport && pnpm --dir apps/web exec vitest run`
Expected: PASS

- [ ] **Step 3: 跑类型检查和构建**

Run: `cd /Users/wj/data/mcp/finereport && pnpm --dir apps/web exec vue-tsc --noEmit`
Expected: PASS

Run: `cd /Users/wj/data/mcp/finereport && pnpm --dir apps/web build`
Expected: PASS

- [ ] **Step 4: 如文档有变化，补文档并提交**

```bash
cd /Users/wj/data/mcp/finereport
git add README.md docs/superpowers/specs/2026-03-25-element-plus-remote-tree-and-connection-metadata-design.md
git commit -m "docs: 更新远程工作台说明"
```
