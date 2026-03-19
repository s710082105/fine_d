# Project Root AGENTS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move project-initialized `AGENTS.md` from `.codex/AGENTS.md` to the project root while keeping other runtime context files under `.codex/`.

**Architecture:** Keep the existing context builder behavior unchanged for session contexts. Restrict the path migration to project initialization by generating `.codex/AGENTS.md` first, then relocating that single file to `<project>/AGENTS.md` and updating the tests that read the project-level agent file.

**Tech Stack:** Rust, existing project initializer tests, Cargo test

---

### Task 1: Update project initializer tests first

**Files:**
- Modify: `src-tauri/tests/project_initializer_local.rs`
- Modify: `src-tauri/tests/project_git_sync.rs`
- Modify: `src-tauri/tests/project_initializer_real_path.rs`

- [ ] **Step 1: Change assertions to expect `<project>/AGENTS.md`**
- [ ] **Step 2: Run targeted Cargo tests to verify they fail**

### Task 2: Move only project-level AGENTS.md to the root

**Files:**
- Modify: `src-tauri/src/domain/project_initializer.rs`

- [ ] **Step 1: After building `.codex/`, move `AGENTS.md` to `<project>/AGENTS.md`**
- [ ] **Step 2: Keep `.codex/project-context.md`, `.codex/project-rules.md`, `.codex/mappings.json`, `.codex/skills/` unchanged**
- [ ] **Step 3: Re-run targeted tests and confirm they pass**

### Task 3: Full verification

**Files:**
- Verify only

- [ ] **Step 1: Run `cargo test --manifest-path src-tauri/Cargo.toml`**
- [ ] **Step 2: Report exact verification status**
