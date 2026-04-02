"""Build human-readable preview verification summaries."""

from __future__ import annotations


def build_preview_summary(url: str, opened: bool, queried: bool) -> str:
    return "\n".join(
        [
            "## 浏览器复核",
            f"- 预览地址：{url}",
            f"- 是否成功打开：{'是' if opened else '否'}",
            f"- 是否执行查询：{'是' if queried else '否'}",
        ]
    )
