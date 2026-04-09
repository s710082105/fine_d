# Workflow Examples

本文件给 `fr-workflow` 提供路由索引，不在 `SKILL.md` 展开所有分支。

## Example Map

- `references/routing.md`
  - 何时看：只需要快速判断下一步 skill
  - 重点：任务类型到 skill 的一行映射
- `../fr-init/EXAMPLES.md`
  - 何时看：缺 `.codex/fr-config.json`，或者配置明显失效
  - 重点：初始化字段和 init 交接
- `../fr-status-check/EXAMPLES.md`
  - 何时看：环境、bridge、Decision、remote 状态未知
  - 重点：doctor checklist 和后续分流
- `../fr-cpt/examples/README.md`
  - 何时看：请求已经落到 `.cpt` 编辑
  - 重点：CPT XML 示例入口
- `../fr-fvs/examples/README.md`
  - 何时看：请求已经落到 `.fvs` 编辑，或者需要先判断图表类型
  - 重点：FVS 结构入口和 chart cookbook
- `../fr-browser-review/EXAMPLES.md`
  - 何时看：已经上传同步，下一步是浏览器复核
  - 重点：固定复核流程和证据模板

## Usage

- 先看 `routing.md` 做粗分流
- 再打开目标 active skill 的示例入口
- `fr-workflow` 只负责选路，不负责展开下游 skill 的细节
