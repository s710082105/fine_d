<script setup lang="ts">
import { ref } from 'vue'

import { ApiError, openPreview } from '../lib/api'
import type { PreviewSessionResponse } from '../lib/types'

const url = ref('http://127.0.0.1:8075/webroot/decision')
const loading = ref(false)
const session = ref<PreviewSessionResponse | null>(null)
const errorMessage = ref('')

async function handleOpenPreview(): Promise<void> {
  loading.value = true
  errorMessage.value = ''
  session.value = null
  try {
    session.value = await openPreview(url.value)
  } catch (error) {
    errorMessage.value = formatErrorMessage(error, 'Preview 请求失败')
  } finally {
    loading.value = false
  }
}

function formatErrorMessage(error: unknown, fallbackMessage: string): string {
  if (error instanceof ApiError) {
    return error.code ? `${error.code}: ${error.message}` : error.message
  }
  return error instanceof Error ? error.message : fallbackMessage
}
</script>

<template>
  <section class="preview-view">
    <header class="preview-view__header">
      <div>
        <h2>Preview</h2>
        <p>手动输入 URL，调用后端打开预览并查看返回的会话信息。</p>
      </div>
      <span class="preview-view__badge">Open Only</span>
    </header>

    <section class="preview-view__panel">
      <label class="preview-view__label" for="preview-url">预览 URL</label>
      <input
        id="preview-url"
        v-model="url"
        class="preview-view__input"
        type="url"
        placeholder="http://127.0.0.1:8075/webroot/decision"
      />

      <div class="preview-view__actions">
        <button
          class="preview-view__button"
          type="button"
          :disabled="loading"
          @click="handleOpenPreview"
        >
          {{ loading ? '打开中...' : '打开预览' }}
        </button>
      </div>
    </section>

    <p v-if="errorMessage" class="preview-view__error" role="alert">
      {{ errorMessage }}
    </p>

    <section v-if="session" class="preview-view__panel">
      <h3>预览会话</h3>
      <dl class="preview-view__meta">
        <div>
          <dt>session_id</dt>
          <dd>{{ session.session_id }}</dd>
        </div>
        <div>
          <dt>status</dt>
          <dd>{{ session.status }}</dd>
        </div>
        <div>
          <dt>url</dt>
          <dd>{{ session.url }}</dd>
        </div>
      </dl>
    </section>
  </section>
</template>

<style scoped>
.preview-view {
  display: grid;
  gap: 24px;
}

.preview-view__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.preview-view__header h2 {
  margin: 0 0 8px;
}

.preview-view__header p {
  margin: 0;
  color: #4c627c;
}

.preview-view__badge {
  padding: 6px 10px;
  border-radius: 999px;
  background: #eef3fb;
  color: #21466f;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.preview-view__panel {
  display: grid;
  gap: 16px;
  padding: 20px;
  border-radius: 20px;
  background: #f8fbff;
  box-shadow: inset 0 0 0 1px rgba(35, 65, 95, 0.08);
}

.preview-view__panel h3 {
  margin: 0;
}

.preview-view__label {
  font-size: 14px;
  font-weight: 600;
}

.preview-view__input {
  width: 100%;
  padding: 14px 16px;
  border: 1px solid #c8d4e3;
  border-radius: 16px;
  font: inherit;
  color: #102033;
  background: #fff;
  box-sizing: border-box;
}

.preview-view__input:focus {
  outline: 2px solid rgba(50, 107, 184, 0.2);
  border-color: #326bb8;
}

.preview-view__actions {
  display: flex;
  justify-content: flex-end;
}

.preview-view__button {
  padding: 10px 18px;
  border: none;
  border-radius: 999px;
  background: linear-gradient(135deg, #326bb8, #21466f);
  color: #fff;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}

.preview-view__button:disabled {
  opacity: 0.65;
  cursor: progress;
}

.preview-view__error {
  margin: 0;
  padding: 14px 16px;
  border-radius: 16px;
  background: #fff1f0;
  color: #a12d2d;
}

.preview-view__meta {
  display: grid;
  gap: 16px;
  margin: 0;
}

.preview-view__meta div {
  display: grid;
  gap: 6px;
}

.preview-view__meta dt {
  color: #5e738c;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.preview-view__meta dd {
  margin: 0;
  word-break: break-all;
}

@media (max-width: 720px) {
  .preview-view__header {
    flex-direction: column;
  }

  .preview-view__actions {
    justify-content: stretch;
  }

  .preview-view__button {
    width: 100%;
  }
}
</style>
