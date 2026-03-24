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
    summary: '统一承载数据源读取与连接配置。'
  },
  {
    id: 'reportlet',
    label: 'Reportlet',
    summary: '汇总报表模板、生成结果与编辑入口。'
  },
  {
    id: 'sync',
    label: 'Sync',
    summary: '展示同步状态，并作为后续远端同步入口。'
  },
  {
    id: 'preview',
    label: 'Preview',
    summary: '为报表预览和结果查看预留稳定区域。'
  },
  {
    id: 'assistant',
    label: 'Assistant',
    summary: '为后续内嵌助手面板保留统一入口。'
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
