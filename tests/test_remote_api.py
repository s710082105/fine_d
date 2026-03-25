import json
from datetime import UTC, datetime
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from apps.api.routes import project as project_routes
from apps.api.routes import remote as remote_routes
from backend.app_factory import create_app
from backend.domain.datasource.models import ConnectionSummary
from backend.domain.project.errors import AppError
from backend.domain.remote.models import (
    RemoteDirectoryEntry,
    RemoteOverview,
    RemoteProfileTestResult,
)
from backend.infra.project_store import STATE_DIR_NAME, STATE_FILE_NAME


class FakeRemoteOverviewService:
    def load(self) -> RemoteOverview:
        return RemoteOverview(
            directory_entries=[
                RemoteDirectoryEntry(
                    path="reportlets",
                    is_directory=True,
                    lock=None,
                )
            ],
            data_connections=[ConnectionSummary(name="qzcs")],
            last_loaded_at=datetime(2026, 3, 25, 12, 0, tzinfo=UTC),
        )


class FakeRemoteProfileTestService:
    def test(
        self,
        *,
        base_url: str,
        username: str,
        password: str,
    ) -> RemoteProfileTestResult:
        assert base_url == "http://localhost:8075/webroot/decision"
        assert username == "admin"
        assert password == "admin"
        return RemoteProfileTestResult(status="ok", message="连接成功")


class FailingRemoteOverviewService:
    def load(self) -> RemoteOverview:
        raise AppError(
            code="project.remote_profile_invalid",
            message="远程参数不合法",
            detail={"field": "remote_profile"},
            source="project",
        )


def test_remote_overview_endpoint_returns_directory_connections_and_timestamp() -> None:
    app = create_app()
    app.dependency_overrides[remote_routes.get_remote_overview_service] = (
        lambda: FakeRemoteOverviewService()
    )
    client = TestClient(app)

    response = client.get("/api/remote/overview")

    assert response.status_code == 200
    assert response.json() == {
        "directory_entries": [
            {
                "path": "reportlets",
                "is_directory": True,
                "lock": None,
            }
        ],
        "data_connections": [{"name": "qzcs"}],
        "last_loaded_at": "2026-03-25T12:00:00Z",
    }


def test_project_remote_profile_test_endpoint_returns_status_and_message() -> None:
    app = create_app()
    app.dependency_overrides[remote_routes.get_project_remote_test_service] = (
        lambda: FakeRemoteProfileTestService()
    )
    client = TestClient(app)

    response = client.post(
        "/api/project/remote-profile/test",
        json={
            "base_url": "http://localhost:8075/webroot/decision",
            "username": "admin",
            "password": "admin",
        },
    )

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "message": "连接成功",
    }


def test_remote_overview_endpoint_uses_unified_app_error_response() -> None:
    app = create_app()
    app.dependency_overrides[remote_routes.get_remote_overview_service] = (
        lambda: FailingRemoteOverviewService()
    )
    client = TestClient(app)

    response = client.get("/api/remote/overview")

    assert response.status_code == 400
    assert response.json() == {
        "code": "project.remote_profile_invalid",
        "message": "远程参数不合法",
        "detail": {"field": "remote_profile"},
        "source": "project",
        "retryable": False,
    }


def test_remote_profile_test_route_is_registered_on_remote_router_only() -> None:
    remote_route_paths = {
        (route.path, tuple(sorted(route.methods or set())))
        for route in remote_routes.router.routes
    }
    project_route_paths = {
        (route.path, tuple(sorted(route.methods or set())))
        for route in project_routes.router.routes
    }

    assert (
        "/api/project/remote-profile/test",
        ("POST",),
    ) in remote_route_paths
    assert (
        "/api/project/remote-profile/test",
        ("POST",),
    ) not in project_route_paths


def test_remote_overview_endpoint_rejects_missing_runtime_configuration(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    project_dir = tmp_path / "project-alpha"
    project_dir.mkdir()
    state_file = tmp_path / STATE_DIR_NAME / STATE_FILE_NAME
    state_file.parent.mkdir(parents=True, exist_ok=True)
    state_file.write_text(
        json.dumps(
            {
                "current_project": {
                    "path": str(project_dir),
                    "name": "project-alpha",
                },
                "remote_profiles": {
                    str(project_dir): {
                        "base_url": "http://localhost:8075/webroot/decision",
                        "username": "admin",
                        "password": "admin",
                    }
                },
            }
        ),
        encoding="utf-8",
    )
    monkeypatch.chdir(tmp_path)
    monkeypatch.delenv("FINE_REMOTE_HOME", raising=False)
    client = TestClient(create_app())

    response = client.get("/api/remote/overview")

    assert response.status_code == 400
    assert response.json() == {
        "code": "remote.runtime_missing",
        "message": "缺少 FineReport 运行时目录配置",
        "detail": {"env": "FINE_REMOTE_HOME"},
        "source": "remote",
        "retryable": False,
    }
