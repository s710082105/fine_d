# Element Plus 远程目录树与连接摘要设计

## 背景

当前 `ProjectWorkbenchView` 已经具备项目目录选择、远程参数维护、远程概览展示三块能力，但界面与数据表达还有明显缺口：

- 前端仍以原生 `button`、`input`、`ul/li` 为主，交互密度上来后可读性和一致性不足。
- 远程目录只按平铺列表展示，无法表达目录层级，也不利于浏览较深路径。
- 数据连接目前只返回 `name`，无法直接判断连接类型和目标地址。

用户本轮目标是：

1. 引入 `Element Plus`，把工作台已使用的原生组件替换为标准组件。
2. 将远程目录改为树形展示，并以懒加载方式展开。
3. 将数据连接摘要扩展到“名称 + 数据库类型 + 连接地址/主机信息”，不暴露密码等敏感字段。

## 目标

1. 保持现有 `Vue 3 + Vite` 架构不变，只替换工作台相关组件层。
2. 远程目录在 UI 上表现为树，首次只加载根节点，用户展开时再加载子节点。
3. 后端连接摘要模型扩展为最小安全集：
   - `name`
   - `database_type`
   - `host_or_url`
4. 所有失败继续显式透出，不引入 silent fallback。

## 非目标

- 不重做全站视觉主题。
- 不把 FineReport 所有连接配置都透给前端。
- 不增加本地缓存型兜底目录树。
- 不修改 Codex 终端工作台交互方式。

## 方案

### 1. Element Plus 接入

前端新增 `element-plus` 依赖，并在入口接入样式。工作台相关页面与组件替换为：

- `el-page-header` 或现有标题区 + `el-button`
- `el-card`
- `el-form`
- `el-form-item`
- `el-input`
- `el-alert`
- `el-descriptions`
- `el-tree`
- 必要时补 `el-tag` 展示目录锁状态

替换范围限定在：

- `apps/web/src/views/ProjectWorkbenchView.vue`
- `apps/web/src/components/RemoteDirectoryPanel.vue`
- `apps/web/src/components/DataConnectionPanel.vue`

不对当前导航和 Codex 页做顺手改造。

### 2. 远程目录树与懒加载

当前远程概览接口一次性返回 `directory_entries` 平铺列表，只够“全量列表展示”，不够支持真正按节点请求子目录。因此本次增加一个按路径读取子目录的新接口，由前端在 `el-tree` 的 `load` 回调中调用。

新增接口建议：

- `GET /api/remote/directories`
  - 无 `path` 参数时返回根目录节点
  - 有 `path` 参数时返回该目录下一级子节点

返回项继续沿用当前目录模型，但补充树渲染所需的稳定语义：

- `path`
- `name`
- `is_directory`
- `lock`

前端树节点规则：

- `node-key = path`
- 目录节点才允许展开
- 文件节点直接叶子化
- 展开时调用后端读取当前目录的直接子节点
- 加载失败时在面板内显式提示错误，不吞掉

这样可以避免把整棵远程目录树一次性拉回浏览器，也符合“懒加载”要求。

### 3. 数据连接摘要扩展

后端连接模型从只有 `name` 扩展为：

- `name`
- `database_type`
- `host_or_url`

解析策略遵循“最小安全集”：

- `database_type` 尝试从 FineReport 返回字段中的类型、驱动、数据库品牌等字段归一化提取。
- `host_or_url` 优先取 JDBC URL 或连接 URL；若没有完整 URL，则回退为 `host[:port][/database]` 形式。
- 密码、token、私密属性一律不回传。

如果远端响应里缺少类型或地址信息，则字段返回空字符串，不构造假的默认值。

### 4. 页面交互整理

工作台页面保留现有三块主流程，但调整为更适合后台工具的结构：

- 项目目录卡片：显示当前路径、选择目录、重新加载
- 远程参数卡片：`el-form` 承载服务地址/用户名/密码，按钮区负责保存和测试
- 远程概览区域：左右两块
  - 左侧远程目录树
  - 右侧数据连接摘要列表

错误提示统一用 `el-alert`，成功/状态反馈尽量放在相应卡片内部。

## 影响范围

### 前端

- `apps/web/package.json`
- `apps/web/src/main.ts`
- `apps/web/src/views/ProjectWorkbenchView.vue`
- `apps/web/src/components/RemoteDirectoryPanel.vue`
- `apps/web/src/components/DataConnectionPanel.vue`
- `apps/web/src/lib/api.ts`
- `apps/web/src/lib/types.ts`
- 相关 Vitest 组件测试

### 后端

- `backend/domain/datasource/models.py`
- `backend/schemas/datasource.py`
- `backend/adapters/fine/http_client.py`
- `backend/application/remote/use_cases.py`
- `backend/schemas/remote.py`
- `apps/api/routes/remote.py`
- 相关 pytest

## 风险与约束

- FineReport 连接列表接口字段命名可能因版本不同而变化，解析逻辑必须容忍多个候选字段名，但不能捏造不存在的数据。
- 目录树懒加载要求后端能按路径取子目录；如果远端接口本身只支持全量列表，需要在网关层做显式筛选，但不能伪装成“远端支持”。
- `Element Plus` 引入后需要确认 `vitest`、`vue-tsc`、`vite build` 都稳定通过。

## 测试策略

### 后端

- 为连接解析补单元测试：
  - 类型字段存在时正确映射
  - URL 字段存在时正确填充 `host_or_url`
  - 敏感字段不会出现在响应模型中
- 为远程目录子节点读取补 API / use case 测试：
  - 根目录读取
  - 子目录读取
  - 错误透出

### 前端

- 为工作台页面补组件测试：
  - 使用 `Element Plus` 后表单和按钮仍可完成保存/测试流程
  - 远程目录树根节点渲染
  - 展开目录时触发懒加载请求
  - 数据连接卡片显示名称、数据库类型、地址

### 最终验证

- `PYTHONPATH=python .venv/bin/python -m pytest ...`
- `pnpm --dir apps/web exec vitest run`
- `pnpm --dir apps/web exec vue-tsc --noEmit`
- `pnpm --dir apps/web build`
