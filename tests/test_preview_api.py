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


class FakePreviewGateway:
    def open_url(self, url: str) -> None:
        raise AssertionError(f"open_url should not be called for blank url: {url!r}")


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


@pytest.mark.parametrize("url", ["", "   "])
def test_open_preview_endpoint_rejects_blank_url(url: str) -> None:
    route_module = _load_preview_route_module()
    use_cases_module = importlib.import_module("backend.application.preview.use_cases")
    app = create_app()
    app.dependency_overrides[route_module.get_preview_service] = lambda: (
        use_cases_module.PreviewUseCases(FakePreviewGateway())
    )
    client = TestClient(app)

    response = client.post("/api/preview/open", json={"url": url})

    assert response.status_code == 400
    assert response.json() == {
        "code": "preview.invalid_url",
        "message": "preview url must not be blank",
        "detail": {"url": url},
        "source": "preview",
        "retryable": False,
    }


@pytest.mark.parametrize(
    "url",
    [
        "file:///tmp/demo.cpt",
        "mailto:test@example.com",
        "custom-scheme://preview/session-1",
    ],
)
def test_open_preview_endpoint_rejects_unsupported_scheme(url: str) -> None:
    route_module = _load_preview_route_module()
    use_cases_module = importlib.import_module("backend.application.preview.use_cases")
    app = create_app()
    app.dependency_overrides[route_module.get_preview_service] = lambda: (
        use_cases_module.PreviewUseCases(FakePreviewGateway())
    )
    client = TestClient(app)

    response = client.post("/api/preview/open", json={"url": url})

    assert response.status_code == 400
    assert response.json() == {
        "code": "preview.invalid_url",
        "message": "preview url must use http or https",
        "detail": {"url": url},
        "source": "preview",
        "retryable": False,
    }
