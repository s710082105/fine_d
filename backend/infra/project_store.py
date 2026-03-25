import json
from json import JSONDecodeError
from pathlib import Path
from typing import Any

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
        current_project = self._load_payload().get("current_project")
        if current_project is None:
            return None
        return CurrentProject(
            path=Path(current_project["path"]),
            name=current_project["name"],
        )

    def save_current_project(self, project: CurrentProject) -> None:
        payload = self._load_payload()
        payload["current_project"] = {
            "path": str(project.path),
            "name": project.name,
        }
        self._save_payload(payload)

    def load_remote_profile(self, project_path: Path) -> RemoteProfile | None:
        profiles = self._load_payload().get("remote_profiles", {})
        profile = profiles.get(str(project_path))
        if profile is None:
            return None
        return RemoteProfile(
            base_url=profile["base_url"],
            username=profile["username"],
            password=profile["password"],
        )

    def save_remote_profile(
        self,
        project_path: Path,
        profile: RemoteProfile,
    ) -> None:
        payload = self._load_payload()
        profiles = payload.get("remote_profiles", {})
        profiles[str(project_path)] = {
            "base_url": profile.base_url,
            "username": profile.username,
            "password": profile.password,
        }
        payload["remote_profiles"] = profiles
        self._save_payload(payload)

    def _load_payload(self) -> dict[str, Any]:
        if not self._state_file.exists():
            return {}
        try:
            payload = json.loads(self._state_file.read_text(encoding="utf-8"))
        except JSONDecodeError as exc:
            raise invalid_project_state_error("state_file") from exc
        if not isinstance(payload, dict):
            raise invalid_project_state_error("state_file")
        return {
            "current_project": self._validate_current_project(payload),
            "remote_profiles": self._validate_remote_profiles(payload),
        }

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
            validated_profiles[path] = {
                "base_url": profile["base_url"],
                "username": profile["username"],
                "password": profile["password"],
            }
        return validated_profiles
