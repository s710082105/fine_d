"""Health check helpers for local runtime dependencies."""

from .checks import detect_designer_java, detect_platform
from .report import CheckResult, render_report

__all__ = ["CheckResult", "detect_designer_java", "detect_platform", "render_report"]
