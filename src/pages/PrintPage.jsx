import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import axios from 'axios'

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

  return (
    <div className="min-h-screen bg-white text-black p-8">
      <h1 className="text-2xl font-bold">{route.title}</h1>
      <p className="text-sm text-gray-700 mt-1">
        {route.duration != null && `${route.duration} 小时`}
        {route.theme && ` · ${route.theme}`}
        {route.difficulty && ` · ${route.difficulty}`}
      </p>

      <div className="mt-6">
        {route.nodes?.map((node) => (
          <div key={node.order} className="mb-4">
            <h2 className="text-lg font-semibold">{node.order} {node.poiName}</h2>
            <p className="text-sm text-gray-700">{node.stayDuration} 分钟</p>
            {node.tip && <p className="text-sm text-gray-600 mt-1">💡 {node.tip}</p>}
          </div>
        ))}
      </div>

      {route.tickets?.length > 0 && (
        <div className="mt-6 pt-4 border-t border-gray-300">
          <h2 className="text-lg font-semibold mb-2">车次</h2>
          {route.tickets.map((t) => (
            <div key={t.id} className="mb-2">
              <div className="text-sm">
                {t.travelDate}  {t.trainCode}  {t.startTime} → {t.arriveTime}
              </div>
              {t.fromStation && t.toStation && (
                <div className="text-sm text-gray-700">{t.fromStation} → {t.toStation}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
