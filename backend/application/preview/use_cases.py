from typing import Callable, Protocol
from uuid import uuid4

from backend.domain.preview.models import PreviewSession


def _default_session_id_factory() -> str:
    return uuid4().hex


class PreviewGateway(Protocol):
    def open_url(self, url: str) -> None:
        ...


class PreviewUseCases:
    def __init__(
        self,
        gateway: PreviewGateway,
        session_id_factory: Callable[[], str] = _default_session_id_factory,
    ) -> None:
        self._gateway = gateway
        self._session_id_factory = session_id_factory

    def open_preview(self, url: str) -> PreviewSession:
        self._gateway.open_url(url)
        return PreviewSession(
            session_id=self._session_id_factory(),
            url=url,
            status="opened",
        )
