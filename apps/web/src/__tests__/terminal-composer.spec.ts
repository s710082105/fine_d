import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import TerminalComposer from '../components/terminal/TerminalComposer.vue'

describe('TerminalComposer', () => {
  it('submits the input value on enter and clears the field', async () => {
    const view = render(TerminalComposer, {
      props: {
        disabled: false
      }
    })

    const input = screen.getByPlaceholderText('输入命令后按 Enter 发送到 Codex')

    await fireEvent.update(input, 'help')
    await fireEvent.keyDown(input, { key: 'Enter' })

    expect(view.emitted('submit')).toEqual([['help\r']])
    expect((input as HTMLInputElement).value).toBe('')
  })

  it('disables both controls when disabled is true', () => {
    render(TerminalComposer, {
      props: {
        disabled: true
      }
    })

    expect(screen.getByPlaceholderText('输入命令后按 Enter 发送到 Codex')).toBeDisabled()
    expect(screen.getByRole('button', { name: '发送' })).toBeDisabled()
  })
})
