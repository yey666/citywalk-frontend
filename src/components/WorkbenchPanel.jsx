/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect, useCallback, useRef, Fragment } from 'react'
import axios from 'axios'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useTripStore } from '../store/tripStore'

const EMPTY_POIS = []

function getTodayDate() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// 去掉城市名末尾的“市”字，得到 12306 查询用的站名（如“广州市”→“广州”）
function normalizeCityName(name) {
  if (!name) return ''
  return String(name).replace(/市$/, '')
}

// 站名优先，缺失时降级用城市名（去“市”）
function stationLabel(station, city) {
  if (station) return station
  return normalizeCityName(city) || city || ''
}

// 根据备注文本猜一个交通图标
function transportIcon(note) {
  const s = note || ''
  if (s.includes('自驾') || s.includes('开车') || s.includes('拼车') || s.includes('打车')) return '🚗'
  if (s.includes('大巴') || s.includes('客车') || s.includes('汽车')) return '🚌'
  if (s.includes('飞机') || s.includes('飞')) return '✈️'
  if (s.includes('高铁') || s.includes('火车') || s.includes('动车')) return '🚄'
  return '🚄'
}

// 由起止时间推算时长（如 "08:00" / "10:30" → "2小时30分"）
function formatDuration(start, arrive) {
  if (!start || !arrive) return ''
  const toMin = (t) => {
    const [h, m] = String(t).split(':').map(Number)
    return (h || 0) * 60 + (m || 0)
  }
  const diff = toMin(arrive) - toMin(start)
  if (diff <= 0) return ''
  const h = Math.floor(diff / 60)
  const m = diff % 60
  if (h > 0) return m > 0 ? `${h}小时${m}分` : `${h}小时`
  return `${m}分钟`
}

// 把 "HH:mm" 转成分钟数
function toMinutes(t) {
  if (!t) return null
  const [h, m] = String(t).split(':').map(Number)
  if (Number.isNaN(h)) return null
  return h * 60 + (m || 0)
}

// 起止时间差（分钟），跨天或异常返回 null
function durationMinutes(start, arrive) {
  const s = toMinutes(start)
  const a = toMinutes(arrive)
  if (s == null || a == null || a <= s) return null
  return a - s
}

// 价格展示：238 → "¥238"
function formatPrice(p) {
  if (p == null || p === '' || Number.isNaN(Number(p))) return ''
  return `¥${Number(p)}`
}

// 取车次的醒目展示价：优先 price 字段，其次从 prices 里找二等座/硬座
function trainPrice(train) {
  if (train?.price != null && train.price !== '') {
    const n = Number(train.price)
    if (!Number.isNaN(n)) return n
  }
  const prices = train?.prices
  if (!prices || typeof prices !== 'object') return null
  for (const key of ['二等座', '硬座', '商务座', '一等座', '无座']) {
    const v = prices[key]
    if (v != null && v !== '') {
      const n = Number(v)
      if (!Number.isNaN(n)) return n
    }
  }
  for (const v of Object.values(prices)) {
    const n = Number(v)
    if (!Number.isNaN(n)) return n
  }
  return null
}

// 智能推荐：最早出发 / 耗时最短 / 价格最低，去重，最多 3 条
function pickBestTrains(trains) {
  if (!Array.isArray(trains) || trains.length === 0) return []
  const enriched = trains.map(t => ({
    ...t,
    _dur: durationMinutes(t.startTime, t.arriveTime),
    _price: trainPrice(t),
  }))

  const bestIdx = (key, cmp) => {
    let idx = -1
    enriched.forEach((t, i) => {
      const v = t[key]
      if (v == null || v === '') return
      if (idx === -1 || cmp(v, enriched[idx][key]) < 0) idx = i
    })
    return idx
  }

  const earliestIdx = bestIdx('startTime', (a, b) => String(a).localeCompare(String(b)))
  const fastestIdx = bestIdx('_dur', (a, b) => a - b)
  const cheapestIdx = bestIdx('_price', (a, b) => a - b)

  const seen = new Set()
  const picked = []
  const addPick = (idx, tag) => {
    if (idx < 0 || seen.has(idx)) return
    seen.add(idx)
    picked.push({ ...enriched[idx], tag })
  }

  addPick(earliestIdx, '🌅 早班')
  addPick(fastestIdx, '⚡ 最快')
  addPick(cheapestIdx, '💰 最便宜')

  return picked.slice(0, 3)
}

