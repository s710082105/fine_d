export type SectionId =
  | 'project'
  | 'datasource'
  | 'reportlet'
  | 'sync'
  | 'preview'
  | 'assistant'

export interface AppSection {
  readonly id: SectionId
  readonly label: string
  readonly summary: string
}

export interface HealthResponse {
  readonly status: 'ok'
}
