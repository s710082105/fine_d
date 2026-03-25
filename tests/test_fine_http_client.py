from __future__ import annotations

import json
import threading
from collections.abc import Iterator
from dataclasses import dataclass
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import pytest

from backend.adapters.fine.http_client import (
    FineHttpClient,
    _data_items,
    _parse_connection,
)
from backend.adapters.fine.sql_preview_transport import build_sql_preview_transport
from backend.domain.datasource.models import ConnectionSummary
from backend.domain.project.errors import AppError


LANDING_PAGE = (
    "<!DOCTYPE html><script>Dec.system = JSON.parse("
    "'{\\\"encryptionType\\\":0,\\\"transmissionEncryption\\\":2,"
    "\\\"encryptionKey\\\":\\\"MFwwDQYJKoZIhvcNAQEBBQADSwAwSAJBANPDl9Pe4fz2PjPXbUrbNVQAS/"
    "jm9uuR+K7Mn/N+gddfRPhaLQjNNwFJVDDG1VTnw6sRjhcO2vHuDs+FjqOG/YECAwEAAQ==\\\"}'"
    ");</script>"
)


@dataclass(frozen=True, slots=True)
class RecordedRequest:
    method: str
    path: str
    headers: dict[str, str]
    body: str


class FineTestHandler(BaseHTTPRequestHandler):
    requests: list[RecordedRequest] = []
    landing_page: str = LANDING_PAGE
    connections_payload: dict[str, object] = {"data": [{"name": "qzcs"}]}

    def do_GET(self) -> None:  # noqa: N802
        self._record_request()
        if self.path == "/webroot/decision":
            self._write_response(
                200,
                FineTestHandler.landing_page,
                "text/html; charset=utf-8",
            )
            return
        if self.path == "/webroot/decision/v10/config/connection/list/0":
            self._write_response(200, FineTestHandler.connections_payload)
            return
        self._write_response(404, {"error": "not found"})

    def do_POST(self) -> None:  # noqa: N802
        body = self._record_request()
        if self.path == "/webroot/decision/login":
            self._write_response(200, {"data": {"accessToken": "token-1"}})
            return
        if self.path == "/webroot/decision/v10/dataset/preview?rowCount=10":
            payload = json.loads(body)
            dataset = json.loads(payload["datasetData"])
            assert payload["datasetType"] == "sql"
            assert dataset["database"] == "qzcs"
            assert dataset["query"] != "select 1 as ok"
            self._write_response(
                200,
                {"data": {"columns": [{"name": "ok"}], "rows": [[1]]}},
            )
            return
        self._write_response(404, {"error": "not found"})

    def log_message(self, format: str, *args: object) -> None:
        return

    def _record_request(self) -> str:
        content_length = int(self.headers.get("Content-Length", "0"))
        body = self.rfile.read(content_length).decode("utf-8") if content_length else ""
        FineTestHandler.requests.append(
            RecordedRequest(
                method=self.command,
                path=self.path,
                headers={key.lower(): value for key, value in self.headers.items()},
                body=body,
            )
        )
        return body

    def _write_response(
        self,
        status_code: int,
        body: str | dict[str, object],
        content_type: str = "application/json",
    ) -> None:
        payload = body if isinstance(body, str) else json.dumps(body)
        encoded = payload.encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)


