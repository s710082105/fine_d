from fastapi import APIRouter, Depends

from backend.adapters.fine.http_client import FineHttpClient
from backend.application.datasource.use_cases import DatasourceUseCases
from backend.schemas.datasource import (
    ConnectionSummaryResponse,
    SqlPreviewRequest,
    SqlPreviewResponse,
)

router = APIRouter()


def get_datasource_service() -> DatasourceUseCases:
    return DatasourceUseCases(FineHttpClient.from_env())


@router.get(
    "/api/datasource/connections",
    response_model=list[ConnectionSummaryResponse],
)
def list_connections(
    service: DatasourceUseCases = Depends(get_datasource_service),
) -> list[ConnectionSummaryResponse]:
    items = service.list_connections()
    return [ConnectionSummaryResponse.from_domain(item) for item in items]


@router.post("/api/datasource/preview-sql", response_model=SqlPreviewResponse)
def preview_sql(
    request: SqlPreviewRequest,
    service: DatasourceUseCases = Depends(get_datasource_service),
) -> SqlPreviewResponse:
    result = service.preview_sql(request.connection_name, request.sql)
    return SqlPreviewResponse.from_domain(result)
