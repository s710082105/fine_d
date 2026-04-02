"""Read and write runtime config files."""

from __future__ import annotations

import json
from pathlib import Path

from .models import REQUIRED_FIELDS, RuntimeConfig


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


def write_config(path: Path, config: RuntimeConfig) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(config.to_dict(), indent=2, ensure_ascii=False) + "\n")
