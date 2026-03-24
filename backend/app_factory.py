from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

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

    return app
