# 软件内置 Agent 与 Skill 装载

## 目标

软件维护一套标准规则资产，会话创建时按项目配置实例化，不把 `AGENTS.md` 与 `skills` 常驻写入真实项目根目录。

## 资产分类

软件内置规则资产分三类：

1. `base agent`
2. `domain skills`
3. `project overlays`

其中：

- `base agent` 负责全局规则。
- `domain skills` 负责 FineReport 模板生成、浏览器校验和同步发布。
- `project overlays` 由会话创建时动态生成，不手工维护。

## 存储原则

- `embedded/` 下的 agent 和 skill 模板保持只读。
- `session/context/` 中保存本次会话的实例化副本。
- 只在创建会话时生成副本，不在软件启动时全量铺开。

## 装载顺序

`context_builder` 创建会话时按以下顺序装载：

1. 复制软件内置 `base agent`
2. 复制启用的 `skills`
3. 生成 `project-context.md`
4. 生成 `project-rules.md`
5. 生成 `mappings.json`
6. 写入 `session-manifest.json`

## 版本管理

建议维护 `embedded/manifest.json`，记录：

- `agentVersion`
- 各 `skill` 的版本号

创建会话时把该信息写入 `session-manifest.json`，建议结构如下：

```json
{
  "sessionId": "string",
  "projectId": "string",
  "configVersion": "string",
  "embeddedAgentVersion": "0.1.0",
  "enabledSkills": ["finereport-template", "browser-validate"],
  "createdAt": "2026-03-18T00:00:00Z"
}
```

## 边界约束

- 真实项目目录只提供业务文件和用户选择的工作目录。
- 软件内置目录只保存规则模板。
- 会话目录保存实例化后的规则、上下文和版本快照。
- 如果某些工具必须在项目根查找 `AGENTS.md`，也应优先使用运行时副本或临时映射，不把其变成项目常驻结构。
