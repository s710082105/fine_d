import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from backend.application.datasource.project_use_cases import ProjectDatasourceUseCases
from backend.domain.codex_terminal.models import (
    CodexTerminalRuntime,
    MAX_STREAM_CHUNK_CHARS,
)
from backend.domain.datasource.models import ConnectionSummary, SqlPreviewResult

TOOL_REQUEST_PREFIX = "@@FR_TOOL "
TOOL_RESULT_PREFIX = "@@FR_TOOL_RESULT"


@dataclass(frozen=True, slots=True)
class CodexHostToolRequest:
    request_id: str
    name: str
    args: dict[str, Any]


class ToolProtocolError(ValueError):
    pass


class CodexHostToolExecutor:
    def __init__(
        self,
        project_path: Path,
        datasource_use_cases: ProjectDatasourceUseCases,
    ) -> None:
        self._project_path = Path(project_path)
        self._datasource_use_cases = datasource_use_cases

    def execute(self, request: CodexHostToolRequest) -> str:
        try:
            if request.name == "fr.list_connections":
                return _success_result(
                    request.request_id,
                    {
                        "connections": [
                            _serialize_connection(item)
                            for item in self._datasource_use_cases.list_connections(
                                self._project_path,
                            )
                        ]
                    },
                )
            if request.name == "fr.preview_sql":
                connection_name = _require_string_arg(
                    request.args,
                    "connection_name",
                )
                sql = _require_string_arg(request.args, "sql")
                result = self._datasource_use_cases.preview_sql(
                    self._project_path,
                    connection_name,
                    sql,
                )
                return _success_result(
                    request.request_id,
                    _serialize_sql_preview(result),
                )
            return _error_result(
                request.request_id,
                "codex.tool_unknown",
                f"unsupported host tool: {request.name}",
            )
        except Exception as error:
            return _error_result(
                request.request_id,
                "codex.tool_failed",
                str(error),
            )


class ToolAwareTerminalRuntime:
    def __init__(
        self,
        runtime: CodexTerminalRuntime,
        datasource_use_cases: ProjectDatasourceUseCases,
    ) -> None:
        self.session_id = runtime.session_id
        self.working_directory = runtime.working_directory
        self._runtime = runtime
        self._executor = CodexHostToolExecutor(
            runtime.working_directory,
            datasource_use_cases,
        )
        self._raw_cursor = 0
        self._visible_buffer = ""
        self._pending_prefix = ""
        self._pending_tool_line = ""
        self._line_start = True
        self._skip_lf_after_cr = False

    @property
    def status(self) -> str:
        return self._runtime.status

    def read(self, cursor: int) -> tuple[str, int, bool]:
        output, next_cursor, completed = self._runtime.read(self._raw_cursor)
        if output:
            self._raw_cursor = next_cursor
            self._consume(output)
        elif completed:
            self._raw_cursor = next_cursor
        if completed:
            self._flush_pending()
        total_length = len(self._visible_buffer)
        next_visible_cursor = min(total_length, cursor + MAX_STREAM_CHUNK_CHARS)
        chunk = self._visible_buffer[cursor:next_visible_cursor]
        stream_completed = completed and next_visible_cursor >= total_length
        return chunk, next_visible_cursor, stream_completed

    def write(self, data: str) -> None:
        self._runtime.write(data)

    def close(self) -> None:
        self._runtime.close()

    def _consume(self, raw_output: str) -> None:
        for character in raw_output:
            self._consume_character(character)

    def _consume_character(self, character: str) -> None:
        if self._skip_lf_after_cr and character == "\n":
            self._skip_lf_after_cr = False
            self._line_start = True
            return
        self._skip_lf_after_cr = False
        if self._pending_tool_line:
            self._pending_tool_line += character
            if character == "\r":
                self._finalize_tool_line(skip_following_lf=True)
            elif character == "\n":
                self._finalize_tool_line(skip_following_lf=False)
            return
        if self._line_start:
            candidate = self._pending_prefix + character
            if TOOL_REQUEST_PREFIX.startswith(candidate):
                self._pending_prefix = candidate
                if candidate == TOOL_REQUEST_PREFIX:
                    self._pending_tool_line = candidate
                    self._pending_prefix = ""
                return
            if self._pending_prefix:
                self._visible_buffer += self._pending_prefix
                self._pending_prefix = ""
                self._line_start = False
            if character in {"\r", "\n"}:
                self._visible_buffer += character
                self._line_start = True
                return
        self._visible_buffer += character
        self._line_start = character in {"\r", "\n"}

    def _finalize_tool_line(self, *, skip_following_lf: bool) -> None:
        stripped = self._pending_tool_line.rstrip("\r\n")
        tool_result = self._execute_tool(stripped)
        self._runtime.write(tool_result)
        self._pending_tool_line = ""
        self._line_start = True
        self._skip_lf_after_cr = skip_following_lf

    def _flush_pending(self) -> None:
        if self._pending_tool_line:
            stripped = self._pending_tool_line.rstrip("\r\n")
            if stripped.startswith(TOOL_REQUEST_PREFIX):
                self._runtime.write(self._execute_tool(stripped))
            else:
                self._visible_buffer += self._pending_tool_line
            self._pending_tool_line = ""
        if self._pending_prefix:
            self._visible_buffer += self._pending_prefix
            self._pending_prefix = ""

    def _execute_tool(self, line: str) -> str:
        try:
            request = _parse_tool_request(line)
        except ToolProtocolError as error:
            return _error_result(None, "codex.tool_protocol_invalid", str(error))
        return self._executor.execute(request)


def _parse_tool_request(line: str) -> CodexHostToolRequest:
    if not line.startswith(TOOL_REQUEST_PREFIX):
        raise ToolProtocolError("missing @@FR_TOOL prefix")
    payload_text = line.removeprefix(TOOL_REQUEST_PREFIX)
    try:
        payload = json.loads(payload_text)
    except json.JSONDecodeError as error:
        raise ToolProtocolError("invalid tool request payload") from error
    if not isinstance(payload, dict):
        raise ToolProtocolError("tool request must be an object")
    request_id = payload.get("id")
    name = payload.get("name")
    args = payload.get("args", {})
    if not isinstance(request_id, str) or request_id == "":
        raise ToolProtocolError("tool request id is required")
    if not isinstance(name, str) or name == "":
        raise ToolProtocolError("tool request name is required")
    if not isinstance(args, dict):
        raise ToolProtocolError("tool request args must be an object")
    return CodexHostToolRequest(request_id=request_id, name=name, args=args)


def _require_string_arg(args: dict[str, Any], key: str) -> str:
    value = args.get(key)
    if isinstance(value, str) and value != "":
        return value
    raise ToolProtocolError(f"tool argument {key} is required")


def _serialize_connection(item: ConnectionSummary) -> dict[str, str]:
    return {
        "name": item.name,
        "database_type": item.database_type,
    }


def _serialize_sql_preview(result: SqlPreviewResult) -> dict[str, Any]:
    return {
        "columns": result.columns,
        "rows": result.rows,
    }


def _success_result(request_id: str, data: dict[str, Any]) -> str:
    return _result_line({"id": request_id, "ok": True, "data": data})


def _error_result(
    request_id: str | None,
    code: str,
    message: str,
) -> str:
    return _result_line(
        {
            "id": request_id,
            "ok": False,
            "error": {"code": code, "message": message},
        }
    )


def _result_line(payload: dict[str, Any]) -> str:
    encoded = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    return f"{TOOL_RESULT_PREFIX} {encoded}\n"
