### Task 5: 使用 `skill-creator` 重建 FineReport skill 目录

前置：仓库已内置 `.codex/skills/superpowers/` 与 `.codex/skills/skill-creator/`，本任务不得依赖系统级 superpowers 或系统级 skill-creator。

**Files:**
- Modify/Create: `.codex/skills/fr-workflow/**`
- Create: `.codex/skills/fr-init/**`
- Modify/Create: `.codex/skills/fr-status-check/**`
- Modify/Create: `.codex/skills/fr-db/**`
- Create: `.codex/skills/fr-create/**`
- Create: `.codex/skills/fr-cpt/**`
- Create: `.codex/skills/fr-fvs/**`
- Modify/Create: `.codex/skills/fr-download-sync/**`
- Modify/Create: `.codex/skills/fr-upload-sync/**`
- Modify/Create: `.codex/skills/fr-browser-review/**`

- [ ] **Step 1: Initialize skill folders with `skill-creator`**

Run these commands one skill at a time:

```bash
# macOS / Linux
python3 .codex/skills/skill-creator/scripts/init_skill.py fr-init --path .codex/skills --resources scripts,references,assets
python3 .codex/skills/skill-creator/scripts/init_skill.py fr-create --path .codex/skills --resources scripts,references,assets
python3 .codex/skills/skill-creator/scripts/init_skill.py fr-cpt --path .codex/skills --resources scripts,references,assets
python3 .codex/skills/skill-creator/scripts/init_skill.py fr-fvs --path .codex/skills --resources scripts,references,assets

# Windows
py .codex\skills\skill-creator\scripts\init_skill.py fr-init --path .codex\skills --resources scripts,references,assets
py .codex\skills\skill-creator\scripts\init_skill.py fr-create --path .codex\skills --resources scripts,references,assets
py .codex\skills\skill-creator\scripts\init_skill.py fr-cpt --path .codex\skills --resources scripts,references,assets
py .codex\skills\skill-creator\scripts\init_skill.py fr-fvs --path .codex\skills --resources scripts,references,assets
```

Expected: each command creates `SKILL.md`, `agents/openai.yaml`, `scripts/`, `references/`, `assets/`

- [ ] **Step 2: Author thin runtime entrypoints and template assets**

```python
# .codex/skills/fr-status-check/scripts/run.py
import sys

from tooling.fr_runtime.cli import main


if __name__ == "__main__":
    raise SystemExit(main(["doctor", *sys.argv[1:]]))
```

```python
# .codex/skills/fr-init/scripts/run.py
import sys

from tooling.fr_runtime.cli import main


if __name__ == "__main__":
    raise SystemExit(main(["init", *sys.argv[1:]]))
```

Copy assets:

- `templates/blank.cpt` -> `.codex/skills/fr-create/assets/template/blank.cpt`
- `templates/blank.fvs` -> `.codex/skills/fr-create/assets/template/blank.fvs`
- create `.codex/skills/fr-init/assets/template/project-context.md`
- create `.codex/skills/fr-init/assets/template/project-rules.md`
- create `.codex/skills/fr-init/assets/template/workflow-overview.md`

- [ ] **Step 3: Rewrite SKILL.md bodies to match the standard**

Use the following contract matrix when editing `SKILL.md`:

| skill | execution target | expected evidence | next skill |
| --- | --- | --- | --- |
| `fr-workflow` | route only | chosen skill name + reason | `fr-init` or domain skill |
| `fr-init` | `main(["init", ...])` | field confirmation + retry list | `fr-status-check` |
| `fr-status-check` | `main(["doctor", ...])` | environment report + remote probe | `fr-db` / `fr-download-sync` / `fr-create` |
| `fr-db` | `main(["db", ...])` | connections, SQL preview, dataset XML | `fr-cpt` / `fr-fvs` |
| `fr-create` | `main(["sync", "prepare-create", ...])` | conflict check + created target | `fr-cpt` / `fr-fvs` |
| `fr-cpt` | local edit rules only | changed CPT file + changed sections | `fr-upload-sync` |
| `fr-fvs` | local edit rules only | changed FVS file + changed sections | `fr-upload-sync` |
| `fr-download-sync` | `main(["sync", "pull", ...])` | pulled remote path + local file path | `fr-cpt` / `fr-fvs` |
| `fr-upload-sync` | `main(["sync", "push", ...])` | pushed path + verify evidence | `fr-browser-review` |
| `fr-browser-review` | `main(["preview", ...])` | preview summary block | done |

