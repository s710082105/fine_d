from datetime import UTC, datetime
from dataclasses import dataclass
from pathlib import Path

import pytest
import fine_remote.client as fine_remote_client_module

from backend.adapters.fine.remote_overview_gateway import FineRemoteOverviewGateway
from backend.adapters.fine.http_client import FineHttpClient
from backend.application.remote.use_cases import (
    ListRemoteDirectoriesUseCase,
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
        self.directory_calls: list[tuple[RemoteProfile, CurrentProject, str | None]] = []

    def load_overview(
        self,
        profile: RemoteProfile,
        current_project: CurrentProject,
    ) -> RemoteOverview:
        self.calls.append((profile, current_project))
        return RemoteOverview(
            directory_entries=[
                RemoteDirectoryEntry(
                    name="demo.cpt",
                    path="reportlets/demo.cpt",
                    is_directory=False,
                    lock=None,
                )
            ],
            data_connections=[ConnectionSummary(name="qzcs", database_type="MYSQL")],
            last_loaded_at=datetime(2026, 3, 25, 12, 0, tzinfo=UTC),
        )

    def test_connection(
        self,
        profile: RemoteProfile,
        current_project: CurrentProject,
    ) -> RemoteProfileTestResult:
        self.calls.append((profile, current_project))
        return RemoteProfileTestResult(status="ok", message="连接成功")

    def list_directories(
        self,
        profile: RemoteProfile,
        current_project: CurrentProject,
        path: str | None,
    ) -> list[RemoteDirectoryEntry]:
        self.directory_calls.append((profile, current_project, path))
        if path is None:
            return [
                RemoteDirectoryEntry(
                    name="reportlets",
                    path="/reportlets",
                    is_directory=True,
                    lock=None,
                )
            ]
        return [
            RemoteDirectoryEntry(
                name="demo.cpt",
                path="/reportlets/demo.cpt",
                is_directory=False,
                lock=None,
            )
        ]


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
            name="demo.cpt",
            path="reportlets/demo.cpt",
            is_directory=False,
            lock=None,
        )
    ]
    assert result.data_connections == [
        ConnectionSummary(
            name="qzcs",
            database_type="MYSQL",
        )
    ]
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


def test_list_remote_directories_returns_root_entries() -> None:
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
    use_case = ListRemoteDirectoriesUseCase(service, gateway)

    result = use_case.list_directories(path=None)

    assert result[0].path == "/reportlets"
    assert result[0].name == "reportlets"
    assert gateway.directory_calls == [
        (
            RemoteProfile(
                base_url="http://localhost:8075/webroot/decision",
                username="admin",
                password="admin",
            ),
            current_project,
            None,
        )
    ]


