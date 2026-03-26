import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'

import DataConnectionPanel from '../components/DataConnectionPanel.vue'
import RemoteDirectoryPanel from '../components/RemoteDirectoryPanel.vue'

describe('Remote Panels', () => {
  it('renders remote directory tree and loads children lazily', async () => {
    const loadEntries = vi
      .fn()
      .mockResolvedValueOnce([
        { name: 'reportlets', path: '/reportlets', is_directory: true, lock: null }
      ])
      .mockResolvedValueOnce([
        {
          name: 'demo.cpt',
          path: '/reportlets/demo.cpt',
          is_directory: false,
          lock: 'alice'
        }
      ])

    const view = render(RemoteDirectoryPanel, {
      props: {
        loadEntries
      }
    })

    expect(await screen.findByText('reportlets')).toBeInTheDocument()
    expect(loadEntries).toHaveBeenNthCalledWith(1, undefined)

    const expandIcon = view.container.querySelector('.el-tree-node__expand-icon')
    expect(expandIcon).not.toBeNull()
    await fireEvent.click(expandIcon!)

    await waitFor(() => {
      expect(loadEntries).toHaveBeenNthCalledWith(2, '/reportlets')
    })

    expect(await screen.findByText('demo.cpt')).toBeInTheDocument()
    expect(screen.getByText('alice')).toBeInTheDocument()
  })

  it('keeps the tree mounted when a child directory load fails', async () => {
    const loadEntries = vi
      .fn()
      .mockResolvedValueOnce([
        { name: 'reportlets', path: '/reportlets', is_directory: true, lock: null }
      ])
      .mockRejectedValueOnce(
        new Error('remote.request_failed: 远程请求失败')
      )

    const view = render(RemoteDirectoryPanel, {
      props: {
        loadEntries
      }
    })

    expect(await screen.findByText('reportlets')).toBeInTheDocument()

    const expandIcon = view.container.querySelector('.el-tree-node__expand-icon')
    expect(expandIcon).not.toBeNull()
    await fireEvent.click(expandIcon!)

    expect(
      await screen.findByText('remote.request_failed: 远程请求失败')
    ).toBeInTheDocument()
    expect(await screen.findByText('reportlets')).toBeInTheDocument()
  })

  it('shows connection metadata in data connection panel', () => {
    render(DataConnectionPanel, {
      props: {
        connections: [
          { name: 'qzcs', database_type: 'MYSQL' },
          { name: 'tickets', database_type: 'POSTGRESQL' }
        ]
      }
    })

    expect(screen.getByText('qzcs')).toBeInTheDocument()
    expect(screen.getByText('tickets')).toBeInTheDocument()
    expect(screen.getByText('MYSQL')).toBeInTheDocument()
    expect(screen.getByText('POSTGRESQL')).toBeInTheDocument()
  })
})
