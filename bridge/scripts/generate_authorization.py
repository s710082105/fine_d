from __future__ import annotations

import argparse
import base64
import shutil
import subprocess
from datetime import datetime, timezone
from pathlib import Path

from build_bridge import DEFAULT_AUTHORIZATION_FILE_NAME


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Generate FineReport bridge authorization file.")
    parser.add_argument("--private-key-file", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--mac", required=True)
    parser.add_argument("--expires-at", required=True)
    parser.add_argument("--openssl", default="openssl")
    args = parser.parse_args(argv)

    authorization_path = build_authorization_file(
        private_key_file=args.private_key_file.resolve(),
        output_dir=args.output_dir.resolve(),
        mac=args.mac,
        expires_at=args.expires_at,
        openssl_cmd=args.openssl,
    )
    print(authorization_path)
    return 0


def build_authorization_file(
    *,
    private_key_file: Path,
    output_dir: Path,
    mac: str,
    expires_at: str,
    openssl_cmd: str,
) -> Path:
    canonical_mac = normalize_mac(mac)
    canonical_expires_at = normalize_utc_timestamp(expires_at)
    signature = sign_payload(
        private_key_file=private_key_file,
        payload=canonical_payload(canonical_mac, canonical_expires_at),
        openssl_cmd=openssl_cmd,
    )
    output_dir.mkdir(parents=True, exist_ok=True)
    authorization_path = output_dir / DEFAULT_AUTHORIZATION_FILE_NAME
    authorization_path.write_text(
        encode_payload(
            {
                "mac": canonical_mac,
                "expires_at": canonical_expires_at,
                "signature": base64.b64encode(signature).decode("ascii"),
            }
        )
        + "\n",
        encoding="utf-8",
    )
    return authorization_path


def normalize_mac(value: str) -> str:
    compact = "".join(char for char in value if char.isalnum()).upper()
    if len(compact) != 12 or any(char not in "0123456789ABCDEF" for char in compact):
        raise ValueError(f"invalid mac address: {value}")
    return ":".join(compact[index:index + 2] for index in range(0, len(compact), 2))


def normalize_utc_timestamp(value: str) -> str:
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ValueError(f"invalid expiry timestamp: {value}") from exc
    if parsed.tzinfo is None:
        raise ValueError(f"expiry timestamp must include timezone: {value}")
    return parsed.astimezone(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def sign_payload(*, private_key_file: Path, payload: str, openssl_cmd: str) -> bytes:
    openssl = resolve_tool(openssl_cmd)
    result = subprocess.run(
        [openssl, "dgst", "-sha256", "-sign", str(private_key_file)],
        input=payload.encode("utf-8"),
        capture_output=True,
        check=True,
    )
    return result.stdout


def resolve_tool(command: str) -> str:
    direct = Path(command)
    if direct.exists():
        return str(direct)
    resolved = shutil.which(command)
    if resolved:
        return resolved
    raise FileNotFoundError(f"required tool not found: {command}")


def canonical_payload(mac: str, expires_at: str) -> str:
    return f"mac={mac}\nexpires_at={expires_at}\n"


def encode_payload(payload: dict[str, str]) -> str:
    lines: list[str] = []
    for key, value in payload.items():
        encoded = base64.b64encode(value.encode("utf-8")).decode("ascii")
        lines.append(f"{key}={encoded}")
    return "\n".join(lines)


if __name__ == "__main__":
    raise SystemExit(main())
