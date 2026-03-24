from pathlib import Path

from fastapi import APIRouter, Depends

from backend.adapters.fine.sync_gateway import FineSyncGateway
from backend.application.project.config_service import ProjectConfigService
from backend.application.sync.use_cases import SyncUseCases
from backend.schemas.sync import SyncActionRequest, SyncResultResponse

REPORTLETS_DIR_NAME = "reportlets"

router = APIRouter()


def get_sync_service() -> SyncUseCases:
    config = ProjectConfigService(base_dir=Path.cwd()).load_or_create()
    root = config.workspace_dir / REPORTLETS_DIR_NAME
    return SyncUseCases(FineSyncGateway.from_env(local_root=root))


@router.post("/api/sync/actions", response_model=SyncResultResponse)
def run_sync_action(
    request: SyncActionRequest,
    service: SyncUseCases = Depends(get_sync_service),
) -> SyncResultResponse:
    result = service.dispatch(request.action, request.target_path)
    return SyncResultResponse.from_domain(result)
