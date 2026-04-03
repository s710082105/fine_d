"""Command-line entrypoints for the FineReport skill runtime."""

from __future__ import annotations

import argparse
import json
from collections.abc import Sequence
from pathlib import Path

from tooling.fr_runtime.bridge import BridgeRunner, ConfiguredBridgeRunner
from tooling.fr_runtime.config import load_config
from tooling.fr_runtime.datasource import DatasourceService
from tooling.fr_runtime.doctor import CheckResult, collect_runtime_checks, detect_designer_java, detect_platform, render_report
from tooling.fr_runtime.init import merge_answers
from tooling.fr_runtime.preview import build_preview_summary, build_preview_url
from tooling.fr_runtime.remote import DecisionHttpClient
from tooling.fr_runtime.sync import SyncService, normalize_remote_path


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
    parser.add_argument("--config-path", default=".codex/fr-config.json")
    parser.add_argument(
        "action",
        nargs="?",
        choices=["list-connections", "list-datasets", "preview-sql"],
        default="list-connections",
    )
    parser.add_argument("--connection")
    parser.add_argument("--sql")
    parser.add_argument("--row-count", type=int, default=200)


def _build_sync_parser(subparsers: argparse._SubParsersAction[argparse.ArgumentParser]) -> None:
    parser = subparsers.add_parser("sync", help="sync reportlets with remote runtime")
    parser.add_argument("--config-path", default=".codex/fr-config.json")
    parser.add_argument(
        "action",
        nargs="?",
        choices=["pull", "push", "prepare-create", "prepare-edit"],
        default="pull",
    )
    parser.add_argument("target_path", nargs="?")


def _build_preview_parser(subparsers: argparse._SubParsersAction[argparse.ArgumentParser]) -> None:
    parser = subparsers.add_parser("preview", help="review synced reportlets in browser")
    parser.add_argument("--config-path")
    parser.add_argument("--url")
    parser.add_argument("--report-path")
    parser.add_argument("--expectation")
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
    results = [CheckResult("配置文件", "通过", str(config_path))]
    try:
        decision_client = build_decision_client(config)
        bridge_runner = build_configured_bridge_runner(config, Path.cwd())
        results.extend(
            collect_runtime_checks(
                config=config,
                repo_root=Path.cwd(),
                decision_client=decision_client,
                bridge_runner=bridge_runner,
            )
        )
    except Exception as exc:
        results.append(CheckResult("Runtime Checks", "失败", str(exc)))
        print(render_report(results))
        return 1
    print(render_report(results))
    return 0


def _handle_db(args: argparse.Namespace) -> int:
    config = load_config(Path(args.config_path))
    service = build_datasource_service(config, Path.cwd())
    if args.action == "list-connections":
        payload = service.list_connections(config.username, config.password)
    elif args.action == "list-datasets":
        payload = service.list_datasets(config.username, config.password)
    else:
        if not args.connection or not args.sql:
            raise SystemExit("preview-sql requires --connection and --sql")
        payload = service.preview_sql(
            config.username,
            config.password,
            connection_name=args.connection,
            sql=args.sql,
            row_count=args.row_count,
        )
    print(json.dumps(payload, ensure_ascii=False, indent=2))
    return 0


def _handle_sync(args: argparse.Namespace) -> int:
    if args.action in {"pull", "push", "prepare-create", "prepare-edit"} and not args.target_path:
        raise SystemExit("sync target_path is required")
    config = load_config(Path(args.config_path))
    service = build_sync_service(config, Path.cwd())
    target = normalize_remote_path(args.target_path) if args.target_path else None
    if args.action == "pull":
        payload = service.pull(target)
    elif args.action == "push":
        payload = service.push(target)
    elif args.action == "prepare-create":
        payload = service.prepare_create(target)
    else:
        payload = service.prepare_edit(target)
    print(json.dumps(payload, ensure_ascii=False, indent=2))
    return 0


def _handle_preview(args: argparse.Namespace) -> int:
    login_url = None
    username = None
    url = args.url
    if args.config_path:
        config = load_config(Path(args.config_path))
        login_url = config.decision_url
        username = config.username
        if not url and args.report_path:
            url = build_preview_url(config.decision_url, args.report_path)
    if not url:
        raise SystemExit("preview url or report_path is required")
    print(
        build_preview_summary(
            url,
            opened=True,
            queried=args.queried,
            login_url=login_url,
            username=username,
            report_path=args.report_path,
            expectation=args.expectation,
        )
    )
    return 0


def build_decision_client(config: object) -> DecisionHttpClient:
    return DecisionHttpClient(getattr(config, "decision_url"))


def build_datasource_service(config: object, repo_root: Path) -> DatasourceService:
    bridge_runner = build_configured_bridge_runner(config, repo_root)
    decision_client = build_decision_client(config)
    username = str(getattr(config, "username"))
    password = str(getattr(config, "password"))

    def encrypt_sql(sql: str) -> str:
        profile = decision_client.get_transmission_profile(username, password)
        response = bridge_runner.invoke(
            "encrypt-transmission",
            {
                "text": sql,
                "transmissionEncryption": profile.transmission_encryption,
                "frontSeed": profile.front_seed,
                "frontSm4Key": profile.front_sm4_key,
            },
        )
        return str(response["text"])

    return DatasourceService(
        gateway=decision_client,
        encrypt_sql=encrypt_sql,
    )


def build_sync_service(config: object, repo_root: Path) -> SyncService:
    return SyncService(
        bridge=build_configured_bridge_runner(config, repo_root),
        workspace_root=Path(getattr(config, "workspace_root")),
        template_root=repo_root / ".codex" / "skills" / "fr-create" / "assets" / "template",
    )


def build_configured_bridge_runner(config: object, repo_root: Path) -> ConfiguredBridgeRunner:
    java_path = detect_designer_java(Path(getattr(config, "designer_root")))
    runner = BridgeRunner(
        java_path=java_path,
        jar_path=repo_root / "bridge" / "dist" / "fr-remote-bridge.jar",
    )
    return ConfiguredBridgeRunner(
        runner=runner,
        fine_home=Path(getattr(config, "designer_root")),
        base_url=str(getattr(config, "decision_url")),
        username=str(getattr(config, "username")),
        password=str(getattr(config, "password")),
    )


__all__ = [
    "build_datasource_service",
    "build_decision_client",
    "build_parser",
    "build_sync_service",
    "main",
]


if __name__ == "__main__":
    raise SystemExit(main())
