import importlib
import json
import time
from datetime import UTC, datetime
from pathlib import Path

import pytest

from backend.application.project.config_service import ProjectConfigService
from backend.application.project.context_templates import (
    MANAGED_SKILLS,
    SKILL_DESCRIPTIONS,
    SKILL_TRIGGERS,
)
from backend.domain.datasource.models import ConnectionSummary
from backend.domain.project.errors import AppError
from backend.domain.project.models import CurrentProject
from backend.domain.project.remote_models import RemoteProfile
from backend.domain.remote.models import RemoteDirectoryEntry, RemoteOverview
from backend.infra.project_store import ProjectStore, STATE_DIR_NAME, STATE_FILE_NAME


class FakeRemoteOverviewGateway:
    def __init__(self) -> None:
        self.calls: list[tuple[RemoteProfile, CurrentProject]] = []

    def load_overview(
        self,
        profile: RemoteProfile,
        current_project: CurrentProject,
    ) -> RemoteOverview:
        self.calls.append((profile, current_project))
        return RemoteOverview(
            directory_entries=[
                RemoteDirectoryEntry(
                    name="demo.cpt",
                    path="/reportlets/demo.cpt",
                    is_directory=False,
                    lock=None,
                )
            ],
            data_connections=[
                ConnectionSummary(name="qzcs", database_type="MYSQL"),
            ],
            last_loaded_at=datetime(2026, 3, 26, 9, 0, tzinfo=UTC),
        )


def _load_context_service_module():
    try:
        return importlib.import_module("backend.application.project.context_service")
    except ModuleNotFoundError as error:
        pytest.fail(f"context service module is missing: {error}")


def _build_service(
    tmp_path: Path,
    *,
    with_current_project: bool = True,
    with_remote_profile: bool = True,
) -> tuple[object, ProjectConfigService, Path, FakeRemoteOverviewGateway]:
    module = _load_context_service_module()
    config_service = ProjectConfigService(base_dir=tmp_path)
    project_dir = tmp_path / "project-alpha"
    gateway = FakeRemoteOverviewGateway()
    if with_current_project:
        project_dir.mkdir()
        config_service.select_project(project_dir)
    if with_current_project and with_remote_profile:
        config_service.update_remote_profile(
            base_url="http://localhost:8075/webroot/decision",
            username="admin",
            password="admin",
            designer_root="/Applications/FineReport",
        )
    service = module.ProjectContextService(
        project_state_reader=config_service,
        project_store=ProjectStore(base_dir=tmp_path),
        remote_gateway=gateway,
    )
    return service, config_service, project_dir, gateway


