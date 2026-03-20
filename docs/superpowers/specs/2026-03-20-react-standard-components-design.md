# React 标准组件替换设计

**日期**: 2026-03-20

## 背景

当前前端是 `React + Vite + Tauri`，配置页和终端头部交互主要使用原生 `button`、`input`、`select`、`checkbox` 和自定义样式。用户希望统一替换为标准组件库，并通过按需加载控制最终包体。

`Element Plus` 是 Vue 3 组件库，无法直接用于当前 React 工程，因此本次设计改为选择 React 生态中的标准组件库，并保持相同目标：

- 替换现有原生交互控件
- 保留当前布局和终端业务逻辑
- 使用 ESM tree shaking 方式避免整库打包

## 方案选择

### 推荐方案: Ant Design React

选择 `antd` 作为标准组件库，原因如下：

- 组件集合完整，能覆盖当前页面所需的 `Button`、`Input`、`InputNumber`、`Select`、`Checkbox`、`Tabs`、`Alert`、`Card`、`Tree`
- 适合当前偏配置后台的交互语义
- 在 Vite 下可直接使用 ESM tree shaking，只打包被引用的组件代码
- 能在不改业务状态流的前提下完成界面层替换

### 放弃方案

- `MUI`: 组件能力足够，但接入成本和视觉偏移都更高
- `Radix UI`: 更偏 primitives，不适合这次“直接换标准组件”

## 改动范围

### 依赖与构建

- `package.json`: 新增 `antd`
- `vite.config.ts`: 保持现有 React 插件，依赖 Vite 对 ESM 的 tree shaking，不额外引入全局样式打包插件
- `src/main.tsx`: 接入 `antd` 样式重置

### 组件替换

- `src/components/config/project-config-form.tsx`
  - 原生 tab 切换改为 `Tabs`
  - 保存按钮改为 `Button`
  - 状态提示改为 `Alert`
- `src/components/config/project-config-fields.tsx`
  - 原生输入控件改为 `Input`、`InputNumber`、`Select`、`Checkbox`
  - 目录选择行改为 `Space.Compact`
- `src/components/config/project-config-extra-fields.tsx`
  - 数据连接操作改为 `Button`、`Card`
  - 文件树改为 `Tree`
- `src/components/terminal/terminal-panel-sections.tsx`
  - 头部按钮改为 `Button`
  - 状态提示改为 `Alert`

### 样式调整

- 保留整体页面背景、左右分栏、终端区域等自定义风格
- 删除只服务于原生表单控件的 CSS 规则
- 为 `antd` 容器类补最小必要间距和布局样式

## 非目标

- 不改 Rust/Tauri 端命令和终端会话逻辑
- 不重做视觉主题
- 不引入新的兜底逻辑或 silent fallback

## 测试策略

- 更新现有 Vitest 用例，覆盖：
  - 配置分组切换
  - 目录选择后表单字段可见
  - 数据连接新增
  - 文件管理树渲染
  - 终端头部按钮可见和状态提示正常
- 运行 `pnpm test`
- 运行 `pnpm build`，对比 `dist/assets` 产物大小变化
