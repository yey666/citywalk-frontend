/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import axios from 'axios'
import Navbar from '../components/Navbar'
import Skeleton from '../components/ui/Skeleton'
import EmptyState from '../components/ui/EmptyState'
import { usePlan } from '../context/PlanContext'

// ============ 抽屉里的小节 ============
function Section({ icon, title, children }) {
  return (
    <div>
      <div className="flex items-center gap-2 text-xs text-gray-500 mb-1 tracking-wide">
        <span>{icon}</span>
        <span>{title}</span>
      </div>
      <p className="text-sm text-gray-300 leading-relaxed">
        {children || '暂无'}
      </p>
    </div>
  )
}

// 景点占位图，按 id 分配，避免全部一样
const PLACEHOLDER_PHOTOS = [
  '/bg1.jpg',
  '/bg2.jpg',
  '/bg3.jpg',
]

function getPoiPhoto(poi) {
  // 1. 有 photos 用真图
  if (poi?.photos) {
    try {
      const arr = JSON.parse(poi.photos)
      if (Array.isArray(arr) && arr.length > 0 && arr[0]?.url) {
        return arr[0].url
      }
    } catch {
      // 忽略
    }
  }
  // 2. 没有就按 id 分配占位图
  const idx = Math.abs(poi?.id || 0) % PLACEHOLDER_PHOTOS.length
  return PLACEHOLDER_PHOTOS[idx]
}

