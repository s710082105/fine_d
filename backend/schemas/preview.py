from pydantic import BaseModel, ConfigDict

from backend.domain.preview.models import PreviewSession, PreviewStatus


class PreviewOpenRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    url: str


class PreviewSessionResponse(BaseModel):
    model_config = ConfigDict(frozen=True)

    session_id: str
    url: str
    status: PreviewStatus

    @classmethod
    def from_domain(cls, session: PreviewSession) -> "PreviewSessionResponse":
        return cls(
            session_id=session.session_id,
            url=session.url,
            status=session.status,
        )
