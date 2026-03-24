from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class AppSettings:
    workspace_dir_name: str = "workspace"
    generated_dir_name: str = "generated"


DEFAULT_SETTINGS = AppSettings()
