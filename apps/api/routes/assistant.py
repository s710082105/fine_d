from fastapi import APIRouter, Depends

from backend.application.assistant.use_cases import AssistantUseCases
from backend.schemas.assistant import AssistantRouteRequest, AssistantRouteResponse

router = APIRouter()


def get_assistant_service() -> AssistantUseCases:
    return AssistantUseCases()


@router.post("/api/assistant/route", response_model=AssistantRouteResponse)
def route_prompt(
    request: AssistantRouteRequest,
    service: AssistantUseCases = Depends(get_assistant_service),
) -> AssistantRouteResponse:
    result = service.route_prompt(request.prompt)
    return AssistantRouteResponse.from_domain(result)
