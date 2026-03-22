---
name: fr-create
description: 创建新的 FineReport 模板（CPT 普通报表 或 FVS 决策报表）。从空白模板复制初始化，可选配置数据源和基本布局。
---

# FineReport 模板创建

根据用户需求创建新的 FineReport 模板文件。

## 格式选择指南

| 需求 | 格式 | 说明 |
|------|------|------|
| 普通数据报表、交叉报表、分组报表 | CPT | 基于单元格的报表，适合表格数据展示 |
| 填报表单 | CPT | 支持数据录入、编辑、提交 |
| 数据大屏、仪表盘、可视化看板 | FVS | 自由布局，支持图表/表格/图片等模块组合 |
| 多页面数据展示 | FVS | 支持多页面（story），可轮播切换 |

## 创建流程

### 步骤 1：确认模板类型

根据用户描述判断需要 CPT 还是 FVS。不确定时询问用户。

### 步骤 2：先执行远端创建预检

在项目目录先执行：

```bash
./.codex/project-sync.sh prepare-create reportlets/<名称>.cpt
./.codex/project-sync.sh prepare-create reportlets/<名称>.fvs
```

这个步骤会负责：

- 先读取远端目录，发现同名直接失败
- 在线上先创建同名占位文件，避免开发过程中被别人抢占同名
- 若宿主明确报错，必须立即停止，不能跳过

### 步骤 3：从空白模板复制

空白模板位于本 skill 的 `assets/` 目录：

```bash
# CPT
cp ./.codex/skills/fr-create/assets/blank.cpt ./reportlets/<名称>.cpt

# FVS
cp ./.codex/skills/fr-create/assets/blank.fvs ./reportlets/<名称>.fvs
```

### 步骤 4：配置数据源（如果用户提供了数据库信息）

**CPT 数据源**（插入到 `<TableDataMap>` 内）：
```xml
<TableData name="ds1" class="com.fr.data.impl.DBTableData">
<Parameters/>
<Attributes maxMemRowCount="-1"/>
<Connection class="com.fr.data.impl.NameDatabaseConnection">
<DatabaseName><![CDATA[数据库连接名]]></DatabaseName>
</Connection>
<Query><![CDATA[SELECT * FROM 表名]]></Query>
<PageQuery><![CDATA[]]></PageQuery>
</TableData>
```

**带参数的数据源**：在 `<Parameters>` 内添加 `<Parameter>` 节点，SQL 中使用 `'${参数名}'` 引用。

**FVS 数据源**：格式同上，额外在 `<TableData>` 内首行添加 `<Desensitizations desensitizeOpen="false"/>`。

### 步骤 5：初始化基本内容

- **CPT** — 根据用户需求设置表头和数据列（操作 `<CellElementList>`）
- **FVS** — 需解压 ZIP 修改后重新打包：
  ```bash
  WORK_DIR="/tmp/fvs_work_$(date +%s)"
  mkdir -p "$WORK_DIR"
  cp <原始路径>.fvs "$WORK_DIR/template.zip"
  cd "$WORK_DIR" && unzip -o template.zip -d content
  # 修改 content/editor.tpl
  cd "$WORK_DIR/content" && zip -r "$WORK_DIR/output.fvs" .
  cp "$WORK_DIR/output.fvs" <目标路径>.fvs
  ```

### 步骤 6：提交并等待宿主同步、自动复核

- 在项目目录执行 `git add`、`git commit`
- 由宿主完成提交后同步
- 同步完成后直接进入浏览器复核，不需要再次等待用户确认
- 进入预览页后如果存在查询按钮、参数面板或其他查询触发条件，必须先执行查询，并确认页面出现实际数据结果，再检查列名、数据和样式

## 单位换算参考

- 1mm = 36000 EMU, 1pt = 12700 EMU
- 默认行高：723900 EMU (~20mm), 默认列宽：2743200 EMU (~76mm)

## 注意事项

- 文件名支持中文
- FVS 模板修改后必须重新打包为 ZIP
- 数据库连接名必须是 FineReport 服务器中已配置的连接名称
