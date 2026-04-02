<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import type { CodexTerminalSessionResponse } from '../lib/types'
import TerminalComposer from './terminal/TerminalComposer.vue'
import TerminalViewport from './terminal/TerminalViewport.vue'

interface TerminalViewportHandle {
  appendOutput(chunk: string): Promise<void>
  clear(): void
  focus(): void
}

const props = defineProps<{
  session: CodexTerminalSessionResponse | null
  errorMessage: string
}>()

const emit = defineEmits<{
  restart: []
  submitInput: [data: string]
}>()

const viewportRef = ref<TerminalViewportHandle | null>(null)

const STATUS_LABELS: Record<string, string> = {
  running: '运行中',
  closed: '已关闭',
  failed: '已失败'
}

const statusLabel = computed(() => {
  if (!props.session) {
    return '未启动'
  }
  return STATUS_LABELS[props.session.status] ?? props.session.status
})

function appendOutput(chunk: string): Promise<void> {
  return viewportRef.value?.appendOutput(chunk) ?? Promise.resolve()
}

function reset(): void {
  viewportRef.value?.clear()
}

function focusTerminal(): void {
  viewportRef.value?.focus()
}

function emitViewportInput(payload: string): void {
  emit('submitInput', payload)
}

function emitComposerInput(payload: string): void {
  emit('submitInput', payload)
  focusTerminal()
}

watch(() => props.session?.session_id, () => {
  reset()
  focusTerminal()
})

defineExpose({
  appendOutput,
  reset,
  focusTerminal
})
</script>

<template>
  <section class="terminal-panel">
    <header class="terminal-panel__header">
      <div>
        <h2>Codex</h2>
        <p>{{ session?.working_directory ?? '尚未获取当前项目目录' }}</p>
      </div>
      <div class="terminal-panel__meta">
        <span class="terminal-panel__status">{{ statusLabel }}</span>
        <button type="button" @click="$emit('restart')">重新创建会话</button>
      </div>
    </header>

    <p v-if="errorMessage" class="terminal-panel__error" role="alert">
      {{ errorMessage }}
    </p>

    <div class="terminal-panel__surface">
      <TerminalViewport
        ref="viewportRef"
        :on-input="emitViewportInput"
      />
    </div>

    <TerminalComposer
      :key="session?.session_id ?? 'terminal-composer'"
      :disabled="!session || session.status !== 'running'"
      @submit="emitComposerInput"
    />

    <p class="terminal-panel__hint">
      可直接点击终端输入，也可在下方输入框里组织命令后发送到 Codex。
    </p>
  </section>
</template>

<style scoped>
.terminal-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: 100%;
  min-width: 0;
}

.terminal-panel__header,
.terminal-panel__meta,
.terminal-panel__prompt {
  display: flex;
  gap: 12px;
}

.terminal-panel__header,
.terminal-panel__meta {
  align-items: center;
  justify-content: space-between;
}

.terminal-panel__header h2,
.terminal-panel__header p,
.terminal-panel__error,
.terminal-panel__hint {
  margin: 0;
}

.terminal-panel__header p {
  color: #5e738c;
}

.terminal-panel__meta {
  flex-wrap: wrap;
}

.terminal-panel__status {
  padding: 6px 10px;
  border-radius: 999px;
  background: #e8f1ff;
  color: #1d4d8f;
  font-size: 12px;
}

.terminal-panel__error {
  padding: 14px 16px;
  border-radius: 16px;
  background: #fff1f0;
  color: #a12d2d;
}

.terminal-panel__surface {
  display: flex;
  min-height: 520px;
  border-radius: 20px;
  overflow: hidden;
  background: #07111f;
  color: #d7e3f4;
}

.terminal-panel__hint {
  color: #5e738c;
  font-size: 13px;
}

.terminal-panel button {
  border: 0;
  border-radius: 14px;
  padding: 12px 16px;
  background: #1363df;
  color: #ffffff;
  font: inherit;
  cursor: pointer;
}

@media (max-width: 720px) {
  .terminal-panel__header {
    flex-direction: column;
    align-items: flex-start;
  }

  .terminal-panel__meta {
    width: 100%;
    justify-content: space-between;
  }
}
</style>
