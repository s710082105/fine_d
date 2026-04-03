"""HTTP request helpers for FineReport Decision endpoints."""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Callable
from urllib import error, request


JsonRequester = Callable[[str, str, dict[str, object] | None, dict[str, str]], dict[str, object]]


class DecisionHttpError(RuntimeError):
    """Raised when a Decision HTTP request fails."""


@dataclass(frozen=True)
class TransmissionProfile:
    transmission_encryption: int
    front_seed: str | None
    front_sm4_key: str | None


def build_login_payload(username: str, password: str) -> dict[str, object]:
    return {
        "username": username,
        "password": password,
        "validity": -1,
        "sliderToken": "",
        "origin": "",
        "encrypted": False,
    }


def default_request_json(
    method: str,
    url: str,
    payload: dict[str, object] | None,
    headers: dict[str, str],
) -> dict[str, object]:
    request_body = None
    if payload is not None:
        request_body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    http_request = request.Request(
        url=url,
        data=request_body,
        method=method,
        headers=headers,
    )
    try:
        with request.urlopen(http_request, timeout=20) as response:
            raw = response.read().decode("utf-8", errors="replace")
    except error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise DecisionHttpError(f"{method} {url} failed: {detail}") from exc
    except error.URLError as exc:
        raise DecisionHttpError(f"{method} {url} failed: {exc.reason}") from exc
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise DecisionHttpError(f"{method} {url} returned non-JSON payload") from exc
    if not isinstance(data, dict):
        raise DecisionHttpError(f"{method} {url} returned unexpected payload")
    error_code = data.get("errorCode")
    if error_code:
        message = data.get("errorMsg") or str(error_code)
        raise DecisionHttpError(message)
    return data


@dataclass(frozen=True)
class DecisionHttpClient:
    """Thin Decision HTTP client used by runtime services."""

    base_url: str
    request_json: JsonRequester = default_request_json

    def login(self, username: str, password: str) -> str:
        response = self.request_json(
            "POST",
            self._url("/login"),
            build_login_payload(username, password),
            {"Content-Type": "application/json", "Accept": "application/json"},
        )
        data = response.get("data")
        if not isinstance(data, dict) or "accessToken" not in data:
            raise DecisionHttpError("login response missing accessToken")
        return str(data["accessToken"])

    def list_connections(self, username: str, password: str) -> list[dict[str, object]]:
        response = self._authorized_get(
            username,
            password,
            "/v10/config/connection/list/0",
        )
        return self._extract_list(response, "connection list")

    def list_datasets(self, username: str, password: str) -> list[dict[str, object]]:
        response = self._authorized_get(username, password, "/v10/dataset")
        return self._extract_list(response, "dataset list")

    def preview_dataset(
        self,
        username: str,
        password: str,
        payload: dict[str, object],
        row_count: int,
    ) -> dict[str, object]:
        path = f"/v10/dataset/preview?rowCount={row_count}"
        response = self._authorized_post(username, password, path, payload)
        data = response.get("data")
        if not isinstance(data, dict):
            raise DecisionHttpError("preview response missing data object")
        return data

    def get_transmission_profile(
        self,
        username: str,
        password: str,
    ) -> TransmissionProfile:
        response = self._authorized_post(username, password, "/remote/design/check", {})
        payload = self._extract_object(response, "transmission profile")
        encryption = payload.get("transmissionEncryption")
        if encryption is None:
            raise DecisionHttpError("transmission profile missing transmissionEncryption")
        return TransmissionProfile(
            transmission_encryption=int(encryption),
            front_seed=_optional_text(payload.get("frontSeed")),
            front_sm4_key=_optional_text(payload.get("frontSM4Key")),
        )

    def _authorized_get(
        self,
        username: str,
        password: str,
        path: str,
    ) -> dict[str, object]:
        token = self.login(username, password)
        return self.request_json("GET", self._url(path), None, self._headers(token))

    def _authorized_post(
        self,
        username: str,
        password: str,
        path: str,
        payload: dict[str, object],
    ) -> dict[str, object]:
        token = self.login(username, password)
        return self.request_json("POST", self._url(path), payload, self._headers(token))

    def _headers(self, token: str) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "Accept": "application/json",
            "X-Requested-With": "XMLHttpRequest",
        }

    def _url(self, path: str) -> str:
        return f"{self.base_url.rstrip('/')}{path}"

    def _extract_list(
        self,
        response: dict[str, object],
        label: str,
    ) -> list[dict[str, object]]:
        data = response.get("data")
        if not isinstance(data, list):
            raise DecisionHttpError(f"{label} response missing data array")
        return [item for item in data if isinstance(item, dict)]

    def _extract_object(
        self,
        response: dict[str, object],
        label: str,
    ) -> dict[str, object]:
        data = response.get("data")
        if isinstance(data, dict):
            return data
        if response:
            return response
        raise DecisionHttpError(f"{label} response missing object payload")


def _optional_text(value: object) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None
