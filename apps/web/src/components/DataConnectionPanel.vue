<script setup lang="ts">
import type { DatasourceConnectionResponse } from '../lib/types'

defineProps<{
  connections: ReadonlyArray<DatasourceConnectionResponse>
}>()
</script>

<template>
  <section class="connection-panel">
    <header class="connection-panel__header">
      <h3>数据连接</h3>
      <p>展示远端配置中可用的数据连接。</p>
    </header>
    <p v-if="connections.length === 0" class="connection-panel__empty">暂无数据连接</p>
    <ul v-else class="connection-panel__list">
      <li
        v-for="connection in connections"
        :key="connection.name"
        class="connection-panel__item"
      >
        <strong>{{ connection.name }}</strong>
        <span>{{ connection.database_type || '未标注类型' }}</span>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.connection-panel {
  display: grid;
  gap: 16px;
  padding: 20px;
  border-radius: 20px;
  background: #f7fbff;
  box-shadow: inset 0 0 0 1px rgba(35, 65, 95, 0.08);
}

.connection-panel__header h3,
.connection-panel__header p,
.connection-panel__empty {
  margin: 0;
}

.connection-panel__header p,
.connection-panel__empty {
  color: #5e738c;
}

.connection-panel__list {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.connection-panel__item {
  display: grid;
  gap: 6px;
  padding: 10px 14px;
  border-radius: 14px;
  background: #ffffff;
  box-shadow: inset 0 0 0 1px rgba(35, 65, 95, 0.08);
}

.connection-panel__item span {
  color: #5e738c;
  font-size: 13px;
}
</style>
