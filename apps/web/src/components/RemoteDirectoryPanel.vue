<script setup lang="ts">
import type { RemoteDirectoryEntryResponse } from '../lib/types'

defineProps<{
  entries: ReadonlyArray<RemoteDirectoryEntryResponse>
}>()
</script>

<template>
  <section class="remote-panel">
    <header class="remote-panel__header">
      <h3>远程目录</h3>
      <p>展示当前远程参数拉取到的目录项。</p>
    </header>
    <p v-if="entries.length === 0" class="remote-panel__empty">暂无远程目录数据</p>
    <ul v-else class="remote-panel__list">
      <li v-for="entry in entries" :key="entry.path" class="remote-panel__item">
        <div>
          <strong>{{ entry.path }}</strong>
          <p>{{ entry.is_directory ? '目录' : '文件' }}</p>
        </div>
        <span v-if="entry.lock" class="remote-panel__lock">{{ entry.lock }}</span>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.remote-panel {
  display: grid;
  gap: 16px;
  padding: 20px;
  border-radius: 20px;
  background: #f7fbff;
  box-shadow: inset 0 0 0 1px rgba(35, 65, 95, 0.08);
}

.remote-panel__header,
.remote-panel__item {
  display: flex;
  justify-content: space-between;
  gap: 16px;
}

.remote-panel__header {
  align-items: flex-start;
}

.remote-panel__header h3,
.remote-panel__header p,
.remote-panel__item p,
.remote-panel__empty {
  margin: 0;
}

.remote-panel__header p,
.remote-panel__item p,
.remote-panel__empty {
  color: #5e738c;
}

.remote-panel__list {
  display: grid;
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.remote-panel__item {
  align-items: center;
  padding: 14px 16px;
  border-radius: 16px;
  background: #ffffff;
}

.remote-panel__lock {
  padding: 6px 10px;
  border-radius: 999px;
  background: #fff4dd;
  color: #8a5a00;
  font-size: 12px;
}
</style>
