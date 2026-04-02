"""HTTP request helpers for FineReport Decision endpoints."""

from __future__ import annotations


def build_login_payload(username: str, password: str) -> dict[str, object]:
    return {
        "username": username,
        "password": password,
        "validity": -1,
        "sliderToken": "",
        "origin": "",
        "encrypted": False,
    }
