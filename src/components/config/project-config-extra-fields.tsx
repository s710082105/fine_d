import { Button, Card, Input } from 'antd'
import type {
  DataConnectionProfile,
  ProjectConfig
} from '../../lib/types/project-config'

interface DataConnectionFieldsProps {
  config: ProjectConfig
  addDataConnection: () => void
  removeDataConnection: (index: number) => void
  updateDataConnection: (index: number, patch: Partial<DataConnectionProfile>) => void
}

export function DataConnectionFields({
  config,
  addDataConnection,
  removeDataConnection,
  updateDataConnection
}: DataConnectionFieldsProps) {
  const connections =
    config.data_connections.length > 0
      ? config.data_connections
      : [{ connection_name: '', dsn: '', username: '', password: '' }]

  return (
    <div className="config-section">
      <div className="config-list-actions">
        <Button onClick={addDataConnection}>新增数据连接</Button>
      </div>
      {connections.map((connection, index) => (
        <Card key={`connection-${index}`} className="config-subsection" size="small">
          <div className="config-subsection-header">
            <strong>{`数据连接 ${index + 1}`}</strong>
            <Button
              danger
              type="text"
              onClick={() => removeDataConnection(index)}
              disabled={config.data_connections.length === 0}
            >
              删除
            </Button>
          </div>
          <label className="config-field">
            <span className="config-field__label">{`数据连接名称 ${index + 1}`}</span>
            <Input
              aria-label={`数据连接名称 ${index + 1}`}
              value={connection.connection_name}
              onChange={(event) =>
                updateDataConnection(index, { connection_name: event.target.value })
              }
            />
          </label>
          <label className="config-field">
            <span className="config-field__label">{`DSN ${index + 1}`}</span>
            <Input
              aria-label={`DSN ${index + 1}`}
              value={connection.dsn}
              onChange={(event) => updateDataConnection(index, { dsn: event.target.value })}
            />
          </label>
          <label className="config-field">
            <span className="config-field__label">{`用户名 ${index + 1}`}</span>
            <Input
              aria-label={`用户名 ${index + 1}`}
              value={connection.username}
              onChange={(event) =>
                updateDataConnection(index, { username: event.target.value })
              }
            />
          </label>
          <label className="config-field">
            <span className="config-field__label">{`密码 ${index + 1}`}</span>
            <Input.Password
              aria-label={`密码 ${index + 1}`}
              value={connection.password}
              onChange={(event) =>
                updateDataConnection(index, { password: event.target.value })
              }
            />
          </label>
        </Card>
      ))}
    </div>
  )
}
