import { useState, useEffect, Fragment } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
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

// 计算“明天”的本地日期（YYYY-MM-DD），避开 toISOString 按 UTC 导致的时区偏差
function getTomorrowDate() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// 价格只展示二等座；没有二等座则取第一个座位类型
function renderTicketPrice(prices) {
  if (!prices || typeof prices !== 'object') return '—'
  const entries = Object.entries(prices)
  if (entries.length === 0) return '—'
  const [seat, price] = entries.find(([s]) => s === '二等座') || entries[0]
  return `${seat} ${price}`
}

// 一条 segment → 摘要文字
function summarizeSegment(seg) {
  const distance = Number(seg.distance) || 0
  const bus = seg.steps?.find(s => s.type === 'bus')
  if (bus) {
    const label = bus.transportType === 'metro' ? '地铁' : '公交'
    const withStops = bus.stopCount ? `${label} ${bus.stopCount} 站` : label
    return `${withStops} · 约 ${Math.max(1, Math.round(distance / 5 / 60))} 分钟`
  }
  return `步行 ${Math.round(distance)} 米 · 约 ${Math.max(1, Math.round(distance / 1.2 / 60))} 分钟`
}

// 相邻两个节点 → 高德导航 URL
function buildNavUrl(from, to) {
  const f = `${from.lng},${from.lat},${from.poiName || ''}`
  const t = `${to.lng},${to.lat},${to.poiName || ''}`
  return `https://uri.amap.com/navigation?from=${encodeURIComponent(f)}&to=${encodeURIComponent(t)}&mode=transit`
}

