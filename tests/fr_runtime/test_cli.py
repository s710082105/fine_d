from tooling.fr_runtime.cli import build_parser


def test_cli_exposes_expected_subcommands() -> None:
    parser = build_parser()
    action = parser._subparsers._group_actions[0]
    assert sorted(action.choices) == ["db", "doctor", "init", "preview", "sync"]
