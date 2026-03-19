# Codex Runtime Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove user-controlled Codex base URL, fix terminal layering and colors, and make Codex startup work on Windows.

**Architecture:** Strip `base_url` out of project config entirely and inject the fixed Codex base URL from a runtime constant. Split the work into config contract cleanup, terminal UI/theme updates, and cross-platform auth/runtime adjustments so each behavior is covered by dedicated tests.

**Tech Stack:** React, TypeScript, Vitest, Tauri v2, Rust, cargo test, Vite

---

### Task 1: Remove `base_url` From Config Contract

**Files:**
- Modify: `src/lib/types/project-config.ts`
- Modify: `src/components/config/project-config-fields.tsx`
- Modify: `src/components/config/project-config-state.ts`
- Modify: `src/test/project-config-form.test.tsx`
- Modify: `src-tauri/src/domain/project_config.rs`
- Modify: `src-tauri/tests/project_config_roundtrip.rs`

- [ ] Write failing tests that no longer expect `Codex Base URL` in the form or config payload.
- [ ] Run the targeted Vitest/Rust tests and confirm the old `base_url` contract still fails.
- [ ] Remove the `base_url` field from TypeScript and Rust config models, defaults, validation, and UI.
- [ ] Add legacy-load coverage proving stale `ai.base_url` values in `project-config.json` are ignored.
- [ ] Re-run the targeted tests and confirm they pass.

### Task 2: Fix Codex Runtime Injection

**Files:**
- Modify: `src-tauri/src/domain/codex_auth.rs`
- Modify: `src-tauri/src/commands/session.rs`
- Modify: `src-tauri/src/commands/session_control.rs`
- Modify: `src-tauri/src/commands/terminal.rs`
- Modify: `src-tauri/src/commands/terminal/tests.rs`

- [ ] Write failing Rust tests for fixed base URL injection and cross-platform auth home creation.
- [ ] Run the targeted cargo tests and confirm the current implementation fails them.
- [ ] Replace config-driven base URL injection with a runtime constant.
- [ ] Replace Unix-only Codex home mirroring with cross-platform copy logic plus `HOME`/`USERPROFILE` fallback.
- [ ] Re-run the targeted cargo tests and confirm they pass.

### Task 3: Improve Terminal Visuals And ANSI Colors

**Files:**
- Modify: `src/components/terminal/xterm-adapter.ts`
- Modify: `src/styles/app.css`
- Modify: `src/styles/terminal.css`
- Modify: `src/test/terminal-panel.test.tsx`

- [ ] Write/extend frontend tests for the terminal panel shell and request-building behavior.
- [ ] Update xterm options to use a complete ANSI palette and Windows `windowsPty` compatibility settings.
- [ ] Update terminal shell/card styling so the right-side background remains visible outside the viewport.
- [ ] Re-run the related Vitest suite and confirm the terminal UI contract still passes.

### Task 4: Full Verification

**Files:**
- Modify: `docs/superpowers/specs/2026-03-19-codex-runtime-hardening.md`
- Modify: `docs/superpowers/plans/2026-03-19-codex-runtime-hardening.md`

- [ ] Run `cargo test --manifest-path src-tauri/Cargo.toml`.
- [ ] Run `pnpm test`.
- [ ] Run `pnpm build`.
- [ ] Review the diff to confirm no user-editable `base_url` path remains.
