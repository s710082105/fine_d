import importlib

import pytest
from fastapi.testclient import TestClient

from backend.app_factory import create_app
from backend.domain.project.errors import AppError


class FakePreviewService:
    def open_preview(self, url: str):
        models_module = importlib.import_module("backend.domain.preview.models")
        return models_module.PreviewSession(
            session_id="preview-session-1",
            url=url,
            status="opened",
        )


class FailingPreviewService:
    def open_preview(self, url: str):
        raise AppError(
            code="preview.open_failed",
            message="browser open failed",
            detail={"url": url},
            source="preview",
        )


def _load_preview_route_module():
    try:
        return importlib.import_module("apps.api.routes.preview")
    except ModuleNotFoundError as error:
        pytest.fail(f"preview api route module is missing: {error}")


def test_open_preview_endpoint_returns_session() -> None:
    route_module = _load_preview_route_module()
    app = create_app()
    app.dependency_overrides[route_module.get_preview_service] = lambda: FakePreviewService()
    client = TestClient(app)

    response = client.post(
        "/api/preview/open",
        json={"url": "http://127.0.0.1:8075/webroot/decision"},
    )

    assert response.status_code == 200
    assert response.json() == {
        "session_id": "preview-session-1",
        "url": "http://127.0.0.1:8075/webroot/decision",
        "status": "opened",
    }


def test_open_preview_endpoint_uses_unified_error_response() -> None:
    route_module = _load_preview_route_module()
    app = create_app()
    app.dependency_overrides[route_module.get_preview_service] = (
        lambda: FailingPreviewService()
    )
    client = TestClient(app)

    response = client.post(
        "/api/preview/open",
        json={"url": "http://127.0.0.1:8075/webroot/decision"},
    )

    assert response.status_code == 400
    assert response.json() == {
        "code": "preview.open_failed",
        "message": "browser open failed",
        "detail": {"url": "http://127.0.0.1:8075/webroot/decision"},
        "source": "preview",
        "retryable": False,
    }
