from pathlib import Path

from pydantic import BaseModel, ConfigDict

from backend.domain.project.models import ProjectConfig


class ProjectConfigResponse(BaseModel):
    model_config = ConfigDict(frozen=True)

    workspace_dir: Path
    generated_dir: Path

    @classmethod
    def from_domain(cls, config: ProjectConfig) -> "ProjectConfigResponse":
        return cls(
            workspace_dir=config.workspace_dir,
            generated_dir=config.generated_dir,
        )
