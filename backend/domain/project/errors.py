from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True, slots=True)
class AppError(Exception):
    code: str
    message: str
    detail: dict[str, Any] | None = None
    source: str = "app"
    retryable: bool = False

    def __post_init__(self) -> None:
        object.__setattr__(self, "args", (self.message,))

    def to_dict(self) -> dict[str, Any]:
        return {
            "code": self.code,
            "message": self.message,
            "detail": self.detail,
            "source": self.source,
            "retryable": self.retryable,
        }
