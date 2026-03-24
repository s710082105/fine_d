import type { AssistantRouteResponse, HealthResponse } from './types'

const API_PREFIX = '/api'

function createHeaders(init?: RequestInit): Headers {
  const headers = new Headers(init?.headers)
  headers.set('Accept', 'application/json')
  return headers
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_PREFIX}${path}`, {
    ...init,
    headers: createHeaders(init)
  })

  if (!response.ok) {
    throw new Error(
      `API request failed: ${response.status} ${response.statusText}`.trim()
    )
  }

  return (await response.json()) as T
}

export function getHealth(): Promise<HealthResponse> {
  return apiRequest<HealthResponse>('/health')
}

export function routeAssistantPrompt(
  prompt: string
): Promise<AssistantRouteResponse> {
  return apiRequest<AssistantRouteResponse>('/assistant/route', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ prompt })
  })
}
