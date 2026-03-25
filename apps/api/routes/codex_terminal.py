from fastapi import APIRouter, Depends, Query

from backend.adapters.system.terminal_gateway import CodexTerminalGateway
from backend.application.codex_terminal.use_cases import CodexTerminalUseCases
from backend.infra.terminal_session_store import TerminalSessionStore
from backend.schemas.codex_terminal import (
    CodexTerminalCreateSessionRequest,
    CodexTerminalInputAcceptedResponse,
    CodexTerminalInputRequest,
    CodexTerminalSessionResponse,
    CodexTerminalStreamResponse,
)

router = APIRouter()
SESSION_STORE = TerminalSessionStore()


def get_codex_terminal_service() -> CodexTerminalUseCases:
    return CodexTerminalUseCases(
        gateway=CodexTerminalGateway(),
        session_store=SESSION_STORE,
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
