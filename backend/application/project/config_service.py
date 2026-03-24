from pathlib import Path

from backend.domain.project.models import ProjectConfig

DEFAULT_WORKSPACE_DIR_NAME = "workspace"
DEFAULT_GENERATED_DIR_NAME = "generated"

class ProjectConfigService:
    def __init__(
        self,
        base_dir: Path,
        workspace_dir_name: str = DEFAULT_WORKSPACE_DIR_NAME,
        generated_dir_name: str = DEFAULT_GENERATED_DIR_NAME,
    ) -> None:
        self._base_dir = Path(base_dir)
        self._workspace_dir_name = workspace_dir_name
        self._generated_dir_name = generated_dir_name

    def load_or_create(self) -> ProjectConfig:
        config = ProjectConfig(
            workspace_dir=self._base_dir / self._workspace_dir_name,
            generated_dir=self._base_dir / self._generated_dir_name,
        )
        self._ensure_directories(config)
        return config

    @staticmethod
    def _ensure_directories(config: ProjectConfig) -> None:
        config.workspace_dir.mkdir(parents=True, exist_ok=True)
        config.generated_dir.mkdir(parents=True, exist_ok=True)
