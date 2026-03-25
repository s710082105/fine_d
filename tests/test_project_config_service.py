from pathlib import Path

import pytest

from backend.application.project.config_service import ProjectConfigService
from backend.domain.project.errors import AppError


def test_default_project_config_uses_workspace_and_generated_dirs(
    tmp_path: Path,
) -> None:
    service = ProjectConfigService(base_dir=tmp_path)

    config = service.load_or_create()

    assert config.workspace_dir == tmp_path / "workspace"
    assert config.generated_dir == tmp_path / "generated"


def test_load_does_not_create_directories(tmp_path: Path) -> None:
    service = ProjectConfigService(base_dir=tmp_path)

    config = service.load()

    assert config.workspace_dir == tmp_path / "workspace"
    assert config.generated_dir == tmp_path / "generated"
    assert not config.workspace_dir.exists()
    assert not config.generated_dir.exists()


def test_get_current_returns_empty_state_by_default(tmp_path: Path) -> None:
    service = ProjectConfigService(base_dir=tmp_path)

    state = service.get_current()

    assert state.current_project is None
    assert state.remote_profile is None


def test_select_project_persists_current_project_and_returns_saved_remote_profile(
    tmp_path: Path,
) -> None:
    service = ProjectConfigService(base_dir=tmp_path)
    project_dir = tmp_path / "project-alpha"
    project_dir.mkdir()

    selected = service.select_project(project_dir)

    assert selected.current_project is not None
    assert selected.current_project.path == project_dir
    assert selected.current_project.name == "project-alpha"
    assert selected.remote_profile is None
    assert service.get_current() == selected


def test_update_remote_profile_requires_current_project(tmp_path: Path) -> None:
    service = ProjectConfigService(base_dir=tmp_path)

    with pytest.raises(AppError) as exc_info:
        service.update_remote_profile(
            base_url="http://localhost:8075/webroot/decision",
            username="admin",
            password="admin",
        )

    assert exc_info.value.code == "project.current_required"


def test_update_remote_profile_persists_by_project_directory(tmp_path: Path) -> None:
    service = ProjectConfigService(base_dir=tmp_path)
    project_alpha = tmp_path / "project-alpha"
    project_beta = tmp_path / "project-beta"
    project_alpha.mkdir()
    project_beta.mkdir()

    service.select_project(project_alpha)
    saved = service.update_remote_profile(
        base_url="http://localhost:8075/webroot/decision",
        username="admin",
        password="admin",
    )
    switched = service.select_project(project_beta)
    restored = service.select_project(project_alpha)

    assert switched.remote_profile is None
    assert saved == restored.remote_profile


@pytest.mark.parametrize(
    ("base_url", "username", "password", "field"),
    [
        ("ftp://localhost:8075/webroot/decision", "admin", "admin", "base_url"),
        ("http://localhost:8075/webroot/decision", "", "admin", "username"),
        ("http://localhost:8075/webroot/decision", "admin", "", "password"),
    ],
)
def test_update_remote_profile_rejects_invalid_values(
    tmp_path: Path,
    base_url: str,
    username: str,
    password: str,
    field: str,
) -> None:
    service = ProjectConfigService(base_dir=tmp_path)
    project_dir = tmp_path / "project-alpha"
    project_dir.mkdir()
    service.select_project(project_dir)

    with pytest.raises(AppError) as exc_info:
        service.update_remote_profile(
            base_url=base_url,
            username=username,
            password=password,
        )

    assert exc_info.value.code == "project.remote_profile_invalid"
    assert exc_info.value.detail == {"field": field}


def test_select_project_rejects_missing_directory(tmp_path: Path) -> None:
    service = ProjectConfigService(base_dir=tmp_path)

    with pytest.raises(AppError) as exc_info:
        service.select_project(tmp_path / "missing-project")

    assert exc_info.value.code == "project.path_invalid"


def test_domain_error_is_serialized() -> None:
    payload = AppError(
        code="config.invalid",
        message="invalid config",
        detail={"field": "workspace_dir"},
        source="config",
        retryable=False,
    ).to_dict()

    assert payload["source"] == "config"
