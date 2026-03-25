from __future__ import annotations

import base64
import binascii
import json
import secrets
from dataclasses import dataclass
from typing import Any

from backend.domain.project.errors import AppError

SYSTEM_MARKER = "Dec.system = JSON.parse('"
SYSTEM_SUFFIX = "')"
RSA_CHUNK_CHAR_SIZE = 50
RSA_CONNECTOR = "---"
SQL_PREVIEW_DATASET_NAME = "tmp_preview"
SUPPORTED_RSA_ENCRYPTION_TYPE = 0
NONZERO_PADDING_BYTE_MIN = 1
NONZERO_PADDING_BYTE_MAX = 256


@dataclass(frozen=True, slots=True)
class SqlPreviewTransport:
    body: dict[str, Any]
    headers: dict[str, str]


def build_sql_preview_transport(
    landing_page: str,
    connection_name: str,
    sql: str,
) -> SqlPreviewTransport:
    system = _parse_system_config(landing_page)
    encryption_type = _read_encryption_type(system)
    if encryption_type != SUPPORTED_RSA_ENCRYPTION_TYPE:
        raise AppError(
            code="datasource.unsupported_encryption",
            message="FineReport SQL 预览加密类型暂不支持",
            detail={"encryptionType": encryption_type},
            source="datasource",
        )
    modulus, exponent, key_size = _parse_public_key(system.get("encryptionKey"))
    dataset_data = {
        "database": connection_name,
        "query": _encrypt_sql(sql, modulus, exponent, key_size),
        "parameters": [],
    }
    body = {
        "datasetType": "sql",
        "datasetName": SQL_PREVIEW_DATASET_NAME,
        "datasetData": json.dumps(dataset_data),
        "parameters": [],
    }
    return SqlPreviewTransport(body=body, headers={"transEncryptLevel": "1"})


def _read_encryption_type(system: dict[str, Any]) -> int:
    value = system.get("encryptionType")
    if isinstance(value, int):
        return value
    raise AppError(
        code="datasource.invalid_landing_page",
        message="FineReport 落地页缺少有效的 encryptionType",
        detail={"payload": system},
        source="datasource",
    )


def _parse_system_config(landing_page: str) -> dict[str, Any]:
    start = landing_page.find(SYSTEM_MARKER)
    if start < 0:
        raise AppError(
            code="datasource.invalid_landing_page",
            message="FineReport 落地页缺少 Dec.system",
            source="datasource",
        )
    start += len(SYSTEM_MARKER)
    end = landing_page.find(SYSTEM_SUFFIX, start)
    if end < 0:
        raise AppError(
            code="datasource.invalid_landing_page",
            message="FineReport 落地页缺少 Dec.system 结束标记",
            source="datasource",
        )
    escaped = landing_page[start:end]
    try:
        decoded = json.loads(f'"{escaped}"')
        payload = json.loads(decoded)
    except json.JSONDecodeError as error:
        raise AppError(
            code="datasource.invalid_landing_page",
            message="FineReport 落地页 Dec.system 解析失败",
            detail={"payload": escaped},
            source="datasource",
        ) from error
    if isinstance(payload, dict):
        return payload
    raise AppError(
        code="datasource.invalid_landing_page",
        message="FineReport Dec.system 不是对象",
        detail={"payload": payload},
        source="datasource",
    )


def _parse_public_key(raw_key: Any) -> tuple[int, int, int]:
    if not isinstance(raw_key, str) or not raw_key.strip():
        raise AppError(
            code="datasource.invalid_landing_page",
            message="FineReport 落地页缺少 encryptionKey",
            source="datasource",
        )
    try:
        der = base64.b64decode(_normalize_pem_body(raw_key), validate=True)
    except binascii.Error as error:
        raise AppError(
            code="datasource.invalid_landing_page",
            message="FineReport encryptionKey 不是合法的 Base64 公钥",
            detail={"encryptionKey": raw_key},
            source="datasource",
        ) from error
    try:
        return _parse_spki_key(der)
    except ValueError as spki_error:
        try:
            return _parse_pkcs1_key(der)
        except ValueError as pkcs1_error:
            raise AppError(
                code="datasource.invalid_landing_page",
                message="FineReport encryptionKey 不是合法的 RSA 公钥",
                detail={
                    "spki_error": str(spki_error),
                    "pkcs1_error": str(pkcs1_error),
                },
                source="datasource",
            ) from pkcs1_error


