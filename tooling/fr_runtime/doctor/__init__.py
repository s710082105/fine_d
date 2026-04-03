"""Health check helpers for local runtime dependencies."""

from .checks import collect_runtime_checks, detect_designer_java, detect_platform
from .report import CheckResult, render_report

__all__ = [
    "CheckResult",
    "collect_runtime_checks",
    "detect_designer_java",
    "detect_platform",
    "render_report",
]
