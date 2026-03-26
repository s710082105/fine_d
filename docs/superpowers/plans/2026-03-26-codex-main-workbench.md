# Codex Main Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `Codex` 页升级为 FineReport 主工作台入口，在创建真实终端前生成项目级上下文，并提供可点击插入终端的远程连接与远程文件辅助栏。

**Architecture:** 后端新增项目上下文生成服务，按当前选中项目路径写入 `AGENTS.md`、`.codex/project-context.md`、`.codex/project-rules.md` 和 FineReport skill 文件，并把最近一次生成状态持久化到 `.finereport/project-state.json`。前端保持真实 PTY 终端，只把 `CodexTerminalView` 重组为“左侧协作栏 + 右侧终端”，启动顺序固定为“读取当前项目 -> 生成上下文 -> 创建终端 -> 独立加载左侧远程信息”。

**Tech Stack:** Python 3.11+, FastAPI, Pydantic, pytest, Vue 3, TypeScript, Element Plus, xterm.js, Vitest, vue-tsc, pnpm

---

### Task 1: 实现项目上下文模型、模板与生成服务

**Files:**
- Create: `backend/domain/project/context_models.py`
- Create: `backend/application/project/context_templates.py`
- Create: `backend/application/project/context_service.py`
- Modify: `backend/infra/project_store.py`
- Test: `tests/test_project_context_service.py`

- [ ] **Step 1: 按 `@superpowers/test-driven-development` 写失败测试**

```python
def test_generate_context_creates_managed_files(tmp_path: Path) -> None:
    snapshot = service.generate(force=False)
    assert (project_dir / "AGENTS.md").exists()
    assert (project_dir / ".codex" / "project-context.md").exists()
    assert snapshot.agents_status == "created"


def test_generate_context_keeps_existing_agents_when_force_is_false(tmp_path: Path) -> None:
    agents_file.write_text("manual agents", encoding="utf-8")
    snapshot = service.generate(force=False)
    assert agents_file.read_text(encoding="utf-8") == "manual agents"
    assert snapshot.agents_status == "kept"
```

- [ ] **Step 2: 运行测试确认缺少上下文服务而失败**
Run: `pytest tests/test_project_context_service.py -q`
Expected: FAIL with missing modules or missing service

- [ ] **Step 3: 实现上下文服务和模板**

```python
MANAGED_SKILLS = (
    "fr-create",
    "fr-db",
    "fr-remote-check",
    "fr-remote-pull",
    "fr-remote-fill",
    "fr-sync",
    "fr-verify",
)


class ProjectContextService:
    def generate(self, *, force: bool) -> ProjectContextSnapshot:
        state = self._project_state_reader.get_current()
        project = _require_current_project(state)
        profile = _require_remote_profile(state.remote_profile)
        overview = self._remote_gateway.load_overview(profile, project)
        return self._writer.write(project, profile, overview, force=force)
```

- [ ] **Step 4: 扩展 `ProjectStore` 持久化最近一次上下文状态**

```python
payload["context_states"][str(project_path)] = {
    "generated_at": snapshot.generated_at.isoformat(),
    "agents_status": snapshot.agents_status,
}
```

- [ ] **Step 5: 重跑测试并提交**
Run: `pytest tests/test_project_context_service.py -q`
Expected: PASS

Run: `cd /Users/wj/data/mcp/finereport`
Expected: shell 位于仓库根目录

Run: `git add backend/domain/project/context_models.py backend/application/project/context_templates.py backend/application/project/context_service.py backend/infra/project_store.py tests/test_project_context_service.py`
Expected: staged files listed

Run: `git commit -m "feat: 增加项目上下文生成服务"`
Expected: commit created


### Task 2: 暴露项目上下文 API

**Files:**
- Modify: `apps/api/routes/project.py`
- Modify: `backend/schemas/project.py`
- Modify: `tests/test_project_api.py`

- [ ] **Step 1: 先写 API 契约测试**

