# Codex Runtime Review Config Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add preview credentials and Codex API key/base URL handling, require post-sync browser review, and keep terminal output colored.

**Architecture:** Extend `ProjectConfig` once, flow the new fields through form rendering, Rust persistence, runtime context templates, and both Codex launch paths. Use explicit runtime instructions rather than silent automation for browser review.

**Tech Stack:** React, TypeScript, Vitest, Tauri v2, Rust, cargo test

---

### Task 1: Extend Config Models

- [ ] Add `preview.account/password` and `ai.base_url/api_key` to TypeScript and Rust config models.
- [ ] Update defaults and validation.
- [ ] Add/refresh roundtrip tests.

### Task 2: Update Runtime Context and Review Rules

- [ ] Add the new fields to `project-context.md.hbs`, `project-rules.md.hbs`, and `mappings.json.hbs`.
- [ ] Update embedded `AGENTS.md` to require `chrome-cdp` review after sync completes.
- [ ] Verify with `context_builder_generates_sync_rules`.

### Task 3: Wire Codex Launch Settings

- [ ] Inject `--color always` and `-c openai_base_url="..."` into terminal and session launch arguments.
- [ ] Inject `-c forced_login_method="api"` plus isolated `CODEX_HOME/auth.json` into spawned Codex processes, and preserve shared config/skills via mirrored entries.
- [ ] Inject terminal color env vars into spawned processes.
- [ ] Verify with terminal/session unit tests and full test suites.
