from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True, slots=True)
class ProjectConfig:
    workspace_dir: Path
    generated_dir: Path
