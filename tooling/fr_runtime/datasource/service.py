"""Normalize Decision datasource payloads."""

from __future__ import annotations


def normalize_connection(item: dict[str, str]) -> dict[str, str]:
    return {
        "name": item.get("name") or item["connectionName"],
        "database_type": item.get("databaseType") or item.get("type") or item["driver"],
    }
