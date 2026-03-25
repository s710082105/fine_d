from pathlib import Path

from fastapi.testclient import TestClient

from backend.app_factory import create_app
from backend.domain.project.errors import AppError
from backend.domain.project.models import ProjectConfig


class FakeProjectService:
    def load_or_create(self) -> ProjectConfig:
        return ProjectConfig(
            workspace_dir=Path("/tmp/finereport/workspace"),
            generated_dir=Path("/tmp/finereport/generated"),
        )


class FailingProjectService:
    def load_or_create(self) -> ProjectConfig:
        raise AppError(
            code="project.invalid_config",
            message="project config is invalid",
            detail={"field": "workspace_dir"},
            source="project",
        )


def test_project_config_endpoint_returns_expected_schema() -> None:
    from apps.api.routes.project import get_project_service

    app = create_app()
    app.dependency_overrides[get_project_service] = lambda: FakeProjectService()
    client = TestClient(app)

    response = client.get("/api/project/config")

    assert response.status_code == 200
    assert response.json() == {
        "workspace_dir": "/tmp/finereport/workspace",
        "generated_dir": "/tmp/finereport/generated",
    }


def test_project_config_endpoint_uses_unified_error_response() -> None:
    from apps.api.routes.project import get_project_service

    app = create_app()
    app.dependency_overrides[get_project_service] = lambda: FailingProjectService()
    client = TestClient(app)

    response = client.get("/api/project/config")

    assert response.status_code == 400
    assert response.json() == {
        "code": "project.invalid_config",
        "message": "project config is invalid",
        "detail": {"field": "workspace_dir"},
        "source": "project",
        "retryable": False,
    }