def test_generate_context_creates_managed_files_and_snapshot(
    tmp_path: Path,
) -> None:
    service, _, project_dir, gateway = _build_service(tmp_path)

    snapshot = service.generate(force=False)

    agents_file = project_dir / "AGENTS.md"
    context_file = project_dir / ".codex" / "project-context.md"
    rules_file = project_dir / ".codex" / "project-rules.md"
    agents_text = agents_file.read_text(encoding="utf-8")
    context_text = context_file.read_text(encoding="utf-8")
    rules_text = rules_file.read_text(encoding="utf-8")
    fr_db_skill_text = (
        project_dir / ".codex" / "skills" / "fr-db" / "SKILL.md"
    ).read_text(encoding="utf-8")

    assert agents_file.exists()
    assert context_file.exists()
    assert rules_file.exists()
    for skill_name in MANAGED_SKILLS:
        assert (project_dir / ".codex" / "skills" / skill_name / "SKILL.md").exists()
    assert snapshot.project_root == project_dir
    assert snapshot.agents_status == "created"
    assert len(snapshot.managed_files) == len(set(snapshot.managed_files))
    assert "AGENTS.md" in snapshot.managed_files
    assert ".codex/project-context.md" in snapshot.managed_files
    assert ".codex/project-rules.md" in snapshot.managed_files
    assert sum(
        managed_file.startswith(".codex/skills/")
        for managed_file in snapshot.managed_files
    ) >= len(MANAGED_SKILLS)
    assert "先确认需求" in agents_text
    assert "检查远端" in agents_text
    assert "按需拉取/补全" in agents_text
    assert "本地修改" in agents_text
    assert "同步推送" in agents_text
    assert "浏览器复核" in agents_text
    assert "最终准确报告" in agents_text
    assert "页面不做流程编排" in agents_text
    assert "最终报告以 Codex 终端输出为准" in agents_text
    assert "FineReport 专用 skill 作用与触发时机" in agents_text
    assert "试运行 SQL 与连接扫描必须走宿主工具协议" in agents_text
    assert "@@FR_TOOL" in agents_text
    assert "fr.list_connections" in agents_text
    assert "fr.preview_sql" in agents_text
    for skill_name in MANAGED_SKILLS:
        assert f"`{skill_name}`" in agents_text
        assert SKILL_DESCRIPTIONS[skill_name] in agents_text
        assert SKILL_TRIGGERS[skill_name] in agents_text
    assert "先确认需求" in rules_text
    assert "检查远端" in rules_text
    assert "按需拉取/补全" in rules_text
    assert "本地修改" in rules_text
    assert "同步推送" in rules_text
    assert "浏览器复核" in rules_text
    assert "最终准确报告" in rules_text
    assert "页面不做流程编排" in rules_text
    assert "最终报告以 Codex 终端输出为准" in rules_text
    assert "本地关键目录" in context_text
    assert "`reportlets/`" in context_text
    assert "`templates/`" in context_text
    assert "`.codex/skills/`" in context_text
    assert "qzcs" in context_text
    assert "/reportlets/demo.cpt" in context_text
    assert "当前项目上下文" in rules_text
    assert "宿主工具协议" in fr_db_skill_text
    assert "@@FR_TOOL" in fr_db_skill_text
    assert "fr.list_connections" in fr_db_skill_text
    assert "fr.preview_sql" in fr_db_skill_text
    assert "./.codex/fr-data.*" in fr_db_skill_text
    assert gateway.calls == [
        (
            RemoteProfile(
                base_url="http://localhost:8075/webroot/decision",
                username="admin",
                password="admin",
                designer_root="/Applications/FineReport",
            ),
            CurrentProject(path=project_dir, name="project-alpha"),
        )
    ]
    state_file = tmp_path / STATE_DIR_NAME / STATE_FILE_NAME
    context_state = json.loads(state_file.read_text(encoding="utf-8"))[
        "context_states"
    ][str(project_dir)]
    assert context_state == {
        "generated_at": snapshot.generated_at.isoformat(),
        "agents_status": "created",
    }


def test_generate_context_keeps_existing_agents_when_force_is_false(
    tmp_path: Path,
) -> None:
    service, _, project_dir, _ = _build_service(tmp_path)
    agents_file = project_dir / "AGENTS.md"
    agents_file.write_text("manual agents", encoding="utf-8")

    snapshot = service.generate(force=False)

    assert agents_file.read_text(encoding="utf-8") == "manual agents"
    assert snapshot.agents_status == "kept"
    assert (project_dir / ".codex" / "project-context.md").exists()
    state_file = tmp_path / STATE_DIR_NAME / STATE_FILE_NAME
    context_state = json.loads(state_file.read_text(encoding="utf-8"))[
        "context_states"
    ][str(project_dir)]
    assert context_state["agents_status"] == "kept"


def test_generate_context_overwrites_agents_when_force_is_true(
    tmp_path: Path,
) -> None:
    service, _, project_dir, _ = _build_service(tmp_path)
    agents_file = project_dir / "AGENTS.md"
    agents_file.write_text("manual agents", encoding="utf-8")

    snapshot = service.generate(force=True)

    assert agents_file.read_text(encoding="utf-8") != "manual agents"
    assert "project-alpha" in agents_file.read_text(encoding="utf-8")
    assert snapshot.agents_status == "updated"


def test_generate_context_skips_rewriting_unchanged_codex_files(
    tmp_path: Path,
) -> None:
    service, _, project_dir, _ = _build_service(tmp_path)

    service.generate(force=False)
    context_file = project_dir / ".codex" / "project-context.md"
    skill_file = project_dir / ".codex" / "skills" / MANAGED_SKILLS[0] / "SKILL.md"
    context_mtime = context_file.stat().st_mtime_ns
    skill_mtime = skill_file.stat().st_mtime_ns

    time.sleep(0.02)
    service.generate(force=False)

    assert context_file.stat().st_mtime_ns == context_mtime
    assert skill_file.stat().st_mtime_ns == skill_mtime


