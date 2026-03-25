from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class RemoteProfile:
    base_url: str
    username: str
    password: str
