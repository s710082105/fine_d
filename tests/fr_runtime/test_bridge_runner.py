from pathlib import Path

import pytest

from tooling.fr_runtime.bridge.runner import (
    BridgeAuthorizationError,
    BridgeError,
    BridgeRunner,
    ProcessResult,
    build_bridge_command,
)


def test_build_bridge_command_uses_designer_java_and_jar() -> None:
    command = build_bridge_command(
        java_path=Path("/Applications/FineReport/Contents/runtime/Contents/Home/bin/java"),
        jar_path=Path("bridge/dist/fr-remote-bridge.jar"),
        operation="list",
    )
    assert command[:3] == [
        "/Applications/FineReport/Contents/runtime/Contents/Home/bin/java",
        "-jar",
        "bridge/dist/fr-remote-bridge.jar",
    ]
    assert command[-1] == "list"


def test_bridge_runner_invokes_process_with_encoded_payload() -> None:
    recorded: dict[str, object] = {}

    def fake_run(command: list[str], payload: str) -> ProcessResult:
        recorded["command"] = command
        recorded["payload"] = payload
        return ProcessResult(0, '{"status":"ok","text":"enc-value"}', "")

    runner = BridgeRunner(
        java_path=Path("/Applications/FineReport/.install4j/jre.bundle/Contents/Home/bin/java"),
        jar_path=Path("bridge/dist/fr-remote-bridge.jar"),
        run_process=fake_run,
    )

    result = runner.invoke("encrypt", {"text": "select 1 as ok"})

    assert result == {"status": "ok", "text": "enc-value"}
    assert recorded["command"] == [
        "/Applications/FineReport/.install4j/jre.bundle/Contents/Home/bin/java",
        "-jar",
        "bridge/dist/fr-remote-bridge.jar",
        "encrypt",
    ]
    payload = str(recorded["payload"])
    assert payload.startswith("text=")


def test_bridge_runner_invokes_transmission_encrypt_with_remote_profile() -> None:
    recorded: dict[str, object] = {}

    def fake_run(command: list[str], payload: str) -> ProcessResult:
        recorded["command"] = command
        recorded["payload"] = payload
        return ProcessResult(0, '{"status":"ok","text":"enc-value"}', "")

    runner = BridgeRunner(
        java_path=Path("/Applications/FineReport/.install4j/jre.bundle/Contents/Home/bin/java"),
        jar_path=Path("bridge/dist/fr-remote-bridge.jar"),
        run_process=fake_run,
    )

    result = runner.invoke(
        "encrypt-transmission",
        {
            "text": "select 1 as ok",
            "transmissionEncryption": 2,
            "frontSeed": "ABCD1234",
            "frontSm4Key": "abcdabcdabcdabcd",
        },
    )

    assert result == {"status": "ok", "text": "enc-value"}
    assert recorded["command"] == [
        "/Applications/FineReport/.install4j/jre.bundle/Contents/Home/bin/java",
        "-jar",
        "bridge/dist/fr-remote-bridge.jar",
        "encrypt-transmission",
    ]
    payload = str(recorded["payload"])
    assert "text=" in payload
    assert "transmissionEncryption=" in payload
    assert "frontSeed=" in payload
    assert "frontSm4Key=" in payload


def test_bridge_runner_raises_bridge_error_for_non_json_output() -> None:
    def fake_run(command: list[str], payload: str) -> ProcessResult:
        return ProcessResult(1, "", "no main manifest attribute")

    runner = BridgeRunner(
        java_path=Path("/Applications/FineReport/.install4j/jre.bundle/Contents/Home/bin/java"),
        jar_path=Path("bridge/dist/fr-remote-bridge.jar"),
        run_process=fake_run,
    )

    with pytest.raises(BridgeError, match="no main manifest attribute"):
        runner.invoke("list", {"path": "reportlets"})


def test_bridge_runner_raises_authorization_error_for_bridge_license_prompt() -> None:
    def fake_run(command: list[str], payload: str) -> ProcessResult:
        return ProcessResult(
            2,
            "",
            '{"status":"error","operation":"list","message":"设备 MAC: AA:BB:CC:DD:EE:FF，请联系管理员授权"}',
        )

    runner = BridgeRunner(
        java_path=Path("/Applications/FineReport/.install4j/jre.bundle/Contents/Home/bin/java"),
        jar_path=Path("bridge/dist/fr-remote-bridge.jar"),
        run_process=fake_run,
    )

    with pytest.raises(BridgeAuthorizationError, match="请联系管理员授权"):
        runner.invoke("list", {"path": "reportlets"})
