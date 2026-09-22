import { useState, useEffect } from 'react'
import axios from 'axios'
import { cityIntro, defaultIntro } from '../data/cityIntro'

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

// ============ 主组件 ============
export default function CityDetailPage({
  city,
  onBack,
  onStartPlan,
  onGoRouteDetail,
}) {
  const [pois, setPois] = useState([])
  const [routes, setRoutes] = useState([])
  const [markedIds, setMarkedIds] = useState(new Set())
  const [selectedPoi, setSelectedPoi] = useState(null)

  const [rightTab, setRightTab] = useState('pois')  // 'pois' | 'routes'
  

  const info = cityIntro[city?.id] || defaultIntro

  useEffect(() => {
    if (!city) return
    axios.get(`/api/poi/by-city/${city.id}`)
      .then(res => setPois(res.data))
      .catch(err => console.error('加载 POI 失败：', err))

    axios.get(`/api/city/${city.id}/routes`)
      .then(res => setRoutes(res.data))
      .catch(err => console.error('加载路线失败：', err))
  }, [city])

  const toggleMark = (poiId) => {
    setMarkedIds(prev => {
      const next = new Set(prev)
      if (next.has(poiId)) next.delete(poiId)
      else next.add(poiId)
      return next
    })
  }

  if (!city) return null

  return (
    <div className="h-screen w-screen flex flex-col bg-gray-950 text-white">

      {/* 顶部返回 */}
      <div className="h-14 flex items-center px-6 border-b border-white/5 flex-shrink-0">
        <button
          onClick={onBack}
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
            style={{ backgroundImage: 'url(/login-bg.jpg)' }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-gray-950/40 to-gray-950/20" />

          <div className="relative h-full flex flex-col justify-end p-12">
            <h1 className="text-6xl font-bold tracking-tight mb-4">
              {city.name}
            </h1>
            <p className="text-gray-300 text-lg mb-6">
              {info.slogan}
            </p>
            <p className="text-gray-400 text-sm leading-relaxed max-w-lg">
              {info.intro}
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

  {/* 内容区：独立滚动 */}
  <div className="flex-1 overflow-y-auto p-8">

    {rightTab === 'pois' && (
      <div className="grid grid-cols-2 gap-4">
        {pois.map(poi => {
          const marked = markedIds.has(poi.id)
          return (
            <div
              key={poi.id}
              onClick={() => setSelectedPoi(poi)}
              className={`rounded-xl overflow-hidden border transition cursor-pointer ${
                marked
                  ? 'border-cyan-400/60 bg-cyan-400/5'
                  : 'border-white/10 bg-white/5 hover:border-white/20'
              }`}
            >
              <div
                className="h-32 bg-cover bg-center"
                style={{ backgroundImage: 'url(/login-bg1.jpg)' }}
              />

              <div className="p-3">
                <h3 className="font-medium text-sm mb-1">{poi.name}</h3>
                <p className="text-xs text-gray-500 line-clamp-2 mb-3">
                  {poi.description || '岭南文化的一角'}
                </p>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleMark(poi.id)
                  }}
                  className={`w-full py-1.5 rounded text-xs transition ${
                    marked
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/40'
                      : 'bg-white/5 text-gray-300 border border-white/10 hover:bg-white/10'
                  }`}
                >
                  {marked ? '✓ 已想去' : '想去'}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    )}

    {rightTab === 'routes' && (
      <div className="space-y-4">
        {routes.map(route => (
          <div
            key={route.id}
            onClick={() => onGoRouteDetail(route.id)}
            className="rounded-xl border border-white/10 bg-white/5 p-4 hover:border-white/20 transition cursor-pointer"
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
                console.log('以此为起点规划', route.id)
              }}
              className="w-full py-2 rounded text-xs bg-cyan-500/10 text-cyan-300 border border-cyan-400/30 hover:bg-cyan-500/20 transition"
            >
              以此为起点规划
            </button>
          </div>
        ))}
      </div>
    )}

  </div>
</div>
      </div>

      {/* 底部悬浮条 */}
      <div className="h-16 flex items-center justify-between px-8 border-t border-white/5 bg-gray-950 flex-shrink-0">
        <span className="text-sm text-gray-400">
          已标记 <span className="text-cyan-400 font-semibold">{markedIds.size}</span> 个地方
        </span>
        <button
          onClick={() => onStartPlan(Array.from(markedIds))}
          disabled={markedIds.size === 0}
          className={`px-6 py-2 rounded-lg text-sm font-medium transition ${
            markedIds.size === 0
              ? 'bg-white/5 text-gray-600 cursor-not-allowed'
              : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white'
          }`}
        >
          开始规划 →
        </button>
      </div>

      {/* ============ 抽屉 ============ */}
      {selectedPoi && (
        <>
          {/* 遮罩 */}
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setSelectedPoi(null)}
          />

          {/* 抽屉 */}
          <div className="fixed right-0 top-0 h-full w-[480px] bg-gray-950 border-l border-white/10 z-50 overflow-y-auto">
            <button
              onClick={() => setSelectedPoi(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white text-lg z-10"
            >
              ✕
            </button>

            {/* 大图 */}
            <div
              className="h-64 bg-cover bg-center"
              style={{ backgroundImage: 'url(/login-bg1.jpg)' }}
            />

            {/* 内容 */}
            <div className="p-6">
              <h2 className="text-2xl font-semibold mb-2">{selectedPoi.name}</h2>
              <p className="text-sm text-gray-500 mb-6">
                {selectedPoi.description || '岭南文化的一角'}
              </p>

              <div className="space-y-6">
                <Section icon="📍" title="位置">
                  {selectedPoi.address}
                </Section>

                <Section icon="📷" title="机位">
                  {selectedPoi.photoSpot}
                </Section>

                <Section icon="⚠️" title="避坑">
                  {selectedPoi.tip}
                </Section>

                <Section icon="🍜" title="餐厅">
                  {selectedPoi.restaurant}
                </Section>
              </div>

              <button
                className="mt-8 w-full py-2 bg-cyan-500/10 text-cyan-300 border border-cyan-400/30 rounded-lg hover:bg-cyan-500/20 transition text-sm"
                onClick={() => {
                  // 社区没做，先留着
                  console.log('查看全部反馈', selectedPoi.id)
                }}
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