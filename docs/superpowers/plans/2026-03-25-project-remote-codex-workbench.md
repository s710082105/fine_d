# Project Remote Codex Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把当前 `Python + Vue` 本地主链路补成一个可操作的工作台，支持中文页面、本机项目目录选择、项目级远程参数、远程概览，以及页面内嵌 Codex 终端。

**Architecture:** 在现有 `apps/api + backend + apps/web` 骨架上扩展，不新开平行框架。后端新增“当前项目 + 项目级远程参数 + 远程概览 + Codex 终端会话”四组能力；前端把原英文占位页重组为“项目与远程概览”和“Codex”两条主链路，保持错误显式暴露，不做 silent fallback。

**Tech Stack:** FastAPI, Pydantic, pytest, Vue 3, TypeScript, Vitest, Vite, PTY/terminal bridge, pnpm, uv

---

## File Structure

### Backend

- Modify: `backend/domain/project/models.py`
  - 扩展当前项目目录、项目级远程参数模型。
- Modify: `backend/domain/project/errors.py`
  - 补项目未选择、远程参数不完整、目录无效等错误。
- Create: `backend/domain/project/remote_models.py`
  - 远程参数和当前项目聚合视图的领域模型。
- Create: `backend/domain/remote/models.py`
  - 远程目录项、数据连接、远程概览结果模型。
- Create: `backend/domain/codex_terminal/models.py`
  - 终端会话状态模型。
- Modify: `backend/application/project/config_service.py`
  - 从只读目录配置扩展到“当前项目选择 + 项目级远程参数存取”。
- Create: `backend/application/remote/use_cases.py`
  - 远程连接测试、远程概览聚合。
- Create: `backend/application/codex_terminal/use_cases.py`
  - 创建、读取、写入、关闭 Codex 终端会话。
- Create: `backend/adapters/platform/directory_picker.py`
  - 封装目录选择行为，便于后端显式调用或后续替换。
- Create: `backend/adapters/fine/remote_overview_gateway.py`
  - 复用现有 Fine 远程能力，读取目录与数据连接。
- Create: `backend/adapters/system/terminal_gateway.py`
  - PTY 会话管理，屏蔽具体终端实现。
- Create: `backend/infra/project_store.py`
  - 当前项目与项目级远程参数的本地持久化。
- Create: `backend/infra/terminal_session_store.py`
  - 终端会话注册表和进程索引。
- Modify: `backend/schemas/project.py`
  - 新增当前项目与远程参数响应模型。
- Create: `backend/schemas/remote.py`
  - 远程概览与连接测试模型。
- Create: `backend/schemas/codex_terminal.py`
  - 终端会话请求/响应模型。
- Modify: `apps/api/routes/project.py`
  - 改成当前项目 + 项目级远程参数的正式接口。
- Create: `apps/api/routes/remote.py`
  - 远程概览接口。
- Create: `apps/api/routes/codex_terminal.py`
  - Codex 终端会话接口。
- Modify: `backend/app_factory.py`
  - 挂载新路由。

### Frontend

- Modify: `apps/web/src/lib/types.ts`
  - 把英文 section 和旧只读模型替换成中文工作台模型。
- Modify: `apps/web/src/lib/api.ts`
  - 新增项目选择、远程参数、远程概览、Codex 终端接口。
- Modify: `apps/web/src/App.vue`
  - 主导航改成中文，并切成“项目与远程概览 / Codex”。
- Modify: `apps/web/src/components/SideNav.vue`
  - 对齐中文导航。
- Create: `apps/web/src/views/ProjectWorkbenchView.vue`
  - 页面 1：项目目录 + 远程参数 + 远程概览。
- Create: `apps/web/src/views/CodexTerminalView.vue`
  - 页面 2：Codex 终端。
- Create: `apps/web/src/components/RemoteDirectoryPanel.vue`
  - 远程目录面板。
- Create: `apps/web/src/components/DataConnectionPanel.vue`
  - 数据连接面板。
- Create: `apps/web/src/components/TerminalSessionPanel.vue`
  - 终端容器与状态栏。
- Delete: `apps/web/src/views/DatasourceView.vue`
- Delete: `apps/web/src/views/ReportletView.vue`
- Delete: `apps/web/src/views/SyncView.vue`
- Delete: `apps/web/src/views/PreviewView.vue`
- Delete: `apps/web/src/views/AssistantView.vue`
- Modify: `apps/web/src/views/ProjectView.vue`
  - 若保留，改成复用或壳层跳转；否则由新页面替代。
- Modify: `apps/web/src/styles.css`
  - 补中文工作台布局。
- Modify: `apps/web/vite.config.ts`
  - 保留 `/api` 代理配置。

### Tests

