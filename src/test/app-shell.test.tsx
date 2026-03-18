import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import App from '../App'

it('renders config and chat regions', () => {
  render(<App />)
  expect(screen.getByText('Style Config')).toBeInTheDocument()
  expect(screen.getByText('Codex Session')).toBeInTheDocument()
})
