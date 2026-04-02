import json

import pytest

from tooling.fr_runtime.cli import main


def test_init_command_returns_retry_exit_code_for_missing_answers(capsys: pytest.CaptureFixture[str]) -> None:
    exit_code = main(["init", "--answers-json", json.dumps({"project_name": "demo"})])
    output = capsys.readouterr().out
    assert exit_code == 0
    assert '"project_name": "passed"' in output


def test_sync_command_rejects_missing_target() -> None:
    with pytest.raises(SystemExit, match="target_path"):
        main(["sync", "pull"])
