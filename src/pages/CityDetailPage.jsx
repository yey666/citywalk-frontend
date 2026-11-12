/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import axios from 'axios'
import Skeleton from '../components/ui/Skeleton'
import { usePlan } from '../context/PlanContext'
import { useAuth } from '../context/AuthContext'
import { useTripStore } from '../store/tripStore'

// ============ 抽屉里的小节（浅色） ============
function Section({ icon, title, children }) {
  return (
    <div>
      <div className="flex items-center gap-2 text-xs text-stone-400 mb-1 tracking-wide">
        <span>{icon}</span>
        <span>{title}</span>
      </div>
      <p className="text-sm text-stone-700 leading-relaxed">
        {children || '暂无'}
      </p>
    </div>
  )
}

// 浅色空状态
function LightEmpty({ title, description }) {
  return (
    <div className="flex flex-col items-center justify-center text-center px-6 py-16">
      <div className="w-14 h-14 mb-3 rounded-2xl bg-stone-100 border border-stone-200 flex items-center justify-center">
        <svg
          className="w-6 h-6 text-stone-400"
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
      {title && <h3 className="text-sm font-medium text-stone-700 mb-1">{title}</h3>}
      {description && (
        <p className="text-xs text-stone-400 max-w-xs leading-relaxed">{description}</p>
      )}
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
  const { logout } = useAuth()
  const addCity = useTripStore((s) => s.addCity)
  const nickname = localStorage.getItem('nickname') || '用户'

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

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  // 加入行程并回到首页（首页地图 + 右侧工作台抽屉已同屏）
  const goPlan = () => {
    addCity(cityInfo || { id: cityId, name: `城市 ${cityId}` })
    navigate('/')
  }

  return (
    <div className="h-full w-full bg-stone-50 text-stone-900">
      {/* 顶部：居中悬浮白色毛玻璃胶囊导航 */}
      <nav className="fixed top-4 left-1/2 -translate-x-1/2 w-[95%] max-w-7xl h-14 bg-white/85 backdrop-blur-md rounded-full shadow-sm z-50 flex items-center justify-between px-8">
        <div
          className="font-bold text-stone-900 tracking-wide cursor-pointer"
          onClick={() => navigate('/')}
        >
          Citywalk
        </div>
        <div className="flex items-center gap-6 text-sm">
          <button
            onClick={() => navigate('/')}
            className="text-stone-500 hover:text-stone-900 transition"
          >
            首页
          </button>
          <button
            onClick={() => navigate('/community')}
            className="text-stone-500 hover:text-stone-900 transition"
          >
            社区
          </button>
          <button
            onClick={() => navigate('/profile')}
            className="text-stone-500 hover:text-stone-900 transition"
          >
            我的
          </button>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-stone-500">{nickname}</span>
          <button
            onClick={handleLogout}
            className="text-stone-400 hover:text-stone-700 transition"
          >
            退出
          </button>
        </div>
      </nav>

      {/* 主体：左右布局 */}
      <div className="h-full flex">

        {/* 左：封面 Hero */}
        <div className="w-[45%] flex-shrink-0 flex flex-col pl-4 pr-4 pt-20 pb-4">
          <div className="flex-1 relative rounded-3xl shadow-lg overflow-hidden">
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{
                backgroundImage: `url(${cityInfo?.coverImage || '/bg1.jpg'})`,
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />

            <div className="relative h-full flex flex-col justify-end p-10">
              <h1 className="text-5xl font-bold tracking-tight text-white mb-3">
                {cityInfo?.name || ''}
              </h1>
              <p className="text-white/90 text-lg mb-4">
                {cityInfo?.slogan || ''}
              </p>
              <p className="text-white/80 text-sm leading-relaxed max-w-lg line-clamp-3">
                {cityInfo?.intro || cityInfo?.description || ''}
              </p>
            </div>
          </div>
        </div>

        {/* 右：景点 + 路线 */}
        <div className="flex-1 flex flex-col min-w-0">

          {/* Tab 栏 */}
          <div className="flex items-center gap-8 px-8 pt-20 pb-4 flex-shrink-0">
            <button
              onClick={() => setRightTab('pois')}
              className={`relative pb-1 text-sm font-medium transition ${
                rightTab === 'pois' ? 'text-stone-900' : 'text-stone-400 hover:text-stone-600'
              }`}
            >
              景点（{pois.length}）
              {rightTab === 'pois' && (
                <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-blue-500 rounded-full" />
              )}
            </button>
            <button
              onClick={() => setRightTab('routes')}
              className={`relative pb-1 text-sm font-medium transition ${
                rightTab === 'routes' ? 'text-stone-900' : 'text-stone-400 hover:text-stone-600'
              }`}
            >
              官方路线（{routes.length}）
              {rightTab === 'routes' && (
                <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-blue-500 rounded-full" />
              )}
            </button>
          </div>

          {/* 内容区 */}
          <div
            key={rightTab}
            className="flex-1 overflow-y-auto px-8 pb-24 animate-fade-in [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >

            {loading && (
              <div className="grid grid-cols-2 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="bg-white rounded-2xl border border-stone-100 p-3">
                    <Skeleton className="h-32 w-full rounded-xl bg-stone-200/60" />
                    <div className="pt-3 space-y-2">
                      <Skeleton className="h-4 w-2/3 bg-stone-200/60" />
                      <Skeleton className="h-3 w-full bg-stone-200/60" />
                      <Skeleton className="h-3 w-5/6 bg-stone-200/60" />
                      <Skeleton className="h-8 w-full bg-stone-200/60" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!loading && rightTab === 'pois' && (
              <>
                {pois.length === 0 ? (
                  <LightEmpty
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
                          className={`bg-white rounded-2xl border p-3 cursor-pointer transition-all hover:shadow-md ${
                            marked ? 'border-blue-200' : 'border-stone-100 hover:border-stone-200'
                          }`}
                        >
                          <div
                            className="h-32 bg-cover bg-center rounded-xl"
                            style={{ backgroundImage: `url(${getPoiPhoto(poi)})` }}
                          />

                          <div className="pt-3">
                            <h3 className="font-medium text-sm text-stone-900 mb-1 truncate">{poi.name}</h3>
                            <p className="text-xs text-stone-500 line-clamp-3 mb-3">
                              {poi.description || poi.category || '岭南文化的一角'}
                            </p>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                toggleMark(poi.id)
                              }}
                              className={`w-full py-1.5 text-xs rounded-lg border font-medium transition ${
                                marked
                                  ? 'bg-blue-50 border-blue-200 text-blue-600'
                                  : 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100'
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
                          className="px-6 py-2 text-sm text-stone-600 bg-white border border-stone-200 rounded-full hover:bg-stone-50 transition"
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
                  <LightEmpty
                    title="暂无官方路线"
                    description="这里还没有整理好的官方路线，先逛逛景点吧"
                  />
                ) : (
                  <div className="space-y-4">
                    {routes.map(route => (
                      <div
                        key={route.id}
                        onClick={() => navigate(`/route/${route.id}`)}
                        className="bg-white rounded-2xl border border-stone-100 p-4 cursor-pointer transition-all hover:shadow-md"
                      >
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h3 className="font-medium text-stone-900 mb-1">{route.title}</h3>
                            <div className="flex gap-2 text-xs text-stone-500">
                              <span>{route.theme}</span>
                              <span>·</span>
                              <span>{route.duration} 小时</span>
                              <span>·</span>
                              <span>{route.difficulty}</span>
                            </div>
                          </div>
                          <span className="text-xs text-stone-400">查看详情 →</span>
                        </div>
                        <p className="text-xs text-stone-500 leading-relaxed mb-3">
                          {route.description}
                        </p>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            goPlan()
                          }}
                          className="w-full py-2 text-xs rounded-lg bg-blue-500 text-white font-medium hover:bg-blue-600 transition"
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
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-md rounded-full shadow-xl px-6 py-3 flex items-center gap-8 border border-stone-200 z-50">
        <span className="text-sm text-stone-500">
          已标记 <span className="text-blue-600 font-semibold">{markedIds.size}</span> 个地方
        </span>
        <button
          onClick={goPlan}
          disabled={markedIds.size === 0}
          className={`px-6 py-2 rounded-full text-sm font-medium transition ${
            markedIds.size === 0
              ? 'bg-stone-100 text-stone-400 cursor-not-allowed'
              : 'bg-blue-500 text-white hover:bg-blue-600'
          }`}
        >
          开始规划 →
        </button>
      </div>

      {/* ============ 抽屉 ============ */}
      {selectedPoi && (
        <>
          <div
            className={`fixed inset-0 bg-black/40 backdrop-blur-sm z-40 ${drawerClosing ? 'animate-fade-out' : 'animate-fade-in'}`}
            onClick={closeDrawer}
          />

          <div className={`fixed right-0 top-0 h-full w-[480px] bg-white border-l border-stone-100 z-50 overflow-y-auto ${drawerClosing ? 'animate-slide-out-right' : 'animate-slide-in-right'}`}>
            <button
              onClick={closeDrawer}
              className="absolute top-4 right-4 text-stone-400 hover:text-stone-700 text-lg z-10"
            >
              ✕
            </button>

            <div
              className="h-64 bg-cover bg-center"
              style={{ backgroundImage: `url(${getPoiPhoto(selectedPoi)})` }}
            />

            <div className="p-6">
              <h2 className="text-2xl font-bold text-stone-900 mb-2">{selectedPoi.name}</h2>
              <p className="text-sm text-stone-500 mb-6">
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
                className="mt-8 w-full py-2 text-sm rounded-lg bg-blue-500/10 text-blue-600 border border-blue-200 hover:bg-blue-500/20 transition"
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
