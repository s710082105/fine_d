"""Pure helpers for merging and validating init answers."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class InitMergeResult:
    status: dict[str, str]
    merged: dict[str, str]
    retry_fields: list[str]


def merge_answers(existing: dict[str, str], incoming: dict[str, str]) -> InitMergeResult:
    merged = {**existing, **incoming}
    status: dict[str, str] = {}
    retry_fields: list[str] = []
    for field, value in merged.items():
        passed = bool(str(value).strip())
        status[field] = "passed" if passed else "failed"
        if not passed:
            retry_fields.append(field)
    return InitMergeResult(status=status, merged=merged, retry_fields=retry_fields)
