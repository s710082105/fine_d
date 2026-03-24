from pathlib import Path

from backend.application.project.config_service import ProjectConfigService
from backend.domain.project.errors import AppError


def test_default_project_config_uses_workspace_and_generated_dirs(
    tmp_path: Path,
) -> None:
    service = ProjectConfigService(base_dir=tmp_path)

    config = service.load_or_create()

    assert config.workspace_dir == tmp_path / "workspace"
    assert config.generated_dir == tmp_path / "generated"


def test_domain_error_is_serialized() -> None:
    payload = AppError(
        code="config.invalid",
        message="invalid config",
        detail={"field": "workspace_dir"},
        source="config",
        retryable=False,
    ).to_dict()

    assert payload["source"] == "config"
