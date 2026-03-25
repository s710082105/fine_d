<script setup lang="ts">
import { ref } from 'vue'

import { ApiError, runSyncAction } from '../lib/api'
import type { SyncAction, SyncResultResponse } from '../lib/types'

const action = ref<SyncAction>('sync_file')
const targetPath = ref('')
const loading = ref(false)
const result = ref<SyncResultResponse | null>(null)
const errorMessage = ref('')

const ACTION_OPTIONS: readonly SyncAction[] = [
  'sync_file',
  'sync_directory',
  'publish_project',
  'verify_remote_state'
]

async function handleRunSync(): Promise<void> {
  loading.value = true
  errorMessage.value = ''
  result.value = null
  try {
    result.value = await runSyncAction(action.value, normalizeTargetPath(targetPath.value))
  } catch (error) {
    errorMessage.value = formatErrorMessage(error, '同步请求失败')
  } finally {
    loading.value = false
  }
}

function normalizeTargetPath(value: string): string | undefined {
  const normalizedValue = value.trim()
  return normalizedValue || undefined
}

function formatErrorMessage(error: unknown, fallbackMessage: string): string {
  if (error instanceof ApiError) {
    return error.code ? `${error.code}: ${error.message}` : error.message
  }
  return error instanceof Error ? error.message : fallbackMessage
}
</script>

<template>
  <section class="sync-view">
    <header class="sync-view__header">
      <div>
        <h2>Sync</h2>
        <p>手动触发单次同步动作，并查看后端返回结果。</p>
      </div>
      <span class="sync-view__badge">Manual Only</span>
    </header>

    <section class="sync-view__panel">
      <label class="sync-view__label" for="sync-action">同步动作</label>
      <select id="sync-action" v-model="action" class="sync-view__select">
        <option v-for="item in ACTION_OPTIONS" :key="item" :value="item">
          {{ item }}
        </option>
      </select>

      <label class="sync-view__label" for="sync-target-path">目标路径</label>
      <input
        id="sync-target-path"
        v-model="targetPath"
        class="sync-view__input"
        type="text"
        placeholder="reportlets/demo.cpt"
      />

      <div class="sync-view__actions">
        <button
          class="sync-view__button"
          type="button"
          :disabled="loading"
          @click="handleRunSync"
        >
          {{ loading ? '执行中...' : '执行同步' }}
        </button>
      </div>
    </section>

    <p v-if="errorMessage" class="sync-view__error" role="alert">
      {{ errorMessage }}
    </p>

    <section v-if="result" class="sync-view__panel">
      <h3>同步结果</h3>
      <dl class="sync-view__meta">
        <div>
          <dt>action</dt>
          <dd>{{ result.action }}</dd>
        </div>
        <div>
          <dt>status</dt>
          <dd>{{ result.status }}</dd>
        </div>
        <div>
          <dt>target_path</dt>
          <dd>{{ result.target_path }}</dd>
        </div>
        <div>
          <dt>remote_path</dt>
          <dd>{{ result.remote_path }}</dd>
        </div>
      </dl>
    </section>
  </section>
</template>

<style scoped>
.sync-view {
  display: grid;
  gap: 24px;
}

.sync-view__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.sync-view__header h2 {
  margin: 0 0 8px;
}

.sync-view__header p {
  margin: 0;
  color: #4c627c;
}

.sync-view__badge {
  padding: 6px 10px;
  border-radius: 999px;
  background: #eef3fb;
  color: #21466f;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.sync-view__panel {
  display: grid;
  gap: 16px;
  padding: 20px;
  border-radius: 20px;
  background: #f8fbff;
  box-shadow: inset 0 0 0 1px rgba(35, 65, 95, 0.08);
}

.sync-view__panel h3 {
  margin: 0;
}

.sync-view__label {
  font-size: 14px;
  font-weight: 600;
}

.sync-view__select,
.sync-view__input {
  width: 100%;
  padding: 14px 16px;
  border: 1px solid #c8d4e3;
  border-radius: 16px;
  font: inherit;
  color: #102033;
  background: #fff;
  box-sizing: border-box;
}

.sync-view__select:focus,
.sync-view__input:focus {
  outline: 2px solid rgba(50, 107, 184, 0.2);
  border-color: #326bb8;
}

.sync-view__actions {
  display: flex;
  justify-content: flex-end;
}

.sync-view__button {
  padding: 10px 18px;
  border: none;
  border-radius: 999px;
  background: linear-gradient(135deg, #326bb8, #21466f);
  color: #fff;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}

.sync-view__button:disabled {
  opacity: 0.65;
  cursor: progress;
}

.sync-view__error {
  margin: 0;
  padding: 14px 16px;
  border-radius: 16px;
  background: #fff1f0;
  color: #a12d2d;
}

.sync-view__meta {
  display: grid;
  gap: 16px;
  margin: 0;
}

.sync-view__meta div {
  display: grid;
  gap: 6px;
}

.sync-view__meta dt {
  color: #5e738c;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.sync-view__meta dd {
  margin: 0;
  word-break: break-all;
}

@media (max-width: 720px) {
  .sync-view__header {
    flex-direction: column;
  }

  .sync-view__actions {
    justify-content: stretch;
  }

  .sync-view__button {
    width: 100%;
  }
}
</style>
