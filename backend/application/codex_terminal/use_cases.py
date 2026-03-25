from pathlib import Path
from uuid import uuid4

from backend.domain.codex_terminal.models import (
    CodexTerminalInputAccepted,
    CodexTerminalRuntime,
    CodexTerminalSession,
    CodexTerminalStreamChunk,
    invalid_working_directory_error,
    terminal_session_not_found_error,
)


class CodexTerminalUseCases:
    def __init__(
        self,
        gateway,
        session_store,
        session_id_factory=None,
    ) -> None:
        self._gateway = gateway
        self._session_store = session_store
        self._session_id_factory = session_id_factory or (
            lambda: f"codex-terminal-{uuid4().hex}"
        )

    def create_session(self, working_directory: str) -> CodexTerminalSession:
        validated_directory = self._validate_working_directory(working_directory)
        session_id = self._session_id_factory()
        runtime = self._gateway.create_runtime(session_id, validated_directory)
        self._session_store.save(session_id, runtime)
        return self._build_session(runtime)

    def get_session(self, session_id: str) -> CodexTerminalSession:
        runtime = self._get_runtime(session_id)
        session = self._build_session(runtime)
        self._delete_if_inactive(runtime)
        return session

    def get_stream_chunk(
        self,
        session_id: str,
        cursor: int,
    ) -> CodexTerminalStreamChunk:
        runtime = self._get_runtime(session_id)
        output, next_cursor, completed = runtime.read(cursor)
        chunk = CodexTerminalStreamChunk(
            session_id=runtime.session_id,
            status=runtime.status,
            output=output,
            next_cursor=next_cursor,
            completed=completed,
        )
        self._delete_if_inactive(runtime)
        return chunk

    def write_input(
        self,
        session_id: str,
        data: str,
    ) -> CodexTerminalInputAccepted:
        runtime = self._get_runtime(session_id)
        runtime.write(data)
        return CodexTerminalInputAccepted(accepted=True)

    def close_session(self, session_id: str) -> CodexTerminalSession:
        runtime = self._get_runtime(session_id)
        runtime.close()
        self._session_store.delete(session_id)
        return self._build_session(runtime)

    @staticmethod
    def _validate_working_directory(working_directory: str) -> Path:
        directory = Path(working_directory).expanduser().resolve()
        if not directory.exists() or not directory.is_dir():
            raise invalid_working_directory_error(working_directory)
        return directory

    def _get_runtime(self, session_id: str) -> CodexTerminalRuntime:
        runtime = self._session_store.get(session_id)
        if runtime is None:
            raise terminal_session_not_found_error(session_id)
        return runtime

    def _delete_if_inactive(self, runtime: CodexTerminalRuntime) -> None:
        if runtime.status == "running":
            return
        self._session_store.delete(runtime.session_id)

    @staticmethod
    def _build_session(runtime: CodexTerminalRuntime) -> CodexTerminalSession:
        return CodexTerminalSession(
            session_id=runtime.session_id,
            status=runtime.status,
            working_directory=str(runtime.working_directory),
        )
