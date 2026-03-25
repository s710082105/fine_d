import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import DataConnectionPanel from '../components/DataConnectionPanel.vue'
import RemoteDirectoryPanel from '../components/RemoteDirectoryPanel.vue'

describe('Remote Panels', () => {
  it('renders remote directory entries', () => {
    render(RemoteDirectoryPanel, {
      props: {
        entries: [
          { path: 'reportlets/demo', is_directory: true, lock: null },
          { path: 'reportlets/demo/test.cpt', is_directory: false, lock: 'alice' }
        ]
      }
    })

    expect(screen.getByText('reportlets/demo')).toBeInTheDocument()
    expect(screen.getByText('reportlets/demo/test.cpt')).toBeInTheDocument()
    expect(screen.getByText('alice')).toBeInTheDocument()
  })

  it('renders data connections', () => {
    render(DataConnectionPanel, {
      props: {
        connections: [{ name: 'qzcs' }, { name: 'tickets' }]
      }
    })

    expect(screen.getByText('qzcs')).toBeInTheDocument()
    expect(screen.getByText('tickets')).toBeInTheDocument()
  })
})
