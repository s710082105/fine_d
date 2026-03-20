# React Standard Components Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用 React 标准组件库替换当前原生交互控件，并以 ESM tree shaking 方式控制打包体积。

**Architecture:** 保留现有 `React + Vite + Tauri` 架构和状态管理，只替换展示层交互组件。配置页使用 `antd` 表单与结构组件，终端区只替换按钮和提示组件，终端内核与 Tauri 调用保持不变。

**Tech Stack:** React 18, TypeScript, Vite, Vitest, Ant Design

---

### Task 1: 先补测试锁定可见行为

**Files:**
- Modify: `src/test/project-config-form.test.tsx`
- Modify: `src/test/terminal-panel.test.tsx`

- [ ] **Step 1: 写失败测试**

补充以下断言：

- 文件管理区存在 `role="tree"`
- 配置页切换后仍能通过标签和字段名称操作组件
- 终端头部操作按钮仍按可访问名称暴露

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm test -- src/test/project-config-form.test.tsx src/test/terminal-panel.test.tsx`

Expected: 失败，提示缺少 `tree` 语义或相关结构

### Task 2: 引入组件库并接入入口

**Files:**
- Modify: `package.json`
- Modify: `src/main.tsx`

- [ ] **Step 1: 安装依赖**

Run: `pnpm add antd`

- [ ] **Step 2: 接入样式重置**

在 `src/main.tsx` 中引入 `antd/dist/reset.css`

- [ ] **Step 3: 确认安装成功**

Run: `pnpm test -- src/test/project-config-form.test.tsx src/test/terminal-panel.test.tsx`

Expected: 仍失败，但失败点来自组件未替换，不是依赖缺失

### Task 3: 替换配置页交互组件

**Files:**
- Modify: `src/components/config/project-config-form.tsx`
- Modify: `src/components/config/project-config-fields.tsx`
- Modify: `src/components/config/project-config-extra-fields.tsx`
- Modify: `src/styles/app.css`

- [ ] **Step 1: 用 `Tabs`、`Button`、`Alert`、`Input`、`InputNumber`、`Select`、`Checkbox`、`Card`、`Tree` 替换原生控件**
- [ ] **Step 2: 保持现有字段名、回调签名和可访问名称不变**
- [ ] **Step 3: 清理原生控件专属样式，补齐 `antd` 布局样式**

### Task 4: 替换终端区交互组件

**Files:**
- Modify: `src/components/terminal/terminal-panel-sections.tsx`
- Modify: `src/styles/app.css`

- [ ] **Step 1: 头部操作按钮改为 `Button`**
- [ ] **Step 2: 提示消息改为 `Alert`，保留原有文案**
- [ ] **Step 3: 保持测试依赖的可访问名称和状态文案稳定**

### Task 5: 验证与产物检查

**Files:**
- No file changes expected

- [ ] **Step 1: 运行定向测试**

Run: `pnpm test -- src/test/project-config-form.test.tsx src/test/terminal-panel.test.tsx src/test/app-shell.test.tsx`

Expected: PASS

- [ ] **Step 2: 运行全量前端测试**

Run: `pnpm test`

Expected: PASS

- [ ] **Step 3: 运行构建并记录包体**

Run: `pnpm build`

Expected: PASS，并生成新的 `dist/assets/*`

- [ ] **Step 4: 对比构建产物**

Run: `ls -lh dist/assets`

Expected: 能明确说明新增组件库后的产物大小变化，确认当前实现已按 ESM tree shaking 仅打包使用到的组件
