# 远程同步协议与远程目录选择设计

**日期**: 2026-03-20

## 背景

当前 `finereport` 项目已经具备以下基础：

- 前端配置模型已经支持 `sync.protocol = sftp | ftp | local`
- Rust 运行期增量同步已实现 `sftp/ftp/local`
- 会话启动后的自动同步会走 `SyncManager -> ProtocolSyncTransport`

但主链路仍然缺两块关键能力：

1. 项目初始化时的全量同步只支持 `local`，`sftp/ftp` 会直接报未实现
2. 配置页无法读取远程目录，用户只能手工填写 `remote_runtime_dir`
3. Git `post-commit` hook 对 `sftp/ftp` 仍是占位报错
4. 远程同步密码当前只能从环境变量 `FINEREPORT_SYNC_PASSWORD` 读取

用户明确要求：

- 补全 `sftp`、`ftp` 两种同步协议
- 补全远程目录读取，填写远程参数后可点击选择远程目录
- 同步密码保存在项目配置文件里

## 用户决定

本次设计明确接受一个与默认安全基线不同的取舍：

- `sync.password` 将直接保存在项目配置文件 `project-config.json` 中
- 不引入环境变量回退
- 不做 silent fallback

这是用户的显式要求，不在实现过程中再自动改回“仅环境变量”方案。

## 目标

补齐以下三条同步链路：

1. **初始化全量同步**  
   从远端运行目录读取完整报表目录到本地项目 `reportlets/`

2. **运行期增量同步**  
   当本地 `reportlets/**/*.cpt|*.fvs` 新增、修改、删除时，同步到远端运行目录

3. **Git post-commit 精确同步**  
   继续按提交差异只同步变更文件，但支持 `sftp/ftp`

并新增：

4. **远程目录浏览与选择**  
   在前端配置页填写远程参数后，点击按钮读取远端目录并选择目标运行目录

## 方案选择

### 方案 A: 密码仅环境变量

- 优点：更安全
- 缺点：不符合本次用户要求

### 方案 B: 密码写入项目配置文件

- 优点：闭环完整，交互直接
- 缺点：密码会落盘

### 方案 C: 配置里只存密码引用名

- 优点：兼顾安全与配置体验
- 缺点：复杂度更高，不满足当前最小闭环

### 采用方案

采用 **方案 B**。

## 架构设计

### 1. 配置模型扩展

前后端 `SyncProfile` 同步新增字段：

- `password: string`

涉及文件：

- `src/lib/types/project-config.ts`
- `src-tauri/src/domain/project_config.rs`
- `src/components/config/project-config-state.ts`

校验规则：

- `local` 协议：只校验 `remote_runtime_dir`
- `sftp/ftp` 协议：必须校验 `host`、`port`、`username`、`password`、`remote_runtime_dir`

### 2. 前端配置页交互

涉及文件：

- `src/components/config/project-config-project-fields.tsx`
- `src/components/config/project-config-services.ts`
- `src/components/config/project-config-state.ts`

改动：

- 在远程协议下显示 `同步密码`
- 本地协议下保留现有“选择运行目录”
- 远程协议下显示：
  - 只读的 `远端运行目录`
  - `选择远程目录` 按钮
- 点击按钮后调用新的 Tauri 命令读取目录列表
- 用户选择后回填 `sync.remote_runtime_dir`

目录浏览要求：

- 只展示目录，不展示文件
- 按层级展开
- 错误直接展示到界面

### 3. Rust 远程目录浏览命令

新增命令与领域服务，推荐拆分：

- `src-tauri/src/commands/project_sync.rs`
- `src-tauri/src/domain/remote_directory_browser.rs`

输入：

- `protocol`
- `host`
- `port`
- `username`
- `password`
- `path`

输出统一目录结构：

- `name`
- `path`
- `children`

实现：

- `sftp` 走 `ssh2::Sftp::readdir`
- `ftp` 走 `suppaftp` 目录遍历接口

约束：

- 仅返回目录项
- 不做递归全量扫描，采用“按需展开”或“单层列表 + 根路径回填”的最小方案

