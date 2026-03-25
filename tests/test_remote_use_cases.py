from datetime import UTC, datetime
from pathlib import Path

import pytest

from backend.application.remote.use_cases import (
    LoadRemoteOverviewUseCase,
    TestRemoteProfileUseCase,
)
from backend.domain.datasource.models import ConnectionSummary
from backend.domain.project.errors import AppError
from backend.domain.project.models import CurrentProject, ProjectState
from backend.domain.project.remote_models import RemoteProfile
from backend.domain.remote.models import (
    RemoteDirectoryEntry,
    RemoteOverview,
    RemoteProfileTestResult,
)


class FakeRemoteGateway:
    def __init__(self) -> None:
        self.calls: list[tuple[RemoteProfile, CurrentProject | None]] = []

    def load_overview(
        self,
        profile: RemoteProfile,
        current_project: CurrentProject,
    ) -> RemoteOverview:
        self.calls.append((profile, current_project))
        return RemoteOverview(
            directory_entries=[
                RemoteDirectoryEntry(
                    path="reportlets/demo.cpt",
                    is_directory=False,
                    lock=None,
                )
            ],
            data_connections=[ConnectionSummary(name="qzcs")],
            last_loaded_at=datetime(2026, 3, 25, 12, 0, tzinfo=UTC),
        )

    def test_connection(
        self,
        profile: RemoteProfile,
        current_project: CurrentProject,
    ) -> RemoteProfileTestResult:
        self.calls.append((profile, current_project))
        return RemoteProfileTestResult(status="ok", message="连接成功")


class FakeProjectConfigService:
    def __init__(self, state: ProjectState) -> None:
        self._state = state

    def get_current(self) -> ProjectState:
        return self._state


def test_test_remote_profile_use_case_reuses_single_profile_for_connection_check() -> None:
    gateway = FakeRemoteGateway()
    current_project = CurrentProject(path=Path("/tmp/project"), name="project")
    service = FakeProjectConfigService(
        ProjectState(
            current_project=current_project,
            remote_profile=None,
        )
    )
    use_case = TestRemoteProfileUseCase(service, gateway)

    result = use_case.execute(
        base_url="http://localhost:8075/webroot/decision",
        username="admin",
        password="admin",
    )

    assert result == RemoteProfileTestResult(status="ok", message="连接成功")
    assert gateway.calls == [
        (
            RemoteProfile(
                base_url="http://localhost:8075/webroot/decision",
                username="admin",
                password="admin",
            ),
            current_project,
        )
    ]


def test_load_remote_overview_use_case_returns_directory_and_connections() -> None:
    gateway = FakeRemoteGateway()
    current_project = CurrentProject(path=Path("/tmp/project"), name="project")
    service = FakeProjectConfigService(
        ProjectState(
            current_project=current_project,
            remote_profile=RemoteProfile(
                base_url="http://localhost:8075/webroot/decision",
                username="admin",
                password="admin",
            ),
        )
    )
    use_case = LoadRemoteOverviewUseCase(service, gateway)

    result = use_case.execute()

    assert result.directory_entries == [
        RemoteDirectoryEntry(
            path="reportlets/demo.cpt",
            is_directory=False,
            lock=None,
        )
    ]
    assert result.data_connections == [ConnectionSummary(name="qzcs")]
    assert result.last_loaded_at == datetime(2026, 3, 25, 12, 0, tzinfo=UTC)
    assert gateway.calls == [
        (
            RemoteProfile(
                base_url="http://localhost:8075/webroot/decision",
                username="admin",
                password="admin",
            ),
            current_project,
        )
    ]


@pytest.mark.parametrize(
    ("remote_profile", "field"),
    [
        (None, "remote_profile"),
        (
            RemoteProfile(
                base_url="",
                username="admin",
                password="admin",
            ),
            "base_url",
        ),
        (
            RemoteProfile(
                base_url="http://localhost:8075/webroot/decision",
                username="",
                password="admin",
            ),
            "username",
        ),
        (
            RemoteProfile(
                base_url="http://localhost:8075/webroot/decision",
                username="admin",
                password="",
            ),
            "password",
        ),
    ],
)
def test_load_remote_overview_use_case_rejects_incomplete_remote_profile(
    remote_profile: RemoteProfile | None,
    field: str,
) -> None:
    gateway = FakeRemoteGateway()
    service = FakeProjectConfigService(
        ProjectState(
            current_project=CurrentProject(
                path=Path("/tmp/project"),
                name="project",
            ),
            remote_profile=remote_profile,
        )
    )
    use_case = LoadRemoteOverviewUseCase(service, gateway)

    with pytest.raises(AppError) as error_info:
        use_case.execute()

    assert error_info.value.code == "project.remote_profile_invalid"
    assert error_info.value.detail == {"field": field}
    assert gateway.calls == []


def test_load_remote_overview_use_case_rejects_missing_current_project() -> None:
    gateway = FakeRemoteGateway()
    service = FakeProjectConfigService(
        ProjectState(
            current_project=None,
            remote_profile=RemoteProfile(
                base_url="http://localhost:8075/webroot/decision",
                username="admin",
                password="admin",
            ),
        )
    )
    use_case = LoadRemoteOverviewUseCase(service, gateway)

    with pytest.raises(AppError) as error_info:
        use_case.execute()

    assert error_info.value.code == "project.current_required"
    assert gateway.calls == []


def test_test_remote_profile_use_case_rejects_missing_current_project() -> None:
    gateway = FakeRemoteGateway()
    service = FakeProjectConfigService(
        ProjectState(
            current_project=None,
            remote_profile=None,
        )
    )
    use_case = TestRemoteProfileUseCase(service, gateway)

    with pytest.raises(AppError) as error_info:
        use_case.execute(
            base_url="http://localhost:8075/webroot/decision",
            username="admin",
            password="admin",
        )

    assert error_info.value.code == "project.current_required"
    assert gateway.calls == []
