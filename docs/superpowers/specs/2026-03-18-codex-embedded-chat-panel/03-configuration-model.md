# 配置模型

## 目标

左侧配置不能只是表单集合，而要形成可生成运行时上下文的结构化模型。

## 配置对象

### 1. Style Profile

描述 FineReport 模板样式，建议字段：

- `header_font_family`
- `header_font_size`
- `header_font_color`
- `header_background_color`
- `header_border_style`
- `header_border_width`
- `column_font_family`
- `column_font_size`
- `column_font_color`
- `column_background_color`
- `column_width`
- `cell_font_family`
- `cell_font_size`
- `cell_font_color`
- `cell_border_style`
- `cell_border_width`

### 2. Workspace Profile

描述业务项目与产物目录：

- `project_root`
- `template_source_dir`
- `generated_output_dir`
- `working_output_dir`
- `runtime_target_dir`
- `runtime_dir`
- `temp_dir`
- `publish_dir`
- `version_control_dir`

运行时内部路径由软件派生，不要求用户直接维护。

### 3. Sync Profile

描述同步行为：

- `protocol`
- `host`
- `port`
- `username`
- `local_source_dir`
- `remote_runtime_dir`
- `remote_path`
- `direction`
- `overwrite_policy`
- `auto_sync_on_change`
- `delete_propagation`
- `path_mapping_rules`

密码或密钥不进入普通配置文件，应通过系统安全存储管理。

约束：

- `protocol` 当前仅支持 `sftp`、`ftp`。
- `auto_sync_on_change` 默认为开启。
- `direction` 首版仅支持本地到真实运行目录的单向同步。

### 4. AI Profile

描述会话规则和能力开关：

- `agent_mode`
- `enabled_skill_ids`
- `system_prompt_appendix`
- `browser_skill_enabled`
- `tool_constraints`
- `output_conventions`

### 5. Project Mapping

把目录、样式和模板来源映射为 Codex 可理解的项目说明：

- `template_inputs`
- `template_outputs`
- `resource_dirs`
- `sync_source_targets`
- `validation_targets`
- `sync_targets`

## 上下文生成

运行时上下文按三层合成：

1. 固定层：软件内置 `AGENTS.md` 与 `skills`。
2. 项目层：工作目录、同步信息、模板映射。
3. 会话层：当前配置快照、用户任务背景、会话版本信息。

建议同时生成：

- `project-context.md`
- `mappings.json`

前者适合喂给 Codex，后者适合 Rust、校验器和同步器消费。

同时需要生成可执行的同步映射，使 `sync_dispatcher` 能把本地新增、修改、删除准确映射到真实运行目录。

## 配置版本

左侧每次保存配置都生成新的 `config_version`，并写入：

- 项目配置元数据
- `project-context.md`
- `session-manifest.json`
- `transcript.jsonl`

这保证后续能够追溯某次结果到底基于哪版配置生成。
