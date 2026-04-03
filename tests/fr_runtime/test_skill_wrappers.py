import subprocess
import sys
from pathlib import Path

import pytest


REPO_ROOT = Path(__file__).resolve().parents[2]

WRAPPER_CASES = [
    (".codex/skills/fr-init/scripts/run.py", ["--help"]),
    (".codex/skills/fr-status-check/scripts/run.py", ["--help"]),
    (".codex/skills/fr-db/scripts/run.py", ["--help"]),
    (".codex/skills/fr-create/scripts/run.py", ["--help"]),
    (".codex/skills/fr-cpt/scripts/run.py", ["--help"]),
    (".codex/skills/fr-fvs/scripts/run.py", ["--help"]),
    (".codex/skills/fr-download-sync/scripts/run.py", ["--help"]),
    (".codex/skills/fr-upload-sync/scripts/run.py", ["--help"]),
    (".codex/skills/fr-browser-review/scripts/run.py", ["--help"]),
    (".codex/skills/fr-workflow/scripts/run.py", ["context"]),
]


@pytest.mark.parametrize(("script_path", "args"), WRAPPER_CASES)
def test_skill_wrapper_scripts_run_from_repo_root(script_path: str, args: list[str]) -> None:
    script = REPO_ROOT / script_path
    result = subprocess.run(
        [sys.executable, str(script), *args],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        check=False,
    )

    assert result.returncode == 0, result.stderr or result.stdout
    assert "ModuleNotFoundError: No module named 'tooling'" not in result.stderr
