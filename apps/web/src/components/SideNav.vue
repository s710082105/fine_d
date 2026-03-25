<script setup lang="ts">
import type { AppSection, SectionId } from '../lib/types'

defineProps<{
  sections: ReadonlyArray<AppSection>
  activeSection: SectionId
}>()

const emit = defineEmits<{
  select: [sectionId: SectionId]
}>()

function handleSelect(sectionId: SectionId): void {
  emit('select', sectionId)
}
</script>

<template>
  <nav class="side-nav" aria-label="主导航">
    <div class="side-nav__brand">
      <span class="side-nav__eyebrow">FineReport</span>
      <strong>本地工作台</strong>
    </div>
    <ul class="side-nav__list">
      <li v-for="section in sections" :key="section.id">
        <button
          class="side-nav__button"
          type="button"
          :aria-current="section.id === activeSection ? 'page' : undefined"
          @click="handleSelect(section.id)"
        >
          {{ section.label }}
        </button>
      </li>
    </ul>
  </nav>
</template>

<style scoped>
.side-nav {
  display: flex;
  min-height: 100%;
  flex-direction: column;
  gap: 24px;
  padding: 24px 18px;
  color: #f7fbff;
}

.side-nav__brand {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.side-nav__eyebrow {
  font-size: 12px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  opacity: 0.7;
}

.side-nav__list {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.side-nav__button {
  width: 100%;
  border: 0;
  border-radius: 12px;
  padding: 12px 14px;
  color: inherit;
  background: transparent;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.side-nav__button[aria-current='page'] {
  background: rgba(255, 255, 255, 0.16);
}

.side-nav__button:hover {
  background: rgba(255, 255, 255, 0.1);
}
</style>
