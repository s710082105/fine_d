from backend.domain.codex_terminal.models import CodexTerminalRuntime


class TerminalSessionStore:
    def __init__(self) -> None:
        self._sessions: dict[str, CodexTerminalRuntime] = {}

    def save(self, session_id: str, runtime: CodexTerminalRuntime) -> None:
        self._sessions[session_id] = runtime

    def get(self, session_id: str) -> CodexTerminalRuntime | None:
        return self._sessions.get(session_id)

    def delete(self, session_id: str) -> CodexTerminalRuntime | None:
        return self._sessions.pop(session_id, None)
