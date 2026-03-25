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


PROJECT_ERROR_SOURCE = "project"


def current_project_required_error() -> AppError:
    return AppError(
        code="project.current_required",
        message="请先选择项目目录",
        source=PROJECT_ERROR_SOURCE,
    )


def invalid_project_path_error(path: str) -> AppError:
    return AppError(
        code="project.path_invalid",
        message="项目目录不存在或不是目录",
        detail={"path": path},
        source=PROJECT_ERROR_SOURCE,
    )


def invalid_remote_profile_error(field: str) -> AppError:
    return AppError(
        code="project.remote_profile_invalid",
        message="远程参数不合法",
        detail={"field": field},
        source=PROJECT_ERROR_SOURCE,
    )


def invalid_project_state_error(field: str) -> AppError:
    return AppError(
        code="project.state_invalid",
        message="项目状态文件损坏",
        detail={"field": field},
        source=PROJECT_ERROR_SOURCE,
    )


def invalid_current_project_error(path: str) -> AppError:
    return AppError(
        code="project.current_invalid",
        message="当前项目目录已失效",
        detail={"path": path},
        source=PROJECT_ERROR_SOURCE,
    )


def directory_selection_cancelled_error() -> AppError:
    return AppError(
        code="project.directory_selection_cancelled",
        message="未选择项目目录",
        source=PROJECT_ERROR_SOURCE,
    )


def directory_selection_failed_error(reason: str) -> AppError:
    return AppError(
        code="project.directory_selection_failed",
        message="项目目录选择失败",
        detail={"reason": reason},
        source=PROJECT_ERROR_SOURCE,
    )
