# FineReport Skill Standard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在当前 `finereport` 仓库内落地一套可运行的 FineReport skill 标准，包含共享 Python runtime、自然语言初始化、环境检查、Decision/bridge 调用链、skill-creator 驱动的 skill 目录重建，以及最小闭环验证。

**Architecture:** 仓库按三层实现：`skills/*` 负责触发与流程约束，`tooling/fr_runtime/*` 负责共享 Python 运行时，`bridge/dist/*` 负责预编译 Java bridge 产物。目录/文件操作走 bridge，数据连接与 SQL 试跑走 Decision HTTP API，所有命令入口统一由 Python CLI 暴露。

**Tech Stack:** Python 3.11+, pytest, urllib/http client, FineReport Decision HTTP API, FineReport Designer bundled Java, Anthropic `skill-creator`, repo-local markdown/templates

---

## Plan Index

1. [01-runtime-and-init.md](./01-runtime-and-init.md)
2. [02-bridge-and-services.md](./02-bridge-and-services.md)
3. [03-skills-and-verification.md](./03-skills-and-verification.md)

## Scope Check

本计划覆盖的是一个完整但单一的子项目：FineReport skill 标准化落地。虽然涉及 runtime、bridge、skill 和验证四块内容，但它们共用一套配置模型和执行入口，适合作为同一个实施计划执行，不再继续拆成多个独立计划。

## File Structure Lock-In

实施期间固定按以下路径组织文件：

- Create: `pyproject.toml`
- Create: `tooling/fr_runtime/__init__.py`
- Create: `tooling/fr_runtime/cli.py`
- Create: `tooling/fr_runtime/config/{__init__.py,models.py,io.py}`
- Create: `tooling/fr_runtime/init/{__init__.py,service.py}`
- Create: `tooling/fr_runtime/doctor/{__init__.py,checks.py,report.py}`
- Create: `tooling/fr_runtime/remote/{__init__.py,http.py}`
- Create: `tooling/fr_runtime/bridge/{__init__.py,java_runtime.py,runner.py}`
- Create: `tooling/fr_runtime/datasource/{__init__.py,service.py}`
- Create: `tooling/fr_runtime/sync/{__init__.py,service.py}`
- Create: `tooling/fr_runtime/preview/{__init__.py,service.py}`
- Create: `tests/fr_runtime/*.py`
- Modify/Create: `skills/*`
- Create: `skills/*/agents/openai.yaml`
- Create: `skills/*/scripts/run.py`
- Create: `skills/*/references/*.md`
- Create: `skills/*/assets/template/*`
- Create: `bridge/dist/manifest.json`
- Create: `bridge/dist/checksums.txt`
- Modify: `README.md`

## Execution Order

1. 先完成 runtime 骨架与配置契约。
2. 再完成初始化与环境检查。
3. 再接 bridge、Decision HTTP、数据探测和同步服务。
4. 最后用 `skill-creator` 重建或标准化所有 FineReport skill，并跑完整体验证。
