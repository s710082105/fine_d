import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/app.css'
import './styles/terminal.css'

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Missing root element')
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
