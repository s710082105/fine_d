from pathlib import Path

from fastapi import APIRouter, Depends

from backend.application.project.config_service import ProjectConfigService
from backend.schemas.project import ProjectConfigResponse

router = APIRouter()


def get_project_service() -> ProjectConfigService:
    return ProjectConfigService(base_dir=Path.cwd())


@router.get("/api/project/config", response_model=ProjectConfigResponse)
def get_project_config(
    service: ProjectConfigService = Depends(get_project_service),
) -> ProjectConfigResponse:
    config = service.load_or_create()
    return ProjectConfigResponse.from_domain(config)
