import {
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

export function ProjectFields({
  config,
  chooseRuntimeDir,
  updateWorkspace,
  updateSync,
  updatePreview
}: ProjectFieldProps) {
  const remoteProtocol = isRemoteProtocol(config.sync.protocol)

  return (
    <div className="config-section">
      <label>
        项目名称
        <input
          type="text"
          value={config.workspace.name}
          onChange={(event) => updateWorkspace({ name: event.target.value })}
        />
      </label>
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
      {remoteProtocol && (
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
      )}
      {config.sync.protocol === 'local' ? (
        <label>
          {runtimeDirLabel(config.sync.protocol)}
          <div className="directory-picker">
            <input type="text" value={config.sync.remote_runtime_dir} readOnly />
            <button type="button" onClick={chooseRuntimeDir}>
              选择运行目录
            </button>
          </div>
        </label>
      ) : (
        <label>
          {runtimeDirLabel(config.sync.protocol)}
          <input
            type="text"
            value={config.sync.remote_runtime_dir}
            onChange={(event) => updateSync({ remote_runtime_dir: event.target.value })}
          />
        </label>
      )}
      <label>
        预览地址
        <input
          type="text"
          value={config.preview.url}
          onChange={(event) => updatePreview({ url: event.target.value })}
        />
      </label>
      <label>
        预览方式
        <select
          value={config.preview.mode}
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
