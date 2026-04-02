# 02. 初始化、Runtime 与验证

## 初始化协议

### 初始化产物

初始化完成后统一生成：

```text
.codex/
  project-context.md
  project-rules.md
  workflow-overview.md
  fr-config.json
  fr-config.schema.json
  fr-init-session.json
```

### 必填字段

`fr-init` 按对话方式逐项确认以下字段：

1. 项目名称
2. FineReport Designer 根目录
3. Decision 服务地址
4. 用户名
5. 密码
6. 默认工作目录
7. 默认远端根路径
8. 当前主要任务类型

推荐任务类型值：

- `新建报表`
- `修改现有报表`
- `数据探测`
- `同步发布`

### 校验规则

- 用户可以自然语言输入，不要求手写 JSON。
- runtime 先提取结构化字段，再回显确认块。
- 每个字段都要输出 `通过`、`失败` 或 `待补充`。
- 任一关键字段失败时，必须明确失败原因，并且只重问失败字段。
- 不允许自动猜测 `designer_root`、`reportlets_root`、连接名、服务器版本或任务路径。

## 环境检查协议

`fr-status-check` 至少覆盖以下检查项：

1. Python 是否可用。
2. 当前操作系统类型是否已识别。
3. `.codex/fr-config.json` 是否存在且字段完整。
4. Designer 根目录是否存在。
5. 设计器自带 Java 是否存在。
6. `webapps/webroot/WEB-INF/lib` 和 `lib` 是否存在必要 jar。
7. `bridge/dist/fr-remote-bridge.jar` 是否存在且 checksum 正确。
8. Decision 登录是否成功。
9. `/v10/config/connection/list/0` 是否可访问。
10. 远端 `reportlets` 根目录 list 是否成功。
11. 本地 `reportlets/` 是否可写。
12. 若目标是同步，远端目标文件是否存在、是否被锁定。

所有输出必须带证据，而不是只返回布尔值。

## 远端与 Bridge 设计

### 调用分层

- 目录、文件读取、文件写回
  走 `Python runtime -> bridge jar -> FineReport Designer 运行时`。
- 数据连接列表、数据集列表、SQL 试跑
  走 `Python runtime -> Decision HTTP API`。

这两条链路不能混用。

### Bridge 分发

`bridge/dist` 必须提供：

- `fr-remote-bridge.jar`
- `manifest.json`
- `checksums.txt`

`manifest.json` 至少记录：

- bridge 名称
- 版本号
- 主类
- 支持操作
- 兼容 FineReport 大版本
- 是否要求 Designer Java

### 运行规则

- 运行 bridge 时优先并且只使用 FineReport Designer 自带 Java。
- 不读取系统 `JAVA_HOME`，不回退到系统 Java。
- Designer Java 缺失时直接报错中止。
- classpath 必须使用平台对应的分隔符，不能写死为 `:`。
- bridge 只负责远端桥接，不承担项目配置解析和业务路由。

## 跨平台规则

- 主执行入口统一为 Python。
- macOS / Linux 示例命令使用 `python3`。
- Windows 示例命令使用 `py` 或 `python`。
- 如需 `.cmd`，仅允许做轻量转发，不承载核心逻辑。
- 不再把 `.sh` 当作唯一主入口。

## 脚本与模板放置规则

每个 skill 目录内只保留对 agent 有效的资源：

- `scripts/`
  放该 skill 的薄入口脚本，内部调用 `tooling/fr_runtime/cli.py`。
- `references/`
  放协议、字段、示例输出、远端接口说明等按需读取材料。
- `assets/template/`
  放该 skill 真正复用的模板资产。

模板放置原则：

- `fr-init/assets/template`
  放 `project-context.md`、`project-rules.md`、`workflow-overview.md` 模板。
- `fr-create/assets/template`
  放空白 `.cpt` / `.fvs` 或新建骨架模板。
- `fr-cpt/assets/template`
  放数据集 XML、参数块、表头块等 CPT 片段模板。
- `fr-fvs/assets/template`
  放 FVS 片段模板。
- `fr-db/assets/template`
  放 SQL 输出和数据集 XML 输出模板。

`fr-status-check`、`fr-download-sync`、`fr-upload-sync`、`fr-browser-review` 可以只放输出样例，不强塞报表模板。

## 验证闭环

首版标准必须至少通过四层验证：

1. 结构验证
   检查每个 skill 是否都具备 `SKILL.md`、`agents/openai.yaml`、`scripts/`、`references/`、`assets/template/`。
2. Skill 校验
   运行 `quick_validate.py`，确认命名、frontmatter 和目录结构合法。
3. 运行验证
   通过 `fr-init` 和 `fr-status-check` 验证配置、Designer Java、bridge、Decision 登录和远端目录。
4. 真实链路验证
   走通 `init -> doctor -> db -> pull -> modify -> push -> preview` 最小闭环。

验收标准固定为：

- macOS 可跑通。
- Windows 入口不依赖 `bash` 或 `sh.exe`。
- 无系统 Java 时仍能使用 Designer 自带 Java 跑 bridge。
- 初始化字段错误时会显式要求重填。
- 同步后有回读或远端校验证据。
- 仓库中不再把 `fr-template-write` 当正式 skill 继续扩展。

## 风险与约束

- Decision HTTP 接口受 FineReport 版本影响，失败时必须透出原始错误。
- bridge 预编译产物必须与目标 FineReport 大版本兼容；不兼容时要尽早在 `fr-status-check` 暴露。
- `skill-creator` 只负责创建和校验 skill 骨架，不替代 FineReport 运行时实现。
- 初始化与环境检查涉及真实凭据，但凭据只能写入项目本地配置，不能进入 tracked 文件。
