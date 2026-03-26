from pathlib import Path

from fastapi import APIRouter, Depends

from backend.adapters.fine.remote_overview_gateway import FineRemoteOverviewGateway
from backend.adapters.platform.directory_picker import SystemDirectoryPicker
from backend.application.project.config_service import ProjectConfigService
from backend.application.project.context_service import ProjectContextService
from backend.domain.project.errors import directory_selection_cancelled_error
from backend.infra.project_store import ProjectStore
from backend.schemas.project import (
    ProjectConfigResponse,
    ProjectContextGenerateRequest,
    ProjectContextResponse,
    ProjectCurrentResponse,
    ProjectRemoteProfileResponse,
    ProjectSelectRequest,
    RemoteProfileRequest,
)

router = APIRouter()


def get_project_service() -> ProjectConfigService:
    return ProjectConfigService(base_dir=Path.cwd())


def get_directory_picker() -> SystemDirectoryPicker:
    return SystemDirectoryPicker()


def get_project_context_service() -> ProjectContextService:
    base_dir = Path.cwd()
    return ProjectContextService(
        project_state_reader=ProjectConfigService(base_dir=base_dir),
        project_store=ProjectStore(base_dir=base_dir),
        remote_gateway=FineRemoteOverviewGateway(),
    )


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


@router.post("/api/project/context", response_model=ProjectContextResponse)
def generate_project_context(
    request: ProjectContextGenerateRequest,
    service: ProjectContextService = Depends(get_project_context_service),
) -> ProjectContextResponse:
    return ProjectContextResponse.from_domain(
        service.generate(force=request.force),
    )


@router.post("/api/project/select", response_model=ProjectCurrentResponse)
def select_project(
    request: ProjectSelectRequest,
    service: ProjectConfigService = Depends(get_project_service),
) -> ProjectCurrentResponse:
    state = service.select_project(Path(request.path))
    return ProjectCurrentResponse.from_domain(state)


@router.post("/api/project/select-dialog", response_model=ProjectCurrentResponse)
def select_project_via_dialog(
    directory_picker: SystemDirectoryPicker = Depends(get_directory_picker),
    service: ProjectConfigService = Depends(get_project_service),
) -> ProjectCurrentResponse:
    selected_path = directory_picker.choose_directory()
    if not selected_path:
        raise directory_selection_cancelled_error()
    state = service.select_project(selected_path)
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
        designer_root=request.designer_root,
    )
    return ProjectRemoteProfileResponse.from_domain(profile)
