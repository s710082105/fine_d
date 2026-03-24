import '@testing-library/jest-dom/vitest'
import { afterEach, expect, it, vi } from 'vitest'

import { ApiError, routeAssistantPrompt } from '../lib/api'

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
