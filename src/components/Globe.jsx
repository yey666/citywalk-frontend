import { useEffect, useRef, useState } from 'react'
import Globe from 'react-globe.gl'

export default function GlobeComponent({ cities, onCityClick }) {
  const globeRef = useRef()
  const [dimensions, setDimensions] = useState({ width: 800, height: 800 })
  const containerRef = useRef()

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

  useEffect(() => {
    if (globeRef.current) {
      globeRef.current.controls().autoRotate = false
      globeRef.current.controls().autoRotateSpeed = 0.5
    }
  }, [])

  const handleClick = (city) => {
    console.log('点击城市：', city)
    if (globeRef.current) {
      globeRef.current.pointOfView(
        { lat: city.lat, lng: city.lng, altitude: 1.5 },
        1000
      )
    }
    if (onCityClick) {
      onCityClick(city)
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
        htmlElementsData={cities}
        htmlLat="lat"
        htmlLng="lng"
        htmlAltitude={0.01}
        htmlElement={(city) => {
          const el = document.createElement('div')
          el.innerHTML = `
            <div style="
              width: 16px;
              height: 16px;
              border-radius: 50%;
              background: #32bbe1;
              box-shadow: 0 0 12px #32bbe1;
              cursor: pointer;
              transition: transform 0.2s;
            "></div>
          `
          el.style.pointerEvents = 'auto'
          el.style.cursor = 'pointer'
          el.onclick = () => handleClick(city)
          el.onmouseenter = () => el.firstElementChild.style.transform = 'scale(1.5)'
          el.onmouseleave = () => el.firstElementChild.style.transform = 'scale(1)'
          return el
        }}
      />
    </div>
  )
}