- Modify: `tests/test_project_api.py`
- Modify: `tests/test_project_config_service.py`
- Create: `tests/test_remote_api.py`
- Create: `tests/test_remote_use_cases.py`
- Create: `tests/test_codex_terminal_api.py`
- Create: `tests/test_codex_terminal_use_cases.py`
- Modify: `apps/web/src/__tests__/navigation.spec.ts`
- Create: `apps/web/src/__tests__/project-workbench-view.spec.ts`
- Create: `apps/web/src/__tests__/codex-terminal-view.spec.ts`
- Create: `apps/web/src/__tests__/remote-panels.spec.ts`
- Keep: `apps/web/src/__tests__/vite-config.spec.ts`

## Task 1: 项目目录选择与项目级远程参数

**Files:**
- Create: `backend/domain/project/remote_models.py`
- Modify: `backend/domain/project/models.py`
- Modify: `backend/domain/project/errors.py`
- Modify: `backend/application/project/config_service.py`
- Create: `backend/infra/project_store.py`
- Modify: `backend/schemas/project.py`
- Modify: `apps/api/routes/project.py`
- Modify: `tests/test_project_config_service.py`
- Modify: `tests/test_project_api.py`

- [ ] **Step 1: 写项目状态和远程参数失败测试**

```python
def test_select_project_persists_current_project(tmp_path: Path) -> None:
    service = ProjectConfigService(base_dir=tmp_path)

    result = service.select_project(tmp_path)

    assert result.project.path == tmp_path
    assert result.remote_profile is None
```

```python
def test_save_remote_profile_requires_current_project(tmp_path: Path) -> None:
    service = ProjectConfigService(base_dir=tmp_path)

    with pytest.raises(AppError, match="project.current_required"):
        service.save_remote_profile("http://demo", "admin", "secret")
```

- [ ] **Step 2: 跑后端单测，确认接口和模型缺失而失败**

Run: `uv run pytest tests/test_project_config_service.py tests/test_project_api.py -q`
Expected: FAIL with missing `select_project`, `save_remote_profile`, or schema field errors

- [ ] **Step 3: 实现最小项目选择与远程参数持久化**

```python
@dataclass(frozen=True)
class RemoteProfile:
    base_url: str
    username: str
    password: str
```

```python
@dataclass(frozen=True)
class CurrentProjectState:
    project: SelectedProject
    remote_profile: RemoteProfile | None
```

- [ ] **Step 4: 暴露正式 API**

Endpoints:
- `POST /api/project/select`
- `GET /api/project/current`
- `PUT /api/project/remote-profile`

- [ ] **Step 5: 重跑后端测试确认通过**

Run: `uv run pytest tests/test_project_config_service.py tests/test_project_api.py -q`
Expected: PASS

- [ ] **Step 6: 提交**

```bash
git add backend/domain/project backend/application/project backend/infra/project_store.py backend/schemas/project.py apps/api/routes/project.py tests/test_project_config_service.py tests/test_project_api.py
git commit -m "feat: 增加项目目录与远程参数配置"
```

## Task 2: 远程概览接口与连接测试

**Files:**
- Create: `backend/domain/remote/models.py`
- Create: `backend/application/remote/use_cases.py`
- Create: `backend/adapters/fine/remote_overview_gateway.py`
- Create: `backend/schemas/remote.py`
- Create: `apps/api/routes/remote.py`
- Modify: `backend/app_factory.py`
- Create: `tests/test_remote_use_cases.py`
- Create: `tests/test_remote_api.py`

- [ ] **Step 1: 写远程概览失败测试**

```python
def test_load_remote_overview_returns_directory_entries_and_connections() -> None:
    gateway = StubRemoteOverviewGateway(
        entries=[RemoteDirectoryEntry(path="reportlets/demo", is_directory=True)],
        connections=[RemoteDataConnection(name="qzcs")],
    )
    use_case = LoadRemoteOverviewUseCase(gateway)

    result = use_case.load(valid_profile)

    assert result.directory_entries[0].path == "reportlets/demo"
    assert result.data_connections[0].name == "qzcs"
```

```python
def test_test_remote_profile_rejects_incomplete_profile() -> None:
    with pytest.raises(AppError, match="project.remote_profile_invalid"):
        TestRemoteProfileUseCase(...).execute(RemoteProfile(base_url="", username="", password=""))
```

- [ ] **Step 2: 运行远程概览测试，确认缺少模块而失败**

Run: `uv run pytest tests/test_remote_use_cases.py tests/test_remote_api.py -q`
Expected: FAIL with missing gateway/use case/route imports

- [ ] **Step 3: 实现统一远程概览用例**

Use cases:
- `TestRemoteProfileUseCase`
- `LoadRemoteOverviewUseCase`

Rules:
- 复用一组远程参数
- 一次请求返回目录和数据连接
- 任一失败都抛显式错误

- [ ] **Step 4: 挂载远程 API**

