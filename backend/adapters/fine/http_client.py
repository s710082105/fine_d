from __future__ import annotations

import json
import os
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from backend.adapters.fine.sql_preview_transport import build_sql_preview_transport
from backend.domain.datasource.models import ConnectionSummary, SqlPreviewResult
from backend.domain.project.errors import AppError

LOGIN_PATH = "/login"
LIST_CONNECTIONS_PATH = "/v10/config/connection/list/0"
PREVIEW_SQL_PATH = "/v10/dataset/preview"
DEFAULT_ROW_COUNT = 10
DEFAULT_TIMEOUT_SECONDS = 10


class FineHttpClient:
    def __init__(
        self,
        *,
        base_url: str,
        username: str,
        password: str,
        timeout_seconds: int = DEFAULT_TIMEOUT_SECONDS,
    ) -> None:
        self._base_url = base_url.rstrip("/")
        self._username = username
        self._password = password
        self._timeout_seconds = timeout_seconds

    @classmethod
    def from_env(cls) -> FineHttpClient:
        return cls(
            base_url=_require_env("FINE_DECISION_BASE_URL"),
            username=_require_env("FINE_DECISION_USERNAME"),
            password=_require_env("FINE_DECISION_PASSWORD"),
        )

    def list_connections(self) -> list[ConnectionSummary]:
        payload = self._get_json(LIST_CONNECTIONS_PATH, self._auth_headers())
        items = _data_items(payload)
        return [_parse_connection(item) for item in items]

    def preview_sql(self, connection_name: str, sql: str) -> SqlPreviewResult:
        landing_page = self._get_text("")
        transport = build_sql_preview_transport(landing_page, connection_name, sql)
        path = f"{PREVIEW_SQL_PATH}?rowCount={DEFAULT_ROW_COUNT}"
        payload = self._post_json(path, transport.body, self._auth_headers(transport.headers))
        return _parse_preview_result(payload)

    def _auth_headers(self, extra_headers: dict[str, str] | None = None) -> dict[str, str]:
        headers = {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self._access_token()}",
        }
        if extra_headers:
            headers.update(extra_headers)
        return headers

    def _access_token(self) -> str:
        login_payload = {
            "username": self._username,
            "password": self._password,
            "validity": -1,
            "sliderToken": "",
            "origin": "",
            "encrypted": False,
        }
        response = self._post_json(
            LOGIN_PATH,
            login_payload,
            {"Accept": "application/json", "Content-Type": "application/json"},
        )
        try:
            return response["data"]["accessToken"]
        except KeyError as error:
            raise AppError(
                code="datasource.invalid_login_response",
                message="FineReport 登录响应缺少 accessToken",
                detail={"response": response},
                source="datasource",
            ) from error

    def _get_json(self, path: str, headers: dict[str, str]) -> dict[str, Any]:
        return _load_json(self._send("GET", path, headers=headers))

    def _post_json(
        self,
        path: str,
        payload: dict[str, Any],
        headers: dict[str, str],
    ) -> dict[str, Any]:
        body = json.dumps(payload).encode("utf-8")
        return _load_json(self._send("POST", path, body=body, headers=headers))

    def _get_text(self, path: str) -> str:
        return self._send("GET", path, headers={}).decode("utf-8")

    def _send(
        self,
        method: str,
        path: str,
        *,
        headers: dict[str, str],
        body: bytes | None = None,
    ) -> bytes:
        request = Request(self._url(path), data=body, headers=headers, method=method)
        try:
            with urlopen(request, timeout=self._timeout_seconds) as response:
                return response.read()
        except HTTPError as error:
            raise _http_error(path, error) from error
        except URLError as error:
            raise AppError(
                code="datasource.request_failed",
                message="FineReport 请求失败",
                detail={"path": path, "reason": str(error.reason)},
                source="datasource",
                retryable=True,
            ) from error

    def _url(self, path: str) -> str:
        return f"{self._base_url}{path}"


def _require_env(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if value:
        return value
    raise AppError(
        code="datasource.missing_config",
        message="缺少 FineReport datasource 配置",
        detail={"field": name},
        source="datasource",
    )


def _http_error(path: str, error: HTTPError) -> AppError:
    detail = {
        "path": path,
        "status_code": error.code,
        "body": error.read().decode("utf-8", errors="replace"),
    }
    return AppError(
        code="datasource.http_error",
        message="FineReport 返回了非 200 响应",
        detail=detail,
        source="datasource",
    )


def _load_json(payload: bytes) -> dict[str, Any]:
    try:
        value = json.loads(payload.decode("utf-8"))
    except json.JSONDecodeError as error:
        raise AppError(
            code="datasource.invalid_response",
            message="FineReport 响应不是合法 JSON",
            detail={"body": payload.decode("utf-8", errors="replace")},
            source="datasource",
        ) from error
    if not isinstance(value, dict):
        raise AppError(
            code="datasource.invalid_response",
            message="FineReport 响应顶层不是对象",
            detail={"response": value},
            source="datasource",
        )
    return value


def _data_items(payload: dict[str, Any]) -> list[dict[str, Any]]:
    data = payload.get("data")
    if not isinstance(data, list):
        raise AppError(
            code="datasource.invalid_response",
            message="FineReport 连接列表缺少 data 数组",
            detail={"response": payload},
            source="datasource",
        )
    return [item for item in data if isinstance(item, dict)]


def _parse_connection(item: dict[str, Any]) -> ConnectionSummary:
    name = item.get("name") or item.get("connectionName")
    if not isinstance(name, str) or not name.strip():
        raise AppError(
            code="datasource.invalid_response",
            message="FineReport 连接项缺少名称",
            detail={"item": item},
            source="datasource",
        )
    return ConnectionSummary(name=name)


def _parse_preview_result(payload: dict[str, Any]) -> SqlPreviewResult:
    data = payload.get("data")
    if not isinstance(data, dict):
        raise AppError(
            code="datasource.invalid_response",
            message="FineReport SQL 预览缺少 data 对象",
            detail={"response": payload},
            source="datasource",
        )
    columns = [_parse_column_name(item) for item in _expect_list(data, "columns", payload)]
    rows = _expect_list(data, "rows", payload)
    return SqlPreviewResult(columns=columns, rows=rows)


def _parse_column_name(item: Any) -> str:
    if not isinstance(item, dict):
        raise AppError(
            code="datasource.invalid_response",
            message="FineReport 列定义不是对象",
            detail={"item": item},
            source="datasource",
        )
    name = item.get("name") or item.get("columnName")
    if not isinstance(name, str) or not name.strip():
        raise AppError(
            code="datasource.invalid_response",
            message="FineReport 列定义缺少名称",
            detail={"item": item},
            source="datasource",
        )
    return name


def _expect_list(data: dict[str, Any], key: str, payload: dict[str, Any]) -> list[Any]:
    value = data.get(key)
    if isinstance(value, list):
        return value
    raise AppError(
        code="datasource.invalid_response",
        message=f"FineReport 响应缺少 {key} 数组",
        detail={"response": payload},
        source="datasource",
    )
