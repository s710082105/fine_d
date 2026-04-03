import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[4]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from tooling.fr_runtime.cli import main


if __name__ == "__main__":
    raise SystemExit(main(["preview", *sys.argv[1:]]))
