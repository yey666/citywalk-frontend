import { useState, useEffect, useRef, memo, Fragment } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import axios from 'axios'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDndContext,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import MapCanvas from '../components/MapCanvas'
import Skeleton from '../components/ui/Skeleton'
import { usePlan } from '../context/PlanContext'
import { cityIntro, defaultIntro } from '../data/cityIntro'

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

// ==================== AI 生成路线配置 ====================
const AI_THEMES = ['出片', '美食', '历史', '文艺']
const AI_DURATIONS = [2, 3, 4, 6, 8]
const AI_DIFFICULTIES = ['轻松', '中等', '暴走']

// 浅色主题下的输入框统一样式（查票表单等）
const LIGHT_INPUT_CLS = 'w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500'

// ==================== 可拖拽项组件 ====================
function SortableStop({ stop, index, onRemove, highlighted }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: stop.poiId,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-white/95 backdrop-blur-md rounded-2xl shadow-md p-4 flex justify-between items-center transition-all duration-300 ${
        highlighted ? 'ring-2 ring-blue-500/70' : ''
      } ${isDragging ? 'opacity-70 scale-105 rotate-1 shadow-2xl relative z-50' : ''}`}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <span
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 text-sm px-0.5 select-none shrink-0"
          title="拖拽调整顺序"
        >
          ≡
        </span>
        <span className="w-7 h-7 rounded-full bg-blue-500 text-white flex items-center justify-center text-sm font-semibold shrink-0">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-medium text-sm text-gray-900 truncate">{stop.name}</div>
          <div className="text-xs text-gray-400 mt-0.5">{stop.stayDuration} 分钟</div>
        </div>
      </div>
      <button
        onClick={() => onRemove(stop.poiId)}
        className="text-gray-300 hover:text-gray-500 text-sm ml-2 shrink-0"
        title="移除"
      >
        ✕
      </button>
    </div>
  )
}

// 列表行：名称 + 「+ 加入」按钮（「已标记」与「搜索景点」共用）
function PoiRow({ poi, inPlan, onAdd, onPreview, highlighted }) {
  return (
    <div
      className={`p-2 rounded-lg flex justify-between items-center text-sm transition ${
        highlighted ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50 border border-gray-100'
      }`}
    >
      <span
        onClick={onPreview}
        className={`truncate flex-1 text-gray-800 ${onPreview ? 'cursor-pointer hover:text-blue-600' : ''}`}
        title={onPreview ? '点击在地图上预览' : undefined}
      >
        {poi.name}
      </span>
      <button
        onClick={() => onAdd(poi)}
        disabled={inPlan}
        className={`ml-2 px-2 py-0.5 text-xs whitespace-nowrap rounded-md font-medium transition ${
          inPlan ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-blue-500 text-white hover:bg-blue-600'
        }`}
      >
        {inPlan ? '已加入' : '+ 加入'}
      </button>
    </div>
  )
}

// 拖拽放置区：拖拽进行时显示虚线 + 淡蓝底色，明确「能放这里」
function PlanDropZone({ children }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'plan-dropzone' })
  const { active } = useDndContext()
  const isActive = active != null || isOver
  return (
    <div
      ref={setNodeRef}
      className={`rounded-xl border-2 border-dashed transition-colors duration-300 ${
        isActive ? 'border-blue-400 bg-blue-100/60' : 'border-transparent'
      }`}
    >
      {children}
    </div>
  )
}

// 浅色悬浮卡片里的空状态（与全站深色 EmptyState 区分）
function LightEmpty({ title, description }) {
  return (
    <div className="flex flex-col items-center justify-center text-center px-6 py-8">
      <div className="w-14 h-14 mb-3 rounded-2xl bg-gray-100 border border-gray-200 flex items-center justify-center">
        <svg
          className="w-6 h-6 text-gray-400"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M8 15c1.5 1.5 3.5 1.5 4 1.5s2.5 0 4-1.5" />
          <path d="M9 9h.01M15 9h.01" />
        </svg>
      </div>
      {title && <h3 className="text-sm font-medium text-gray-700 mb-1">{title}</h3>}
      {description && (
        <p className="text-xs text-gray-400 max-w-xs leading-relaxed">{description}</p>
      )}
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

// 解析一段 SSE 事件文本，提取所有 `data:` 行并拼接（去掉每行开头的一个空格）
function parseSseData(rawEvent) {
  let text = ''
  for (const line of rawEvent.split('\n')) {
    if (line.startsWith('data:')) {
      text += line.slice(5).replace(/^ /, '')
    }
  }
  return text
}

// Markdown 消息体：memo 避免流式更新时已完成的消息被重复解析
const MarkdownText = memo(function MarkdownText({ content }) {
  return (
    <div className="prose prose-sm prose-slate max-w-none">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  )
})

// ==================== 主组件 ====================
export default function WorkbenchPage() {
  const { id } = useParams()
  const cityId = Number(id)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const fromParam = searchParams.get('from')
  const routeIdParam = searchParams.get('routeId')
  const tabParam = searchParams.get('tab')

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
  const [loading, setLoading] = useState(true)

  // 底部次要按钮打开的悬浮面板：null | 'add'（添加景点）
  const [panel, setPanel] = useState(null)
  // 右侧行程卡片内的「查票助手」手风琴展开状态
  const [ticketOpen, setTicketOpen] = useState(() => tabParam === 'ticket')
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

  // AI 生成路线
  const [aiModalOpen, setAiModalOpen] = useState(false)
  const [aiGenerating, setAiGenerating] = useState(false)
  const [aiGenerated, setAiGenerated] = useState(false)
  const [aiTheme, setAiTheme] = useState('出片')
  const [aiDuration, setAiDuration] = useState(4)
  const [aiDifficulty, setAiDifficulty] = useState('轻松')

  // 查票
  const [ticketFrom, setTicketFrom] = useState('')
  const [ticketTo, setTicketTo] = useState('')
  const [ticketDate, setTicketDate] = useState(getTomorrowDate)
  const [trainResults, setTrainResults] = useState([])
  const [ticketLoading, setTicketLoading] = useState(false)
  const [ticketError, setTicketError] = useState(null)
  const [hasQueried, setHasQueried] = useState(false)

  // AI 智能导游（流式对话）
  const [guideOpen, setGuideOpen] = useState(false)
  const [guideMessages, setGuideMessages] = useState([])
  const [guideInput, setGuideInput] = useState('')
  const [guideStreaming, setGuideStreaming] = useState(false)
  const [guidePois, setGuidePois] = useState([])
  const guideAbortRef = useRef(null)
  const guideScrollRef = useRef(null)

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
    }).finally(() => setLoading(false))
  }, [cityId, loadCity])

  // 进工作台时，把已标记的 POI 自动加入计划（一次性），用 flag 记录避免重复加
  useEffect(() => {
    if (!cityId || pois.length === 0) return
    if (localStorage.getItem(`markedIdsAutoAdded:${cityId}`) === '1') return
    let ids
    try {
      ids = JSON.parse(localStorage.getItem(`markedIds:${cityId}`) || '[]')
    } catch {
      ids = []
    }
    if (!Array.isArray(ids) || ids.length === 0) return

    const idSet = new Set(ids)
    const stops = pois
      .filter(p => idSet.has(p.id))
      .map(p => ({
        poiId: p.id,
        name: p.name,
        lng: p.lng,
        lat: p.lat,
        stayDuration: 60,
        tip: p.description || '',
      }))

    if (stops.length > 0) {
      addStops(stops)
    }
    localStorage.setItem(`markedIdsAutoAdded:${cityId}`, '1')
  }, [cityId, pois, addStops])

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

  const togglePanel = (name) => {
    setPanel(prev => (prev === name ? null : name))
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
      setAiGenerated(false)
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
        aiGenerated: aiGenerated ? 1 : 0,
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
      showToast('保存成功', 1500)
      localStorage.removeItem(`planTickets:${cityId}`)
      setTickets([])
      setTimeout(() => navigate('/profile'), 1500)
    } catch (err) {
      console.error('保存失败：', err)
      showToast('保存失败：' + (err.response?.data?.message || err.message), 3000)
    } finally {
      setSaving(false)
    }
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
    setTicketOpen(true)
  }

  const handleRemoveTicket = (idx) => {
    persistTickets(tickets.filter((_, i) => i !== idx))
  }

  const handleAddTicket = () => {
    setEditingTicketIndex(null)
    setTicketOpen(true)
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

  const handleAiGenerate = async () => {
    setAiModalOpen(false)
    setAiGenerating(true)
    setOriginalDistance(null)
    setOptimizedDistance(null)
    setSavedDistance(null)
    try {
      const res = await axios.post('/api/rag/generate-route', {
        cityId: Number(cityId),
        duration: aiDuration,
        theme: aiTheme,
        difficulty: aiDifficulty,
      })

      const nodes = (res.data?.nodes || []).map(node => ({
        poiId: node.poiId,
        name: node.poiName,
        lng: node.lng,
        lat: node.lat,
        stayDuration: node.stayDuration,
        tip: node.tip || '',
      }))

      if (nodes.length === 0) {
        showToast('AI 没有生成有效路线，请重试', 2500)
        return
      }

      setPlanStops(nodes)
      setAiGenerated(true)
      showToast(`AI 已生成「${res.data?.title || '专属路线'}」，可继续微调`, 2500)
    } catch (err) {
      console.error('AI 生成失败：', err)
      showToast('AI 生成失败：' + (err.response?.data?.message || err.message), 3000)
    } finally {
      setAiGenerating(false)
    }
  }

  // ==================== AI 智能导游（SSE 流式对话） ====================
  const sendGuideMessage = async () => {
    const text = guideInput.trim()
    if (!text || guideStreaming) return

    // 打包多轮上下文：历史消息 + 当前提问（过滤掉空的占位消息）
    const history = guideMessages
      .filter(m => m.content && m.content.trim())
      .map(m => ({ role: m.role, content: m.content }))
    const payload = {
      messages: [...history, { role: 'user', content: text }],
      cityId: cityId || null,
      cityName: city?.name || '',
    }

    setGuideMessages(prev => [...prev, { role: 'user', content: text }, { role: 'assistant', content: '' }])
    setGuideInput('')
    setGuideStreaming(true)
    setGuidePois([])

    const token = localStorage.getItem('token')
    const controller = new AbortController()
    guideAbortRef.current = controller

    const appendGuideChunk = (chunk) => {
      setGuideMessages(prev => {
        const next = [...prev]
        const last = next[next.length - 1]
        if (last && last.role === 'assistant') {
          next[next.length - 1] = { ...last, content: last.content + chunk }
        }
        return next
      })
    }

    try {
      const res = await fetch('/api/guide/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })

      if (!res.ok || !res.body) {
        throw new Error(`请求失败（${res.status}）`)
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder('utf-8')
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        let idx
        while ((idx = buffer.indexOf('\n\n')) !== -1) {
          const rawEvent = buffer.slice(0, idx)
          buffer = buffer.slice(idx + 2)
          const data = parseSseData(rawEvent)
          if (!data) continue

          // 解析 JSON 事件：text 追加文本，pois 记录 POI 打点数据
          try {
            const evt = JSON.parse(data)
            if (evt.type === 'text' && evt.content) {
              appendGuideChunk(evt.content)
            } else if (evt.type === 'pois' && Array.isArray(evt.pois) && evt.pois.length > 0) {
              setGuidePois(evt.pois)
            }
          } catch {
            // 兼容旧版纯文本 SSE：直接把整段当文本追加
            appendGuideChunk(data)
          }
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('AI 导游对话失败：', err)
        setGuideMessages(prev => {
          const next = [...prev]
          const last = next[next.length - 1]
          if (last && last.role === 'assistant') {
            next[next.length - 1] = { ...last, content: last.content || '出错了，请稍后再试。' }
          }
          return next
        })
      }
    } finally {
      setGuideStreaming(false)
    }
  }

  // 对话内容变化时自动滚动到底部
  useEffect(() => {
    if (guideScrollRef.current) {
      guideScrollRef.current.scrollTop = guideScrollRef.current.scrollHeight
    }
  }, [guideMessages, guideStreaming])

  // 组件卸载时中断进行中的流式请求
  useEffect(() => () => {
    if (guideAbortRef.current) guideAbortRef.current.abort()
  }, [])

  if (!cityId) return null

  const activeTransitByPair = new Map()
  if (activeTransit?.segments) {
    activeTransit.segments.forEach(s => activeTransitByPair.set(`${s.fromPoiName}|${s.toPoiName}`, s))
  }

  const cityTag = (cityId && cityIntro[cityId]?.slogan) || city?.description || defaultIntro.slogan

  return (
    <div className="h-full w-full relative overflow-hidden bg-gray-100">
      {/* 高德地图全屏浅色背景 */}
      <div className="absolute inset-0">
        <MapCanvas
          center={city ? { lng: city.lng, lat: city.lat } : null}
          allPois={pois}
          planStops={planStops}
          previewRoute={previewRoute}
          previewPois={previewPois}
          guidePois={guidePois}
          onPoiClick={(poi) => handleAddToPlan(poi)}
        />
      </div>

      {/* 顶部：居中悬浮白色胶囊导航 */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 w-[90%] max-w-5xl z-50 bg-white/90 backdrop-blur-md rounded-full shadow-md flex items-center justify-between px-4 py-2.5">
        <button
          onClick={() => navigate(`/city/${cityId}`)}
          className="flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-full hover:bg-gray-100 transition"
        >
          ← 返回
        </button>
        <div className="text-lg font-bold text-gray-900">{city?.name}</div>
        <button
          onClick={handleSave}
          disabled={saving}
          className={`px-5 py-1.5 rounded-full text-sm font-semibold transition ${
            saving ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-gray-900 text-white hover:bg-gray-700'
          }`}
        >
          {saving ? '保存中...' : '保存路线'}
        </button>
      </div>

      {/* 左侧：城市介绍悬浮文字 */}
      <div className="absolute left-10 top-[120px] z-30 pointer-events-none max-w-xl">
        <h1 className="text-6xl font-black text-gray-900 drop-shadow-md leading-none">{city?.name}</h1>
        {cityTag && (
          <div className="mt-4 inline-block bg-white/70 backdrop-blur-sm rounded-lg px-4 py-2 text-gray-700 text-sm">
            {cityTag}
          </div>
        )}
      </div>

      {/* 右侧：我的计划悬浮卡片 */}
      <div
        className="absolute right-10 top-[120px] w-[380px] z-30 flex flex-col space-y-4"
        style={{ maxHeight: 'calc(100vh - 260px)' }}
      >
        {/* 头部卡片 */}
        <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-lg p-4 flex justify-between items-center shrink-0">
          <div className="font-semibold text-gray-900">我的计划（{planStops.length}）</div>
          {planStops.length > 0 && (
            <button
              onClick={handleClearPlan}
              className="text-sm text-gray-400 hover:text-gray-700 transition"
            >
              清空
            </button>
          )}
        </div>

        {/* 优化后的距离信息 */}
        {originalDistance !== null && (
          <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-md p-4 shrink-0">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">总距离</span>
              <span className="text-gray-900 font-medium">
                {optimizedDistance} km
                {savedDistance > 0 && (
                  <span className="text-blue-500 ml-2">↓ {savedDistance} km</span>
                )}
              </span>
            </div>
            {savedDistance > 0 && (
              <div className="flex justify-between text-xs mt-1">
                <span className="text-gray-400">优化前</span>
                <span className="text-gray-400 line-through">{originalDistance} km</span>
              </div>
            )}
          </div>
        )}

        {/* 列表区 */}
        <div className="overflow-y-auto flex-1 min-h-0 space-y-3 pr-1">
          {aiGenerating ? (
            <div className="space-y-3">
              <p className="text-sm text-blue-600 text-center animate-pulse">
                AI 正在检索景点并编排路线...
              </p>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-white/95 rounded-2xl shadow-md p-4 space-y-2">
                  <Skeleton className="bg-gray-200/70 h-4 w-2/3" />
                  <Skeleton className="bg-gray-200/70 h-3 w-1/2" />
                  <Skeleton className="bg-gray-200/70 h-3 w-1/3" />
                </div>
              ))}
            </div>
          ) : loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-white/95 rounded-2xl shadow-md p-4 flex items-center gap-3">
                  <Skeleton className="bg-gray-200/70 h-7 w-7 rounded-full shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="bg-gray-200/70 h-4 w-2/3" />
                    <Skeleton className="bg-gray-200/70 h-3 w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : planStops.length === 0 ? (
            <LightEmpty
              title="还没有添加景点"
              description="点下方「+ 添加景点」，或直接在地图上点选景点加入"
            />
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
                <PlanDropZone>
                  <div className="space-y-3 animate-fade-in">
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
                </PlanDropZone>
              </SortableContext>
            </DndContext>
          )}
        </div>

        {/* 分割线 + 查票助手手风琴 */}
        <div className="shrink-0">
          <div className="border-t border-gray-200" />
          <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-md p-4 mt-3">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-gray-900">🚄 查票助手</span>
              <button
                onClick={() => setTicketOpen(o => !o)}
                className="text-sm font-medium text-blue-600 hover:text-blue-700 transition"
              >
                {ticketOpen ? '收起查票 ↑' : '展开查票 ↓'}
              </button>
            </div>

            {/* 展开/收起内容 */}
            <div
              className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${
                ticketOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
              }`}
            >
              <div className="overflow-hidden">
                <div className="pt-4">
                  <div className="bg-gray-50 rounded-xl p-4 max-h-[45vh] overflow-y-auto space-y-3">
                    {editingTicketIndex != null && (
                      <p className="text-xs text-blue-600">
                        正在替换第 {editingTicketIndex + 1} 条车次，选中后点「记入计划」确认
                      </p>
                    )}

                    {/* 查票表单 */}
                    <div className="space-y-2">
                      <input
                        value={ticketFrom}
                        onChange={e => setTicketFrom(e.target.value)}
                        placeholder="出发地"
                        className={LIGHT_INPUT_CLS}
                      />
                      <input
                        value={ticketTo}
                        onChange={e => setTicketTo(e.target.value)}
                        placeholder="目的地"
                        className={LIGHT_INPUT_CLS}
                      />
                      <input
                        type="date"
                        value={ticketDate}
                        onChange={e => setTicketDate(e.target.value)}
                        className={`${LIGHT_INPUT_CLS} [color-scheme:light]`}
                      />
                      <button
                        onClick={handleTicketQuery}
                        disabled={ticketLoading}
                        className={`w-full py-2 text-sm rounded-lg font-medium transition ${
                          ticketLoading ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-blue-500 text-white hover:bg-blue-600'
                        }`}
                      >
                        {ticketLoading ? '查询中...' : '查询'}
                      </button>
                    </div>

                    {/* 查询结果 */}
                    <div className="space-y-2">
                      {ticketLoading ? (
                        <div className="space-y-2">
                          {Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="rounded-lg bg-white border border-gray-100 p-3 space-y-2">
                              <Skeleton className="bg-gray-200/70 h-4 w-1/2" />
                              <Skeleton className="bg-gray-200/70 h-3 w-2/3" />
                            </div>
                          ))}
                        </div>
                      ) : ticketError ? (
                        <p className="text-sm text-red-500 text-center py-2">{ticketError}</p>
                      ) : hasQueried && trainResults.length === 0 ? (
                        <p className="text-xs text-gray-400 text-center py-2">暂无车次，填好出发地、目的地和日期后点「查询」</p>
                      ) : (
                        trainResults.map((train, idx) => (
                          <div key={`${train.trainNo}-${idx}`} className="bg-white border border-gray-100 rounded-lg p-3">
                            <div className="flex items-center justify-between">
                              <div className="min-w-0">
                                <span className="text-gray-900 text-sm font-medium">{train.trainCode}</span>
                                <span className="text-xs text-gray-500 ml-2">{train.startTime} → {train.arriveTime}</span>
                              </div>
                              <button
                                onClick={() => handleSelectTrain(train)}
                                className="ml-2 px-3 py-1 text-xs bg-blue-500 text-white rounded-md font-medium hover:bg-blue-600 transition shrink-0"
                              >
                                记入计划
                              </button>
                            </div>
                            {train.fromStation && train.toStation && (
                              <div className="text-xs text-gray-500 mt-1">{train.fromStation} → {train.toStation}</div>
                            )}
                            <div className="text-xs text-gray-500 mt-2 flex flex-wrap gap-x-3 gap-y-1">
                              {Object.entries(train.prices || {}).length > 0 ? (
                                Object.entries(train.prices).map(([seat, price]) => (
                                  <span key={seat}>{seat} <span className="text-blue-600">{price}</span></span>
                                ))
                              ) : (
                                <span>—</span>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    {/* 已绑定车次 */}
                    <div className="space-y-2 pt-2 border-t border-gray-200">
                      {tickets.length === 0 ? (
                        <button
                          onClick={handleAddTicket}
                          className="w-full text-center text-xs text-gray-400 hover:text-blue-600 transition"
                        >
                          还没绑定车次，去查票 →
                        </button>
                      ) : (
                        tickets.map((t, idx) => (
                          <div key={idx} className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                            <div className="text-sm text-blue-600 mb-1">🚄 {t.date || '—'}</div>
                            <div className="text-gray-900 text-sm font-medium">
                              {t.trainCode}
                              <span className="text-gray-500 text-xs ml-2">{t.startTime} → {t.arriveTime}</span>
                            </div>
                            {t.fromStation && t.toStation && (
                              <div className="text-xs text-gray-500 mt-1">{t.fromStation} → {t.toStation}</div>
                            )}
                            <div className="text-xs text-gray-500 mt-1">{renderTicketPrice(t.prices)}</div>
                            <div className="flex gap-2 mt-3">
                              <button
                                onClick={() => handleReplaceTicket(idx)}
                                className="flex-1 py-1.5 text-xs bg-blue-500/10 text-blue-600 border border-blue-300 rounded-md hover:bg-blue-500/20 transition"
                              >
                                换
                              </button>
                              <button
                                onClick={() => handleRemoveTicket(idx)}
                                className="flex-1 py-1.5 text-xs text-gray-500 border border-gray-200 rounded-md hover:bg-gray-100 transition"
                              >
                                删
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                      <button
                        onClick={handleAddTicket}
                        className="w-full py-1.5 text-xs border border-dashed border-blue-300 text-blue-600 hover:bg-blue-50 rounded-md transition"
                      >
                        + 添加车次
                      </button>
                    </div>

                    <p className="text-xs text-gray-400 text-center pt-1">以上为公布票价，实际以 12306 为准</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 底部：操作按钮 */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center gap-4">
        <button
          onClick={handleOptimize}
          disabled={optimizing}
          className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-full px-10 py-4 shadow-xl text-lg font-bold hover:shadow-2xl hover:-translate-y-0.5 transition disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
        >
          {optimizing ? 'AI 优化中...' : 'AI 智能优化路线'}
        </button>
        <div className="flex items-center gap-1">
          <button
            onClick={() => togglePanel('add')}
            className="text-sm text-gray-600 hover:text-gray-900 bg-white/70 backdrop-blur-sm rounded-full px-4 py-1.5 transition"
          >
            + 添加景点
          </button>
          <button
            onClick={() => setAiModalOpen(true)}
            className="text-sm text-gray-600 hover:text-gray-900 bg-white/70 backdrop-blur-sm rounded-full px-4 py-1.5 transition"
          >
            AI 生成路线
          </button>
        </div>
      </div>

      {/* 添加景点悬浮面板 */}
      {panel === 'add' && (
        <div
          className="absolute left-10 bottom-28 w-[400px] max-w-[90vw] z-50 bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-gray-100 flex flex-col animate-fade-in"
          style={{ maxHeight: 'calc(100vh - 220px)' }}
        >
          <div className="p-4 border-b border-gray-100 flex items-center justify-between shrink-0">
            <h3 className="font-semibold text-gray-900">添加景点</h3>
            <button
              onClick={() => setPanel(null)}
              className="text-gray-400 hover:text-gray-600 text-sm"
            >
              ✕
            </button>
          </div>

          {/* 三个 tab */}
          <div className="flex border-b border-gray-100 shrink-0">
            <button
              onClick={() => setLeftTab('marked')}
              className={`flex-1 py-2 text-xs font-medium transition relative ${
                leftTab === 'marked' ? 'text-gray-900' : 'text-gray-400 hover:text-gray-700'
              }`}
            >
              已标记（{markedPois.length}）
              {leftTab === 'marked' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />
              )}
            </button>
            <button
              onClick={() => setLeftTab('pois')}
              className={`flex-1 py-2 text-xs font-medium transition relative ${
                leftTab === 'pois' ? 'text-gray-900' : 'text-gray-400 hover:text-gray-700'
              }`}
            >
              搜索
              {leftTab === 'pois' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />
              )}
            </button>
            <button
              onClick={() => setLeftTab('routes')}
              className={`flex-1 py-2 text-xs font-medium transition relative ${
                leftTab === 'routes' ? 'text-gray-900' : 'text-gray-400 hover:text-gray-700'
              }`}
            >
              路线（{routes.length}）
              {leftTab === 'routes' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />
              )}
            </button>
          </div>

          {/* 内容区 */}
          <div key={leftTab} className="overflow-y-auto p-4 flex-1">
            {loading && (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 p-2 rounded-lg bg-gray-50 border border-gray-100">
                    <div className="flex-1 space-y-2">
                      <Skeleton className="bg-gray-200/70 h-4 w-2/3" />
                      <Skeleton className="bg-gray-200/70 h-3 w-1/3" />
                    </div>
                    <Skeleton className="bg-gray-200/70 h-7 w-14" />
                  </div>
                ))}
              </div>
            )}

            {!loading && leftTab === 'marked' && (
              <div className="space-y-2">
                {markedPois.length === 0 ? (
                  <LightEmpty
                    title="还没有标记的地方"
                    description="回城市详情页，给想去的地方点「想去」"
                  />
                ) : (
                  markedPois.map(poi => {
                    const inPlan = planStops.some(s => s.poiId === poi.id)
                    return (
                      <PoiRow
                        key={poi.id}
                        poi={poi}
                        inPlan={inPlan}
                        onAdd={handleAddToPlan}
                      />
                    )
                  })
                )}
              </div>
            )}

            {!loading && leftTab === 'pois' && (
              <div className="space-y-2">
                <input
                  value={poiSearch}
                  onChange={e => setPoiSearch(e.target.value)}
                  placeholder="搜索景点..."
                  className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 mb-3"
                />
                {!poiSearch.trim() ? (
                  <LightEmpty
                    title="搜索景点"
                    description="输入关键词，点「加入」把想去的地方加进计划 · 试试：吃饭 / 拍照 / 文化 / 公园"
                  />
                ) : filteredPois.length === 0 ? (
                  <LightEmpty
                    title="没有匹配的景点"
                    description="换个关键词试试，或直接在地图上点选"
                  />
                ) : (
                  filteredPois.map(poi => {
                    const inPlan = planStops.some(s => s.poiId === poi.id)
                    const isPreviewed = previewPois.some(p => p.id === poi.id)
                    return (
                      <PoiRow
                        key={poi.id}
                        poi={poi}
                        inPlan={inPlan}
                        onAdd={handleAddToPlan}
                        onPreview={() => previewPoiOnMap(poi)}
                        highlighted={isPreviewed}
                      />
                    )
                  })
                )}
              </div>
            )}

            {!loading && leftTab === 'routes' && (
              <div className="space-y-3">
                {routes.length === 0 ? (
                  <LightEmpty
                    title="暂无推荐路线"
                    description="这个城市还没有整理好的官方路线"
                  />
                ) : (
                  routes.map(route => {
                    const isActive = route.id === activeRouteId
                    return (
                    <div
                      key={route.id}
                      onClick={() => navigate(`/route/${route.id}`)}
                      className={`bg-white border p-3 rounded-xl cursor-pointer transition ${
                        isActive
                          ? 'border-blue-300 ring-1 ring-blue-200'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <h4 className="font-semibold text-sm text-gray-900 mb-2">{route.title}</h4>
                      <div className="flex gap-2 text-xs text-gray-500 mb-2">
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
                                <div className="flex justify-between items-center bg-gray-50 p-2 rounded-lg">
                                  <div className="min-w-0 flex-1">
                                    <span className="text-sm text-gray-900 truncate block">{node.poiName}</span>
                                    <span className="text-xs text-gray-500">{node.stayDuration} 分钟</span>
                                  </div>
                                  <button
                                    onClick={() => handleAddNodeToPlan(node)}
                                    disabled={inPlan}
                                    className={`ml-2 px-2 py-0.5 text-xs whitespace-nowrap rounded-md font-medium transition ${
                                      inPlan
                                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                        : 'bg-blue-500 text-white hover:bg-blue-600'
                                    }`}
                                  >
                                    {inPlan ? '已加入' : '+ 加入'}
                                  </button>
                                </div>
                                {seg && (
                                  <div className="flex items-center justify-between bg-gray-50 px-2 py-1 rounded-lg">
                                    <span className="text-xs text-blue-600">↓ {summarizeSegment(seg)}</span>
                                    <button
                                      onClick={() => window.open(buildNavUrl(node, nextNode), '_blank', 'noopener,noreferrer')}
                                      className="text-xs text-gray-500 hover:text-gray-700 px-2 py-0.5"
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
                            className="w-full px-3 py-2 text-sm bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition"
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
                            className="flex-1 px-3 py-1 text-xs bg-blue-500 text-white rounded-md font-medium hover:bg-blue-600 transition"
                          >
                            + 加入
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            previewRouteOnMap(route.id)
                          }}
                          className="flex-1 px-3 py-1 text-xs text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50 transition"
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
      )}

      {/* AI 生成路线弹窗 */}
      {aiModalOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setAiModalOpen(false)}
        >
          <div
            className="w-[400px] max-w-[90vw] rounded-2xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            style={{ animation: 'fadeInOpacity 0.25s ease-out both' }}
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-1">✨ AI 生成路线</h3>
            <p className="text-xs text-gray-500 mb-5">告诉 AI 你的偏好，它会从「{city?.name || '当前城市'}」的 POI 里挑出 3~5 个点，编排成一条路线。</p>

            <div className="mb-4">
              <div className="text-xs text-gray-500 mb-2">主题</div>
              <div className="flex gap-2 flex-wrap">
                {AI_THEMES.map(t => (
                  <button
                    key={t}
                    onClick={() => setAiTheme(t)}
                    className={`px-3 py-1.5 text-sm rounded-lg border transition ${
                      aiTheme === t
                        ? 'bg-blue-500/10 border-blue-300 text-blue-600'
                        : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <div className="text-xs text-gray-500 mb-2">时长</div>
              <div className="flex gap-2 flex-wrap">
                {AI_DURATIONS.map(d => (
                  <button
                    key={d}
                    onClick={() => setAiDuration(d)}
                    className={`px-3 py-1.5 text-sm rounded-lg border transition ${
                      aiDuration === d
                        ? 'bg-blue-500/10 border-blue-300 text-blue-600'
                        : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {d} 小时
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-6">
              <div className="text-xs text-gray-500 mb-2">体力</div>
              <div className="flex gap-2 flex-wrap">
                {AI_DIFFICULTIES.map(d => (
                  <button
                    key={d}
                    onClick={() => setAiDifficulty(d)}
                    className={`px-3 py-1.5 text-sm rounded-lg border transition ${
                      aiDifficulty === d
                        ? 'bg-blue-500/10 border-blue-300 text-blue-600'
                        : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setAiModalOpen(false)}
                className="flex-1 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
              >
                取消
              </button>
              <button
                onClick={handleAiGenerate}
                className="flex-1 py-2 text-sm bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition"
              >
                生成路线
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI 智能导游悬浮按钮（关闭窗口后显示） */}
      {!guideOpen && (
        <button
          onClick={() => setGuideOpen(true)}
          title="AI 智能导游"
          className="fixed left-8 bottom-8 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 text-white shadow-xl flex items-center justify-center text-2xl hover:scale-105 hover:shadow-2xl transition"
        >
          🧭
        </button>
      )}

      {/* AI 智能导游对话窗（左下角独立悬浮窗） */}
      {guideOpen && (
        <div
          className="fixed bottom-8 left-8 z-50 w-[360px] max-w-[90vw] h-[500px] max-h-[calc(100vh-3rem)] bg-white rounded-2xl shadow-2xl border border-gray-100 flex flex-col animate-fade-in"
        >
          <div className="p-4 border-b border-gray-100 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-xl">🧭</span>
              <span className="font-semibold text-gray-900">AI 智能导游</span>
            </div>
            <button
              onClick={() => setGuideOpen(false)}
              className="text-gray-400 hover:text-gray-600 text-sm"
            >
              ✕
            </button>
          </div>

          {/* 消息区 */}
          <div
            ref={guideScrollRef}
            className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50 [color-scheme:light]"
          >
            {guideMessages.length === 0 ? (
              <div className="text-center text-gray-400 text-sm leading-relaxed py-12">
                你好呀～我是你的 Citywalk 智能导游 🧭<br />
                问我这座城市的美食、景点、路线吧！
              </div>
            ) : (
              guideMessages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                      m.role === 'user'
                        ? 'bg-blue-500 text-white rounded-br-md whitespace-pre-wrap'
                        : 'bg-white text-gray-800 border border-gray-100 rounded-bl-md'
                    }`}
                  >
                    {m.role === 'user' ? m.content : <MarkdownText content={m.content} />}
                    {m.role === 'assistant' && guideStreaming && i === guideMessages.length - 1 && (
                      <span className="inline-block w-1.5 h-4 bg-gray-400 animate-pulse ml-0.5 align-text-bottom" />
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* 输入区 */}
          <div className="p-3 border-t border-gray-100 flex gap-2 shrink-0 bg-white">
            <input
              value={guideInput}
              onChange={e => setGuideInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  sendGuideMessage()
                }
              }}
              placeholder="问问这座城市的玩法..."
              className="flex-1 min-w-0 bg-gray-50 border border-gray-200 rounded-full px-4 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button
              onClick={sendGuideMessage}
              disabled={guideStreaming || !guideInput.trim()}
              className="px-4 py-2 rounded-full bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              发送
            </button>
          </div>
        </div>
      )}

      {toast && (
        <div
          className="absolute top-24 left-1/2 -translate-x-1/2 bg-gray-900/90 text-white px-6 py-3 rounded-full shadow-lg z-[70]"
          style={{ animation: 'fadeIn 0.3s ease-out' }}
        >
          {toast}
        </div>
      )}
    </div>
  )
}
