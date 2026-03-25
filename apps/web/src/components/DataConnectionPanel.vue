<script setup lang="ts">
import { ElEmpty, ElTag } from 'element-plus'

import type { DatasourceConnectionResponse } from '../lib/types'

defineProps<{
  connections: ReadonlyArray<DatasourceConnectionResponse>
}>()
</script>

<template>
  <section class="connection-panel">
    <header class="connection-panel__header">
      <div>
        <h3>数据连接</h3>
        <p>仅展示连接名称和数据库类型。</p>
      </div>
    </header>
    <ElEmpty v-if="connections.length === 0" description="暂无数据连接" />
    <ul v-else class="connection-panel__list">
      <li
        v-for="connection in connections"
        :key="connection.name"
        class="connection-panel__item"
      >
        <strong>{{ connection.name }}</strong>
        <ElTag size="small" effect="plain" type="success">
          {{ connection.database_type || '未标注类型' }}
        </ElTag>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.connection-panel {
  display: grid;
  gap: 16px;
}

.connection-panel__header h3,
.connection-panel__header p {
  margin: 0;
}

.connection-panel__header p {
  color: #61758a;
}

.connection-panel__list {
  display: grid;
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.connection-panel__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
  border: 1px solid #d8e1ef;
  border-radius: 16px;
  background: #f8fbff;
}

@media (max-width: 720px) {
  .connection-panel__item {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