// ==================== 主组件 ====================
export default function WorkbenchPage() {
  const { id } = useParams()
  const cityId = Number(id)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const fromParam = searchParams.get('from')
  const routeIdParam = searchParams.get('routeId')

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
  const [activeTab, setActiveTab] = useState(
    () => (localStorage.getItem('plan_tab') === 'ticket' ? 'ticket' : 'plan')
  )
  const [planExpanded, setPlanExpanded] = useState(
    () => localStorage.getItem('plan_expanded') === '1'
  )
  const [leftTab, setLeftTab] = useState(
    fromParam === 'route' && routeIdParam ? 'routes' : 'marked'
  )
  const [activeRouteId] = useState(
    fromParam === 'route' && routeIdParam ? Number(routeIdParam) : null
  )
  const [activeRoute, setActiveRoute] = useState(null)
  const [activeTransit, setActiveTransit] = useState(null)
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

  // 查票
  const [ticketFrom, setTicketFrom] = useState('')
  const [ticketTo, setTicketTo] = useState('')
  const [ticketDate, setTicketDate] = useState(getTomorrowDate)
  const [trainResults, setTrainResults] = useState([])
  const [ticketLoading, setTicketLoading] = useState(false)
  const [ticketError, setTicketError] = useState(null)
  const [hasQueried, setHasQueried] = useState(false)

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

  useEffect(() => {
    if (!activeRouteId) return
    axios.get(`/api/route/${activeRouteId}`)
      .then(res => setActiveRoute(res.data))
      .catch(err => {
        console.error('加载路线节点失败：', err)
      })
    axios.get(`/api/route/${activeRouteId}/transit`)
      .then(res => setActiveTransit(res.data))
      .catch(err => {
        console.error('加载交通方案失败：', err)
      })
  }, [activeRouteId])

  // 绑定的车次列表（草稿，localStorage 持久化）；旧单条 key 做一次性迁移
  const [tickets, setTickets] = useState(() => {
    try {
      const raw = localStorage.getItem(`planTickets:${cityId}`)
      if (raw) return JSON.parse(raw)
    } catch { /* 忽略解析失败，回退迁移/空数组 */ }
    try {
      const old = localStorage.getItem(`plan_ticket_${cityId}`)
      if (old) {
        localStorage.removeItem(`plan_ticket_${cityId}`)
        return [JSON.parse(old)]
      }
    } catch { /* 忽略 */ }
    return []
  })
  const [editingTicketIndex, setEditingTicketIndex] = useState(null)

  const persistTickets = (next) => {
    setTickets(next)
    localStorage.setItem(`planTickets:${cityId}`, JSON.stringify(next))
  }

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

  const selectTab = (tab) => {
    localStorage.setItem('plan_tab', tab)
    if (tab === 'plan' && planExpanded) {
      setPlanExpanded(false)
      localStorage.setItem('plan_expanded', '0')
    }
    setActiveTab(tab)
  }

  const togglePlanExpanded = () => {
    setPlanExpanded(prev => {
      localStorage.setItem('plan_expanded', prev ? '0' : '1')
      return !prev
    })
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

  const handleAddNodeToPlan = (node) => {
    if (planStops.some(s => s.poiId === node.poiId)) return
    addStops([{
      poiId: node.poiId,
      name: node.poiName,
      lng: node.lng,
      lat: node.lat,
      stayDuration: node.stayDuration,
      tip: node.tip || '',
    }])
    showToast(`已加入：${node.poiName}`)
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
      const savedRouteId = localStorage.getItem(`planRouteId:${cityId}`)
      const res = await axios.post('/api/route/save-draft', {
        cityId,
        title: `${city?.name || ''} · ${planStops.length} 个景点的计划`,
        theme: '混合',
        duration: Math.ceil(totalMinutes / 60),
        difficulty: '轻松',
        routeId: savedRouteId ? Number(savedRouteId) : null,
        nodes: planStops.map((stop, idx) => ({
          poiId: stop.poiId,
          sortOrder: idx + 1,
          stayDuration: stop.stayDuration,
          tip: stop.tip,
        })),
        tickets: tickets.map(t => ({
          trainCode: t.trainCode,
          fromStation: t.fromStation,
          toStation: t.toStation,
          startTime: t.startTime,
          arriveTime: t.arriveTime,
          travelDate: t.date,
          prices: t.prices || {},
        })),
      })
      if (res.data?.routeId) {
        localStorage.setItem(`planRouteId:${cityId}`, res.data.routeId)
      }
      showToast('保存成功！已加入「我的计划」', 1500)
      resetTicketForm()
      selectTab('ticket')
    } catch (err) {
      console.error('保存失败：', err)
      showToast('保存失败：' + (err.response?.data?.message || err.message), 3000)
    } finally {
      setSaving(false)
    }
  }

  const resetTicketForm = () => {
    setTicketFrom('')
    setTicketTo(city?.name || '')
    setTicketDate(getTomorrowDate())
    setTrainResults([])
    setTicketError(null)
    setHasQueried(false)
  }

  const handleTicketQuery = async () => {
    if (!ticketFrom.trim() || !ticketTo.trim() || !ticketDate) {
      setTicketError('请填写出发地、目的地和日期')
      return
    }
    setTicketLoading(true)
    setTicketError(null)
    setHasQueried(false)
    try {
      const res = await axios.get('/api/train/query', {
        params: { from: ticketFrom.trim(), to: ticketTo.trim(), date: ticketDate },
      })
      setTrainResults(res.data?.trains || [])
    } catch (err) {
      setTicketError(err.response?.data?.message || err.message || '查询失败')
      setTrainResults([])
    } finally {
      setTicketLoading(false)
      setHasQueried(true)
    }
  }

  const handleSelectTrain = (train) => {
    const bound = { ...train, date: ticketDate }
    const replacing = editingTicketIndex != null
    const next = replacing
      ? tickets.map((t, i) => (i === editingTicketIndex ? bound : t))
      : [...tickets, bound]
    persistTickets(next)
    setEditingTicketIndex(null)
    showToast(`${replacing ? '已替换' : '已记入'}车次 ${train.trainCode}`)
  }

  const handleReplaceTicket = (idx) => {
    setEditingTicketIndex(idx)
    selectTab('ticket')
  }

  const handleRemoveTicket = (idx) => {
    persistTickets(tickets.filter((_, i) => i !== idx))
  }

  const handleAddTicket = () => {
    setEditingTicketIndex(null)
    selectTab('ticket')
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

  const showPlan = activeTab === 'plan' || (activeTab === 'ticket' && planExpanded)

  const activeTransitByPair = new Map()
  if (activeTransit?.segments) {
    activeTransit.segments.forEach(s => activeTransitByPair.set(`${s.fromPoiName}|${s.toPoiName}`, s))
  }

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
                  routes.map(route => {
                    const isActive = route.id === activeRouteId
                    return (
                    <div
                      key={route.id}
                      onClick={() => navigate(`/route/${route.id}`)}
                      className={`bg-gray-800 p-3 rounded-lg border transition cursor-pointer ${
                        isActive
                          ? 'border-cyan-500 bg-cyan-900/20'
                          : 'border-gray-700 hover:border-cyan-500'
                      }`}
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

                      {isActive && activeRoute && (
                        <div className="mb-3 space-y-2" onClick={(e) => e.stopPropagation()}>
                          {activeRoute.nodes.map((node, idx) => {
                            const inPlan = planStops.some(s => s.poiId === node.poiId)
                            const nextNode = activeRoute.nodes[idx + 1]
                            const seg = nextNode ? activeTransitByPair.get(`${node.poiName}|${nextNode.poiName}`) : null
                            return (
                              <Fragment key={node.poiId}>
                                <div className="flex justify-between items-center bg-gray-900/60 p-2 rounded">
                                  <div className="min-w-0 flex-1">
                                    <span className="text-sm text-white truncate block">{node.poiName}</span>
                                    <span className="text-xs text-gray-500">{node.stayDuration} 分钟</span>
                                  </div>
                                  <button
                                    onClick={() => handleAddNodeToPlan(node)}
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
                                {seg && (
                                  <div className="flex items-center justify-between bg-gray-900/40 px-2 py-1 rounded">
                                    <span className="text-xs text-cyan-400">↓ {summarizeSegment(seg)}</span>
                                    <button
                                      onClick={() => window.open(buildNavUrl(node, nextNode), '_blank', 'noopener,noreferrer')}
                                      className="text-xs px-2 py-0.5 rounded border border-gray-600 text-gray-300 hover:text-white hover:border-cyan-500 transition"
                                    >
                                      导航
                                    </button>
                                  </div>
                                )}
                              </Fragment>
                            )
                          })}
                          <button
                            onClick={() => handleAddRouteToPlan(activeRouteId)}
                            className="w-full px-3 py-2 rounded text-sm bg-cyan-600 hover:bg-cyan-700 text-white transition"
                          >
                            整条加入
                          </button>
                        </div>
                      )}

                      <div className="flex gap-2">
                        {!isActive && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleAddRouteToPlan(route.id)
                            }}
                            className="flex-1 px-3 py-1 rounded text-xs bg-blue-600 hover:bg-blue-700 text-white transition"
                          >
                            + 加入
                          </button>
                        )}
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
                    )
                  })
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

        {/* 右侧浮层：tab 切换 + 可选展开 */}
        <div
          className="absolute right-4 top-20 z-40 rounded-xl border border-gray-600 shadow-2xl overflow-hidden flex flex-col"
          style={{
            background: 'rgba(17, 24, 39, 0.98)',
            color: 'white',
          }}
        >
          {/* tab 栏 */}
          <div className="w-full flex border-b border-gray-700 flex-shrink-0">
            <button
              onClick={() => selectTab('plan')}
              className={`flex-1 py-2 text-xs font-medium transition relative ${
                activeTab === 'plan' ? 'text-white' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              我的计划（{planStops.length}）
              {activeTab === 'plan' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-400" />
              )}
            </button>
            <button
              onClick={() => selectTab('ticket')}
              className={`flex-1 py-2 text-xs font-medium transition relative ${
                activeTab === 'ticket' ? 'text-white' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              查票
              {activeTab === 'ticket' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-400" />
              )}
            </button>
          </div>

          {/* 内容行 */}
          <div className="flex items-start gap-1">
            {/* 我的计划面板 */}
            {showPlan && (
              <div
                className="w-80 flex flex-col"
                style={{ maxHeight: 'calc(100vh - 200px)' }}
              >
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

                {/* 绑定车次列表 */}
                <div className="p-3 border-t border-gray-700 flex-shrink-0 space-y-2">
                  {tickets.length === 0 ? (
                    <button
                      onClick={handleAddTicket}
                      className="w-full text-center text-xs text-gray-500 hover:text-cyan-400 transition"
                    >
                      还没绑定车次，去查票 →
                    </button>
                  ) : (
                    tickets.map((t, idx) => (
                      <div key={idx} className="rounded border border-cyan-600 bg-cyan-900/20 p-3">
                        <div className="text-sm text-cyan-400 mb-1">🚄 {t.date || '—'}</div>
                        <div className="text-white text-sm font-medium">
                          {t.trainCode}
                          <span className="text-gray-400 text-xs ml-2">
                            {t.startTime} → {t.arriveTime}
                          </span>
                        </div>
                        <div className="text-xs text-gray-400 mt-1">{renderTicketPrice(t.prices)}</div>
                        <div className="flex gap-2 mt-3">
                          <button
                            onClick={() => handleReplaceTicket(idx)}
                            className="flex-1 py-1.5 rounded text-xs border border-cyan-600 text-cyan-400 hover:bg-cyan-900/40 transition"
                          >
                            换
                          </button>
                          <button
                            onClick={() => handleRemoveTicket(idx)}
                            className="flex-1 py-1.5 rounded text-xs bg-gray-700 hover:bg-red-600 text-white transition"
                          >
                            删
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                  <button
                    onClick={handleAddTicket}
                    className="w-full py-1.5 rounded text-xs border border-dashed border-cyan-600 text-cyan-400 hover:bg-cyan-900/20 transition"
                  >
                    + 添加车次
                  </button>
                </div>
              </div>
            )}

            {/* 展开/收起箭头（仅查票 tab） */}
            {activeTab === 'ticket' && (
              <button
                onClick={togglePlanExpanded}
                title={planExpanded ? '收起我的计划' : '展开我的计划'}
                className="self-center bg-gray-900/95 backdrop-blur px-1.5 py-2 rounded-md shadow-lg border border-gray-700 text-white hover:text-cyan-400 text-sm shrink-0"
              >
                {planExpanded ? '▶' : '◀'}
              </button>
            )}

            {/* 查票面板 */}
            {activeTab === 'ticket' && (
              <div
                className="w-96 flex flex-col"
                style={{ maxHeight: 'calc(100vh - 200px)' }}
              >
                {editingTicketIndex != null && (
                  <div className="px-4 pt-3 text-xs text-cyan-400">
                    正在替换第 {editingTicketIndex + 1} 条车次，选中后点「记入计划」确认
                  </div>
                )}
                <div className="p-4 space-y-3 border-b border-gray-700 flex-shrink-0">
                  <input
                    value={ticketFrom}
                    onChange={e => setTicketFrom(e.target.value)}
                    placeholder="出发地"
                    className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400"
                  />
                  <input
                    value={ticketTo}
                    onChange={e => setTicketTo(e.target.value)}
                    placeholder="目的地"
                    className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400"
                  />
                  <input
                    type="date"
                    value={ticketDate}
                    onChange={e => setTicketDate(e.target.value)}
                    className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 [color-scheme:dark]"
                  />
                  <button
                    onClick={handleTicketQuery}
                    disabled={ticketLoading}
                    className={`w-full py-2 rounded text-sm font-semibold text-white transition ${
                      ticketLoading ? 'bg-gray-700 cursor-not-allowed' : 'bg-cyan-600 hover:bg-cyan-500'
                    }`}
                  >
                    {ticketLoading ? '查询中...' : '查询'}
                  </button>
                </div>

                <div className="overflow-y-auto p-4 flex-1 space-y-2">
                  {ticketLoading ? (
                    <p className="text-sm text-gray-400 text-center py-4">查询中...</p>
                  ) : ticketError ? (
                    <p className="text-sm text-red-400 text-center py-4">{ticketError}</p>
                  ) : hasQueried && trainResults.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-4">暂无车次</p>
                  ) : (
                    trainResults.map((train, idx) => (
                      <div
                        key={`${train.trainNo}-${idx}`}
                        className="bg-gray-800 border border-gray-700 rounded p-3"
                      >
                        <div className="flex items-center justify-between">
                          <div className="min-w-0">
                            <span className="text-white text-sm font-medium">{train.trainCode}</span>
                            <span className="text-xs text-gray-400 ml-2">
                              {train.startTime} → {train.arriveTime}
                            </span>
                          </div>
                          <button
                            onClick={() => handleSelectTrain(train)}
                            className="ml-2 px-3 py-1 rounded text-xs bg-cyan-600 hover:bg-cyan-500 text-white transition shrink-0"
                          >
                            记入计划
                          </button>
                        </div>
                        <div className="text-xs text-gray-400 mt-2 flex flex-wrap gap-x-3 gap-y-1">
                          {Object.entries(train.prices || {}).length > 0 ? (
                            Object.entries(train.prices).map(([seat, price]) => (
                              <span key={seat}>
                                {seat} <span className="text-cyan-400">{price}</span>
                              </span>
                            ))
                          ) : (
                            <span>—</span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="p-3 border-t border-gray-700 flex-shrink-0">
                  <p className="text-xs text-gray-500 text-center">以上为公布票价，实际以 12306 为准</p>
                </div>
              </div>
            )}
          </div>
        </div>

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
