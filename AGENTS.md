# Repository Guidelines

## Project Structure & Module Organization

This repository currently holds planning docs and FineReport assets, not a full Tauri app yet.

- `README.md`: product scope, architecture direction, and workflow.
- `docs/superpowers/specs/`: dated design specs, e.g. `2026-03-18-codex-embedded-chat-panel/`.
- `templates/`: base `.cpt` and `.fvs` templates.
- `reportlets/`: sample reports, demos, and reference assets.
- `.claude/skills/`: repository-local skill definitions for FineReport workflows.

When application code is added, keep Rust/Tauri code under dedicated source directories instead of mixing it into `templates/` or `reportlets/`.

## Build, Test, and Development Commands

There is no committed build pipeline yet. Until the Tauri scaffold lands, use repository inspection commands:

- `git status --short`: check staged and unstaged changes.
- `git log --oneline -5`: review recent commit style.
- `rg -n "keyword" docs README.md`: search docs and specs quickly.

When Rust/Tauri code is introduced, document the canonical run/test commands in `README.md` and keep them consistent with this file.

## Coding Style & Naming Conventions

- Markdown: use clear headings, short sections, and repository-specific instructions.
- Spec directories: `docs/superpowers/specs/YYYY-MM-DD-topic/`.
- File names: use kebab-case for docs and folders; keep asset names unchanged if they mirror FineReport files.
- For future Rust code: use `rustfmt` defaults, `snake_case` for modules/functions, `PascalCase` for types, and avoid oversized files or deeply nested logic.

## Testing Guidelines

No automated test suite is committed yet. For now:

- Verify docs for path accuracy and internal consistency before commit.
- If you add executable code, add automated tests in the same change.
- Record the exact verification command in the PR or commit notes.

## Commit & Pull Request Guidelines

Follow the existing history style with conventional prefixes:

- `feat: 初始化 FineReport skill 项目`
- `docs: split codex embedding design specs`

Use focused commits. Do not bundle asset changes, design docs, and runtime code without a clear reason. PRs should include scope, affected paths, verification performed, and screenshots when UI behavior changes.

## Security & Configuration Tips

Do not commit sync credentials, API keys, or host passwords. `SFTP`/`FTP` secrets must stay in local environment or secure storage, never in tracked files.