// ============ 城际交通卡片（默认极简单行，点击展开编辑） ============
function TransportCard({ transport = {}, fromName, toName, onChange }) {
  const [note, setNote] = useState(transport.note || '')
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState(getTodayDate)
  const [querying, setQuerying] = useState(false)
  const [queried, setQueried] = useState(false)
  const [results, setResults] = useState([])
  const [queryError, setQueryError] = useState(null)
  const debounceRef = useRef(null)

  // 外部 transport.note 变化时同步（如切换行程 / 恢复缓存）
  useEffect(() => {
    setNote(transport.note || '')
  }, [transport.note])

  // 卸载时清理防抖定时器
  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current) }, [])

  const handleNoteChange = (e) => {
    const v = e.target.value
    setNote(v)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => onChange({ note: v }), 1000)
  }

  const query = async () => {
    const from = normalizeCityName(fromName)
    const to = normalizeCityName(toName)
    if (!from || !to) {
      setQueryError('缺少相邻城市信息')
      return
    }
    setQuerying(true)
    setQueried(false)
    setQueryError(null)
    setResults([])
    try {
      const res = await axios.get('/api/train/query', { params: { from, to, date } })
      setResults(res.data?.trains || [])
    } catch (err) {
      setQueryError(err.response?.data?.message || err.message || '查询失败')
      setResults([])
    } finally {
      setQuerying(false)
      setQueried(true)
    }
  }

  const applyTrain = (train) => {
    onChange({
      trainCode: train.trainCode,
      fromStation: train.fromStation,
      toStation: train.toStation,
      startTime: train.startTime,
      arriveTime: train.arriveTime,
      duration: train.duration || formatDuration(train.startTime, train.arriveTime),
      travelDate: date,
      price: trainPrice(train),
    })
    setOpen(false)
  }

  const t = transport
  const hasTrain = !!(t.trainCode)
  const hasNote = !!(t.note && t.note.trim())

  // 极简单行文案：🚄 G2961 · 广州南-西宁 · ¥800 · 16:19出发
  let label
  let showRoute = false
  if (hasTrain) {
    const from = stationLabel(t.fromStation, fromName)
    const to = stationLabel(t.toStation, toName)
    label = `🚄 ${t.trainCode}`
    if (from && to) label += ` · ${from}-${to}`
    if (t.price != null) label += ` · ${formatPrice(t.price)}`
    if (t.startTime) label += ` · ${t.startTime}出发`
  } else if (hasNote) {
    label = `${transportIcon(t.note)} ${t.note}`
    showRoute = true
  } else {
    label = '🚄 待添加班次'
    showRoute = true
  }
  const routeText = showRoute && fromName && toName ? ` (${fromName} → ${toName})` : ''
  const editLabel = hasTrain || hasNote ? '[修改]' : '[编辑]'

  const recommended = pickBestTrains(results)

  return (
    <div className="relative pl-12 py-1">
      {/* 极简单行（点击展开） */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-1 text-left text-[11px] text-stone-400 hover:text-stone-600 transition"
      >
        <span className="flex-1 min-w-0 truncate">{label}{routeText}</span>
        <span className="shrink-0 text-stone-300">{editLabel}</span>
      </button>

      {/* 展开：白色编辑卡片 */}
      {open && (
        <div className="mt-1 bg-white border border-stone-200 rounded-xl shadow-sm p-3">
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="px-2 py-1.5 text-xs bg-white border border-stone-200 rounded-md text-stone-700 [color-scheme:light] focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
            <button
              type="button"
              onClick={query}
              disabled={querying}
              className="px-3 py-1.5 text-xs bg-blue-500 text-white rounded-md font-medium hover:bg-blue-600 transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {querying ? '查询中...' : `🚄 查票 ${normalizeCityName(fromName) || ''} → ${normalizeCityName(toName) || ''}`}
            </button>
          </div>

          {queryError && <p className="mt-2 text-xs text-red-500">{queryError}</p>}

          {!querying && !queryError && results.length === 0 && (
            <p className="mt-2 text-xs text-stone-400">
              {queried ? '⚠️ 暂无该日期车次，您可以在下方直接填写其他交通方式' : '可查询两地间高铁班次并记入本段'}
            </p>
          )}

          <div className="mt-2 space-y-1.5 max-h-48 overflow-y-auto">
            {recommended.map((train, idx) => (
              <div key={`${train.trainCode}-${idx}`} className="flex items-center justify-between bg-stone-50 border border-stone-100 rounded-lg px-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {train.tag && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 shrink-0">{train.tag}</span>
                    )}
                    <span className="text-stone-900 font-medium">{train.trainCode}</span>
                  </div>
                  <div className="text-[11px] text-stone-600 mt-0.5">
                    {stationLabel(train.fromStation, fromName)} {train.startTime} → {stationLabel(train.toStation, toName)} {train.arriveTime}
                  </div>
                  <div className="text-[11px] text-stone-400">
                    {train.duration || formatDuration(train.startTime, train.arriveTime)}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  {trainPrice(train) != null && (
                    <span className="text-sm font-bold text-orange-500">{formatPrice(trainPrice(train))}</span>
                  )}
                  <button
                    type="button"
                    onClick={() => applyTrain(train)}
                    className="text-xs px-2.5 py-1 bg-blue-500 text-white rounded-md font-medium hover:bg-blue-600 transition"
                  >
                    记入
                  </button>
                </div>
              </div>
            ))}
          </div>

          <input
            value={note}
            onChange={handleNoteChange}
            placeholder="+ 添加备注（如：自驾3小时/大巴/拼车...）"
            className="mt-2 w-full bg-stone-50 border border-stone-200 rounded-lg px-2.5 py-1.5 text-xs text-stone-700 placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
        </div>
      )}
    </div>
  )
}

