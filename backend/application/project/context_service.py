from datetime import UTC, datetime
from pathlib import Path

from backend.application.project.context_templates import (
    MANAGED_SKILLS,
    build_skill_documents,
    render_agents_markdown,
    render_project_context_markdown,
    render_project_rules_markdown,
)
from backend.application.remote.use_cases import (
    ProjectStateReader,
    RemoteOverviewGateway,
)
from backend.domain.project.context_models import (
    ProjectContextSnapshot,
    ProjectContextState,
)
from backend.domain.project.errors import (
    current_project_required_error,
    invalid_remote_profile_error,
    project_context_write_failed_error,
)
from backend.domain.project.models import CurrentProject, ProjectState
from backend.domain.project.remote_models import RemoteProfile
from backend.domain.remote.models import RemoteOverview
from backend.infra.project_store import ProjectStore


class ProjectContextService:
    def __init__(
        self,
        project_state_reader: ProjectStateReader,
        project_store: ProjectStore,
        remote_gateway: RemoteOverviewGateway,
    ) -> None:
        self._project_state_reader = project_state_reader
        self._project_store = project_store
        self._remote_gateway = remote_gateway

    def generate(self, *, force: bool) -> ProjectContextSnapshot:
        state = self._project_state_reader.get_current()
        current_project = _require_current_project(state)
        profile = _require_remote_profile(state.remote_profile)
        overview = self._remote_gateway.load_overview(profile, current_project)
        generated_at = datetime.now(tz=UTC)
        codex_files = self._write_codex_files(current_project, profile, overview)
        agents_status = self._write_agents_file(
            current_project,
            profile,
            overview,
            force=force,
        )
        managed_files = ("AGENTS.md", *codex_files)
        snapshot = ProjectContextSnapshot(
            project_root=current_project.path,
            generated_at=generated_at,
            agents_status=agents_status,
            managed_files=managed_files,
        )
        self._project_store.save_context_state(
            current_project.path,
            ProjectContextState(
                generated_at=generated_at,
                agents_status=agents_status,
            ),
        )
        return snapshot

    def _write_agents_file(
        self,
        project: CurrentProject,
        profile: RemoteProfile,
        overview: RemoteOverview,
        *,
        force: bool,
    ) -> str:
        agents_file = project.path / "AGENTS.md"
        if agents_file.exists() and not force:
            return "kept"
        content = render_agents_markdown(project, profile, overview)
        status = "updated" if agents_file.exists() else "created"
        self._write_text_file(agents_file, content)
        return status

    def _write_codex_files(
        self,
        project: CurrentProject,
        profile: RemoteProfile,
        overview: RemoteOverview,
    ) -> tuple[str, ...]:
        documents = {
            ".codex/project-context.md": render_project_context_markdown(
                project,
                profile,
                overview,
            ),
            ".codex/project-rules.md": render_project_rules_markdown(
                project,
                overview,
            ),
            **build_skill_documents(project),
        }
        for relative_path, content in documents.items():
            self._write_text_file(project.path / relative_path, content)
        skill_paths = tuple(
            f".codex/skills/{skill_name}/SKILL.md" for skill_name in MANAGED_SKILLS
        )
        return (".codex/project-context.md", ".codex/project-rules.md", *skill_paths)

    @staticmethod
    def _write_text_file(path: Path, content: str) -> None:
        try:
            path.parent.mkdir(parents=True, exist_ok=True)
            if path.exists() and path.read_text(encoding="utf-8") == content:
                return
            path.write_text(content, encoding="utf-8")
        except OSError as error:
            raise project_context_write_failed_error(str(path), str(error)) from error


def _require_current_project(state: ProjectState) -> CurrentProject:
    if state.current_project is None:
        raise current_project_required_error()
    return state.current_project


def _require_remote_profile(profile: RemoteProfile | None) -> RemoteProfile:
    if profile is None:
        raise invalid_remote_profile_error("remote_profile")
    if profile.base_url == "":
        raise invalid_remote_profile_error("base_url")
    if profile.username == "":
        raise invalid_remote_profile_error("username")
    if profile.password == "":
        raise invalid_remote_profile_error("password")
    if profile.designer_root == "":
        raise invalid_remote_profile_error("designer_root")
    return profile