@pytest.fixture
def fine_server() -> Iterator[tuple[str, list[RecordedRequest]]]:
    FineTestHandler.requests = []
    FineTestHandler.landing_page = LANDING_PAGE
    FineTestHandler.connections_payload = {"data": [{"name": "qzcs"}]}
    server = ThreadingHTTPServer(("127.0.0.1", 0), FineTestHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    base_url = f"http://127.0.0.1:{server.server_port}/webroot/decision"
    try:
        yield base_url, FineTestHandler.requests
    finally:
        server.shutdown()
        thread.join()
        server.server_close()


def test_list_connections_reads_remote_items(
    fine_server: tuple[str, list[RecordedRequest]],
) -> None:
    base_url, requests = fine_server
    client = FineHttpClient(base_url=base_url, username="admin", password="admin")

    result = client.list_connections()

    assert result[0].name == "qzcs"
    assert requests[0].path == "/webroot/decision/login"
    assert requests[1].path == "/webroot/decision/v10/config/connection/list/0"


def test_list_connections_extracts_type_and_host_url() -> None:
    payload = {
        "data": [
            {
                "name": "qzcs",
                "databaseType": "MYSQL",
                "url": "jdbc:mysql://127.0.0.1:3306/demo",
            }
        ]
    }

    result = _data_items(payload)

    assert _parse_connection(result[0]) == ConnectionSummary(
        name="qzcs",
        database_type="MYSQL",
        host_or_url="jdbc:mysql://127.0.0.1:3306/demo",
    )


def test_list_connections_falls_back_to_type_for_database_type() -> None:
    item = {
        "name": "qzcs",
        "type": "POSTGRESQL",
        "url": "jdbc:postgresql://127.0.0.1:5432/demo",
    }

    assert _parse_connection(item) == ConnectionSummary(
        name="qzcs",
        database_type="POSTGRESQL",
        host_or_url="jdbc:postgresql://127.0.0.1:5432/demo",
    )


def test_list_connections_falls_back_to_driver_for_database_type() -> None:
    item = {
        "name": "qzcs",
        "driver": "com.mysql.cj.jdbc.Driver",
        "url": "jdbc:mysql://127.0.0.1:3306/demo",
    }

    assert _parse_connection(item) == ConnectionSummary(
        name="qzcs",
        database_type="com.mysql.cj.jdbc.Driver",
        host_or_url="jdbc:mysql://127.0.0.1:3306/demo",
    )


def test_list_connections_falls_back_to_jdbc_url() -> None:
    item = {
        "name": "qzcs",
        "databaseType": "MYSQL",
        "jdbcUrl": "jdbc:mysql://127.0.0.1:3306/demo",
    }

    assert _parse_connection(item) == ConnectionSummary(
        name="qzcs",
        database_type="MYSQL",
        host_or_url="jdbc:mysql://127.0.0.1:3306/demo",
    )


def test_list_connections_builds_host_summary_when_url_missing() -> None:
    item = {
        "name": "qzcs",
        "databaseType": "MYSQL",
        "host": "127.0.0.1",
        "port": 3306,
        "database": "demo",
    }

    assert _parse_connection(item) == ConnectionSummary(
        name="qzcs",
        database_type="MYSQL",
        host_or_url="127.0.0.1:3306/demo",
    )


def test_list_connections_masks_credentials_in_jdbc_url() -> None:
    item = {
        "name": "qzcs",
        "databaseType": "MYSQL",
        "jdbcUrl": "jdbc:mysql://demo-user:secret@127.0.0.1:3306/demo?password=secret&ssl=true",
    }

    result = _parse_connection(item)

    assert result.database_type == "MYSQL"
    assert result.host_or_url == "jdbc:mysql://127.0.0.1:3306/demo?password=%2A%2A%2A&ssl=true"
    assert "secret" not in result.host_or_url
    assert "demo-user" not in result.host_or_url


def test_list_connections_masks_credentials_in_oracle_thin_jdbc_url() -> None:
    item = {
        "name": "qzcs",
        "databaseType": "ORACLE",
        "jdbcUrl": "jdbc:oracle:thin:scott/tiger@//127.0.0.1:1521/orclpdb1",
    }

    result = _parse_connection(item)

    assert result.database_type == "ORACLE"
    assert result.host_or_url == "jdbc:oracle:thin:@//127.0.0.1:1521/orclpdb1"
    assert "scott" not in result.host_or_url
    assert "tiger" not in result.host_or_url


def test_list_connections_masks_credentials_in_sqlserver_jdbc_url() -> None:
    item = {
        "name": "qzcs",
        "databaseType": "SQLSERVER",
        "jdbcUrl": "jdbc:sqlserver://127.0.0.1:1433;databaseName=test;user=sa;password=secret",
    }

    result = _parse_connection(item)

    assert result.database_type == "SQLSERVER"
    assert (
        result.host_or_url
        == "jdbc:sqlserver://127.0.0.1:1433;databaseName=test;user=***;password=***"
    )
    assert "secret" not in result.host_or_url
    assert "user=sa" not in result.host_or_url


def test_preview_sql_encrypts_request_after_loading_landing_page(
    fine_server: tuple[str, list[RecordedRequest]],
) -> None:
    base_url, requests = fine_server
    client = FineHttpClient(base_url=base_url, username="admin", password="admin")

    preview = client.preview_sql("qzcs", "select 1 as ok")

    assert preview.columns == ["ok"]
    assert any(request.path == "/webroot/decision" for request in requests)
    preview_request = next(
        request
        for request in requests
        if request.path == "/webroot/decision/v10/dataset/preview?rowCount=10"
    )
    assert preview_request.headers["transencryptlevel"] == "1"


def test_list_connections_rejects_non_object_items(
    fine_server: tuple[str, list[RecordedRequest]],
) -> None:
    base_url, _ = fine_server
    FineTestHandler.connections_payload = {"data": [{"name": "qzcs"}, "bad-item"]}
    client = FineHttpClient(base_url=base_url, username="admin", password="admin")

    with pytest.raises(AppError) as exc_info:
        client.list_connections()

    assert exc_info.value.code == "datasource.invalid_response"
    assert exc_info.value.detail == {"item": "bad-item"}


def test_preview_sql_rejects_missing_encryption_type() -> None:
    landing_page = "<!DOCTYPE html><script>Dec.system = JSON.parse('{\\\"encryptionKey\\\":\\\"abc\\\"}');</script>"

    with pytest.raises(AppError) as exc_info:
        build_sql_preview_transport(landing_page, "qzcs", "select 1 as ok")

    assert exc_info.value.code == "datasource.invalid_landing_page"


def test_preview_sql_rejects_invalid_encryption_key() -> None:
    landing_page = "<!DOCTYPE html><script>Dec.system = JSON.parse('{\\\"encryptionType\\\":0,\\\"encryptionKey\\\":\\\"%%%\\\"}');</script>"

    with pytest.raises(AppError) as exc_info:
        build_sql_preview_transport(landing_page, "qzcs", "select 1 as ok")

    assert exc_info.value.code == "datasource.invalid_landing_page"
