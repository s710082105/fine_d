import { Button, Modal, Tree } from 'antd'
import type { DataNode } from 'antd/es/tree'
import type { RemoteDirectoryEntry } from '../../lib/types/project-config'

interface RemoteDirectoryPickerProps {
  entries: RemoteDirectoryEntry[]
  loading: boolean
  open: boolean
  selectedPath: string
  onClose: () => void
  onConfirm: () => void
  onLoadChildren: (path: string) => Promise<void>
  onSelect: (path: string) => void
}

export function RemoteDirectoryPicker({
  entries,
  loading,
  open,
  selectedPath,
  onClose,
  onConfirm,
  onLoadChildren,
  onSelect
}: RemoteDirectoryPickerProps) {
  return (
    <Modal
      destroyOnHidden
      open={open}
      title="选择远程目录"
      onCancel={onClose}
      footer={[
        <Button key="cancel" onClick={onClose}>
          取消
        </Button>,
        <Button
          key="confirm"
          type="primary"
          disabled={selectedPath.trim().length === 0}
          onClick={onConfirm}
        >
          使用当前目录
        </Button>
      ]}
    >
      <Tree
        blockNode
        className="file-tree"
        loadData={(node) => onLoadChildren(String(node.key))}
        selectedKeys={selectedPath ? [selectedPath] : []}
        treeData={buildRemoteDirectoryTree(entries)}
        onSelect={(keys) => {
          if (keys.length === 0) return
          onSelect(String(keys[0]))
        }}
      />
      {!loading && entries.length === 0 ? (
        <p className="form-hint">当前路径下没有子目录</p>
      ) : null}
      {loading ? <p className="form-hint">正在读取远程目录...</p> : null}
    </Modal>
  )
}

function buildRemoteDirectoryTree(entries: RemoteDirectoryEntry[]): DataNode[] {
  return entries.map((entry) => ({
    key: entry.path,
    title: entry.path,
    isLeaf: false,
    children: entry.children.length > 0 ? buildRemoteDirectoryTree(entry.children) : undefined
  }))
}
