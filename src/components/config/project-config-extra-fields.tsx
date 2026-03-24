import { Alert, Button, Table } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type {
  DesignerConnectionSummary,
  ProjectConfig
} from '../../lib/types/project-config'

interface DataConnectionFieldsProps {
  config: ProjectConfig
  connections: DesignerConnectionSummary[]
  loading: boolean
  refreshConnections: () => Promise<unknown>
}

export function DataConnectionFields({
  config,
  connections,
  loading,
  refreshConnections
}: DataConnectionFieldsProps) {
  const columns: ColumnsType<DesignerConnectionSummary> = [
    {
      title: '连接名称',
      dataIndex: 'name',
      key: 'name'
    }
  ]

  const ready =
    config.preview.url.trim().length > 0 &&
    config.preview.account.trim().length > 0 &&
    config.preview.password.trim().length > 0

  return (
    <div className="config-section">
      <Alert
        type="info"
        showIcon
        message="只读取设计器远端已有数据连接"
        description="字段扫描和 SQL 试跑都应基于设计器远端返回结果，不再维护项目内本地连接配置。"
      />
      <div className="config-list-actions">
        <Button type="primary" onClick={() => void refreshConnections()} loading={loading} disabled={!ready}>
          读取远端连接
        </Button>
      </div>
      <Table
        rowKey="name"
        columns={columns}
        dataSource={connections}
        pagination={false}
        size="small"
        locale={{ emptyText: '暂无远端连接' }}
      />
    </div>
  )
}
