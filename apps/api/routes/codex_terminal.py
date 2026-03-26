from pathlib import Path

from backend.adapters.fine.http_client import FineHttpClientFactory
from fastapi import APIRouter, Depends, Query, Request

from backend.adapters.system.terminal_gateway import CodexTerminalGateway
from backend.application.codex_terminal.tool_runtime import ToolAwareTerminalRuntime
from backend.application.codex_terminal.use_cases import CodexTerminalUseCases
from backend.application.datasource.project_use_cases import ProjectDatasourceUseCases
from backend.infra.project_store import ProjectStore
from backend.infra.terminal_session_store import TerminalSessionStore
from backend.schemas.codex_terminal import (
    CodexTerminalCreateSessionRequest,
    CodexTerminalInputAcceptedResponse,
    CodexTerminalInputRequest,
    CodexTerminalSessionResponse,
    CodexTerminalStreamResponse,
)

router = APIRouter()


def get_terminal_session_store(request: Request) -> TerminalSessionStore:
    return request.app.state.codex_terminal_session_store


def get_codex_terminal_service(
    session_store: TerminalSessionStore = Depends(get_terminal_session_store),
) -> CodexTerminalUseCases:
    project_store = ProjectStore(base_dir=Path.cwd())
    datasource_use_cases = ProjectDatasourceUseCases(
        project_store,
        FineHttpClientFactory(),
    )
    return CodexTerminalUseCases(
        gateway=CodexTerminalGateway(),
        session_store=session_store,
        runtime_transformer=lambda runtime: ToolAwareTerminalRuntime(
            runtime,
            datasource_use_cases,
        ),
    )


@router.post(
    "/api/codex/terminal/sessions",
    response_model=CodexTerminalSessionResponse,
)
def create_terminal_session(
    request: CodexTerminalCreateSessionRequest,
    service: CodexTerminalUseCases = Depends(get_codex_terminal_service),
) -> CodexTerminalSessionResponse:
    session = service.create_session(request.working_directory)
    return CodexTerminalSessionResponse.from_domain(session)


@router.get(
    "/api/codex/terminal/sessions/{session_id}",
    response_model=CodexTerminalSessionResponse,
)
def get_terminal_session(
    session_id: str,
    service: CodexTerminalUseCases = Depends(get_codex_terminal_service),
) -> CodexTerminalSessionResponse:
    session = service.get_session(session_id)
    return CodexTerminalSessionResponse.from_domain(session)


@router.get(
    "/api/codex/terminal/sessions/{session_id}/stream",
    response_model=CodexTerminalStreamResponse,
)
def get_terminal_stream_chunk(
    session_id: str,
    cursor: int = Query(default=0, ge=0),
    service: CodexTerminalUseCases = Depends(get_codex_terminal_service),
) -> CodexTerminalStreamResponse:
    chunk = service.get_stream_chunk(session_id, cursor)
    return CodexTerminalStreamResponse.from_domain(chunk)


@router.post(
    "/api/codex/terminal/sessions/{session_id}/input",
    response_model=CodexTerminalInputAcceptedResponse,
)
def write_terminal_input(
    session_id: str,
    request: CodexTerminalInputRequest,
    service: CodexTerminalUseCases = Depends(get_codex_terminal_service),
) -> CodexTerminalInputAcceptedResponse:
    accepted = service.write_input(session_id, request.data)
    return CodexTerminalInputAcceptedResponse.from_domain(accepted)


@router.delete(
    "/api/codex/terminal/sessions/{session_id}",
    response_model=CodexTerminalSessionResponse,
)
def close_terminal_session(
    session_id: str,
    service: CodexTerminalUseCases = Depends(get_codex_terminal_service),
) -> CodexTerminalSessionResponse:
    session = service.close_session(session_id)
    return CodexTerminalSessionResponse.from_domain(session)
