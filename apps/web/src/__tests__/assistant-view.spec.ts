import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/vue'
import { afterEach, describe, expect, it, vi } from 'vitest'

import AssistantView from '../views/AssistantView.vue'

const { routeAssistantPrompt } = vi.hoisted(() => ({
  routeAssistantPrompt: vi.fn()
}))

vi.mock('../lib/api', () => ({
  routeAssistantPrompt
}))

afterEach(() => {
  routeAssistantPrompt.mockReset()
})

describe('AssistantView', () => {
  it('routes a prompt and renders the suggested module actions', async () => {
    routeAssistantPrompt.mockResolvedValue({
      prompt: '请帮我同步并发布到远端',
      status: 'routed',
      module: 'sync',
      actions: ['publish_project', 'verify_remote_state'],
      message: '推荐走同步模块。'
    })

    render(AssistantView)

    await fireEvent.update(
      screen.getByLabelText('任务描述'),
      '请帮我同步并发布到远端'
    )
    await fireEvent.click(screen.getByRole('button', { name: '分析任务' }))

    await waitFor(() => {
      expect(routeAssistantPrompt).toHaveBeenCalledWith('请帮我同步并发布到远端')
    })

    expect(screen.getByText('推荐模块')).toBeInTheDocument()
    expect(screen.getByText('sync')).toBeInTheDocument()
    expect(screen.getByText('publish_project')).toBeInTheDocument()
    expect(screen.getByText('verify_remote_state')).toBeInTheDocument()
    expect(screen.getByText('推荐走同步模块。')).toBeInTheDocument()
  })

  it('shows request errors without hiding the backend failure', async () => {
    routeAssistantPrompt.mockRejectedValue(
      new Error('API request failed: 400 Bad Request')
    )

    render(AssistantView)

    await fireEvent.update(screen.getByLabelText('任务描述'), '   ')
    await fireEvent.click(screen.getByRole('button', { name: '分析任务' }))

    await waitFor(() => {
      expect(
        screen.getByText('API request failed: 400 Bad Request')
      ).toBeInTheDocument()
    })
  })
})
