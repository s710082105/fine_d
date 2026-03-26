from dataclasses import dataclass
from pathlib import Path

from backend.domain.project.context_models import ProjectContextState
from backend.domain.project.remote_models import RemoteProfile


@dataclass(frozen=True, slots=True)
class ProjectConfig:
    workspace_dir: Path
    generated_dir: Path


@dataclass(frozen=True, slots=True)
class CurrentProject:
    path: Path
    name: str


@dataclass(frozen=True, slots=True)
class ProjectState:
    current_project: CurrentProject | None
    remote_profile: RemoteProfile | None
    context_state: ProjectContextState | None = None