```python
def test_generate_project_context_returns_snapshot(project_client: TestClient) -> None:
    response = project_client.post("/api/project/context", json={"force": False})
    assert response.status_code == 200
    assert response.json()["agents_status"] in {"created", "kept"}


def test_generate_project_context_rejects_incomplete_remote_profile(project_client: TestClient) -> None:
    response = project_client.post("/api/project/context", json={"force": False})
    assert response.status_code == 400
    assert response.json()["code"] == "project.remote_profile_invalid"
```

- [ ] **Step 2: 运行测试确认新接口尚未注册**
Run: `pytest tests/test_project_api.py -q`
Expected: FAIL with 404 response or missing response model

- [ ] **Step 3: 增加 `POST /api/project/context` 和响应模型**

```python
@router.post("/api/project/context", response_model=ProjectContextResponse)
def generate_project_context(
    request: ProjectContextGenerateRequest,
    service: ProjectContextService = Depends(get_project_context_service),
) -> ProjectContextResponse:
    return ProjectContextResponse.from_domain(service.generate(force=request.force))
```

```python
class ProjectContextResponse(BaseModel):
    project_root: Path
    generated_at: datetime
    agents_status: str
    managed_files: tuple[str, ...]
```

- [ ] **Step 4: 重跑测试并提交**
Run: `pytest tests/test_project_api.py tests/test_project_context_service.py -q`
Expected: PASS

Run: `cd /Users/wj/data/mcp/finereport`
Expected: shell 位于仓库根目录

Run: `git add apps/api/routes/project.py backend/schemas/project.py tests/test_project_api.py`
Expected: staged files listed

Run: `git commit -m "feat: 增加项目上下文接口"`
Expected: commit created


### Task 3: 把 Codex 页面改成双栏主工作台并固定启动顺序

**Files:**
- Create: `apps/web/src/components/CodexWorkbenchSidebar.vue`
- Modify: `apps/web/src/views/CodexTerminalView.vue`
- Modify: `apps/web/src/lib/api.ts`
- Modify: `apps/web/src/lib/types.ts`
- Test: `apps/web/src/__tests__/codex-terminal-view.spec.ts`

- [ ] **Step 1: 写前端失败测试，锁定启动顺序**

```ts
it('generates context before creating the terminal session', async () => {
  render(CodexTerminalView)
  await waitFor(() => {
    expect(generateProjectContext).toHaveBeenCalledWith(false)
    expect(createCodexTerminalSession).toHaveBeenCalledWith('/tmp/project-alpha')
  })
})


it('does not create a terminal session when context generation fails', async () => {
  generateProjectContext.mockRejectedValue(apiError)
  render(CodexTerminalView)
  await screen.findByText('project.remote_profile_invalid: 远程参数不合法')
  expect(createCodexTerminalSession).not.toHaveBeenCalled()
})
```

- [ ] **Step 2: 运行测试确认旧页面不满足新流程**
Run: `pnpm --dir apps/web exec vitest run apps/web/src/__tests__/codex-terminal-view.spec.ts`
Expected: FAIL with missing client function or outdated assertions

- [ ] **Step 3: 增加前端 API 和类型**

```ts
export function generateProjectContext(force: boolean): Promise<ProjectContextResponse> {
  return apiRequest<ProjectContextResponse>('/project/context', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ force })
  })
}
```

- [ ] **Step 4: 重写页面挂载流程，保持 B 方案边界**

```ts
async function bootWorkbench(): Promise<void> {
  const state = await getCurrentProject()
  if (!state.current_project) throw new Error('project.current_required')
  contextState.value = await generateProjectContext(false)
  session.value = await createCodexTerminalSession(state.current_project.path)
  void loadSidebarData()
}
```

- [ ] **Step 5: 把左侧协作栏独立成组件**
要求：
- 只展示上下文状态、数据连接、远程文件
- 不做流程编排、不自动执行同步、不解析终端语义
- 远程信息加载失败只影响左栏，不回退为假终端