@pytest.mark.parametrize(
    ("with_current_project", "with_remote_profile", "code", "detail"),
    [
        (False, False, "project.current_required", None),
        (
            True,
            False,
            "project.remote_profile_invalid",
            {"field": "remote_profile"},
        ),
    ],
)
def test_generate_context_requires_project_state(
    tmp_path: Path,
    with_current_project: bool,
    with_remote_profile: bool,
    code: str,
    detail: dict[str, str] | None,
) -> None:
    service, _, _, gateway = _build_service(
        tmp_path,
        with_current_project=with_current_project,
        with_remote_profile=with_remote_profile,
    )

    with pytest.raises(AppError) as error_info:
        service.generate(force=False)

    assert error_info.value.code == code
    assert error_info.value.detail == detail
    assert gateway.calls == []


def test_project_config_service_get_current_ignores_invalid_context_state_metadata(
    tmp_path: Path,
) -> None:
    project_dir = tmp_path / "project-alpha"
    project_dir.mkdir()
    state_file = tmp_path / STATE_DIR_NAME / STATE_FILE_NAME
    state_file.parent.mkdir(parents=True, exist_ok=True)
    state_file.write_text(
        json.dumps(
            {
                "current_project": {
                    "path": str(project_dir),
                    "name": "project-alpha",
                },
                "remote_profiles": {
                    str(project_dir): {
                        "base_url": "http://localhost:8075/webroot/decision",
                        "username": "admin",
                        "password": "admin",
                        "designer_root": "/Applications/FineReport",
                    }
                },
                "context_states": {
                    str(project_dir): {
                        "generated_at": "2026-03-26T10:00:00+00:00",
                        "agents_status": "manual",
                    }
                },
            }
        ),
        encoding="utf-8",
    )

    state = ProjectConfigService(base_dir=tmp_path).get_current()

    assert state.current_project == CurrentProject(
        path=project_dir,
        name="project-alpha",
    )
    assert state.remote_profile == RemoteProfile(
        base_url="http://localhost:8075/webroot/decision",
        username="admin",
        password="admin",
        designer_root="/Applications/FineReport",
    )


def test_project_store_load_context_state_rejects_invalid_agents_status(
    tmp_path: Path,
) -> None:
    project_dir = tmp_path / "project-alpha"
    project_dir.mkdir()
    state_file = tmp_path / STATE_DIR_NAME / STATE_FILE_NAME
    state_file.parent.mkdir(parents=True, exist_ok=True)
    state_file.write_text(
        json.dumps(
            {
                "context_states": {
                    str(project_dir): {
                        "generated_at": "2026-03-26T10:00:00+00:00",
                        "agents_status": "manual",
                    }
                }
            }
        ),
        encoding="utf-8",
    )

    with pytest.raises(AppError) as error_info:
        ProjectStore(base_dir=tmp_path).load_context_state(project_dir)

    assert error_info.value.code == "project.state_invalid"
    assert error_info.value.detail == {"field": f"context_states.{project_dir}"}


def test_project_config_service_can_save_primary_state_with_invalid_context_state(
    tmp_path: Path,
) -> None:
    project_dir = tmp_path / "project-alpha"
    project_dir.mkdir()
    state_file = tmp_path / STATE_DIR_NAME / STATE_FILE_NAME
    state_file.parent.mkdir(parents=True, exist_ok=True)
    state_file.write_text(
        json.dumps(
            {
                "current_project": {
                    "path": str(project_dir),
                    "name": "project-alpha",
                },
                "context_states": {
                    str(project_dir): {
                        "generated_at": "2026-03-26T10:00:00+00:00",
                        "agents_status": "manual",
                    }
                },
            }
        ),
        encoding="utf-8",
    )

    service = ProjectConfigService(base_dir=tmp_path)
    saved_profile = service.update_remote_profile(
        base_url="http://localhost:8075/webroot/decision",
        username="admin",
        password="admin",
        designer_root="/Applications/FineReport",
    )
    selected_state = service.select_project(project_dir)

    assert saved_profile == RemoteProfile(
        base_url="http://localhost:8075/webroot/decision",
        username="admin",
        password="admin",
        designer_root="/Applications/FineReport",
    )
    assert selected_state.current_project == CurrentProject(
        path=project_dir,
        name="project-alpha",
    )
