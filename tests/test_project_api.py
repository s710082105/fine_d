import importlib
import json
import json
from datetime import UTC, datetime
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from backend.application.project.config_service import ProjectConfigService
from backend.application.project.context_service import ProjectContextService
from backend.app_factory import create_app
from backend.domain.datasource.models import ConnectionSummary
from backend.domain.project.models import CurrentProject
from backend.domain.project.remote_models import RemoteProfile
from backend.domain.remote.models import RemoteDirectoryEntry, RemoteOverview
from backend.infra.project_store import STATE_DIR_NAME, STATE_FILE_NAME
from backend.infra.project_store import ProjectStore


@pytest.fixture
def project_client(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> TestClient:
    return _build_project_context_client(tmp_path, monkeypatch)


def _load_project_route_module():
    return importlib.import_module("apps.api.routes.project")


class FakeRemoteOverviewGateway:
    def load_overview(
        self,
        profile: RemoteProfile,
        current_project: CurrentProject,
    ) -> RemoteOverview:
        return RemoteOverview(
            directory_entries=[
                RemoteDirectoryEntry(
                    name="demo.cpt",
                    path="/reportlets/demo.cpt",
                    is_directory=False,
                    lock=None,
                )
            ],
            data_connections=[
                ConnectionSummary(name="qzcs", database_type="MYSQL"),
            ],
            last_loaded_at=datetime(2026, 3, 26, 9, 0, tzinfo=UTC),
        )


def _build_project_context_client(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> TestClient:
    monkeypatch.chdir(tmp_path)
    route_module = _load_project_route_module()
    app = create_app()
    app.dependency_overrides[route_module.get_project_context_service] = (
        lambda: ProjectContextService(
            project_state_reader=ProjectConfigService(base_dir=tmp_path),
            project_store=ProjectStore(base_dir=tmp_path),
            remote_gateway=FakeRemoteOverviewGateway(),
        )
    )
    return TestClient(app)


def test_get_current_project_returns_empty_state_by_default(
    project_client: TestClient,
) -> None:
    response = project_client.get("/api/project/current")

    assert response.status_code == 200
    assert response.json() == {
        "current_project": None,
        "remote_profile": None,
        "context_state": None,
    }


def test_select_project_and_remote_profile_flow(
    project_client: TestClient,
    tmp_path: Path,
) -> None:
    project_alpha = tmp_path / "project-alpha"
    project_beta = tmp_path / "project-beta"
    project_alpha.mkdir()
    project_beta.mkdir()

    select_response = project_client.post(
        "/api/project/select",
        json={"path": str(project_alpha)},
    )
    save_response = project_client.put(
        "/api/project/remote-profile",
        json={
            "base_url": "http://localhost:8075/webroot/decision",
            "username": "admin",
            "password": "admin",
            "designer_root": "/Applications/FineReport",
        },
    )
    current_response = project_client.get("/api/project/current")
    switch_response = project_client.post(
        "/api/project/select",
        json={"path": str(project_beta)},
    )
    restore_response = project_client.post(
        "/api/project/select",
        json={"path": str(project_alpha)},
    )

    assert select_response.status_code == 200
    assert select_response.json() == {
        "current_project": {
            "path": str(project_alpha),
            "name": "project-alpha",
        },
        "remote_profile": None,
        "context_state": None,
    }
    assert save_response.status_code == 200
    assert save_response.json() == {
        "remote_profile": {
            "base_url": "http://localhost:8075/webroot/decision",
            "username": "admin",
            "password": "admin",
            "designer_root": "/Applications/FineReport",
        }
    }
    assert current_response.status_code == 200
    assert current_response.json() == {
        "current_project": {
            "path": str(project_alpha),
            "name": "project-alpha",
        },
        "remote_profile": {
            "base_url": "http://localhost:8075/webroot/decision",
            "username": "admin",
            "password": "admin",
            "designer_root": "/Applications/FineReport",
        },
        "context_state": None,
    }
    assert switch_response.status_code == 200
    assert switch_response.json() == {
        "current_project": {
            "path": str(project_beta),
            "name": "project-beta",
        },
        "remote_profile": None,
        "context_state": None,
    }
    assert restore_response.status_code == 200
    assert restore_response.json() == {
        "current_project": {
            "path": str(project_alpha),
            "name": "project-alpha",
        },
        "remote_profile": {
            "base_url": "http://localhost:8075/webroot/decision",
            "username": "admin",
            "password": "admin",
            "designer_root": "/Applications/FineReport",
        },
        "context_state": None,
    }


def test_select_project_via_directory_dialog(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class StubDirectoryPicker:
        def choose_directory(self) -> Path:
            return project_dir

    project_dir = tmp_path / "project-alpha"
    project_dir.mkdir()
    monkeypatch.chdir(tmp_path)
    route_module = _load_project_route_module()
    app = create_app()
    app.dependency_overrides[route_module.get_directory_picker] = (
        lambda: StubDirectoryPicker()
    )
    client = TestClient(app)

    response = client.post("/api/project/select-dialog")

    assert response.status_code == 200
    assert response.json() == {
        "current_project": {
            "path": str(project_dir),
            "name": "project-alpha",
        },
        "remote_profile": None,
        "context_state": None,
    }


def test_generate_project_context_returns_snapshot(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    project_client = _build_project_context_client(tmp_path, monkeypatch)
    project_dir = tmp_path / "project-alpha"
    project_dir.mkdir()
    project_client.post("/api/project/select", json={"path": str(project_dir)})
    project_client.put(
        "/api/project/remote-profile",
        json={
            "base_url": "http://localhost:8075/webroot/decision",
            "username": "admin",
            "password": "admin",
            "designer_root": "/Applications/FineReport",
        },
    )

    response = project_client.post(
        "/api/project/context",
        json={"force": False},
    )

    assert response.status_code == 200
    response_data = response.json()
    assert response_data["project_root"] == str(project_dir)
    assert response_data["generated_at"]
    assert response_data["agents_status"] == "created"
    assert "AGENTS.md" in response_data["managed_files"]
    assert ".codex/project-context.md" in response_data["managed_files"]


def test_generate_project_context_rejects_incomplete_remote_profile(
    project_client: TestClient,
    tmp_path: Path,
) -> None:
    project_dir = tmp_path / "project-alpha"
    project_dir.mkdir()
    project_client.post("/api/project/select", json={"path": str(project_dir)})

    response = project_client.post(
        "/api/project/context",
        json={"force": False},
    )

    assert response.status_code == 400
    assert response.json() == {
        "code": "project.remote_profile_invalid",
        "message": "远程参数不合法",
        "detail": {"field": "remote_profile"},
        "source": "project",
        "retryable": False,
    }


def test_generate_project_context_surfaces_write_failures(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    project_client = _build_project_context_client(tmp_path, monkeypatch)
    project_dir = tmp_path / "project-alpha"
    project_dir.mkdir()
    project_client.post("/api/project/select", json={"path": str(project_dir)})
    project_client.put(
        "/api/project/remote-profile",
        json={
            "base_url": "http://localhost:8075/webroot/decision",
            "username": "admin",
            "password": "admin",
            "designer_root": "/Applications/FineReport",
        },
    )
    original_write_text = Path.write_text

    def fail_project_context_write(self: Path, *args, **kwargs):
        if self == project_dir / ".codex" / "project-context.md":
            raise PermissionError("Operation not permitted")
        return original_write_text(self, *args, **kwargs)

    monkeypatch.setattr(Path, "write_text", fail_project_context_write)

    response = project_client.post(
        "/api/project/context",
        json={"force": False},
    )

    assert response.status_code == 400
    assert response.json() == {
        "code": "project.context_write_failed",
        "message": "项目上下文写入失败",
        "detail": {
            "path": str(project_dir / ".codex" / "project-context.md"),
            "reason": "Operation not permitted",
        },
        "source": "project",
        "retryable": False,
    }


def test_get_current_project_returns_context_state_after_generation(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    project_client = _build_project_context_client(tmp_path, monkeypatch)
    project_dir = tmp_path / "project-alpha"
    project_dir.mkdir()
    project_client.post("/api/project/select", json={"path": str(project_dir)})
    project_client.put(
        "/api/project/remote-profile",
        json={
            "base_url": "http://localhost:8075/webroot/decision",
            "username": "admin",
            "password": "admin",
            "designer_root": "/Applications/FineReport",
        },
    )
    generate_response = project_client.post(
        "/api/project/context",
        json={"force": False},
    )

    response = project_client.get("/api/project/current")

    assert generate_response.status_code == 200
    assert response.status_code == 200
    assert response.json()["context_state"] == {
        "generated_at": generate_response.json()["generated_at"],
        "agents_status": generate_response.json()["agents_status"],
    }


def test_get_current_project_ignores_invalid_context_state_metadata(
    project_client: TestClient,
    tmp_path: Path,
) -> None:
    project_dir = tmp_path / "project-alpha"
    project_dir.mkdir()
    state_file = tmp_path / STATE_DIR_NAME / STATE_FILE_NAME
    state_file.parent.mkdir(parents=True, exist_ok=True)
    state_file.write_text(
        """
{
  "current_project": {
    "path": "%s",
    "name": "project-alpha"
  },
  "remote_profiles": {
    "%s": {
      "base_url": "http://localhost:8075/webroot/decision",
      "username": "admin",
      "password": "admin",
      "designer_root": "/Applications/FineReport"
    }
  },
  "context_states": {
    "%s": {
      "generated_at": "not-iso",
      "agents_status": "created"
    }
  }
}
        """
        % (project_dir, project_dir, project_dir),
        encoding="utf-8",
    )

    response = project_client.get("/api/project/current")

    assert response.status_code == 200
    assert response.json() == {
        "current_project": {
            "path": str(project_dir),
            "name": "project-alpha",
        },
        "remote_profile": {
            "base_url": "http://localhost:8075/webroot/decision",
            "username": "admin",
            "password": "admin",
            "designer_root": "/Applications/FineReport",
        },
        "context_state": None,
    }


def test_get_current_project_keeps_valid_context_state_when_other_project_has_invalid_timestamp(
    project_client: TestClient,
    tmp_path: Path,
) -> None:
    project_dir = tmp_path / "project-alpha"
    sibling_dir = tmp_path / "project-beta"
    project_dir.mkdir()
    sibling_dir.mkdir()
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
                        "designer_root": "/Applications/FineReport",
                    }
                },
                "context_states": {
                    str(project_dir): {
                        "generated_at": "2026-03-26T10:00:00+00:00",
                        "agents_status": "created",
                    },
                    str(sibling_dir): {
                        "generated_at": "not-iso",
                        "agents_status": "created",
                    },
                },
            }
        ),
        encoding="utf-8",
    )

    response = project_client.get("/api/project/current")

    assert response.status_code == 200
    assert response.json()["context_state"] == {
        "generated_at": "2026-03-26T10:00:00Z",
        "agents_status": "created",
    }


def test_select_project_via_directory_dialog_surfaces_cancel_error(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class CancelledDirectoryPicker:
        def choose_directory(self) -> Path:
            raise route_module.directory_selection_cancelled_error()

    monkeypatch.chdir(tmp_path)
    route_module = _load_project_route_module()
    app = create_app()
    app.dependency_overrides[route_module.get_directory_picker] = (
        lambda: CancelledDirectoryPicker()
    )
    client = TestClient(app)

    response = client.post("/api/project/select-dialog")

    assert response.status_code == 400
    assert response.json() == {
        "code": "project.directory_selection_cancelled",
        "message": "未选择项目目录",
        "detail": None,
        "source": "project",
        "retryable": False,
    }


def test_update_remote_profile_requires_current_project(
    project_client: TestClient,
) -> None:
    response = project_client.put(
        "/api/project/remote-profile",
        json={
            "base_url": "http://localhost:8075/webroot/decision",
            "username": "admin",
            "password": "admin",
            "designer_root": "/Applications/FineReport",
        },
    )

    assert response.status_code == 400
    assert response.json() == {
        "code": "project.current_required",
        "message": "请先选择项目目录",
        "detail": None,
        "source": "project",
        "retryable": False,
    }


def test_select_project_rejects_invalid_path(
    project_client: TestClient,
    tmp_path: Path,
) -> None:
    missing_dir = tmp_path / "missing-project"

    response = project_client.post(
        "/api/project/select",
        json={"path": str(missing_dir)},
    )

    assert response.status_code == 400
    assert response.json() == {
        "code": "project.path_invalid",
        "message": "项目目录不存在或不是目录",
        "detail": {"path": str(missing_dir)},
        "source": "project",
        "retryable": False,
    }


def test_update_remote_profile_rejects_invalid_base_url(
    project_client: TestClient,
    tmp_path: Path,
) -> None:
    project_dir = tmp_path / "project-alpha"
    project_dir.mkdir()
    project_client.post("/api/project/select", json={"path": str(project_dir)})

    response = project_client.put(
        "/api/project/remote-profile",
        json={
            "base_url": "localhost:8075/webroot/decision",
            "username": "admin",
            "password": "admin",
            "designer_root": "/Applications/FineReport",
        },
    )

    assert response.status_code == 400
    assert response.json() == {
        "code": "project.remote_profile_invalid",
        "message": "远程参数不合法",
        "detail": {"field": "base_url"},
        "source": "project",
        "retryable": False,
    }


def test_update_remote_profile_rejects_missing_designer_root(
    project_client: TestClient,
    tmp_path: Path,
) -> None:
    project_dir = tmp_path / "project-alpha"
    project_dir.mkdir()
    project_client.post("/api/project/select", json={"path": str(project_dir)})

    response = project_client.put(
        "/api/project/remote-profile",
        json={
            "base_url": "http://localhost:8075/webroot/decision",
            "username": "admin",
            "password": "admin",
        },
    )

    assert response.status_code == 400
    assert response.json() == {
        "code": "project.remote_profile_invalid",
        "message": "远程参数不合法",
        "detail": {"field": "designer_root"},
        "source": "project",
        "retryable": False,
    }


def test_get_current_project_rejects_invalid_state_file(
    project_client: TestClient,
    tmp_path: Path,
) -> None:
    state_file = tmp_path / STATE_DIR_NAME / STATE_FILE_NAME
    state_file.parent.mkdir(parents=True, exist_ok=True)
    state_file.write_text("{invalid", encoding="utf-8")

    response = project_client.get("/api/project/current")

    assert response.status_code == 400
    assert response.json() == {
        "code": "project.state_invalid",
        "message": "项目状态文件损坏",
        "detail": {"field": "state_file"},
        "source": "project",
        "retryable": False,
    }


def test_get_current_project_rejects_non_utf8_state_file(
    project_client: TestClient,
    tmp_path: Path,
) -> None:
    state_file = tmp_path / STATE_DIR_NAME / STATE_FILE_NAME
    state_file.parent.mkdir(parents=True, exist_ok=True)
    state_file.write_bytes(b"\xff\xfe\xfd")

    response = project_client.get("/api/project/current")

    assert response.status_code == 400
    assert response.json() == {
        "code": "project.state_invalid",
        "message": "项目状态文件损坏",
        "detail": {"field": "state_file"},
        "source": "project",
        "retryable": False,
    }


def test_update_remote_profile_rejects_deleted_current_project_via_api(
    project_client: TestClient,
    tmp_path: Path,
) -> None:
    project_dir = tmp_path / "project-alpha"
    project_dir.mkdir()
    project_client.post("/api/project/select", json={"path": str(project_dir)})
    project_dir.rmdir()

    response = project_client.put(
        "/api/project/remote-profile",
        json={
            "base_url": "http://localhost:8075/webroot/decision",
            "username": "admin",
            "password": "admin",
            "designer_root": "/Applications/FineReport",
        },
    )

    assert response.status_code == 400
    assert response.json() == {
        "code": "project.current_invalid",
        "message": "当前项目目录已失效",
        "detail": {"path": str(project_dir)},
        "source": "project",
        "retryable": False,
    }


def test_update_remote_profile_requires_designer_root(
    project_client: TestClient,
    tmp_path: Path,
) -> None:
    project_dir = tmp_path / "project-alpha"
    project_dir.mkdir()
    project_client.post("/api/project/select", json={"path": str(project_dir)})

    response = project_client.put(
        "/api/project/remote-profile",
        json={
            "base_url": "http://localhost:8075/webroot/decision",
            "username": "admin",
            "password": "admin",
            "designer_root": "",
        },
    )

    assert response.status_code == 400
    assert response.json() == {
        "code": "project.remote_profile_invalid",
        "message": "远程参数不合法",
        "detail": {"field": "designer_root"},
        "source": "project",
        "retryable": False,
    }


def test_update_remote_profile_missing_designer_root_returns_app_error(
    project_client: TestClient,
    tmp_path: Path,
) -> None:
    project_dir = tmp_path / "project-alpha"
    project_dir.mkdir()
    project_client.post("/api/project/select", json={"path": str(project_dir)})

    response = project_client.put(
        "/api/project/remote-profile",
        json={
            "base_url": "http://localhost:8075/webroot/decision",
            "username": "admin",
            "password": "admin",
        },
    )

    assert response.status_code == 400
    assert response.json() == {
        "code": "project.remote_profile_invalid",
        "message": "远程参数不合法",
        "detail": {"field": "designer_root"},
        "source": "project",
        "retryable": False,
    }


def test_get_current_project_keeps_valid_context_state_when_other_project_has_invalid_status(
    project_client: TestClient,
    tmp_path: Path,
) -> None:
    current_project = tmp_path / "project-alpha"
    other_project = tmp_path / "project-beta"
    current_project.mkdir()
    other_project.mkdir()
    state_file = tmp_path / STATE_DIR_NAME / STATE_FILE_NAME
    state_file.parent.mkdir(parents=True, exist_ok=True)
    state_file.write_text(
        json.dumps(
            {
                "current_project": {
                    "path": str(current_project),
                    "name": "project-alpha",
                },
                "remote_profiles": {
                    str(current_project): {
                        "base_url": "http://localhost:8075/webroot/decision",
                        "username": "admin",
                        "password": "admin",
                        "designer_root": "/Applications/FineReport",
                    }
                },
                "context_states": {
                    str(current_project): {
                        "generated_at": "2026-03-26T10:00:00+00:00",
                        "agents_status": "created",
                    },
                    str(other_project): {
                        "generated_at": "2026-03-26T11:00:00+00:00",
                        "agents_status": "manual",
                    },
                },
            }
        ),
        encoding="utf-8",
    )

    response = project_client.get("/api/project/current")

    assert response.status_code == 200
    assert response.json() == {
        "current_project": {
            "path": str(current_project),
            "name": "project-alpha",
        },
        "remote_profile": {
            "base_url": "http://localhost:8075/webroot/decision",
            "username": "admin",
            "password": "admin",
            "designer_root": "/Applications/FineReport",
        },
        "context_state": {
            "generated_at": "2026-03-26T10:00:00Z",
            "agents_status": "created",
        },
    }
