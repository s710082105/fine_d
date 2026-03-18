import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { ProjectConfigForm } from '../components/config/project-config-form'

beforeEach(() => {
  ;(
    window as unknown as {
      __TAURI__?: { core?: { invoke: () => Promise<unknown> } }
    }
  ).__TAURI__ = {
    core: {
      invoke: () => new Promise(() => {})
    }
  }
})

it('renders required sync fields', () => {
  render(<ProjectConfigForm />)
  expect(screen.getByLabelText('Protocol')).toBeInTheDocument()
  expect(screen.getByLabelText('Local Source Dir')).toBeInTheDocument()
  expect(screen.getByLabelText('Remote Runtime Dir')).toBeInTheDocument()
  expect(screen.getByLabelText('Delete Propagation')).toBeInTheDocument()
  expect(screen.getByLabelText('Auto Sync On Change')).toBeInTheDocument()
  expect(screen.getByRole('option', { name: 'SFTP' })).toBeInTheDocument()
  expect(screen.getByRole('option', { name: 'FTP' })).toBeInTheDocument()
})
