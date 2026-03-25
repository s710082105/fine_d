from typing import Protocol

from backend.domain.datasource.models import ConnectionSummary, SqlPreviewResult


class DatasourceGateway(Protocol):
    def list_connections(self) -> list[ConnectionSummary]:
        ...

    def preview_sql(self, connection_name: str, sql: str) -> SqlPreviewResult:
        ...


class DatasourceUseCases:
    def __init__(self, gateway: DatasourceGateway) -> None:
        self._gateway = gateway

    def list_connections(self) -> list[ConnectionSummary]:
        return self._gateway.list_connections()

    def preview_sql(self, connection_name: str, sql: str) -> SqlPreviewResult:
        return self._gateway.preview_sql(connection_name, sql)
