### Task 5: 使用 `skill-creator` 重建 FineReport skill 目录

**Files:**
- Modify/Create: `skills/fr-workflow/**`
- Create: `skills/fr-init/**`
- Modify/Create: `skills/fr-status-check/**`
- Modify/Create: `skills/fr-db/**`
- Create: `skills/fr-create/**`
- Create: `skills/fr-cpt/**`
- Create: `skills/fr-fvs/**`
- Modify/Create: `skills/fr-download-sync/**`
- Modify/Create: `skills/fr-upload-sync/**`
- Modify/Create: `skills/fr-browser-review/**`

- [ ] **Step 1: Initialize skill folders with `skill-creator`**

Run these commands one skill at a time:

```bash
# macOS / Linux
python3 ~/.codex/skills/.system/skill-creator/scripts/init_skill.py fr-init --path skills --resources scripts,references,assets
python3 ~/.codex/skills/.system/skill-creator/scripts/init_skill.py fr-create --path skills --resources scripts,references,assets
python3 ~/.codex/skills/.system/skill-creator/scripts/init_skill.py fr-cpt --path skills --resources scripts,references,assets
python3 ~/.codex/skills/.system/skill-creator/scripts/init_skill.py fr-fvs --path skills --resources scripts,references,assets

# Windows
py %USERPROFILE%\.codex\skills\.system\skill-creator\scripts\init_skill.py fr-init --path skills --resources scripts,references,assets
py %USERPROFILE%\.codex\skills\.system\skill-creator\scripts\init_skill.py fr-create --path skills --resources scripts,references,assets
py %USERPROFILE%\.codex\skills\.system\skill-creator\scripts\init_skill.py fr-cpt --path skills --resources scripts,references,assets
py %USERPROFILE%\.codex\skills\.system\skill-creator\scripts\init_skill.py fr-fvs --path skills --resources scripts,references,assets
```

Expected: each command creates `SKILL.md`, `agents/openai.yaml`, `scripts/`, `references/`, `assets/`

- [ ] **Step 2: Author thin runtime entrypoints and template assets**

```python
# skills/fr-status-check/scripts/run.py
import sys

from tooling.fr_runtime.cli import main


if __name__ == "__main__":
    raise SystemExit(main(["doctor", *sys.argv[1:]]))
```

```python
# skills/fr-init/scripts/run.py
import sys

from tooling.fr_runtime.cli import main


if __name__ == "__main__":
    raise SystemExit(main(["init", *sys.argv[1:]]))
```

Copy assets:

- `templates/blank.cpt` -> `skills/fr-create/assets/template/blank.cpt`
- `templates/blank.fvs` -> `skills/fr-create/assets/template/blank.fvs`
- create `skills/fr-init/assets/template/project-context.md`
- create `skills/fr-init/assets/template/project-rules.md`
- create `skills/fr-init/assets/template/workflow-overview.md`

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
python3 ~/.codex/skills/.system/skill-creator/scripts/quick_validate.py skills/fr-init
python3 ~/.codex/skills/.system/skill-creator/scripts/quick_validate.py skills/fr-create
python3 ~/.codex/skills/.system/skill-creator/scripts/quick_validate.py skills/fr-cpt
python3 ~/.codex/skills/.system/skill-creator/scripts/quick_validate.py skills/fr-fvs

# Windows
py %USERPROFILE%\.codex\skills\.system\skill-creator\scripts\quick_validate.py skills\fr-init
py %USERPROFILE%\.codex\skills\.system\skill-creator\scripts\quick_validate.py skills\fr-create
py %USERPROFILE%\.codex\skills\.system\skill-creator\scripts\quick_validate.py skills\fr-cpt
py %USERPROFILE%\.codex\skills\.system\skill-creator\scripts\quick_validate.py skills\fr-fvs
```

Expected: output contains `valid`

### Task 6: 完成最终验证与仓库文档收口

**Files:**
- Modify: `README.md`
- Verify only: `tests/fr_runtime/*.py`
- Verify only: `skills/*`
- Verify only: `bridge/dist/*`

- [ ] **Step 1: Run the targeted Python test suite**

Run: `pytest tests/fr_runtime -q`
Expected: all runtime tests pass

- [ ] **Step 2: Run skill validation across all FineReport skills**

Run:

```bash
# macOS / Linux
python3 ~/.codex/skills/.system/skill-creator/scripts/quick_validate.py skills/fr-workflow
python3 ~/.codex/skills/.system/skill-creator/scripts/quick_validate.py skills/fr-init
python3 ~/.codex/skills/.system/skill-creator/scripts/quick_validate.py skills/fr-status-check
python3 ~/.codex/skills/.system/skill-creator/scripts/quick_validate.py skills/fr-db
python3 ~/.codex/skills/.system/skill-creator/scripts/quick_validate.py skills/fr-create
python3 ~/.codex/skills/.system/skill-creator/scripts/quick_validate.py skills/fr-cpt
python3 ~/.codex/skills/.system/skill-creator/scripts/quick_validate.py skills/fr-fvs
python3 ~/.codex/skills/.system/skill-creator/scripts/quick_validate.py skills/fr-download-sync
python3 ~/.codex/skills/.system/skill-creator/scripts/quick_validate.py skills/fr-upload-sync
python3 ~/.codex/skills/.system/skill-creator/scripts/quick_validate.py skills/fr-browser-review

# Windows
py %USERPROFILE%\.codex\skills\.system\skill-creator\scripts\quick_validate.py skills\fr-workflow
py %USERPROFILE%\.codex\skills\.system\skill-creator\scripts\quick_validate.py skills\fr-init
py %USERPROFILE%\.codex\skills\.system\skill-creator\scripts\quick_validate.py skills\fr-status-check
py %USERPROFILE%\.codex\skills\.system\skill-creator\scripts\quick_validate.py skills\fr-db
py %USERPROFILE%\.codex\skills\.system\skill-creator\scripts\quick_validate.py skills\fr-create
py %USERPROFILE%\.codex\skills\.system\skill-creator\scripts\quick_validate.py skills\fr-cpt
py %USERPROFILE%\.codex\skills\.system\skill-creator\scripts\quick_validate.py skills\fr-fvs
py %USERPROFILE%\.codex\skills\.system\skill-creator\scripts\quick_validate.py skills\fr-download-sync
py %USERPROFILE%\.codex\skills\.system\skill-creator\scripts\quick_validate.py skills\fr-upload-sync
py %USERPROFILE%\.codex\skills\.system\skill-creator\scripts\quick_validate.py skills\fr-browser-review
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
- `skills/fr-workflow/`

Expected: repo root README explains where FineReport skill runtime and skill standard live
