# finereport-ai

## 项目定位

`finereport-ai` 当前定位为一个面向帆软自动化开发的单机本地工具。目标不是单纯生成某个模板文件，而是把帆软开发过程中分散的目录约定、数据探测、报表文件浏览、同步动作、预览入口和 AI 路由统一收敛到一个可浏览器访问、可重复执行的工作流中。

当前主链路已经切到 `Python + Vue` 前后端分离架构：后端以本地 `FastAPI` 服务承载业务能力，前端以 `Vue` 浏览器界面承载交互；历史 `Rust/Tauri/Java` 资产保留在仓库中作为迁移参考和底层协议素材，不再作为首版主运行时。

## 要解决的问题

当前帆软开发通常存在以下问题：

- 样式参数分散在模板、人工约定和历史经验中，缺少统一入口。
- 表头、列名、边框、字体、宽度等基础参数复用成本高。
- 运行目录、版本目录、模板目录和同步目录缺少标准化约束。
- AI 可以生成代码或脚本，但缺少稳定的项目上下文、目录规则和帆软专用操作约束。
- 生成结果往往停留在“写出来”，缺少后续打开、同步、校验和修正的闭环。

本项目的目标就是把这些上下文显式化、结构化，并将其转化为 AI 可以稳定执行的工程配置。

## 系统目标

本项目当前负责以下几类核心能力：

- 通过浏览器界面展示本地工程目录和运行配置。
- 统一提供数据源连接列表与最小 SQL 预览入口。
- 提供 `reportlets` 文件树浏览与文件内容读取能力。
- 提供同步动作的统一手动入口和结果回显。
- 提供预览地址打开能力，并保留显式会话结果。
- 提供自然语言任务路由，把请求收敛到正式业务模块。

## 界面化配置范围

桌面端至少需要支持以下配置项：

### 1. 模板基础样式

- 表头字体
- 表头字号
- 表头字体颜色
- 表头背景色
- 表头边框样式
- 表头边框粗细
- 列名字体
- 列名字号
- 列名字体颜色
- 列名背景色
- 列宽
- 单元格字体
- 单元格字号
- 单元格字体颜色
- 单元格边框样式
- 单元格边框粗细

### 2. 工程目录与版本信息

- 运行目录
- 版本管理目录
- 模板目录
- 生成产物目录
- 临时工作目录
- 目标发布目录

### 3. 文件同步配置

- 同步协议类型，如 `SFTP`、`FTP`
- 主机地址
- 端口
- 用户名
- 目标路径
- 同步方向
- 覆盖策略

### 4. AI 协作配置

- 使用的 AI 工具类型
- 项目级系统提示词
- 帆软开发专用 `skill`
- 浏览器操作 `skill`
- 项目目录映射
- 模板来源与目标路径映射

## AI 配置生成机制

本项目的关键价值不只是“保存参数”，而是将界面中录入的信息转化为 AI 可直接执行的工程配置。

生成内容应至少包括：

- 面向 `Claude Code`、`Codex` 的项目说明文件。
- 帆软开发专用 `skill` 配置。
- 浏览器自动化与页面校验相关配置。
- 本地模板目录、运行目录、版本目录和同步目录的映射关系。
- 针对当前项目的开发约束，例如命名规范、模板生成位置、同步规则和验证顺序。

这些配置生成后，AI 工具可以在已有约束下执行如下任务：

- 根据自然语言要求生成或修改帆软模板相关产物。
- 按约定目录写入模板、脚本或配置文件。
- 调用专用 `skill` 处理帆软开发流程。
- 使用浏览器操作能力完成页面校验、截图或结果确认。

## 端到端工作流

项目的目标工作流如下：

1. 用户在桌面界面中录入模板样式、目录、同步和 AI 协作配置。
2. 系统根据配置生成项目级说明文件、AI 配置和专用 `skill`。
3. 用户通过自然语言向 `Claude Code`、`Codex` 等工具发起开发任务。
4. AI 在明确的目录映射和规则约束下生成帆软模板、脚本或辅助文件。
5. 系统或 AI 调用浏览器自动化能力进行打开、检查和校验。
6. 验证通过后，将结果同步到目标目录或远程服务器。
7. 整个过程中的配置、产物和校验动作都应可追踪、可复现。

## 技术架构

### 浏览器界面层

- `Vue` 负责界面承载、状态展示和用户操作发起。
- 前端界面只通过 HTTP API 与本地后端通信，不直接操作本地文件和系统命令。

### 核心能力层

- `Python` 负责配置读取、任务编排、文件处理、同步执行和预览调度。
- 核心逻辑按 `project`、`datasource`、`reportlet`、`sync`、`preview`、`assistant` 六个模块拆分。

### 运行时依赖

当前产品方向已切换为“系统环境安装 + 启动脚本预检”：

- 工具不再内置 `Node`、`Codex`、`Python 3`
- 安装脚本和启动脚本统一检查系统 `git`、`node`、`python3`、`codex`
- 若缺失基础环境，则脚本显式失败并给出诊断结果
- 用户通过平台脚本完成依赖安装和本地启动

