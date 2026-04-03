"""Dataclasses shared across runtime services."""

from __future__ import annotations

from dataclasses import asdict, dataclass
from pathlib import Path


REQUIRED_FIELDS = (
    "decision_url",
    "designer_root",
    "username",
    "password",
    "workspace_root",
)
DERIVED_FIELDS = ("project_name", "remote_root", "task_type")
ALL_FIELDS = ("project_name", *REQUIRED_FIELDS, "remote_root", "task_type")
DEFAULT_REMOTE_ROOT = "reportlets"
DEFAULT_TASK_TYPE = "未指定"


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

    def to_dict(self) -> dict[str, str]:
        payload = asdict(self)
        return {
            key: str(value) if isinstance(value, Path) else value
            for key, value in payload.items()
        }
