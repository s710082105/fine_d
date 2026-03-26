from pathlib import Path

from backend.domain.codex_terminal.models import CodexTerminalRuntime
from backend.domain.datasource.models import ConnectionSummary, SqlPreviewResult


class FakeRuntime:
    def __init__(self, output: str) -> None:
        self.session_id = "terminal-session-1"
        self.working_directory = Path("/tmp/project-alpha")
        self.status = "running"
        self._output = output
        self.written_inputs: list[str] = []

    def read(self, cursor: int) -> tuple[str, int, bool]:
        return self._output[cursor:], len(self._output), False

    def write(self, data: str) -> None:
        self.written_inputs.append(data)

    def close(self) -> None:
        self.status = "closed"


class FakeProjectDatasourceUseCases:
    def __init__(self) -> None:
        self.connection_calls: list[Path] = []
        self.preview_calls: list[tuple[Path, str, str]] = []

    def list_connections(self, project_path: Path) -> list[ConnectionSummary]:
        self.connection_calls.append(project_path)
        return [ConnectionSummary(name="FRDemo", database_type="MYSQL")]

    def preview_sql(
        self,
        project_path: Path,
        connection_name: str,
        sql: str,
    ) -> SqlPreviewResult:
        self.preview_calls.append((project_path, connection_name, sql))
        return SqlPreviewResult(columns=["ok"], rows=[[1]])


def test_tool_aware_runtime_executes_preview_sql_request_and_hides_marker() -> None:
    from backend.application.codex_terminal.tool_runtime import ToolAwareTerminalRuntime

    runtime = FakeRuntime(
        "before\n"
        '@@FR_TOOL {"id":"req_1","name":"fr.preview_sql","args":{"connection_name":"FRDemo","sql":"select 1 as ok"}}\n'
        "after\n"
    )
    datasource_use_cases = FakeProjectDatasourceUseCases()
    wrapped = ToolAwareTerminalRuntime(
        runtime,
        datasource_use_cases,
    )

    output, next_cursor, completed = wrapped.read(0)

    assert output == "before\nafter\n"
    assert next_cursor == len("before\nafter\n")
    assert completed is False
    assert datasource_use_cases.preview_calls == [
        (Path("/tmp/project-alpha"), "FRDemo", "select 1 as ok")
    ]
    assert runtime.written_inputs == [
        '@@FR_TOOL_RESULT {"id":"req_1","ok":true,"data":{"columns":["ok"],"rows":[[1]]}}\n'
    ]


def test_tool_aware_runtime_executes_list_connections_request() -> None:
    from backend.application.codex_terminal.tool_runtime import ToolAwareTerminalRuntime

    runtime = FakeRuntime('@@FR_TOOL {"id":"req_2","name":"fr.list_connections","args":{}}\n')
    datasource_use_cases = FakeProjectDatasourceUseCases()
    wrapped = ToolAwareTerminalRuntime(runtime, datasource_use_cases)

    output, next_cursor, _ = wrapped.read(0)

    assert output == ""
    assert next_cursor == 0
    assert datasource_use_cases.connection_calls == [Path("/tmp/project-alpha")]
    assert runtime.written_inputs == [
        '@@FR_TOOL_RESULT {"id":"req_2","ok":true,"data":{"connections":[{"name":"FRDemo","database_type":"MYSQL"}]}}\n'
    ]


def test_tool_aware_runtime_returns_structured_error_for_unknown_tool() -> None:
    from backend.application.codex_terminal.tool_runtime import ToolAwareTerminalRuntime

    runtime = FakeRuntime('@@FR_TOOL {"id":"req_3","name":"fr.unknown","args":{}}\n')
    wrapped = ToolAwareTerminalRuntime(runtime, FakeProjectDatasourceUseCases())

    output, next_cursor, _ = wrapped.read(0)

    assert output == ""
    assert next_cursor == 0
    assert runtime.written_inputs == [
        '@@FR_TOOL_RESULT {"id":"req_3","ok":false,"error":{"code":"codex.tool_unknown","message":"unsupported host tool: fr.unknown"}}\n'
    ]
