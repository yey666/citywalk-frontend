import { useEffect, useRef } from 'react'

export default function RouteMap({ nodes, activeIndex, onNodeClick }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const markersRef = useRef([])

  useEffect(() => {
    if (!containerRef.current) return
    if (mapRef.current) return

    const initMap = () => {
      if (mapRef.current) return
      if (!window.AMap) return

      const center = nodes && nodes.length > 0
        ? [nodes[0].lng, nodes[0].lat]
        : [113.121416, 23.021548]

      const map = new window.AMap.Map(containerRef.current, {
        zoom: 13,
        center,
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

  useEffect(() => {
    if (!mapRef.current || !window.AMap) return
    if (!nodes || nodes.length === 0) return

    markersRef.current.forEach(m => m.setMap(null))
    markersRef.current = []

    nodes.forEach((node, idx) => {
      if (!node.lng || !node.lat) return

      const isActive = idx === activeIndex
      const bgColor = isActive ? '#3b82f6' : '#f97316'
      const size = isActive ? 32 : 26

      const markerContent = `
        <div style="
          width: ${size}px; height: ${size}px;
          border-radius: 50%;
          background: ${bgColor};
          border: 3px solid white;
          box-shadow: 0 0 12px ${bgColor};
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: bold;
          font-size: ${isActive ? '14' : '12'}px;
          transition: all 0.3s;
        ">${node.order}</div>
      `

      const marker = new window.AMap.Marker({
        position: [node.lng, node.lat],
        content: markerContent,
        offset: new window.AMap.Pixel(-size / 2, -size / 2),
        title: node.poiName,
      })

      marker.setMap(mapRef.current)
      marker.on('click', () => {
        if (onNodeClick) onNodeClick(idx)
      })
      markersRef.current.push(marker)
    })

    if (nodes.length > 1) {
      const path = nodes
        .filter(n => n.lng && n.lat)
        .map(n => [n.lng, n.lat])

      const polyline = new window.AMap.Polyline({
        path,
        strokeColor: '#3b82f6',
        strokeWeight: 4,
        strokeStyle: 'solid',
        lineJoin: 'round',
      })
      polyline.setMap(mapRef.current)
      markersRef.current.push(polyline)
    }

    const markers = markersRef.current.filter(m => m instanceof window.AMap.Marker)
    if (markers.length > 0) {
      mapRef.current.setFitView(markers, false, [80, 80, 80, 80])
    }
  }, [nodes, activeIndex, onNodeClick])

  return <div ref={containerRef} className="w-full h-full" />
}