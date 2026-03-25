# Python + Vue Local Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将当前 `Rust/Tauri/React/Java/Python` 混合形态重构为以 `Python + Vue` 为主的单机本地开发工具，并形成统一的安装、启动、同步、预览与 Codex 辅助入口。

**Architecture:** 先在现有仓库内建立新的 `apps/api + apps/web + backend` 结构，再把项目配置、数据探测、报表管理、同步、预览、assistant 六类能力逐步迁入新模块。旧的 `src/`、`src-tauri/`、`python/fine_remote/`、`java/` 只作为迁移参考，待新闭环验证通过后再归档或删除。

**Tech Stack:** Python 3.11+, FastAPI, Pydantic, Uvicorn, pytest, Vue 3, Vite, TypeScript, Vitest, Playwright or CDP adapter, pnpm

---

### Task 1: 建立新仓库骨架与双应用入口

**Files:**
- Create: `pyproject.toml`
- Create: `apps/api/main.py`
- Create: `apps/api/__init__.py`
- Create: `backend/__init__.py`
- Create: `backend/app_factory.py`
- Create: `backend/schemas/health.py`
- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/vite.config.ts`
- Create: `apps/web/index.html`
- Create: `apps/web/src/main.ts`
- Create: `apps/web/src/App.vue`
- Create: `apps/web/src/styles.css`
- Create: `tests/test_health_api.py`
- Create: `apps/web/src/__tests__/app-shell.spec.ts`

- [ ] **Step 1: 写后端健康检查失败测试**

```python
from fastapi.testclient import TestClient

from backend.app_factory import create_app


def test_health_endpoint_returns_ok() -> None:
    client = TestClient(create_app())
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
```

- [ ] **Step 2: 运行后端测试，确认因缺少应用工厂而失败**

Run: `pytest tests/test_health_api.py -q`
Expected: FAIL with `ModuleNotFoundError` or `ImportError`

- [ ] **Step 3: 写前端应用壳失败测试**

```ts
import { render, screen } from '@testing-library/vue'
import App from '../App.vue'

it('renders the local tool shell title', () => {
  render(App)
  expect(screen.getByText('FineReport Local Tool')).toBeInTheDocument()
})
```

- [ ] **Step 4: 运行前端测试，确认因缺少 Vue 应用而失败**

Run: `pnpm --dir apps/web test -- --runInBand`
Expected: FAIL with missing file or package errors

- [ ] **Step 5: 建立最小可运行骨架**

```python
from fastapi import FastAPI


