---
name: fr-db
description: 探测数据库结构并生成 SQL 查询语句，用于 FineReport 模板数据源配置。支持 MySQL、PostgreSQL、Oracle、SQL Server 等主流数据库。
---

# FineReport 数据库探测与 SQL 生成

探测数据库结构并生成适用于 FineReport 数据源的 SQL 查询。

## 工作流程

### 步骤 1：获取数据库连接信息

向用户确认：数据库类型（MySQL/PostgreSQL/Oracle/SQL Server）、主机地址(host:port)、数据库名称、用户名和密码、FineReport 中的数据连接名称。

### 步骤 2：连接并探测结构

**MySQL**：
```bash
mysql -h <host> -P <port> -u <user> -p<password> <database> -e "
  SELECT TABLE_NAME, TABLE_COMMENT FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = '<database>' ORDER BY TABLE_NAME;"
```

**PostgreSQL**：
```bash
PGPASSWORD=<password> psql -h <host> -p <port> -U <user> -d <database> -c "
  SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;"
```

**Oracle/SQL Server**：优先使用 Python + SQLAlchemy 方案：
```python
from sqlalchemy import create_engine, inspect
# MySQL: mysql+pymysql://user:pass@host:port/db
# PostgreSQL: postgresql://user:pass@host:port/db
# Oracle: oracle+cx_oracle://user:pass@host:port/service
# SQL Server: mssql+pymssql://user:pass@host:port/db
engine = create_engine('<connection_url>')
inspector = inspect(engine)
tables = inspector.get_table_names()
for table in tables:
    columns = inspector.get_columns(table)
```

查看表字段（MySQL 示例）：
```bash
mysql -h <host> -P <port> -u <user> -p<password> <database> -e "
  SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_KEY, COLUMN_COMMENT
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = '<database>' AND TABLE_NAME = '<table>'
  ORDER BY ORDINAL_POSITION;"
```

### 步骤 3：根据用户需求生成 SQL

**FineReport 参数语法**：

| 场景 | 语法 | 示例 |
|------|------|------|
| 普通参数 | `${参数名}` | `WHERE region = '${region}'` |
| 多值参数 | `IN (${参数名})` | `WHERE category IN (${category})` |
| 动态条件 | `${if(...)}` | `${if(len(dept) > 0, "AND dept = '" + dept + "'", "")}` |

### 步骤 4：输出数据源配置 XML

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

### 步骤 5：汇报结果

向用户展示：探测到的表结构摘要、生成的 SQL 查询（带注释）、可直接使用的 XML 数据源配置、建议的参数名称和默认值。

## 注意事项

- 密码等敏感信息不写入文件，只在命令行中使用
- 探测完成后建议用户验证 SQL 正确性
- 命令行工具不可用时优先使用 Python + SQLAlchemy 方案
- 大表建议加 LIMIT 或分页
