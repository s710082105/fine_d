# 聊天面板 UI 设计

## 目标

右侧不是普通 textarea 聊天框，而是面向 Codex 会话的可视化执行面板。

## 布局

右侧区域建议拆成四块：

### 1. Chat Header

显示：

- 当前项目名
- 当前会话名
- 配置版本号
- 会话状态：`idle / running / error / completed`
- 当前启用的 agent profile 与 skills

### 2. Message Timeline

显示：

- 用户消息
- assistant 回复
- 工具事件
- 状态事件
- 错误事件

### 3. Activity Rail

显示轻量执行状态：

- 生成上下文
- 启动会话
- 执行命令
- 写入文件
- 校验成功或失败

### 4. Composer

支持：

- 多行输入
- 发送
- 新建会话
- 手动刷新上下文
- 中断会话

`刷新上下文` 必须显式，不允许静默重载。

## 时间线数据模型

前端不能只维护纯文本消息列表，建议按事件类型建模：

```ts
type SessionMeta = {
  sessionId: string
  projectId: string
  title: string
  status: 'idle' | 'running' | 'error' | 'completed'
  configVersion: string
}

type TimelineItem =
  | { type: 'user'; id: string; content: string }
  | { type: 'assistant'; id: string; content: string; streaming: boolean }
  | { type: 'tool'; id: string; name: string; status: string; summary?: string }
  | { type: 'status'; id: string; message: string }
  | { type: 'error'; id: string; message: string }
```

## 交互规则

- assistant 回复支持流式更新。
- 工具事件独立展示，不混入普通回复卡片。
- 错误事件真实暴露，不做弱化处理。
- 旧会话只读展示，不自动套新配置。
- 左侧配置变化后，右侧必须显式提示“需要新建会话或手动刷新上下文”。
