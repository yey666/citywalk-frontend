import { useEffect, useRef, useState } from 'react'
import Globe from 'react-globe.gl'

export default function GlobeComponent({ cities, onCityClick }) {
  const globeRef = useRef()
  const containerRef = useRef()
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })

  useEffect(() => {
    if (!containerRef.current) return

    const updateSize = () => {
      if (containerRef.current) {
        const w = containerRef.current.clientWidth
        const h = containerRef.current.clientHeight
        setDimensions({ width: w, height: h })
      }
    }

    updateSize()
    const observer = new ResizeObserver(updateSize)
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (globeRef.current && dimensions.width > 0) {
      const controls = globeRef.current.controls()
      controls.autoRotate = true
      controls.autoRotateSpeed = 0.4
      controls.enableZoom = true
      // 调整初始视角，让地球不会太大
      globeRef.current.pointOfView({ altitude: 2.5 }, 0)
    }
  }, [dimensions.width])

  const handleClick = (city) => {
    if (globeRef.current) {
      globeRef.current.pointOfView(
        { lat: city.lat, lng: city.lng, altitude: 2 },
        1000
      )
      setTimeout(() => {
        const controls = globeRef.current?.controls()
        if (controls) controls.autoRotate = true
      }, 1200)
    }
    if (onCityClick) onCityClick(city)
  }

  return (
    <div ref={containerRef} className="w-full h-full relative overflow-hidden">
      {dimensions.width > 0 && dimensions.height > 0 && (
        <Globe
          key={`${dimensions.width}-${dimensions.height}`}  // ← 关键！尺寸变了就重新挂载
          ref={globeRef}
          width={dimensions.width}
          height={dimensions.height}
          backgroundColor="rgba(0,0,0,0)"
          globeImageUrl="//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
          htmlElementsData={cities}
          htmlLat="lat"
          htmlLng="lng"
          htmlAltitude={0.01}
          htmlElement={(city) => {
            const el = document.createElement('div')
            el.innerHTML = `
              <div style="
                width: 14px;
                height: 14px;
                border-radius: 50%;
                background: #60a5fa;
                box-shadow: 0 0 10px #60a5fa;
                cursor: pointer;
                transition: transform 0.2s;
              "></div>
            `
            el.style.pointerEvents = 'auto'
            el.style.cursor = 'pointer'
            el.onclick = () => handleClick(city)
            el.onmouseenter = () => el.firstElementChild.style.transform = 'scale(1.6)'
            el.onmouseleave = () => el.firstElementChild.style.transform = 'scale(1)'
            return el
          }}
        />
      )}
    </div>
  )
}