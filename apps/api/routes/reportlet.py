from pathlib import Path

from fastapi import APIRouter, Depends, Query

from backend.adapters.system.file_gateway import FileGateway
from backend.application.project.config_service import ProjectConfigService
from backend.application.reportlet.use_cases import ReportletUseCases
from backend.schemas.reportlet import (
    ReportletCopyRequest,
    ReportletCreateFromTemplateRequest,
    ReportletEntryResponse,
    ReportletFileResponse,
    ReportletWriteRequest,
)

REPORTLETS_DIR_NAME = "reportlets"

router = APIRouter()


def get_reportlet_service() -> ReportletUseCases:
    config = ProjectConfigService(base_dir=Path.cwd()).load_or_create()
    root = config.workspace_dir / REPORTLETS_DIR_NAME
    return ReportletUseCases(FileGateway(root))


@router.get("/api/reportlets/tree", response_model=list[ReportletEntryResponse])
def list_tree(
    service: ReportletUseCases = Depends(get_reportlet_service),
) -> list[ReportletEntryResponse]:
    items = service.list_tree()
    return [ReportletEntryResponse.from_domain(item) for item in items]


@router.get("/api/reportlets/content", response_model=ReportletFileResponse)
def read_reportlet(
    path: str = Query(..., min_length=1),
    service: ReportletUseCases = Depends(get_reportlet_service),
) -> ReportletFileResponse:
    item = service.read(Path(path))
    return ReportletFileResponse.from_domain(item)


@router.put("/api/reportlets/content", response_model=ReportletFileResponse)
def write_reportlet(
    request: ReportletWriteRequest,
    service: ReportletUseCases = Depends(get_reportlet_service),
) -> ReportletFileResponse:
    item = service.write(Path(request.path), request.content)
    return ReportletFileResponse.from_domain(item)


@router.post(
    "/api/reportlets/create-from-template",
    response_model=ReportletFileResponse,
)
def create_from_template(
    request: ReportletCreateFromTemplateRequest,
    service: ReportletUseCases = Depends(get_reportlet_service),
) -> ReportletFileResponse:
    item = service.create_from_template(
        target=Path(request.target_path),
        template=Path(request.template_path),
    )
    return ReportletFileResponse.from_domain(item)


@router.post("/api/reportlets/copy", response_model=ReportletFileResponse)
def copy_reportlet(
    request: ReportletCopyRequest,
    service: ReportletUseCases = Depends(get_reportlet_service),
) -> ReportletFileResponse:
    item = service.copy(Path(request.source_path), Path(request.target_path))
    return ReportletFileResponse.from_domain(item)
