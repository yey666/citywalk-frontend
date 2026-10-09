import { useState, useEffect, Fragment } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import axios from 'axios'
import Navbar from '../components/Navbar'
import RouteMap from '../components/RouteMap'

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

function buildNavUrl(from, to) {
  const f = `${from.lng},${from.lat},${from.poiName || ''}`
  const t = `${to.lng},${to.lat},${to.poiName || ''}`
  return `https://uri.amap.com/navigation?from=${encodeURIComponent(f)}&to=${encodeURIComponent(t)}&mode=transit`
}

export default function RouteDetailPage() {
  const { id } = useParams()
  const routeId = Number(id)
  const navigate = useNavigate()
  const [route, setRoute] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeNodeIndex, setActiveNodeIndex] = useState(0)
  const [transit, setTransit] = useState(null)

  useEffect(() => {
    if (!routeId) return
    axios.get(`/api/route/${routeId}`)
      .then(res => setRoute(res.data))
      .catch(err => console.error('加载路线失败：', err))
      .finally(() => setLoading(false))

    axios.get(`/api/route/${routeId}/transit`)
      .then(res => setTransit(res.data))
      .catch(err => console.error('加载交通方案失败：', err))
  }, [routeId])

  const handleSave = async () => {
    if (!route) return
    setSaving(true)
    try {
      await axios.post(`/api/route/${route.id}/save`)
      alert('保存成功！')
    } catch (err) {
      alert('保存失败：' + (err.response?.data?.message || err.message))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="h-screen w-screen flex flex-col bg-gray-900 text-white">
        <Navbar currentPage="route" />
        <div className="flex-1 flex items-center justify-center text-gray-500">加载中...</div>
      </div>
    )
  }

  if (!route) {
    return (
      <div className="h-screen w-screen flex flex-col bg-gray-900 text-white">
        <Navbar currentPage="route" />
        <div className="flex-1 flex items-center justify-center text-gray-500">路线不存在</div>
      </div>
    )
  }

  const totalMinutes = route.nodes?.reduce((sum, n) => sum + (n.stayDuration || 0), 0) || 0
  const totalHours = Math.round(totalMinutes / 60 * 10) / 10

  const transitByPair = new Map()
  if (transit?.segments) {
    transit.segments.forEach(s => transitByPair.set(`${s.fromPoiName}|${s.toPoiName}`, s))
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-gray-900 text-white">
      <Navbar currentPage="route" />

      <div className="flex-1 flex overflow-hidden">
        {/* 左栏：地图 */}
        <div className="w-1/2 relative bg-black">
          <RouteMap
            nodes={route.nodes || []}
            activeIndex={activeNodeIndex}
            onNodeClick={(idx) => setActiveNodeIndex(idx)}
          />

          <button
            onClick={() => navigate(-1)}
            className="absolute top-4 left-4 bg-gray-900/90 backdrop-blur px-3 py-1.5 rounded text-sm text-white border border-gray-700 hover:bg-gray-800 z-10"
          >
            ← 返回
          </button>
        </div>

        {/* 右栏：节点列表 */}
        <div className="w-1/2 bg-gray-900 flex flex-col overflow-hidden">
          <div className="p-6 border-b border-gray-800 flex-shrink-0">
            <div className="flex justify-between items-start mb-3">
              <h1 className="text-2xl font-bold text-white flex-1 pr-4">{route.title}</h1>
              <button
                onClick={handleSave}
                disabled={saving}
                className={`px-4 py-2 rounded text-sm font-semibold transition flex-shrink-0 ${
                  saving ? 'bg-gray-600' : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {saving ? '保存中...' : '收藏'}
              </button>
            </div>
            <div className="flex gap-3 text-sm text-gray-400">
              <span>{route.theme}</span>
              <span>·</span>
              <span>{totalHours} 小时</span>
              <span>·</span>
              <span>{route.difficulty}</span>
              <span>·</span>
              <span>{route.nodes?.length || 0} 个节点</span>
            </div>
            {route.description && (
              <p className="text-sm text-gray-400 mt-3 leading-relaxed">{route.description}</p>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {route.nodes?.map((node, idx) => {
              const isActive = idx === activeNodeIndex
              const nextNode = route.nodes[idx + 1]
              const seg = nextNode ? transitByPair.get(`${node.poiName}|${nextNode.poiName}`) : null
              return (
                <Fragment key={idx}>
                  <div
                    onClick={() => setActiveNodeIndex(idx)}
                    className={`p-6 border-b border-gray-800 cursor-pointer transition ${
                      isActive ? 'bg-gray-800/50 border-l-4 border-l-blue-500' : 'hover:bg-gray-800/30 border-l-4 border-l-transparent'
                    }`}
                  >
                    <div className="flex items-start gap-3 mb-3">
                      <span className={`text-sm px-2.5 py-1 rounded font-semibold flex-shrink-0 ${
                        isActive ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'
                      }`}>
                        {node.order}
                      </span>
                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-white mb-1">{node.poiName}</h3>
                        <div className="flex gap-3 text-xs text-gray-500">
                          <span>{node.category}</span>
                          <span>·</span>
                          <span>{node.stayDuration} 分钟</span>
                          {node.photoScore && (
                            <>
                              <span>·</span>
                              <span>📷 {node.photoScore}/5</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {node.photos && node.photos.length > 0 && (
                      <div className="flex gap-2 mb-3">
                        {node.photos.slice(0, 3).map((url, i) => (
                          <img
                            key={i}
                            src={url}
                            alt={node.poiName}
                            className="flex-1 h-24 object-cover rounded-lg border border-gray-700"
                            onError={(e) => { e.target.style.display = 'none' }}
                          />
                        ))}
                      </div>
                    )}

                    <div className="space-y-1.5 text-sm">
                      {node.bestVisitTime && (
                        <div className="flex gap-2">
                          <span className="text-gray-500 w-16 flex-shrink-0">最佳时段</span>
                          <span className="text-gray-300">{node.bestVisitTime}</span>
                        </div>
                      )}
                      {node.photoSpot && (
                        <div className="flex gap-2">
                          <span className="text-gray-500 w-16 flex-shrink-0">📷 机位</span>
                          <span className="text-gray-300">{node.photoSpot}</span>
                        </div>
                      )}
                      {node.avoidTip && (
                        <div className="flex gap-2">
                          <span className="text-gray-500 w-16 flex-shrink-0">⚠️ 避坑</span>
                          <span className="text-yellow-200/90">{node.avoidTip}</span>
                        </div>
                      )}
                      {node.restaurant && (
                        <div className="flex gap-2">
                          <span className="text-gray-500 w-16 flex-shrink-0">🍜 吃</span>
                          <span className="text-gray-300">{node.restaurant}</span>
                        </div>
                      )}
                      {node.tip && (
                        <div className="flex gap-2">
                          <span className="text-gray-500 w-16 flex-shrink-0">💡 提示</span>
                          <span className="text-gray-400">{node.tip}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {seg && (
                    <div className="flex items-center justify-between px-6 py-2 bg-gray-900 border-b border-gray-800">
                      <span className="text-xs text-cyan-400">↓ {summarizeSegment(seg)}</span>
                      <button
                        onClick={() => window.open(buildNavUrl(node, nextNode), '_blank', 'noopener,noreferrer')}
                        className="text-xs px-2 py-1 rounded border border-gray-600 text-gray-300 hover:text-white hover:border-cyan-500 transition"
                      >
                        导航
                      </button>
                    </div>
                  )}
                </Fragment>
              )
            })}

            {route.tickets?.length > 0 && (
              <div className="p-6 border-t border-gray-800">
                <h3 className="text-sm font-semibold text-white mb-3">🚄 已绑定车次</h3>
                <div className="space-y-2">
                  {route.tickets.map((t, idx) => (
                    <div key={idx} className="flex flex-wrap items-center gap-3 text-sm bg-gray-800/50 rounded p-3">
                      <span className="text-cyan-400">{t.travelDate || '—'}</span>
                      <span className="text-white font-medium">{t.trainCode}</span>
                      <span className="text-gray-400 text-xs">
                        {t.startTime} → {t.arriveTime}
                      </span>
                      {t.fromStation && t.toStation && (
                        <span className="text-gray-500 text-xs">
                          {t.fromStation} → {t.toStation}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="p-6 text-center text-xs text-gray-600">
              数据仅供参考 · 出发前请确认开放时间
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
