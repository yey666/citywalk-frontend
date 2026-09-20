import { useEffect, useRef } from 'react'

export default function MapCanvas({
  center,
  allPois,
  planStops,
  onPoiClick,
}) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const markersRef = useRef([])
  const infoWindowRef = useRef(null)

  // 初始化地图
  useEffect(() => {
    if (!containerRef.current) return
    if (mapRef.current) return

    const initMap = () => {
      if (mapRef.current) return
      if (!window.AMap) {
        console.warn('AMap 未加载')
        return
      }

      const map = new window.AMap.Map(containerRef.current, {
        zoom: 12,
        center: center ? [center.lng, center.lat] : [113.121416, 23.021548],
        viewMode: '2D',
      })
      mapRef.current = map
      console.log('地图初始化完成')
    }

    if (window.__AMAP_READY__ && window.AMap) {
      initMap()
    } else {
      window.addEventListener('amap-ready', initMap)
    }

    return () => {
      window.removeEventListener('amap-ready', initMap)
      if (mapRef.current) {
        mapRef.current.destroy()
        mapRef.current = null
      }
    }
  }, [])

  // 中心变化
  useEffect(() => {
    if (mapRef.current && center) {
      mapRef.current.setCenter([center.lng, center.lat])
    }
  }, [center])

  // markers 变化
  useEffect(() => {
    if (!mapRef.current || !window.AMap) return

    markersRef.current.forEach(m => m.setMap(null))
    markersRef.current = []

    if (!allPois || allPois.length === 0) return

    const planIds = new Set(planStops.map(s => s.poiId))

    allPois.forEach((poi) => {
      const inPlan = planIds.has(poi.id)

      const markerContent = inPlan
        ? `<div style="width: 20px; height: 20px; border-radius: 50%; background: #3b82f6; border: 3px solid white; box-shadow: 0 0 12px #3b82f6; cursor: pointer;"></div>`
        : `<div style="width: 12px; height: 12px; border-radius: 50%; background: rgba(156, 163, 175, 0.9); border: 2px solid white; cursor: pointer;"></div>`

      const marker = new window.AMap.Marker({
        position: [poi.lng, poi.lat],
        content: markerContent,
        offset: new window.AMap.Pixel(-10, -10),
        title: poi.name,
      })

      marker.setMap(mapRef.current)

      marker.on('click', () => {
        if (infoWindowRef.current) {
          infoWindowRef.current.close()
        }

        const infoContent = inPlan
          ? `<div style="padding: 10px; min-width: 140px; font-family: system-ui;">
              <div style="font-weight: 600; margin-bottom: 4px; font-size: 14px;">${poi.name}</div>
              <div style="font-size: 12px; color: #3b82f6;">✓ 已在计划中</div>
            </div>`
          : `<div style="padding: 10px; min-width: 160px; font-family: system-ui;">
              <div style="font-weight: 600; margin-bottom: 4px; font-size: 14px;">${poi.name}</div>
              <div style="font-size: 12px; color: #888; margin-bottom: 10px;">${poi.category || ''}</div>
              <button data-poi-id="${poi.id}" class="add-poi-btn" style="background: #3b82f6; color: white; border: none; padding: 6px 16px; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 500;">+ 加入计划</button>
            </div>`

        const infoWindow = new window.AMap.InfoWindow({
          content: infoContent,
          offset: new window.AMap.Pixel(0, -20),
        })
        infoWindow.open(mapRef.current, [poi.lng, poi.lat])
        infoWindowRef.current = infoWindow

        setTimeout(() => {
          const btn = document.querySelector(`.add-poi-btn[data-poi-id="${poi.id}"]`)
          if (btn) {
            btn.onclick = () => {
              onPoiClick(poi)
              infoWindow.close()
              infoWindowRef.current = null
            }
          }
        }, 0)
      })

      markersRef.current.push(marker)
    })
  }, [allPois, planStops])

  return <div ref={containerRef} className="w-full h-full" />
}