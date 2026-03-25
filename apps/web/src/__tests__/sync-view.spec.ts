import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/vue'
import { afterEach, describe, expect, it, vi } from 'vitest'

import SyncView from '../views/SyncView.vue'
import { ApiError } from '../lib/api'

const { runSyncAction } = vi.hoisted(() => ({
  runSyncAction: vi.fn()
}))

vi.mock('../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../lib/api')>('../lib/api')
  return {
    ...actual,
    runSyncAction
  }
})

afterEach(() => {
  runSyncAction.mockReset()
})

describe('SyncView', () => {
  it('runs a sync action and renders the result payload', async () => {
    runSyncAction.mockResolvedValue({
      action: 'sync_file',
      status: 'verified',
      target_path: 'reportlets/demo.cpt',
      remote_path: 'reportlets/demo.cpt'
    })

    render(SyncView)

    await fireEvent.update(screen.getByLabelText('同步动作'), 'sync_file')
    await fireEvent.update(screen.getByLabelText('目标路径'), 'reportlets/demo.cpt')
    await fireEvent.click(screen.getByRole('button', { name: '执行同步' }))

    await waitFor(() => {
      expect(runSyncAction).toHaveBeenCalledWith('sync_file', 'reportlets/demo.cpt')
    })

    expect(
      await screen.findByText((_, element) => {
        return element?.tagName === 'DD' && element.textContent === 'sync_file'
      })
    ).toBeInTheDocument()
    expect(await screen.findByText('verified')).toBeInTheDocument()
    expect(await screen.findAllByText('reportlets/demo.cpt')).toHaveLength(2)
  })

  it('shows backend sync errors without hiding the failure', async () => {
    runSyncAction.mockRejectedValue(
      new ApiError(
        400,
        {
          code: 'sync.missing_target_path',
          message: 'sync action requires a target path',
          detail: { action: 'sync_file', status: 'failed' },
          source: 'sync',
          retryable: false
        },
        'API request failed: 400 Bad Request'
      )
    )

    render(SyncView)

    await fireEvent.update(screen.getByLabelText('同步动作'), 'sync_file')
    await fireEvent.click(screen.getByRole('button', { name: '执行同步' }))

    await waitFor(() => {
      expect(
        screen.getByText('sync.missing_target_path: sync action requires a target path')
      ).toBeInTheDocument()
    })
  })

  it('calls publish_project without target_path when field is blank', async () => {
    runSyncAction.mockResolvedValue({
      action: 'publish_project',
      status: 'verified',
      target_path: null,
      remote_path: null
    })

    render(SyncView)

    await fireEvent.update(screen.getByLabelText('同步动作'), 'publish_project')
    await fireEvent.update(screen.getByLabelText('目标路径'), '')
    await fireEvent.click(screen.getByRole('button', { name: '执行同步' }))

    await waitFor(() => {
      expect(runSyncAction).toHaveBeenCalledWith('publish_project', undefined)
    })
  })
})
