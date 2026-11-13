import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'
import { useTripStore } from '../store/tripStore'
import WorkbenchPanel from '../components/WorkbenchPanel'

// 全国视野（偏东南，让东部繁华区更居中）
const CHINA_CENTER = [105.5, 32.5]
const NATIONAL_ZOOM = 5
const CITY_ZOOM = 12

// 未加入行程的城市：蓝色发光点 + 呼吸闪烁（等待选择）
const BREATHING_MARKER_HTML = `
  <div class="city-marker">
    <span class="city-marker-halo"></span>
    <span class="city-marker-core"></span>
  </div>
`

// 已加入行程的城市：实体地标图钉（无呼吸动画）
const PIN_MARKER_HTML = `
  <div style="position: relative; width: 24px; height: 24px;">
    <div style="
      width: 24px; height: 24px;
      border-radius: 50% 50% 50% 0;
      background: #2563eb;
      border: 2px solid #fff;
      transform: rotate(-45deg);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35);
    "></div>
    <div style="
      position: absolute; left: 50%; top: 50%;
      width: 7px; height: 7px; border-radius: 50%;
      background: #fff; transform: translate(-50%, -50%);
    "></div>
  </div>
`

// 已勾选景点：青色圆点
const POI_MARKER_HTML = `
  <div style="
    width: 18px; height: 18px;
    border-radius: 50%;
    background: #22d3ee;
    border: 3px solid #fff;
    box-shadow: 0 0 10px rgba(34, 211, 238, 0.8);
    cursor: pointer;
  "></div>
`

// 规划中：未加入行程的城市降噪为浅灰小圆点
const MUTED_MARKER_HTML = `
  <div style="
    width: 8px; height: 8px;
    border-radius: 50%;
    background: rgba(120, 120, 128, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.85);
    cursor: pointer;
  "></div>
`

// 已加入行程：序号图钉 + 城市名，合并为一个整体热区（透明内边距放大命中区）
function cityPinMarkerHtml(num, name) {
  return `
    <div style="
      width: 100px;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 22px 0 14px;
      background: transparent;
      cursor: pointer;
    ">
      <div style="display: flex; flex-direction: column; align-items: center; pointer-events: none;">
        <div style="
          width: 30px; height: 30px;
          box-sizing: border-box;
          border-radius: 50%;
          background: #F97316;
          border: 3px solid #fff;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
          display: flex; align-items: center; justify-content: center;
          color: #fff; font-weight: 700; font-size: 14px;
          font-family: system-ui, sans-serif; line-height: 1;
        ">${num}</div>
        <div style="
          width: 0; height: 0;
          border-left: 7px solid transparent;
          border-right: 7px solid transparent;
          border-top: 10px solid #F97316;
        "></div>
      </div>
      <div style="
        margin-top: 4px;
        pointer-events: none;
        font-size: 13px; font-weight: 700;
        color: #333333;
        text-shadow: 0 1px 2px #ffffff, 0 0 4px #ffffff;
        white-space: nowrap; line-height: 1.2;
      ">${name}</div>
    </div>
  `
}

// 扩大 Hover 热区：用透明容器包住可见图钉，鼠标落在透明区也能触发 Hover
// anchor: 'center'（小圆点居中） | 'bottom'（图钉尖端贴在容器底部中心）
function hitZone(innerHtml, w, h, anchor = 'center') {
  if (anchor === 'bottom') {
    return `
      <div style="position: relative; width: ${w}px; height: ${h}px; background: transparent; cursor: pointer;">
        <div style="position: absolute; left: 50%; bottom: 0; transform: translateX(-50%);">${innerHtml}</div>
      </div>
    `
  }
  return `
    <div style="width: ${w}px; height: ${h}px; display: flex; align-items: center; justify-content: center; background: transparent; cursor: pointer;">${innerHtml}</div>
  `
}

// Hover 卡片景点缓存：{ [城市名]: { tags: string[], cover: string } }
const poiCache = {}

// 直辖市：区级结果直接用直辖市本身作为前缀
const MUNICIPALITIES = { '11': '北京市', '12': '天津市', '31': '上海市', '50': '重庆市' }

