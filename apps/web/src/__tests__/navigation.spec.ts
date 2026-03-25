import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen } from '@testing-library/vue'
import { afterEach, expect, it, vi } from 'vitest'

import App from '../App.vue'

const SECTION_LABELS = ['项目与远程概览', 'Codex']

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

it('renders the top-level navigation and switches sections', async () => {
  render(App)

  for (const label of SECTION_LABELS) {
    expect(screen.getByRole('button', { name: label })).toBeInTheDocument()
  }

  expect(
    screen.getByRole('heading', { level: 2, name: '项目与远程工作台' })
  ).toBeInTheDocument()

  await fireEvent.click(screen.getByRole('button', { name: 'Codex' }))

  expect(
    screen.getByRole('heading', { level: 2, name: 'Codex' })
  ).toBeInTheDocument()
})

it('calls the health endpoint through the unified api client', async () => {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ status: 'ok' }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    })
  )
  vi.stubGlobal('fetch', fetchMock)

  const modulePath = '../lib/api'
  const { getHealth } = await import(/* @vite-ignore */ modulePath)
  const result = await getHealth()

  expect(result).toEqual({ status: 'ok' })
  expect(fetchMock).toHaveBeenCalledTimes(1)
  expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/health')
})
