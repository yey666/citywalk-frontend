import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import GlobeComponent from '../components/Globe'
import Navbar from '../components/Navbar'

export default function GlobePage() {
  const navigate = useNavigate()
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

  return (
    <div className="h-full w-full flex flex-col">
      <Navbar currentPage="home" />
      <div className="flex-1 relative overflow-hidden">
        <GlobeComponent
          cities={cities}
          onCityClick={(city) => navigate(`/city/${city.id}`)}
        />

        {/* 接口错误提示 */}
        {status === 'error' && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-red-500/90 text-white px-5 py-2.5 rounded-lg shadow-lg z-50 text-sm">
            城市加载失败：{errorMsg}
          </div>
        )}

        <div className="absolute bottom-12 left-0 right-0 text-center pointer-events-none">
          {status === 'ready' && cities.length === 0 ? (
            <p className="text-gray-300 text-lg animate-pulse">暂无城市</p>
          ) : (
            <>
              <p className="text-gray-300 text-lg animate-pulse">
                点击地球上的城市，开始你的 Citywalk
              </p>
              <p className="text-gray-300 text-sm mt-2">
                佛山 · 广州 · 珠海 · 苏州 · 成都 · 西安 · 杭州 · 厦门
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