// 根据 adcode + 级别推导父级 adcode
function parentAdcode(adcode, level) {
  if (!adcode) return null
  if (level === 'district') {
    const prov = adcode.slice(0, 2)
    if (MUNICIPALITIES[prov]) return prov + '0000'
    return adcode.slice(0, 4) + '00'
  }
  if (level === 'city') return adcode.slice(0, 2) + '0000'
  return null
}

// 解析省份/城市前缀（用于重名去重展示）
function resolveRegion(ds, adcode, level) {
  return new Promise((resolve) => {
    if (level === 'district') {
      const prov = adcode.slice(0, 2)
      if (MUNICIPALITIES[prov]) { resolve(MUNICIPALITIES[prov]); return }
    }
    const p = parentAdcode(adcode, level)
    if (!p) { resolve(null); return }
    ds.search(p, (status, result) => {
      if (status === 'complete' && result.districtList && result.districtList.length > 0) {
        resolve(result.districtList[0].name)
      } else {
        resolve(null)
      }
    })
  })
}

export default function GlobePage() {
  const navigate = useNavigate()
  const { logout } = useAuth()
  const nickname = localStorage.getItem('nickname') || '用户'

  const { tripData, activeMode, activeCityId, addCity, setActiveCity, fitSignal } = useTripStore()

  const [allCities, setAllCities] = useState([])
  const [status, setStatus] = useState('loading') // loading | error | ready
  const [errorMsg, setErrorMsg] = useState('')

  // Hover 卡片
  const [hoverCity, setHoverCity] = useState(null)
  const [hoverPos, setHoverPos] = useState(null)
  const [hoverTags, setHoverTags] = useState([])
  const [hoverTagsLoading, setHoverTagsLoading] = useState(false)
  const [hoverCover, setHoverCover] = useState('')

  // 城市搜索（高德行政区划）
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const districtSearchRef = useRef(null)
  const searchTimerRef = useRef(null)
  const placeSearchRef = useRef(null)

  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const markersRef = useRef([])
  const mapReadyRef = useRef(false) // 地图 complete 事件触发后为 true
  const fitTimerRef = useRef(null)
  const hoverHideTimerRef = useRef(null)
  const hoverShowTimerRef = useRef(null)
  // 供 renderMarkers 读取最新数据（避免闭包陈旧）
  const dataRef = useRef({ allCities: [], tripData: [], activeMode: 'overview', activeCityId: null })
  dataRef.current = { allCities, tripData, activeMode, activeCityId }

  useEffect(() => {
    axios.get('/api/city/list')
      .then(res => {
        setAllCities(Array.isArray(res.data) ? res.data : [])
        setStatus('ready')
      })
      .catch(err => {
        console.error('加载城市失败：', err)
        setErrorMsg(err.response?.data?.message || err.message || '加载城市失败')
        setStatus('error')
      })
  }, [])

  // 点击城市 Marker（或 Hover 卡片）：已在行程 → 进入单城；否则加入行程
  const handleCityClick = useCallback((city) => {
    setHoverCity(null)
    setHoverPos(null)
    const inTrip = useTripStore.getState().tripData.some(
      n => n.type === 'city' && n.cityId === city.id
    )
    if (inTrip) {
      setActiveCity(city.id)
    } else {
      addCity(city)
    }
  }, [addCity, setActiveCity])

  // ============ 底部搜索（高德行政区划检索，覆盖冷门城市） ============
  const ensureDistrictSearch = useCallback((cb) => {
    if (!window.AMap) {
      cb(null)
      return
    }
    if (districtSearchRef.current) {
      cb(districtSearchRef.current)
      return
    }
    window.AMap.plugin('AMap.DistrictSearch', () => {
      districtSearchRef.current = new window.AMap.DistrictSearch({
        subdistrict: 0,
        extensions: 'base',
      })
      cb(districtSearchRef.current)
    })
  }, [])

  // 景点检索（AMap.PlaceSearch，extensions: 'all' 才会返回 photos）
  const ensurePlaceSearch = useCallback((cb) => {
    if (!window.AMap) {
      cb(null)
      return
    }
    if (placeSearchRef.current) {
      cb(placeSearchRef.current)
      return
    }
    window.AMap.plugin('AMap.PlaceSearch', () => {
      placeSearchRef.current = new window.AMap.PlaceSearch({
        pageSize: 10,
        pageIndex: 1,
        extensions: 'all',
      })
      cb(placeSearchRef.current)
    })
  }, [])

  const handleSearchChange = (e) => {
    const v = e.target.value
    setSearchQuery(v)
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    if (!v.trim()) {
      setSearchResults([])
      setSearching(false)
      return
    }
    setSearching(true)
    searchTimerRef.current = setTimeout(() => {
      ensureDistrictSearch((ds) => {
        if (!ds) {
          setSearching(false)
          setSearchResults([])
          return
        }
        ds.search(v.trim(), async (status, result) => {
          if (status === 'complete' && result.districtList && result.districtList.length > 0) {
            const list = result.districtList
              .filter(d => (d.level === 'city' || d.level === 'district') && d.center?.lng != null && d.center?.lat != null)
            const enriched = []
            for (const d of list) {
              const region = await resolveRegion(ds, d.adcode, d.level)
              enriched.push({ id: d.adcode, name: d.name, region, lng: d.center.lng, lat: d.center.lat })
            }
            setSearchResults(enriched)
          } else {
            setSearchResults([])
          }
          setSearching(false)
        })
      })
    }, 300)
  }

  const handleSelectCity = (city) => {
    addCity(city)
    setSearchQuery('')
    setSearchResults([])
    setSearching(false)
  }

  // ============ Hover 卡片（合并热区 + 延迟锁定） ============
  const showHoverCard = useCallback((city) => {
    const map = mapRef.current
    if (!map) return
    const px = map.lngLatToContainer([Number(city.lng), Number(city.lat)])
    setHoverCity(city)
    setHoverPos({ x: px.x, y: px.y })

    const cityName = city.name
    // 先用城市自带封面兜底，POI 照片到达后再替换
    setHoverCover(city.coverImage || '')

    // 命中缓存：直接渲染，不再请求高德
    if (poiCache[cityName]) {
      const { tags, cover } = poiCache[cityName]
      setHoverTags(tags)
      setHoverCover(cover || city.coverImage || '')
      setHoverTagsLoading(false)
      return
    }

    setHoverTags([])
    setHoverTagsLoading(true)

    ensurePlaceSearch((ps) => {
      if (!ps) {
        poiCache[cityName] = { tags: [], cover: '' }
        setHoverTags([])
        setHoverTagsLoading(false)
        return
      }
      // 关键词带上“景点”，避免搜到火车站等无关地点
      ps.search(`${cityName} 景点`, (status, result) => {
        if (status === 'complete' && result.poiList && result.poiList.pois) {
          const pois = result.poiList.pois
          const tags = pois.slice(0, 3).map(p => p.name)
          const photoPoi = pois.slice(0, 3).find(p => p.photos && p.photos.length > 0)
          const cover = photoPoi ? photoPoi.photos[0].url : ''
          poiCache[cityName] = { tags, cover }
          setHoverTags(tags)
          setHoverCover(cover || city.coverImage || '')
        } else {
          poiCache[cityName] = { tags: [], cover: '' }
          setHoverTags([])
          setHoverCover(city.coverImage || '')
        }
        setHoverTagsLoading(false)
      })
    })
  }, [ensurePlaceSearch])

  // 图钉热区 mouseenter：取消关闭 + 100ms 防抖后弹出
  const handleHotZoneEnter = useCallback((city) => {
    if (hoverHideTimerRef.current) {
      clearTimeout(hoverHideTimerRef.current)
      hoverHideTimerRef.current = null
    }
    if (hoverShowTimerRef.current) clearTimeout(hoverShowTimerRef.current)
    hoverShowTimerRef.current = setTimeout(() => {
      showHoverCard(city)
    }, 100)
  }, [showHoverCard])

  // 卡片 mouseenter：取消关闭（锁定卡片）
  const handleCardEnter = useCallback(() => {
    if (hoverHideTimerRef.current) {
      clearTimeout(hoverHideTimerRef.current)
      hoverHideTimerRef.current = null
    }
    if (hoverShowTimerRef.current) {
      clearTimeout(hoverShowTimerRef.current)
      hoverShowTimerRef.current = null
    }
  }, [])

  // 热区/卡片 mouseleave：500ms 延迟关闭（期间再次 mouseenter 会 clearTimeout）
  const handleHotZoneLeave = useCallback(() => {
    if (hoverShowTimerRef.current) {
      clearTimeout(hoverShowTimerRef.current)
      hoverShowTimerRef.current = null
    }
    if (hoverHideTimerRef.current) clearTimeout(hoverHideTimerRef.current)
    hoverHideTimerRef.current = setTimeout(() => {
      setHoverCity(null)
      setHoverPos(null)
    }, 500)
  }, [])

  // setFitView 延迟到下一帧之后，避免与 Marker 渲染冲突
  const scheduleFitView = useCallback((markers) => {
    if (fitTimerRef.current) clearTimeout(fitTimerRef.current)
    fitTimerRef.current = setTimeout(() => {
      const map = mapRef.current
      if (!map || !window.AMap || !markers.length) return
      try {
        map.setFitView(markers, false, [80, 80, 80, 80])
      } catch (e) {
        console.warn('setFitView 失败：', e)
      }
    }, 100)
  }, [])

  // 渲染标记 + 视野切换（复用同一个地图实例）
  const renderMarkers = useCallback(() => {
    const map = mapRef.current
    if (!map || !window.AMap) return
    if (!mapReadyRef.current) return // 等地图 complete 之后再渲染

    const { allCities: cities, tripData: td, activeMode: mode, activeCityId: cityId } = dataRef.current

    markersRef.current.forEach(m => m.setMap(null))
    markersRef.current = []

    const addMarker = (lng, lat, html, ox, oy, onClick) => {
      const marker = new window.AMap.Marker({
        position: [Number(lng), Number(lat)],
        content: html,
        offset: new window.AMap.Pixel(ox, oy),
      })
      if (onClick) marker.on('click', onClick)
      marker.setMap(map)
      markersRef.current.push(marker)
      return marker
    }

    const activeCityNode = td.find(n => n.type === 'city' && n.cityId === cityId)

    // 单城模式：聚焦城市 + 打点已勾选景点
    if (mode === 'city_detail' && activeCityNode && activeCityNode.lng != null && activeCityNode.lat != null) {
      addMarker(activeCityNode.lng, activeCityNode.lat, PIN_MARKER_HTML, -12, -24, null)
      ;(activeCityNode.pois || []).forEach(poi => {
        if (poi.lng == null || poi.lat == null) return
        addMarker(poi.lng, poi.lat, POI_MARKER_HTML, -9, -9, null)
      })
      try {
        map.setZoomAndCenter(CITY_ZOOM, [Number(activeCityNode.lng), Number(activeCityNode.lat)], false, 600)
      } catch (e) {
        console.warn('setZoomAndCenter 失败：', e)
      }
      return
    }

    // 总览模式：未加入 = 呼吸点/降噪灰点，已加入 = 带序号蓝色五角星
    const tripCities = td.filter(n => n.type === 'city' && n.lng != null && n.lat != null)
    const tripCityIds = new Set(tripCities.map(n => n.cityId))
    const tripNumById = new Map(tripCities.map((n, i) => [n.cityId, i + 1]))
    const hasTrip = tripCities.length > 0

    // 合并：DB 城市 + 行程中的冷门城市（不在 DB 列表里，也要打点）
    const unified = []
    const seen = new Set()
    cities.forEach(c => {
      seen.add(c.id)
      unified.push(c)
    })
    td.forEach(n => {
      if (n.type !== 'city') return
      if (n.lng == null || n.lat == null) return
      if (seen.has(n.cityId)) return
      seen.add(n.cityId)
      unified.push({
        id: n.cityId,
        name: n.cityName,
        region: n.region,
        lng: n.lng,
        lat: n.lat,
        coverImage: n.coverImage,
        slogan: n.slogan,
        description: n.description,
      })
    })

    // 城市轨迹连线（>= 2 个城市时绘制虚线 + 方向箭头）
    if (tripCities.length >= 2) {
      const path = tripCities.map(n => [Number(n.lng), Number(n.lat)])
      const polyline = new window.AMap.Polyline({
        path,
        strokeColor: '#3b82f6',
        strokeWeight: 3,
        strokeStyle: 'dashed',
        showDir: true,
        lineJoin: 'round',
      })
      polyline.setMap(map)
      markersRef.current.push(polyline)
    }

    const markers = []
    unified.forEach(city => {
      if (city.lng == null || city.lat == null) return
      const inTrip = tripCityIds.has(city.id)

      if (inTrip) {
        const num = tripNumById.get(city.id)
        const m = addMarker(
          city.lng,
          city.lat,
          cityPinMarkerHtml(num, city.name),
          -50, -62,
          () => handleCityClick(city),
        )
        m.on('mouseover', () => handleHotZoneEnter(city))
        m.on('mouseout', () => handleHotZoneLeave())
        markers.push(m)
      } else {
        const m = addMarker(
          city.lng,
          city.lat,
          hitZone(hasTrip ? MUTED_MARKER_HTML : BREATHING_MARKER_HTML, 44, 44),
          -22, -22,
          () => handleCityClick(city),
        )
        m.on('mouseover', () => handleHotZoneEnter(city))
        m.on('mouseout', () => handleHotZoneLeave())
        markers.push(m)
      }
    })

    if (markers.length > 0) {
      scheduleFitView(markers)
    }
  }, [handleCityClick, handleHotZoneEnter, handleHotZoneLeave, scheduleFitView])

  // 初始化地图（等 complete 事件后再首次渲染 Marker）
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let disposed = false

    const initMap = () => {
      if (disposed || mapRef.current) return
      if (!window.AMap) return

      if (!container.clientWidth || !container.clientHeight) {
        requestAnimationFrame(initMap)
        return
      }

      const map = new window.AMap.Map(container, {
        zoom: NATIONAL_ZOOM,
        center: CHINA_CENTER,
        viewMode: '2D',
      })
      mapRef.current = map
      mapReadyRef.current = false

      try {
        map.setMapStyle('amap://styles/whitesmoke')
      } catch (e) {
        console.warn('应用浅色地图主题失败：', e)
      }

      // 地图加载完成后再打点
      map.on('complete', () => {
        if (disposed || mapRef.current !== map) return
        mapReadyRef.current = true
        renderMarkers()
      })
    }

    if (window.__AMAP_READY__ && window.AMap) {
      initMap()
    } else {
      window.addEventListener('amap-ready', initMap)
    }

    return () => {
      disposed = true
      window.removeEventListener('amap-ready', initMap)
      if (fitTimerRef.current) clearTimeout(fitTimerRef.current)
      if (hoverHideTimerRef.current) clearTimeout(hoverHideTimerRef.current)
      if (hoverShowTimerRef.current) clearTimeout(hoverShowTimerRef.current)
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
      setHoverCity(null)
      setHoverPos(null)
      if (mapRef.current) {
        try {
          mapRef.current.clearMap()
        } catch (e) {
          /* 忽略 */
        }
        mapRef.current.destroy()
        mapRef.current = null
        markersRef.current = []
        mapReadyRef.current = false
      }
    }
  }, [renderMarkers])

  // 数据变化时刷新标记（renderMarkers 内部会等到地图 complete）
  useEffect(() => {
    renderMarkers()
  }, [allCities, tripData, activeMode, activeCityId, fitSignal, renderMarkers])

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  const cardLeft = hoverPos
    ? Math.min(Math.max(hoverPos.x, 128), Math.max(128, window.innerWidth - 128))
    : 0

  return (
    <div className="relative w-full h-screen overflow-hidden bg-stone-100">
      {/* 高德地图：2D 中国全图（显式 h-screen，确保有高度） */}
      <div ref={containerRef} className="relative w-full h-screen" />

      {/* 顶部：居中悬浮浅色毛玻璃胶囊导航 */}
      <nav className="fixed top-4 left-1/2 -translate-x-1/2 w-[95%] max-w-7xl h-14 bg-white/80 backdrop-blur-md border border-white/60 rounded-full shadow-sm z-50 flex items-center justify-between px-8 text-stone-900">
        <div
          className="font-bold text-stone-900 tracking-wide cursor-pointer"
          onClick={() => navigate('/')}
        >
          Citywalk
        </div>
        <div className="flex items-center gap-6 text-sm">
          <button onClick={() => navigate('/')} className="text-stone-900 transition">首页</button>
          <button onClick={() => navigate('/community')} className="text-stone-500 hover:text-stone-900 transition">社区</button>
          <button onClick={() => navigate('/profile')} className="text-stone-500 hover:text-stone-900 transition">我的</button>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-stone-500">{nickname}</span>
          <button onClick={handleLogout} className="text-stone-400 hover:text-stone-700 transition">退出</button>
        </div>
      </nav>

      {/* 接口错误提示 */}
      {status === 'error' && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-white/90 text-stone-700 border border-stone-200 backdrop-blur px-5 py-2.5 rounded-lg shadow-lg z-50 text-sm">
          城市加载失败：{errorMsg}
        </div>
      )}

      {/* 底部居中悬浮搜索框 */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-40 w-[400px] max-w-[92vw]">
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 text-sm pointer-events-none">🔍</span>
          <input
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder="搜索城市，添加下一站..."
            className="w-full bg-white/90 backdrop-blur-md rounded-full pl-11 pr-5 py-3 text-sm text-stone-900 placeholder-stone-400 shadow-xl shadow-black/10 border border-white/60 focus:outline-none focus:ring-2 focus:ring-blue-300"
          />

          {/* 下拉匹配列表（向上弹出） */}
          {searchQuery.trim() && (
            <div className="absolute left-0 right-0 bottom-full mb-3 bg-white border border-stone-200 rounded-2xl shadow-xl overflow-hidden max-h-64 overflow-y-auto">
              {searching ? (
                <p className="px-4 py-3 text-xs text-stone-400 text-center">搜索中…</p>
              ) : searchResults.length === 0 ? (
                <p className="px-4 py-3 text-xs text-stone-400 text-center">没有匹配的城市</p>
              ) : (
                searchResults.map(city => (
                  <button
                    key={city.id}
                    onClick={() => handleSelectCity(city)}
                    className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-stone-50 transition"
                  >
                    <span className="text-sm text-stone-700">
                      {city.name}
                      {city.region && <span className="text-stone-400 ml-1">({city.region})</span>}
                    </span>
                    <span className="text-xs text-blue-500 shrink-0 ml-3">+ 添加</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Hover 卡片：风景图 + 城市名 + 简介 + 3 个景点标签，点击任意区域即加入 */}
      {hoverCity && hoverPos && (
        <div
          className="absolute z-[60] w-[240px] bg-white/95 backdrop-blur-md rounded-2xl shadow-xl cursor-pointer"
          style={{
            left: cardLeft,
            top: hoverPos.y - 12,
            transform: 'translate(-50%, -100%)',
          }}
          onMouseEnter={handleCardEnter}
          onMouseLeave={handleHotZoneLeave}
          onClick={() => handleCityClick(hoverCity)}
        >
          <div className="h-24 w-full bg-stone-200 overflow-hidden rounded-t-2xl">
            {hoverCover ? (
              <img
                src={hoverCover}
                alt={hoverCity.name}
                className="h-24 w-full object-cover"
                onError={(e) => { e.currentTarget.style.display = 'none' }}
              />
            ) : null}
          </div>
          <div className="p-3">
            <h3 className="font-bold text-stone-900">{hoverCity.name}</h3>
            <p className="text-xs text-stone-500 line-clamp-2 mt-1">
              {hoverCity.slogan || hoverCity.description || '从世界各地出发'}
            </p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {hoverTagsLoading ? (
                <span className="text-xs text-stone-400">加载景点…</span>
              ) : hoverTags.length === 0 ? (
                <span className="text-xs text-stone-400">暂无景点</span>
              ) : (
                hoverTags.map(tag => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 text-[11px]"
                  >
                    {tag}
                  </span>
                ))
              )}
            </div>
          </div>

          {/* 透明安全桥梁：连接图钉与卡片，消除移动过程中的 mouseout 间隙 */}
          <div
            className="absolute left-1/2 -translate-x-1/2 bg-transparent cursor-pointer"
            style={{ top: '100%', width: 280, height: 56 }}
          />
        </div>
      )}

      {/* 右侧抽屉：行程工作台（tripData 有内容时滑出） */}
      <div
        className={`absolute top-0 right-0 h-full w-[440px] max-w-[92vw] z-30 bg-white/95 backdrop-blur-md border-l border-stone-200 shadow-2xl transition-transform duration-300 ease-out ${
          tripData.length > 0 ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <WorkbenchPanel />
      </div>
    </div>
  )
}
