import { Alert, Button, Checkbox, Input, Space } from 'antd'
import type { ReactNode } from 'react'
import type {
  AiProfile,
  PreviewProfile,
  ProjectConfig,
  SyncProfile,
  WorkspaceProfile
} from '../../lib/types/project-config'

interface ProjectFieldProps {
  config: ProjectConfig
  remoteConnectionMessage: string
  remoteConnectionStatus: 'idle' | 'loading' | 'success' | 'error'
  testRemoteSyncConnection: () => Promise<unknown>
  chooseDesignerRoot: () => void
  updateWorkspace: (patch: Partial<WorkspaceProfile>) => void
  updateSync: (patch: Partial<SyncProfile>) => void
  updatePreview: (patch: Partial<PreviewProfile>) => void
  updateAi: (patch: Partial<AiProfile>) => void
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="config-field">
      <span className="config-field__label">{label}</span>
      {children}
    </label>
  )
}

function SyncFields(props: Pick<
  ProjectFieldProps,
  | 'config'
  | 'chooseDesignerRoot'
  | 'updateSync'
>) {
  return (
    <>
      <Field label="本地 FineReport 设计器目录">
        <Space.Compact block>
          <Input
            aria-label="本地 FineReport 设计器目录"
            value={props.config.sync.designer_root}
            readOnly
          />
          <Button type="default" onClick={props.chooseDesignerRoot}>
            选择目录
          </Button>
        </Space.Compact>
      </Field>
      <p className="form-hint">
        请选择 FineReport 安装根目录，也就是包含 lib 目录和设计器 jars 的那一级目录。
      </p>
      <p className="form-hint">同步会复用预览地址、预览账号和预览密码建立 FineReport 远程设计连接。</p>
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
      <div className="config-list-actions">
        <Button
          type="default"
          loading={props.remoteConnectionStatus === 'loading'}
          onClick={() => void props.testRemoteSyncConnection()}
        >
          测试远程连接
        </Button>
      </div>
      {props.remoteConnectionStatus !== 'idle' ? (
        <Alert
          type={props.remoteConnectionStatus === 'success' ? 'success' : 'error'}
          showIcon
          message={props.remoteConnectionMessage}
        />
      ) : null}
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
