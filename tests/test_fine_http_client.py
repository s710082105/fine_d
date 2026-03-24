from __future__ import annotations

import json
import threading
from collections.abc import Iterator
from dataclasses import dataclass
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import pytest

from backend.adapters.fine.http_client import FineHttpClient


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

    def do_GET(self) -> None:  # noqa: N802
        self._record_request()
        if self.path == "/webroot/decision":
            self._write_response(200, LANDING_PAGE, "text/html; charset=utf-8")
            return
        if self.path == "/webroot/decision/v10/config/connection/list/0":
            self._write_response(200, {"data": [{"name": "qzcs"}]})
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
