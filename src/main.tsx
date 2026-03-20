import React from 'react'
import ReactDOM from 'react-dom/client'
import 'antd/dist/reset.css'
import App from './App'
import './styles/app.css'
import './styles/config.css'
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
