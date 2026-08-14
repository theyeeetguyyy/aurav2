import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { setPlatform } from '@/engine/platform/PlatformAdapter'
import { WebPlatform } from '@/engine/platform/WebPlatform'
import { installDevBridge } from './devBridge'

// One adapter, installed before anything can ask for it (03-ARCHITECTURE §1).
setPlatform(WebPlatform)
installDevBridge()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
