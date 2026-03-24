import type {
  ProjectConfig,
  RemoteDirectoryEntry,
  ReportletEntry,
  SyncProtocol
} from '../../lib/types/project-config'
import { FIXED_REMOTE_RUNTIME_DIR } from '../../lib/types/project-config'

const ALLOWED_PROTOCOLS = new Set<SyncProtocol>(['fine'])

export function createDefaultProjectConfig(): ProjectConfig {
  return {
    style: { instructions: '' },
    workspace: { name: 'default', root_dir: '' },
    preview: {
      url: 'http://127.0.0.1:8075/webroot/decision',
      mode: 'embedded',
      account: '',
      password: ''
    },
    sync: {
      protocol: 'fine',
      designer_root: '',
      remote_runtime_dir: FIXED_REMOTE_RUNTIME_DIR,
      delete_propagation: false,
      auto_sync_on_change: true
    },
    ai: {
      provider: 'openai',
      model: 'gpt-5',
      api_key: ''
    },
    mappings: []
  }
}

export function validateConfig(config: ProjectConfig): string[] {
  const errors: string[] = []
  if (config.workspace.name.trim().length === 0) errors.push('项目名称不能为空')
  if (config.workspace.root_dir.trim().length === 0) errors.push('项目目录不能为空')
  if (!ALLOWED_PROTOCOLS.has(config.sync.protocol)) errors.push('同步协议仅支持 FineReport 远程设计')
  if (config.sync.designer_root.trim().length === 0) errors.push('本地设计器目录不能为空')
  if (config.preview.url.trim().length === 0) errors.push('预览地址不能为空')
  if (config.preview.account.trim().length === 0) errors.push('预览账号不能为空')
  if (config.preview.password.trim().length === 0) errors.push('预览密码不能为空')
  return errors
}

export function withProjectDir(config: ProjectConfig, projectDir: string): ProjectConfig {
  return { ...config, workspace: { ...config.workspace, root_dir: projectDir } }
}

export function createProjectHint(exists: boolean): string {
  return exists ? '已读取项目配置文件' : '未发现项目配置文件，请补全后保存到项目目录'
}

export function mergeConfig<T extends keyof ProjectConfig>(
  config: ProjectConfig,
  key: T,
  patch: Partial<ProjectConfig[T]>
): ProjectConfig {
  return { ...config, [key]: { ...config[key], ...patch } }
}

export function mergeRemoteDirectoryChildren(
  entries: RemoteDirectoryEntry[],
  targetPath: string,
  children: RemoteDirectoryEntry[]
): RemoteDirectoryEntry[] {
  if (entries.length === 0 || targetPath === '/') return children
  return entries.map((entry) => ({
    ...entry,
    children:
      entry.path === targetPath
        ? children
        : mergeRemoteDirectoryChildren(entry.children, targetPath, children)
  }))
}

export function initializeReportletEntries(entries: ReportletEntry[]): ReportletEntry[] {
  return entries.map((entry) => ({
    ...entry,
    loaded: entry.kind === 'file' || entry.children.length > 0,
    children: initializeReportletEntries(entry.children)
  }))
}

export function mergeReportletChildren(
  entries: ReportletEntry[],
  targetPath: string,
  children: ReportletEntry[]
): ReportletEntry[] {
  return entries.map((entry) => {
    if (entry.path === targetPath) {
      return {
        ...entry,
        loaded: true,
        children: initializeReportletEntries(children)
      }
    }
    return {
      ...entry,
      children: mergeReportletChildren(entry.children, targetPath, children)
    }
  })
}
