"""Read and write runtime config files."""

from __future__ import annotations

import json
from pathlib import Path

from .models import DEFAULT_REMOTE_ROOT, DEFAULT_TASK_TYPE, REQUIRED_FIELDS, RuntimeConfig


def load_config(path: Path) -> RuntimeConfig:
    payload = json.loads(path.read_text())
    missing = [field for field in REQUIRED_FIELDS if not payload.get(field)]
    if missing:
        raise ValueError(", ".join(missing))
    workspace_root = Path(payload["workspace_root"])
    return RuntimeConfig(
        project_name=payload.get("project_name") or workspace_root.name,
        decision_url=payload["decision_url"],
        designer_root=Path(payload["designer_root"]),
        username=payload["username"],
        password=payload["password"],
        workspace_root=workspace_root,
        remote_root=payload.get("remote_root") or DEFAULT_REMOTE_ROOT,
        task_type=payload.get("task_type") or DEFAULT_TASK_TYPE,
    )


def write_config(path: Path, config: RuntimeConfig) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(config.to_dict(), indent=2, ensure_ascii=False) + "\n")