def create_app() -> FastAPI:
    app = FastAPI()

    @app.get("/api/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    return app
```

```ts
import { createApp } from 'vue'
import App from './App.vue'
import './styles.css'

createApp(App).mount('#app')
```

- [ ] **Step 6: 重跑后端与前端测试，确认骨架通过**

Run: `pytest tests/test_health_api.py -q`
Expected: PASS

Run: `pnpm --dir apps/web test -- --runInBand`
Expected: PASS


### Task 2: 建立统一配置模型、错误模型与本地状态目录

**Files:**
- Create: `backend/domain/project/models.py`
- Create: `backend/domain/project/errors.py`
- Create: `backend/application/project/config_service.py`
- Create: `backend/infra/settings.py`
- Create: `backend/schemas/common.py`
- Create: `backend/schemas/project.py`
- Create: `tests/test_project_config_service.py`

- [ ] **Step 1: 写配置加载与错误响应测试**

```python
def test_default_project_config_uses_workspace_and_generated_dirs() -> None:
    service = ProjectConfigService(base_dir=tmp_path)
    config = service.load_or_create()
    assert config.workspace_dir == tmp_path / "workspace"
    assert config.generated_dir == tmp_path / "generated"
```

```python
def test_domain_error_is_serialized() -> None:
    payload = AppError(
        code="config.invalid",
        message="invalid config",
        detail={"field": "workspace_dir"},
        source="config",
        retryable=False,
    ).to_dict()
    assert payload["source"] == "config"
```

- [ ] **Step 2: 运行目标测试，确认缺少配置服务和错误模型而失败**

Run: `pytest tests/test_project_config_service.py -q`
Expected: FAIL with missing modules

- [ ] **Step 3: 实现项目配置、应用错误和默认目录初始化**

```python
@dataclass(frozen=True)
class ProjectConfig:
    root_dir: Path
    workspace_dir: Path
    generated_dir: Path
```

- [ ] **Step 4: 加入 API 级异常处理，并让 `/api/health` 继续通过**

Run: `pytest tests/test_health_api.py tests/test_project_config_service.py -q`
Expected: PASS


### Task 3: 交付一键安装、启动和诊断脚本

**Files:**
- Create: `scripts/install-macos.sh`
- Create: `scripts/install-windows.ps1`
- Create: `scripts/start-macos.sh`
- Create: `scripts/start-windows.cmd`
- Create: `scripts/doctor-macos.sh`
- Create: `scripts/doctor-windows.ps1`
- Create: `tests/test_script_contracts.py`

- [ ] **Step 1: 写脚本契约测试，断言关键命令和输出存在**

```python
def test_install_macos_mentions_python_and_node() -> None:
    content = Path("scripts/install-macos.sh").read_text(encoding="utf-8")
    assert "python" in content.lower()
    assert "node" in content.lower()
```

```python
def test_start_windows_cmd_opens_browser() -> None:
    content = Path("scripts/start-windows.cmd").read_text(encoding="utf-8")
    assert "start http://127.0.0.1:18080" in content.lower()
```

- [ ] **Step 2: 运行脚本契约测试，确认文件缺失而失败**

Run: `pytest tests/test_script_contracts.py -q`
Expected: FAIL with file-not-found errors

- [ ] **Step 3: 实现安装、启动、诊断脚本**

```bash
python3 -m venv .venv
. .venv/bin/activate
python -m pip install -U pip
python -m pip install -e .
corepack enable
pnpm --dir apps/web install
```

```cmd
call .venv\Scripts\activate.bat
start http://127.0.0.1:18080
```

- [ ] **Step 4: 校验脚本语法与契约**

Run: `bash -n scripts/install-macos.sh scripts/start-macos.sh scripts/doctor-macos.sh`
Expected: no output, exit code 0

Run: `pytest tests/test_script_contracts.py -q`
Expected: PASS


### Task 4: 建立 Vue 主界面、导航与统一 API 客户端

**Files:**
- Create: `apps/web/src/lib/api.ts`
- Create: `apps/web/src/lib/types.ts`
- Create: `apps/web/src/components/AppLayout.vue`
- Create: `apps/web/src/components/SideNav.vue`
- Create: `apps/web/src/views/ProjectView.vue`
- Create: `apps/web/src/views/DatasourceView.vue`
- Create: `apps/web/src/views/ReportletView.vue`
- Create: `apps/web/src/views/SyncView.vue`
- Create: `apps/web/src/views/PreviewView.vue`
- Create: `apps/web/src/views/AssistantView.vue`
- Modify: `apps/web/src/App.vue`
- Create: `apps/web/src/__tests__/navigation.spec.ts`

- [ ] **Step 1: 写导航和 API 客户端失败测试**

```ts
it('shows six top-level sections', () => {
  render(App)
  expect(screen.getByText('Project')).toBeInTheDocument()
  expect(screen.getByText('Assistant')).toBeInTheDocument()
})
```

- [ ] **Step 2: 运行前端测试，确认导航和页面组件缺失而失败**

Run: `pnpm --dir apps/web test -- --runInBand`
Expected: FAIL with missing component imports

- [ ] **Step 3: 实现布局、导航和统一 API 客户端**

```ts
export async function getHealth(): Promise<HealthResponse> {
  const response = await fetch('/api/health')
  return await response.json()
}
```

- [ ] **Step 4: 重跑前端测试**

Run: `pnpm --dir apps/web test -- --runInBand`
Expected: PASS


### Task 5: 实现 datasource 模块与 Fine 远程数据适配器

**Files:**
- Create: `backend/domain/datasource/models.py`
- Create: `backend/application/datasource/use_cases.py`
- Create: `backend/adapters/fine/http_client.py`
- Create: `backend/schemas/datasource.py`
- Create: `apps/api/routes/datasource.py`
- Create: `tests/test_datasource_use_cases.py`
- Create: `tests/test_fine_http_client.py`

- [ ] **Step 1: 写数据探测用例失败测试**

```python
def test_list_connections_returns_remote_items(fake_fine_gateway) -> None:
    use_case = DatasourceUseCases(fake_fine_gateway)
    result = use_case.list_connections()
    assert result[0].name == "qzcs"
```

```python
def test_preview_sql_uses_configured_connection(fake_fine_gateway) -> None:
    use_case = DatasourceUseCases(fake_fine_gateway)
    preview = use_case.preview_sql("qzcs", "select 1 as ok")
    assert preview.columns == ["ok"]
```

- [ ] **Step 2: 运行 datasource 相关测试，确认缺少模块而失败**

Run: `pytest tests/test_datasource_use_cases.py tests/test_fine_http_client.py -q`
Expected: FAIL with missing use case and adapter modules

- [ ] **Step 3: 实现 Fine 远程数据适配器和 API 路由**

```python
@router.get("/api/datasource/connections")
def list_connections() -> list[ConnectionSummary]:
    return service.list_connections()
```

- [ ] **Step 4: 重跑目标测试**

Run: `pytest tests/test_datasource_use_cases.py tests/test_fine_http_client.py -q`
Expected: PASS


### Task 6: 实现 reportlet 模块与本地文件树管理

**Files:**
- Create: `backend/domain/reportlet/models.py`
- Create: `backend/application/reportlet/use_cases.py`
- Create: `backend/adapters/system/file_gateway.py`
- Create: `backend/schemas/reportlet.py`
- Create: `apps/api/routes/reportlet.py`
- Create: `tests/test_reportlet_use_cases.py`

- [ ] **Step 1: 写本地报表文件树和创建文件失败测试**

```python
def test_list_reportlets_returns_tree(tmp_path: Path) -> None:
    root = tmp_path / "workspace" / "reportlets"
    root.mkdir(parents=True)
    (root / "demo.cpt").write_text("ok", encoding="utf-8")
    use_case = ReportletUseCases(FileGateway(root))
    result = use_case.list_tree()
    assert result[0].name == "demo.cpt"
```

- [ ] **Step 2: 运行 reportlet 测试，确认缺少实现而失败**

Run: `pytest tests/test_reportlet_use_cases.py -q`
Expected: FAIL

- [ ] **Step 3: 实现文件树、创建、复制、读取、写入用例**

```python
def create_from_template(self, target: Path, template: Path) -> ReportletFile:
    target.write_bytes(template.read_bytes())
    return self.read(target)
```

- [ ] **Step 4: 重跑测试**

Run: `pytest tests/test_reportlet_use_cases.py -q`
Expected: PASS


### Task 7: 实现 sync 模块唯一入口与同步状态机

**Files:**
- Create: `backend/domain/sync/models.py`
- Create: `backend/domain/sync/state_machine.py`
- Create: `backend/application/sync/use_cases.py`
- Create: `backend/adapters/fine/sync_gateway.py`
- Create: `backend/schemas/sync.py`
- Create: `apps/api/routes/sync.py`
- Create: `tests/test_sync_use_cases.py`

- [ ] **Step 1: 写同步状态机和发布用例失败测试**

```python
def test_sync_file_transitions_to_verified(fake_sync_gateway) -> None:
    use_case = SyncUseCases(fake_sync_gateway)
    result = use_case.sync_file("demo.cpt")
    assert result.status == "verified"
```

```python
def test_publish_project_uses_single_entrypoint(fake_sync_gateway) -> None:
    use_case = SyncUseCases(fake_sync_gateway)
    use_case.publish_project()
    assert fake_sync_gateway.operations == ["sync_directory", "verify_remote_state"]
```

- [ ] **Step 2: 运行 sync 测试，确认缺少状态机和用例而失败**

Run: `pytest tests/test_sync_use_cases.py -q`
Expected: FAIL

- [ ] **Step 3: 实现 `sync_file`、`sync_directory`、`pull_remote_file`、`publish_project`、`verify_remote_state` 五个正式入口**

```python
SYNC_ALLOWED_ACTIONS = {
    "sync_file",
    "sync_directory",
    "pull_remote_file",
    "publish_project",
    "verify_remote_state",
}
```

- [ ] **Step 4: 重跑 sync 测试**

Run: `pytest tests/test_sync_use_cases.py -q`
Expected: PASS


### Task 8: 实现 preview 模块与浏览器校验适配器

**Files:**
- Create: `backend/domain/preview/models.py`
- Create: `backend/application/preview/use_cases.py`
- Create: `backend/adapters/browser/preview_gateway.py`
- Create: `backend/schemas/preview.py`
- Create: `apps/api/routes/preview.py`
- Create: `tests/test_preview_use_cases.py`

- [ ] **Step 1: 写预览打开和截图失败测试**

```python
def test_open_preview_returns_session(fake_preview_gateway) -> None:
    use_case = PreviewUseCases(fake_preview_gateway)
    result = use_case.open_preview("http://localhost:8075/webroot/decision")
    assert result.session_id == "session-1"
```

- [ ] **Step 2: 运行 preview 测试，确认缺少适配器与用例而失败**

Run: `pytest tests/test_preview_use_cases.py -q`
Expected: FAIL

- [ ] **Step 3: 实现浏览器预览、截图和元素校验 API**

```python
def capture_screenshot(self, session_id: str, output_path: Path) -> ScreenshotResult:
    ...
```

- [ ] **Step 4: 重跑 preview 测试**

Run: `pytest tests/test_preview_use_cases.py -q`
Expected: PASS


### Task 9: 实现 assistant 模块与 Codex 辅助入口

**Files:**
- Create: `backend/application/assistant/use_cases.py`
- Create: `backend/adapters/ai/codex/client.py`
- Create: `backend/schemas/assistant.py`
- Create: `apps/api/routes/assistant.py`
- Create: `apps/web/src/views/AssistantView.vue`
- Create: `tests/test_assistant_use_cases.py`
- Create: `apps/web/src/__tests__/assistant-view.spec.ts`

- [ ] **Step 1: 写 assistant 用例失败测试**

```python
def test_assistant_request_wraps_codex_as_auxiliary_gateway(fake_codex_client) -> None:
    use_case = AssistantUseCases(fake_codex_client)
    result = use_case.submit("同步当前报表")
    assert result.mode == "auxiliary"
```

- [ ] **Step 2: 运行 assistant 相关测试，确认缺少 client 和用例而失败**

Run: `pytest tests/test_assistant_use_cases.py -q`
Expected: FAIL

Run: `pnpm --dir apps/web test -- --runInBand`
Expected: FAIL in assistant view test

- [ ] **Step 3: 实现 assistant API、Codex 适配器和前端辅助工作台**

```python
class CodexClient(Protocol):
    def submit(self, prompt: str, context: dict[str, object]) -> CodexResult: ...
```

- [ ] **Step 4: 重跑 Python 与前端测试**

Run: `pytest tests/test_assistant_use_cases.py -q`
Expected: PASS

Run: `pnpm --dir apps/web test -- --runInBand`
Expected: PASS


### Task 10: 迁移旧实现、隔离遗留代码并补齐文档

**Files:**
- Create: `legacy/README.md`
- Move: `src/` -> `legacy/react-shell/`
- Move: `src-tauri/` -> `legacy/tauri-shell/`
- Move: `python/fine_remote/` -> `legacy/fine-remote-python/`
- Move: `java/` -> `legacy/fine-remote-java/`
- Modify: `README.md`
- Modify: `AGENTS.md`
- Create: `docs/migration/python-vue-local-refactor.md`

- [ ] **Step 1: 写 README/迁移文档校验测试**

```python
def test_root_readme_mentions_apps_api_and_apps_web() -> None:
    content = Path("README.md").read_text(encoding="utf-8")
    assert "apps/api" in content
    assert "apps/web" in content
```

- [ ] **Step 2: 运行文档校验测试，确认旧 README 尚未更新而失败**

Run: `pytest tests/test_script_contracts.py tests/test_project_config_service.py -q`
Expected: FAIL or missing README assertions

- [ ] **Step 3: 移动旧代码到 `legacy/`，更新根文档和迁移说明**

```text
legacy/
  tauri-shell/
  react-shell/
  fine-remote-python/
  fine-remote-java/
```

- [ ] **Step 4: 确认新旧目录边界清晰**

Run: `rg -n "src-tauri|python/fine_remote|java/fine_remote" README.md AGENTS.md docs/migration`
Expected: only migration references remain


### Task 11: 最终验证与可运行闭环

**Files:**
- Verify only

- [ ] **Step 1: 运行 Python 测试全集**

Run: `pytest tests -q`
Expected: PASS

- [ ] **Step 2: 运行前端测试全集**

Run: `pnpm --dir apps/web test -- --runInBand`
Expected: PASS

- [ ] **Step 3: 运行前端构建**

Run: `pnpm --dir apps/web build`
Expected: PASS with generated `apps/web/dist`

- [ ] **Step 4: 运行后端语法和导入检查**

Run: `python -m compileall backend apps/api`
Expected: PASS

- [ ] **Step 5: 用启动脚本做一次本地 smoke test**

Run: `bash scripts/start-macos.sh`
Expected: prints API URL, browser URL, and log paths

- [ ] **Step 6: 验证健康检查**

Run: `curl -fsS http://127.0.0.1:18080/api/health`
Expected: `{"status":"ok"}`

- [ ] **Step 7: 提交迁移闭环**

```bash
git add pyproject.toml apps backend scripts legacy README.md AGENTS.md docs tests
git commit -m "feat: 重构为 Python+Vue 本地工具架构"
```
