import { Button, Checkbox, Input, InputNumber, Select, Space } from 'antd'
import type { ReactNode } from 'react'
import type {
  AiProfile,
  PreviewProfile,
  ProjectConfig,
  RemoteDirectoryEntry,
  SyncProfile,
  SyncProtocol,
  WorkspaceProfile
} from '../../lib/types/project-config'
import { RemoteDirectoryPicker } from './project-config-remote-directory-picker'

interface ProjectFieldProps {
  config: ProjectConfig
  chooseRuntimeDir: () => void
  closeRemoteDirectoryPicker: () => void
  confirmRemoteDirectory: () => void
  loadRemoteDirectoryChildren: (path: string) => Promise<void>
  openRemoteDirectoryPicker: () => void
  remoteDirectoryEntries: RemoteDirectoryEntry[]
  remoteDirectoryLoading: boolean
  remoteDirectoryPickerOpen: boolean
  selectedRemoteDirectory: string
  selectRemoteDirectory: (path: string) => void
  updateWorkspace: (patch: Partial<WorkspaceProfile>) => void
  updateSync: (patch: Partial<SyncProfile>) => void
  updatePreview: (patch: Partial<PreviewProfile>) => void
  updateAi: (patch: Partial<AiProfile>) => void
}

const INPUT_WIDTH = { width: '100%' }
const SYNC_PROTOCOL_OPTIONS = [
  { label: 'SFTP', value: 'sftp' },
  { label: 'FTP', value: 'ftp' },
  { label: '本地', value: 'local' }
] as Array<{ label: string; value: SyncProtocol }>

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="config-field">
      <span className="config-field__label">{label}</span>
      {children}
    </label>
  )
}

function isRemoteProtocol(protocol: SyncProtocol): boolean {
  return protocol === 'sftp' || protocol === 'ftp'
}

function SyncFields(props: Pick<
  ProjectFieldProps,
  | 'config'
  | 'chooseRuntimeDir'
  | 'closeRemoteDirectoryPicker'
  | 'confirmRemoteDirectory'
  | 'loadRemoteDirectoryChildren'
  | 'openRemoteDirectoryPicker'
  | 'remoteDirectoryEntries'
  | 'remoteDirectoryLoading'
  | 'remoteDirectoryPickerOpen'
  | 'selectedRemoteDirectory'
  | 'selectRemoteDirectory'
  | 'updateSync'
>) {
  const remoteProtocol = isRemoteProtocol(props.config.sync.protocol)
  const runtimeLabel = remoteProtocol ? '远端运行目录' : '运行目录'

  return (
    <>
      <Field label="同步协议">
        <Select
          aria-label="同步协议"
          value={props.config.sync.protocol}
          options={SYNC_PROTOCOL_OPTIONS}
          onChange={(value: SyncProtocol) => props.updateSync({ protocol: value })}
        />
      </Field>
      {remoteProtocol ? (
        <>
          <Field label="同步主机">
            <Input
              aria-label="同步主机"
              value={props.config.sync.host}
              onChange={(event) => props.updateSync({ host: event.target.value })}
            />
          </Field>
          <Field label="同步端口">
            <InputNumber
              aria-label="同步端口"
              min={0}
              style={INPUT_WIDTH}
              value={props.config.sync.port}
              onChange={(value) => props.updateSync({ port: value ?? 0 })}
            />
          </Field>
          <Field label="同步用户名">
            <Input
              aria-label="同步用户名"
              value={props.config.sync.username}
              onChange={(event) => props.updateSync({ username: event.target.value })}
            />
          </Field>
          <Field label="同步密码">
            <Input.Password
              aria-label="同步密码"
              value={props.config.sync.password}
              onChange={(event) => props.updateSync({ password: event.target.value })}
            />
          </Field>
          <Field label={runtimeLabel}>
            <Space.Compact block>
              <Input aria-label={runtimeLabel} value={props.config.sync.remote_runtime_dir} readOnly />
              <Button type="default" onClick={props.openRemoteDirectoryPicker}>
                选择远程目录
              </Button>
            </Space.Compact>
          </Field>
          <RemoteDirectoryPicker
            entries={props.remoteDirectoryEntries}
            loading={props.remoteDirectoryLoading}
            open={props.remoteDirectoryPickerOpen}
            selectedPath={props.selectedRemoteDirectory}
            onClose={props.closeRemoteDirectoryPicker}
            onConfirm={props.confirmRemoteDirectory}
            onLoadChildren={props.loadRemoteDirectoryChildren}
            onSelect={props.selectRemoteDirectory}
          />
        </>
      ) : (
        <Field label={runtimeLabel}>
          <Space.Compact block>
            <Input aria-label={runtimeLabel} value={props.config.sync.remote_runtime_dir} readOnly />
            <Button type="default" onClick={props.chooseRuntimeDir}>
              选择运行目录
            </Button>
          </Space.Compact>
        </Field>
      )}
      <div className="config-checkboxes">
        <Checkbox
          aria-label="同步删除"
          checked={props.config.sync.delete_propagation}
          onChange={(event) =>
            props.updateSync({ delete_propagation: event.target.checked })
          }
        >
          同步删除
        </Checkbox>
        <Checkbox
          aria-label="文件变更后自动同步"
          checked={props.config.sync.auto_sync_on_change}
          onChange={(event) =>
            props.updateSync({ auto_sync_on_change: event.target.checked })
          }
        >
          文件变更后自动同步
        </Checkbox>
      </div>
    </>
  )
}

export function ProjectFields(props: ProjectFieldProps) {
  return (
    <div className="config-section config-grid">
      <Field label="项目名称">
        <Input
          aria-label="项目名称"
          value={props.config.workspace.name}
          onChange={(event) => props.updateWorkspace({ name: event.target.value })}
        />
      </Field>
      <SyncFields {...props} />
      <Field label="预览地址">
        <Input
          aria-label="预览地址"
          value={props.config.preview.url}
          onChange={(event) => props.updatePreview({ url: event.target.value })}
        />
      </Field>
      <Field label="预览账号">
        <Input
          aria-label="预览账号"
          value={props.config.preview.account}
          onChange={(event) => props.updatePreview({ account: event.target.value })}
        />
      </Field>
      <Field label="预览密码">
        <Input.Password
          aria-label="预览密码"
          value={props.config.preview.password}
          onChange={(event) => props.updatePreview({ password: event.target.value })}
        />
      </Field>
      <Field label="Codex API Key">
        <Input.Password
          aria-label="Codex API Key"
          value={props.config.ai.api_key}
          onChange={(event) => props.updateAi({ api_key: event.target.value })}
        />
      </Field>
    </div>
  )
}
