# FineReport Skill 标准设计

## 文档索引

1. [01-overview-and-skill-model.md](./01-overview-and-skill-model.md)
2. [02-init-runtime-and-validation.md](./02-init-runtime-and-validation.md)

## 设计结论

本轮设计把 FineReport skill 体系收敛为三层：

- `.codex/skills/*` 负责项目级可直接发现的 skill，包括 FineReport 业务 skill 与 vendored 依赖。
- `.codex/skills/chrome-devtools/` 负责仓库内置浏览器操作 skill，统一包装官方 Chrome DevTools MCP 用法。
- `skills/*` 负责触发条件、执行入口、失败处理、证据要求和流转。
- `tooling/fr_runtime/*` 负责共享实现，包括配置、环境检查、远端访问、同步和 bridge 调度。
- `bridge/dist/*` 负责预编译 bridge 产物，运行时只使用 FineReport Designer 自带 Java。

## 固定约束

- 组织方式参考 `obra/superpowers` 的“skills 为入口、共享实现沉底”模式。
- `obra/superpowers` 以 vendored 形式落在仓库 `.codex/skills/superpowers/`，不得再要求系统级安装。
- 新建或重建 FineReport skill 时，一律使用仓库内置的 `.codex/skills/skill-creator/`，来源为 `anthropics/skills` 的 `skill-creator`。
- 初始化必须支持自然语言对话，且字段错误时显式要求重填。
- 主执行入口不能依赖 `bash` 或 `sh.exe`。
- bridge 运行不依赖系统 Java。

## 范围边界

本轮覆盖：

- skill 目录标准
- 初始化协议
- 环境检查协议
- 共享 runtime 边界
- bridge 分发与运行规则
- 验证闭环和实施阶段

本轮不覆盖：

- 纯 Python 重写 FineReport 私有远程设计协议
- 继续扩展 `fr-template-write`
- 系统 Java 回退链路
