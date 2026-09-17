import { useState, useEffect } from 'react'
import axios from 'axios'
import GlobeComponent from './components/Globe'

function App() {
  const [activeTab, setActiveTab] = useState('plan')
  const [cities, setCities] = useState([])
  const [selectedCity, setSelectedCity] = useState(null)
  const [cityRoutes, setCityRoutes] = useState([])   // 新增

  // 加载城市列表
  useEffect(() => {
    axios.get('/api/city/list')
      .then(res => setCities(res.data))
      .catch(err => console.error('加载城市失败：', err))
  }, [])

  // 选中城市时，加载该城市的官方路线（新增）
  useEffect(() => {
    if (selectedCity) {
      axios.get(`/api/city/${selectedCity.id}/routes`)
        .then(res => setCityRoutes(res.data))
        .catch(err => console.error('加载路线失败：', err))
    }
  }, [selectedCity])

  return (
    <div className="h-screen flex bg-gray-900 text-white">
      {/* 左栏：3D 地球 */}
      <div className="w-1/2 bg-black">
        <GlobeComponent
          cities={cities}
          onCityClick={(city) => {
            setSelectedCity(city)
            setCityRoutes([])   // 切换城市时清空路线
          }}
        />
      </div>

      {/* 中栏：城市解说 + 官方路线 */}
      <div className="w-1/4 bg-gray-850 border-l border-gray-700 p-4 flex flex-col overflow-y-auto">
        {selectedCity ? (
          <>
            {/* 城市解说 */}
            <h2 className="text-2xl font-bold mb-3">{selectedCity.name}</h2>
            <p className="text-gray-300 text-sm leading-relaxed mb-6">
              {selectedCity.description || '暂无描述'}
            </p>

            {/* 官方路线列表 */}
            <h3 className="text-lg font-semibold mb-3">推荐路线</h3>
            {cityRoutes.length === 0 ? (
              <p className="text-gray-500 text-sm">暂无路线</p>
            ) : (
              <div className="space-y-3">
                {cityRoutes.map(route => (
                  <div
                    key={route.id}
                    className="bg-gray-800 p-3 rounded-lg border border-gray-700 hover:border-blue-500 cursor-pointer transition"
                  >
                    <h4 className="font-semibold mb-1">{route.title}</h4>
                    <div className="flex gap-2 text-xs text-gray-400">
                      <span>{route.theme}</span>
                      <span>·</span>
                      <span>{route.duration} 小时</span>
                      <span>·</span>
                      <span>{route.difficulty}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <p className="text-gray-500">点击地球上的城市查看详情</p>
        )}
      </div>

      {/* 右栏：计划 / 票价 */}
      <div className="w-1/4 bg-gray-800 border-l border-gray-700 p-4 flex flex-col">
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setActiveTab('plan')}
            className={`px-4 py-2 rounded ${
              activeTab === 'plan' ? 'bg-blue-600' : 'bg-gray-700'
            }`}
          >
            计划
          </button>
          <button
            onClick={() => setActiveTab('ticket')}
            className={`px-4 py-2 rounded ${
              activeTab === 'ticket' ? 'bg-blue-600' : 'bg-gray-700'
            }`}
          >
            票价
          </button>
        </div>

        {activeTab === 'plan' ? (
          <p className="text-gray-500">计划内容（待接入）</p>
        ) : (
          <p className="text-gray-500">票价内容（待接入）</p>
        )}
      </div>
    </div>
  )
}

export default App