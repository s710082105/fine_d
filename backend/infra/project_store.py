import json
from datetime import datetime
from json import JSONDecodeError
from pathlib import Path
from typing import Any

from backend.domain.project.context_models import (
    AGENTS_STATUS_VALUES,
    ProjectContextState,
)
from backend.domain.project.errors import invalid_project_state_error
from backend.domain.project.models import CurrentProject
from backend.domain.project.remote_models import RemoteProfile

STATE_DIR_NAME = ".finereport"
STATE_FILE_NAME = "project-state.json"


class ProjectStore:
    def __init__(self, base_dir: Path) -> None:
        self._base_dir = Path(base_dir)
        self._state_file = self._base_dir / STATE_DIR_NAME / STATE_FILE_NAME

    def load_current_project(self) -> CurrentProject | None:
        current_project = self._load_primary_payload().get("current_project")
        if current_project is None:
            return None
        return CurrentProject(
            path=Path(current_project["path"]),
            name=current_project["name"],
        )

    def save_current_project(self, project: CurrentProject) -> None:
        payload = self._load_primary_payload()
        payload["current_project"] = {
            "path": str(project.path),
            "name": project.name,
        }
        self._save_payload(payload)

    def load_remote_profile(self, project_path: Path) -> RemoteProfile | None:
        profiles = self._load_primary_payload().get("remote_profiles", {})
        profile = profiles.get(str(project_path))
        if profile is None:
            return None
        return RemoteProfile(
            base_url=profile["base_url"],
            username=profile["username"],
            password=profile["password"],
            designer_root=profile.get("designer_root", ""),
        )

    def save_remote_profile(
        self,
        project_path: Path,
        profile: RemoteProfile,
    ) -> None:
        payload = self._load_primary_payload()
        profiles = payload.get("remote_profiles", {})
        profiles[str(project_path)] = {
            "base_url": profile.base_url,
            "username": profile.username,
            "password": profile.password,
            "designer_root": profile.designer_root,
        }
        payload["remote_profiles"] = profiles
        self._save_payload(payload)

    def load_context_state(self, project_path: Path) -> ProjectContextState | None:
        context_state = self._load_context_state_payload(project_path)
        if context_state is None:
            return None
        return ProjectContextState(
            generated_at=datetime.fromisoformat(context_state["generated_at"]),
            agents_status=context_state["agents_status"],
        )

    def save_context_state(
        self,
        project_path: Path,
        context_state: ProjectContextState,
    ) -> None:
        payload = self._load_primary_payload()
        context_states = payload.get("context_states", {})
        if not isinstance(context_states, dict):
            context_states = {}
        context_states[str(project_path)] = {
            "generated_at": context_state.generated_at.isoformat(),
            "agents_status": context_state.agents_status,
        }
        payload["context_states"] = context_states
        self._save_payload(payload)

    def _load_raw_payload(self) -> dict[str, Any]:
        if not self._state_file.exists():
            return {}
        try:
            payload = json.loads(self._state_file.read_text(encoding="utf-8"))
        except (JSONDecodeError, UnicodeDecodeError) as exc:
            raise invalid_project_state_error("state_file") from exc
        if not isinstance(payload, dict):
            raise invalid_project_state_error("state_file")
        return payload

    def _load_primary_payload(self) -> dict[str, Any]:
        payload = self._load_raw_payload()
        return {
            "current_project": self._validate_current_project(payload),
            "remote_profiles": self._validate_remote_profiles(payload),
            "context_states": payload.get("context_states"),
        }

    def _load_context_payload(self) -> dict[str, Any]:
        payload = self._load_raw_payload()
        return {"context_states": self._validate_context_states(payload)}

    def _load_context_state_payload(
        self,
        project_path: Path,
    ) -> dict[str, str] | None:
        payload = self._load_raw_payload()
        return self._validate_context_state_entry(payload, project_path)

    def _save_payload(self, payload: dict[str, Any]) -> None:
        self._state_file.parent.mkdir(parents=True, exist_ok=True)
        temp_file = self._state_file.with_name(f"{self._state_file.name}.tmp")
        temp_file.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        temp_file.replace(self._state_file)

    @staticmethod
    def _validate_current_project(payload: dict[str, Any]) -> dict[str, str] | None:
        current_project = payload.get("current_project")
        if current_project is None:
            return None
        if not isinstance(current_project, dict):
            raise invalid_project_state_error("current_project")
        path = current_project.get("path")
        name = current_project.get("name")
        if not isinstance(path, str) or not isinstance(name, str):
            raise invalid_project_state_error("current_project")
        return {"path": path, "name": name}

    @staticmethod
    def _validate_remote_profiles(payload: dict[str, Any]) -> dict[str, dict[str, str]]:
        remote_profiles = payload.get("remote_profiles")
        if remote_profiles is None:
            return {}
        if not isinstance(remote_profiles, dict):
            raise invalid_project_state_error("remote_profiles")
        validated_profiles: dict[str, dict[str, str]] = {}
        for path, profile in remote_profiles.items():
            if not isinstance(path, str) or not isinstance(profile, dict):
                raise invalid_project_state_error(f"remote_profiles.{path}")
            if not all(
                isinstance(profile.get(field), str)
                for field in ("base_url", "username", "password")
            ):
                raise invalid_project_state_error(f"remote_profiles.{path}")
            designer_root = profile.get("designer_root", "")
            if not isinstance(designer_root, str):
                raise invalid_project_state_error(f"remote_profiles.{path}")
            validated_profiles[path] = {
                "base_url": profile["base_url"],
                "username": profile["username"],
                "password": profile["password"],
                "designer_root": designer_root,
            }
        return validated_profiles

    @staticmethod
    def _validate_context_states(payload: dict[str, Any]) -> dict[str, dict[str, str]]:
        context_states = payload.get("context_states")
        if context_states is None:
            return {}
        if not isinstance(context_states, dict):
            raise invalid_project_state_error("context_states")
        validated_states: dict[str, dict[str, str]] = {}
        for path, context_state in context_states.items():
            if not isinstance(path, str):
                raise invalid_project_state_error(f"context_states.{path}")
            validated_states[path] = ProjectStore._validate_single_context_state(
                path,
                context_state,
            )
        return validated_states

    @staticmethod
    def _validate_context_state_entry(
        payload: dict[str, Any],
        project_path: Path,
    ) -> dict[str, str] | None:
        context_states = payload.get("context_states")
        if context_states is None:
            return None
        if not isinstance(context_states, dict):
            raise invalid_project_state_error("context_states")
        raw_state = context_states.get(str(project_path))
        if raw_state is None:
            return None
        return ProjectStore._validate_single_context_state(
            str(project_path),
            raw_state,
        )

    @staticmethod
    def _validate_single_context_state(
        path: str,
        context_state: Any,
    ) -> dict[str, str]:
        if not isinstance(context_state, dict):
            raise invalid_project_state_error(f"context_states.{path}")
        generated_at = context_state.get("generated_at")
        agents_status = context_state.get("agents_status")
        if not isinstance(generated_at, str) or not isinstance(agents_status, str):
            raise invalid_project_state_error(f"context_states.{path}")
        if agents_status not in AGENTS_STATUS_VALUES:
            raise invalid_project_state_error(f"context_states.{path}")
        try:
            datetime.fromisoformat(generated_at)
        except ValueError as exc:
            raise invalid_project_state_error(
                f"context_states.{path}.generated_at",
            ) from exc
        return {
            "generated_at": generated_at,
            "agents_status": agents_status,
        }
