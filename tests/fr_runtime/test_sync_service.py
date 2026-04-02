import pytest

from tooling.fr_runtime.sync.service import normalize_remote_path


def test_normalize_remote_path_rejects_non_reportlets_targets() -> None:
    with pytest.raises(ValueError, match="reportlets"):
        normalize_remote_path("../etc/passwd")
