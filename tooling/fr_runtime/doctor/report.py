"""Rendering helpers for doctor command output."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable


@dataclass(frozen=True)
class CheckResult:
    name: str
    status: str
    evidence: str


def render_report(results: Iterable[CheckResult]) -> str:
    lines = ["## 环境检查"]
    for result in results:
        lines.append(f"- {result.name}：{result.status}（{result.evidence}）")
    return "\n".join(lines)
