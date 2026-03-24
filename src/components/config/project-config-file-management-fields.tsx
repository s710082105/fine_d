import { Button, Tree } from 'antd'
import type { DataNode, EventDataNode } from 'antd/es/tree'
import type { ReactNode } from 'react'
import { useMemo, useState } from 'react'
import type { ReportletEntry } from '../../lib/types/project-config'
import { PROJECT_SOURCE_SUBDIR } from '../../lib/types/project-config'

interface FileManagementFieldsProps {
  canInsertLocalPath: boolean
  localEntries: ReportletEntry[]
  localPushing: boolean
  remoteEntries: ReportletEntry[]
  remoteLoading: boolean
  remotePulling: boolean
  onInsertLocalPath?: (path: string) => void
  onLoadLocalChildren: (relativePath: string) => Promise<unknown>
  onLoadRemoteChildren: (path: string) => Promise<unknown>
  onRefresh: () => Promise<unknown>
  onPullRemoteFile: (relativePath: string) => Promise<unknown>
  onPushLocalFile: (relativePath: string) => Promise<unknown>
}

interface TreeNodeMeta extends DataNode {
  loaded: boolean
  nodePath: string
  fileKind: ReportletEntry['kind']
}

export function FileManagementFields({
  canInsertLocalPath,
  localEntries,
  localPushing,
  remoteEntries,
  remoteLoading,
  remotePulling,
  onInsertLocalPath,
  onLoadLocalChildren,
  onLoadRemoteChildren,
  onRefresh,
  onPullRemoteFile,
  onPushLocalFile
}: FileManagementFieldsProps) {
  const localTree = useMemo(
    () =>
      buildTreeData(filterHiddenEntries(localEntries), {
        canInsertLocalPath,
        localPushing,
        onInsertLocalPath,
        onPushLocalFile
      }),
    [canInsertLocalPath, localEntries, localPushing, onInsertLocalPath, onPushLocalFile]
  )
  const remoteTree = useMemo(
    () => buildTreeData(filterHiddenEntries(remoteEntries)),
    [remoteEntries]
  )
  const [selectedRemoteKeys, setSelectedRemoteKeys] = useState<string[]>([])
  const selectedRemoteFile = resolveSelectedRemoteFile(remoteTree, selectedRemoteKeys)

  const handlePull = () => {
    if (!selectedRemoteFile || remotePulling) {
      return
    }
    void onPullRemoteFile(selectedRemoteFile)
  }

  return (
    <div className="config-section">
      <div className="section-heading">文件管理</div>
      <div className="file-management-layout">
        <FileTreePanel
          title="本地 reportlets"
          emptyText="本地 reportlets 目录为空"
          treeData={localTree}
          onLoadData={onLoadLocalChildren}
        />
        <FileTreePanel
          title="远端 reportlets"
          emptyText="点击刷新列表读取远端文件清单"
          treeData={remoteTree}
          extra={
            <div className="config-list-actions">
              <Button type="default" loading={remoteLoading} onClick={() => void onRefresh()}>
                刷新列表
              </Button>
              <Button
                type="primary"
                disabled={!selectedRemoteFile || remoteLoading || remotePulling}
                loading={remotePulling}
                onClick={handlePull}
              >
                拉取选中文件
              </Button>
            </div>
          }
          selectedKeys={selectedRemoteKeys}
          onLoadData={onLoadRemoteChildren}
          onSelect={(keys) => setSelectedRemoteKeys(keys as string[])}
        />
      </div>
    </div>
  )
}

function FileTreePanel({
  title,
  emptyText,
  treeData,
  extra,
  selectedKeys,
  onLoadData,
  onSelect
}: {
  title: string
  emptyText: string
  treeData: TreeNodeMeta[]
  extra?: ReactNode
  selectedKeys?: string[]
  onLoadData: (path: string) => Promise<unknown>
  onSelect?: (keys: React.Key[]) => void
}) {
  const handleLoadData = (node: EventDataNode<DataNode>) => {
    const target = node as unknown as TreeNodeMeta
    if (target.fileKind !== 'directory' || target.loaded) {
      return Promise.resolve()
    }
    return onLoadData(target.nodePath).then(() => undefined)
  }

  return (
    <section className="file-tree-panel">
      <div className="config-subsection-header">
        <div className="section-heading">{title}</div>
        {extra}
      </div>
      {treeData.length === 0 ? (
        <p className="form-hint">{emptyText}</p>
      ) : (
        <Tree
          blockNode
          className="file-tree"
          loadData={handleLoadData}
          selectedKeys={selectedKeys}
          selectable={Boolean(onSelect)}
          treeData={treeData}
          onSelect={onSelect}
        />
      )}
    </section>
  )
}

function buildTreeData(
  entries: ReportletEntry[],
  options?: {
    canInsertLocalPath: boolean
    localPushing: boolean
    onInsertLocalPath?: (path: string) => void
    onPushLocalFile?: (path: string) => void
  }
): TreeNodeMeta[] {
  return entries.map((entry) => {
    const children = filterHiddenEntries(entry.children)
    const loaded = entry.loaded ?? entry.kind === 'file'
    return {
      key: entry.path,
      title: renderTreeNode(entry, options),
      loaded,
      nodePath: entry.path,
      fileKind: entry.kind,
      isLeaf: entry.kind === 'file' || (loaded && children.length === 0),
      children: loaded ? buildTreeData(children, options) : undefined
    }
  })
}

function renderTreeNode(
  entry: ReportletEntry,
  options?: {
    canInsertLocalPath: boolean
    localPushing: boolean
    onInsertLocalPath?: (path: string) => void
    onPushLocalFile?: (path: string) => void
  }
) {
  const relativePath =
    options && entry.kind === 'file'
      ? `${PROJECT_SOURCE_SUBDIR}/${entry.path}`.replace(/\/+/g, '/')
      : null

  return (
    <span className="file-tree-node">
      <span className="file-tree-icon" aria-hidden="true">
        {entry.kind === 'directory' ? '📁' : '📄'}
      </span>
      <span>{entry.name}</span>
      {relativePath ? (
        <>
          <Button
            size="small"
            type="link"
            disabled={!options?.canInsertLocalPath}
            aria-label={`插入 ${entry.name}`}
            onClick={(event) => {
              event.stopPropagation()
              options?.onInsertLocalPath?.(quoteTerminalPath(relativePath))
            }}
          >
            插入
          </Button>
          <Button
            size="small"
            type="link"
            loading={options?.localPushing}
            aria-label={`上传 ${entry.name}`}
            onClick={(event) => {
              event.stopPropagation()
              void options?.onPushLocalFile?.(relativePath)
            }}
          >
            上传
          </Button>
        </>
      ) : null}
    </span>
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

function quoteTerminalPath(path: string) {
  return `'${path.replaceAll("'", `'\"'\"'`)}'`
}

function resolveSelectedRemoteFile(
  treeData: TreeNodeMeta[],
  selectedKeys: string[]
): string | null {
  const selectedKey = selectedKeys[0]
  if (!selectedKey) {
    return null
  }
  const node = findNode(treeData, selectedKey)
  if (!node || node.fileKind !== 'file') {
    return null
  }
  return node.key.toString()
}

function findNode(treeData: TreeNodeMeta[], targetKey: string): TreeNodeMeta | null {
  for (const node of treeData) {
    if (node.key === targetKey) {
      return node
    }
    const children = (node.children as TreeNodeMeta[] | undefined) ?? []
    const child = findNode(children, targetKey)
    if (child) {
      return child
    }
  }
  return null
}