- [ ] **Step 4: Validate every skill**

Run:

```bash
# macOS / Linux
python3 .codex/skills/skill-creator/scripts/quick_validate.py .codex/skills/fr-init
python3 .codex/skills/skill-creator/scripts/quick_validate.py .codex/skills/fr-create
python3 .codex/skills/skill-creator/scripts/quick_validate.py .codex/skills/fr-cpt
python3 .codex/skills/skill-creator/scripts/quick_validate.py .codex/skills/fr-fvs

# Windows
py .codex\skills\skill-creator\scripts\quick_validate.py .codex\skills\fr-init
py .codex\skills\skill-creator\scripts\quick_validate.py .codex\skills\fr-create
py .codex\skills\skill-creator\scripts\quick_validate.py .codex\skills\fr-cpt
py .codex\skills\skill-creator\scripts\quick_validate.py .codex\skills\fr-fvs
```

Expected: output contains `valid`

### Task 6: 完成最终验证与仓库文档收口

**Files:**
- Modify: `README.md`
- Verify only: `tests/fr_runtime/*.py`
- Verify only: `.codex/skills/fr-*`
- Verify only: `bridge/dist/*`

- [ ] **Step 1: Run the targeted Python test suite**

Run: `pytest tests/fr_runtime -q`
Expected: all runtime tests pass

- [ ] **Step 2: Run skill validation across all FineReport skills**

Run:

```bash
# macOS / Linux
python3 .codex/skills/skill-creator/scripts/quick_validate.py .codex/skills/fr-workflow
python3 .codex/skills/skill-creator/scripts/quick_validate.py .codex/skills/fr-init
python3 .codex/skills/skill-creator/scripts/quick_validate.py .codex/skills/fr-status-check
python3 .codex/skills/skill-creator/scripts/quick_validate.py .codex/skills/fr-db
python3 .codex/skills/skill-creator/scripts/quick_validate.py .codex/skills/fr-create
python3 .codex/skills/skill-creator/scripts/quick_validate.py .codex/skills/fr-cpt
python3 .codex/skills/skill-creator/scripts/quick_validate.py .codex/skills/fr-fvs
python3 .codex/skills/skill-creator/scripts/quick_validate.py .codex/skills/fr-download-sync
python3 .codex/skills/skill-creator/scripts/quick_validate.py .codex/skills/fr-upload-sync
python3 .codex/skills/skill-creator/scripts/quick_validate.py .codex/skills/fr-browser-review

# Windows
py .codex\skills\skill-creator\scripts\quick_validate.py .codex\skills\fr-workflow
py .codex\skills\skill-creator\scripts\quick_validate.py .codex\skills\fr-init
py .codex\skills\skill-creator\scripts\quick_validate.py .codex\skills\fr-status-check
py .codex\skills\skill-creator\scripts\quick_validate.py .codex\skills\fr-db
py .codex\skills\skill-creator\scripts\quick_validate.py .codex\skills\fr-create
py .codex\skills\skill-creator\scripts\quick_validate.py .codex\skills\fr-cpt
py .codex\skills\skill-creator\scripts\quick_validate.py .codex\skills\fr-fvs
py .codex\skills\skill-creator\scripts\quick_validate.py .codex\skills\fr-download-sync
py .codex\skills\skill-creator\scripts\quick_validate.py .codex\skills\fr-upload-sync
py .codex\skills\skill-creator\scripts\quick_validate.py .codex\skills\fr-browser-review
```

Expected: no validation errors

- [ ] **Step 3: Run command smoke tests**

Run:

```bash
# macOS / Linux
python3 -m tooling.fr_runtime.cli init --help
python3 -m tooling.fr_runtime.cli doctor --help
python3 -m tooling.fr_runtime.cli db --help
python3 -m tooling.fr_runtime.cli sync --help
python3 -m tooling.fr_runtime.cli preview --help

# Windows
py -m tooling.fr_runtime.cli init --help
py -m tooling.fr_runtime.cli doctor --help
py -m tooling.fr_runtime.cli db --help
py -m tooling.fr_runtime.cli sync --help
py -m tooling.fr_runtime.cli preview --help
```

Expected: all commands exit `0`

- [ ] **Step 4: Update repository guidance**

Add a short `README.md` section that points readers to:

- `docs/superpowers/specs/2026-04-02-finereport-skill-standard/`
- `docs/superpowers/plans/2026-04-02-finereport-skill-standard/`
- `.codex/skills/fr-workflow/`

Expected: repo root README explains where FineReport skill runtime and skill standard live
