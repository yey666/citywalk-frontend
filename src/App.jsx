import { useState, useEffect } from 'react'
import axios from 'axios'
import GlobeComponent from './components/Globe'
import MapCanvas from './components/MapCanvas'

function App() {
  const [mode, setMode] = useState('explore')
  const [cities, setCities] = useState([])
  const [selectedCity, setSelectedCity] = useState(null)
  const [cityPois, setCityPois] = useState([])
  const [planStops, setPlanStops] = useState([])
  const [leftOpen, setLeftOpen] = useState(true)
  const [rightOpen, setRightOpen] = useState(true)
  const [toast, setToast] = useState(null)

  // 加载城市列表
  useEffect(() => {
    axios.get('/api/city/list')
      .then(res => setCities(res.data))
      .catch(err => console.error('加载城市失败：', err))
  }, [])

  // 选中城市时加载 POI
  useEffect(() => {
    if (selectedCity) {
      axios.get(`/api/poi/by-city/${selectedCity.id}`)
        .then(res => setCityPois(res.data))
        .catch(err => console.error('加载 POI 失败：', err))
    }
  }, [selectedCity])

  const handleCityClick = (city) => {
    setSelectedCity(city)
    setCityPois([])
    setPlanStops([])
    setMode('planning')
  }

  const handleBack = () => {
    setMode('explore')
    setSelectedCity(null)
    setPlanStops([])
  }

  const addToPlan = (poi) => {
    if (planStops.find(s => s.poiId === poi.id)) return
    setPlanStops([
      ...planStops,
      {
        poiId: poi.id,
        name: poi.name,
        lng: poi.lng,
        lat: poi.lat,
        stayDuration: 60,
        tip: poi.description || '',
      },
    ])
    setToast(`已加入：${poi.name}`)
    setTimeout(() => setToast(null), 2000)
  }

  const removeFromPlan = (poiId) => {
    setPlanStops(planStops.filter(s => s.poiId !== poiId))
  }

  const clearPlan = () => {
    if (confirm('确定清空计划？')) {
      setPlanStops([])
    }
  }

  // ========== 入场态 ==========
  if (mode === 'explore') {
    return (
      <div className="h-screen w-screen bg-black relative overflow-hidden">
        <GlobeComponent cities={cities} onCityClick={handleCityClick} />
        <div className="absolute top-6 left-8 text-white pointer-events-none">
          <h1 className="text-2xl font-bold tracking-wide">Citywalk</h1>
          <p className="text-xs text-gray-400 mt-1">AI 旅行规划平台</p>
        </div>
        <div className="absolute bottom-12 left-0 right-0 text-center pointer-events-none">
          <p className="text-gray-300 text-lg animate-pulse">
            点击地球上的城市，开始你的 Citywalk
          </p>
          <p className="text-gray-500 text-sm mt-2">
            佛山 · 广州 · 珠海 · 苏州 · 成都 · 西安 · 杭州 · 厦门
          </p>
        </div>
      </div>
    )
  }

  // ========== 规划态 ==========
  return (
    <div className="h-screen w-screen relative overflow-hidden bg-gray-900">
      {/* 全屏 2D 地图 */}
      <div className="absolute inset-0 z-0">
        <MapCanvas
          center={selectedCity ? { lng: selectedCity.lng, lat: selectedCity.lat } : null}
          allPois={cityPois}
          planStops={planStops}
          onPoiClick={(poi) => addToPlan(poi)}
        />
      </div>

      {/* 顶部条 */}
      <div
        className="absolute top-0 left-0 right-0 h-16 flex items-center justify-between px-4 z-50 border-b border-gray-700"
        style={{ background: 'rgba(17, 24, 39, 0.98)' }}
      >
        <button
          onClick={handleBack}
          className="bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded text-sm transition"
        >
          ← 返回
        </button>
        <div className="text-lg font-semibold">{selectedCity?.name}</div>
        <button className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded text-sm font-semibold transition">
          保存路线
        </button>
      </div>

        {/* 左浮层 */}
      <div
        className={`absolute left-4 top-20 w-80 rounded-xl shadow-2xl border border-gray-600 z-40 transition-transform duration-300 flex flex-col ${
          leftOpen ? 'translate-x-0' : '-translate-x-[340px]'
        }`}
        style={{
          maxHeight: 'calc(100vh - 120px)',
          background: 'rgba(17, 24, 39, 0.98)',
          color: 'white',   // ← 加这行
        }}
      >
        <div className="p-4 border-b border-gray-700 flex justify-between items-center flex-shrink-0">
          <h3 className="font-semibold text-white">{selectedCity?.name}景点</h3>
          <button
            onClick={() => setLeftOpen(false)}
            className="text-gray-400 hover:text-white text-sm"
          >
            ◀
          </button>
        </div>
        <div className="overflow-y-auto p-4 flex-1">
          <p className="text-sm text-gray-300 mb-4">{selectedCity?.description}</p>
          <h4 className="text-sm font-semibold mb-2 text-white">
            景点列表（{cityPois.length}）
          </h4>
          <div className="space-y-2">
            {cityPois.map(poi => {
              const inPlan = planStops.some(s => s.poiId === poi.id)
              return (
                <div
                  key={poi.id}
                  className="bg-gray-800 p-2 rounded flex justify-between items-center text-sm"
                >
                  <span className="truncate flex-1 text-white">{poi.name}</span>
                  <button
                    onClick={() => addToPlan(poi)}
                    disabled={inPlan}
                    className={`ml-2 px-2 py-0.5 rounded text-xs whitespace-nowrap transition ${
                      inPlan
                        ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
                  >
                    {inPlan ? '已加' : '+ 加入'}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      </div>
      {/* 左浮层收起按钮 */}
      {!leftOpen && (
        <button
          onClick={() => setLeftOpen(true)}
          className="absolute left-4 top-20 bg-gray-900/95 backdrop-blur px-3 py-2 rounded shadow-lg border border-gray-700 z-40"
        >
          ▶
        </button>
      )}

        {/* 右浮层 */}
      <div
        className={`absolute right-4 top-20 w-80 rounded-xl shadow-2xl border border-gray-600 z-40 transition-transform duration-300 flex flex-col ${
          rightOpen ? 'translate-x-0' : 'translate-x-[340px]'
        }`}
        style={{
          maxHeight: 'calc(100vh - 120px)',
          background: 'rgba(17, 24, 39, 0.98)',
          color: 'white',   // ← 加这行
        }}
      >
        <div className="p-4 border-b border-gray-700 flex justify-between items-center flex-shrink-0">
          <h3 className="font-semibold text-white">我的计划（{planStops.length}）</h3>
          <button
            onClick={() => setRightOpen(false)}
            className="text-gray-400 hover:text-white text-sm"
          >
            ▶
          </button>
        </div>
        <div className="overflow-y-auto p-4 flex-1">
          {planStops.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">
              还没有添加景点
              <br />
              从左侧列表或地图上点击景点加入
            </p>
          ) : (
            <div className="space-y-2">
              {planStops.map((stop, idx) => (
                <div
                  key={stop.poiId}
                  className="bg-gray-800 p-3 rounded flex justify-between items-start"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="bg-blue-600 text-xs px-2 py-0.5 rounded text-white">
                        {idx + 1}
                      </span>
                      <span className="font-medium text-sm truncate text-white">{stop.name}</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1 ml-8">
                      {stop.stayDuration} 分钟
                    </p>
                  </div>
                  <button
                    onClick={() => removeFromPlan(stop.poiId)}
                    className="text-gray-400 hover:text-red-400 text-xs ml-2"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        {planStops.length > 0 && (
          <div className="p-4 border-t border-gray-700 flex gap-2 flex-shrink-0">
            <button
              onClick={clearPlan}
              className="flex-1 bg-gray-700 hover:bg-gray-600 rounded py-2 text-sm transition text-white"
            >
              清空
            </button>
            <button className="flex-1 bg-blue-600 hover:bg-blue-700 rounded py-2 text-sm font-semibold transition text-white">
              AI 优化
            </button>
          </div>
        )}
      </div>

      {/* 右浮层收起按钮 */}
      {!rightOpen && (
        <button
          onClick={() => setRightOpen(true)}
          className="absolute right-4 top-20 bg-gray-900/95 backdrop-blur px-3 py-2 rounded shadow-lg border border-gray-700 z-40"
        >
          ◀
        </button>
      )}

      {/* Toast */}
      {toast && (
        <div
          className="absolute top-20 left-1/2 -translate-x-1/2 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg z-50"
          style={{ animation: 'fadeIn 0.3s ease-out' }}
        >
          {toast}
        </div>
      )}
    </div>
  )
}

export default App