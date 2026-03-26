from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Literal

AgentsStatus = Literal["created", "kept", "updated"]
AGENTS_STATUS_VALUES: tuple[AgentsStatus, ...] = ("created", "kept", "updated")


@dataclass(frozen=True, slots=True)
class ProjectContextSnapshot:
    project_root: Path
    generated_at: datetime
    agents_status: AgentsStatus
    managed_files: tuple[str, ...]


@dataclass(frozen=True, slots=True)
class ProjectContextState:
    generated_at: datetime
    agents_status: AgentsStatus
