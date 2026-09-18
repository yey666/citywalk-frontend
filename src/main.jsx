import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// 设置高德安全密钥
window._AMapSecurityConfig = {
  securityJsCode: import.meta.env.VITE_AMAP_SECURITY_CODE,
}

// 动态加载高德 JS API
const script = document.createElement('script')
script.src = `https://webapi.amap.com/maps?v=2.0&key=${import.meta.env.VITE_AMAP_JS_KEY}`
script.async = true
document.head.appendChild(script)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)