import { useEffect, useRef, useState } from 'react'
import Globe from 'react-globe.gl'

export default function GlobeComponent({ cities, onCityClick }) {
  const globeRef = useRef()
  const [dimensions, setDimensions] = useState({ width: 800, height: 800 })
  const containerRef = useRef()

  // 监听容器尺寸，让地球自适应
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        })
      }
    }
    updateSize()
    window.addEventListener('resize', updateSize)
    return () => window.removeEventListener('resize', updateSize)
  }, [])

  // 地球初始化后，自动旋转
  useEffect(() => {
    if (globeRef.current) {
      globeRef.current.controls().autoRotate = true
      globeRef.current.controls().autoRotateSpeed = 0.5
    }
  }, [])

  const handlePointClick = (point) => {
    // 点击 marker 时，地球转到该点
    if (globeRef.current) {
      globeRef.current.pointOfView(
        { lat: point.lat, lng: point.lng, altitude: 1.5 },
        1000
      )
    }
    // 通知父组件
    if (onCityClick) {
      onCityClick(point)
    }
  }

  return (
    <div ref={containerRef} className="w-full h-full">
      <Globe
        ref={globeRef}
        width={dimensions.width}
        height={dimensions.height}
        backgroundColor="rgba(0,0,0,0)"
        globeImageUrl="//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
        pointsData={cities}
        pointLat="lat"
        pointLng="lng"
        pointColor={() => '#ff6b6b'}
        pointAltitude={0.01}
        pointRadius={0.4}
        pointLabel="name"
        onPointClick={handlePointClick}
      />
    </div>
  )
}