安装脚本：

- `scripts/install-runtime-macos.sh`
- `scripts/install-runtime-windows.cmd`
- `scripts/install-runtime-windows.ps1`

两套脚本都会先交互选择：

- 官方源
- 国内源

然后完成 `git`、`node`、`python3`、`codex` 安装，并在末尾执行版本校验。

说明：

- `macOS` 的“国内源”会切换 `Homebrew` 镜像和 `npm registry`
- `Windows` 的“国内源”会将 `winget` 源切到中科大镜像 `https://mirrors.ustc.edu.cn/winget-source`，并将 `npm registry` 切到国内源
- `Windows` 修改 `winget` 源需要管理员权限；切回“官方源”时脚本会执行 `winget source reset winget`

Windows 推荐执行方式：

- 首选：`.\scripts\install-runtime-windows.cmd`
- 备选：`powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\install-runtime-windows.ps1`

为保证 `macOS` 和 `Windows` 的实际可运行性，预检不是只看平台名，而是直接检查同步链路依赖：

- `macOS/Linux` 必须存在 `/bin/sh`，因为项目同步 hook 依赖标准 shell 执行。
- `Windows` 必须安装带 `Git Bash` 的 `Git for Windows`，预检会显式验证 hook 所需的 `sh.exe` 是否可定位。
- 只要系统 `git/node/python3/codex` 或同步 shell 缺失，启动脚本就应显式失败，不做静默降级。

### AI 协作层

- `Claude Code`、`Codex` 等工具负责基于自然语言和项目配置执行实际开发任务。
- 帆软专用 `skill` 负责将领域规则显式化，避免 AI 在无上下文下自由发挥。
- 浏览器操作能力负责最终校验，避免只生成不验证。

## 推荐目录结构

当前主链路围绕如下目录组织：

```text
.
├── README.md
├── apps/
│   ├── api/                  # FastAPI 路由入口
│   └── web/                  # Vue 浏览器界面
├── backend/
│   ├── application/          # 用例编排
│   ├── domain/               # 领域模型
│   ├── adapters/             # 外部系统适配
│   ├── infra/                # 运行基础设施
│   └── schemas/              # API 请求/响应模型
├── templates/                 # 基础模板资源
├── reportlets/               # 报表示例、模板片段、演示产物
├── generated/                # 由界面配置生成的 AI 配置与上下文文件
├── workspace/                # AI 实际工作的本地工程目录
├── scripts/                  # 安装、诊断、启动脚本
└── docs/                     # 项目设计、协议和开发文档
```

## 当前仓库状态

当前仓库已经具备可运行的 `Python + Vue` 本地主链路，并保留了迁移参考资产：

- `apps/api`：本地 API 入口
- `backend`：领域模块与用例实现
- `apps/web`：浏览器交互界面
- `scripts/install-runtime-*`、`scripts/doctor-*`、`scripts/start-*`：安装、诊断、启动脚本
- `templates/`、`reportlets/`、`docs/`：模板、样例和协议文档

当前已接通的功能模块：

- `project`：只读展示工程目录配置
- `datasource`：查看连接列表并执行最小 SQL 预览
- `reportlet`：浏览文件树并读取模板内容
- `sync`：手动执行同步动作并展示结果
- `preview`：输入 URL 打开预览并返回会话信息
- `assistant`：对自然语言任务做模块路由分析

同时仓库仍保留以下历史资源，作为迁移和协议研究参考：

- [templates/blank.cpt](/Users/wj/data/mcp/finereport/templates/blank.cpt)
- [templates/blank.fvs](/Users/wj/data/mcp/finereport/templates/blank.fvs)
- [reportlets/GettingStarted.cpt](/Users/wj/data/mcp/finereport/reportlets/GettingStarted.cpt)
- [reportlets/第一张FVS模板.fvs](/Users/wj/data/mcp/finereport/reportlets/第一张FVS模板.fvs)
- [docs/fine-remote-design-protocol.md](/Users/wj/data/mcp/finereport/docs/fine-remote-design-protocol.md)

这些文件说明仓库已经具备模板、样例和远程协议基础，可以继续作为新架构下的能力素材来源。

## 设计原则

本项目遵循以下原则：

- 配置先于生成，所有开发行为都应从显式配置出发。
- 不做静默兜底，失败必须暴露，便于定位根因。
- AI 不是脱离上下文自由生成，而是在项目约束、目录映射和专用 `skill` 下工作。
- 生成、同步和校验动作必须可复现、可追踪。
- 界面负责收敛参数，核心逻辑负责编排流程，AI 负责执行具体开发动作，职责边界必须清晰。

## 最终目标

这个项目最终要实现的是：

把帆软开发中原本依赖人工经验和手工操作的样式设定、目录约定、同步部署、AI 编码和校验过程，收敛为一个由桌面界面驱动、由配置生成上下文、由 AI 执行开发、由自动化完成校验的标准化流程。
