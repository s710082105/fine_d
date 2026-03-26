import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/vue'
import { vi } from 'vitest'

import App from '../App.vue'

vi.mock('../components/terminal/xterm-adapter', () => ({
  createTerminalAdapter: () => ({
    write: () => undefined,
    clear: () => undefined,
    destroy: () => undefined,
    focus: () => undefined,
    fit: () => undefined
  })
}))

it('renders the local tool shell title', () => {
  render(App)

  expect(screen.getByText('FineReport 项目工作台')).toBeInTheDocument()
})
