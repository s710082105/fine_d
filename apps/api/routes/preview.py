from fastapi import APIRouter, Depends

from backend.adapters.browser.preview_gateway import WebBrowserPreviewGateway
from backend.application.preview.use_cases import PreviewUseCases
from backend.schemas.preview import PreviewOpenRequest, PreviewSessionResponse

router = APIRouter()


def get_preview_service() -> PreviewUseCases:
    return PreviewUseCases(WebBrowserPreviewGateway())


@router.post("/api/preview/open", response_model=PreviewSessionResponse)
def open_preview(
    request: PreviewOpenRequest,
    service: PreviewUseCases = Depends(get_preview_service),
) -> PreviewSessionResponse:
    session = service.open_preview(request.url)
    return PreviewSessionResponse.from_domain(session)
