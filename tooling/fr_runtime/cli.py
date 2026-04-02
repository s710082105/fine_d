"""Command-line entrypoints for the FineReport skill runtime."""

from __future__ import annotations

import argparse
import json
from collections.abc import Sequence
from pathlib import Path

from tooling.fr_runtime.config import load_config
from tooling.fr_runtime.doctor import CheckResult, detect_designer_java, detect_platform, render_report
from tooling.fr_runtime.init import merge_answers
from tooling.fr_runtime.preview import build_preview_summary
from tooling.fr_runtime.sync import normalize_remote_path


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="fr-runtime")
    subparsers = parser.add_subparsers(dest="command", required=True)
    _build_init_parser(subparsers)
    _build_doctor_parser(subparsers)
    _build_db_parser(subparsers)
    _build_sync_parser(subparsers)
    _build_preview_parser(subparsers)
    return parser


def _build_init_parser(subparsers: argparse._SubParsersAction[argparse.ArgumentParser]) -> None:
    parser = subparsers.add_parser("init", help="collect and validate project init fields")
    parser.add_argument("--config-path", default=".codex/fr-config.json")
    parser.add_argument("--answers-json")


def _build_doctor_parser(subparsers: argparse._SubParsersAction[argparse.ArgumentParser]) -> None:
    parser = subparsers.add_parser("doctor", help="run local and remote health checks")
    parser.add_argument("--config-path", default=".codex/fr-config.json")


def _build_db_parser(subparsers: argparse._SubParsersAction[argparse.ArgumentParser]) -> None:
    parser = subparsers.add_parser("db", help="inspect datasource and SQL metadata")
    parser.add_argument(
        "action",
        nargs="?",
        choices=["list-connections", "list-datasets", "preview-sql"],
        default="list-connections",
    )


def _build_sync_parser(subparsers: argparse._SubParsersAction[argparse.ArgumentParser]) -> None:
    parser = subparsers.add_parser("sync", help="sync reportlets with remote runtime")
    parser.add_argument(
        "action",
        nargs="?",
        choices=["pull", "push", "prepare-create", "prepare-edit"],
        default="pull",
    )
    parser.add_argument("target_path", nargs="?")


def _build_preview_parser(subparsers: argparse._SubParsersAction[argparse.ArgumentParser]) -> None:
    parser = subparsers.add_parser("preview", help="review synced reportlets in browser")
    parser.add_argument("--url")
    parser.add_argument("--queried", action="store_true")


def main(argv: Sequence[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(list(argv) if argv is not None else None)
    if args.command == "init":
        return _handle_init(args)
    if args.command == "doctor":
        return _handle_doctor(args)
    if args.command == "db":
        return _handle_db(args)
    if args.command == "sync":
        return _handle_sync(args)
    if args.command == "preview":
        return _handle_preview(args)
    raise NotImplementedError(args.command)


def _handle_init(args: argparse.Namespace) -> int:
    answers = json.loads(args.answers_json) if args.answers_json else {}
    result = merge_answers({}, answers)
    print(json.dumps(result.__dict__, ensure_ascii=False, indent=2))
    return 0 if not result.retry_fields else 1


def _handle_doctor(args: argparse.Namespace) -> int:
    config_path = Path(args.config_path)
    if not config_path.exists():
        print(render_report([CheckResult("配置文件", "失败", str(config_path))]))
        return 1
    config = load_config(config_path)
    results = [CheckResult("OS", "通过", detect_platform())]
    results.append(CheckResult("配置文件", "通过", str(config_path)))
    try:
        java_path = detect_designer_java(config.designer_root)
    except FileNotFoundError as exc:
        results.append(CheckResult("Designer Java", "失败", str(exc)))
        print(render_report(results))
        return 1
    results.append(CheckResult("Designer Java", "通过", str(java_path)))
    manifest = Path("bridge/dist/manifest.json")
    jar_path = Path("bridge/dist/fr-remote-bridge.jar")
    bridge_state = "jar present" if jar_path.exists() else "jar missing"
    results.append(CheckResult("Bridge Manifest", "通过" if manifest.exists() else "失败", str(manifest)))
    results.append(CheckResult("Bridge Jar", "通过" if jar_path.exists() else "失败", bridge_state))
    print(render_report(results))
    return 0 if jar_path.exists() else 1


def _handle_db(args: argparse.Namespace) -> int:
    print(
        json.dumps(
            {"command": "db", "action": args.action, "status": "ready"},
            ensure_ascii=False,
        )
    )
    return 0


def _handle_sync(args: argparse.Namespace) -> int:
    if args.action in {"pull", "push", "prepare-create", "prepare-edit"} and not args.target_path:
        raise SystemExit("sync target_path is required")
    target = normalize_remote_path(args.target_path) if args.target_path else None
    print(json.dumps({"command": "sync", "action": args.action, "target_path": target}, ensure_ascii=False))
    return 0


def _handle_preview(args: argparse.Namespace) -> int:
    if not args.url:
        raise SystemExit("preview url is required")
    print(build_preview_summary(args.url, opened=True, queried=args.queried))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
