### Task 1: 建立 Python runtime 骨架与配置契约

**Files:**
- Create: `pyproject.toml`
- Create: `tooling/fr_runtime/__init__.py`
- Create: `tooling/fr_runtime/cli.py`
- Create: `tooling/fr_runtime/config/__init__.py`
- Create: `tooling/fr_runtime/config/models.py`
- Create: `tooling/fr_runtime/config/io.py`
- Test: `tests/fr_runtime/test_cli.py`
- Test: `tests/fr_runtime/test_config.py`

- [ ] **Step 1: Write the failing tests**

```python
# tests/fr_runtime/test_config.py
from pathlib import Path

import pytest

from tooling.fr_runtime.config.io import load_config


def test_load_config_rejects_missing_designer_root(tmp_path: Path) -> None:
    config_path = tmp_path / "fr-config.json"
    config_path.write_text('{"project_name":"demo","decision_url":"http://127.0.0.1:8075"}')

    with pytest.raises(ValueError, match="designer_root"):
        load_config(config_path)
```

```python
# tests/fr_runtime/test_cli.py
from tooling.fr_runtime.cli import build_parser


def test_cli_exposes_expected_subcommands() -> None:
    parser = build_parser()
    choices = parser._subparsers._group_actions[0].choices
    assert sorted(choices) == ["db", "doctor", "init", "preview", "sync"]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/fr_runtime/test_cli.py tests/fr_runtime/test_config.py -q`
Expected: FAIL with `ModuleNotFoundError: No module named 'tooling'`

- [ ] **Step 3: Write minimal implementation**

```toml
# pyproject.toml
[project]
name = "finereport-skill-runtime"
version = "0.1.0"
requires-python = ">=3.11"

[tool.pytest.ini_options]
pythonpath = ["."]
testpaths = ["tests"]
```

```python
# tooling/fr_runtime/config/models.py
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class RuntimeConfig:
    project_name: str
    decision_url: str
    designer_root: Path
    username: str
    password: str
    workspace_root: Path
    remote_root: str
    task_type: str
```

```python
# tooling/fr_runtime/config/io.py
import json
from pathlib import Path

from .models import RuntimeConfig


REQUIRED_FIELDS = (
    "project_name",
    "decision_url",
    "designer_root",
    "username",
    "password",
    "workspace_root",
    "remote_root",
    "task_type",
)


def load_config(path: Path) -> RuntimeConfig:
    payload = json.loads(path.read_text())
    missing = [field for field in REQUIRED_FIELDS if not payload.get(field)]
    if missing:
        raise ValueError(", ".join(missing))
    return RuntimeConfig(
        project_name=payload["project_name"],
        decision_url=payload["decision_url"],
        designer_root=Path(payload["designer_root"]),
        username=payload["username"],
        password=payload["password"],
        workspace_root=Path(payload["workspace_root"]),
        remote_root=payload["remote_root"],
        task_type=payload["task_type"],
    )
```

```python
# tooling/fr_runtime/cli.py
import argparse


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="fr-runtime")
    subparsers = parser.add_subparsers(dest="command", required=True)
    for name in ("init", "doctor", "db", "sync", "preview"):
        subparsers.add_parser(name)
    return parser
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/fr_runtime/test_cli.py tests/fr_runtime/test_config.py -q`
Expected: `2 passed`

### Task 2: 落地对话式初始化与环境检查骨架

**Files:**
- Create: `tooling/fr_runtime/init/__init__.py`
- Create: `tooling/fr_runtime/init/service.py`
- Create: `tooling/fr_runtime/doctor/__init__.py`
- Create: `tooling/fr_runtime/doctor/checks.py`
- Create: `tooling/fr_runtime/doctor/report.py`
- Test: `tests/fr_runtime/test_init_service.py`
- Test: `tests/fr_runtime/test_doctor_checks.py`

- [ ] **Step 1: Write the failing tests**

```python
# tests/fr_runtime/test_init_service.py
from tooling.fr_runtime.init.service import merge_answers


def test_merge_answers_marks_invalid_fields_for_retry() -> None:
    result = merge_answers(
        {"project_name": "demo"},
        {"designer_root": "", "decision_url": "http://127.0.0.1:8075/webroot/decision"},
    )
    assert result.retry_fields == ["designer_root"]
    assert result.status["decision_url"] == "passed"
```

```python
# tests/fr_runtime/test_doctor_checks.py
from pathlib import Path

from tooling.fr_runtime.doctor.checks import detect_designer_java


def test_detect_designer_java_prefers_designer_runtime(tmp_path: Path) -> None:
    java_path = tmp_path / "Contents" / "runtime" / "Contents" / "Home" / "bin" / "java"
    java_path.parent.mkdir(parents=True)
    java_path.write_text("")
    assert detect_designer_java(tmp_path) == java_path
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/fr_runtime/test_init_service.py tests/fr_runtime/test_doctor_checks.py -q`
Expected: FAIL with `ImportError` for missing `init.service` and `doctor.checks`

- [ ] **Step 3: Write minimal implementation**

```python
# tooling/fr_runtime/init/service.py
from dataclasses import dataclass


@dataclass(frozen=True)
class InitMergeResult:
    status: dict[str, str]
    merged: dict[str, str]
    retry_fields: list[str]


def merge_answers(existing: dict[str, str], incoming: dict[str, str]) -> InitMergeResult:
    merged = {**existing, **incoming}
    status = {}
    retry_fields = []
    for field, value in merged.items():
        passed = bool(str(value).strip())
        status[field] = "passed" if passed else "failed"
        if not passed:
            retry_fields.append(field)
    return InitMergeResult(status=status, merged=merged, retry_fields=retry_fields)
```

```python
# tooling/fr_runtime/doctor/checks.py
from pathlib import Path


MAC_JAVA = Path("Contents/runtime/Contents/Home/bin/java")
WIN_JAVA = Path("jre/bin/java.exe")
WIN_RUNTIME_JAVA = Path("runtime/bin/java.exe")


def detect_designer_java(designer_root: Path) -> Path:
    for candidate in (MAC_JAVA, WIN_JAVA, WIN_RUNTIME_JAVA):
        full_path = designer_root / candidate
        if full_path.exists():
            return full_path
    raise FileNotFoundError("designer bundled java not found")
```

```python
# tooling/fr_runtime/doctor/report.py
from dataclasses import dataclass


@dataclass(frozen=True)
class CheckResult:
    name: str
    status: str
    evidence: str
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/fr_runtime/test_init_service.py tests/fr_runtime/test_doctor_checks.py -q`
Expected: `2 passed`

- [ ] **Step 5: Wire CLI commands for init and doctor**

```python
# tooling/fr_runtime/cli.py
def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    if args.command in {"init", "doctor"}:
        return 0
    raise NotImplementedError(args.command)
```

Run: `python3 -m tooling.fr_runtime.cli init --help`
Expected: exit code `0` and help text contains `init`
