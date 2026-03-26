from pathlib import Path
from urllib.parse import urlparse

from backend.domain.project.context_models import ProjectContextState
from backend.domain.project.errors import (
    AppError,
    current_project_required_error,
    invalid_current_project_error,
    invalid_project_path_error,
    invalid_remote_profile_error,
)
from backend.domain.project.models import CurrentProject, ProjectConfig, ProjectState
from backend.domain.project.remote_models import RemoteProfile
from backend.infra.project_store import ProjectStore

DEFAULT_WORKSPACE_DIR_NAME = "workspace"
DEFAULT_GENERATED_DIR_NAME = "generated"


class ProjectConfigService:
    def __init__(
        self,
        base_dir: Path,
        workspace_dir_name: str = DEFAULT_WORKSPACE_DIR_NAME,
        generated_dir_name: str = DEFAULT_GENERATED_DIR_NAME,
        project_store: ProjectStore | None = None,
    ) -> None:
        self._base_dir = Path(base_dir)
        self._workspace_dir_name = workspace_dir_name
        self._generated_dir_name = generated_dir_name
        self._project_store = project_store or ProjectStore(base_dir=self._base_dir)

    def load_or_create(self) -> ProjectConfig:
        config = self.load()
        self._ensure_directories(config)
        return config

    def load(self) -> ProjectConfig:
        return ProjectConfig(
            workspace_dir=self._base_dir / self._workspace_dir_name,
            generated_dir=self._base_dir / self._generated_dir_name,
        )

    def get_current(self) -> ProjectState:
        current_project = self._load_current_project(required=False)
        if current_project is None:
            return ProjectState(
                current_project=None,
                remote_profile=None,
                context_state=None,
            )
        return self._build_project_state(current_project)

    def select_project(self, path: Path) -> ProjectState:
        project_path = self._validate_project_path(path)
        current_project = CurrentProject(
            path=project_path,
            name=project_path.name,
        )
        self._project_store.save_current_project(current_project)
        return self._build_project_state(current_project)

    def update_remote_profile(
        self,
        base_url: str,
        username: str,
        password: str,
        designer_root: str,
    ) -> RemoteProfile:
        current_project = self._load_current_project(required=True)
        profile = RemoteProfile(
            base_url=self._validate_base_url(base_url),
            username=self._validate_non_empty(username, "username"),
            password=self._validate_non_empty(password, "password"),
            designer_root=self._validate_non_empty(designer_root, "designer_root"),
        )
        self._project_store.save_remote_profile(current_project.path, profile)
        return profile

    @staticmethod
    def _ensure_directories(config: ProjectConfig) -> None:
        config.workspace_dir.mkdir(parents=True, exist_ok=True)
        config.generated_dir.mkdir(parents=True, exist_ok=True)

    def _validate_project_path(self, path: Path) -> Path:
        project_path = Path(path).expanduser().resolve()
        if not project_path.exists() or not project_path.is_dir():
            raise invalid_project_path_error(str(Path(path)))
        return project_path

    def _validate_base_url(self, base_url: str) -> str:
        parsed = urlparse(base_url)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            raise invalid_remote_profile_error("base_url")
        return base_url

    @staticmethod
    def _validate_non_empty(value: str, field: str) -> str:
        if value == "":
            raise invalid_remote_profile_error(field)
        return value

    def _load_current_project(self, required: bool) -> CurrentProject | None:
        current_project = self._project_store.load_current_project()
        if current_project is None:
            if required:
                raise current_project_required_error()
            return None
        if not current_project.path.exists() or not current_project.path.is_dir():
            raise invalid_current_project_error(str(current_project.path))
        return current_project

    def _load_context_state(self, project_path: Path) -> ProjectContextState | None:
        try:
            return self._project_store.load_context_state(project_path)
        except AppError as error:
            field = None if error.detail is None else error.detail.get("field")
            if (
                error.code == "project.state_invalid"
                and isinstance(field, str)
                and field.startswith("context_states.")
            ):
                return None
            raise

    def _build_project_state(self, current_project: CurrentProject) -> ProjectState:
        return ProjectState(
            current_project=current_project,
            remote_profile=self._project_store.load_remote_profile(
                current_project.path,
            ),
            context_state=self._load_context_state(current_project.path),
        )
