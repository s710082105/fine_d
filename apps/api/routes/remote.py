from pathlib import Path

from fastapi import APIRouter, Depends

from backend.adapters.fine.remote_overview_gateway import FineRemoteOverviewGateway
from backend.application.project.config_service import ProjectConfigService
from backend.application.remote.use_cases import LoadRemoteOverviewUseCase
from backend.schemas.remote import RemoteOverviewResponse

router = APIRouter()


def get_remote_overview_service() -> LoadRemoteOverviewUseCase:
    return LoadRemoteOverviewUseCase(
        ProjectConfigService(base_dir=Path.cwd()),
        FineRemoteOverviewGateway(),
    )


@router.get("/api/remote/overview", response_model=RemoteOverviewResponse)
def get_remote_overview(
    service: LoadRemoteOverviewUseCase = Depends(get_remote_overview_service),
) -> RemoteOverviewResponse:
    return RemoteOverviewResponse.from_domain(service.load())
