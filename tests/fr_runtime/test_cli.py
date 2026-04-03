from pathlib import Path

import pytest

from tooling.fr_runtime.cli import build_parser, build_sync_service


def test_cli_exposes_expected_subcommands() -> None:
    parser = build_parser()
    action = parser._subparsers._group_actions[0]
    assert sorted(action.choices) == ["db", "doctor", "init", "preview", "sync"]


def test_build_sync_service_uses_repo_local_skill_templates(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    workspace_root = tmp_path / "workspace"
    workspace_root.mkdir()
    config = type(
        "Config",
        (),
        {
            "workspace_root": workspace_root,
            "designer_root": tmp_path / "designer",
            "decision_url": "http://127.0.0.1:8075/webroot/decision",
            "username": "admin",
            "password": "admin",
        },
    )()

    monkeypatch.setattr("tooling.fr_runtime.cli.build_configured_bridge_runner", lambda *_: object())

    service = build_sync_service(config, tmp_path)

    assert service.template_root == tmp_path / ".codex" / "skills" / "fr-create" / "assets" / "template"
