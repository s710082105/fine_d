<script setup lang="ts">
import { ref } from 'vue'

import { ApiError, routeAssistantPrompt } from '../lib/api'
import type { AssistantRouteResponse } from '../lib/types'

const prompt = ref('')
const loading = ref(false)
const result = ref<AssistantRouteResponse | null>(null)
const errorMessage = ref('')
const errorDetail = ref('')

async function handleSubmit(): Promise<void> {
  loading.value = true
  errorMessage.value = ''
  errorDetail.value = ''
  result.value = null
  try {
    result.value = await routeAssistantPrompt(prompt.value)
  } catch (error) {
    if (error instanceof ApiError) {
      errorMessage.value = error.code
        ? `${error.code}: ${error.message}`
        : error.message
      errorDetail.value = formatErrorDetail(error.detail)
    } else {
      errorMessage.value =
        error instanceof Error ? error.message : 'Assistant 请求失败'
    }
  } finally {
    loading.value = false
  }
}

function formatErrorDetail(detail: unknown): string {
  if (!detail) {
    return ''
  }
  return JSON.stringify(detail, null, 2)
}
</script>

<template>
  <section class="assistant-view">
    <header class="assistant-view__header">
      <div>
        <h2>Assistant</h2>
        <p>输入自然语言任务，先看系统建议走哪个正式模块。</p>
      </div>
      <span class="assistant-view__badge">Route Only</span>
    </header>

    <form class="assistant-view__form" @submit.prevent="handleSubmit">
      <label class="assistant-view__label" for="assistant-prompt">任务描述</label>
      <textarea
        id="assistant-prompt"
        v-model="prompt"
        class="assistant-view__textarea"
        rows="5"
        placeholder="例如：请帮我同步并发布到远端"
      />
      <div class="assistant-view__actions">
        <button class="assistant-view__button" type="submit" :disabled="loading">
          {{ loading ? '分析中...' : '分析任务' }}
        </button>
      </div>
    </form>

    <p v-if="errorMessage" class="assistant-view__error" role="alert">
      {{ errorMessage }}
    </p>
    <pre v-if="errorDetail" class="assistant-view__error-detail">{{ errorDetail }}</pre>

    <section v-if="result" class="assistant-view__result">
      <h3>推荐模块</h3>
      <p class="assistant-view__module">{{ result.module }}</p>
      <p class="assistant-view__message">{{ result.message }}</p>
      <dl class="assistant-view__meta">
        <div>
          <dt>状态</dt>
          <dd>{{ result.status }}</dd>
        </div>
        <div>
          <dt>原始任务</dt>
          <dd>{{ result.prompt }}</dd>
        </div>
      </dl>
      <div class="assistant-view__chips">
        <span
          v-for="action in result.actions"
          :key="action"
          class="assistant-view__chip"
        >
          {{ action }}
        </span>
      </div>
    </section>
  </section>
</template>

<style scoped>
.assistant-view {
  display: grid;
  gap: 24px;
}

.assistant-view__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.assistant-view__header h2 {
  margin: 0 0 8px;
}

.assistant-view__header p {
  margin: 0;
  color: #4c627c;
}

.assistant-view__badge {
  padding: 6px 10px;
  border-radius: 999px;
  background: #e7eef8;
  color: #23415f;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.assistant-view__form,
.assistant-view__result {
  display: grid;
  gap: 16px;
  padding: 20px;
  border-radius: 20px;
  background: #f8fbff;
  box-shadow: inset 0 0 0 1px rgba(35, 65, 95, 0.08);
}

.assistant-view__label {
  font-size: 14px;
  font-weight: 600;
}

.assistant-view__textarea {
  width: 100%;
  min-height: 140px;
  padding: 14px 16px;
  border: 1px solid #c8d4e3;
  border-radius: 16px;
  font: inherit;
  color: #102033;
  background: #fff;
  resize: vertical;
  box-sizing: border-box;
}

.assistant-view__textarea:focus {
  outline: 2px solid rgba(50, 107, 184, 0.2);
  border-color: #326bb8;
}

.assistant-view__actions {
  display: flex;
  justify-content: flex-end;
}

.assistant-view__button {
  padding: 10px 18px;
  border: none;
  border-radius: 999px;
  background: linear-gradient(135deg, #326bb8, #21466f);
  color: #fff;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}

.assistant-view__button:disabled {
  opacity: 0.65;
  cursor: progress;
}

.assistant-view__error {
  margin: 0;
  padding: 14px 16px;
  border-radius: 16px;
  background: #fff1f0;
  color: #a12d2d;
}

.assistant-view__error-detail {
  margin: 0;
  padding: 14px 16px;
  border-radius: 16px;
  background: #fff;
  color: #7d2430;
  box-shadow: inset 0 0 0 1px rgba(161, 45, 45, 0.12);
  font-size: 13px;
  white-space: pre-wrap;
}

.assistant-view__result h3 {
  margin: 0;
}

.assistant-view__module {
  margin: 0;
  font-size: 28px;
  font-weight: 700;
  text-transform: lowercase;
}

.assistant-view__message {
  margin: 0;
  color: #4c627c;
}

.assistant-view__meta {
  display: grid;
  gap: 12px;
  margin: 0;
}

.assistant-view__meta div {
  display: grid;
  gap: 4px;
}

.assistant-view__meta dt {
  color: #5e738c;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.assistant-view__meta dd {
  margin: 0;
}

.assistant-view__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.assistant-view__chip {
  padding: 8px 12px;
  border-radius: 999px;
  background: #e3eefb;
  color: #21466f;
  font-size: 13px;
  font-weight: 600;
}

@media (max-width: 720px) {
  .assistant-view__header {
    flex-direction: column;
  }

  .assistant-view__actions {
    justify-content: stretch;
  }

  .assistant-view__button {
    width: 100%;
  }
}
</style>