def _normalize_pem_body(raw_key: str) -> str:
    if "BEGIN " not in raw_key:
        return "".join(raw_key.split())
    lines = []
    for line in raw_key.splitlines():
        line = line.strip()
        if line and not line.startswith("-----"):
            lines.append(line)
    return "".join(lines)


def _parse_spki_key(data: bytes) -> tuple[int, int, int]:
    _, body, _ = _read_tlv(data, 0)
    _, _, offset = _read_tlv(body, 0)
    tag, bit_string, _ = _read_tlv(body, offset)
    if tag != 0x03 or not bit_string:
        raise ValueError("invalid spki bit string")
    if bit_string[0] != 0:
        raise ValueError("spki bit string contains unused bits")
    return _parse_pkcs1_key(bit_string[1:])


def _parse_pkcs1_key(data: bytes) -> tuple[int, int, int]:
    _, body, _ = _read_tlv(data, 0)
    modulus, offset = _read_integer(body, 0)
    exponent, _ = _read_integer(body, offset)
    return modulus, exponent, (modulus.bit_length() + 7) // 8


def _read_integer(data: bytes, offset: int) -> tuple[int, int]:
    tag, value, next_offset = _read_tlv(data, offset)
    if tag != 0x02:
        raise ValueError("expected integer")
    return int.from_bytes(value, "big"), next_offset


def _read_tlv(data: bytes, offset: int) -> tuple[int, bytes, int]:
    if offset >= len(data):
        raise ValueError("unexpected end of ASN.1 payload")
    tag = data[offset]
    length, next_offset = _read_length(data, offset + 1)
    end = next_offset + length
    if end > len(data):
        raise ValueError("ASN.1 length exceeds payload")
    return tag, data[next_offset:end], end


def _read_length(data: bytes, offset: int) -> tuple[int, int]:
    if offset >= len(data):
        raise ValueError("missing ASN.1 length")
    first = data[offset]
    if first < 0x80:
        return first, offset + 1
    count = first & 0x7F
    end = offset + 1 + count
    if count == 0 or end > len(data):
        raise ValueError("invalid ASN.1 length")
    return int.from_bytes(data[offset + 1 : end], "big"), end


def _encrypt_sql(sql: str, modulus: int, exponent: int, key_size: int) -> str:
    chunks = [_encrypt_chunk(chunk, modulus, exponent, key_size) for chunk in _split_sql(sql)]
    return RSA_CONNECTOR.join(chunks)


def _split_sql(sql: str) -> list[str]:
    current = []
    chunks: list[str] = []
    for character in sql:
        current.append(character)
        if len(current) == RSA_CHUNK_CHAR_SIZE:
            chunks.append("".join(current))
            current = []
    if current:
        chunks.append("".join(current))
    return chunks


def _encrypt_chunk(chunk: str, modulus: int, exponent: int, key_size: int) -> str:
    message = chunk.encode("utf-8")
    padding_size = key_size - len(message) - 3
    if padding_size < 8:
        raise AppError(
            code="datasource.invalid_sql",
            message="SQL 分块超过 FineReport RSA 限制",
            detail={"chunk": chunk},
            source="datasource",
        )
    block = b"\x00\x02" + _nonzero_random_bytes(padding_size) + b"\x00" + message
    encrypted = pow(int.from_bytes(block, "big"), exponent, modulus)
    return base64.b64encode(encrypted.to_bytes(key_size, "big")).decode("ascii")


def _nonzero_random_bytes(size: int) -> bytes:
    result = bytearray()
    while len(result) < size:
        candidate = secrets.randbelow(NONZERO_PADDING_BYTE_MAX)
        if candidate >= NONZERO_PADDING_BYTE_MIN:
            result.append(candidate)
    return bytes(result)
