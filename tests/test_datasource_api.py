from fastapi.testclient import TestClient

from apps.api.routes.datasource import get_datasource_service
from backend.app_factory import create_app
from backend.domain.datasource.models import ConnectionSummary, SqlPreviewResult
from backend.domain.project.errors import AppError


class FakeDatasourceService:
    def list_connections(self) -> list[ConnectionSummary]:
        return [ConnectionSummary(name="qzcs")]

    def preview_sql(self, connection_name: str, sql: str) -> SqlPreviewResult:
        assert connection_name == "qzcs"
        assert sql == "select 1 as ok"
        return SqlPreviewResult(columns=["ok"], rows=[[1]])


class FailingDatasourceService:
    def list_connections(self) -> list[ConnectionSummary]:
        raise AppError(
            code="datasource.invalid_response",
            message="bad response",
            detail={"path": "/v10/config/connection/list/0"},
            source="datasource",
        )

    def preview_sql(self, connection_name: str, sql: str) -> SqlPreviewResult:
        raise AssertionError("preview_sql should not be called in this test")


def test_connections_endpoint_returns_expected_schema() -> None:
    app = create_app()
    app.dependency_overrides[get_datasource_service] = lambda: FakeDatasourceService()
    client = TestClient(app)

    response = client.get("/api/datasource/connections")

    assert response.status_code == 200
    assert response.json() == [{"name": "qzcs"}]


def test_preview_sql_endpoint_returns_expected_schema() -> None:
    app = create_app()
    app.dependency_overrides[get_datasource_service] = lambda: FakeDatasourceService()
    client = TestClient(app)

    response = client.post(
        "/api/datasource/preview-sql",
        json={"connection_name": "qzcs", "sql": "select 1 as ok"},
    )

    assert response.status_code == 200
    assert response.json() == {"columns": ["ok"], "rows": [[1]]}


def test_datasource_route_app_error_uses_unified_json_response() -> None:
    app = create_app()
    app.dependency_overrides[get_datasource_service] = lambda: FailingDatasourceService()
    client = TestClient(app)

    response = client.get("/api/datasource/connections")

    assert response.status_code == 400
    assert response.json() == {
        "code": "datasource.invalid_response",
        "message": "bad response",
        "detail": {"path": "/v10/config/connection/list/0"},
        "source": "datasource",
        "retryable": False,
    }
