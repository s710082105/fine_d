---
name: fr-db
description: 使用 FineReport 设计器远端能力读取已有数据连接、做字段扫描和 SQL 试跑，并生成适用于模板的数据集 SQL。
---

# FineReport 设计器远端数据探测与 SQL 生成

通过 FineReport 设计器远端能力读取已有数据连接、扫描字段，并生成适用于模板的数据集 SQL。

## 工作流程

### 步骤 1：先判断系统并选择 helper

优先使用项目目录下的 helper，不要直接假设 `bash`/`sh` 可用：

```bash
# macOS / Linux
./.codex/fr-data.sh list-connections
./.codex/fr-data.sh list-datasets
./.codex/fr-data.sh preview-dataset <数据集名称>
./.codex/fr-data.sh preview-sql <连接名称> "<SQL>"

# Windows
.\.codex\fr-data.cmd list-connections
.\.codex\fr-data.cmd list-datasets
.\.codex\fr-data.cmd preview-dataset <数据集名称>
.\.codex\fr-data.cmd preview-sql <连接名称> "<SQL>"
```

### 步骤 2：读取设计器远端已有连接

- 先执行 `list-connections`
- 连接名直接以设计器远端返回结果为准
- 不再从 `project-config.json` 读取或维护本地数据库连接

### 步骤 3：先做字段扫描

字段扫描优先级：

1. 如果已有可复用数据集，执行 `list-datasets` 后再用 `preview-dataset <数据集名称>`
2. 如果需要新 SQL，执行 `preview-sql <连接名称> "<SQL>"`
3. 参考其他模板的数据使用方式只作为样式/命名参考，最终字段以设计器远端返回结果为准

### 步骤 4：根据字段结果生成 SQL

生成 SQL 前必须先根据 `preview-dataset` 或 `preview-sql` 的列名、类型、样例值确认：

- 真实字段名
- 是否需要参数
- 哪些字段需要格式化、状态翻译、金额换算

再根据用户需求生成 SQL。

**FineReport 参数语法**：

| 场景 | 语法 | 示例 |
|------|------|------|
| 普通参数 | `${参数名}` | `WHERE region = '${region}'` |
| 多值参数 | `IN (${参数名})` | `WHERE category IN (${category})` |
| 动态条件 | `${if(...)}` | `${if(len(dept) > 0, "AND dept = '" + dept + "'", "")}` |

### 步骤 5：输出数据源配置 XML

生成可直接插入 CPT/FVS 模板的 `<TableData>` XML 片段：

```xml
<TableData name="数据集名称" class="com.fr.data.impl.DBTableData">
<Desensitizations desensitizeOpen="false"/>
<Parameters>
<Parameter>
<Attributes name="参数名"/>
<O><![CDATA[默认值]]></O>
</Parameter>
</Parameters>
<Attributes maxMemRowCount="-1"/>
<Connection class="com.fr.data.impl.NameDatabaseConnection">
<DatabaseName><![CDATA[FineReport数据连接名]]></DatabaseName>
</Connection>
<Query><![CDATA[SQL查询语句]]></Query>
<PageQuery><![CDATA[]]></PageQuery>
</TableData>
```

### 步骤 6：汇报结果

向用户展示：设计器远端连接名、字段扫描摘要、生成的 SQL 查询、可直接使用的 XML 数据源配置、建议的参数名称和默认值。

## 注意事项

- 先扫字段，再设计；不能跳过字段扫描直接猜列名
- 密码等敏感信息不写入文件，只通过项目 helper 和宿主配置使用
- 大表试跑建议先限制返回行数，再逐步放开
