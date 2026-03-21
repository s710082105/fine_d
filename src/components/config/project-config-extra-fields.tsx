import { useState } from 'react'
import {
  Alert,
  Button,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type {
  DataConnectionProfile,
  DbType,
  ProjectConfig
} from '../../lib/types/project-config'
import type { TestConnectionResult } from './project-config-services'

const DB_TYPE_OPTIONS: { value: DbType; label: string; color: string; defaultPort: number }[] = [
  { value: 'mysql', label: 'MySQL', color: 'blue', defaultPort: 3306 },
  { value: 'postgresql', label: 'PostgreSQL', color: 'green', defaultPort: 5432 },
  { value: 'oracle', label: 'Oracle', color: 'orange', defaultPort: 1521 },
  { value: 'sqlserver', label: 'SQL Server', color: 'purple', defaultPort: 1433 }
]

const DB_TYPE_META = Object.fromEntries(
  DB_TYPE_OPTIONS.map((opt) => [opt.value, opt])
) as Record<DbType, (typeof DB_TYPE_OPTIONS)[number]>

function createEmptyConnection(): DataConnectionProfile {
  return {
    connection_name: '',
    db_type: 'mysql',
    host: '',
    port: 3306,
    database: '',
    username: '',
    password: ''
  }
}

interface DataConnectionFieldsProps {
  config: ProjectConfig
  addDataConnection: (conn: DataConnectionProfile) => void
  removeDataConnection: (index: number) => void
  updateDataConnection: (index: number, conn: DataConnectionProfile) => void
  testDataConnection: (conn: DataConnectionProfile) => Promise<TestConnectionResult>
}

type ModalMode = { type: 'add' } | { type: 'edit'; index: number }

export function DataConnectionFields({
  config,
  addDataConnection,
  removeDataConnection,
  updateDataConnection,
  testDataConnection
}: DataConnectionFieldsProps) {
  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<ModalMode>({ type: 'add' })
  const [form] = Form.useForm<DataConnectionProfile>()
  const [testStatus, setTestStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [testMessage, setTestMessage] = useState('')
  const [testPassed, setTestPassed] = useState(false)

  const openAddModal = () => {
    setModalMode({ type: 'add' })
    form.setFieldsValue(createEmptyConnection())
    setTestStatus('idle')
    setTestMessage('')
    setTestPassed(false)
    setModalOpen(true)
  }

  const openEditModal = (index: number) => {
    setModalMode({ type: 'edit', index })
    form.setFieldsValue(config.data_connections[index])
    setTestStatus('idle')
    setTestMessage('')
    setTestPassed(false)
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    form.resetFields()
  }

  const resetTestStatus = () => {
    setTestStatus('idle')
    setTestMessage('')
    setTestPassed(false)
  }

  const handleDbTypeChange = (dbType: DbType) => {
    form.setFieldsValue({ db_type: dbType, port: DB_TYPE_META[dbType].defaultPort })
    resetTestStatus()
  }

  const handleTestConnection = async () => {
    try {
      await form.validateFields()
    } catch {
      return
    }
    const values = form.getFieldsValue()
    setTestStatus('loading')
    setTestMessage('')
    try {
      const result = await testDataConnection(values)
      if (result.ok) {
        setTestStatus('success')
        setTestMessage(result.message)
        setTestPassed(true)
      } else {
        setTestStatus('error')
        setTestMessage(result.message)
        setTestPassed(false)
      }
    } catch (err) {
      setTestStatus('error')
      setTestMessage(err instanceof Error ? err.message : String(err))
      setTestPassed(false)
    }
  }

  const handleConfirm = async () => {
    try {
      await form.validateFields()
    } catch {
      return
    }
    const values = form.getFieldsValue()
    if (modalMode.type === 'add') {
      addDataConnection(values)
    } else {
      updateDataConnection(modalMode.index, values)
    }
    closeModal()
  }

  const columns: ColumnsType<DataConnectionProfile & { _index: number }> = [
    {
      title: '连接名称',
      dataIndex: 'connection_name',
      key: 'connection_name'
    },
    {
      title: '类型',
      dataIndex: 'db_type',
      key: 'db_type',
      render: (dbType: DbType) => {
        const meta = DB_TYPE_META[dbType]
        return <Tag color={meta?.color ?? 'default'}>{meta?.label ?? dbType}</Tag>
      }
    },
    {
      title: '主机',
      key: 'host',
      render: (_, record) => `${record.host}:${record.port}`
    },
    {
      title: '数据库',
      dataIndex: 'database',
      key: 'database'
    },
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username'
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" onClick={() => openEditModal(record._index)}>
            编辑
          </Button>
          <Popconfirm
            title="确认删除此数据连接？"
            onConfirm={() => removeDataConnection(record._index)}
            okText="确认"
            cancelText="取消"
          >
            <Button type="link" size="small" danger>
              删除
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ]

  const dataSource = config.data_connections.map((conn, index) => ({
    ...conn,
    _index: index,
    key: `conn-${index}`
  }))

  return (
    <div className="config-section">
      <div className="config-list-actions">
        <Button type="primary" onClick={openAddModal}>
          新增数据连接
        </Button>
      </div>
      <Table
        columns={columns}
        dataSource={dataSource}
        pagination={false}
        size="small"
        locale={{ emptyText: '暂无数据连接' }}
      />
      <Modal
        title={modalMode.type === 'add' ? '新增数据连接' : '编辑数据连接'}
        open={modalOpen}
        onCancel={closeModal}
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Button loading={testStatus === 'loading'} onClick={handleTestConnection}>
              测试连接
            </Button>
            <Space>
              <Button onClick={closeModal}>取消</Button>
              <Button type="primary" disabled={!testPassed} onClick={handleConfirm}>
                确认
              </Button>
            </Space>
          </div>
        }
        destroyOnHidden
      >
        <Form
          form={form}
          layout="vertical"
          onValuesChange={resetTestStatus}
          initialValues={createEmptyConnection()}
        >
          <Form.Item
            label="连接名称"
            name="connection_name"
            rules={[{ required: true, message: '请输入连接名称' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            label="数据库类型"
            name="db_type"
            rules={[{ required: true, message: '请选择数据库类型' }]}
          >
            <Select onChange={handleDbTypeChange}>
              {DB_TYPE_OPTIONS.map((opt) => (
                <Select.Option key={opt.value} value={opt.value}>
                  {opt.label}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            label="主机地址"
            name="host"
            rules={[{ required: true, message: '请输入主机地址' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            label="端口"
            name="port"
            rules={[{ required: true, message: '请输入端口' }]}
          >
            <InputNumber min={1} max={65535} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            label="数据库名"
            name="database"
            rules={[{ required: true, message: '请输入数据库名' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            label="用户名"
            name="username"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            label="密码"
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password />
          </Form.Item>
        </Form>
        {testStatus === 'success' && (
          <Alert type="success" showIcon message={testMessage} style={{ marginTop: 8 }} />
        )}
        {testStatus === 'error' && (
          <Alert type="error" showIcon message={testMessage} style={{ marginTop: 8 }} />
        )}
      </Modal>
    </div>
  )
}
