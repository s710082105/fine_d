from pathlib import Path

from pydantic import BaseModel, ConfigDict

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

    @classmethod
    def from_domain(cls, profile: RemoteProfile) -> "RemoteProfileResponse":
        return cls(
            base_url=profile.base_url,
            username=profile.username,
            password=profile.password,
        )


class ProjectCurrentResponse(BaseModel):
    model_config = ConfigDict(frozen=True)

    current_project: CurrentProjectResponse | None
    remote_profile: RemoteProfileResponse | None

    @classmethod
    def from_domain(cls, state: ProjectState) -> "ProjectCurrentResponse":
        return cls(
            current_project=None
            if state.current_project is None
            else CurrentProjectResponse.from_domain(state.current_project),
            remote_profile=None
            if state.remote_profile is None
            else RemoteProfileResponse.from_domain(state.remote_profile),
        )


class ProjectRemoteProfileResponse(BaseModel):
    model_config = ConfigDict(frozen=True)

    remote_profile: RemoteProfileResponse

    @classmethod
    def from_domain(cls, profile: RemoteProfile) -> "ProjectRemoteProfileResponse":
        return cls(remote_profile=RemoteProfileResponse.from_domain(profile))
