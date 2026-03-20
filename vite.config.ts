import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const CHUNK_GROUPS = [
  {
    name: 'react-vendor',
    patterns: ['node_modules/react', 'node_modules/react-dom', 'node_modules/scheduler']
  },
  {
    name: 'xterm-vendor',
    patterns: ['node_modules/@xterm']
  },
  {
    name: 'tauri-vendor',
    patterns: ['node_modules/@tauri-apps']
  }
] as const

function resolveManualChunk(id: string): string | undefined {
  if (!id.includes('node_modules')) {
    return undefined
  }

  for (const chunkGroup of CHUNK_GROUPS) {
    if (chunkGroup.patterns.some((pattern) => id.includes(pattern))) {
      return chunkGroup.name
    }
  }

  return undefined
}

export default defineConfig({
  clearScreen: false,
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: resolveManualChunk
      }
    }
  },
  server: {
    port: 1420,
    strictPort: true
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: [
      './src/test/**/*.test.ts',
      './src/test/**/*.test.tsx',
      './src/test/**/*.spec.ts',
      './src/test/**/*.spec.tsx'
    ],
    setupFiles: ['./src/test/setup.ts']
  }
})
