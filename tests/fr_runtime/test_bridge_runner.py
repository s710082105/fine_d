from pathlib import Path

from tooling.fr_runtime.bridge.runner import build_bridge_command


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
