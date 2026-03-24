import webbrowser

from backend.domain.project.errors import AppError


class WebBrowserPreviewGateway:
    def open_url(self, url: str) -> None:
        try:
            opened = webbrowser.open(url)
        except Exception as error:
            raise AppError(
                code="preview.open_failed",
                message="browser open failed",
                detail={"url": url},
                source="preview",
            ) from error
        if opened:
            return
        raise AppError(
            code="preview.open_failed",
            message="browser open failed",
            detail={"url": url},
            source="preview",
        )
