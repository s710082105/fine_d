import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, expect, it, vi } from 'vitest'

// @ts-ignore vitest imports the embedded runtime helper directly from .mjs
import { resolveChromeWsUrl, wsUrlToPortFileContent } from '../../embedded/skills/chrome-cdp/scripts/ws-url.mjs'

const tempDirs: string[] = []

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop()
    if (dir) {
      rmSync(dir, { recursive: true, force: true })
    }
  }
})

it('falls back to json/version and writes a synthetic DevToolsActivePort file', async () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'cdp-port-file-'))
  tempDirs.push(tempDir)
  const fallbackPortFile = join(tempDir, 'DevToolsActivePort')
  const fetchImpl = vi.fn(async () => ({
    ok: true,
    json: async () => ({
      webSocketDebuggerUrl: 'ws://127.0.0.1:9222/devtools/browser/browser-target'
    })
  }))

  const wsUrl = await resolveChromeWsUrl({
    candidates: [],
    fallbackPortFile,
    fetchImpl,
    host: '127.0.0.1'
  })

  expect(wsUrl).toBe('ws://127.0.0.1:9222/devtools/browser/browser-target')
  expect(fetchImpl).toHaveBeenCalledWith('http://127.0.0.1:9222/json/version')
  expect(readFileSync(fallbackPortFile, 'utf8')).toBe(
    '9222\n/devtools/browser/browser-target\n'
  )
})

it('prefers an existing DevToolsActivePort file over json/version fallback', async () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'cdp-existing-port-file-'))
  tempDirs.push(tempDir)
  const existingPortFile = join(tempDir, 'DevToolsActivePort')
  const fetchImpl = vi.fn()

  writeFileSync(
    existingPortFile,
    wsUrlToPortFileContent('ws://127.0.0.1:9333/devtools/browser/existing-target'),
    'utf8'
  )

  const wsUrl = await resolveChromeWsUrl({
    candidates: [existingPortFile],
    fallbackPortFile: join(tempDir, 'generated-port-file'),
    fetchImpl,
    host: '127.0.0.1'
  })

  expect(wsUrl).toBe('ws://127.0.0.1:9333/devtools/browser/existing-target')
  expect(fetchImpl).not.toHaveBeenCalled()
})
