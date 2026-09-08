import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/fraunces/latin-300.css'
import '@fontsource/fraunces/latin-300-italic.css'
import '@fontsource/fraunces/latin-400-italic.css'
import '@fontsource/fraunces/latin-600.css'
import '@fontsource/geist-sans/latin-400.css'
import '@fontsource/geist-sans/latin-500.css'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
