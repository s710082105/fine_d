<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import type { CodexTerminalSessionResponse } from '../lib/types'
import {
  createTerminalAdapter,
  type TerminalAdapter
} from './terminal/xterm-adapter'

const props = defineProps<{
  session: CodexTerminalSessionResponse | null
  errorMessage: string
}>()

const emit = defineEmits<{
  restart: []
  submitInput: [data: string]
}>()

const hostRef = ref<HTMLElement | null>(null)
const adapter = ref<TerminalAdapter | null>(null)

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

function clearTerminal(): void {
  adapter.value?.clear()
}

function appendOutput(chunk: string): void {
  adapter.value?.write(chunk)
}

function reset(): void {
  clearTerminal()
}

function focusTerminal(): void {
  adapter.value?.focus()
}

function mountTerminal(): void {
  if (!hostRef.value || adapter.value) {
    return
  }
  adapter.value = createTerminalAdapter(hostRef.value, {
    onInput: (payload) => emit('submitInput', payload)
  })
  adapter.value.fit()
}

watch(() => props.session?.session_id, () => {
  reset()
  focusTerminal()
})

onMounted(() => {
  mountTerminal()
})

onBeforeUnmount(() => {
  adapter.value?.destroy()
  adapter.value = null
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
      <div ref="hostRef" class="terminal-panel__viewport" />
    </div>
    <p class="terminal-panel__hint">
      点击终端后直接输入，Enter、方向键和快捷键会原样发送给 Codex。
    </p>
  </section>
</template>

<style scoped>
.terminal-panel {
  display: grid;
  gap: 16px;
  min-height: 100%;
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
  min-height: 520px;
  border-radius: 20px;
  overflow: hidden;
  background: #07111f;
  color: #d7e3f4;
}

.terminal-panel__viewport {
  height: 520px;
  padding: 16px;
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
