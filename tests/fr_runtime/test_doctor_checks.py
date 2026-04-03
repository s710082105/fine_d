from pathlib import Path

from tooling.fr_runtime.config.models import RuntimeConfig
from tooling.fr_runtime.doctor.checks import collect_runtime_checks, detect_designer_java


def test_detect_designer_java_prefers_designer_runtime(tmp_path: Path) -> None:
    java_path = tmp_path / "Contents" / "runtime" / "Contents" / "Home" / "bin" / "java"
    java_path.parent.mkdir(parents=True)
    java_path.write_text("")
    assert detect_designer_java(tmp_path) == java_path


def test_detect_designer_java_supports_install4j_bundle(tmp_path: Path) -> None:
    java_path = tmp_path / ".install4j" / "jre.bundle" / "Contents" / "Home" / "bin" / "java"
    java_path.parent.mkdir(parents=True)
    java_path.write_text("")
    assert detect_designer_java(tmp_path) == java_path


def test_collect_runtime_checks_runs_remote_probes(
    tmp_path: Path,
) -> None:
    java_path = tmp_path / ".install4j" / "jre.bundle" / "Contents" / "Home" / "bin" / "java"
    java_path.parent.mkdir(parents=True)
    java_path.write_text("")
    reportlets_root = tmp_path / "workspace" / "reportlets"
    reportlets_root.mkdir(parents=True)
    bridge_dir = tmp_path / "bridge" / "dist"
    bridge_dir.mkdir(parents=True)
    jar_path = bridge_dir / "fr-remote-bridge.jar"
    jar_path.write_text("placeholder")
    manifest_path = bridge_dir / "manifest.json"
    manifest_path.write_text(
        '{"name":"fr-remote-bridge","version":"0.1.0","supported_operations":["list","read","write","delete","encrypt"]}'
    )
    checksum_path = bridge_dir / "checksums.txt"
    checksum_path.write_text(
        "4097889236a2af26c293033feb964c4cf118c0224e0d063fec0a89e9d0569ef2  fr-remote-bridge.jar\n"
    )
    config = RuntimeConfig(
        project_name="demo",
        decision_url="http://127.0.0.1:8075/webroot/decision",
        designer_root=tmp_path,
        username="admin",
        password="admin",
        workspace_root=tmp_path / "workspace",
        remote_root="reportlets",
        task_type="未指定",
    )

    class FakeDecisionClient:
        def list_connections(self, username: str, password: str) -> list[dict[str, str]]:
            assert username == "admin"
            assert password == "admin"
            return [{"connectionName": "FRDemo"}]

    class FakeBridgeRunner:
        def invoke(self, operation: str, payload: dict[str, object]) -> dict[str, object]:
            assert operation == "list"
            assert payload["path"] == "reportlets"
            return {"items": [{"name": "demo", "path": "reportlets/demo", "directory": True, "lock": None}]}

    results = collect_runtime_checks(
        config=config,
        repo_root=tmp_path,
        decision_client=FakeDecisionClient(),
        bridge_runner=FakeBridgeRunner(),
    )

    summary = {result.name: result.status for result in results}
    assert summary["Decision Login"] == "通过"
    assert summary["Remote Connections"] == "通过"
    assert summary["Remote Reportlets"] == "通过"
