import '@testing-library/jest-dom/vitest'
import { render, screen, waitFor } from '@testing-library/vue'
import { afterEach, describe, expect, it, vi } from 'vitest'

import ProjectView from '../views/ProjectView.vue'
import { ApiError } from '../lib/api'

const { getProjectConfig } = vi.hoisted(() => ({
  getProjectConfig: vi.fn()
}))

vi.mock('../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../lib/api')>('../lib/api')
  return {
    ...actual,
    getProjectConfig
  }
})

afterEach(() => {
  getProjectConfig.mockReset()
})

describe('ProjectView', () => {
  it('loads and renders project config paths', async () => {
    getProjectConfig.mockResolvedValue({
      workspace_dir: '/tmp/finereport/workspace',
      generated_dir: '/tmp/finereport/generated'
    })

    render(ProjectView)

    await waitFor(() => {
      expect(getProjectConfig).toHaveBeenCalledTimes(1)
    })

    expect(
      await screen.findByText('/tmp/finereport/workspace')
    ).toBeInTheDocument()
    expect(
      await screen.findByText('/tmp/finereport/generated')
    ).toBeInTheDocument()
  })

  it('shows backend request errors without hiding the failure', async () => {
    getProjectConfig.mockRejectedValue(
      new ApiError(
        400,
        {
          code: 'project.invalid_config',
          message: 'project config is invalid',
          detail: { field: 'workspace_dir' },
          source: 'project',
          retryable: false
        },
        'API request failed: 400 Bad Request'
      )
    )

    render(ProjectView)

    await waitFor(() => {
      expect(
        screen.getByText('project.invalid_config: project config is invalid')
      ).toBeInTheDocument()
    })
  })
})
