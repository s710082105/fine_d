import json

from tooling.fr_runtime.datasource.service import DatasourceService, normalize_connection


def test_normalize_connection_prefers_name_and_database_type() -> None:
    item = {"connectionName": "FRDemo", "databaseType": "MYSQL"}
    assert normalize_connection(item) == {
        "name": "FRDemo",
        "database_type": "MYSQL",
    }


def test_datasource_service_normalizes_connections_and_datasets() -> None:
    class FakeGateway:
        def list_connections(self, username: str, password: str) -> list[dict[str, str]]:
            assert username == "admin"
            assert password == "admin"
            return [{"connectionName": "FRDemo", "databaseType": "MYSQL"}]

        def list_datasets(self, username: str, password: str) -> list[dict[str, str]]:
            return [{"datasetName": "ds_users", "datasetType": "sql"}]

    service = DatasourceService(gateway=FakeGateway(), encrypt_sql=lambda sql: sql)

    assert service.list_connections("admin", "admin") == [
        {"name": "FRDemo", "database_type": "MYSQL"}
    ]
    assert service.list_datasets("admin", "admin") == [
        {"name": "ds_users", "dataset_type": "sql"}
    ]


def test_datasource_service_encrypts_sql_before_preview() -> None:
    recorded: dict[str, object] = {}

    class FakeGateway:
        def preview_dataset(
            self,
            username: str,
            password: str,
            payload: dict[str, object],
            row_count: int,
        ) -> dict[str, object]:
            recorded["username"] = username
            recorded["password"] = password
            recorded["payload"] = payload
            recorded["row_count"] = row_count
            return {"columnNames": ["ok"], "rows": [[1]]}

    service = DatasourceService(
        gateway=FakeGateway(),
        encrypt_sql=lambda sql: f"enc::{sql}",
    )

    result = service.preview_sql(
        "admin",
        "admin",
        connection_name="FRDemo",
        sql="select 1 as ok",
        row_count=5,
    )

    assert result == {"columnNames": ["ok"], "rows": [[1]]}
    assert recorded["row_count"] == 5
    payload = recorded["payload"]
    assert isinstance(payload, dict)
    assert payload["datasetType"] == "sql"
    dataset_data = json.loads(payload["datasetData"])
    assert dataset_data == {
        "database": "FRDemo",
        "query": "enc::select 1 as ok",
        "parameters": [],
    }
