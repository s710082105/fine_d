from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from apps.api.routes.assistant import router as assistant_router
from apps.api.routes.codex_terminal import router as codex_terminal_router
from apps.api.routes.datasource import router as datasource_router
from apps.api.routes.preview import router as preview_router
from apps.api.routes.project import router as project_router
from apps.api.routes.remote import router as remote_router
from apps.api.routes.reportlet import router as reportlet_router
from apps.api.routes.sync import router as sync_router
from backend.domain.project.errors import AppError
from backend.schemas.health import HealthResponse
from backend.schemas.common import DEFAULT_ERROR_STATUS_CODE, ErrorResponse


def create_app() -> FastAPI:
    app = FastAPI()

    @app.exception_handler(AppError)
    async def handle_app_error(_: Request, exc: AppError) -> JSONResponse:
        payload = ErrorResponse.from_app_error(exc)
        return JSONResponse(
            status_code=DEFAULT_ERROR_STATUS_CODE,
            content=payload.model_dump(),
        )

    @app.get("/api/health", response_model=HealthResponse)
    def health() -> HealthResponse:
        return HealthResponse(status="ok")

    app.include_router(assistant_router)
    app.include_router(codex_terminal_router)
    app.include_router(datasource_router)
    app.include_router(preview_router)
    app.include_router(project_router)
    app.include_router(remote_router)
    app.include_router(reportlet_router)
    app.include_router(sync_router)

    return app
