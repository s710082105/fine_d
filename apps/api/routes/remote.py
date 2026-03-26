from pathlib import Path

from fastapi import APIRouter, Depends

from backend.adapters.fine.remote_overview_gateway import FineRemoteOverviewGateway
from backend.application.project.config_service import ProjectConfigService
from backend.application.remote.use_cases import (
    ListRemoteDirectoriesUseCase,
    LoadRemoteOverviewUseCase,
    TestRemoteProfileUseCase,
)
from backend.schemas.project import RemoteProfileRequest
from backend.schemas.remote import (
    RemoteDirectoryEntryResponse,
    RemoteOverviewResponse,
    RemoteProfileTestResponse,
)

router = APIRouter()


def get_remote_overview_service() -> LoadRemoteOverviewUseCase:
    return LoadRemoteOverviewUseCase(
        ProjectConfigService(base_dir=Path.cwd()),
        FineRemoteOverviewGateway(),
    )


def get_project_remote_test_service() -> TestRemoteProfileUseCase:
    return TestRemoteProfileUseCase(
        ProjectConfigService(base_dir=Path.cwd()),
        FineRemoteOverviewGateway(),
    )


def get_remote_directories_service() -> ListRemoteDirectoriesUseCase:
    return ListRemoteDirectoriesUseCase(
        ProjectConfigService(base_dir=Path.cwd()),
        FineRemoteOverviewGateway(),
    )


@router.get("/api/remote/overview", response_model=RemoteOverviewResponse)
def get_remote_overview(
    service: LoadRemoteOverviewUseCase = Depends(get_remote_overview_service),
) -> RemoteOverviewResponse:
    return RemoteOverviewResponse.from_domain(service.load())


@router.get(
    "/api/remote/directories",
    response_model=list[RemoteDirectoryEntryResponse],
)
def get_remote_directories(
    path: str | None = None,
    service: ListRemoteDirectoriesUseCase = Depends(get_remote_directories_service),
) -> list[RemoteDirectoryEntryResponse]:
    return [
        RemoteDirectoryEntryResponse.from_domain(item)
        for item in service.list_directories(path=path)
    ]


@router.post(
    "/api/project/remote-profile/test",
    response_model=RemoteProfileTestResponse,
)
def test_remote_profile(
    request: RemoteProfileRequest,
    service: TestRemoteProfileUseCase = Depends(get_project_remote_test_service),
) -> RemoteProfileTestResponse:
    result = service.test(
        base_url=request.base_url,
        username=request.username,
        password=request.password,
        designer_root=request.designer_root,
    )
    return RemoteProfileTestResponse.from_domain(result)
