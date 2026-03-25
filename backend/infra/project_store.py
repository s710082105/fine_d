import json
from pathlib import Path

from backend.domain.project.models import CurrentProject
from backend.domain.project.remote_models import RemoteProfile

STATE_DIR_NAME = ".finereport"
STATE_FILE_NAME = "project-state.json"


class ProjectStore:
    def __init__(self, base_dir: Path) -> None:
        self._base_dir = Path(base_dir)
        self._state_file = self._base_dir / STATE_DIR_NAME / STATE_FILE_NAME

    def load_current_project(self) -> CurrentProject | None:
        payload = self._load_payload()
        current_project = payload.get("current_project")
        if not isinstance(current_project, dict):
            return None
        path = current_project.get("path")
        name = current_project.get("name")
        if not isinstance(path, str) or not isinstance(name, str):
            return None
        return CurrentProject(path=Path(path), name=name)

    def save_current_project(self, project: CurrentProject) -> None:
        payload = self._load_payload()
        payload["current_project"] = {
            "path": str(project.path),
            "name": project.name,
        }
        self._save_payload(payload)

    def load_remote_profile(self, project_path: Path) -> RemoteProfile | None:
        payload = self._load_payload()
        profiles = payload.get("remote_profiles")
        if not isinstance(profiles, dict):
            return None
        profile = profiles.get(str(project_path))
        if not isinstance(profile, dict):
            return None
        if not self._is_valid_profile_payload(profile):
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
        profiles = payload.get("remote_profiles")
        if not isinstance(profiles, dict):
            profiles = {}
        profiles[str(project_path)] = {
            "base_url": profile.base_url,
            "username": profile.username,
            "password": profile.password,
        }
        payload["remote_profiles"] = profiles
        self._save_payload(payload)

    def _load_payload(self) -> dict[str, object]:
        if not self._state_file.exists():
            return {}
        return json.loads(self._state_file.read_text(encoding="utf-8"))

    def _save_payload(self, payload: dict[str, object]) -> None:
        self._state_file.parent.mkdir(parents=True, exist_ok=True)
        self._state_file.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

    @staticmethod
    def _is_valid_profile_payload(profile: dict[str, object]) -> bool:
        return all(
            isinstance(profile.get(field), str)
            for field in ("base_url", "username", "password")
        )
