import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { isAndroidNative } from './platform/nativeRuntime'

if (isAndroidNative()) document.documentElement.classList.add('native-android')

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
