import importlib
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from backend.app_factory import create_app
from backend.domain.project.errors import AppError


def _load_terminal_route_module():
    try:
        return importlib.import_module("apps.api.routes.codex_terminal")
    except ModuleNotFoundError as error:
        pytest.fail(f"codex terminal api route module is missing: {error}")


def _load_terminal_models_module():
    try:
        return importlib.import_module("backend.domain.codex_terminal.models")
    except ModuleNotFoundError as error:
        pytest.fail(f"codex terminal models module is missing: {error}")


class FakeCodexTerminalService:
    def __init__(self, working_directory: str) -> None:
        self._working_directory = working_directory

    def create_session(self, working_directory: str):
        models = _load_terminal_models_module()
        return models.CodexTerminalSession(
            session_id="terminal-session-1",
            status="running",
            working_directory=working_directory,
        )

    def get_session(self, session_id: str):
        models = _load_terminal_models_module()
        return models.CodexTerminalSession(
            session_id=session_id,
            status="running",
            working_directory=self._working_directory,
        )

    def get_stream_chunk(self, session_id: str, cursor: int):
        models = _load_terminal_models_module()
        return models.CodexTerminalStreamChunk(
            session_id=session_id,
            status="running",
            output="hello",
            next_cursor=cursor + 5,
            completed=False,
        )

    def write_input(self, session_id: str, data: str):
        models = _load_terminal_models_module()
        return models.CodexTerminalInputAccepted(accepted=True)

    def close_session(self, session_id: str):
        models = _load_terminal_models_module()
        return models.CodexTerminalSession(
            session_id=session_id,
            status="closed",
            working_directory=self._working_directory,
        )


class InvalidDirectoryService:
    def create_session(self, working_directory: str):
        raise AppError(
            code="project.directory_invalid",
            message="工作目录不存在或不是目录",
            detail={"path": working_directory},
            source="project",
        )


class MissingSessionService:
    def get_session(self, session_id: str):
        raise AppError(
            code="codex.session_not_found",
            message="终端会话不存在",
            detail={"session_id": session_id},
            source="codex_terminal",
        )

    def get_stream_chunk(self, session_id: str, cursor: int):
        raise AppError(
            code="codex.session_not_found",
            message="终端会话不存在",
            detail={"session_id": session_id},
            source="codex_terminal",
        )

    def write_input(self, session_id: str, data: str):
        raise AppError(
            code="codex.session_not_found",
            message="终端会话不存在",
            detail={"session_id": session_id},
            source="codex_terminal",
        )

    def close_session(self, session_id: str):
        raise AppError(
            code="codex.session_not_found",
            message="终端会话不存在",
            detail={"session_id": session_id},
            source="codex_terminal",
        )


@pytest.fixture
def working_directory(tmp_path: Path) -> str:
    return str(tmp_path)


def test_terminal_endpoints_cover_minimum_lifecycle(working_directory: str) -> None:
    route_module = _load_terminal_route_module()
    app = create_app()
    app.dependency_overrides[route_module.get_codex_terminal_service] = lambda: (
        FakeCodexTerminalService(working_directory)
    )
    client = TestClient(app)

    create_response = client.post(
        "/api/codex/terminal/sessions",
        json={"working_directory": working_directory},
    )
    read_response = client.get("/api/codex/terminal/sessions/terminal-session-1")
    stream_response = client.get(
        "/api/codex/terminal/sessions/terminal-session-1/stream",
        params={"cursor": 0},
    )
    input_response = client.post(
        "/api/codex/terminal/sessions/terminal-session-1/input",
        json={"data": "/help\n"},
    )
    close_response = client.delete("/api/codex/terminal/sessions/terminal-session-1")

    assert create_response.status_code == 200
    assert create_response.json() == {
        "session_id": "terminal-session-1",
        "status": "running",
        "working_directory": working_directory,
    }
    assert read_response.status_code == 200
    assert read_response.json() == {
        "session_id": "terminal-session-1",
        "status": "running",
        "working_directory": working_directory,
    }
    assert stream_response.status_code == 200
    assert stream_response.json() == {
        "session_id": "terminal-session-1",
        "status": "running",
        "output": "hello",
        "next_cursor": 5,
        "completed": False,
    }
    assert input_response.status_code == 200
    assert input_response.json() == {"accepted": True}
    assert close_response.status_code == 200
    assert close_response.json() == {
        "session_id": "terminal-session-1",
        "status": "closed",
        "working_directory": working_directory,
    }


def test_create_session_endpoint_returns_unified_error_response(
    working_directory: str,
) -> None:
    route_module = _load_terminal_route_module()
    app = create_app()
    app.dependency_overrides[route_module.get_codex_terminal_service] = (
        lambda: InvalidDirectoryService()
    )
    client = TestClient(app)

    response = client.post(
        "/api/codex/terminal/sessions",
        json={"working_directory": working_directory},
    )

    assert response.status_code == 400
    assert response.json() == {
        "code": "project.directory_invalid",
        "message": "工作目录不存在或不是目录",
        "detail": {"path": working_directory},
        "source": "project",
        "retryable": False,
    }


@pytest.mark.parametrize(
    ("method", "url", "payload"),
    [
        ("get", "/api/codex/terminal/sessions/missing-session", None),
        ("get", "/api/codex/terminal/sessions/missing-session/stream?cursor=0", None),
        ("post", "/api/codex/terminal/sessions/missing-session/input", {"data": "ls\n"}),
        ("delete", "/api/codex/terminal/sessions/missing-session", None),
    ],
)
def test_missing_session_endpoints_return_unified_error_response(
    method: str,
    url: str,
    payload: dict[str, str] | None,
) -> None:
    route_module = _load_terminal_route_module()
    app = create_app()
    app.dependency_overrides[route_module.get_codex_terminal_service] = (
        lambda: MissingSessionService()
    )
    client = TestClient(app)

    request_kwargs = {} if payload is None else {"json": payload}
    response = client.request(method.upper(), url, **request_kwargs)

    assert response.status_code == 400
    assert response.json() == {
        "code": "codex.session_not_found",
        "message": "终端会话不存在",
        "detail": {"session_id": "missing-session"},
        "source": "codex_terminal",
        "retryable": False,
    }
