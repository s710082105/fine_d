from pathlib import Path

from tooling.fr_runtime.init.service import merge_answers


def test_merge_answers_marks_missing_required_fields_for_retry() -> None:
    result = merge_answers(
        {},
        {
            "decision_url": "http://127.0.0.1:8075/webroot/decision",
        },
    )
    assert "designer_root" in result.retry_fields
    assert "workspace_root" in result.retry_fields
    assert result.details["designer_root"] == "required field is missing"
    assert result.status["decision_url"] == "passed"
    assert result.status["project_name"] == "failed"
    assert result.details["project_name"] == "project_name requires workspace_root"


def test_merge_answers_validates_paths_url_and_remote_root(tmp_path: Path) -> None:
    designer_root = tmp_path / "designer"
    workspace_root = tmp_path / "workspace"
    designer_root.mkdir()
    workspace_root.mkdir()
    result = merge_answers(
        {},
        {
            "designer_root": str(designer_root),
            "decision_url": "http://127.0.0.1:8075/webroot/decision",
            "username": "demo-user",
            "password": "demo-password",
            "workspace_root": str(workspace_root),
        },
    )
    assert result.retry_fields == []
    assert result.merged["project_name"] == "workspace"
    assert result.details["project_name"] == "derived from workspace_root"
    assert result.details["designer_root"] == "path exists"
    assert result.details["decision_url"] == "url format is valid"
    assert result.details["remote_root"] == "defaulted to reportlets"
    assert result.details["task_type"] == "defaulted to 未指定"


def test_merge_answers_rejects_invalid_url_and_remote_root(tmp_path: Path) -> None:
    designer_root = tmp_path / "designer"
    workspace_root = tmp_path / "workspace"
    designer_root.mkdir()
    workspace_root.mkdir()
    result = merge_answers(
        {},
        {
            "designer_root": str(designer_root),
            "decision_url": "127.0.0.1:8075/webroot/decision",
            "username": "demo-user",
            "password": "demo-password",
            "workspace_root": str(workspace_root),
            "remote_root": "../outside",
        },
    )
    assert "decision_url" in result.retry_fields
    assert result.details["decision_url"] == "must be a valid http or https url"
    assert result.details["remote_root"] == "remote root must stay under reportlets"


def test_merge_answers_accepts_explicit_project_name_and_task_type(tmp_path: Path) -> None:
    designer_root = tmp_path / "designer"
    workspace_root = tmp_path / "workspace"
    designer_root.mkdir()
    workspace_root.mkdir()
    result = merge_answers(
        {},
        {
            "project_name": "custom-demo",
            "designer_root": str(designer_root),
            "decision_url": "https://example.com/webroot/decision",
            "username": "demo-user",
            "password": "demo-password",
            "workspace_root": str(workspace_root),
            "task_type": "修改现有报表",
        },
    )
    assert result.retry_fields == []
    assert result.merged["project_name"] == "custom-demo"
    assert result.details["project_name"] == "confirmed"
    assert result.details["task_type"] == "confirmed"
