/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
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
import Skeleton from './ui/Skeleton'

const LIGHT_INPUT_CLS =
  'w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500'

const PLACEHOLDER_PHOTOS = ['/bg1.jpg', '/bg2.jpg', '/bg3.jpg']
const EMPTY_POIS = []

function getPoiPhoto(poi) {
  if (poi?.photos) {
    try {
      const arr = JSON.parse(poi.photos)
      if (Array.isArray(arr) && arr.length > 0 && arr[0]?.url) return arr[0].url
    } catch {
      /* 忽略 */
    }
  }
  const idx = Math.abs(poi?.id || 0) % PLACEHOLDER_PHOTOS.length
  return PLACEHOLDER_PHOTOS[idx]
}

function getTomorrowDate() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function renderTicketPrice(prices) {
  if (!prices || typeof prices !== 'object') return '—'
  const entries = Object.entries(prices)
  if (entries.length === 0) return '—'
  const [seat, price] = entries.find(([s]) => s === '二等座') || entries[0]
  return `${seat} ${price}`
}

// ============ 景点卡片（勾选） ============
function PoiCard({ poi, checked, onToggle }) {
  return (
    <div
      className={`bg-white border rounded-2xl p-3 transition ${
        checked ? 'border-blue-300 ring-1 ring-blue-200' : 'border-stone-200 hover:shadow-md'
      }`}
    >
      <div
        className="h-24 bg-cover bg-center rounded-xl bg-stone-200"
        style={{ backgroundImage: `url(${getPoiPhoto(poi)})` }}
      />
      <div className="pt-2">
        <h3 className="font-medium text-sm text-stone-900 truncate">{poi.name}</h3>
        <p className="text-xs text-stone-500 line-clamp-2 mt-1">
          {poi.description || poi.category || '岭南文化的一角'}
        </p>
        <button
          onClick={() => onToggle(poi)}
          className={`mt-2 w-full py-1.5 text-xs rounded-lg border font-medium transition ${
            checked
              ? 'bg-blue-50 border-blue-200 text-blue-600'
              : 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100'
          }`}
        >
          {checked ? '✓ 已加入' : '加入行程'}
        </button>
      </div>
    </div>
  )
}

