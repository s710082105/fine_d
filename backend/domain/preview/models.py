from dataclasses import dataclass
from typing import Literal

PreviewStatus = Literal["opened"]


@dataclass(frozen=True, slots=True)
class PreviewSession:
    session_id: str
    url: str
    status: PreviewStatus
