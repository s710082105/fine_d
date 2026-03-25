import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/vue'
import { afterEach, describe, expect, it, vi } from 'vitest'

import DatasourceView from '../views/DatasourceView.vue'
import { ApiError } from '../lib/api'

const { listDatasourceConnections, previewDatasourceSql } = vi.hoisted(() => ({
  listDatasourceConnections: vi.fn(),
  previewDatasourceSql: vi.fn()
}))

vi.mock('../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../lib/api')>('../lib/api')
  return {
    ...actual,
    listDatasourceConnections,
    previewDatasourceSql
  }
})

afterEach(() => {
  listDatasourceConnections.mockReset()
  previewDatasourceSql.mockReset()
})

describe('DatasourceView', () => {
  it('loads datasource connections on mount', async () => {
    listDatasourceConnections.mockResolvedValue([{ name: 'qzcs' }, { name: 'tickets' }])
    previewDatasourceSql.mockResolvedValue({ columns: [], rows: [] })

    render(DatasourceView)

    await waitFor(() => {
      expect(listDatasourceConnections).toHaveBeenCalledTimes(1)
    })

    expect(await screen.findByText('qzcs')).toBeInTheDocument()
    expect(await screen.findByText('tickets')).toBeInTheDocument()
  })

  it('previews sql and renders columns and rows', async () => {
    listDatasourceConnections.mockResolvedValue([{ name: 'qzcs' }])
    previewDatasourceSql.mockResolvedValue({
      columns: ['ok'],
      rows: [[1]]
    })

    render(DatasourceView)

    await screen.findByText('qzcs')
    await fireEvent.update(screen.getByLabelText('SQL 语句'), 'select 1 as ok')
    await fireEvent.click(screen.getByRole('button', { name: '预览 SQL' }))

    await waitFor(() => {
      expect(previewDatasourceSql).toHaveBeenCalledWith('qzcs', 'select 1 as ok')
    })

    expect(await screen.findByText('ok')).toBeInTheDocument()
    expect(await screen.findByText('1')).toBeInTheDocument()
  })

  it('shows backend datasource errors without hiding the failure', async () => {
    listDatasourceConnections.mockRejectedValue(
      new ApiError(
        400,
        {
          code: 'datasource.invalid_response',
          message: 'bad response',
          detail: { path: '/v10/config/connection/list/0' },
          source: 'datasource',
          retryable: false
        },
        'API request failed: 400 Bad Request'
      )
    )

    render(DatasourceView)

    await waitFor(() => {
      expect(
        screen.getByText('datasource.invalid_response: bad response')
      ).toBeInTheDocument()
    })
  })
})
