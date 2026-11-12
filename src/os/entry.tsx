import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './os.css'
import OSApp from './OSApp'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <OSApp />
  </StrictMode>,
)
