from typing import Protocol

from backend.domain.project.errors import (
    current_project_required_error,
    invalid_remote_profile_error,
)
from backend.domain.project.models import CurrentProject, ProjectState
from backend.domain.project.remote_models import RemoteProfile
from backend.domain.remote.models import (
    RemoteDirectoryEntry,
    RemoteOverview,
    RemoteProfileTestResult,
)


class ProjectStateReader(Protocol):
    def get_current(self) -> ProjectState:
        ...


class RemoteOverviewGateway(Protocol):
    def load_overview(
        self,
        profile: RemoteProfile,
        current_project: CurrentProject,
    ) -> RemoteOverview:
        ...

    def test_connection(
        self,
        profile: RemoteProfile,
        current_project: CurrentProject,
    ) -> RemoteProfileTestResult:
        ...

    def list_directories(
        self,
        profile: RemoteProfile,
        current_project: CurrentProject,
        path: str | None,
    ) -> list[RemoteDirectoryEntry]:
        ...


class TestRemoteProfileUseCase:
    __test__ = False

    def __init__(
        self,
        project_state_reader: ProjectStateReader,
        gateway: RemoteOverviewGateway,
    ) -> None:
        self._project_state_reader = project_state_reader
        self._gateway = gateway

    def execute(
        self,
        *,
        base_url: str,
        username: str,
        password: str,
    ) -> RemoteProfileTestResult:
        current_project = _require_current_project(
            self._project_state_reader.get_current(),
        )
        profile = _build_remote_profile(
            base_url=base_url,
            username=username,
            password=password,
        )
        return self._gateway.test_connection(profile, current_project)

    def test(
        self,
        *,
        base_url: str,
        username: str,
        password: str,
    ) -> RemoteProfileTestResult:
        return self.execute(
            base_url=base_url,
            username=username,
            password=password,
        )


class LoadRemoteOverviewUseCase:
    def __init__(
        self,
        project_state_reader: ProjectStateReader,
        gateway: RemoteOverviewGateway,
    ) -> None:
        self._project_state_reader = project_state_reader
        self._gateway = gateway

    def execute(self) -> RemoteOverview:
        state = self._project_state_reader.get_current()
        current_project = _require_current_project(state)
        profile = _require_remote_profile(state.remote_profile)
        return self._gateway.load_overview(profile, current_project)

    def load(self) -> RemoteOverview:
        return self.execute()


class ListRemoteDirectoriesUseCase:
    def __init__(
        self,
        project_state_reader: ProjectStateReader,
        gateway: RemoteOverviewGateway,
    ) -> None:
        self._project_state_reader = project_state_reader
        self._gateway = gateway

    def execute(self, *, path: str | None) -> list[RemoteDirectoryEntry]:
        state = self._project_state_reader.get_current()
        current_project = _require_current_project(state)
        profile = _require_remote_profile(state.remote_profile)
        return self._gateway.list_directories(profile, current_project, path)

    def list_directories(self, *, path: str | None) -> list[RemoteDirectoryEntry]:
        return self.execute(path=path)


def _build_remote_profile(
    *,
    base_url: str,
    username: str,
    password: str,
) -> RemoteProfile:
    return _require_remote_profile(
        RemoteProfile(
            base_url=base_url,
            username=username,
            password=password,
        )
    )


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
    return profile
