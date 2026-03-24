import importlib

import pytest

from backend.domain.project.errors import AppError


class FakePreviewGateway:
    def __init__(self, error: AppError | None = None) -> None:
        self.opened_urls: list[str] = []
        self._error = error

    def open_url(self, url: str) -> None:
        self.opened_urls.append(url)
        if self._error is not None:
            raise self._error


def _load_preview_use_cases_module():
    try:
        return importlib.import_module("backend.application.preview.use_cases")
    except ModuleNotFoundError as error:
        pytest.fail(f"preview use case module is missing: {error}")


@pytest.fixture
def fake_preview_gateway() -> FakePreviewGateway:
    return FakePreviewGateway()


def test_open_preview_returns_session(
    fake_preview_gateway: FakePreviewGateway,
) -> None:
    module = _load_preview_use_cases_module()
    use_case = module.PreviewUseCases(
        fake_preview_gateway,
        session_id_factory=lambda: "preview-session-1",
    )

    result = use_case.open_preview("http://127.0.0.1:8075/webroot/decision")

    assert result.session_id == "preview-session-1"
    assert result.url == "http://127.0.0.1:8075/webroot/decision"
    assert result.status == "opened"
    assert fake_preview_gateway.opened_urls == [
        "http://127.0.0.1:8075/webroot/decision"
    ]


def test_open_preview_propagates_explicit_gateway_error() -> None:
    module = _load_preview_use_cases_module()
    error = AppError(
        code="preview.open_failed",
        message="browser open failed",
        detail={"url": "http://127.0.0.1:8075/webroot/decision"},
        source="preview",
    )
    gateway = FakePreviewGateway(error=error)
    use_case = module.PreviewUseCases(gateway, session_id_factory=lambda: "ignored")

    with pytest.raises(AppError) as exc_info:
        use_case.open_preview("http://127.0.0.1:8075/webroot/decision")

    assert exc_info.value == error
    assert gateway.opened_urls == ["http://127.0.0.1:8075/webroot/decision"]


@pytest.mark.parametrize("url", ["", "   "])
def test_open_preview_rejects_blank_url(
    fake_preview_gateway: FakePreviewGateway,
    url: str,
) -> None:
    module = _load_preview_use_cases_module()
    use_case = module.PreviewUseCases(
        fake_preview_gateway,
        session_id_factory=lambda: "preview-session-1",
    )

    with pytest.raises(AppError) as exc_info:
        use_case.open_preview(url)

    assert exc_info.value.code == "preview.invalid_url"
    assert exc_info.value.detail == {"url": url}
    assert fake_preview_gateway.opened_urls == []
