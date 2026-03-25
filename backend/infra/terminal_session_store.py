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

    def close_all(self) -> None:
        errors: list[str] = []
        session_ids = list(self._sessions.keys())
        for session_id in session_ids:
            runtime = self.delete(session_id)
            if runtime is None:
                continue
            try:
                runtime.close()
            except Exception as exc:
                errors.append(f"{session_id}: {exc}")
        if errors:
            joined_errors = "; ".join(errors)
            raise RuntimeError(
                f"failed to close terminal sessions during shutdown: {joined_errors}"
            )