- [ ] **Step 6: 重跑测试并提交**
Run: `pnpm --dir apps/web exec vitest run apps/web/src/__tests__/codex-terminal-view.spec.ts`
Expected: PASS

Run: `cd /Users/wj/data/mcp/finereport`
Expected: shell 位于仓库根目录

Run: `git add apps/web/src/components/CodexWorkbenchSidebar.vue apps/web/src/views/CodexTerminalView.vue apps/web/src/lib/api.ts apps/web/src/lib/types.ts apps/web/src/__tests__/codex-terminal-view.spec.ts`
Expected: staged files listed

Run: `git commit -m "feat: 重组 Codex 主工作台启动流程"`
Expected: commit created


### Task 4: 支持左侧点击插入终端并完成整体验证

**Files:**
- Modify: `apps/web/src/components/DataConnectionPanel.vue`
- Modify: `apps/web/src/components/RemoteDirectoryPanel.vue`
- Modify: `apps/web/src/components/TerminalSessionPanel.vue`
- Modify: `apps/web/src/components/CodexWorkbenchSidebar.vue`
- Modify: `apps/web/src/__tests__/codex-terminal-view.spec.ts`
- Modify: `apps/web/src/__tests__/project-workbench-view.spec.ts`
- Modify: `apps/web/src/views/ProjectWorkbenchView.vue`
- Modify: `tests/test_remote_api.py`

- [ ] **Step 1: 先写交互失败测试，锁定“插入但不执行”**

```ts
it('inserts selected connection name into the active terminal session', async () => {
  await fireEvent.click(await screen.findByText('qzcs'))
  await waitFor(() => {
    expect(writeCodexTerminalInput).toHaveBeenCalledWith('terminal-session-1', 'qzcs')
  })
})


it('inserts remote path without appending enter', async () => {
  await fireEvent.click(await screen.findByText('/reportlets/demo.cpt'))
  expect(writeCodexTerminalInput).not.toHaveBeenCalledWith('terminal-session-1', '/reportlets/demo.cpt\r')
})
```

- [ ] **Step 2: 运行测试确认现有面板不支持插入事件**
Run: `pnpm --dir apps/web exec vitest run apps/web/src/__tests__/codex-terminal-view.spec.ts`
Expected: FAIL with missing click handlers or unmet write assertions

- [ ] **Step 3: 让左侧面板只发出 `insert` 事件**

```vue
<DataConnectionPanel :connections="connections" @insert="emit('insert', $event)" />
<RemoteDirectoryPanel :load-entries="loadEntries" @insert="emit('insert', $event)" />
```

```ts
defineExpose({
  focusTerminal: () => adapter.value?.focus()
})
```

- [ ] **Step 4: 兼容旧工作台并完成全量验证**
Run: `pytest tests/test_project_context_service.py tests/test_project_api.py tests/test_remote_api.py tests/test_codex_terminal_api.py -q`
Expected: PASS

Run: `pnpm --dir apps/web exec vitest run`
Expected: PASS

Run: `pnpm --dir apps/web exec vue-tsc --noEmit`
Expected: PASS

Run: `pnpm --dir apps/web build`
Expected: PASS

- [ ] **Step 5: 提交任务 4**
Run: `cd /Users/wj/data/mcp/finereport`
Expected: shell 位于仓库根目录

Run: `git add apps/web/src/components/DataConnectionPanel.vue apps/web/src/components/RemoteDirectoryPanel.vue apps/web/src/components/TerminalSessionPanel.vue apps/web/src/components/CodexWorkbenchSidebar.vue apps/web/src/__tests__/codex-terminal-view.spec.ts apps/web/src/__tests__/project-workbench-view.spec.ts apps/web/src/views/ProjectWorkbenchView.vue tests/test_remote_api.py`
Expected: staged files listed

Run: `git commit -m "feat: 支持侧栏内容插入 Codex 终端"`
Expected: commit created
