import { Tree } from 'antd'
import type { ReactNode } from 'react'
import type { ReportletEntry } from '../../lib/types/project-config'

interface FileManagementFieldsProps {
  entries: ReportletEntry[]
}

interface FileTreeDataNode {
  key: string
  title: ReactNode
  children: FileTreeDataNode[]
}

export function FileManagementFields({ entries }: FileManagementFieldsProps) {
  const visibleEntries = filterHiddenEntries(entries)

  return (
    <div className="config-section">
      <div className="section-heading">reportlets 目录</div>
      {visibleEntries.length === 0 ? (
        <p className="form-hint">reportlets 目录为空</p>
      ) : (
        <Tree
          blockNode
          className="file-tree"
          defaultExpandAll
          selectable={false}
          treeData={buildTreeData(visibleEntries)}
        />
      )}
    </div>
  )
}

function buildTreeData(entries: ReportletEntry[]): FileTreeDataNode[] {
  return entries.map((entry) => ({
    key: entry.path,
    title: (
      <span className="file-tree-node">
        <span className="file-tree-kind">
          {entry.kind === 'directory' ? '目录' : '文件'}
        </span>
        <span>{entry.name}</span>
      </span>
    ),
    children: buildTreeData(entry.children)
  }))
}

function filterHiddenEntries(entries: ReportletEntry[]): ReportletEntry[] {
  return entries
    .filter((entry) => !entry.name.startsWith('.'))
    .map((entry) => ({
      ...entry,
      children: filterHiddenEntries(entry.children)
    }))
}