// ============ 查票助手（手风琴） ============
function TicketAssistant() {
  const [open, setOpen] = useState(false)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [date, setDate] = useState(getTomorrowDate)
  const [results, setResults] = useState([])
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [hasQueried, setHasQueried] = useState(false)

  const query = async () => {
    if (!from.trim() || !to.trim() || !date) {
      setError('请填写出发地、目的地和日期')
      return
    }
    setLoading(true)
    setError(null)
    setHasQueried(false)
    try {
      const res = await axios.get('/api/train/query', {
        params: { from: from.trim(), to: to.trim(), date },
      })
      setResults(res.data?.trains || [])
    } catch (err) {
      setError(err.response?.data?.message || err.message || '查询失败')
      setResults([])
    } finally {
      setLoading(false)
      setHasQueried(true)
    }
  }

  return (
    <div className="bg-white border border-stone-200 rounded-2xl">
      <div className="flex items-center justify-between px-4 py-3">
        <span className="font-semibold text-sm text-stone-900">🚄 查票助手</span>
        <button
          onClick={() => setOpen(o => !o)}
          className="text-sm font-medium text-blue-600 hover:text-blue-700 transition"
        >
          {open ? '收起 ↑' : '展开 ↓'}
        </button>
      </div>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          <div className="bg-stone-50 rounded-xl p-3 space-y-2">
            <input value={from} onChange={e => setFrom(e.target.value)} placeholder="出发地" className={LIGHT_INPUT_CLS} />
            <input value={to} onChange={e => setTo(e.target.value)} placeholder="目的地" className={LIGHT_INPUT_CLS} />
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className={`${LIGHT_INPUT_CLS} [color-scheme:light]`} />
            <button
              onClick={query}
              disabled={loading}
              className={`w-full py-2 text-sm rounded-lg font-medium transition ${
                loading ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-blue-500 text-white hover:bg-blue-600'
              }`}
            >
              {loading ? '查询中...' : '查询'}
            </button>

            {error && <p className="text-sm text-red-500 text-center py-1">{error}</p>}

            {hasQueried && !loading && results.length === 0 && !error && (
              <p className="text-xs text-gray-400 text-center py-1">暂无车次</p>
            )}

            <div className="space-y-2 max-h-40 overflow-y-auto">
              {results.map((train, idx) => (
                <div key={`${train.trainNo}-${idx}`} className="bg-white border border-gray-100 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <span className="text-gray-900 text-sm font-medium">{train.trainCode}</span>
                      <span className="text-xs text-gray-500 ml-2">{train.startTime} → {train.arriveTime}</span>
                    </div>
                    <button
                      onClick={() => setTickets(prev => [...prev, { ...train, date }])}
                      className="ml-2 px-3 py-1 text-xs bg-blue-500 text-white rounded-md font-medium hover:bg-blue-600 transition shrink-0"
                    >
                      记入
                    </button>
                  </div>
                  {train.fromStation && train.toStation && (
                    <div className="text-xs text-gray-500 mt-1">{train.fromStation} → {train.toStation}</div>
                  )}
                  <div className="text-xs text-gray-500 mt-1">{renderTicketPrice(train.prices)}</div>
                </div>
              ))}
            </div>
          </div>

          {tickets.length > 0 && (
            <div className="space-y-2">
              {tickets.map((t, idx) => (
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
                  <button
                    onClick={() => setTickets(prev => prev.filter((_, i) => i !== idx))}
                    className="mt-2 text-xs text-gray-500 hover:text-red-500 transition"
                  >
                    移除
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ============ 可拖拽城市卡片（时间轴行，含上方 🚄 连接线） ============
function SortableCityRow({ city, isFirst, onOpen, onRemove }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: city.cityId })
  const style = { transform: CSS.Transform.toString(transform), transition }

  return (
    <div ref={setNodeRef} style={style} className={isDragging ? 'relative z-20 opacity-70' : 'relative'}>
      {/* 两座城市之间的高铁连接线（第一座城市上方不显示） */}
      {!isFirst && (
        <div className="relative pl-12 h-9 flex items-center">
          <span className="absolute left-6 -translate-x-1/2 text-base leading-none bg-white rounded-full px-1 z-10">🚄</span>
        </div>
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
            style={city.coverImage ? { backgroundImage: `url(${city.coverImage})` } : undefined}
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
export default function WorkbenchPanel() {
  const {
    tripData,
    activeMode,
    activeCityId,
    autoSaveEnabled,
    tripRouteId,
    setActiveCity,
    backToOverview,
    updateCityPois,
    setTripRouteId,
    removeCity,
    reorderCities,
    requestFit,
    resetTrip,
    setAutoSaveEnabled,
  } = useTripStore()

  const activeCityNode = tripData.find(n => n.type === 'city' && n.cityId === activeCityId)

  const [pois, setPois] = useState([])
  const [poisLoading, setPoisLoading] = useState(false)
  const [optimizing, setOptimizing] = useState(false)
  const [optResult, setOptResult] = useState(null)
  const [toast, setToast] = useState(null)
  const [saving, setSaving] = useState(false)

  const showToast = useCallback((msg, ms = 2000, kind = 'dark') => {
    setToast({ msg, kind })
    setTimeout(() => setToast(null), ms)
  }, [])

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

  // 单城模式：拉取该城市 POI
  useEffect(() => {
    if (activeMode !== 'city_detail' || !activeCityId) {
      setPois([])
      setOptResult(null)
      return
    }
    setPoisLoading(true)
    axios.get(`/api/poi/by-city/${activeCityId}`)
      .then(res => setPois(Array.isArray(res.data) ? res.data : []))
      .catch(() => setPois([]))
      .finally(() => setPoisLoading(false))
  }, [activeMode, activeCityId])

  const checkedIds = useMemo(
    () => new Set((activeCityNode?.pois || []).map(p => p.poiId)),
    [activeCityNode]
  )

  const cityNodes = tripData.filter(n => n.type === 'city')
  const cityCount = cityNodes.length
  const totalPois = cityNodes.reduce((sum, n) => sum + (n.pois?.length || 0), 0)

  const togglePoi = (poi) => {
    if (!activeCityId) return
    const current = activeCityNode?.pois || EMPTY_POIS
    const exists = current.some(p => p.poiId === poi.id)
    const next = exists
      ? current.filter(p => p.poiId !== poi.id)
      : [...current, {
          poiId: poi.id,
          name: poi.name,
          lng: poi.lng,
          lat: poi.lat,
          stayDuration: 60,
          tip: poi.description || '',
        }]
    updateCityPois(activeCityId, next)
  }

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

      const res = await axios.post('/api/route/save-draft', {
        routeId: state.tripRouteId ?? null,
        cityId: cityNodes[0] ? Number(cityNodes[0].cityId) : null,
        title,
        theme: '混合',
        duration: Math.max(1, Math.ceil(totalMinutes / 60)),
        difficulty: '轻松',
        aiGenerated: 0,
        nodes: flatNodes.map((nd, i) => ({ ...nd, sortOrder: i + 1 })),
        tickets: [],
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
                          onOpen={setActiveCity}
                          onRemove={removeCity}
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
                onClick={backToOverview}
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
            {poisLoading ? (
              <div className="grid grid-cols-2 gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="bg-white rounded-2xl border border-stone-100 p-3">
                    <Skeleton className="h-24 w-full rounded-xl bg-stone-200/60" />
                    <div className="pt-2 space-y-2">
                      <Skeleton className="h-4 w-2/3 bg-stone-200/60" />
                      <Skeleton className="h-3 w-full bg-stone-200/60" />
                      <Skeleton className="h-8 w-full bg-stone-200/60" />
                    </div>
                  </div>
                ))}
              </div>
            ) : pois.length === 0 ? (
              <div className="text-center text-stone-400 text-sm py-16">
                这个城市还没有收录景点
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {pois.map(poi => (
                  <PoiCard
                    key={poi.id}
                    poi={poi}
                    checked={checkedIds.has(poi.id)}
                    onToggle={togglePoi}
                  />
                ))}
              </div>
            )}
          </div>

          {/* 底部：查票 + AI 优化 */}
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
            <TicketAssistant />
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
