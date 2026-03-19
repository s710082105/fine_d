import {
  AiProfile,
  PreviewProfile,
  ProjectConfig,
  StyleProfile,
  SyncProfile,
  SyncProtocol,
  WorkspaceProfile
} from '../../lib/types/project-config'

interface ProjectFieldProps {
  config: ProjectConfig
  chooseRuntimeDir: () => void
  updateWorkspace: (patch: Partial<WorkspaceProfile>) => void
  updateSync: (patch: Partial<SyncProfile>) => void
  updatePreview: (patch: Partial<PreviewProfile>) => void
  updateAi: (patch: Partial<AiProfile>) => void
}

interface StyleFieldProps {
  config: ProjectConfig
  updateStyle: (patch: Partial<StyleProfile>) => void
}

const REMOTE_PROTOCOLS: SyncProtocol[] = ['sftp', 'ftp']

function toNumber(value: string): number {
  return Number(value) || 0
}

function isRemoteProtocol(protocol: SyncProtocol): boolean {
  return REMOTE_PROTOCOLS.includes(protocol)
}

function runtimeDirLabel(protocol: SyncProtocol): string {
  return protocol === 'local' ? '运行目录' : '远端运行目录'
}

function ProjectIdentityFields({
  name,
  updateWorkspace
}: {
  name: string
  updateWorkspace: (patch: Partial<WorkspaceProfile>) => void
}) {
  return (
    <label>
      项目名称
      <input
        type="text"
        value={name}
        onChange={(event) => updateWorkspace({ name: event.target.value })}
      />
    </label>
  )
}

function SyncFields({
  config,
  chooseRuntimeDir,
  updateSync
}: {
  config: ProjectConfig
  chooseRuntimeDir: () => void
  updateSync: (patch: Partial<SyncProfile>) => void
}) {
  const remoteProtocol = isRemoteProtocol(config.sync.protocol)

  return (
    <>
      <label>
        同步协议
        <select
          value={config.sync.protocol}
          onChange={(event) =>
            updateSync({ protocol: event.target.value as SyncProtocol })
          }
        >
          <option value="sftp">SFTP</option>
          <option value="ftp">FTP</option>
          <option value="local">本地</option>
        </select>
      </label>
      {remoteProtocol ? (
        <>
          <label>
            同步主机
            <input
              type="text"
              value={config.sync.host}
              onChange={(event) => updateSync({ host: event.target.value })}
            />
          </label>
          <label>
            同步端口
            <input
              type="number"
              value={config.sync.port}
              onChange={(event) => updateSync({ port: toNumber(event.target.value) })}
            />
          </label>
          <label>
            同步用户名
            <input
              type="text"
              value={config.sync.username}
              onChange={(event) => updateSync({ username: event.target.value })}
            />
          </label>
        </>
      ) : null}
      <RuntimeDirField
        protocol={config.sync.protocol}
        runtimeDir={config.sync.remote_runtime_dir}
        chooseRuntimeDir={chooseRuntimeDir}
        updateSync={updateSync}
      />
      <label className="checkbox-field">
        <input
          type="checkbox"
          checked={config.sync.delete_propagation}
          onChange={(event) => updateSync({ delete_propagation: event.target.checked })}
        />
        同步删除
      </label>
      <label className="checkbox-field">
        <input
          type="checkbox"
          checked={config.sync.auto_sync_on_change}
          onChange={(event) => updateSync({ auto_sync_on_change: event.target.checked })}
        />
        文件变更后自动同步
      </label>
    </>
  )
}

function RuntimeDirField({
  protocol,
  runtimeDir,
  chooseRuntimeDir,
  updateSync
}: {
  protocol: SyncProtocol
  runtimeDir: string
  chooseRuntimeDir: () => void
  updateSync: (patch: Partial<SyncProfile>) => void
}) {
  const label = runtimeDirLabel(protocol)

  if (protocol === 'local') {
    return (
      <label>
        {label}
        <div className="directory-picker">
          <input type="text" value={runtimeDir} readOnly />
          <button type="button" onClick={chooseRuntimeDir}>
            选择运行目录
          </button>
        </div>
      </label>
    )
  }

  return (
    <label>
      {label}
      <input
        type="text"
        value={runtimeDir}
        onChange={(event) => updateSync({ remote_runtime_dir: event.target.value })}
      />
    </label>
  )
}

