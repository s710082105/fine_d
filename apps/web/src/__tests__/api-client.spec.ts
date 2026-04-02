import '@testing-library/jest-dom/vitest'
import { afterEach, expect, it, vi } from 'vitest'

import {
  ApiError,
  routeAssistantPrompt,
  streamCodexTerminalSession
} from '../lib/api'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

it('surfaces structured backend errors from the api client', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 'assistant.invalid_prompt',
          message: 'assistant prompt must not be blank',
          detail: { prompt: '   ' },
          source: 'assistant',
          retryable: false
        }),
        {
          status: 400,
          statusText: 'Bad Request',
          headers: {
            'Content-Type': 'application/json'
          }
        }
      )
    )
  )

  await expect(routeAssistantPrompt('   ')).rejects.toMatchObject({
    name: 'ApiError',
    status: 400,
    code: 'assistant.invalid_prompt',
    message: 'assistant prompt must not be blank',
    detail: { prompt: '   ' },
    source: 'assistant',
    retryable: false
  })
})

it('streams codex terminal output through the polling endpoint', async () => {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        session_id: 'terminal-session-1',
        status: 'running',
        output: 'hello',
        next_cursor: 5,
        has_backlog: true,
        completed: false
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    )
  )

  vi.stubGlobal('fetch', fetchMock)

  await expect(
    streamCodexTerminalSession('terminal-session-1', 42)
  ).resolves.toMatchObject({
    output: 'hello',
    has_backlog: true,
    next_cursor: 5
  })
  expect(fetchMock).toHaveBeenCalledWith(
    '/api/codex/terminal/sessions/terminal-session-1/stream?cursor=42',
    expect.objectContaining({
      headers: expect.any(Headers)
    })
  )
})
