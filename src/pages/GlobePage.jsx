import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import GlobeComponent from '../components/Globe'
import Navbar from '../components/Navbar'

export default function GlobePage() {
  const navigate = useNavigate()
  const [cities, setCities] = useState([])

  useEffect(() => {
    axios.get('/api/city/list')
      .then(res => setCities(res.data))
      .catch(err => console.error('加载城市失败：', err))
  }, [])

  return (
    <div className="h-full w-full flex flex-col bg-black">
      <Navbar currentPage="home" />
      <div className="flex-1 relative overflow-hidden">
        <GlobeComponent
          cities={cities}
          onCityClick={(city) => navigate(`/city/${city.id}`)}
        />
        <div className="absolute bottom-12 left-0 right-0 text-center pointer-events-none">
          <p className="text-gray-300 text-lg animate-pulse">
            点击地球上的城市，开始你的 Citywalk
          </p>
          <p className="text-gray-500 text-sm mt-2">
            佛山 · 广州 · 珠海 · 苏州 · 成都 · 西安 · 杭州 · 厦门
          </p>
        </div>
      </div>
    </div>
  )
}
