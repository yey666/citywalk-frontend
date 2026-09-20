/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect } from 'react'
import axios from 'axios'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

import GlobeComponent from './components/Globe'
import MapCanvas from './components/MapCanvas'
import LoginPage from './pages/LoginPage'
import ProfilePage from './pages/ProfilePage'
import Navbar from './components/Navbar'

// ==================== 可拖拽项组件 ====================
function SortableStop({ stop, index, onRemove, highlighted }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: stop.poiId,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`p-3 rounded flex justify-between items-start transition-all duration-500 ${
        highlighted
          ? 'bg-green-900/40 border border-green-500'
          : 'bg-gray-800 border border-transparent'
      }`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing text-gray-500 hover:text-white text-sm px-1 select-none"
            title="拖拽调整顺序"
          >
            ≡
          </span>
          <span className="bg-blue-600 text-xs px-2 py-0.5 rounded text-white">
            {index + 1}
          </span>
          <span className="font-medium text-sm truncate text-white">{stop.name}</span>
        </div>
        <p className="text-xs text-gray-400 mt-1 ml-8">{stop.stayDuration} 分钟</p>
      </div>
      <button
        onClick={() => onRemove(stop.poiId)}
        className="text-gray-400 hover:text-red-400 text-xs ml-2"
      >
        ✕
      </button>
    </div>
  )
}

