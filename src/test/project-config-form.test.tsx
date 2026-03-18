import '@testing-library/jest-dom/vitest'
import { act, render, screen } from '@testing-library/react'
import {
  createDefaultProjectConfig,
  ProjectConfigForm
} from '../components/config/project-config-form'

it('renders required sync fields', async () => {
  await act(async () => {
    render(
      <ProjectConfigForm
        services={{
          loadConfig: async () => createDefaultProjectConfig(),
          saveConfig: async () => undefined
        }}
      />
    )
  })
  expect(screen.getByLabelText('Protocol')).toBeInTheDocument()
  expect(screen.getByLabelText('Local Source Dir')).toBeInTheDocument()
  expect(screen.getByLabelText('Remote Runtime Dir')).toBeInTheDocument()
  expect(screen.getByLabelText('Delete Propagation')).toBeInTheDocument()
  expect(screen.getByLabelText('Auto Sync On Change')).toBeInTheDocument()
  expect(screen.getByRole('option', { name: 'SFTP' })).toBeInTheDocument()
  expect(screen.getByRole('option', { name: 'FTP' })).toBeInTheDocument()
})
