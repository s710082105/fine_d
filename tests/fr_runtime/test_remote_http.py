from tooling.fr_runtime.remote.http import build_login_payload


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
