<script setup lang="ts">
import { onMounted, ref } from 'vue'

import { ApiError, getProjectConfig } from '../lib/api'
import type { ProjectConfigResponse } from '../lib/types'

const config = ref<ProjectConfigResponse | null>(null)
const errorMessage = ref('')

onMounted(async () => {
  try {
    config.value = await getProjectConfig()
  } catch (error) {
    if (error instanceof ApiError) {
      errorMessage.value = error.code ? `${error.code}: ${error.message}` : error.message
      return
    }
    errorMessage.value = error instanceof Error ? error.message : 'Project 配置加载失败'
  }
})
</script>

<template>
  <section class="project-view">
    <header class="project-view__header">
      <div>
        <h2>Project</h2>
        <p>展示当前工程的只读目录配置。</p>
      </div>
      <span class="project-view__badge">Read Only</span>
    </header>

    <p v-if="errorMessage" class="project-view__error" role="alert">
      {{ errorMessage }}
    </p>

    <section v-else-if="config" class="project-view__panel">
      <h3>目录配置</h3>
      <dl class="project-view__meta">
        <div>
          <dt>workspace_dir</dt>
          <dd>{{ config.workspace_dir }}</dd>
        </div>
        <div>
          <dt>generated_dir</dt>
          <dd>{{ config.generated_dir }}</dd>
        </div>
      </dl>
    </section>
  </section>
</template>

<style scoped>
.project-view {
  display: grid;
  gap: 24px;
}

.project-view__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.project-view__header h2 {
  margin: 0 0 8px;
}

.project-view__header p {
  margin: 0;
  color: #4c627c;
}

.project-view__badge {
  padding: 6px 10px;
  border-radius: 999px;
  background: #ebf4ea;
  color: #275539;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.project-view__panel {
  display: grid;
  gap: 16px;
  padding: 20px;
  border-radius: 20px;
  background: #f8fbff;
  box-shadow: inset 0 0 0 1px rgba(35, 65, 95, 0.08);
}

.project-view__panel h3 {
  margin: 0;
}

.project-view__meta {
  display: grid;
  gap: 16px;
  margin: 0;
}

.project-view__meta div {
  display: grid;
  gap: 6px;
}

.project-view__meta dt {
  color: #5e738c;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.project-view__meta dd {
  margin: 0;
  word-break: break-all;
}

.project-view__error {
  margin: 0;
  padding: 14px 16px;
  border-radius: 16px;
  background: #fff1f0;
  color: #a12d2d;
}

@media (max-width: 720px) {
  .project-view__header {
    flex-direction: column;
  }
}
</style>
