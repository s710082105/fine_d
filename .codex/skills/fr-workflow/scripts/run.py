import sys


def main(argv: list[str] | None = None) -> int:
    args = argv if argv is not None else sys.argv[1:]
    if args:
        print(f"fr-workflow routes by SKILL.md; context hint: {' '.join(args)}")
    else:
        print("fr-workflow routes by SKILL.md")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
