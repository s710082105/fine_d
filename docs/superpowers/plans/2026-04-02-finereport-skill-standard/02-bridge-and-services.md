### Task 3: 落地 Decision HTTP、Designer Java 与 bridge runner

**Files:**
- Create: `tooling/fr_runtime/remote/__init__.py`
- Create: `tooling/fr_runtime/remote/http.py`
- Create: `tooling/fr_runtime/bridge/__init__.py`
- Create: `tooling/fr_runtime/bridge/java_runtime.py`
- Create: `tooling/fr_runtime/bridge/runner.py`
- Test: `tests/fr_runtime/test_remote_http.py`
- Test: `tests/fr_runtime/test_bridge_runner.py`

- [ ] **Step 1: Write the failing tests**

```python
# tests/fr_runtime/test_remote_http.py
from tooling.fr_runtime.remote.http import build_login_payload


def test_build_login_payload_matches_fine_decision_contract() -> None:
    payload = build_login_payload("admin", "admin")
    assert payload == {
        "username": "admin",
        "password": "admin",
        "validity": -1,
        "sliderToken": "",
        "origin": "",
        "encrypted": False,
    }
```

```python
# tests/fr_runtime/test_bridge_runner.py
from pathlib import Path

from tooling.fr_runtime.bridge.runner import build_bridge_command


def test_build_bridge_command_uses_designer_java_and_jar() -> None:
    command = build_bridge_command(
        java_path=Path("/Applications/FineReport/Contents/runtime/Contents/Home/bin/java"),
        jar_path=Path("bridge/dist/fr-remote-bridge.jar"),
        operation="list",
    )
    assert command[:3] == [
        "/Applications/FineReport/Contents/runtime/Contents/Home/bin/java",
        "-jar",
        "bridge/dist/fr-remote-bridge.jar",
    ]
    assert command[-1] == "list"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/fr_runtime/test_remote_http.py tests/fr_runtime/test_bridge_runner.py -q`
Expected: FAIL with missing modules under `remote` and `bridge`

- [ ] **Step 3: Write minimal implementation**

```python
# tooling/fr_runtime/remote/http.py
def build_login_payload(username: str, password: str) -> dict[str, object]:
    return {
        "username": username,
        "password": password,
        "validity": -1,
        "sliderToken": "",
        "origin": "",
        "encrypted": False,
    }
```

```python
# tooling/fr_runtime/bridge/runner.py
from pathlib import Path


def build_bridge_command(java_path: Path, jar_path: Path, operation: str) -> list[str]:
    return [str(java_path), "-jar", str(jar_path), operation]
```

```python
# tooling/fr_runtime/bridge/java_runtime.py
from pathlib import Path


def validate_bridge_artifacts(jar_path: Path, manifest_path: Path) -> None:
    if not jar_path.exists():
        raise FileNotFoundError(jar_path)
    if not manifest_path.exists():
        raise FileNotFoundError(manifest_path)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/fr_runtime/test_remote_http.py tests/fr_runtime/test_bridge_runner.py -q`
Expected: `2 passed`

### Task 4: 落地 db、sync、preview 服务与 CLI 子命令

**Files:**
- Create: `tooling/fr_runtime/datasource/__init__.py`
- Create: `tooling/fr_runtime/datasource/service.py`
- Create: `tooling/fr_runtime/sync/__init__.py`
- Create: `tooling/fr_runtime/sync/service.py`
- Create: `tooling/fr_runtime/preview/__init__.py`
- Create: `tooling/fr_runtime/preview/service.py`
- Test: `tests/fr_runtime/test_datasource_service.py`
- Test: `tests/fr_runtime/test_sync_service.py`
- Test: `tests/fr_runtime/test_preview_service.py`

- [ ] **Step 1: Write the failing tests**

```python
# tests/fr_runtime/test_datasource_service.py
from tooling.fr_runtime.datasource.service import normalize_connection


def test_normalize_connection_prefers_name_and_database_type() -> None:
    item = {"connectionName": "FRDemo", "databaseType": "MYSQL"}
    assert normalize_connection(item) == {"name": "FRDemo", "database_type": "MYSQL"}
```

```python
# tests/fr_runtime/test_sync_service.py
from tooling.fr_runtime.sync.service import normalize_remote_path


def test_normalize_remote_path_rejects_non_reportlets_targets() -> None:
    try:
        normalize_remote_path("../etc/passwd")
    except ValueError as exc:
        assert "reportlets" in str(exc)
    else:
        raise AssertionError("expected ValueError")
```

```python
# tests/fr_runtime/test_preview_service.py
from tooling.fr_runtime.preview.service import build_preview_summary


def test_build_preview_summary_is_evidence_first() -> None:
    summary = build_preview_summary("http://127.0.0.1:8075/webroot/decision/view/report", True, True)
    assert "预览地址" in summary
    assert "是否执行查询：是" in summary
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/fr_runtime/test_datasource_service.py tests/fr_runtime/test_sync_service.py tests/fr_runtime/test_preview_service.py -q`
Expected: FAIL with `ImportError` for missing service modules

- [ ] **Step 3: Write minimal implementation**

```python
# tooling/fr_runtime/datasource/service.py
def normalize_connection(item: dict[str, str]) -> dict[str, str]:
    return {
        "name": item.get("name") or item["connectionName"],
        "database_type": item.get("databaseType") or item.get("type") or item["driver"],
    }
```

```python
# tooling/fr_runtime/sync/service.py
def normalize_remote_path(raw_path: str) -> str:
    path = raw_path.replace("\\", "/").lstrip("/")
    if not path.startswith("reportlets/"):
        raise ValueError("remote path must stay under reportlets")
    if "/../" in f"/{path}" or path.endswith("/.."):
        raise ValueError("remote path must stay under reportlets")
    return path
```

```python
# tooling/fr_runtime/preview/service.py
def build_preview_summary(url: str, opened: bool, queried: bool) -> str:
    return "\n".join(
        [
            "## 浏览器复核",
            f"- 预览地址：{url}",
            f"- 是否成功打开：{'是' if opened else '否'}",
            f"- 是否执行查询：{'是' if queried else '否'}",
        ]
    )
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/fr_runtime/test_datasource_service.py tests/fr_runtime/test_sync_service.py tests/fr_runtime/test_preview_service.py -q`
Expected: `3 passed`

- [ ] **Step 5: Expand CLI dispatch**

```python
# tooling/fr_runtime/cli.py
if args.command == "db":
    return 0
if args.command == "sync":
    return 0
if args.command == "preview":
    return 0
```

Run: `python3 -m tooling.fr_runtime.cli db --help`
Expected: exit code `0` and help text contains `db`
