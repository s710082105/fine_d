import importlib
from dataclasses import dataclass
from pathlib import Path

import pytest

from backend.domain.project.errors import AppError


@dataclass
class FakeTerminalRuntime:
    session_id: str
    working_directory: Path
    status: str = "running"
    output: str = ""
    raise_on_read: AppError | None = None
    raise_on_write: AppError | None = None
    written_inputs: list[str] | None = None
    close_calls: int = 0

    def __post_init__(self) -> None:
        if self.written_inputs is None:
            self.written_inputs = []

    def read(self, cursor: int):
        if self.raise_on_read is not None:
            raise self.raise_on_read
        next_cursor = len(self.output)
        return self.output[cursor:], next_cursor, self.status != "running"

    def write(self, data: str) -> None:
        if self.raise_on_write is not None:
            raise self.raise_on_write
        self.written_inputs.append(data)

    def close(self) -> None:
        self.close_calls += 1
        self.status = "closed"


class FakeTerminalGateway:
    def __init__(self, runtime_factory=None) -> None:
        self.created_directories: list[Path] = []
        self._runtime_factory = runtime_factory or (
            lambda session_id, working_directory: FakeTerminalRuntime(
                session_id=session_id,
                working_directory=working_directory,
            )
        )

    def create_runtime(self, session_id: str, working_directory: Path):
        self.created_directories.append(working_directory)
        return self._runtime_factory(session_id, working_directory)


class FakeTerminalSessionStore:
    def __init__(self) -> None:
        self._sessions: dict[str, FakeTerminalRuntime] = {}

    def save(self, session_id: str, runtime: FakeTerminalRuntime) -> None:
        self._sessions[session_id] = runtime

    def get(self, session_id: str) -> FakeTerminalRuntime | None:
        return self._sessions.get(session_id)

    def delete(self, session_id: str) -> FakeTerminalRuntime | None:
        return self._sessions.pop(session_id, None)


def _load_terminal_use_cases_module():
    try:
        return importlib.import_module("backend.application.codex_terminal.use_cases")
    except ModuleNotFoundError as error:
        pytest.fail(f"codex terminal use case module is missing: {error}")


def test_create_session_uses_given_directory_and_returns_running(
    tmp_path: Path,
) -> None:
    module = _load_terminal_use_cases_module()
    gateway = FakeTerminalGateway()
    store = FakeTerminalSessionStore()
    use_case = module.CodexTerminalUseCases(
        gateway=gateway,
        session_store=store,
        session_id_factory=lambda: "terminal-session-1",
    )

    result = use_case.create_session(str(tmp_path))

    assert result.session_id == "terminal-session-1"
    assert result.status == "running"
    assert result.working_directory == str(tmp_path)
    assert gateway.created_directories == [tmp_path]


def test_create_session_rejects_missing_directory(tmp_path: Path) -> None:
    module = _load_terminal_use_cases_module()
    missing_path = tmp_path / "missing"
    use_case = module.CodexTerminalUseCases(
        gateway=FakeTerminalGateway(),
        session_store=FakeTerminalSessionStore(),
        session_id_factory=lambda: "ignored",
    )

    with pytest.raises(AppError) as exc_info:
        use_case.create_session(str(missing_path))

    assert exc_info.value.code == "project.directory_invalid"
    assert exc_info.value.detail == {"path": str(missing_path)}


@pytest.mark.parametrize("method_name", ["get_stream_chunk", "write_input", "close_session"])
def test_missing_session_fails_explicitly(
    tmp_path: Path,
    method_name: str,
) -> None:
    module = _load_terminal_use_cases_module()
    use_case = module.CodexTerminalUseCases(
        gateway=FakeTerminalGateway(),
        session_store=FakeTerminalSessionStore(),
        session_id_factory=lambda: "ignored",
    )

    with pytest.raises(AppError) as exc_info:
        if method_name == "get_stream_chunk":
            getattr(use_case, method_name)("missing-session", cursor=0)
        elif method_name == "write_input":
            getattr(use_case, method_name)("missing-session", data="help\n")
        else:
            getattr(use_case, method_name)("missing-session")

    assert exc_info.value.code == "codex.session_not_found"
    assert exc_info.value.detail == {"session_id": "missing-session"}


def test_stream_returns_output_chunk_and_advances_cursor(tmp_path: Path) -> None:
    module = _load_terminal_use_cases_module()
    runtime = FakeTerminalRuntime(
        session_id="terminal-session-1",
        working_directory=tmp_path,
        output="hello world",
    )
    store = FakeTerminalSessionStore()
    store.save("terminal-session-1", runtime)
    use_case = module.CodexTerminalUseCases(
        gateway=FakeTerminalGateway(),
        session_store=store,
        session_id_factory=lambda: "ignored",
    )

    result = use_case.get_stream_chunk("terminal-session-1", cursor=6)

    assert result.session_id == "terminal-session-1"
    assert result.status == "running"
    assert result.output == "world"
    assert result.next_cursor == 11
    assert result.completed is False


