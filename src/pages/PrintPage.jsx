import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import axios from 'axios'

// 根据交通备注猜一个图标
function transportIcon(note) {
  const s = note || ''
  if (s.includes('自驾') || s.includes('开车') || s.includes('拼车')) return '🚗'
  if (s.includes('大巴') || s.includes('客车')) return '🚌'
  if (s.includes('飞机') || s.includes('飞')) return '✈️'
  return '🚄'
}

export default function PrintPage() {
  const { id } = useParams()
  const routeId = Number(id)
  const [route, setRoute] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!routeId) return
    axios.get(`/api/route/${routeId}`)
      .then(res => setRoute(res.data))
      .catch(err => console.error('加载计划失败：', err))
      .finally(() => setLoading(false))
  }, [routeId])

  useEffect(() => {
    if (route) {
      const timer = setTimeout(() => window.print(), 100)
      return () => clearTimeout(timer)
    }
  }, [route])

  if (loading) return <div className="min-h-screen bg-white text-black p-8">加载中...</div>
  if (!route) return <div className="min-h-screen bg-white text-black p-8">计划不存在</div>

  // 从 tripDataJson 还原城市顺序与交通备注，用于在节点间回显城际交通
  const cities = (() => {
    if (!route.tripDataJson) return []
    try {
      const arr = JSON.parse(route.tripDataJson)
      return Array.isArray(arr) ? arr.filter(n => n.type === 'city') : []
    } catch {
      return []
    }
  })()
  const poiCityIndex = new Map()
  cities.forEach((c, i) => (c.pois || []).forEach(p => poiCityIndex.set(p.poiId, i)))

  return (
    <div className="min-h-screen bg-white text-black p-8">
      <h1 className="text-2xl font-bold">{route.title}</h1>
      <p className="text-sm text-gray-700 mt-1">
        {route.duration != null && `${route.duration} 小时`}
        {route.theme && ` · ${route.theme}`}
        {route.difficulty && ` · ${route.difficulty}`}
      </p>

      <div className="mt-6">
        {(() => {
          let prevCityIdx = -1
          return route.nodes?.map((node) => {
            const cityIdx = poiCityIndex.has(node.poiId) ? poiCityIndex.get(node.poiId) : -1
            const showTransport = cityIdx > 0 && cityIdx !== prevCityIdx
            if (cityIdx >= 0) prevCityIdx = cityIdx
            const transport = showTransport ? cities[cityIdx]?.transport : null
            return (
              <div key={node.order}>
                {transport && (transport.trainCode || (transport.note && transport.note.trim())) && (
                  <div className="mb-3 py-2 px-3 bg-gray-100 rounded text-sm text-gray-800">
                    {transport.trainCode ? (
                      <>
                        🚄 <span className="font-semibold">{transport.trainCode}</span>
                        {transport.startTime && transport.arriveTime ? ` · ${transport.startTime}-${transport.arriveTime}` : ''}
                      </>
                    ) : (
                      <>{transportIcon(transport.note)} {transport.note}</>
                    )}
                  </div>
                )}
                <div className="mb-4">
                  <h2 className="text-lg font-semibold">{node.order} {node.poiName}</h2>
                  <p className="text-sm text-gray-700">{node.stayDuration} 分钟</p>
                  {node.tip && <p className="text-sm text-gray-600 mt-1">💡 {node.tip}</p>}
                </div>
              </div>
            )
          })
        })()}
      </div>

      {route.tickets?.length > 0 && (
        <div className="mt-6 pt-4 border-t border-gray-300">
          <h2 className="text-lg font-semibold mb-2">交通</h2>
          {route.tickets.map((t) => (
            <div key={t.id} className="mb-2">
              {t.trainCode ? (
                <div className="text-sm">
                  {t.travelDate}  {t.trainCode}  {t.startTime} → {t.arriveTime}
                </div>
              ) : (
                <div className="text-sm">{transportIcon(t.note)} {t.note}</div>
              )}
              {t.fromStation && t.toStation && (
                <div className="text-sm text-gray-700">{t.fromStation} → {t.toStation}</div>
              )}
              {t.note && t.trainCode && (
                <div className="text-sm text-gray-700">{transportIcon(t.note)} {t.note}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
