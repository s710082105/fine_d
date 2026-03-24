from fastapi.testclient import TestClient

from backend.app_factory import create_app
from backend.domain.project.errors import AppError


def test_health_endpoint_returns_ok() -> None:
    client = TestClient(create_app())
    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_domain_error_is_returned_as_json_response() -> None:
    app = create_app()

    @app.get("/api/error")
    def error_route() -> None:
        raise AppError(
            code="config.invalid",
            message="invalid config",
            detail={"field": "workspace_dir"},
            source="config",
            retryable=False,
        )

    client = TestClient(app)
    response = client.get("/api/error")

    assert response.status_code == 400
    assert response.json() == {
        "code": "config.invalid",
        "message": "invalid config",
        "detail": {"field": "workspace_dir"},
        "source": "config",
        "retryable": False,
    }
