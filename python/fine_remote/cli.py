from __future__ import annotations

import argparse
import base64
import json
from pathlib import Path

from .client import FineRemoteClient


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=["list", "read", "write", "delete"])
    parser.add_argument("--url", required=True)
    parser.add_argument("--username", required=True)
    parser.add_argument("--password", required=True)
    parser.add_argument("--fine-home", required=True)
    parser.add_argument("--path", required=True)
    parser.add_argument("--input-file")
    return parser


def create_client(args: argparse.Namespace) -> FineRemoteClient:
    return FineRemoteClient(
        base_url=args.url,
        username=args.username,
        password=args.password,
        fine_home=Path(args.fine_home),
    )


def run_command(args: argparse.Namespace) -> dict[str, object]:
    client = create_client(args)
    if args.command == "list":
        return list_payload(client, args.path)
    if args.command == "read":
        return read_payload(client, args.path)
    if args.command == "write":
        return write_payload(client, args.path, args.input_file)
    client.delete_file(args.path)
    return {"path": args.path, "deleted": True, "existed": True}


def list_payload(client: FineRemoteClient, path: str) -> dict[str, object]:
    entries = client.list_files(path)
    return {
        "items": [
            {
                "path": entry.path,
                "directory": entry.is_directory,
                "lock": entry.lock,
            }
            for entry in entries
        ]
    }


def read_payload(client: FineRemoteClient, path: str) -> dict[str, object]:
    content = client.read_file(path)
    return {
        "path": path,
        "contentBase64": base64.b64encode(content).decode("ascii"),
    }


def write_payload(
    client: FineRemoteClient,
    path: str,
    input_file: str | None,
) -> dict[str, object]:
    if not input_file:
        raise ValueError("--input-file is required for write")
    content = Path(input_file).read_bytes()
    client.write_file(path, content)
    return {"path": path, "bytesWritten": len(content)}


def main() -> None:
    args = build_parser().parse_args()
    print(json.dumps(run_command(args), ensure_ascii=False))


if __name__ == "__main__":
    main()
