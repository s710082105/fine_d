import { ProjectConfig, SyncProfile, WorkspaceProfile } from '../../lib/types/project-config'

interface WorkspaceFieldProps {
  config: ProjectConfig
  updateWorkspace: (patch: Partial<WorkspaceProfile>) => void
}

export function WorkspaceFields({ config, updateWorkspace }: WorkspaceFieldProps) {
  return (
    <>
      <label>
        Workspace Name
        <input
          type="text"
          value={config.workspace.name}
          onChange={(event) => updateWorkspace({ name: event.target.value })}
        />
      </label>
      <label>
        Workspace Root Dir
        <input
          type="text"
          value={config.workspace.root_dir}
          onChange={(event) => updateWorkspace({ root_dir: event.target.value })}
        />
      </label>
    </>
  )
}

interface SyncFieldProps {
  config: ProjectConfig
  updateSync: (patch: Partial<SyncProfile>) => void
}

export function SyncFields({ config, updateSync }: SyncFieldProps) {
  return (
    <>
      <label>
        Protocol
        <select
          value={config.sync.protocol}
          onChange={(event) =>
            updateSync({ protocol: event.target.value as 'sftp' | 'ftp' })
          }
        >
          <option value="sftp">SFTP</option>
          <option value="ftp">FTP</option>
        </select>
      </label>
      <label>
        Sync Host
        <input
          type="text"
          value={config.sync.host}
          onChange={(event) => updateSync({ host: event.target.value })}
        />
      </label>
      <label>
        Sync Port
        <input
          type="number"
          value={config.sync.port}
          onChange={(event) => updateSync({ port: Number(event.target.value) || 0 })}
        />
      </label>
      <label>
        Sync Username
        <input
          type="text"
          value={config.sync.username}
          onChange={(event) => updateSync({ username: event.target.value })}
        />
      </label>
      <label>
        Local Source Dir
        <input
          type="text"
          value={config.sync.local_source_dir}
          onChange={(event) => updateSync({ local_source_dir: event.target.value })}
        />
      </label>
      <label>
        Remote Runtime Dir
        <input
          type="text"
          value={config.sync.remote_runtime_dir}
          onChange={(event) => updateSync({ remote_runtime_dir: event.target.value })}
        />
      </label>
      <label className="checkbox-field">
        <input
          type="checkbox"
          checked={config.sync.delete_propagation}
          onChange={(event) => updateSync({ delete_propagation: event.target.checked })}
        />
        Delete Propagation
      </label>
      <label className="checkbox-field">
        <input
          type="checkbox"
          checked={config.sync.auto_sync_on_change}
          onChange={(event) => updateSync({ auto_sync_on_change: event.target.checked })}
        />
        Auto Sync On Change
      </label>
    </>
  )
}
