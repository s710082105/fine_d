import json
from pathlib import Path

import pytest

from tooling.fr_runtime.cli import main
from tooling.fr_runtime.doctor import CheckResult


def test_init_command_returns_retry_exit_code_for_missing_answers(capsys: pytest.CaptureFixture[str]) -> None:
    exit_code = main(["init", "--answers-json", json.dumps({"project_name": "demo"})])
    output = capsys.readouterr().out
    assert exit_code == 1
    assert '"project_name": "passed"' in output
    assert '"designer_root"' in output


def test_init_command_validates_confirmed_answers(
    tmp_path: Path,
    capsys: pytest.CaptureFixture[str],
) -> None:
    designer_root = tmp_path / "designer"
    workspace_root = tmp_path / "workspace"
    designer_root.mkdir()
    workspace_root.mkdir()
    exit_code = main(
        [
            "init",
            "--answers-json",
            json.dumps(
                {
                    "designer_root": str(designer_root),
                    "decision_url": "http://127.0.0.1:8075/webroot/decision",
                    "username": "demo-user",
                    "password": "demo-password",
                    "workspace_root": str(workspace_root),
                }
            ),
        ]
    )
    output = capsys.readouterr().out
    assert exit_code == 0
    assert '"details"' in output
    assert '"derived from workspace_root"' in output
    assert '"defaulted to reportlets"' in output
    assert '"path exists"' in output
    assert '"url format is valid"' in output


def test_sync_command_rejects_missing_target() -> None:
    with pytest.raises(SystemExit, match="target_path"):
        main(["sync", "pull"])


def test_db_command_lists_connections_from_runtime_service(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    config_path = tmp_path / ".codex" / "fr-config.json"
    config_path.parent.mkdir(parents=True)
    config_path.write_text("{}")

    class FakeService:
        def list_connections(self, username: str, password: str) -> list[dict[str, str]]:
            assert username == "admin"
            assert password == "admin"
            return [{"name": "FRDemo", "database_type": "MYSQL"}]

    monkeypatch.setattr("tooling.fr_runtime.cli.load_config", lambda _: type("Config", (), {
        "username": "admin",
        "password": "admin",
    })())
    monkeypatch.setattr("tooling.fr_runtime.cli.build_datasource_service", lambda *_: FakeService())

    exit_code = main(["db", "list-connections", "--config-path", str(config_path)])
    output = capsys.readouterr().out

    assert exit_code == 0
    assert '"name": "FRDemo"' in output


def test_sync_command_uses_runtime_service(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    config_path = tmp_path / ".codex" / "fr-config.json"
    config_path.parent.mkdir(parents=True)
    config_path.write_text("{}")

    class FakeService:
        def pull(self, target_path: str) -> dict[str, str]:
            assert target_path == "reportlets/demo/report.cpt"
            return {"status": "pulled", "remote_path": target_path}

    monkeypatch.setattr("tooling.fr_runtime.cli.load_config", lambda _: object())
    monkeypatch.setattr("tooling.fr_runtime.cli.build_sync_service", lambda *_: FakeService())

    exit_code = main(
        [
            "sync",
            "pull",
            "reportlets/demo/report.cpt",
            "--config-path",
            str(config_path),
        ]
    )
    output = capsys.readouterr().out

    assert exit_code == 0
    assert '"status": "pulled"' in output


def test_doctor_command_passes_when_install4j_java_and_bridge_exist(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    monkeypatch.chdir(tmp_path)
    java_path = tmp_path / "designer" / ".install4j" / "jre.bundle" / "Contents" / "Home" / "bin" / "java"
    java_path.parent.mkdir(parents=True)
    java_path.write_text("")
    config_path = tmp_path / ".codex" / "fr-config.json"
    config_path.parent.mkdir(parents=True)
    config_path.write_text(
        json.dumps(
            {
                "project_name": "demo",
                "decision_url": "http://127.0.0.1:8075/webroot/decision",
                "designer_root": str(tmp_path / "designer"),
                "username": "demo-user",
                "password": "demo-password",
                "workspace_root": str(tmp_path),
                "remote_root": "reportlets",
                "task_type": "report",
            }
        )
    )
    bridge_dir = tmp_path / "bridge" / "dist"
    bridge_dir.mkdir(parents=True)
    (bridge_dir / "manifest.json").write_text("{}")
    (bridge_dir / "fr-remote-bridge.jar").write_text("placeholder")
    monkeypatch.setattr(
        "tooling.fr_runtime.cli.collect_runtime_checks",
        lambda **_: [
            CheckResult("OS", "通过", "macOS"),
            CheckResult("Designer Java", "通过", str(java_path)),
            CheckResult("Bridge Manifest", "通过", str(bridge_dir / "manifest.json")),
            CheckResult("Bridge Jar", "通过", "list,read,write,delete,encrypt"),
        ],
    )
    exit_code = main(["doctor", "--config-path", str(config_path)])
    output = capsys.readouterr().out
    assert exit_code == 0
    assert "Designer Java：通过" in output
    assert "Bridge Jar：通过" in output


def test_preview_command_reads_config_for_login_context(
    tmp_path: Path,
    capsys: pytest.CaptureFixture[str],
) -> None:
    config_path = tmp_path / ".codex" / "fr-config.json"
    config_path.parent.mkdir(parents=True)
    config_path.write_text(
        json.dumps(
            {
                "project_name": "demo",
                "decision_url": "http://127.0.0.1:8075/webroot/decision",
                "designer_root": str(tmp_path / "designer"),
                "username": "admin",
                "password": "admin",
                "workspace_root": str(tmp_path),
                "remote_root": "reportlets",
                "task_type": "report",
            }
        )
    )

    exit_code = main(
        [
            "preview",
            "--config-path",
            str(config_path),
            "--url",
            "http://127.0.0.1:8075/webroot/decision/view/report?viewlet=demo.cpt",
            "--report-path",
            "reportlets/demo/demo.cpt",
            "--expectation",
            "检查表头与数据",
            "--queried",
        ]
    )
    output = capsys.readouterr().out

    assert exit_code == 0
    assert "登录入口：http://127.0.0.1:8075/webroot/decision" in output
    assert "登录账号：admin" in output
    assert "目标报表：reportlets/demo/demo.cpt" in output
    assert "复核重点：检查表头与数据" in output


def test_preview_command_derives_duchamp_url_for_fvs_when_url_missing(
    tmp_path: Path,
    capsys: pytest.CaptureFixture[str],
) -> None:
    config_path = tmp_path / ".codex" / "fr-config.json"
    config_path.parent.mkdir(parents=True)
    config_path.write_text(
        json.dumps(
            {
                "project_name": "demo",
                "decision_url": "http://127.0.0.1:8075/webroot/decision",
                "designer_root": str(tmp_path / "designer"),
                "username": "admin",
                "password": "admin",
                "workspace_root": str(tmp_path),
                "remote_root": "reportlets",
                "task_type": "report",
            }
        )
    )

    exit_code = main(
        [
            "preview",
            "--config-path",
            str(config_path),
            "--report-path",
            "reportlets/dashboard/demo.fvs",
        ]
    )
    output = capsys.readouterr().out

    assert exit_code == 0
    assert "预览地址：http://127.0.0.1:8075/webroot/decision/view/duchamp?page_number=1&viewlet=dashboard/demo.fvs" in output
    assert "预览类型：FVS 决策报表" in output
