"""Dataclasses shared across runtime services."""

from __future__ import annotations

from dataclasses import asdict, dataclass
from pathlib import Path


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
