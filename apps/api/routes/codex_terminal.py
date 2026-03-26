import asyncio
import json
from pathlib import Path

from backend.adapters.fine.http_client import FineHttpClientFactory
from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import StreamingResponse

from backend.adapters.system.terminal_gateway import CodexTerminalGateway
from backend.application.codex_terminal.tool_runtime import ToolAwareTerminalRuntime
from backend.application.codex_terminal.use_cases import CodexTerminalUseCases
from backend.application.datasource.project_use_cases import ProjectDatasourceUseCases
from backend.domain.project.errors import AppError
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

STREAM_IDLE_DELAY_SECONDS = 0.3
KEEPALIVE_INTERVAL_SECONDS = 10.0


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


@router.get("/api/codex/terminal/sessions/{session_id}/events")
async def stream_terminal_events(
    session_id: str,
    cursor: int = Query(default=0, ge=0),
    service: CodexTerminalUseCases = Depends(get_codex_terminal_service),
) -> StreamingResponse:
    service.get_session(session_id)
    return StreamingResponse(
        _terminal_event_stream(service, session_id, cursor),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


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


async def _terminal_event_stream(
    service: CodexTerminalUseCases,
    session_id: str,
    cursor: int,
):
    idle_seconds = 0.0
    while True:
        try:
            chunk = service.get_stream_chunk(session_id, cursor)
        except AppError as error:
            yield _sse_event(
                "terminal_error",
                {
                    "code": error.code,
                    "message": error.message,
                    "detail": error.detail,
                    "source": error.source,
                    "retryable": error.retryable,
                },
            )
            break
        payload = CodexTerminalStreamResponse.from_domain(chunk).model_dump()
        if chunk.output or chunk.completed:
            yield _sse_event("terminal", payload)
            cursor = chunk.next_cursor
            idle_seconds = 0.0
            if chunk.completed:
                break
        else:
            await asyncio.sleep(STREAM_IDLE_DELAY_SECONDS)
            idle_seconds += STREAM_IDLE_DELAY_SECONDS
            if idle_seconds >= KEEPALIVE_INTERVAL_SECONDS:
                yield ": keepalive\n\n"
                idle_seconds = 0.0


def _sse_event(event: str, payload: dict[str, object]) -> str:
    encoded = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    return f"event: {event}\ndata: {encoded}\n\n"
