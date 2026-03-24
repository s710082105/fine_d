import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/vue'

import App from '../App.vue'

it('renders the local tool shell title', () => {
  render(App)

  expect(screen.getByText('FineReport Local Tool')).toBeInTheDocument()
})
