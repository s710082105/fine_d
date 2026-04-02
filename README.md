# finereport-ai

当前仓库已清空历史实现代码，为下一轮重构准备，只保留文档、参考资产和 Codex skill 说明。

## 当前保留内容

- `docs/`：设计文档和实现归档
- `skills/`：FineReport Codex skill 说明文件与模板资产
- `templates/`：基础 `.cpt` / `.fvs` 模板
- `reportlets/`：样例报表与历史参考产物
- `AGENTS.md`：仓库协作约束

## 首先查看

- `docs/fine-remote-implementation-guide.md`
- `docs/fine-remote-design-protocol.md`
- `docs/superpowers/specs/2026-04-02-finereport-skill-standard/`
- `docs/superpowers/plans/2026-04-02-finereport-skill-standard/`
- `skills/fr-workflow/`

## 说明

- 历史 `Python + Vue + Tauri + Java bridge` 实现已从仓库中移除
- 当前仓库已补入 Python 版 FineReport skill runtime 骨架，入口为 `python3 -m tooling.fr_runtime.cli`
- 运行时、skill 标准和 bridge 分发规则以 `docs/superpowers/specs/2026-04-02-finereport-skill-standard/` 为准
- 下一次继续扩展实现时，应以 `docs/` 中沉淀的接口、链路、skill 标准和实现计划为参考