function PreviewFields({
  preview,
  updatePreview
}: {
  preview: PreviewProfile
  updatePreview: (patch: Partial<PreviewProfile>) => void
}) {
  return (
    <>
      <label>
        预览地址
        <input
          type="text"
          value={preview.url}
          onChange={(event) => updatePreview({ url: event.target.value })}
        />
      </label>
      <label>
        预览账号
        <input
          type="text"
          value={preview.account}
          onChange={(event) => updatePreview({ account: event.target.value })}
        />
      </label>
      <label>
        预览密码
        <input
          type="password"
          value={preview.password}
          onChange={(event) => updatePreview({ password: event.target.value })}
        />
      </label>
      <label>
        预览方式
        <select
          value={preview.mode}
          onChange={(event) =>
            updatePreview({
              mode: event.target.value as PreviewProfile['mode']
            })
          }
        >
          <option value="embedded">内嵌预览</option>
          <option value="external">系统浏览器</option>
        </select>
      </label>
    </>
  )
}

function AiFields({
  ai,
  updateAi
}: {
  ai: AiProfile
  updateAi: (patch: Partial<AiProfile>) => void
}) {
  return (
    <>
      <label>
        Codex 提供方
        <input
          type="text"
          value={ai.provider}
          onChange={(event) => updateAi({ provider: event.target.value })}
        />
      </label>
      <label>
        Codex 模型
        <input
          type="text"
          value={ai.model}
          onChange={(event) => updateAi({ model: event.target.value })}
        />
      </label>
      <label>
        Codex API Key
        <input
          type="password"
          value={ai.api_key}
          onChange={(event) => updateAi({ api_key: event.target.value })}
        />
      </label>
    </>
  )
}

export function ProjectFields({
  config,
  chooseRuntimeDir,
  updateWorkspace,
  updateSync,
  updatePreview,
  updateAi
}: ProjectFieldProps) {
  return (
    <div className="config-section">
      <ProjectIdentityFields
        name={config.workspace.name}
        updateWorkspace={updateWorkspace}
      />
      <SyncFields
        config={config}
        chooseRuntimeDir={chooseRuntimeDir}
        updateSync={updateSync}
      />
      <PreviewFields preview={config.preview} updatePreview={updatePreview} />
      <AiFields ai={config.ai} updateAi={updateAi} />
    </div>
  )
}

export function StyleFields({ config, updateStyle }: StyleFieldProps) {
  return (
    <div className="config-section">
      <label>
        字体
        <input
          type="text"
          value={config.style.font_family}
          onChange={(event) => updateStyle({ font_family: event.target.value })}
        />
      </label>
      <label>
        字号
        <input
          type="number"
          value={config.style.font_size}
          onChange={(event) => updateStyle({ font_size: toNumber(event.target.value) })}
        />
      </label>
      <label>
        行高
        <input
          type="number"
          step="0.1"
          value={config.style.line_height}
          onChange={(event) => updateStyle({ line_height: toNumber(event.target.value) })}
        />
      </label>
      <label>
        列宽
        <input
          type="number"
          step="0.1"
          value={config.style.column_width}
          onChange={(event) => updateStyle({ column_width: toNumber(event.target.value) })}
        />
      </label>
      <label>
        表头字体
        <input
          type="text"
          value={config.style.header_font_family}
          onChange={(event) =>
            updateStyle({ header_font_family: event.target.value })
          }
        />
      </label>
      <label>
        表头字号
        <input
          type="number"
          value={config.style.header_font_size}
          onChange={(event) =>
            updateStyle({ header_font_size: toNumber(event.target.value) })
          }
        />
      </label>
      <label>
        数字格式
        <input
          type="text"
          value={config.style.number_format}
          onChange={(event) => updateStyle({ number_format: event.target.value })}
        />
      </label>
    </div>
  )
}
