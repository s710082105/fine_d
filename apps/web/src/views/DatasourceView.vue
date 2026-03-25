<script setup lang="ts">
import { onMounted, ref } from 'vue'

import {
  ApiError,
  listDatasourceConnections,
  previewDatasourceSql
} from '../lib/api'
import type {
  DatasourceConnectionResponse,
  DatasourceSqlPreviewResponse
} from '../lib/types'

const connections = ref<DatasourceConnectionResponse[]>([])
const selectedConnection = ref('')
const sql = ref('select 1 as ok')
const preview = ref<DatasourceSqlPreviewResponse | null>(null)
const loadingConnections = ref(false)
const previewing = ref(false)
const errorMessage = ref('')

onMounted(async () => {
  loadingConnections.value = true
  errorMessage.value = ''
  try {
    const items = await listDatasourceConnections()
    connections.value = items
    if (!selectedConnection.value && items[0]) {
      selectedConnection.value = items[0].name
    }
  } catch (error) {
    errorMessage.value = formatErrorMessage(error, 'Datasource 列表加载失败')
  } finally {
    loadingConnections.value = false
  }
})

async function handlePreview(): Promise<void> {
  previewing.value = true
  errorMessage.value = ''
  preview.value = null
  try {
    preview.value = await previewDatasourceSql(selectedConnection.value, sql.value)
  } catch (error) {
    errorMessage.value = formatErrorMessage(error, 'SQL 预览失败')
  } finally {
    previewing.value = false
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
  <section class="datasource-view">
    <header class="datasource-view__header">
      <div>
        <h2>Datasource</h2>
        <p>只读查看连接列表，并做最小 SQL 预览。</p>
      </div>
      <span class="datasource-view__badge">Read Only</span>
    </header>

    <section class="datasource-view__panel">
      <h3>连接与 SQL 预览</h3>

      <label class="datasource-view__label" for="datasource-connection">连接</label>
      <select
        id="datasource-connection"
        v-model="selectedConnection"
        class="datasource-view__select"
        :disabled="loadingConnections || previewing"
      >
        <option
          v-for="connection in connections"
          :key="connection.name"
          :value="connection.name"
        >
          {{ connection.name }}
        </option>
      </select>

      <label class="datasource-view__label" for="datasource-sql">SQL 语句</label>
      <textarea
        id="datasource-sql"
        v-model="sql"
        class="datasource-view__textarea"
        rows="6"
      />

      <div class="datasource-view__actions">
        <button
          class="datasource-view__button"
          type="button"
          :disabled="loadingConnections || previewing || !selectedConnection"
          @click="handlePreview"
        >
          {{ previewing ? '预览中...' : '预览 SQL' }}
        </button>
      </div>
    </section>

    <p v-if="errorMessage" class="datasource-view__error" role="alert">
      {{ errorMessage }}
    </p>

    <section v-if="preview" class="datasource-view__panel">
      <h3>预览结果</h3>

      <table class="datasource-view__table">
        <thead>
          <tr>
            <th v-for="column in preview.columns" :key="column">{{ column }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, rowIndex) in preview.rows" :key="rowIndex">
            <td v-for="(cell, cellIndex) in row" :key="`${rowIndex}-${cellIndex}`">
              {{ cell }}
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  </section>
</template>

<style scoped>
.datasource-view {
  display: grid;
  gap: 24px;
}

.datasource-view__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.datasource-view__header h2 {
  margin: 0 0 8px;
}

.datasource-view__header p {
  margin: 0;
  color: #4c627c;
}

.datasource-view__badge {
  padding: 6px 10px;
  border-radius: 999px;
  background: #eaf1fb;
  color: #21466f;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.datasource-view__panel {
  display: grid;
  gap: 16px;
  padding: 20px;
  border-radius: 20px;
  background: #f8fbff;
  box-shadow: inset 0 0 0 1px rgba(35, 65, 95, 0.08);
}

.datasource-view__panel h3 {
  margin: 0;
}

.datasource-view__label {
  font-size: 14px;
  font-weight: 600;
}

.datasource-view__select,
.datasource-view__textarea {
  width: 100%;
  padding: 14px 16px;
  border: 1px solid #c8d4e3;
  border-radius: 16px;
  font: inherit;
  color: #102033;
  background: #fff;
  box-sizing: border-box;
}

.datasource-view__textarea {
  resize: vertical;
}

.datasource-view__select:focus,
.datasource-view__textarea:focus {
  outline: 2px solid rgba(50, 107, 184, 0.2);
  border-color: #326bb8;
}

.datasource-view__actions {
  display: flex;
  justify-content: flex-end;
}

.datasource-view__button {
  padding: 10px 18px;
  border: none;
  border-radius: 999px;
  background: linear-gradient(135deg, #326bb8, #21466f);
  color: #fff;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}

.datasource-view__button:disabled {
  opacity: 0.65;
  cursor: progress;
}

.datasource-view__error {
  margin: 0;
  padding: 14px 16px;
  border-radius: 16px;
  background: #fff1f0;
  color: #a12d2d;
}

.datasource-view__table {
  width: 100%;
  border-collapse: collapse;
}

.datasource-view__table th,
.datasource-view__table td {
  padding: 12px 14px;
  border-bottom: 1px solid #d7e2ef;
  text-align: left;
}

.datasource-view__table th {
  color: #23415f;
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

@media (max-width: 720px) {
  .datasource-view__header {
    flex-direction: column;
  }

  .datasource-view__actions {
    justify-content: stretch;
  }

  .datasource-view__button {
    width: 100%;
  }
}
</style>
