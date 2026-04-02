from tooling.fr_runtime.datasource.service import normalize_connection


def test_normalize_connection_prefers_name_and_database_type() -> None:
    item = {"connectionName": "FRDemo", "databaseType": "MYSQL"}
    assert normalize_connection(item) == {
        "name": "FRDemo",
        "database_type": "MYSQL",
    }
