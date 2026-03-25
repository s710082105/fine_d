from typing import Any

from pydantic import BaseModel, ConfigDict

from backend.domain.project.errors import AppError

DEFAULT_ERROR_STATUS_CODE = 400


class ErrorResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    code: str
    message: str
    detail: dict[str, Any] | None = None
    source: str
    retryable: bool

    @classmethod
    def from_app_error(cls, error: AppError) -> "ErrorResponse":
        return cls(
            code=error.code,
            message=error.message,
            detail=error.detail,
            source=error.source,
            retryable=error.retryable,
        )
