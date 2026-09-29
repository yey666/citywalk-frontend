import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
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
import Navbar from '../components/Navbar'
import MapCanvas from '../components/MapCanvas'
import { usePlan } from '../context/PlanContext'

// ==================== 搜索意图词典 ====================
const KEYWORD_MAP = {
  '吃饭': ['餐', '美食', '小吃', '饭店', 'food'],
  '饮食': ['餐', '美食', '小吃', '饭店', 'food'],
  '美食': ['餐', '美食', '小吃', '饭店', 'food'],
  '拍照': ['机位', '出片', 'photo', '摄影'],
  '机位': ['机位', '出片', 'photo', '摄影'],
  '文化': ['历史', '文化', '博物馆', '古建'],
  '历史': ['历史', '文化', '博物馆', '古建'],
  '公园': ['公园', '广场', '绿地'],
  '购物': ['购物', '商场', '广场'],
  '夜景': ['夜', '夜景', '灯光'],
}

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
          ? 'bg-cyan-900/40 border border-cyan-500'
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
export default function WorkbenchPage() {
  const { id } = useParams()
  const cityId = Number(id)
  const navigate = useNavigate()

  const {
    loadCity,
    planStops,
    markedIds,
    addToPlan,
    addStops,
    removeFromPlan,
    clearPlan,
    setPlanStops,
  } = usePlan()

  const [city, setCity] = useState(null)
  const [pois, setPois] = useState([])
  const [routes, setRoutes] = useState([])

  const [leftOpen, setLeftOpen] = useState(true)
  const [rightOpen, setRightOpen] = useState(true)
  const [leftTab, setLeftTab] = useState('marked')
  const [poiSearch, setPoiSearch] = useState('')

  const [toast, setToast] = useState(null)

  const [saving, setSaving] = useState(false)
  const [optimizing, setOptimizing] = useState(false)
  const [originalDistance, setOriginalDistance] = useState(null)
  const [optimizedDistance, setOptimizedDistance] = useState(null)
  const [savedDistance, setSavedDistance] = useState(null)
  const [highlightedIds, setHighlightedIds] = useState(new Set())
  const [previewPois, setPreviewPois] = useState([])
  const [previewRoute, setPreviewRoute] = useState(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  )

  useEffect(() => {
    if (!cityId) return
    loadCity(cityId)

    Promise.all([
      axios.get(`/api/city/${cityId}/overview`).catch(err => {
        console.error('加载城市失败：', err)
        return { data: null }
      }),
      axios.get(`/api/poi/by-city/${cityId}`).catch(err => {
        console.error('加载 POI 失败：', err)
        return { data: [] }
      }),
      axios.get(`/api/city/${cityId}/routes`).catch(err => {
        console.error('加载路线失败：', err)
        return { data: [] }
      }),
    ]).then(([cityRes, poiRes, routeRes]) => {
      setCity(cityRes.data)
      setPois(poiRes.data || [])
      setRoutes(routeRes.data || [])
    })
  }, [cityId, loadCity])

  const markedPois = pois.filter(p => markedIds.has(p.id))

  const searchQuery = poiSearch.trim().toLowerCase()
  const searchTerms = KEYWORD_MAP[searchQuery] || (searchQuery ? [searchQuery] : [])

  const filteredPois = pois.filter(p => {
    const haystack = [p.name, p.category, p.description]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return searchTerms.some(term => haystack.includes(term.toLowerCase()))
  })

  const showToast = (msg, ms = 2000) => {
    setToast(msg)
    setTimeout(() => setToast(null), ms)
  }

  const previewPoiOnMap = (poi) => {
    setPreviewRoute(null)
    setPreviewPois(prev => {
      if (prev.find(p => p.id === poi.id)) return prev
      const next = [...prev, poi]
      return next.length > 5 ? next.slice(next.length - 5) : next
    })
  }

  const previewRouteOnMap = async (routeId) => {
    try {
      const res = await axios.get(`/api/route/${routeId}`)
      setPreviewRoute(res.data)
      showToast(`已在地图上标出「${res.data.title}」的 ${res.data.nodes.length} 个点`, 2500)
    } catch (err) {
      console.error('预览失败：', err)
    }
  }

  const handleAddToPlan = (poi) => {
    if (planStops.some(s => s.poiId === poi.id)) return
    addToPlan(poi)
    showToast(`已加入：${poi.name}`)
  }

  const handleAddRouteToPlan = async (routeId) => {
    try {
      const res = await axios.get(`/api/route/${routeId}`)
      const route = res.data

      const newNodeStops = route.nodes
        .filter(node => !planStops.some(s => s.poiId === node.poiId))
        .map(node => ({
          poiId: node.poiId,
          name: node.poiName,
          lng: node.lng,
          lat: node.lat,
          stayDuration: node.stayDuration,
          tip: node.tip || '',
        }))

      if (newNodeStops.length === 0) {
        showToast('该路线的景点已全部在计划中')
        return
      }

      addStops(newNodeStops)
      showToast(`已加入「${route.title}」的 ${newNodeStops.length} 个景点`, 2500)
    } catch (err) {
      console.error('加入路线失败：', err)
      showToast('加入失败')
    }
  }

  const handleClearPlan = () => {
    if (confirm('确定清空计划？')) {
      clearPlan()
      setOriginalDistance(null)
      setOptimizedDistance(null)
      setSavedDistance(null)
    }
  }

  const handleSave = async () => {
    if (saving) return
    if (!cityId || planStops.length === 0) {
      showToast('请先添加景点')
      return
    }

    setSaving(true)
    try {
      const totalMinutes = planStops.reduce((sum, s) => sum + s.stayDuration, 0)
      await axios.post('/api/route/save-draft', {
        cityId,
        title: `${city?.name || ''} · ${planStops.length} 个景点的计划`,
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
      showToast('保存成功！已加入「我的计划」')
    } catch (err) {
      console.error('保存失败：', err)
      showToast('保存失败：' + (err.response?.data?.message || err.message), 3000)
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
      showToast('至少需要 2 个景点才能优化')
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

        showToast(data.savedDistance > 0 ? 'AI 已优化路线顺序' : '当前顺序已经是最优', 2500)
      }, 800)
    } catch (err) {
      console.error('优化失败：', err)
      showToast('优化失败：' + (err.response?.data?.message || err.message), 3000)
      setOptimizing(false)
    }
  }

  if (!cityId) return null

  return (
    <div className="h-full w-full flex flex-col bg-gray-900">
      <Navbar currentPage="plan" />

      <div className="flex-1 relative overflow-hidden">
        <div className="absolute inset-0 z-0">
          <MapCanvas
            center={city ? { lng: city.lng, lat: city.lat } : null}
            allPois={pois}
            planStops={planStops}
            previewRoute={previewRoute}
            previewPois={previewPois}
            onPoiClick={(poi) => handleAddToPlan(poi)}
          />
        </div>

        {/* 顶部条 */}
        <div
          className="absolute top-0 left-0 right-0 h-16 flex items-center justify-between px-4 z-50 border-b border-gray-700"
          style={{ background: 'rgba(17, 24, 39, 0.98)' }}
        >
          <button
            onClick={() => navigate(`/city/${cityId}`)}
            className="bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded text-sm transition"
          >
            ← 返回
          </button>
          <div className="text-lg font-semibold">{city?.name}</div>
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

        {/* 左浮层：已标记 / 景点 / 路线 */}
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
          {/* 头部：城市名 + 描述 */}
          <div className="p-4 border-b border-gray-700 flex-shrink-0">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-white truncate">{city?.name}</h3>
              <button
                onClick={() => setLeftOpen(false)}
                className="text-gray-400 hover:text-white text-sm flex-shrink-0 ml-2"
              >
                ◀
              </button>
            </div>
            {city?.description && (
              <p className="text-xs text-gray-400 leading-relaxed mt-2 line-clamp-2" title={city.description}>
                {city.description}
              </p>
            )}
          </div>

          {/* 三个 tab */}
          <div className="flex border-b border-gray-700 flex-shrink-0">
            <button
              onClick={() => setLeftTab('marked')}
              className={`flex-1 py-2 text-xs font-medium transition relative ${
                leftTab === 'marked' ? 'text-white' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              已标记（{markedPois.length}）
              {leftTab === 'marked' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-400" />
              )}
            </button>
            <button
              onClick={() => setLeftTab('pois')}
              className={`flex-1 py-2 text-xs font-medium transition relative ${
                leftTab === 'pois' ? 'text-white' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              + 添加
              {leftTab === 'pois' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-400" />
              )}
            </button>
            <button
              onClick={() => setLeftTab('routes')}
              className={`flex-1 py-2 text-xs font-medium transition relative ${
                leftTab === 'routes' ? 'text-white' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              路线（{routes.length}）
              {leftTab === 'routes' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-400" />
              )}
            </button>
          </div>

          {/* 内容区：独立滚动 */}
          <div className="overflow-y-auto p-4 flex-1">
            {leftTab === 'marked' && (
              <div className="space-y-2">
                {markedPois.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-8">
                    还没有标记的地方
                    <br />
                    回城市详情页点「想去」标记
                  </p>
                ) : (
                  markedPois.map(poi => {
                    const inPlan = planStops.some(s => s.poiId === poi.id)
                    return (
                      <div
                        key={poi.id}
                        className="p-2 rounded flex justify-between items-center text-sm bg-gray-800 border border-transparent"
                      >
                        <span className="truncate flex-1 text-white">{poi.name}</span>
                        <button
                          onClick={() => handleAddToPlan(poi)}
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
                  })
                )}
              </div>
            )}

            {leftTab === 'pois' && (
              <div className="space-y-2">
                <input
                  value={poiSearch}
                  onChange={e => setPoiSearch(e.target.value)}
                  placeholder="搜索景点..."
                  className="w-full mb-3 px-3 py-2 rounded bg-gray-800 border border-gray-700 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400"
                />
                {!poiSearch.trim() ? (
                  <p className="text-sm text-gray-400 text-center py-8">
                    输入关键词搜索景点，点「加入」加到计划
                    <br />
                    <span className="text-xs text-gray-500">试试搜：吃饭 · 拍照 · 文化 · 公园</span>
                  </p>
                ) : filteredPois.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-8">没有匹配的景点</p>
                ) : (
                  filteredPois.map(poi => {
                    const inPlan = planStops.some(s => s.poiId === poi.id)
                    const isPreviewed = previewPois.some(p => p.id === poi.id)
                    return (
                      <div
                        key={poi.id}
                        className={`p-2 rounded flex justify-between items-center text-sm transition ${
                          isPreviewed ? 'bg-cyan-900/30 border border-cyan-600' : 'bg-gray-800 border border-transparent'
                        }`}
                      >
                        <span
                          onClick={() => previewPoiOnMap(poi)}
                          className="truncate flex-1 text-white cursor-pointer hover:text-cyan-400"
                          title="点击在地图上预览"
                        >
                          {poi.name}
                        </span>
                        <button
                          onClick={() => handleAddToPlan(poi)}
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
                  })
                )}
              </div>
            )}

            {leftTab === 'routes' && (
              <div className="space-y-3">
                {routes.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-8">暂无推荐路线</p>
                ) : (
                  routes.map(route => (
                    <div
                      key={route.id}
                      onClick={() => navigate(`/route/${route.id}`)}
                      className="bg-gray-800 p-3 rounded-lg border border-gray-700 hover:border-cyan-500 cursor-pointer transition"
                    >
                      <h4 className="font-semibold text-sm text-white mb-2">{route.title}</h4>
                      <div className="flex gap-2 text-xs text-gray-400 mb-2">
                        <span>{route.theme}</span>
                        <span>·</span>
                        <span>{route.duration} 小时</span>
                        <span>·</span>
                        <span>{route.difficulty}</span>
                      </div>
                      <p className="text-xs text-gray-500 leading-relaxed mb-3">{route.description}</p>

                      <div className="flex gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleAddRouteToPlan(route.id)
                          }}
                          className="flex-1 px-3 py-1 rounded text-xs bg-blue-600 hover:bg-blue-700 text-white transition"
                        >
                          + 加入
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            previewRouteOnMap(route.id)
                          }}
                          className="flex-1 px-3 py-1 rounded text-xs bg-gray-700 hover:bg-gray-600 text-white transition"
                        >
                          在地图上标出
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

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

          {originalDistance !== null && (
            <div className="px-4 py-3 border-b border-gray-700 bg-gray-800/50 flex-shrink-0">
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">总距离</span>
                <span className="text-white">
                  {optimizedDistance} km
                  {savedDistance > 0 && (
                    <span className="text-cyan-400 ml-2">↓ {savedDistance} km</span>
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
                onClick={handleClearPlan}
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

        {!rightOpen && (
          <button
            onClick={() => setRightOpen(true)}
            className="absolute right-4 top-20 bg-gray-900/95 backdrop-blur px-3 py-2 rounded shadow-lg border border-gray-700 z-40 text-white"
          >
            ◀
          </button>
        )}

        {toast && (
          <div
            className="absolute top-24 left-1/2 -translate-x-1/2 bg-cyan-600 text-white px-6 py-3 rounded-lg shadow-lg z-50"
            style={{ animation: 'fadeIn 0.3s ease-out' }}
          >
            {toast}
          </div>
        )}
      </div>
    </div>
  )
}