Endpoints:
- `POST /api/project/remote-profile/test`
- `GET /api/remote/overview`

- [ ] **Step 5: 跑后端测试验证**

Run: `uv run pytest tests/test_remote_use_cases.py tests/test_remote_api.py tests/test_project_api.py -q`
Expected: PASS

- [ ] **Step 6: 提交**

```bash
git add backend/domain/remote backend/application/remote backend/adapters/fine/remote_overview_gateway.py backend/schemas/remote.py apps/api/routes/remote.py backend/app_factory.py tests/test_remote_use_cases.py tests/test_remote_api.py
git commit -m "feat: 增加远程概览与连接测试接口"
```

## Task 3: Codex 终端后端会话管理

**Files:**
- Create: `backend/domain/codex_terminal/models.py`
- Create: `backend/application/codex_terminal/use_cases.py`
- Create: `backend/adapters/system/terminal_gateway.py`
- Create: `backend/infra/terminal_session_store.py`
- Create: `backend/schemas/codex_terminal.py`
- Create: `apps/api/routes/codex_terminal.py`
- Modify: `backend/app_factory.py`
- Create: `tests/test_codex_terminal_use_cases.py`
- Create: `tests/test_codex_terminal_api.py`

- [ ] **Step 1: 写终端会话失败测试**

```python
def test_create_session_uses_project_directory() -> None:
    gateway = StubTerminalGateway()
    use_case = CreateCodexTerminalSessionUseCase(gateway, session_store)

    result = use_case.execute(Path("/tmp/project"))

    assert result.working_directory == "/tmp/project"
    assert result.status == "running"
```

```python
def test_create_session_rejects_missing_working_directory() -> None:
    with pytest.raises(AppError, match="project.directory_invalid"):
        use_case.execute(Path("/tmp/missing"))
```

- [ ] **Step 2: 跑终端后端测试，确认缺少会话模块而失败**

Run: `uv run pytest tests/test_codex_terminal_use_cases.py tests/test_codex_terminal_api.py -q`
Expected: FAIL with missing terminal session models or routes

- [ ] **Step 3: 实现最小终端会话生命周期**

Back-end actions:
- create session
- read snapshot/stream token
- write input
- close session

Use a thin gateway; do not parse Codex output into chat messages.

- [ ] **Step 4: 暴露 Codex 终端 API**

Endpoints:
- `POST /api/codex/terminal/sessions`
- `GET /api/codex/terminal/sessions/{session_id}`
- `GET /api/codex/terminal/sessions/{session_id}/stream`
- `POST /api/codex/terminal/sessions/{session_id}/input`
- `DELETE /api/codex/terminal/sessions/{session_id}`

- [ ] **Step 5: 跑后端测试验证**

Run: `uv run pytest tests/test_codex_terminal_use_cases.py tests/test_codex_terminal_api.py -q`
Expected: PASS

- [ ] **Step 6: 提交**

```bash
git add backend/domain/codex_terminal backend/application/codex_terminal backend/adapters/system/terminal_gateway.py backend/infra/terminal_session_store.py backend/schemas/codex_terminal.py apps/api/routes/codex_terminal.py backend/app_factory.py tests/test_codex_terminal_use_cases.py tests/test_codex_terminal_api.py
git commit -m "feat: 增加 Codex 终端会话后端"
```

## Task 4: 前端中文工作台与远程概览页

**Files:**
- Modify: `apps/web/src/lib/types.ts`
- Modify: `apps/web/src/lib/api.ts`
- Modify: `apps/web/src/App.vue`
- Modify: `apps/web/src/components/SideNav.vue`
- Create: `apps/web/src/views/ProjectWorkbenchView.vue`
- Create: `apps/web/src/components/RemoteDirectoryPanel.vue`
- Create: `apps/web/src/components/DataConnectionPanel.vue`
- Modify: `apps/web/src/styles.css`
- Modify: `apps/web/src/__tests__/navigation.spec.ts`
- Create: `apps/web/src/__tests__/project-workbench-view.spec.ts`
- Create: `apps/web/src/__tests__/remote-panels.spec.ts`

- [ ] **Step 1: 写前端中文工作台失败测试**

```ts
it('renders Chinese navigation labels', () => {
  render(App)
  expect(screen.getByRole('button', { name: '项目与远程概览' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Codex' })).toBeInTheDocument()
})
```

```ts
it('loads project state and remote overview in the workbench view', async () => {
  // stub fetch with current project + remote overview payloads
  // assert path label, remote directory, data connection panel
})
```

- [ ] **Step 2: 跑前端测试，确认新页面和中文导航还不存在**

Run: `pnpm --dir apps/web exec vitest run src/__tests__/navigation.spec.ts src/__tests__/project-workbench-view.spec.ts src/__tests__/remote-panels.spec.ts`
Expected: FAIL with missing labels/components

