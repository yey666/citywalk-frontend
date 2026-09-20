import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import axios from 'axios'
import './index.css'
import App from './App.jsx'

// 高德安全密钥
window._AMapSecurityConfig = {
  securityJsCode: import.meta.env.VITE_AMAP_SECURITY_CODE,
}

// 加载高德 JS API
const script = document.createElement('script')
script.src = `https://webapi.amap.com/maps?v=2.0&key=${import.meta.env.VITE_AMAP_JS_KEY}`
script.async = true
document.head.appendChild(script)

// axios 拦截器
axios.interceptors.request.use(config => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// ⚠️ 这里应该只有一次 createRoot
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)