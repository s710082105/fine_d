import type {
  ProjectConfig,
  RemoteDirectoryEntry,
  SyncProtocol
} from '../../lib/types/project-config'

const ALLOWED_PROTOCOLS = new Set<SyncProtocol>(['sftp', 'ftp', 'local'])
const REMOTE_PROTOCOLS = new Set<SyncProtocol>(['sftp', 'ftp'])

export function createDefaultProjectConfig(): ProjectConfig {
  return {
    style: { instructions: '' },
    workspace: { name: 'default', root_dir: '' },
    data_connections: [],
    preview: {
      url: 'http://127.0.0.1:8075/webroot/decision',
      mode: 'embedded',
      account: '',
      password: ''
    },
    sync: {
      protocol: 'sftp',
      host: '',
      port: 22,
      username: '',
      password: '',
      remote_runtime_dir: '',
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
  if (!ALLOWED_PROTOCOLS.has(config.sync.protocol)) errors.push('同步协议仅支持 SFTP、FTP 或本地')
  if (config.sync.remote_runtime_dir.trim().length === 0) errors.push('运行目录不能为空')
  if (config.preview.url.trim().length === 0) errors.push('预览地址不能为空')
  if (!REMOTE_PROTOCOLS.has(config.sync.protocol)) return errors
  if (config.sync.host.trim().length === 0) errors.push('同步主机不能为空')
  if (config.sync.port <= 0) errors.push('同步端口必须大于 0')
  if (config.sync.username.trim().length === 0) errors.push('同步用户名不能为空')
  if (config.sync.password.trim().length === 0) errors.push('同步密码不能为空')
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