// ============ 主组件 ============
export default function CityDetailPage() {
  const { id } = useParams()
  const cityId = Number(id)
  const navigate = useNavigate()
  const { loadCity, markedIds, toggleMark } = usePlan()

  const [pois, setPois] = useState([])
  const [routes, setRoutes] = useState([])
  const [cityInfo, setCityInfo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedPoi, setSelectedPoi] = useState(null)
  const [drawerClosing, setDrawerClosing] = useState(false)

  const [rightTab, setRightTab] = useState('pois')
  const [visibleCount, setVisibleCount] = useState(20)

  useEffect(() => {
    if (!cityId) return
    loadCity(cityId)
  }, [cityId, loadCity])

  useEffect(() => {
    if (!cityId) return
    setLoading(true)

    Promise.all([
      axios.get(`/api/city/${cityId}/overview`).catch(err => {
        console.error('加载城市详情失败：', err)
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
      setCityInfo(cityRes.data)
      setPois(poiRes.data || [])
      setRoutes(routeRes.data || [])
      setLoading(false)
    })
  }, [cityId])

  if (!cityId) return null

  const sortedPois = [...pois].sort((a, b) => {
    const aHasPhoto = a.photos ? 1 : 0
    const bHasPhoto = b.photos ? 1 : 0
    if (aHasPhoto !== bHasPhoto) return bHasPhoto - aHasPhoto
    return a.id - b.id
  })

  const closeDrawer = () => {
    setDrawerClosing(true)
    setTimeout(() => {
      setSelectedPoi(null)
      setDrawerClosing(false)
    }, 300)
  }

  return (
    <div className="h-full w-full flex flex-col text-white">
      <Navbar currentPage="city" />

      {/* 顶部返回 */}
      <div className="h-14 flex items-center px-6 border-b border-white/5 flex-shrink-0">
        <button
          onClick={() => navigate('/')}
          className="text-gray-400 hover:text-white text-sm transition"
        >
          ← 返回地球
        </button>
      </div>

      {/* 主体：左右布局 */}
      <div className="flex-1 flex overflow-hidden">

        {/* 左：封面 + slogan + 解说 */}
        <div className="w-1/2 relative overflow-hidden flex-shrink-0">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage: `url(${cityInfo?.coverImage || '/bg1.jpg'})`,
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-gray-950/40 to-gray-950/20" />

          <div className="relative h-full flex flex-col justify-end p-12">
            <h1 className="text-6xl font-bold tracking-tight mb-4">
              {cityInfo?.name || ''}
            </h1>
            <p className="text-gray-300 text-lg mb-6">
              {cityInfo?.slogan || ''}
            </p>
            <p className="text-gray-400 text-sm leading-relaxed max-w-lg">
              {cityInfo?.intro || cityInfo?.description || ''}
            </p>
          </div>
        </div>

        {/* 右：景点 + 路线 */}
        <div className="w-1/2 flex flex-col">

          {/* Tab 栏 */}
          <div className="flex border-b border-white/5 flex-shrink-0">
            <button
              onClick={() => setRightTab('pois')}
              className={`flex-1 py-4 text-sm font-medium transition relative ${
                rightTab === 'pois' ? 'text-white' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              景点（{pois.length}）
              {rightTab === 'pois' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-400" />
              )}
            </button>
            <button
              onClick={() => setRightTab('routes')}
              className={`flex-1 py-4 text-sm font-medium transition relative ${
                rightTab === 'routes' ? 'text-white' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              官方路线（{routes.length}）
              {rightTab === 'routes' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-400" />
              )}
            </button>
          </div>

          {/* 内容区 */}
          <div key={rightTab} className="flex-1 overflow-y-auto p-8 animate-fade-in">

            {loading && (
              <div className="grid grid-cols-2 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="card overflow-hidden">
                    <Skeleton className="h-32 w-full rounded-none" />
                    <div className="p-3 space-y-2">
                      <Skeleton className="h-4 w-2/3" />
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-5/6" />
                      <Skeleton className="h-8 w-full" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!loading && rightTab === 'pois' && (
              <>
                {pois.length === 0 ? (
                  <EmptyState
                    title="还没有景点"
                    description="这个城市暂时还没有收录景点，换个城市逛逛吧"
                  />
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    {sortedPois.slice(0, visibleCount).map(poi => {
                      const marked = markedIds.has(poi.id)
                      return (
                        <div
                          key={poi.id}
                          onClick={() => setSelectedPoi(poi)}
                          className={`rounded-xl overflow-hidden border shadow-lg shadow-black/50 card-hover cursor-pointer ${
                            marked
                              ? 'border-cyan-400/60 bg-cyan-400/5'
                              : 'border-white/10 bg-gray-900/60 backdrop-blur hover:border-white/30'
                          }`}
                        >
                          <div
                            className="h-32 bg-cover bg-center"
                            style={{ backgroundImage: `url(${getPoiPhoto(poi)})` }}
                          />

                          <div className="p-3">
                            <h3 className="font-medium text-sm mb-1">{poi.name}</h3>
                            <p className="text-xs text-gray-500 line-clamp-2 mb-3">
                              {poi.description || poi.category || '岭南文化的一角'}
                            </p>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                toggleMark(poi.id)
                              }}
                              className={`btn w-full py-1.5 text-xs ${
                                marked ? 'btn-tint' : 'btn-ghost'
                              }`}
                            >
                              {marked ? '✓ 已想去' : '想去'}
                            </button>
                          </div>
                        </div>
                      )
                    })}

                    {visibleCount < pois.length && (
                      <div className="col-span-2 text-center pt-6">
                        <button
                          onClick={() => setVisibleCount(prev => prev + 20)}
                          className="btn btn-ghost px-6 py-2 text-sm"
                        >
                          加载更多（还有 {pois.length - visibleCount} 个）
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {!loading && rightTab === 'routes' && (
              <>
                {routes.length === 0 ? (
                  <EmptyState
                    title="暂无官方路线"
                    description="这里还没有整理好的官方路线，先逛逛景点吧"
                  />
                ) : (
                  <div className="space-y-4">
                    {routes.map(route => (
                      <div
                        key={route.id}
                        onClick={() => navigate(`/route/${route.id}`)}
                        className="card card-hover p-4 hover:border-white/30 cursor-pointer"
                      >
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h3 className="font-medium mb-1">{route.title}</h3>
                            <div className="flex gap-2 text-xs text-gray-500">
                              <span>{route.theme}</span>
                              <span>·</span>
                              <span>{route.duration} 小时</span>
                              <span>·</span>
                              <span>{route.difficulty}</span>
                            </div>
                          </div>
                          <span className="text-xs text-gray-400">查看详情 →</span>
                        </div>
                        <p className="text-xs text-gray-500 leading-relaxed mb-3">
                          {route.description}
                        </p>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            navigate(`/plan/${cityId}?from=route&routeId=${route.id}`)
                          }}
                          className="btn btn-tint w-full py-2 text-xs"
                        >
                          以此为起点规划
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

          </div>
        </div>
      </div>

      {/* 底部悬浮条 */}
      <div className="h-16 flex items-center justify-between px-8 border-t border-white/10 bg-[#111827]/80 backdrop-blur-xl flex-shrink-0">
        <span className="text-sm text-gray-400">
          已标记 <span className="text-cyan-400 font-semibold">{markedIds.size}</span> 个地方
        </span>
        <button
          onClick={() => navigate(`/plan/${cityId}`)}
          disabled={markedIds.size === 0}
          className={`btn px-6 py-2 text-sm ${
            markedIds.size === 0
              ? 'bg-white/5 text-gray-600 cursor-not-allowed'
              : 'btn-primary'
          }`}
        >
          开始规划 →
        </button>
      </div>

      {/* ============ 抽屉 ============ */}
      {selectedPoi && (
        <>
          <div
            className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-40 ${drawerClosing ? 'animate-fade-out' : 'animate-fade-in'}`}
            onClick={closeDrawer}
          />

          <div className={`fixed right-0 top-0 h-full w-[480px] bg-[#111827]/80 backdrop-blur-xl border-l border-white/10 z-50 overflow-y-auto ${drawerClosing ? 'animate-slide-out-right' : 'animate-slide-in-right'}`}>
            <button
              onClick={closeDrawer}
              className="absolute top-4 right-4 text-gray-400 hover:text-white text-lg z-10"
            >
              ✕
            </button>

            <div
              className="h-64 bg-cover bg-center"
              style={{ backgroundImage: `url(${getPoiPhoto(selectedPoi)})` }}
            />

            <div className="p-6">
              <h2 className="heading-2xl mb-2">{selectedPoi.name}</h2>
              <p className="text-sm text-gray-300 mb-6">
                {selectedPoi.description || selectedPoi.category || '岭南文化的一角'}
              </p>

              <div className="space-y-6">
                <Section icon="📍" title="位置">
                  {selectedPoi.address}
                </Section>

                <Section icon="📷" title="机位">
                  {selectedPoi.photoSpot}
                </Section>

                <Section icon="⚠️" title="避坑">
                  {selectedPoi.avoidTip}
                </Section>

                <Section icon="🍜" title="餐厅">
                  {selectedPoi.restaurant}
                </Section>
              </div>

              <button
                className="btn btn-tint mt-8 w-full py-2 text-sm"
                onClick={() => navigate(`/community?poiId=${selectedPoi.id}`)}
              >
                查看全部反馈 →
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