### 4. 初始化全量同步补全

涉及文件：

- `src-tauri/src/domain/sync_bootstrap.rs`
- `src-tauri/src/domain/project_initializer.rs`

当前问题：

- `ProtocolRuntimeSyncBootstrapper::replace_project_tree()` 只支持 `local`

目标行为：

- `local`：保持当前本地复制
- `sftp`：连接远端后将 `remote_runtime_dir` 全量下载到本地 `reportlets/`
- `ftp`：同样全量下载

实现要求：

- 下载前仍清空本地项目源码目录
- 目录层级保持一致
- `.cpt/.fvs` 以外文件是否同步：
  - 初始化全量同步按目录真实内容拉取，不额外过滤
  - 增量同步仍按既有 `reportlets/**/*.cpt|*.fvs` 规则

### 5. 运行期增量同步改造

涉及文件：

- `src-tauri/src/domain/sync_transport.rs`

当前问题：

- `sftp/ftp` 使用环境变量 `FINEREPORT_SYNC_PASSWORD`

目标行为：

- 统一从 `profile.password` 读取
- 删除环境变量依赖

### 6. Git post-commit 远端同步

涉及文件：

- `src-tauri/src/domain/project_git.rs`
- `embedded/templates/post-commit-sync.sh.hbs`

当前问题：

- hook 只实现 `local`
- `sftp/ftp` 直接报 `not implemented`

目标行为：

- 仍由 `git diff-tree --name-status` 提取变更
- `local` 保持现有 `cp/rm`
- `sftp/ftp` 不在 shell 里手写整套传输逻辑

推荐实现：

- hook 将变更事件转发给同仓可执行同步命令
- 该命令复用 Rust 侧 `ResolvedSyncTask + ProtocolSyncTransport`

原因：

- 避免在 shell 里重复实现 `sftp/ftp`
- 避免两套传输逻辑漂移

如果当前 Tauri 可执行架构不足以让 hook 稳定调用该能力，则退而求其次：

- 单独新增受控同步脚本
- 但仍以 Rust 侧同步逻辑为唯一真实实现

### 7. 错误处理

遵循仓库规则，不做 silent fallback：

- 连接失败：直接返回明确错误
- 认证失败：直接返回明确错误
- 目录不存在：直接返回明确错误
- 初始化同步失败：阻止项目初始化完成
- hook 远端同步失败：返回非零退出码，让问题暴露

## 文件边界

建议新增/修改的主要文件：

- Modify: `src/lib/types/project-config.ts`
- Modify: `src/components/config/project-config-project-fields.tsx`
- Modify: `src/components/config/project-config-services.ts`
- Modify: `src/components/config/project-config-state.ts`
- Modify: `src/components/config/project-config-form.tsx`
- Modify: `src-tauri/src/domain/project_config.rs`
- Modify: `src-tauri/src/domain/sync_transport.rs`
- Modify: `src-tauri/src/domain/sync_bootstrap.rs`
- Modify: `src-tauri/src/domain/project_git.rs`
- Modify: `embedded/templates/post-commit-sync.sh.hbs`
- Modify: `src-tauri/src/lib.rs`
- Add: `src-tauri/src/commands/project_sync.rs`
- Add: `src-tauri/src/domain/remote_directory_browser.rs`

## 测试策略

### 前端

- 配置页在 `sftp/ftp` 下显示密码字段和远程目录按钮
- 点击远程目录按钮后能够展示目录列表
- 选择目录后能回填 `remote_runtime_dir`

### Rust

- `SyncProfile` 在远程协议下要求 `password`
- `ProtocolSyncTransport` 使用配置密码
- `ProtocolRuntimeSyncBootstrapper` 支持 `sftp/ftp`
- 远程目录浏览返回统一目录结构
- hook 模板渲染包含远端协议调用链

### 回归

- `local` 协议原行为不变
- 自动同步 watcher 不回归
- 项目初始化不回归

## 非目标

- 不做密码加密存储
- 不做 SSH key 登录
- 不做多主机配置
- 不做文件级远程预览
