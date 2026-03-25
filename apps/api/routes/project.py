from pathlib import Path

from fastapi import APIRouter, Depends

from backend.application.project.config_service import ProjectConfigService
from backend.schemas.project import (
    ProjectConfigResponse,
    ProjectCurrentResponse,
    ProjectRemoteProfileResponse,
    ProjectSelectRequest,
    RemoteProfileRequest,
)

router = APIRouter()


def get_project_service() -> ProjectConfigService:
    return ProjectConfigService(base_dir=Path.cwd())


@router.get("/api/project/config", response_model=ProjectConfigResponse)
def get_project_config(
    service: ProjectConfigService = Depends(get_project_service),
) -> ProjectConfigResponse:
    config = service.load()
    return ProjectConfigResponse.from_domain(config)


@router.get("/api/project/current", response_model=ProjectCurrentResponse)
def get_current_project(
    service: ProjectConfigService = Depends(get_project_service),
) -> ProjectCurrentResponse:
    return ProjectCurrentResponse.from_domain(service.get_current())


@router.post("/api/project/select", response_model=ProjectCurrentResponse)
def select_project(
    request: ProjectSelectRequest,
    service: ProjectConfigService = Depends(get_project_service),
) -> ProjectCurrentResponse:
    state = service.select_project(Path(request.path))
    return ProjectCurrentResponse.from_domain(state)


@router.put(
    "/api/project/remote-profile",
    response_model=ProjectRemoteProfileResponse,
)
def update_remote_profile(
    request: RemoteProfileRequest,
    service: ProjectConfigService = Depends(get_project_service),
) -> ProjectRemoteProfileResponse:
    profile = service.update_remote_profile(
        base_url=request.base_url,
        username=request.username,
        password=request.password,
    )
    return ProjectRemoteProfileResponse.from_domain(profile)
