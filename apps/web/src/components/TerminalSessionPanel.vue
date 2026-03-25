<script setup lang="ts">
import { computed, ref } from 'vue'

import type { CodexTerminalSessionResponse } from '../lib/types'

const props = defineProps<{
  session: CodexTerminalSessionResponse | null
  output: string
  errorMessage: string
}>()

const emit = defineEmits<{
  restart: []
  submitInput: [data: string]
}>()

const commandInput = ref('')

const statusLabel = computed(() => props.session?.status ?? '未启动')

function handleSubmit(): void {
  if (!commandInput.value) {
    return
  }
  emit('submitInput', `${commandInput.value}\n`)
  commandInput.value = ''
}
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
      <pre class="terminal-panel__output">{{ output || '终端已连接，等待输出...' }}</pre>
      <label class="terminal-panel__prompt">
        <span>&gt;</span>
        <input
          v-model="commandInput"
          aria-label="终端输入"
          type="text"
          :disabled="session?.status !== 'running'"
          placeholder="在终端内输入命令并按 Enter"
          @keydown.enter.prevent="handleSubmit"
        />
      </label>
    </div>
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
.terminal-panel__error {
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
  display: grid;
  grid-template-rows: minmax(320px, 1fr) auto;
  min-height: 520px;
  border-radius: 20px;
  overflow: hidden;
  background: #07111f;
  color: #d7e3f4;
}

.terminal-panel__output {
  margin: 0;
  padding: 24px;
  overflow: auto;
  font-family: "SFMono-Regular", "Menlo", monospace;
  white-space: pre-wrap;
  word-break: break-word;
}

.terminal-panel__prompt {
  align-items: center;
  padding: 16px 20px;
  border-top: 1px solid rgba(215, 227, 244, 0.12);
  font-family: "SFMono-Regular", "Menlo", monospace;
}

.terminal-panel__prompt input {
  flex: 1;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
}

.terminal-panel__prompt input:focus {
  outline: none;
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
