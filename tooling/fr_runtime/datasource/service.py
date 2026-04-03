"""Datasource normalization and preview services."""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Callable, Protocol


class DatasourceGateway(Protocol):
    def list_connections(self, username: str, password: str) -> list[dict[str, object]]: ...

    def list_datasets(self, username: str, password: str) -> list[dict[str, object]]: ...

    def preview_dataset(
        self,
        username: str,
        password: str,
        payload: dict[str, object],
        row_count: int,
    ) -> dict[str, object]: ...


def normalize_connection(item: dict[str, object]) -> dict[str, str]:
    return {
        "name": str(item.get("name") or item["connectionName"]),
        "database_type": str(item.get("databaseType") or item.get("type") or item.get("driver") or "UNKNOWN"),
    }


def normalize_dataset(item: dict[str, object]) -> dict[str, str]:
    name = item.get("datasetName") or item.get("name") or item.get("id") or "unknown"
    dataset_type = item.get("datasetType") or item.get("type") or "unknown"
    return {"name": str(name), "dataset_type": str(dataset_type)}


def build_preview_payload(connection_name: str, encrypted_query: str) -> dict[str, object]:
    dataset_data = {
        "database": connection_name,
        "query": encrypted_query,
        "parameters": [],
    }
    return {
        "datasetType": "sql",
        "datasetName": "sql-preview",
        "datasetData": json.dumps(dataset_data, ensure_ascii=False),
    }


@dataclass(frozen=True)
class DatasourceService:
    gateway: DatasourceGateway
    encrypt_sql: Callable[[str], str]

    def list_connections(self, username: str, password: str) -> list[dict[str, str]]:
        return [
            normalize_connection(item)
            for item in self.gateway.list_connections(username, password)
        ]

    def list_datasets(self, username: str, password: str) -> list[dict[str, str]]:
        return [
            normalize_dataset(item)
            for item in self.gateway.list_datasets(username, password)
        ]

    def preview_sql(
        self,
        username: str,
        password: str,
        connection_name: str,
        sql: str,
        row_count: int = 200,
    ) -> dict[str, object]:
        encrypted_query = self.encrypt_sql(sql)
        payload = build_preview_payload(connection_name, encrypted_query)
        return self.gateway.preview_dataset(username, password, payload, row_count)
