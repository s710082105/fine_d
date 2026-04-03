from tooling.fr_runtime.remote.http import (
    DecisionHttpClient,
    TransmissionProfile,
    build_login_payload,
)


def test_build_login_payload_matches_fine_decision_contract() -> None:
    payload = build_login_payload("admin", "admin")
    assert payload == {
        "username": "admin",
        "password": "admin",
        "validity": -1,
        "sliderToken": "",
        "origin": "",
        "encrypted": False,
    }


def test_decision_http_client_logs_in_then_uses_bearer_token() -> None:
    calls: list[tuple[str, str, dict[str, object] | None, dict[str, str]]] = []

    def fake_request(
        method: str,
        url: str,
        payload: dict[str, object] | None,
        headers: dict[str, str],
    ) -> dict[str, object]:
        calls.append((method, url, payload, headers))
        if url.endswith("/login"):
            return {"data": {"accessToken": "demo-token"}}
        if url.endswith("/v10/config/connection/list/0"):
            return {"data": [{"connectionName": "FRDemo"}]}
        raise AssertionError(url)

    client = DecisionHttpClient(
        "http://127.0.0.1:8075/webroot/decision",
        request_json=fake_request,
    )

    result = client.list_connections("admin", "admin")

    assert result == [{"connectionName": "FRDemo"}]
    assert calls[0][0] == "POST"
    assert calls[0][1].endswith("/login")
    assert calls[0][2] == build_login_payload("admin", "admin")
    assert calls[1][0] == "GET"
    assert calls[1][1].endswith("/v10/config/connection/list/0")
    assert calls[1][3]["Authorization"] == "Bearer demo-token"


def test_decision_http_client_posts_preview_payload_with_row_count() -> None:
    calls: list[tuple[str, str, dict[str, object] | None, dict[str, str]]] = []

    def fake_request(
        method: str,
        url: str,
        payload: dict[str, object] | None,
        headers: dict[str, str],
    ) -> dict[str, object]:
        calls.append((method, url, payload, headers))
        if url.endswith("/login"):
            return {"data": {"accessToken": "demo-token"}}
        if url.endswith("/v10/dataset/preview?rowCount=5"):
            return {"data": {"columnNames": ["ok"], "rows": [[1]]}}
        raise AssertionError(url)

    client = DecisionHttpClient(
        "http://127.0.0.1:8075/webroot/decision",
        request_json=fake_request,
    )

    payload = {
        "datasetType": "sql",
        "datasetName": "tmp_preview",
        "datasetData": "{\"database\":\"FRDemo\"}",
    }
    result = client.preview_dataset("admin", "admin", payload, row_count=5)

    assert result == {"columnNames": ["ok"], "rows": [[1]]}
    assert calls[-1][0] == "POST"
    assert calls[-1][1].endswith("/v10/dataset/preview?rowCount=5")
    assert calls[-1][2] == payload
    assert calls[-1][3]["Authorization"] == "Bearer demo-token"


def test_decision_http_client_reads_transmission_profile() -> None:
    calls: list[tuple[str, str, dict[str, object] | None, dict[str, str]]] = []

    def fake_request(
        method: str,
        url: str,
        payload: dict[str, object] | None,
        headers: dict[str, str],
    ) -> dict[str, object]:
        calls.append((method, url, payload, headers))
        if url.endswith("/login"):
            return {"data": {"accessToken": "demo-token"}}
        if url.endswith("/remote/design/check"):
            return {
                "transmissionEncryption": 2,
                "frontSeed": "ABCD1234",
                "frontSM4Key": "abcdabcdabcdabcd",
            }
        raise AssertionError(url)

    client = DecisionHttpClient(
        "http://127.0.0.1:8075/webroot/decision",
        request_json=fake_request,
    )

    result = client.get_transmission_profile("admin", "admin")

    assert result == TransmissionProfile(
        transmission_encryption=2,
        front_seed="ABCD1234",
        front_sm4_key="abcdabcdabcdabcd",
    )
    assert calls[-1][0] == "POST"
    assert calls[-1][1].endswith("/remote/design/check")
    assert calls[-1][2] == {}
    assert calls[-1][3]["Authorization"] == "Bearer demo-token"
