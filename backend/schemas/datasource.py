from typing import Any

from pydantic import BaseModel, ConfigDict

from backend.domain.datasource.models import ConnectionSummary, SqlPreviewResult


class ConnectionSummaryResponse(BaseModel):
    model_config = ConfigDict(frozen=True)

    name: str
    database_type: str

    @classmethod
    def from_domain(cls, item: ConnectionSummary) -> "ConnectionSummaryResponse":
        return cls(
            name=item.name,
            database_type=item.database_type,
        )


class SqlPreviewRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    connection_name: str
    sql: str


class SqlPreviewResponse(BaseModel):
    model_config = ConfigDict(frozen=True)

    columns: list[str]
    rows: list[list[Any]]

    @classmethod
    def from_domain(cls, result: SqlPreviewResult) -> "SqlPreviewResponse":
        return cls(columns=result.columns, rows=result.rows)
