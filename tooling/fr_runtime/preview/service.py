"""Build human-readable preview verification summaries."""

from __future__ import annotations

from pathlib import Path
from urllib.parse import quote


def build_preview_url(decision_url: str, report_path: str) -> str:
    viewlet = _build_viewlet(report_path)
    base = decision_url.rstrip("/")
    if report_path.endswith(".fvs"):
        return f"{base}/view/duchamp?page_number=1&viewlet={quote(viewlet, safe='/')}"
    return f"{base}/view/report?viewlet={quote(viewlet, safe='/')}"


def build_preview_summary(
    url: str,
    opened: bool,
    queried: bool,
    *,
    login_url: str | None = None,
    username: str | None = None,
    report_path: str | None = None,
    expectation: str | None = None,
) -> str:
    lines = [
        "## 浏览器复核",
        f"- 预览地址：{url}",
    ]
    preview_type = _preview_type(report_path)
    if preview_type:
        lines.append(f"- 预览类型：{preview_type}")
    if login_url:
        lines.append(f"- 登录入口：{login_url}")
    if username:
        lines.append(f"- 登录账号：{username}")
    if report_path:
        lines.append(f"- 目标报表：{report_path}")
    if expectation:
        lines.append(f"- 复核重点：{expectation}")
    lines.extend(
        [
            f"- 是否成功打开：{'是' if opened else '否'}",
            f"- 是否执行查询：{'是' if queried else '否'}",
        ]
    )
    return "\n".join(lines)


def _build_viewlet(report_path: str) -> str:
    path = report_path.replace("\\", "/").lstrip("/")
    if path.startswith("reportlets/"):
        path = path[len("reportlets/") :]
    if not path:
        raise ValueError("report_path must point to a reportlet")
    return path


def _preview_type(report_path: str | None) -> str | None:
    if not report_path:
        return None
    suffix = Path(report_path).suffix.lower()
    if suffix == ".fvs":
        return "FVS 决策报表"
    if suffix == ".cpt":
        return "CPT 普通报表"
    return None
