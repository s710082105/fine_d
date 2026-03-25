import type {
  AssistantRouteResponse,
  DatasourceConnectionResponse,
  DatasourceSqlPreviewResponse,
  HealthResponse,
  PreviewSessionResponse,
  ReportletFileResponse,
  ReportletTreeNodeResponse,
  SyncAction,
  SyncResultResponse,
  ProjectConfigResponse
} from './types'

const API_PREFIX = '/api'

interface ApiErrorPayload {
  code?: string
  message?: string
  detail?: unknown
  source?: string
  retryable?: boolean
}

export class ApiError extends Error {
  readonly status: number
  readonly code?: string
  readonly detail?: unknown
  readonly source?: string
  readonly retryable?: boolean

  constructor(status: number, payload: ApiErrorPayload, fallbackMessage: string) {
    super(payload.message ?? fallbackMessage)
    this.name = 'ApiError'
    this.status = status
    this.code = payload.code
    this.detail = payload.detail
    this.source = payload.source
    this.retryable = payload.retryable
  }
}

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
    throw await buildApiError(response)
  }

  return (await response.json()) as T
}

export function getHealth(): Promise<HealthResponse> {
  return apiRequest<HealthResponse>('/health')
}

export function getProjectConfig(): Promise<ProjectConfigResponse> {
  return apiRequest<ProjectConfigResponse>('/project/config')
}

export function listDatasourceConnections(): Promise<DatasourceConnectionResponse[]> {
  return apiRequest<DatasourceConnectionResponse[]>('/datasource/connections')
}

export function previewDatasourceSql(
  connectionName: string,
  sql: string
): Promise<DatasourceSqlPreviewResponse> {
  return apiRequest<DatasourceSqlPreviewResponse>('/datasource/preview-sql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      connection_name: connectionName,
      sql
    })
  })
}

export function openPreview(url: string): Promise<PreviewSessionResponse> {
  return apiRequest<PreviewSessionResponse>('/preview/open', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ url })
  })
}

export function listReportletTree(): Promise<ReportletTreeNodeResponse[]> {
  return apiRequest<ReportletTreeNodeResponse[]>('/reportlets/tree')
}

export function readReportletContent(path: string): Promise<ReportletFileResponse> {
  const query = new URLSearchParams({ path }).toString()
  return apiRequest<ReportletFileResponse>(`/reportlets/content?${query}`)
}

export function runSyncAction(
  action: SyncAction,
  targetPath?: string
): Promise<SyncResultResponse> {
  const body: { action: SyncAction; target_path?: string } = { action }
  if (targetPath) {
    body.target_path = targetPath
  }
  return apiRequest<SyncResultResponse>('/sync/actions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  })
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

async function buildApiError(response: Response): Promise<Error> {
  const fallbackMessage = `API request failed: ${response.status} ${response.statusText}`.trim()
  const payload = await parseErrorPayload(response)
  if (!payload) {
    return new Error(fallbackMessage)
  }
  return new ApiError(response.status, payload, fallbackMessage)
}

async function parseErrorPayload(response: Response): Promise<ApiErrorPayload | null> {
  const body = await response.text()
  if (!body.trim()) {
    return null
  }
  try {
    const payload = JSON.parse(body) as ApiErrorPayload
    if (typeof payload.message === 'string') {
      return payload
    }
  } catch {
    return null
  }
  return null
}
