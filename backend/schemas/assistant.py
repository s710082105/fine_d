from pydantic import BaseModel, ConfigDict

from backend.domain.assistant.models import (
    AssistantModule,
    AssistantRouteResult,
    AssistantRouteStatus,
)


class AssistantRouteRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    prompt: str


class AssistantRouteResponse(BaseModel):
    model_config = ConfigDict(frozen=True)

    prompt: str
    status: AssistantRouteStatus
    module: AssistantModule
    actions: list[str]
    message: str

    @classmethod
    def from_domain(cls, result: AssistantRouteResult) -> "AssistantRouteResponse":
        return cls(
            prompt=result.prompt,
            status=result.status,
            module=result.module,
            actions=list(result.actions),
            message=result.message,
        )