- [ ] **Step 3: 实现中文工作台页面**

Changes:
- `Project / Datasource / Reportlet / Sync / Preview / Assistant` 收敛为中文导航
- 增加 `项目与远程概览` 页面
- 项目目录、远程参数、远程目录、数据连接都在同一页

- [ ] **Step 4: 重跑前端测试验证通过**

Run: `pnpm --dir apps/web exec vitest run src/__tests__/navigation.spec.ts src/__tests__/project-workbench-view.spec.ts src/__tests__/remote-panels.spec.ts`
Expected: PASS

- [ ] **Step 5: 做类型检查**

Run: `pnpm --dir apps/web exec vue-tsc --noEmit`
Expected: PASS

- [ ] **Step 6: 提交**

```bash
git add apps/web/src/lib/types.ts apps/web/src/lib/api.ts apps/web/src/App.vue apps/web/src/components/SideNav.vue apps/web/src/views/ProjectWorkbenchView.vue apps/web/src/components/RemoteDirectoryPanel.vue apps/web/src/components/DataConnectionPanel.vue apps/web/src/styles.css apps/web/src/__tests__/navigation.spec.ts apps/web/src/__tests__/project-workbench-view.spec.ts apps/web/src/__tests__/remote-panels.spec.ts
git commit -m "feat: 增加中文项目远程概览工作台"
```

## Task 5: 前端 Codex 终端页

**Files:**
- Modify: `apps/web/src/lib/types.ts`
- Modify: `apps/web/src/lib/api.ts`
- Create: `apps/web/src/views/CodexTerminalView.vue`
- Create: `apps/web/src/components/TerminalSessionPanel.vue`
- Modify: `apps/web/src/App.vue`
- Modify: `apps/web/src/styles.css`
- Create: `apps/web/src/__tests__/codex-terminal-view.spec.ts`

- [ ] **Step 1: 写 Codex 终端页失败测试**

```ts
it('creates a new terminal session when entering the codex page', async () => {
  render(App)
  await fireEvent.click(screen.getByRole('button', { name: 'Codex' }))
  expect(fetchMock).toHaveBeenCalledWith('/api/codex/terminal/sessions', expect.anything())
})
```

```ts
it('shows terminal startup errors without fallback UI', async () => {
  // mock 400/500
  // assert error banner contains backend message
})
```

- [ ] **Step 2: 跑前端测试，确认 Codex 页未落地而失败**

Run: `pnpm --dir apps/web exec vitest run src/__tests__/codex-terminal-view.spec.ts`
Expected: FAIL with missing view/api

- [ ] **Step 3: 实现最小终端承载页**

Rules:
- 进入页面立即创建新会话
- 页面主体是终端容器
- 只显示工作目录、状态、重开会话按钮
- 不实现消息气泡和发送框

- [ ] **Step 4: 重跑前端测试**

Run: `pnpm --dir apps/web exec vitest run src/__tests__/codex-terminal-view.spec.ts src/__tests__/navigation.spec.ts`
Expected: PASS

- [ ] **Step 5: 做类型检查与构建**

Run: `pnpm --dir apps/web exec vue-tsc --noEmit && pnpm --dir apps/web build`
Expected: PASS

- [ ] **Step 6: 提交**

```bash
git add apps/web/src/lib/types.ts apps/web/src/lib/api.ts apps/web/src/views/CodexTerminalView.vue apps/web/src/components/TerminalSessionPanel.vue apps/web/src/App.vue apps/web/src/styles.css apps/web/src/__tests__/codex-terminal-view.spec.ts
git commit -m "feat: 增加 Codex 终端工作台页面"
```

## Task 6: 全量回归与文档更新

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-03-25-project-remote-codex-workbench/README.md`
- Modify: `apps/web/vite.config.ts` (only if proxy or dev behavior changed)

- [ ] **Step 1: 更新 README 中的当前能力说明**

Document:
- 中文页面
- 项目目录选择
- 远程概览
- Codex 终端页

- [ ] **Step 2: 跑后端全量测试**

Run: `env FINE_REMOTE_URL=http://192.168.0.99:8075/webroot/decision FINE_REMOTE_USERNAME=admin FINE_REMOTE_PASSWORD=admin PYTHONPATH=python uv run pytest -q`
Expected: PASS with current integration-test skip policy

- [ ] **Step 3: 跑前端全量测试**

Run: `pnpm --dir apps/web exec vitest run`
Expected: PASS

- [ ] **Step 4: 跑类型检查与构建**

Run: `pnpm --dir apps/web exec vue-tsc --noEmit && pnpm --dir apps/web build`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add README.md docs/superpowers/specs/2026-03-25-project-remote-codex-workbench/README.md
git commit -m "docs: 更新项目远程工作台说明"
```
