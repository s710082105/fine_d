# Changelog

## v0.0.4 (2026-03-21)

### Features

- **数据连接管理改造**：数据连接页签从 Card 列表重构为 Table + Modal 形式，支持表格化展示、弹窗编辑
- **测试连接功能**：新增「测试连接」按钮，通过 Python + SQLAlchemy 验证数据库连接可用性，测试通过后才允许确认保存
- **数据模型拆分**：`DataConnectionProfile` 的 `dsn` 字段拆分为 `db_type`、`host`、`port`、`database` 独立字段，支持 MySQL / PostgreSQL / Oracle / SQL Server 四种类型
- **数据库类型自动端口**：选择数据库类型后自动填充默认端口（MySQL:3306, PostgreSQL:5432, Oracle:1521, SQL Server:1433）
- **fr-db Skill 升级**：统一使用 SQLAlchemy 连接所有数据库类型，优先从项目配置读取连接信息，执行查询时自动提权
- **Windows 数据库驱动安装**：`install-runtime-windows.ps1` 新增 `Install-DatabaseDrivers` 步骤，自动安装 sqlalchemy、pymysql、psycopg2-binary、oracledb、pymssql

### Improvements

- 旧配置文件的 `dsn` 字段通过 legacy normalizer 自动迁移为新字段格式，向后兼容
- 密码中的特殊字符通过 URL 编码处理，避免 SQLAlchemy 连接串解析问题
- 测试环境新增 `window.matchMedia` mock，支持 antd Table 组件在 jsdom 中正常运行

### Files Changed (17)

- `src/lib/types/project-config.ts` — 新增 DbType，拆分 DataConnectionProfile
- `src-tauri/src/domain/project_config.rs` — Rust 数据模型同步
- `src/components/config/project-config-extra-fields.tsx` — Table + Modal 重写
- `src/components/config/project-config-state.ts` — state 方法签名更新
- `src/components/config/project-config-services.ts` — 新增 testDataConnection
- `src/components/config/project-config-form.tsx` — 透传 testDataConnection
- `src-tauri/src/commands/project_config.rs` — 新增 test_data_connection command + DSN 迁移
- `src-tauri/src/lib.rs` — 注册新 command
- `src-tauri/src/domain/context_builder_data.rs` — markdown 输出适配新字段
- `src-tauri/Cargo.toml` — 新增 urlencoding 依赖
- `embedded/skills/fr-db/SKILL.md` — SQLAlchemy 优先 + 自动提权
- `scripts/install-runtime-windows.ps1` — 安装数据库驱动
- `src/test/setup.ts` — matchMedia mock
- `src/test/project-config-form.test.tsx` — 测试适配
- `src-tauri/tests/project_config_roundtrip.rs` — Rust 测试适配
- `src-tauri/tests/context_builder_generates_sync_rules.rs` — Rust 测试适配
- `src-tauri/Cargo.lock` — 锁文件更新
