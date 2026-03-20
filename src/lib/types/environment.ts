export interface RuntimePrerequisiteItem {
  key: string
  label: string
  status: 'ready' | 'blocked'
  blocking: boolean
  message: string
  fixHint: string
  detectedVersion: string
  scriptPath: string
}

export interface RuntimePrerequisiteReport {
  ready: boolean
  items: RuntimePrerequisiteItem[]
}
