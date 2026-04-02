"""Validate and normalize reportlet sync paths."""

from __future__ import annotations


def normalize_remote_path(raw_path: str) -> str:
    path = raw_path.replace("\\", "/").lstrip("/")
    if not path.startswith("reportlets/"):
        raise ValueError("remote path must stay under reportlets")
    if "/../" in f"/{path}" or path.endswith("/.."):
        raise ValueError("remote path must stay under reportlets")
    return path
