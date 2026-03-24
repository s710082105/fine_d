from dataclasses import dataclass
from typing import Literal

AssistantRouteStatus = Literal["routed", "needs_clarification"]
AssistantModule = Literal[
    "datasource",
    "reportlet",
    "sync",
    "preview",
    "assistant",
]


@dataclass(frozen=True, slots=True)
class AssistantRouteResult:
    prompt: str
    status: AssistantRouteStatus
    module: AssistantModule
    actions: list[str]
    message: str