// 默认风景图兜底：高德没返回图片时用，避免灰色死块
const DEFAULT_COVER = 'https://images.unsplash.com/photo-1506744626753-eda818c6cce5'

// 城市封面内存缓存：{ [城市名]: 封面URL }，查过的城市不再重复请求
const coverCache = {}

// 查询单个城市封面：每次新建 PlaceSearch 实例，避免旧实例报错/限流缓存
function searchCityCover(cityName) {
  return new Promise((resolve) => {
    window.AMap.plugin('AMap.PlaceSearch', () => {
      const ps = new window.AMap.PlaceSearch({ pageSize: 10, extensions: 'all' })
      ps.search(`${cityName} 景点`, (status, result) => {
        let url = ''
        if (status === 'complete' && result && result.poiList && result.poiList.pois) {
          const poi = result.poiList.pois.find(p => p.photos && p.photos.length > 0 && p.photos[0].url)
          if (poi) url = poi.photos[0].url
        }
        resolve(url || DEFAULT_COVER)
      })
    })
  })
}

// ============ 可拖拽城市卡片（时间轴行，含上方 🚄 连接线） ============
function SortableCityRow({ city, isFirst, prevCity, onOpen, onRemove, onUpdateTransport, covers }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: city.cityId })
  const style = { transform: CSS.Transform.toString(transform), transition }

  // 封面优先级：城市自带 coverImage > 排队拉取的真实图 > 默认兜底图（保证永不灰块）
  const cover = city.coverImage || covers[city.cityName] || DEFAULT_COVER

  return (
    <div ref={setNodeRef} style={style} className={isDragging ? 'relative z-20 opacity-70' : 'relative'}>
      {/* 两座城市之间的城际交通卡片（第一座城市上方不显示） */}
      {!isFirst && (
        <TransportCard
          transport={city.transport}
          fromName={prevCity?.cityName}
          toName={city.cityName}
          onChange={(patch) => onUpdateTransport(city.cityId, patch)}
        />
      )}

      {/* 城市卡片行 */}
      <div className="relative pl-12">
        <span className="absolute left-6 -translate-x-1/2 top-7 w-2.5 h-2.5 rounded-full bg-blue-500 ring-4 ring-white z-10" />
        <div className="flex items-center gap-3 bg-white border border-stone-200 rounded-2xl p-3 hover:shadow-md transition">
          <span
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing text-stone-300 hover:text-stone-500 text-base select-none shrink-0 px-0.5"
            title="拖拽排序"
          >
            ≡
          </span>
          <div
            className="w-14 h-14 rounded-xl bg-stone-200 bg-cover bg-center shrink-0"
            style={{ backgroundImage: `url(${cover})` }}
          />
          <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onOpen(city.cityId)}>
            <div className="font-semibold text-stone-900">{city.cityName}</div>
            <div className="text-xs text-stone-400 mt-1">
              {city.pois?.length || 0} 个景点已选
            </div>
          </div>
          <span className="text-stone-300 text-lg">→</span>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(city.cityId) }}
          className="absolute -right-1 top-4 text-stone-300 hover:text-red-400 text-sm z-10"
          title="移除"
        >
          ✕
        </button>
      </div>
    </div>
  )
}

