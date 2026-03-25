import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/vue'
import { afterEach, describe, expect, it, vi } from 'vitest'

import PreviewView from '../views/PreviewView.vue'
import { ApiError } from '../lib/api'

const { openPreview } = vi.hoisted(() => ({
  openPreview: vi.fn()
}))

vi.mock('../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../lib/api')>('../lib/api')
  return {
    ...actual,
    openPreview
  }
})

afterEach(() => {
  openPreview.mockReset()
})

describe('PreviewView', () => {
  it('opens preview and renders the session payload', async () => {
    openPreview.mockResolvedValue({
      session_id: 'preview-session-1',
      url: 'http://127.0.0.1:8075/webroot/decision',
      status: 'opened'
    })

    render(PreviewView)

    await fireEvent.update(
      screen.getByLabelText('预览 URL'),
      'http://127.0.0.1:8075/webroot/decision'
    )
    await fireEvent.click(screen.getByRole('button', { name: '打开预览' }))

    await waitFor(() => {
      expect(openPreview).toHaveBeenCalledWith(
        'http://127.0.0.1:8075/webroot/decision'
      )
    })

    expect(await screen.findByText('preview-session-1')).toBeInTheDocument()
    expect(await screen.findByText('opened')).toBeInTheDocument()
    expect(
      await screen.findByText('http://127.0.0.1:8075/webroot/decision')
    ).toBeInTheDocument()
  })

  it('shows backend preview errors without hiding the failure', async () => {
    openPreview.mockRejectedValue(
      new ApiError(
        400,
        {
          code: 'preview.invalid_url',
          message: 'preview url must use http or https',
          detail: { url: 'file:///tmp/demo.cpt' },
          source: 'preview',
          retryable: false
        },
        'API request failed: 400 Bad Request'
      )
    )

    render(PreviewView)

    await fireEvent.update(screen.getByLabelText('预览 URL'), 'file:///tmp/demo.cpt')
    await fireEvent.click(screen.getByRole('button', { name: '打开预览' }))

    await waitFor(() => {
      expect(
        screen.getByText('preview.invalid_url: preview url must use http or https')
      ).toBeInTheDocument()
    })
  })
})
