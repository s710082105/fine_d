from pathlib import Path

import pytest

from tooling.fr_runtime.config.io import load_config


def test_load_config_rejects_missing_designer_root(tmp_path: Path) -> None:
    config_path = tmp_path / "fr-config.json"
    config_path.write_text('{"project_name":"demo","decision_url":"http://127.0.0.1:8075"}')

    with pytest.raises(ValueError, match="designer_root"):
        load_config(config_path)


def test_load_config_derives_optional_fields_from_workspace(tmp_path: Path) -> None:
    workspace_root = tmp_path / "fr-demo"
    workspace_root.mkdir()
    designer_root = tmp_path / "designer"
    designer_root.mkdir()
    config_path = tmp_path / "fr-config.json"
    config_path.write_text(
        (
            "{"
            f'"decision_url":"http://127.0.0.1:8075/webroot/decision",'
            f'"designer_root":"{designer_root}",'
            '"username":"demo-user",'
            '"password":"demo-password",'
            f'"workspace_root":"{workspace_root}"'
            "}"
        )
    )

    config = load_config(config_path)

    assert config.project_name == "fr-demo"
    assert config.remote_root == "reportlets"
    assert config.task_type == "未指定"
