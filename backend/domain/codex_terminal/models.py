from dataclasses import dataclass
from pathlib import Path
from typing import Literal, Protocol

from backend.domain.project.errors import AppError

CODEX_TERMINAL_SOURCE = "codex_terminal"
PROJECT_SOURCE = "project"
MAX_STREAM_CHUNK_CHARS = 16384

TerminalSessionStatus = Literal["running", "closed", "failed"]


@dataclass(frozen=True, slots=True)
class CodexTerminalSession:
    session_id: str
    status: TerminalSessionStatus
    working_directory: str


@dataclass(frozen=True, slots=True)
class CodexTerminalStreamChunk:
    session_id: str
    status: TerminalSessionStatus
    output: str
    next_cursor: int
    completed: bool


@dataclass(frozen=True, slots=True)
class CodexTerminalInputAccepted:
    accepted: bool


class CodexTerminalRuntime(Protocol):
    session_id: str
    working_directory: Path
    status: TerminalSessionStatus

    def read(self, cursor: int) -> tuple[str, int, bool]:
        ...

    def write(self, data: str) -> None:
        ...

    def close(self) -> None:
        ...


def invalid_working_directory_error(path: str) -> AppError:
    return AppError(
        code="project.directory_invalid",
        message="工作目录不存在或不是目录",
        detail={"path": path},
        source=PROJECT_SOURCE,
    )


def codex_command_missing_error() -> AppError:
    return AppError(
        code="codex.command_missing",
        message="未找到 codex 可执行文件",
        detail={"command": "codex"},
        source=CODEX_TERMINAL_SOURCE,
    )


def terminal_session_not_found_error(session_id: str) -> AppError:
    return AppError(
        code="codex.session_not_found",
        message="终端会话不存在",
        detail={"session_id": session_id},
        source=CODEX_TERMINAL_SOURCE,
    )


def terminal_session_start_failed_error(
    working_directory: str,
    reason: str,
) -> AppError:
    return AppError(
        code="codex.session_start_failed",
        message="终端会话启动失败",
        detail={
            "working_directory": working_directory,
            "reason": reason,
        },
        source=CODEX_TERMINAL_SOURCE,
    )


def terminal_session_read_failed_error(session_id: str, reason: str) -> AppError:
    return AppError(
        code="codex.read_failed",
        message="终端输出读取失败",
        detail={"session_id": session_id, "reason": reason},
        source=CODEX_TERMINAL_SOURCE,
    )


def terminal_session_input_failed_error(session_id: str, reason: str) -> AppError:
    return AppError(
        code="codex.input_failed",
        message="终端输入写入失败",
        detail={"session_id": session_id, "reason": reason},
        source=CODEX_TERMINAL_SOURCE,
    )


def terminal_session_close_failed_error(session_id: str, reason: str) -> AppError:
    return AppError(
        code="codex.close_failed",
        message="终端会话关闭失败",
        detail={"session_id": session_id, "reason": reason},
        source=CODEX_TERMINAL_SOURCE,
    )