def test_stream_limits_large_backlog_to_fixed_chunk_size(tmp_path: Path) -> None:
    module = _load_terminal_use_cases_module()
    models = importlib.import_module("backend.domain.codex_terminal.models")
    runtime = FakeTerminalRuntime(
        session_id="terminal-session-1",
        working_directory=tmp_path,
        output="x" * (models.MAX_STREAM_CHUNK_CHARS + 20),
    )
    store = FakeTerminalSessionStore()
    store.save("terminal-session-1", runtime)
    use_case = module.CodexTerminalUseCases(
        gateway=FakeTerminalGateway(),
        session_store=store,
        session_id_factory=lambda: "ignored",
    )

    result = use_case.get_stream_chunk("terminal-session-1", cursor=0)

    assert len(result.output) == models.MAX_STREAM_CHUNK_CHARS
    assert result.next_cursor == models.MAX_STREAM_CHUNK_CHARS
    assert result.has_backlog is True
    assert result.completed is False


def test_stream_keeps_closed_session_until_final_backlog_chunk(
    tmp_path: Path,
) -> None:
    module = _load_terminal_use_cases_module()
    models = importlib.import_module("backend.domain.codex_terminal.models")
    runtime = FakeTerminalRuntime(
        session_id="terminal-session-1",
        working_directory=tmp_path,
        status="closed",
        output="y" * (models.MAX_STREAM_CHUNK_CHARS + 5),
    )
    store = FakeTerminalSessionStore()
    store.save("terminal-session-1", runtime)
    use_case = module.CodexTerminalUseCases(
        gateway=FakeTerminalGateway(),
        session_store=store,
        session_id_factory=lambda: "ignored",
    )

    first = use_case.get_stream_chunk("terminal-session-1", cursor=0)

    assert len(first.output) == models.MAX_STREAM_CHUNK_CHARS
    assert first.has_backlog is True
    assert first.completed is False
    assert store.get("terminal-session-1") is runtime

    second = use_case.get_stream_chunk("terminal-session-1", cursor=first.next_cursor)

    assert second.output == "y" * 5
    assert second.has_backlog is False
    assert second.completed is True
    assert store.get("terminal-session-1") is None


def test_stream_marks_backlog_only_while_more_output_is_buffered(
    tmp_path: Path,
) -> None:
    module = _load_terminal_use_cases_module()
    models = importlib.import_module("backend.domain.codex_terminal.models")
    runtime = FakeTerminalRuntime(
        session_id="terminal-session-1",
        working_directory=tmp_path,
        output="z" * (models.MAX_STREAM_CHUNK_CHARS + 5),
    )
    store = FakeTerminalSessionStore()
    store.save("terminal-session-1", runtime)
    use_case = module.CodexTerminalUseCases(
        gateway=FakeTerminalGateway(),
        session_store=store,
        session_id_factory=lambda: "ignored",
    )

    first = use_case.get_stream_chunk("terminal-session-1", cursor=0)
    second = use_case.get_stream_chunk("terminal-session-1", cursor=first.next_cursor)

    assert first.has_backlog is True
    assert second.output == "z" * 5
    assert second.has_backlog is False


def test_write_input_passes_data_to_runtime(tmp_path: Path) -> None:
    module = _load_terminal_use_cases_module()
    runtime = FakeTerminalRuntime(
        session_id="terminal-session-1",
        working_directory=tmp_path,
    )
    store = FakeTerminalSessionStore()
    store.save("terminal-session-1", runtime)
    use_case = module.CodexTerminalUseCases(
        gateway=FakeTerminalGateway(),
        session_store=store,
        session_id_factory=lambda: "ignored",
    )

    result = use_case.write_input("terminal-session-1", data="/help\n")

    assert result.accepted is True
    assert runtime.written_inputs == ["/help\n"]


def test_close_session_marks_session_closed_and_removes_it(tmp_path: Path) -> None:
    module = _load_terminal_use_cases_module()
    runtime = FakeTerminalRuntime(
        session_id="terminal-session-1",
        working_directory=tmp_path,
    )
    store = FakeTerminalSessionStore()
    store.save("terminal-session-1", runtime)
    use_case = module.CodexTerminalUseCases(
        gateway=FakeTerminalGateway(),
        session_store=store,
        session_id_factory=lambda: "ignored",
    )

    result = use_case.close_session("terminal-session-1")

    assert result.session_id == "terminal-session-1"
    assert result.status == "closed"
    assert result.working_directory == str(tmp_path)
    assert store.get("terminal-session-1") is None


def test_get_session_removes_finished_runtime_after_returning_once(
    tmp_path: Path,
) -> None:
    module = _load_terminal_use_cases_module()
    runtime = FakeTerminalRuntime(
        session_id="terminal-session-1",
        working_directory=tmp_path,
        status="closed",
    )
    store = FakeTerminalSessionStore()
    store.save("terminal-session-1", runtime)
    use_case = module.CodexTerminalUseCases(
        gateway=FakeTerminalGateway(),
        session_store=store,
        session_id_factory=lambda: "ignored",
    )

    result = use_case.get_session("terminal-session-1")

    assert result.status == "closed"
    assert store.get("terminal-session-1") is None


def test_stream_removes_finished_runtime_after_final_chunk(
    tmp_path: Path,
) -> None:
    module = _load_terminal_use_cases_module()
    runtime = FakeTerminalRuntime(
        session_id="terminal-session-1",
        working_directory=tmp_path,
        status="closed",
        output="bye",
    )
    store = FakeTerminalSessionStore()
    store.save("terminal-session-1", runtime)
    use_case = module.CodexTerminalUseCases(
        gateway=FakeTerminalGateway(),
        session_store=store,
        session_id_factory=lambda: "ignored",
    )

    result = use_case.get_stream_chunk("terminal-session-1", cursor=0)

    assert result.status == "closed"
    assert result.output == "bye"
    assert result.completed is True
    assert store.get("terminal-session-1") is None
