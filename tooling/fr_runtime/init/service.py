"""Pure helpers for merging and validating init answers."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlparse

from tooling.fr_runtime.config import ALL_FIELDS, DEFAULT_REMOTE_ROOT, DEFAULT_TASK_TYPE, REQUIRED_FIELDS


@dataclass(frozen=True)
class InitMergeResult:
    status: dict[str, str]
    merged: dict[str, str]
    retry_fields: list[str]
    details: dict[str, str]


@dataclass(frozen=True)
class FieldValidation:
    normalized: str
    status: str
    detail: str


def merge_answers(existing: dict[str, str], incoming: dict[str, str]) -> InitMergeResult:
    merged = {**existing, **incoming}
    status: dict[str, str] = {}
    details: dict[str, str] = {}
    retry_fields: list[str] = []
    normalized: dict[str, str] = {}
    workspace_validation = _validate_existing_path(str(merged.get("workspace_root", "")).strip())
    for field in ALL_FIELDS:
        validation = _validate_field(field, merged, workspace_validation)
        normalized[field] = validation.normalized
        status[field] = validation.status
        details[field] = validation.detail
        if field in REQUIRED_FIELDS and validation.status != "passed":
            retry_fields.append(field)
    return InitMergeResult(status=status, merged=normalized, retry_fields=retry_fields, details=details)

def _validate_field(
    field: str,
    merged: dict[str, object],
    workspace_validation: FieldValidation,
) -> FieldValidation:
    value = str(merged.get(field, "")).strip()
    if field == "project_name":
        return _validate_project_name(value, workspace_validation.normalized)
    if field == "remote_root":
        return _validate_remote_root(value or DEFAULT_REMOTE_ROOT)
    if field == "task_type":
        return _validate_task_type(value or DEFAULT_TASK_TYPE)
    if not value:
        return FieldValidation("", "failed", "required field is missing")
    if field in {"designer_root", "workspace_root"}:
        return _validate_existing_path(value)
    if field == "decision_url":
        return _validate_decision_url(value)
    return FieldValidation(value, "passed", "confirmed")


def _validate_project_name(raw_name: str, workspace_root: str) -> FieldValidation:
    if raw_name:
        return FieldValidation(raw_name, "passed", "confirmed")
    if workspace_root:
        return FieldValidation(Path(workspace_root).name, "passed", "derived from workspace_root")
    return FieldValidation("", "failed", "project_name requires workspace_root")


def _validate_existing_path(raw_path: str) -> FieldValidation:
    if not raw_path:
        return FieldValidation("", "failed", "required field is missing")
    path = Path(raw_path).expanduser()
    if not path.exists():
        return FieldValidation(str(path), "failed", "path does not exist")
    return FieldValidation(str(path), "passed", "path exists")


def _validate_decision_url(url: str) -> FieldValidation:
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return FieldValidation(url, "failed", "must be a valid http or https url")
    return FieldValidation(url, "passed", "url format is valid")


def _validate_remote_root(raw_root: str) -> FieldValidation:
    normalized = raw_root.replace("\\", "/").strip("/")
    if normalized != "reportlets" and not normalized.startswith("reportlets/"):
        return FieldValidation(normalized, "failed", "remote root must stay under reportlets")
    if "/../" in f"/{normalized}" or normalized.endswith("/.."):
        return FieldValidation(normalized, "failed", "remote root must stay under reportlets")
    if raw_root == DEFAULT_REMOTE_ROOT:
        return FieldValidation(normalized, "passed", "defaulted to reportlets")
    return FieldValidation(normalized, "passed", "remote root is valid")


def _validate_task_type(task_type: str) -> FieldValidation:
    if task_type == DEFAULT_TASK_TYPE:
        return FieldValidation(task_type, "passed", "defaulted to 未指定")
    return FieldValidation(task_type, "passed", "confirmed")
