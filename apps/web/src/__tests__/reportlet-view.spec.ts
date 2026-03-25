import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/vue'
import { afterEach, describe, expect, it, vi } from 'vitest'

import ReportletView from '../views/ReportletView.vue'
import { ApiError } from '../lib/api'

const { listReportletTree, readReportletContent } = vi.hoisted(() => ({
  listReportletTree: vi.fn(),
  readReportletContent: vi.fn()
}))

vi.mock('../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../lib/api')>('../lib/api')
  return {
    ...actual,
    listReportletTree,
    readReportletContent
  }
})

afterEach(() => {
  listReportletTree.mockReset()
  readReportletContent.mockReset()
})

describe('ReportletView', () => {
  it('loads the reportlet tree on mount', async () => {
    listReportletTree.mockResolvedValue([
      {
        name: 'sales',
        path: 'sales',
        kind: 'directory',
        children: [
          {
            name: 'demo.cpt',
            path: 'sales/demo.cpt',
            kind: 'file',
            children: []
          }
        ]
      }
    ])
    readReportletContent.mockResolvedValue({
      name: 'demo.cpt',
      path: 'sales/demo.cpt',
      content: 'hello',
      encoding: 'utf-8'
    })

    render(ReportletView)

    await waitFor(() => {
      expect(listReportletTree).toHaveBeenCalledTimes(1)
    })

    expect(await screen.findByText('sales/demo.cpt')).toBeInTheDocument()
  })

  it('reads selected reportlet file content', async () => {
    listReportletTree.mockResolvedValue([
      {
        name: 'sales',
        path: 'sales',
        kind: 'directory',
        children: [
          {
            name: 'demo.cpt',
            path: 'sales/demo.cpt',
            kind: 'file',
            children: []
          }
        ]
      }
    ])
    readReportletContent.mockResolvedValue({
      name: 'demo.cpt',
      path: 'sales/demo.cpt',
      content: 'hello',
      encoding: 'utf-8'
    })

    render(ReportletView)

    await fireEvent.click(await screen.findByRole('button', { name: 'sales/demo.cpt' }))

    await waitFor(() => {
      expect(readReportletContent).toHaveBeenCalledWith('sales/demo.cpt')
    })

    expect(await screen.findAllByText('sales/demo.cpt')).toHaveLength(2)
    expect(await screen.findByText('utf-8')).toBeInTheDocument()
    expect(await screen.findByText('hello')).toBeInTheDocument()
  })

  it('shows backend reportlet errors without hiding the failure', async () => {
    listReportletTree.mockResolvedValue([
      {
        name: 'sales',
        path: 'sales',
        kind: 'directory',
        children: [
          {
            name: 'demo.cpt',
            path: 'sales/demo.cpt',
            kind: 'file',
            children: []
          }
        ]
      }
    ])
    readReportletContent.mockRejectedValue(
      new ApiError(
        400,
        {
          code: 'reportlet.invalid_file',
          message: 'reportlet path must point to a file',
          detail: { path: 'sales' },
          source: 'reportlet',
          retryable: false
        },
        'API request failed: 400 Bad Request'
      )
    )

    render(ReportletView)

    await fireEvent.click(await screen.findByRole('button', { name: 'sales/demo.cpt' }))

    await waitFor(() => {
      expect(
        screen.getByText('reportlet.invalid_file: reportlet path must point to a file')
      ).toBeInTheDocument()
    })
  })
})
