import importlib

import pytest
from fastapi.testclient import TestClient

from backend.app_factory import create_app
from backend.domain.project.errors import AppError


class FakeAssistantService:
    def route_prompt(self, prompt: str):
        models_module = importlib.import_module("backend.domain.assistant.models")
        return models_module.AssistantRouteResult(
            prompt=prompt,
            status="routed",
            module="sync",
            actions=["publish_project", "verify_remote_state"],
            message="推荐走同步模块。",
        )


class FailingAssistantService:
    def route_prompt(self, prompt: str):
        raise AppError(
            code="assistant.invalid_prompt",
            message="assistant prompt must not be blank",
            detail={"prompt": prompt},
            source="assistant",
        )


def _load_assistant_route_module():
    try:
        return importlib.import_module("apps.api.routes.assistant")
    except ModuleNotFoundError as error:
        pytest.fail(f"assistant api route module is missing: {error}")


def test_route_assistant_prompt_endpoint_returns_route_result() -> None:
    route_module = _load_assistant_route_module()
    app = create_app()
    app.dependency_overrides[route_module.get_assistant_service] = (
        lambda: FakeAssistantService()
    )
    client = TestClient(app)

    response = client.post("/api/assistant/route", json={"prompt": "请帮我同步并发布到远端"})

    assert response.status_code == 200
    assert response.json() == {
        "prompt": "请帮我同步并发布到远端",
        "status": "routed",
        "module": "sync",
        "actions": ["publish_project", "verify_remote_state"],
        "message": "推荐走同步模块。",
    }


@pytest.mark.parametrize("prompt", ["", "   "])
def test_route_assistant_prompt_endpoint_uses_unified_error_response(
    prompt: str,
) -> None:
    route_module = _load_assistant_route_module()
    app = create_app()
    app.dependency_overrides[route_module.get_assistant_service] = (
        lambda: FailingAssistantService()
    )
    client = TestClient(app)

    response = client.post("/api/assistant/route", json={"prompt": prompt})

    assert response.status_code == 400
    assert response.json() == {
        "code": "assistant.invalid_prompt",
        "message": "assistant prompt must not be blank",
        "detail": {"prompt": prompt},
        "source": "assistant",
        "retryable": False,
    }