// ==================== 主组件 ====================
function App() {
  // ========== 1. State ==========
  const [user, setUser] = useState(null)
  const [checkingAuth, setCheckingAuth] = useState(true)

  const [page, setPage] = useState(localStorage.getItem('page') || 'home')
  const [mode, setMode] = useState(localStorage.getItem('mode') || 'explore')

  const [cities, setCities] = useState([])
  const [selectedCity, setSelectedCity] = useState(() => {
    const saved = localStorage.getItem('selectedCity')
    return saved ? JSON.parse(saved) : null
  })

  const [cityPois, setCityPois] = useState([])
  const [cityRoutes, setCityRoutes] = useState([])
  const [planStops, setPlanStops] = useState([])

  const [leftOpen, setLeftOpen] = useState(true)
  const [rightOpen, setRightOpen] = useState(true)
  const [leftTab, setLeftTab] = useState('pois')

  const [toast, setToast] = useState(null)

  const [saving, setSaving] = useState(false)
  const [optimizing, setOptimizing] = useState(false)
  const [originalDistance, setOriginalDistance] = useState(null)
  const [optimizedDistance, setOptimizedDistance] = useState(null)
  const [savedDistance, setSavedDistance] = useState(null)
  const [highlightedIds, setHighlightedIds] = useState(new Set())

  // ========== 2. useSensors ==========
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  )

  // ========== 3. useEffect ==========
  // 检查登录态
  useEffect(() => {
    const token = localStorage.getItem('token')
    const userId = localStorage.getItem('userId')
    if (token && userId) {
      setUser({ token, userId })
    }
    setCheckingAuth(false)
  }, [])

  // 加载城市列表
  useEffect(() => {
    axios.get('/api/city/list')
      .then(res => setCities(res.data))
      .catch(err => console.error('加载城市失败：', err))
  }, [])

  // 选中城市时加载 POI + 路线
  useEffect(() => {
    if (selectedCity) {
      axios.get(`/api/poi/by-city/${selectedCity.id}`)
        .then(res => setCityPois(res.data))
        .catch(err => console.error('加载 POI 失败：', err))

      axios.get(`/api/city/${selectedCity.id}/routes`)
        .then(res => setCityRoutes(res.data))
        .catch(err => console.error('加载路线失败：', err))
    }
  }, [selectedCity])

  // selectedCity 同步到 localStorage
  useEffect(() => {
    if (selectedCity) {
      localStorage.setItem('selectedCity', JSON.stringify(selectedCity))
    } else {
      localStorage.removeItem('selectedCity')
    }
  }, [selectedCity])

  // ========== 4. 登录判断 ==========
  if (checkingAuth) {
    return <div className="h-screen w-screen bg-gray-950" />
  }

  if (!user) {
    return <LoginPage onLogin={(data) => setUser(data)} />
  }

  // ========== 5. 所有函数定义 ==========
  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('userId')
    localStorage.removeItem('username')
    localStorage.removeItem('nickname')
    localStorage.removeItem('page')
    localStorage.removeItem('mode')
    localStorage.removeItem('selectedCity')
    setUser(null)
    setMode('explore')
    setPage('home')
    setSelectedCity(null)
    setPlanStops([])
  }

  const goHome = () => {
    setPage('home')
    localStorage.setItem('page', 'home')
  }

  const goProfile = () => {
    setPage('profile')
    localStorage.setItem('page', 'profile')
  }

  const handleCityClick = (city) => {
    setSelectedCity(city)
    setCityPois([])
    setPlanStops([])
    setMode('planning')
    localStorage.setItem('mode', 'planning')
  }

  const handleBack = () => {
    setMode('explore')
    setSelectedCity(null)
    setPlanStops([])
    localStorage.setItem('mode', 'explore')
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

  const addRouteToPlan = async (routeId) => {
    try {
      const res = await axios.get(`/api/route/${routeId}`)
      const route = res.data

      const newNodeStops = route.nodes
        .filter(node => !planStops.find(s => s.poiId === node.poiId))
        .map(node => ({
          poiId: node.poiId,
          name: node.poiName,
          lng: node.lng,
          lat: node.lat,
          stayDuration: node.stayDuration,
          tip: node.tip || '',
        }))

      if (newNodeStops.length === 0) {
        setToast('该路线的景点已全部在计划中')
        setTimeout(() => setToast(null), 2000)
        return
      }

      setPlanStops([...planStops, ...newNodeStops])
      setToast(`已加入「${route.title}」的 ${newNodeStops.length} 个景点`)
      setTimeout(() => setToast(null), 2500)
    } catch (err) {
      console.error('加入路线失败：', err)
      setToast('加入失败')
      setTimeout(() => setToast(null), 2000)
    }
  }

  const removeFromPlan = (poiId) => {
    setPlanStops(planStops.filter(s => s.poiId !== poiId))
  }

  const clearPlan = () => {
    if (confirm('确定清空计划？')) {
      setPlanStops([])
      setOriginalDistance(null)
      setOptimizedDistance(null)
      setSavedDistance(null)
    }
  }

  const handleSave = async () => {
    if (saving) return
    if (!selectedCity || planStops.length === 0) {
      setToast('请先添加景点')
      setTimeout(() => setToast(null), 2000)
      return
    }

    setSaving(true)
    try {
      const totalMinutes = planStops.reduce((sum, s) => sum + s.stayDuration, 0)
      await axios.post('/api/route/save-draft', {
        cityId: selectedCity.id,
        title: `${selectedCity.name} · ${planStops.length} 个景点的计划`,
        theme: '混合',
        duration: Math.ceil(totalMinutes / 60),
        difficulty: '轻松',
        nodes: planStops.map((stop, idx) => ({
          poiId: stop.poiId,
          sortOrder: idx + 1,
          stayDuration: stop.stayDuration,
          tip: stop.tip,
        })),
      })
      setToast('保存成功！已加入「我的计划」')
      setTimeout(() => setToast(null), 2000)
    } catch (err) {
      console.error('保存失败：', err)
      setToast('保存失败：' + (err.response?.data?.message || err.message))
      setTimeout(() => setToast(null), 3000)
    } finally {
      setSaving(false)
    }
  }

  const handleDragEnd = (event) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      const oldIndex = planStops.findIndex(s => s.poiId === active.id)
      const newIndex = planStops.findIndex(s => s.poiId === over.id)
      setPlanStops(arrayMove(planStops, oldIndex, newIndex))
      setOriginalDistance(null)
      setOptimizedDistance(null)
      setSavedDistance(null)
    }
  }

  const handleOptimize = async () => {
    if (optimizing) return
    if (planStops.length < 2) {
      setToast('至少需要 2 个景点才能优化')
      setTimeout(() => setToast(null), 2000)
      return
    }

    setOptimizing(true)
    const beforeIds = planStops.map(s => s.poiId)

    try {
      const res = await axios.post('/api/route/draft/optimize', {
        nodes: planStops.map(stop => ({
          poiId: stop.poiId,
          name: stop.name,
          lat: stop.lat,
          lng: stop.lng,
          stayDuration: stop.stayDuration,
          tip: stop.tip,
        })),
      })

      const data = res.data

      setTimeout(() => {
        const optimized = data.optimizedNodes.map(node => ({
          poiId: node.poiId,
          name: node.name,
          lng: node.lng,
          lat: node.lat,
          stayDuration: node.stayDuration,
          tip: node.tip || '',
        }))

        const afterIds = optimized.map(n => n.poiId)
        const changedIds = new Set()
        beforeIds.forEach((id, idx) => {
          if (afterIds[idx] !== id) changedIds.add(id)
        })

        setPlanStops(optimized)
        setOriginalDistance(data.originalDistance)
        setOptimizedDistance(data.optimizedDistance)
        setSavedDistance(data.savedDistance)
        setHighlightedIds(changedIds)
        setTimeout(() => setHighlightedIds(new Set()), 3000)
        setOptimizing(false)

        setToast(data.savedDistance > 0 ? 'AI 已优化路线顺序' : '当前顺序已经是最优')
        setTimeout(() => setToast(null), 2500)
      }, 800)
    } catch (err) {
      console.error('优化失败：', err)
      setToast('优化失败：' + (err.response?.data?.message || err.message))
      setTimeout(() => setToast(null), 3000)
      setOptimizing(false)
    }
  }

  // ========== 6. 页面切换 ==========
  if (page === 'profile') {
    return <ProfilePage onLogout={handleLogout} onGoHome={goHome} />
  }

  // ========== 7. 探索态 ==========
  if (mode === 'explore') {
    return (
      <div className="h-screen w-screen flex flex-col bg-black">
        <Navbar
          onLogout={handleLogout}
          onGoProfile={goProfile}
          onGoHome={goHome}
          currentPage={page}
        />
        <div className="flex-1 relative overflow-hidden">
          <GlobeComponent cities={cities} onCityClick={handleCityClick} />
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

  // ========== 8. 规划态 ==========
  return (
    <div className="h-screen w-screen flex flex-col bg-gray-900">
      <Navbar
        onLogout={handleLogout}
        onGoProfile={goProfile}
        onGoHome={goHome}
        currentPage={page}
      />

      <div className="flex-1 relative overflow-hidden">
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
          <button
            onClick={handleSave}
            disabled={saving}
            className={`px-4 py-2 rounded text-sm font-semibold transition ${
              saving ? 'bg-gray-600 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {saving ? '保存中...' : '保存路线'}
          </button>
        </div>

        {/* 左浮层 */}
        <div
          className={`absolute left-4 top-20 w-80 rounded-xl shadow-2xl border border-gray-600 z-40 transition-transform duration-300 flex flex-col ${
            leftOpen ? 'translate-x-0' : '-translate-x-[340px]'
          }`}
          style={{
            maxHeight: 'calc(100vh - 160px)',
            background: 'rgba(17, 24, 39, 0.98)',
            color: 'white',
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

            {/* Tab */}
            <div className="flex mb-4 bg-gray-800/60 rounded-lg p-1">
              <button
                onClick={() => setLeftTab('pois')}
                className={`flex-1 py-2 rounded-md text-xs font-medium transition ${
                  leftTab === 'pois' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                景点列表（{cityPois.length}）
              </button>
              <button
                onClick={() => setLeftTab('routes')}
                className={`flex-1 py-2 rounded-md text-xs font-medium transition ${
                  leftTab === 'routes' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                推荐路线（{cityRoutes.length}）
              </button>
            </div>

            {/* 景点列表 */}
            {leftTab === 'pois' && (
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
            )}

            {/* 推荐路线 */}
            {leftTab === 'routes' && (
              <div className="space-y-3">
                {cityRoutes.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-8">暂无推荐路线</p>
                ) : (
                  cityRoutes.map(route => (
                    <div
                      key={route.id}
                      className="bg-gray-800 p-3 rounded-lg border border-gray-700 hover:border-blue-500 transition"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-semibold text-sm text-white flex-1">{route.title}</h4>
                        <button
                          onClick={() => addRouteToPlan(route.id)}
                          className="ml-2 px-3 py-1 rounded text-xs bg-blue-600 hover:bg-blue-700 text-white whitespace-nowrap transition"
                        >
                          + 加入
                        </button>
                      </div>
                      <div className="flex gap-2 text-xs text-gray-400 mb-2">
                        <span>{route.theme}</span>
                        <span>·</span>
                        <span>{route.duration} 小时</span>
                        <span>·</span>
                        <span>{route.difficulty}</span>
                      </div>
                      <p className="text-xs text-gray-500 leading-relaxed">{route.description}</p>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* 左浮层收起按钮 */}
        {!leftOpen && (
          <button
            onClick={() => setLeftOpen(true)}
            className="absolute left-4 top-20 bg-gray-900/95 backdrop-blur px-3 py-2 rounded shadow-lg border border-gray-700 z-40 text-white"
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
            maxHeight: 'calc(100vh - 160px)',
            background: 'rgba(17, 24, 39, 0.98)',
            color: 'white',
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

          {/* 距离信息 */}
          {originalDistance !== null && (
            <div className="px-4 py-3 border-b border-gray-700 bg-gray-800/50 flex-shrink-0">
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">总距离</span>
                <span className="text-white">
                  {optimizedDistance} km
                  {savedDistance > 0 && (
                    <span className="text-green-400 ml-2">↓ {savedDistance} km</span>
                  )}
                </span>
              </div>
              {savedDistance > 0 && (
                <div className="flex justify-between text-xs mt-1">
                  <span className="text-gray-500">优化前</span>
                  <span className="text-gray-500 line-through">{originalDistance} km</span>
                </div>
              )}
            </div>
          )}

          {/* 计划列表 */}
          <div className="overflow-y-auto p-4 flex-1">
            {planStops.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">
                还没有添加景点
                <br />
                从左侧列表或地图上点击景点加入
              </p>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={planStops.map(s => s.poiId)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2">
                    {planStops.map((stop, idx) => (
                      <SortableStop
                        key={stop.poiId}
                        stop={stop}
                        index={idx}
                        onRemove={removeFromPlan}
                        highlighted={highlightedIds.has(stop.poiId)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
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
              <button
                onClick={handleOptimize}
                disabled={optimizing}
                className={`flex-1 rounded py-2 text-sm font-semibold transition text-white ${
                  optimizing ? 'bg-gray-600 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {optimizing ? 'AI 优化中...' : 'AI 优化'}
              </button>
            </div>
          )}
        </div>

        {/* 右浮层收起按钮 */}
        {!rightOpen && (
          <button
            onClick={() => setRightOpen(true)}
            className="absolute right-4 top-20 bg-gray-900/95 backdrop-blur px-3 py-2 rounded shadow-lg border border-gray-700 z-40 text-white"
          >
            ◀
          </button>
        )}

        {/* Toast */}
        {toast && (
          <div
            className="absolute top-24 left-1/2 -translate-x-1/2 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg z-50"
            style={{ animation: 'fadeIn 0.3s ease-out' }}
          >
            {toast}
          </div>
        )}
      </div>
    </div>
  )
}

export default App