import type {
  DataConnectionProfile,
  ProjectConfig,
  ReportletEntry
} from '../../lib/types/project-config'

interface DataConnectionFieldsProps {
  config: ProjectConfig
  addDataConnection: () => void
  removeDataConnection: (index: number) => void
  updateDataConnection: (index: number, patch: Partial<DataConnectionProfile>) => void
}

interface FileManagementFieldsProps {
  entries: ReportletEntry[]
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
        <button type="button" onClick={addDataConnection}>新增数据连接</button>
      </div>
      {connections.map((connection, index) => (
        <section key={`connection-${index}`} className="config-subsection">
          <div className="config-subsection-header">
            <strong>{`数据连接 ${index + 1}`}</strong>
            <button
              type="button"
              onClick={() => removeDataConnection(index)}
              disabled={config.data_connections.length === 0}
            >
              删除
            </button>
          </div>
          <label>
            {`数据连接名称 ${index + 1}`}
            <input
              type="text"
              value={connection.connection_name}
              onChange={(event) =>
                updateDataConnection(index, { connection_name: event.target.value })
              }
            />
          </label>
          <label>
            {`DSN ${index + 1}`}
            <input
              type="text"
              value={connection.dsn}
              onChange={(event) => updateDataConnection(index, { dsn: event.target.value })}
            />
          </label>
          <label>
            {`用户名 ${index + 1}`}
            <input
              type="text"
              value={connection.username}
              onChange={(event) =>
                updateDataConnection(index, { username: event.target.value })
              }
            />
          </label>
          <label>
            {`密码 ${index + 1}`}
            <input
              type="password"
              value={connection.password}
              onChange={(event) =>
                updateDataConnection(index, { password: event.target.value })
              }
            />
          </label>
        </section>
      ))}
    </div>
  )
}

export function FileManagementFields({ entries }: FileManagementFieldsProps) {
  const visibleEntries = filterHiddenEntries(entries)

  return (
    <div className="config-section">
      <div className="section-heading">reportlets 目录</div>
      {visibleEntries.length === 0 ? (
        <p className="form-hint">reportlets 目录为空</p>
      ) : (
        <div className="file-tree">
          {visibleEntries.map((entry) => (
            <FileTreeNode key={entry.path} entry={entry} depth={0} />
          ))}
        </div>
      )}
    </div>
  )
}

function FileTreeNode({
  entry,
  depth
}: {
  entry: ReportletEntry
  depth: number
}) {
  return (
    <div>
      <div className="file-tree-node" style={{ paddingLeft: `${depth * 18}px` }}>
        <span className="file-tree-kind">{entry.kind === 'directory' ? '目录' : '文件'}</span>
        <span>{entry.name}</span>
      </div>
      {entry.children.map((child) => (
        <FileTreeNode key={child.path} entry={child} depth={depth + 1} />
      ))}
    </div>
  )
}

function filterHiddenEntries(entries: ReportletEntry[]): ReportletEntry[] {
  return entries
    .filter((entry) => !entry.name.startsWith('.'))
    .map((entry) => ({
      ...entry,
      children: filterHiddenEntries(entry.children)
    }))
}
