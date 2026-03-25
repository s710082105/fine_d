from __future__ import annotations

from typing import Any
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from backend.domain.datasource.models import ConnectionSummary
from backend.domain.project.errors import AppError

JDBC_PREFIX = "jdbc:"
REDACTED = "***"
ORACLE_THIN_PREFIX = "oracle:thin:"
SQLSERVER_PREFIX = "sqlserver://"
SENSITIVE_QUERY_KEYS = {
    "password",
    "passwd",
    "pwd",
    "secret",
    "access_token",
    "token",
    "user",
    "username",
}


def parse_connection(item: dict[str, Any]) -> ConnectionSummary:
    name = item.get("name") or item.get("connectionName")
    if not isinstance(name, str) or not name.strip():
        raise AppError(
            code="datasource.invalid_response",
            message="FineReport 连接项缺少名称",
            detail={"item": item},
            source="datasource",
        )
    return ConnectionSummary(
        name=name,
        database_type=_first_text(item, "databaseType", "type", "driver"),
        host_or_url=_connection_host_or_url(item),
    )


def _first_text(item: dict[str, Any], *keys: str) -> str:
    for key in keys:
        value = item.get(key)
        if isinstance(value, str):
            stripped = value.strip()
            if stripped:
                return stripped
    return ""


def _connection_host_or_url(item: dict[str, Any]) -> str:
    direct_value = _first_text(item, "url", "jdbcUrl")
    if direct_value:
        return _sanitize_connection_url(direct_value)

    host = _first_text(item, "host")
    if not host:
        return ""

    port = _format_port(item.get("port"))
    database = _first_text(item, "database")
    host_with_port = f"{host}:{port}" if port else host
    if database:
        return f"{host_with_port}/{database}"
    return host_with_port


def _format_port(value: Any) -> str:
    if isinstance(value, int):
        return str(value)
    if isinstance(value, str):
        stripped = value.strip()
        if stripped:
            return stripped
    return ""


def _sanitize_connection_url(value: str) -> str:
    if value.startswith(JDBC_PREFIX):
        sanitized = _sanitize_jdbc_url(value[len(JDBC_PREFIX) :])
        return f"{JDBC_PREFIX}{sanitized}"
    return _sanitize_standard_url(value)


def _sanitize_jdbc_url(value: str) -> str:
    if value.startswith(ORACLE_THIN_PREFIX):
        return _sanitize_oracle_thin_url(value)
    if value.startswith(SQLSERVER_PREFIX):
        return _sanitize_sqlserver_url(value)
    return _sanitize_standard_url(value)


def _sanitize_oracle_thin_url(value: str) -> str:
    suffix = value[len(ORACLE_THIN_PREFIX) :]
    if suffix.startswith("@") or "@" not in suffix:
        return value
    credentials, target = suffix.split("@", 1)
    if "/" not in credentials:
        return value
    return f"{ORACLE_THIN_PREFIX}@{target}"


def _sanitize_sqlserver_url(value: str) -> str:
    suffix = value[len(SQLSERVER_PREFIX) :]
    host_part, separator, properties = suffix.partition(";")
    safe_host = _strip_userinfo(host_part)
    if not separator:
        return f"{SQLSERVER_PREFIX}{safe_host}"
    safe_properties = ";".join(
        _sanitize_sqlserver_property(item)
        for item in _split_sqlserver_properties(properties)
    )
    return f"{SQLSERVER_PREFIX}{safe_host};{safe_properties}"


def _sanitize_sqlserver_property(item: str) -> str:
    key, separator, property_value = item.partition("=")
    if not separator:
        return item
    if key.strip().lower() not in SENSITIVE_QUERY_KEYS:
        return item
    return f"{key}{separator}{REDACTED}"


def _split_sqlserver_properties(value: str) -> list[str]:
    items: list[str] = []
    current: list[str] = []
    brace_depth = 0
    for char in value:
        if char == ";" and brace_depth == 0:
            items.append("".join(current))
            current = []
            continue
        current.append(char)
        if char == "{":
            brace_depth += 1
            continue
        if char == "}" and brace_depth > 0:
            brace_depth -= 1
    items.append("".join(current))
    return items


def _sanitize_standard_url(value: str) -> str:
    parsed = urlsplit(value)
    if not parsed.scheme or not parsed.netloc:
        return value
    return urlunsplit(
        (
            parsed.scheme,
            _strip_userinfo(parsed.netloc),
            parsed.path,
            _sanitize_query(parsed.query),
            parsed.fragment,
        )
    )


def _strip_userinfo(netloc: str) -> str:
    if "@" not in netloc:
        return netloc
    return netloc.rsplit("@", 1)[1]


def _sanitize_query(query: str) -> str:
    if not query:
        return ""
    pairs = parse_qsl(query, keep_blank_values=True)
    safe_pairs = [
        (key, REDACTED if key.lower() in SENSITIVE_QUERY_KEYS else value)
        for key, value in pairs
    ]
    return urlencode(safe_pairs, doseq=True)
