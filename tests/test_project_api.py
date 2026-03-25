import importlib
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from backend.app_factory import create_app
from backend.infra.project_store import STATE_DIR_NAME, STATE_FILE_NAME


@pytest.fixture
def project_client(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> TestClient:
    monkeypatch.chdir(tmp_path)
    return TestClient(create_app())


def _load_project_route_module():
    return importlib.import_module("apps.api.routes.project")


def test_get_current_project_returns_empty_state_by_default(
    project_client: TestClient,
) -> None:
    response = project_client.get("/api/project/current")

    assert response.status_code == 200
    assert response.json() == {
        "current_project": None,
        "remote_profile": None,
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
    }
    assert save_response.status_code == 200
    assert save_response.json() == {
        "remote_profile": {
            "base_url": "http://localhost:8075/webroot/decision",
            "username": "admin",
            "password": "admin",
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
        },
    }
    assert switch_response.status_code == 200
    assert switch_response.json() == {
        "current_project": {
            "path": str(project_beta),
            "name": "project-beta",
        },
        "remote_profile": None,
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
        },
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
