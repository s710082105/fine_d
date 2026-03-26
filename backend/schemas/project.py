from datetime import datetime
from pathlib import Path

from pydantic import BaseModel, ConfigDict

from backend.domain.project.context_models import (
    ProjectContextSnapshot,
    ProjectContextState,
)
from backend.domain.project.models import CurrentProject, ProjectConfig, ProjectState
from backend.domain.project.remote_models import RemoteProfile


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


class ProjectSelectRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    path: str


class RemoteProfileRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    base_url: str
    username: str
    password: str
    designer_root: str = ""


class ProjectContextGenerateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    force: bool


class CurrentProjectResponse(BaseModel):
    model_config = ConfigDict(frozen=True)

    path: Path
    name: str

    @classmethod
    def from_domain(cls, project: CurrentProject) -> "CurrentProjectResponse":
        return cls(path=project.path, name=project.name)


class RemoteProfileResponse(BaseModel):
    model_config = ConfigDict(frozen=True)

    base_url: str
    username: str
    password: str
    designer_root: str

    @classmethod
    def from_domain(cls, profile: RemoteProfile) -> "RemoteProfileResponse":
        return cls(
            base_url=profile.base_url,
            username=profile.username,
            password=profile.password,
            designer_root=profile.designer_root,
        )


class ProjectContextStateResponse(BaseModel):
    model_config = ConfigDict(frozen=True)

    generated_at: datetime
    agents_status: str

    @classmethod
    def from_domain(
        cls,
        context_state: ProjectContextState,
    ) -> "ProjectContextStateResponse":
        return cls(
            generated_at=context_state.generated_at,
            agents_status=context_state.agents_status,
        )


class ProjectCurrentResponse(BaseModel):
    model_config = ConfigDict(frozen=True)

    current_project: CurrentProjectResponse | None
    remote_profile: RemoteProfileResponse | None
    context_state: ProjectContextStateResponse | None

    @classmethod
    def from_domain(cls, state: ProjectState) -> "ProjectCurrentResponse":
        return cls(
            current_project=None
            if state.current_project is None
            else CurrentProjectResponse.from_domain(state.current_project),
            remote_profile=None
            if state.remote_profile is None
            else RemoteProfileResponse.from_domain(state.remote_profile),
            context_state=None
            if state.context_state is None
            else ProjectContextStateResponse.from_domain(state.context_state),
        )


class ProjectRemoteProfileResponse(BaseModel):
    model_config = ConfigDict(frozen=True)

    remote_profile: RemoteProfileResponse

    @classmethod
    def from_domain(cls, profile: RemoteProfile) -> "ProjectRemoteProfileResponse":
        return cls(remote_profile=RemoteProfileResponse.from_domain(profile))


class ProjectContextResponse(BaseModel):
    model_config = ConfigDict(frozen=True)

    project_root: Path
    generated_at: datetime
    agents_status: str
    managed_files: tuple[str, ...]

    @classmethod
    def from_domain(
        cls,
        snapshot: ProjectContextSnapshot,
    ) -> "ProjectContextResponse":
        return cls(
            project_root=snapshot.project_root,
            generated_at=snapshot.generated_at,
            agents_status=snapshot.agents_status,
            managed_files=snapshot.managed_files,
        )
