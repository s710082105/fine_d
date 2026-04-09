# Repository Guidelines

## Project Structure & Module Organization

This repository is a FineReport skill runtime workspace.

- `README.md`: current usage and structure overview.
- `.codex/skills/`: repository-local skills discovered by Codex.
- `tooling/fr_runtime/`: Python runtime shared by all FineReport skills.
- `bridge/dist/`: packaged Java bridge artifacts only.
- `reportlets/`: sample and reference FineReport assets.
- `tests/fr_runtime/`: automated runtime regression tests.
- `docs/`: archived design notes and protocol analysis.

Do not reintroduce root-level `skills/` mirrors, duplicate template directories, or bridge source trees unless the user explicitly requests them.

## Build, Test, and Development Commands

Use repository-root commands only:

- `python3 -m tooling.fr_runtime.cli --help`
- `pytest tests/fr_runtime -q`
- `uv run --no-project --with pyyaml python .codex/skills/skill-creator/scripts/quick_validate.py .codex/skills/<skill-name>`

Record the exact verification commands you ran before claiming completion.

## FineReport Workflow

- 涉及数据集、SQL、报表字段时，先读取设计器远端已有连接并完成字段扫描。
- `reportlets/` 相关改动必须同步到远端，不能停在“本地已修改”。
- 浏览器复核固定通过 `.codex/skills/fr-browser-review/` 执行。
- `.cpt` 预览地址使用 `view/report?viewlet=...`。
- `.fvs` 预览地址使用 `view/duchamp?page_number=1&viewlet=...`。
- 如果 bridge 明确返回 `试用过期，请获取正式版`，必须原样反馈这句消息给用户，并立即停止后续排查、同步、上传、预览或其他 bridge 相关操作。
- 如果 bridge 明确返回授权提醒，例如包含 `请联系管理员授权` 的消息，必须把 bridge 返回的原始提醒消息直接反馈给用户，并立即停止后续排查、同步、上传、预览或其他 bridge 相关操作。

## Coding Style & Naming Conventions

- 保持 Python 代码小函数、低嵌套、显式错误暴露。
- 运行时入口统一走 `tooling/fr_runtime/cli.py`，不要在 skill wrapper 里复制业务逻辑。
- 新增 skill 资源优先放在对应 `.codex/skills/<skill>/assets|references|scripts/` 下。

## Testing Guidelines

- 修改运行时或 wrapper 时，补充或更新 `tests/fr_runtime/` 回归测试。
- 修改 skill 文档后，至少运行对应 `quick_validate.py` 校验。
- 不要跳过失败现场复现；先复现，再修复。

## Commit & Pull Request Guidelines

- 使用聚焦提交，遵循现有 Conventional Commits 风格。
- 不要把无关重构、历史归档和功能修复混成一条提交。

## Security & Configuration Tips

- 不要提交设计器账号、密码、Decision 地址以外的敏感信息。
- `bridge/dist/` 之外不要提交新的 Java 构建输出。

## Subagent Model Requirement

All subagents used for this repository must run on GPT-5.3 or newer models. Do not dispatch subagents on GPT-5.1, mini variants below 5.3, or older model families.

## Superpowers 本地覆写
- 轻量任务不进入完整 brainstorming / writing-plans / using-git-worktrees / subagentdriven-development 链路。
- 轻量任务定义：单文件或小范围修改、明确 bug 修复、配置调整、文案修改、小测试补充。
- 轻量任务默认直接分析代码并实现；只有遇到关键不确定性时才提问，且首次最多问 1 个问题。
- 如果项目上下文、AGENTS.md、现有代码已经能回答的问题，不要重复提问。
- 非我明确要求时，不要默认创建 worktree。
- 非我明确要求时，不要默认把 spec / plan 提交到 git。
- 在 Codex 环境中，默认优先使用 executing-plans，而不是 subagent-driven-development。
- 只有在任务明确适合并行、且平台对子代理支持良好时，才使用 subagent-driven-development。
- 需要确认时，优先一次性给出 2 到 3 个可选方案和推荐，不要把确认拆成过多轮。
- 以下操作仍然必须确认：删除文件、大规模重构、修改 git 历史、推送远程、改环境配置、改 CI、数据
库变更。