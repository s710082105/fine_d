import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('vite proxy config', () => {
  it('proxies api requests to the local backend service', () => {
    const configPath = resolve(import.meta.dirname, '../../vite.config.ts')
    const content = readFileSync(configPath, 'utf-8')

    expect(content).toContain("'/api'")
    expect(content).toContain("target: 'http://127.0.0.1:18081'")
    expect(content).toContain('changeOrigin: true')
  })
})
