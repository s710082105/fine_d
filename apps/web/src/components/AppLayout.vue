<template>
  <div class="app-layout">
    <aside class="app-layout__sidebar">
      <slot name="sidebar" />
    </aside>
    <div class="app-layout__panel">
      <header class="app-layout__header">
        <slot name="header" />
      </header>
      <main class="app-layout__content">
        <slot />
      </main>
    </div>
  </div>
</template>

<style scoped>
.app-layout {
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr);
  min-height: 100vh;
}

.app-layout__sidebar {
  border-right: 1px solid #d6dfeb;
  background: linear-gradient(180deg, #142235 0%, #1d3350 100%);
}

.app-layout__panel {
  display: flex;
  min-width: 0;
  flex-direction: column;
}

.app-layout__header {
  border-bottom: 1px solid #d6dfeb;
  background: rgba(255, 255, 255, 0.94);
}

.app-layout__content {
  flex: 1;
  padding: 32px;
}

@media (max-width: 960px) {
  .app-layout {
    grid-template-columns: 1fr;
  }
}
</style>
