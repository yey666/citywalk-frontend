import { useState, useEffect } from 'react'
import axios from 'axios'
import GlobeComponent from './components/Globe'
import PlanPanel from './components/PlanPanel'

function App() {
  const [activeTab, setActiveTab] = useState('plan')
  const [cities, setCities] = useState([])
  const [selectedCity, setSelectedCity] = useState(null)
  const [cityRoutes, setCityRoutes] = useState([])
  const [cityPois, setCityPois] = useState([])       // 新增：城市景点列表
  const [planStops, setPlanStops] = useState([])     // 新增：计划草稿

  // 加载城市列表
  useEffect(() => {
    axios.get('/api/city/list')
      .then(res => setCities(res.data))
      .catch(err => console.error('加载城市失败：', err))
  }, [])

  // 选中城市时，加载路线 + POI
  useEffect(() => {
    if (selectedCity) {
      axios.get(`/api/city/${selectedCity.id}/routes`)
        .then(res => setCityRoutes(res.data))
        .catch(err => console.error('加载路线失败：', err))

      axios.get(`/api/poi/by-city/${selectedCity.id}`)
        .then(res => setCityPois(res.data))
        .catch(err => console.error('加载 POI 失败：', err))

      setPlanStops([])   // 切换城市时清空计划
    }
  }, [selectedCity])

  // 加入计划
  const addToPlan = (poi) => {
    if (planStops.find(s => s.poiId === poi.id)) {
      return   // 已存在，不重复加
    }
    setPlanStops([...planStops, {
      poiId: poi.id,
      name: poi.name,
      stayDuration: 60,   // 默认 60 分钟
      tip: poi.description || '',
      photoSpot: poi.photoSpot || '',
    }])
  }

  return (
    <div className="h-screen flex bg-gray-900 text-white">
      {/* 左栏：3D 地球 */}
      <div className="w-1/2 bg-black">
        <GlobeComponent
          cities={cities}
          onCityClick={(city) => {
            setSelectedCity(city)
            setCityRoutes([])
            setCityPois([])
          }}
        />
      </div>

      {/* 中栏：城市解说 + 官方路线 + 景点列表 */}
      <div className="w-1/4 bg-gray-850 border-l border-gray-700 p-4 flex flex-col overflow-y-auto">
        {selectedCity ? (
          <>
            <h2 className="text-2xl font-bold mb-3">{selectedCity.name}</h2>
            <p className="text-gray-300 text-sm leading-relaxed mb-6">
              {selectedCity.description || '暂无描述'}
            </p>

            {/* 官方推荐路线 */}
            <h3 className="text-lg font-semibold mb-3">推荐路线</h3>
            {cityRoutes.length === 0 ? (
              <p className="text-gray-500 text-sm mb-6">暂无路线</p>
            ) : (
              <div className="space-y-2 mb-6">
                {cityRoutes.map(route => (
                  <div
                    key={route.id}
                    className="bg-gray-800 p-3 rounded-lg border border-gray-700 hover:border-blue-500 cursor-pointer transition"
                  >
                    <h4 className="font-semibold mb-1 text-sm">{route.title}</h4>
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

            {/* 景点列表 */}
            <h3 className="text-lg font-semibold mb-3">景点列表</h3>
            {cityPois.length === 0 ? (
              <p className="text-gray-500 text-sm">暂无景点</p>
            ) : (
              <div className="space-y-2">
                {cityPois.map(poi => {
                  const inPlan = planStops.some(s => s.poiId === poi.id)
                  return (
                    <div
                      key={poi.id}
                      className="bg-gray-800 p-3 rounded-lg border border-gray-700 flex justify-between items-center"
                    >
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm truncate">{poi.name}</h4>
                        <p className="text-xs text-gray-500 truncate">{poi.category}</p>
                      </div>
                      <button
                        onClick={() => addToPlan(poi)}
                        disabled={inPlan}
                        className={`ml-2 px-3 py-1 rounded text-xs whitespace-nowrap ${
                          inPlan
                            ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                            : 'bg-blue-600 hover:bg-blue-700'
                        }`}
                      >
                        {inPlan ? '已加入' : '+ 加入'}
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        ) : (
          <p className="text-gray-500">点击地球上的城市查看详情</p>
        )}
      </div>

      {/* 右栏：计划 / 票价 */}
      <div className="w-1/4 bg-gray-800 border-l border-gray-700 p-4 flex flex-col overflow-hidden">
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
          <PlanPanel
            stops={planStops}
            setStops={setPlanStops}
          />
        ) : (
          <p className="text-gray-500">票价内容（待接入）</p>
        )}
      </div>
    </div>
  )
}

export default App