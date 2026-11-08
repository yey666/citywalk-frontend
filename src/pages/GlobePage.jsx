import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import GlobeComponent from '../components/Globe'
import { useAuth } from '../context/AuthContext'

export default function GlobePage() {
  const navigate = useNavigate()
  const { logout } = useAuth()
  const nickname = localStorage.getItem('nickname') || '用户'
  const [cities, setCities] = useState([])
  const [status, setStatus] = useState('loading') // loading | error | ready
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    axios.get('/api/city/list')
      .then(res => {
        setCities(Array.isArray(res.data) ? res.data : [])
        setStatus('ready')
      })
      .catch(err => {
        console.error('加载城市失败：', err)
        setErrorMsg(err.response?.data?.message || err.message || '加载城市失败')
        setStatus('error')
      })
  }, [])

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="h-full w-full flex flex-col">
      {/* 顶部：居中悬浮深色毛玻璃胶囊导航 */}
      <nav className="fixed top-4 left-1/2 -translate-x-1/2 w-[95%] max-w-7xl h-14 bg-slate-900/60 backdrop-blur-md border border-white/10 rounded-full shadow-lg z-50 flex items-center justify-between px-8 text-white">
        <div
          className="font-bold text-white tracking-wide cursor-pointer"
          onClick={() => navigate('/')}
        >
          Citywalk
        </div>
        <div className="flex items-center gap-6 text-sm">
          <button onClick={() => navigate('/')} className="text-white transition">首页</button>
          <button onClick={() => navigate('/community')} className="text-gray-400 hover:text-white transition">社区</button>
          <button onClick={() => navigate('/profile')} className="text-gray-400 hover:text-white transition">我的</button>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-gray-300">{nickname}</span>
          <button onClick={handleLogout} className="text-gray-400 hover:text-red-300/80 transition">退出</button>
        </div>
      </nav>

      <div className="flex-1 relative overflow-hidden">
        <GlobeComponent
          cities={cities}
          onCityClick={(city) => navigate(`/city/${city.id}`)}
        />

        {/* 接口错误提示 */}
        {status === 'error' && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-red-900/50 text-red-200 border border-red-700/40 backdrop-blur px-5 py-2.5 rounded-lg shadow-lg z-50 text-sm">
            城市加载失败：{errorMsg}
          </div>
        )}

        {/* 底部引导：深色半透明毛玻璃卡片 */}
        <div className="absolute bottom-12 left-0 right-0 flex justify-center pointer-events-none z-10">
          <div className="bg-slate-900/40 backdrop-blur-md border border-white/10 rounded-2xl px-8 py-5 shadow-2xl text-center pointer-events-auto">
            {status === 'ready' && cities.length === 0 ? (
              <p className="text-gray-200 text-lg">暂无城市</p>
            ) : (
              <>
                <p className="text-gray-200 text-lg">
                  点击地球上的城市，开始你的 Citywalk
                </p>
                {cities.length > 0 && (
                  <div className="mt-3 flex flex-wrap justify-center items-center gap-x-2 gap-y-1 text-base">
                    {cities.map((city, idx) => (
                      <span key={city.id} className="flex items-center gap-x-2">
                        {idx > 0 && <span className="text-gray-500 select-none">·</span>}
                        <button
                          onClick={() => navigate(`/city/${city.id}`)}
                          className="text-gray-300 hover:text-blue-400 transition-colors cursor-pointer"
                        >
                          {city.name}
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
