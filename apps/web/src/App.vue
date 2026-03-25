<script setup lang="ts">
import { computed, ref, type Component } from 'vue'

import AppLayout from './components/AppLayout.vue'
import SideNav from './components/SideNav.vue'
import type { AppSection, SectionId } from './lib/types'
import AssistantView from './views/AssistantView.vue'
import DatasourceView from './views/DatasourceView.vue'
import PreviewView from './views/PreviewView.vue'
import ProjectView from './views/ProjectView.vue'
import ReportletView from './views/ReportletView.vue'
import SyncView from './views/SyncView.vue'

const sections: ReadonlyArray<AppSection> = [
  {
    id: 'project',
    label: 'Project',
    summary: '查看当前工程、诊断结果与运行环境。'
  },
  {
    id: 'datasource',
    label: 'Datasource',
    summary: '查看连接列表，并执行最小 SQL 预览。'
  },
  {
    id: 'reportlet',
    label: 'Reportlet',
    summary: '浏览报表文件树，并读取选中文件内容。'
  },
  {
    id: 'sync',
    label: 'Sync',
    summary: '手动执行单次同步动作，并查看返回结果。'
  },
  {
    id: 'preview',
    label: 'Preview',
    summary: '输入预览地址，调用后端打开并返回会话信息。'
  },
  {
    id: 'assistant',
    label: 'Assistant',
    summary: '分析自然语言任务，并推荐应走的正式模块。'
  }
]

const sectionViews: Record<SectionId, Component> = {
  project: ProjectView,
  datasource: DatasourceView,
  reportlet: ReportletView,
  sync: SyncView,
  preview: PreviewView,
  assistant: AssistantView
}

const activeSection = ref<SectionId>('project')

const currentSection = computed(() => {
  return sections.find((section) => section.id === activeSection.value) ?? sections[0]
})

const currentView = computed(() => sectionViews[activeSection.value])

function handleSectionSelect(sectionId: SectionId): void {
  activeSection.value = sectionId
}
</script>

<template>
  <AppLayout>
    <template #sidebar>
      <SideNav
        :sections="sections"
        :active-section="activeSection"
        @select="handleSectionSelect"
      />
    </template>
    <template #header>
      <div class="app-shell__header">
        <div>
          <p class="app-shell__eyebrow">Workspace Shell</p>
          <h1>FineReport Local Tool</h1>
        </div>
        <p class="app-shell__summary">{{ currentSection.summary }}</p>
      </div>
    </template>
    <component :is="currentView" class="app-shell__view" />
  </AppLayout>
</template>

<style scoped>
.app-shell__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 24px 32px;
}

.app-shell__eyebrow {
  margin: 0 0 6px;
  font-size: 12px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #5e738c;
}

h1 {
  margin: 0;
  font-size: 28px;
}

.app-shell__summary {
  max-width: 360px;
  margin: 0;
  color: #4c627c;
}

.app-shell__view {
  border-radius: 24px;
  padding: 32px;
  background: rgba(255, 255, 255, 0.88);
  box-shadow: 0 20px 45px rgba(16, 32, 51, 0.08);
}

@media (max-width: 960px) {
  .app-shell__header {
    flex-direction: column;
    align-items: flex-start;
    padding: 20px 24px;
  }

  .app-shell__summary {
    max-width: none;
  }
}
</style>
