from pathlib import Path

import pytest

from tooling.fr_runtime.config.io import load_config


def test_load_config_rejects_missing_designer_root(tmp_path: Path) -> None:
    config_path = tmp_path / "fr-config.json"
    config_path.write_text('{"project_name":"demo","decision_url":"http://127.0.0.1:8075"}')

    with pytest.raises(ValueError, match="designer_root"):
        load_config(config_path)
