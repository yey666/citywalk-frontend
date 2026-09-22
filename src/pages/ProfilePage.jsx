import { useEffect, useRef } from 'react'

export default function MapCanvas({
  center,
  allPois,
  planStops,
  previewRoute,
  previewPois,
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
      if (!window.AMap) return

      const map = new window.AMap.Map(containerRef.current, {
        zoom: 12,
        center: center ? [center.lng, center.lat] : [113.121416, 23.021548],
        viewMode: '2D',
      })
      mapRef.current = map
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

  // ========== markers 渲染（三段） ==========
  useEffect(() => {
    if (!mapRef.current || !window.AMap) return

    markersRef.current.forEach(m => m.setMap(null))
    markersRef.current = []

    // ========== 第 1 段：所有 POI（蓝/灰） ==========
    if (allPois && allPois.length > 0) {
      const planIds = new Set(planStops.map(s => s.poiId))

      allPois.forEach((poi) => {
        const inPlan = planIds.has(poi.id)

        const markerContent = inPlan
          ? `<div style="
              width: 20px; height: 20px;
              border-radius: 50%;
              background: #3b82f6;
              border: 3px solid white;
              box-shadow: 0 0 12px #3b82f6;
              cursor: pointer;
            "></div>`
          : `<div style="
              width: 12px; height: 12px;
              border-radius: 50%;
              background: rgba(156, 163, 175, 0.9);
              border: 2px solid white;
              cursor: pointer;
            "></div>`

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
                <button data-poi-id="${poi.id}" class="add-poi-btn" style="background: #3b82f6; color: white; border: none; padding: 6px 16px; border-radius: 6px; cursor: pointer; font-size: 13px;">+ 加入计划</button>
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
    }

    // ========== 第 2 段：多点预览（黄色） ==========
    if (previewPois && previewPois.length > 0) {
      previewPois.forEach((poi, idx) => {
        const isLatest = idx === previewPois.length - 1
        const opacity = isLatest ? 1 : 0.4
        const size = isLatest ? 32 : 24

        const markerContent = `
          <div style="
            width: ${size}px;
            height: ${size}px;
            border-radius: 50%;
            background: #eab308;
            border: 3px solid white;
            box-shadow: 0 0 ${isLatest ? '16' : '6'}px rgba(234, 179, 8, ${opacity});
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
            font-size: ${isLatest ? '14' : '11'}px;
            opacity: ${opacity};
            transition: all 0.3s;
          ">${previewPois.length > 1 ? idx + 1 : '📍'}</div>
        `

        const marker = new window.AMap.Marker({
          position: [poi.lng, poi.lat],
          content: markerContent,
          offset: new window.AMap.Pixel(-size / 2, -size / 2),
          title: poi.name,
        })

        marker.setMap(mapRef.current)
        markersRef.current.push(marker)
      })

      // 地图平移到最新的点
      const latest = previewPois[previewPois.length - 1]
      mapRef.current.setCenter([latest.lng, latest.lat])
    }

    // ========== 第 3 段：路线预览（橙色编号 + 连线） ==========
    if (previewRoute && previewRoute.nodes && previewRoute.nodes.length > 0) {
      const path = []

      previewRoute.nodes.forEach((node) => {
        if (!node.lng || !node.lat) return

        path.push([node.lng, node.lat])

        const markerContent = `
          <div style="
            width: 28px; height: 28px;
            border-radius: 50%;
            background: #f97316;
            border: 3px solid white;
            box-shadow: 0 0 12px rgba(249, 115, 22, 0.8);
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
            font-size: 13px;
          ">${node.order}</div>
        `

        const marker = new window.AMap.Marker({
          position: [node.lng, node.lat],
          content: markerContent,
          offset: new window.AMap.Pixel(-14, -14),
          title: node.poiName,
        })

        marker.setMap(mapRef.current)
        markersRef.current.push(marker)
      })

      // 画连线
      if (path.length > 1) {
        const polyline = new window.AMap.Polyline({
          path,
          strokeColor: '#f97316',
          strokeWeight: 4,
          strokeStyle: 'solid',
          lineJoin: 'round',
        })
        polyline.setMap(mapRef.current)
        markersRef.current.push(polyline)
      }

      // 缩放到能看到所有点
      const markers = markersRef.current.filter(m => m instanceof window.AMap.Marker)
      if (markers.length > 0) {
        mapRef.current.setFitView(markers, false, [80, 80, 80, 80])
      }
    }
  }, [allPois, planStops, previewPois, previewRoute, onPoiClick])

  return <div ref={containerRef} className="w-full h-full" />
}