from collections.abc import Iterator

import pytest

from backend.application.datasource.use_cases import DatasourceUseCases
from backend.domain.datasource.models import ConnectionSummary, SqlPreviewResult


class FakeFineGateway:
    def list_connections(self) -> list[ConnectionSummary]:
        return [ConnectionSummary(name="qzcs")]

    def preview_sql(self, connection_name: str, sql: str) -> SqlPreviewResult:
        assert connection_name == "qzcs"
        assert sql == "select 1 as ok"
        return SqlPreviewResult(columns=["ok"], rows=[[1]])


@pytest.fixture
def fake_fine_gateway() -> Iterator[FakeFineGateway]:
    yield FakeFineGateway()


def test_list_connections_returns_remote_items(fake_fine_gateway: FakeFineGateway) -> None:
    use_case = DatasourceUseCases(fake_fine_gateway)

    result = use_case.list_connections()

    assert result[0].name == "qzcs"


def test_preview_sql_uses_configured_connection(
    fake_fine_gateway: FakeFineGateway,
) -> None:
    use_case = DatasourceUseCases(fake_fine_gateway)

    preview = use_case.preview_sql("qzcs", "select 1 as ok")

    assert preview.columns == ["ok"]
