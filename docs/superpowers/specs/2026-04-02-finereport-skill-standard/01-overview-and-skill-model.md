# 01. 总览与 Skill 模型

## 背景

当前仓库只保留了 FineReport 远程链路文档、样例报表和一组说明型 skill：

- `skills/` 缺少统一的创建标准、共享 runtime 和可执行脚本骨架。
- 多数 skill 仍停留在“告诉 agent 应该做什么”，没有把初始化、环境检查、同步、桥接和验证做成可复用资产。
- 现有命令示例仍包含 `.sh` 入口，不符合 Windows 无 `bash`/`sh.exe` 的约束。
- Java bridge 的历史实现已被清空，但桥接策略、设计器 Java 依赖和远端 HTTP/JVM 分层已经在文档中取证完成。

本次设计目标不是新增一批说明文档，而是沉淀一套可持续扩展的 FineReport skill 标准，后续新增 `fr-create`、`fr-cpt`、`fr-fvs` 或更多报表类 skill 时都要沿用它。

## 目标

1. 以 `obra/superpowers` 的“skills 为入口、共享实现沉底”的模式组织 FineReport skill。
2. 创建 FineReport skill 时统一遵循 `anthropics/skills` 的 `skill-creator` 工作流，不再手写 skill 骨架。
3. 提供自然语言对话式项目初始化，并在初始化过程中显式校验输入。
4. 提供系统环境和远端状态检查能力，确认配置、设计器运行时、bridge 和 Decision 服务都真实可用。
5. 通过共享 runtime 统一接入 FineReport 设计器远端能力，覆盖目录、文件同步、数据连接和 SQL 试跑。
6. Java bridge 以预编译产物分发，运行时只使用 FineReport 设计器自带 Java。
7. 全链路兼容 macOS 和 Windows，命令入口不依赖 `bash` 或 `sh.exe`。

## 非目标

- 不把 FineReport 私有 `remote/design/channel` 协议改写成纯 Python。
- 不继续保留 shell-first 的 helper 体系；如需 `.cmd`，只允许做轻量转发。
- 不在 skill 目录内增加 `README.md`、`CHANGELOG.md` 等用户文档型文件。
- 不把 `fr-template-write` 继续扩展成混合 skill。

## 仓库结构

```text
skills/
  fr-workflow/
    SKILL.md
    agents/openai.yaml
    scripts/
    references/
    assets/template/
  fr-init/
  fr-status-check/
  fr-db/
  fr-create/
  fr-cpt/
  fr-fvs/
  fr-download-sync/
  fr-upload-sync/
  fr-browser-review/

tooling/fr_runtime/
  cli.py
  config/
  doctor/
  remote/
  datasource/
  sync/
  bridge/

bridge/
  dist/
    fr-remote-bridge.jar
    manifest.json
    checksums.txt
```

## 分层职责

- `skills/*`
  定义触发条件、执行入口、失败处理、证据要求和下一步流转。
- `skills/*/scripts`
  仅保留该 skill 的薄入口脚本，真正逻辑统一调用 `tooling/fr_runtime/cli.py`。
- `skills/*/references`
  存放该 skill 需要按需读取的协议、字段、样例或流程参考。
- `skills/*/assets/template`
  存放该 skill 真正会复用的模板资产。
- `tooling/fr_runtime`
  共享配置解析、环境检查、远端调用、数据探测、同步和 bridge 调度。
- `bridge/dist`
  预编译 bridge 产物及其元数据，供 runtime 直接调用。

## Skill 创建标准

### 一律使用 `skill-creator`

所有新建或重建的 FineReport skill 都必须通过 `anthropics/skills` 的 `skill-creator` 流程创建：

1. 使用 `init_skill.py` 初始化 skill 目录。
2. 指定 `--resources scripts,references,assets`。
3. 生成并保留 `agents/openai.yaml`。
4. 完成 `SKILL.md`、`scripts/`、`references/`、`assets/template/` 内容。
5. 运行 `quick_validate.py` 校验 skill 目录。

示例命令：

```bash
python3 scripts/init_skill.py fr-init \
  --path /Users/wj/data/mcp/finereport/skills \
  --resources scripts,references,assets
```

### Skill 内容约束

每个 FineReport skill 的 `SKILL.md` 至少包含：

- `Overview`
- `Inputs`
- `Execution`
- `Expected Evidence`
- `Failure Handling`
- `Next Skill`

补充规则：

- `description` 负责“何时触发”和“解决什么问题”，不把大段实现细节塞进 frontmatter。
- 详细协议、字段映射、平台差异和示例输出放到 `references/`。
- 模板、空白 `.cpt`/`.fvs`、数据集片段、输出样例放到 `assets/template/`。
- 任何共享实现都不得复制进多个 skill；skill 脚本只负责参数收敛和 runtime 调用。

## Skill 体系重排

### 保留并增强

- `fr-workflow`
  FineReport 任务路由器，负责把任务导向 `fr-init`、`fr-status-check`、`fr-db`、`fr-create`、`fr-cpt`、`fr-fvs`、`fr-download-sync`、`fr-upload-sync`、`fr-browser-review`。
- `fr-status-check`
  升级为真正的 `doctor + remote probe`。
- `fr-db`
  负责连接列表、字段扫描、SQL 试跑和数据集 XML 片段生成。
- `fr-download-sync` / `fr-upload-sync`
  负责远端文件同步和同步后校验。
- `fr-browser-review`
  负责浏览器预览、查询、样式和结果复核。

### 新增

- `fr-init`
  负责自然语言初始化、字段校验、配置落盘和初始化会话恢复。
- `fr-create`
  负责新建前预检、同名冲突检查、模板选型和初始化目标文件。
- `fr-cpt`
  负责 `.cpt` 的数据集、参数、布局和样式修改。
- `fr-fvs`
  负责 `.fvs` 的目录、聚合和视图级修改。

### 废弃

- `fr-template-write`
  现有职责被 `fr-create`、`fr-cpt`、`fr-fvs` 分拆，后续不再作为正式 skill 保留。

## 与 Superpowers 的关系

FineReport skill 不替代 `superpowers`，而是建立在其过程 skill 之上：

- 新能力设计：先走 `brainstorming`
- 多步实施：走 `executing-plans`
- 排障：走 `systematic-debugging`
- 完成前验证：走 `verification-before-completion`

`fr-workflow` 的职责是“FineReport 任务路由 + superpowers 过程约束”，不是新的通用流程框架。

## 实施阶段

### 阶段 1：共享 runtime 骨架

建立 `tooling/fr_runtime`、统一 CLI、跨平台路径处理和配置读写。

### 阶段 2：初始化与环境检查

完成 `fr-init`、`fr-status-check`、配置模板和 schema 校验。

### 阶段 3：Bridge 运行链

接入 `bridge/dist`、Designer Java 定位、list/read/write/delete 调度。

### 阶段 4：数据探测与同步

完成 `fr-db`、`fr-download-sync`、`fr-upload-sync`。

### 阶段 5：模板编辑 skill 拆分

引入 `fr-create`、`fr-cpt`、`fr-fvs`，替换 `fr-template-write`。

### 阶段 6：浏览器复核与文档收口

完成 `fr-browser-review`、README、示例和最终验证文档。
