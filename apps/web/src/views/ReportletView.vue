<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import { ApiError, listReportletTree, readReportletContent } from '../lib/api'
import type {
  ReportletFileResponse,
  ReportletTreeNodeResponse
} from '../lib/types'

const tree = ref<ReportletTreeNodeResponse[]>([])
const file = ref<ReportletFileResponse | null>(null)
const loadingTree = ref(false)
const loadingFile = ref(false)
const errorMessage = ref('')

const fileNodes = computed(() => flattenFileNodes(tree.value))

onMounted(async () => {
  loadingTree.value = true
  errorMessage.value = ''
  try {
    tree.value = await listReportletTree()
  } catch (error) {
    errorMessage.value = formatErrorMessage(error, 'Reportlet 列表加载失败')
  } finally {
    loadingTree.value = false
  }
})

async function handleSelectFile(path: string): Promise<void> {
  loadingFile.value = true
  errorMessage.value = ''
  file.value = null
  try {
    file.value = await readReportletContent(path)
  } catch (error) {
    errorMessage.value = formatErrorMessage(error, 'Reportlet 内容读取失败')
  } finally {
    loadingFile.value = false
  }
}

function formatErrorMessage(error: unknown, fallbackMessage: string): string {
  if (error instanceof ApiError) {
    return error.code ? `${error.code}: ${error.message}` : error.message
  }
  return error instanceof Error ? error.message : fallbackMessage
}

function flattenFileNodes(nodes: readonly ReportletTreeNodeResponse[]): string[] {
  return nodes.flatMap((node) => {
    if (node.kind === 'file') {
      return [node.path]
    }
    return flattenFileNodes(node.children)
  })
}
</script>

<template>
  <section class="reportlet-view">
    <header class="reportlet-view__header">
      <div>
        <h2>Reportlet</h2>
        <p>只读浏览模板文件树，并读取选中文件内容。</p>
      </div>
      <span class="reportlet-view__badge">Read Only</span>
    </header>

    <section class="reportlet-view__panel">
      <h3>文件列表</h3>
      <div v-if="loadingTree" class="reportlet-view__hint">加载中...</div>
      <div v-else class="reportlet-view__files">
        <button
          v-for="path in fileNodes"
          :key="path"
          class="reportlet-view__file"
          type="button"
          :disabled="loadingFile"
          @click="handleSelectFile(path)"
        >
          {{ path }}
        </button>
      </div>
    </section>

    <p v-if="errorMessage" class="reportlet-view__error" role="alert">
      {{ errorMessage }}
    </p>

    <section v-if="file" class="reportlet-view__panel">
      <h3>文件内容</h3>
      <dl class="reportlet-view__meta">
        <div>
          <dt>path</dt>
          <dd>{{ file.path }}</dd>
        </div>
        <div>
          <dt>encoding</dt>
          <dd>{{ file.encoding }}</dd>
        </div>
      </dl>
      <pre class="reportlet-view__content">{{ file.content }}</pre>
    </section>
  </section>
</template>

<style scoped>
.reportlet-view {
  display: grid;
  gap: 24px;
}

.reportlet-view__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.reportlet-view__header h2 {
  margin: 0 0 8px;
}

.reportlet-view__header p {
  margin: 0;
  color: #4c627c;
}

.reportlet-view__badge {
  padding: 6px 10px;
  border-radius: 999px;
  background: #eef3fb;
  color: #21466f;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.reportlet-view__panel {
  display: grid;
  gap: 16px;
  padding: 20px;
  border-radius: 20px;
  background: #f8fbff;
  box-shadow: inset 0 0 0 1px rgba(35, 65, 95, 0.08);
}

.reportlet-view__panel h3 {
  margin: 0;
}

.reportlet-view__hint {
  color: #5e738c;
}

.reportlet-view__files {
  display: grid;
  gap: 10px;
}

.reportlet-view__file {
  padding: 12px 14px;
  border: 1px solid #c8d4e3;
  border-radius: 14px;
  background: #fff;
  color: #102033;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.reportlet-view__file:disabled {
  opacity: 0.65;
  cursor: progress;
}

.reportlet-view__error {
  margin: 0;
  padding: 14px 16px;
  border-radius: 16px;
  background: #fff1f0;
  color: #a12d2d;
}

.reportlet-view__meta {
  display: grid;
  gap: 16px;
  margin: 0;
}

.reportlet-view__meta div {
  display: grid;
  gap: 6px;
}

.reportlet-view__meta dt {
  color: #5e738c;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.reportlet-view__meta dd {
  margin: 0;
  word-break: break-all;
}

.reportlet-view__content {
  margin: 0;
  padding: 14px 16px;
  border-radius: 16px;
  background: #fff;
  color: #102033;
  box-shadow: inset 0 0 0 1px rgba(35, 65, 95, 0.08);
  white-space: pre-wrap;
  word-break: break-word;
}

@media (max-width: 720px) {
  .reportlet-view__header {
    flex-direction: column;
  }
}
</style>