def test_list_remote_directories_returns_children_of_requested_path() -> None:
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
    use_case = ListRemoteDirectoriesUseCase(service, gateway)

    result = use_case.list_directories(path="/reportlets")

    assert result == [
        RemoteDirectoryEntry(
            name="demo.cpt",
            path="/reportlets/demo.cpt",
            is_directory=False,
            lock=None,
        )
    ]
    assert gateway.directory_calls == [
        (
            RemoteProfile(
                base_url="http://localhost:8075/webroot/decision",
                username="admin",
                password="admin",
            ),
            current_project,
            "/reportlets",
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


def test_remote_overview_gateway_wraps_directory_client_build_errors() -> None:
    gateway = FineRemoteOverviewGateway()
    profile = RemoteProfile(
        base_url="http://localhost:8075/webroot/decision",
        username="admin",
        password="admin",
    )
    current_project = CurrentProject(path=Path("/tmp/project"), name="project")

    def raise_runtime_error(
        _profile: RemoteProfile,
        _current_project: CurrentProject,
    ) -> object:
        raise RuntimeError("boom-client")

    gateway._build_remote_client = raise_runtime_error  # type: ignore[method-assign]

    with pytest.raises(AppError) as error_info:
        gateway._list_directory_entries(profile, current_project)

    assert error_info.value.code == "remote.request_failed"
    assert error_info.value.message == "远程请求失败"
    assert error_info.value.detail == {
        "operation": "directory_entries",
        "reason": "boom-client",
    }
    assert error_info.value.source == "remote"
    assert error_info.value.retryable is True


def test_remote_overview_gateway_preserves_existing_app_error_from_directory_client_build() -> None:
    gateway = FineRemoteOverviewGateway()
    profile = RemoteProfile(
        base_url="http://localhost:8075/webroot/decision",
        username="admin",
        password="admin",
    )
    current_project = CurrentProject(path=Path("/tmp/project"), name="project")
    expected_error = AppError(
        code="remote.invalid_profile",
        message="远程参数不合法",
        detail={"field": "base_url"},
        source="remote",
    )

    def raise_app_error(
        _profile: RemoteProfile,
        _current_project: CurrentProject,
    ) -> object:
        raise expected_error

    gateway._build_remote_client = raise_app_error  # type: ignore[method-assign]

    with pytest.raises(AppError) as error_info:
        gateway._list_directory_entries(profile, current_project)

    assert error_info.value is expected_error


def test_remote_overview_gateway_wraps_data_connection_errors(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    profile = RemoteProfile(
        base_url="http://localhost:8075/webroot/decision",
        username="admin",
        password="admin",
    )

    def raise_runtime_error(self: FineHttpClient) -> list[ConnectionSummary]:
        raise RuntimeError("boom-connections")

    monkeypatch.setattr(
        FineHttpClient,
        "list_connections",
        raise_runtime_error,
    )

    with pytest.raises(AppError) as error_info:
        FineRemoteOverviewGateway._list_data_connections(profile)

    assert error_info.value.code == "remote.request_failed"
    assert error_info.value.message == "远程请求失败"
    assert error_info.value.detail == {
        "operation": "data_connections",
        "reason": "boom-connections",
    }
    assert error_info.value.source == "remote"
    assert error_info.value.retryable is True


def test_remote_overview_gateway_uses_explicit_fine_runtime(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    fine_home = tmp_path / "FineReport"
    (fine_home / "lib").mkdir(parents=True)
    (fine_home / "lib" / "core.jar").write_text("", encoding="utf-8")
    current_project = CurrentProject(path=tmp_path / "project", name="project")
    current_project.path.mkdir()
    profile = RemoteProfile(
        base_url="http://localhost:8075/webroot/decision",
        username="admin",
        password="admin",
    )
    captured: dict[str, object] = {}

    class FakeFineRemoteClient:
        def __init__(self, **kwargs: object) -> None:
            captured.update(kwargs)

        def list_files(self, path: str) -> list[object]:
            assert path == "reportlets"
            return []

    monkeypatch.setattr(
        fine_remote_client_module,
        "FineRemoteClient",
        FakeFineRemoteClient,
    )
    gateway = FineRemoteOverviewGateway(fine_home=fine_home)

    result = gateway._list_directory_entries(profile, current_project)

    assert result == []
    assert captured["fine_home"] == fine_home.resolve()
    assert captured["fine_home"] != current_project.path


def test_remote_overview_gateway_rejects_missing_runtime_configuration(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    monkeypatch.delenv("FINE_REMOTE_HOME", raising=False)
    gateway = FineRemoteOverviewGateway()
    profile = RemoteProfile(
        base_url="http://localhost:8075/webroot/decision",
        username="admin",
        password="admin",
    )
    current_project = CurrentProject(path=tmp_path / "project", name="project")
    current_project.path.mkdir()

    with pytest.raises(AppError) as error_info:
        gateway._list_directory_entries(profile, current_project)

    assert error_info.value.code == "remote.runtime_missing"
    assert error_info.value.detail == {"env": "FINE_REMOTE_HOME"}


def test_remote_overview_gateway_rejects_invalid_runtime_directory(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    invalid_runtime = tmp_path / "project-runtime"
    invalid_runtime.mkdir()
    monkeypatch.setenv("FINE_REMOTE_HOME", str(invalid_runtime))
    gateway = FineRemoteOverviewGateway()
    profile = RemoteProfile(
        base_url="http://localhost:8075/webroot/decision",
        username="admin",
        password="admin",
    )
    current_project = CurrentProject(path=tmp_path / "project", name="project")
    current_project.path.mkdir()

    with pytest.raises(AppError) as error_info:
        gateway._list_directory_entries(profile, current_project)

    assert error_info.value.code == "remote.runtime_invalid"
    assert error_info.value.detail == {
        "path": str(invalid_runtime.resolve()),
        "project_path": str(current_project.path),
    }


def test_remote_overview_gateway_lists_root_directory_from_configured_root(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    fine_home = tmp_path / "FineReport"
    (fine_home / "lib").mkdir(parents=True)
    (fine_home / "lib" / "core.jar").write_text("", encoding="utf-8")
    current_project = CurrentProject(path=tmp_path / "project", name="project")
    current_project.path.mkdir()
    profile = RemoteProfile(
        base_url="http://localhost:8075/webroot/decision",
        username="admin",
        password="admin",
    )
    requested_paths: list[str] = []

    @dataclass(frozen=True)
    class FakeRemoteFileEntry:
        path: str
        is_directory: bool
        lock: str | None

    class FakeFineRemoteClient:
        def __init__(self, **_: object) -> None:
            return None

        def list_files(self, path: str) -> list[FakeRemoteFileEntry]:
            requested_paths.append(path)
            return [
                FakeRemoteFileEntry(
                    path="reportlets/demo.cpt",
                    is_directory=False,
                    lock=None,
                )
            ]

    monkeypatch.setattr(
        fine_remote_client_module,
        "FineRemoteClient",
        FakeFineRemoteClient,
    )
    gateway = FineRemoteOverviewGateway(fine_home=fine_home)

    result = gateway._list_directory_entries(profile, current_project, None)

    assert requested_paths == ["reportlets"]
    assert result == [
        RemoteDirectoryEntry(
            name="demo.cpt",
            path="/reportlets/demo.cpt",
            is_directory=False,
            lock=None,
        )
    ]


def test_remote_overview_gateway_lists_children_within_configured_root(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    fine_home = tmp_path / "FineReport"
    (fine_home / "lib").mkdir(parents=True)
    (fine_home / "lib" / "core.jar").write_text("", encoding="utf-8")
    current_project = CurrentProject(path=tmp_path / "project", name="project")
    current_project.path.mkdir()
    profile = RemoteProfile(
        base_url="http://localhost:8075/webroot/decision",
        username="admin",
        password="admin",
    )
    requested_paths: list[str] = []

    @dataclass(frozen=True)
    class FakeRemoteFileEntry:
        path: str
        is_directory: bool
        lock: str | None

    class FakeFineRemoteClient:
        def __init__(self, **_: object) -> None:
            return None

        def list_files(self, path: str) -> list[FakeRemoteFileEntry]:
            requested_paths.append(path)
            return [
                FakeRemoteFileEntry(
                    path="reportlets/folder",
                    is_directory=True,
                    lock="alice",
                )
            ]

    monkeypatch.setattr(
        fine_remote_client_module,
        "FineRemoteClient",
        FakeFineRemoteClient,
    )
    gateway = FineRemoteOverviewGateway(fine_home=fine_home)

    result = gateway._list_directory_entries(
        profile,
        current_project,
        "/reportlets/nested",
    )

    assert requested_paths == ["reportlets/nested"]
    assert result == [
        RemoteDirectoryEntry(
            name="folder",
            path="/reportlets/folder",
            is_directory=True,
            lock="alice",
        )
    ]


@pytest.mark.parametrize(
    "path",
    [
        "/other",
        "/reportlets/../secret",
    ],
)
def test_remote_overview_gateway_rejects_paths_outside_configured_root(
    path: str,
    tmp_path: Path,
) -> None:
    fine_home = tmp_path / "FineReport"
    (fine_home / "lib").mkdir(parents=True)
    (fine_home / "lib" / "core.jar").write_text("", encoding="utf-8")
    current_project = CurrentProject(path=tmp_path / "project", name="project")
    current_project.path.mkdir()
    profile = RemoteProfile(
        base_url="http://localhost:8075/webroot/decision",
        username="admin",
        password="admin",
    )
    gateway = FineRemoteOverviewGateway(fine_home=fine_home)

    with pytest.raises(AppError) as error_info:
        gateway._list_directory_entries(profile, current_project, path)

    assert error_info.value.code == "remote.invalid_path"
    assert error_info.value.message == "远程目录路径不合法"
    assert error_info.value.detail == {
        "path": path,
        "root": "/reportlets",
    }
    assert error_info.value.source == "remote"