// ============ 工作台面板（纯组件，运行在 GlobePage 右侧抽屉内） ============
export default function WorkbenchPanel({ transitInfo = [], transitMode = 'transit', onTransitModeChange }) {
  const {
    tripData,
    activeMode,
    activeCityId,
    autoSaveEnabled,
    tripRouteId,
    setActiveCity,
    backToOverview,
    updateCityPois,
    updateTransport,
    setTripRouteId,
    removeCity,
    removePoi,
    reorderCities,
    requestFit,
    resetTrip,
    setAutoSaveEnabled,
  } = useTripStore()

  const activeCityNode = tripData.find(n => n.type === 'city' && n.cityId === activeCityId)

  const [optimizing, setOptimizing] = useState(false)
  const [optResult, setOptResult] = useState(null)
  const [toast, setToast] = useState(null)
  const [saving, setSaving] = useState(false)

  const showToast = useCallback((msg, ms = 2000, kind = 'dark') => {
    setToast({ msg, kind })
    setTimeout(() => setToast(null), ms)
  }, [])

  // 城市封面：排队逐个查询，避免并发请求被高德限流
  const [covers, setCovers] = useState({})
  const coverQueueRef = useRef(false)

  const fillCovers = useCallback(async () => {
    if (coverQueueRef.current) return
    coverQueueRef.current = true
    try {
      // 等 AMap 就绪
      if (!window.AMap) {
        await new Promise((res) => window.addEventListener('amap-ready', res, { once: true }))
      }
      // 循环直到没有待查城市（顺带处理循环期间新增的城市）
      while (true) {
        const pending = useTripStore.getState().tripData.filter(
          n => n.type === 'city' && !n.coverImage && n.lng != null && n.lat != null && coverCache[n.cityName] === undefined
        )
        if (pending.length === 0) break
        for (const c of pending) {
          const url = await searchCityCover(c.cityName)
          coverCache[c.cityName] = url
          setCovers(prev => ({ ...prev, [c.cityName]: url }))
          await new Promise(r => setTimeout(r, 200)) // 逐个查询，间隔 200ms 防限流
        }
      }
    } finally {
      coverQueueRef.current = false
    }
  }, [])

  // tripData 变化时触发封面排队拉取
  useEffect(() => {
    fillCovers()
  }, [tripData, fillCovers])

  // 挂载时校验整条行程的 tripRouteId 是否仍存在（斩断幽灵缓存）
  useEffect(() => {
    const rid = useTripStore.getState().tripRouteId
    if (!rid) return
    let cancelled = false
    axios.get(`/api/route/${rid}`)
      .then(res => {
        if (cancelled) return
        if (!res.data || res.data.id == null) {
          resetTrip()
          showToast('检测到过期数据，已为您重置', 3000)
        }
      })
      .catch(() => {
        if (cancelled) return
        resetTrip()
        showToast('检测到过期数据，已为您重置', 3000)
      })
    return () => { cancelled = true }
  }, [resetTrip, showToast])

  // 单城模式：清空优化结果（不再查询本地 POI，景点由用户通过高德搜索实时添加）
  useEffect(() => {
    if (activeMode !== 'city_detail' || !activeCityId) {
      setOptResult(null)
    }
  }, [activeMode, activeCityId])

  const cityNodes = tripData.filter(n => n.type === 'city')
  const cityCount = cityNodes.length
  const totalPois = cityNodes.reduce((sum, n) => sum + (n.pois?.length || 0), 0)

  const handleOptimize = async () => {
    const nodes = activeCityNode?.pois || EMPTY_POIS
    if (nodes.length < 2) {
      showToast('至少需要 2 个景点才能优化')
      return
    }
    setOptimizing(true)
    setOptResult(null)
    try {
      const res = await axios.post('/api/route/draft/optimize', { nodes })
      const data = res.data
      const optimized = (data.optimizedNodes || []).map(n => ({
        poiId: n.poiId,
        name: n.name,
        lng: n.lng,
        lat: n.lat,
        stayDuration: n.stayDuration,
        tip: n.tip || '',
      }))
      updateCityPois(activeCityId, optimized)
      setOptResult({
        originalDistance: data.originalDistance,
        optimizedDistance: data.optimizedDistance,
        savedDistance: data.savedDistance,
      })
      showToast(data.savedDistance > 0 ? 'AI 已优化路线顺序' : '当前顺序已经是最优', 2500)
    } catch (err) {
      showToast('优化失败：' + (err.response?.data?.message || err.message), 3000)
    } finally {
      setOptimizing(false)
    }
  }

  const handleAddNextCity = () => {
    requestFit()
    showToast('地图已回到全国视野')
  }

  // 拖拽排序
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  const handleDragEnd = (event) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      reorderCities(active.id, over.id)
    }
  }

  // 保存当前 tripData：有 routeId 就 UPDATE，没有就 INSERT 并回存 routeId
  const savingRef = useRef(false)
  const saveTrip = useCallback(async (silent = false) => {
    if (savingRef.current) return
    const state = useTripStore.getState()
    const cityNodes = state.tripData.filter(n => n.type === 'city')
    if (cityNodes.length === 0) return

    savingRef.current = true
    if (!silent) setSaving(true)
    try {
      const title = cityNodes.map(n => n.cityName).join(' · ')
      // 把所有城市的景点拍平成一条全局节点列表，只发一次请求
      const flatNodes = []
      cityNodes.forEach(n => {
        ;(n.pois || []).forEach(p => {
          flatNodes.push({
            poiId: p.poiId,
            stayDuration: p.stayDuration || 60,
            tip: p.tip || '',
          })
        })
      })
      const totalMinutes = flatNodes.reduce((s, nd) => s + (nd.stayDuration || 0), 0)

      // 城际交通：从第二座城市开始，每段的 note / 高铁信息作为一条 ticket 传后端
      const tickets = cityNodes.slice(1)
        .map(n => n.transport || {})
        .filter(t => t.trainCode || (t.note && t.note.trim()))
        .map(t => ({
          trainCode: t.trainCode || null,
          fromStation: t.fromStation || null,
          toStation: t.toStation || null,
          startTime: t.startTime || null,
          arriveTime: t.arriveTime || null,
          travelDate: t.travelDate || null,
          note: t.note || null,
        }))

      const res = await axios.post('/api/route/save-draft', {
        routeId: state.tripRouteId ?? null,
        cityId: cityNodes[0] ? Number(cityNodes[0].cityId) : null,
        title,
        theme: '混合',
        duration: Math.max(1, Math.ceil(totalMinutes / 60)),
        difficulty: '轻松',
        aiGenerated: 0,
        tripDataJson: JSON.stringify(state.tripData),
        nodes: flatNodes.map((nd, i) => ({ ...nd, sortOrder: i + 1 })),
        tickets,
      })

      if (res.data?.routeId && state.tripRouteId !== res.data.routeId) {
        setTripRouteId(res.data.routeId)
      }
      if (!silent) showToast('行程已保存', 2500, 'success')
    } catch (err) {
      if (!silent) showToast('保存失败：' + (err.response?.data?.message || err.message), 3000)
    } finally {
      savingRef.current = false
      if (!silent) setSaving(false)
    }
  }, [setTripRouteId, showToast])

  // 自动保存：tripData 变化后停顿 2 秒，静默保存（防抖，受开关控制）
  useEffect(() => {
    if (!autoSaveEnabled) return
    if (tripData.length === 0) return
    const timer = setTimeout(() => saveTrip(true), 2000)
    return () => clearTimeout(timer)
  }, [tripData, saveTrip, autoSaveEnabled])

  // 返回行程总览前先静默保存一次，避免 2 秒防抖还没触发就切页面导致丢数据
  const handleBackToOverview = async () => {
    await saveTrip(true)
    backToOverview()
  }

  return (
    <div className="h-full flex flex-col pt-20">
      {activeMode === 'overview' ? (
        /* ============ 行程总览 ============ */
        <div className="h-full flex flex-col">
          <div className="px-6 py-4 border-b border-stone-100">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-stone-900">行程总览</h2>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-stone-400">自动保存</span>
                  <button
                    type="button"
                    onClick={() => setAutoSaveEnabled(!autoSaveEnabled)}
                    className={`relative w-9 h-5 rounded-full transition-colors ${autoSaveEnabled ? 'bg-emerald-500' : 'bg-stone-300'}`}
                    title={autoSaveEnabled ? '自动保存已开启' : '自动保存已关闭'}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${autoSaveEnabled ? 'translate-x-4' : ''}`} />
                  </button>
                </div>
                <button
                  onClick={() => saveTrip(false)}
                  disabled={saving}
                  className="px-4 py-1.5 rounded-full bg-[#2C2C2C] text-white text-xs font-medium hover:bg-black transition disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {saving ? '保存中...' : '保存路线'}
                </button>
              </div>
            </div>
            <p className="text-xs text-stone-400 mt-1">
              {cityCount} 座城市 · {totalPois} 个景点
            </p>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            {cityNodes.length === 0 ? (
              <div className="text-center text-stone-400 text-sm leading-relaxed py-16">
                还没有城市<br />
                点击地图上的城市光点，开始规划
              </div>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={cityNodes.map(c => c.cityId)} strategy={verticalListSortingStrategy}>
                  <div className="relative">
                    {/* 贯穿的垂直虚线主线（靠左，x = 24px） */}
                    <div className="absolute left-6 top-4 bottom-4 border-l-2 border-dashed border-stone-300" />

                    <div>
                      {cityNodes.map((city, idx) => (
                        <SortableCityRow
                          key={city.cityId}
                          city={city}
                          isFirst={idx === 0}
                          prevCity={idx > 0 ? cityNodes[idx - 1] : null}
                          onOpen={setActiveCity}
                          onRemove={removeCity}
                          onUpdateTransport={updateTransport}
                          covers={covers}
                        />
                      ))}
                    </div>
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>

          <div className="px-6 py-4 border-t border-stone-100">
            {/* 回到全国视野 */}
            <button
              onClick={handleAddNextCity}
              className="w-full py-3 rounded-full border-2 border-dashed border-stone-300 text-stone-500 text-sm hover:border-blue-400 hover:text-blue-600 transition"
            >
              + 添加下一座城市
            </button>
          </div>
        </div>
      ) : (
        /* ============ 单城规划 ============ */
        <div className="h-full flex flex-col">
          <div className="px-6 py-4 border-b border-stone-100">
            <div className="flex items-start justify-between">
              <h2 className="text-xl font-bold text-stone-900">{activeCityNode?.cityName}</h2>
              <button
                onClick={handleBackToOverview}
                className="text-xs text-stone-400 hover:text-stone-700 whitespace-nowrap"
              >
                ← 返回行程总览
              </button>
            </div>
            <p className="text-xs text-stone-400 mt-0.5 line-clamp-2">
              {activeCityNode?.slogan || activeCityNode?.description || ''}
            </p>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            {/* 交通方式切换 Tab */}
            {onTransitModeChange && (
              <div className="flex gap-2 mb-3">
                {[
                  ['transit', '🚌 公交'],
                  ['driving', '🚕 打车'],
                  ['walking', '🚶 步行'],
                ].map(([mode, label]) => (
                  <button
                    key={mode}
                    onClick={() => onTransitModeChange(mode)}
                    className={`flex-1 py-1.5 text-xs rounded-full border font-medium transition ${
                      transitMode === mode
                        ? 'bg-stone-900 text-white border-stone-900'
                        : 'bg-white text-stone-500 border-stone-200 hover:border-stone-300'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            {(activeCityNode?.pois || []).length === 0 ? (
              <div className="text-center text-stone-400 text-sm py-16">
                暂无景点，请在下方搜索添加
              </div>
            ) : (
              <ul className="space-y-2">
                {(activeCityNode.pois || []).map((poi, idx) => {
                  const total = (activeCityNode.pois || []).length
                  const seg = transitInfo[idx]
                  return (
                    <Fragment key={poi.poiId || idx}>
                      <li className="flex items-center gap-3 bg-white border border-stone-200 rounded-xl px-3 py-2.5">
                        <span className="w-5 h-5 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-stone-800 truncate">{poi.name}</div>
                          {poi.tip && <div className="text-xs text-stone-400 truncate">{poi.tip}</div>}
                        </div>
                        <button
                          onClick={() => removePoi(activeCityId, poi.poiId)}
                          className="text-stone-300 hover:text-red-400 text-sm shrink-0"
                          title="移除"
                        >
                          ✕
                        </button>
                      </li>
                      {idx < total - 1 && (
                        <li className="pl-5 text-[11px] text-stone-400">
                          {seg?.segments?.length ? (
                            <div className="space-y-0.5 py-0.5">
                              {seg.segments.map((s, si) => (
                                <div key={si} className="truncate">{s.label}</div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-stone-300">规划路线中…</span>
                          )}
                        </li>
                      )}
                    </Fragment>
                  )
                })}
              </ul>
            )}
          </div>

          {/* 底部：AI 优化（同城交通规划暂未接入，仅保留路线优化） */}
          <div className="shrink-0 border-t border-stone-100 px-6 py-4 space-y-3">
            {optResult && (
              <div className="flex items-center justify-between text-sm bg-blue-50 border border-blue-100 rounded-xl px-4 py-2">
                <span className="text-gray-600">优化后总距离</span>
                <span className="text-gray-900 font-medium">
                  {optResult.optimizedDistance} km
                  {optResult.savedDistance > 0 && (
                    <span className="text-blue-500 ml-2">↓ {optResult.savedDistance} km</span>
                  )}
                </span>
              </div>
            )}
            <button
              onClick={handleOptimize}
              disabled={optimizing}
              className="w-full py-3.5 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-sm font-bold shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {optimizing ? 'AI 优化中...' : '✨ AI 智能优化路线'}
            </button>
          </div>
        </div>
      )}

      {/* toast */}
      {toast && (
        toast.kind === 'success' ? (
          <div
            className="absolute top-20 right-6 z-[70] px-4 py-2 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 text-xs font-medium shadow-sm"
            style={{ animation: 'fadeIn 0.3s ease-out' }}
          >
            ✓ {toast.msg}
          </div>
        ) : (
          <div
            className="absolute top-24 left-1/2 -translate-x-1/2 bg-gray-900/90 text-white px-6 py-3 rounded-full shadow-lg z-[70]"
            style={{ animation: 'fadeIn 0.3s ease-out' }}
          >
            {toast.msg}
          </div>
        )
      )}
    </div>
  )
}
