import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'
import { useTripStore } from '../store/tripStore'
import WorkbenchPanel from '../components/WorkbenchPanel'
import AiChatWidget from '../components/AiChatWidget'

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

// 已勾选景点：青色序号圆点（序号与右侧面板列表的 index+1 严格对应）
function poiNumberMarkerHtml(num) {
  return `
    <div style="
      width: 24px; height: 24px;
      box-sizing: border-box;
      border-radius: 50%;
      background: #22d3ee;
      border: 2px solid #fff;
      box-shadow: 0 0 10px rgba(34, 211, 238, 0.8);
      display: flex; align-items: center; justify-content: center;
      color: #fff; font-weight: 700; font-size: 12px;
      font-family: system-ui, sans-serif; line-height: 1;
      cursor: pointer;
    ">${num}</div>
  `
}

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

// 序号图钉主体（橙色圆点 + 底部小尾巴），供两种形态复用
function pinInnerHtml(num) {
  return `
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
  `
}

// 已加入行程（冷门城市）：序号图钉 + 黑色城市名，合并为一个整体热区（透明内边距放大命中区）
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
      ${pinInnerHtml(num)}
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

// 已加入行程（底图自带城市名）：仅序号图钉，尾巴尖指向底图原有名称，避免文字重叠
function cityPinOnlyMarkerHtml(num) {
  return `
    <div style="
      width: 44px;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 14px 0 0;
      background: transparent;
      cursor: pointer;
    ">
      ${pinInnerHtml(num)}
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

// 底图自带文字标注的热门大城市（直辖市 + 各省会/首府 + 常见大城市）
// 这些城市在高德底图全国视野已自带名称，我们的序号图钉不再重复渲染黑色城市名
const MAJOR_CITIES = new Set([
  // 直辖市
  '北京', '上海', '天津', '重庆',
  // 省会 / 自治区首府
  '石家庄', '太原', '呼和浩特', '沈阳', '长春', '哈尔滨',
  '南京', '杭州', '合肥', '福州', '南昌', '济南',
  '郑州', '武汉', '长沙', '广州', '南宁', '海口',
  '成都', '贵阳', '昆明', '拉萨', '西安', '兰州',
  '西宁', '银川', '乌鲁木齐',
  // 计划单列市 / 常见大城市
  '深圳', '大连', '青岛', '宁波', '厦门',
  '苏州', '无锡', '常州', '南通', '徐州',
  '温州', '嘉兴', '绍兴', '金华', '台州',
  '佛山', '东莞', '中山', '珠海', '惠州',
  '泉州', '漳州', '烟台', '潍坊', '临沂', '淄博',
  '唐山', '保定', '邯郸', '秦皇岛', '洛阳', '南阳',
  '宜昌', '襄阳', '岳阳', '衡阳', '柳州', '桂林',
  '绵阳', '遵义', '汕头', '湛江', '威海',
  '芜湖', '九江', '赣州', '咸阳', '宝鸡', '大理', '丽江',
  '香港', '澳门',
])

// 去掉“市/省/自治区/自治州/特别行政区”等后缀，得到城市核心名
function normalizeCityName(name) {
  if (!name) return ''
  return String(name)
    .replace(/(市|地区|自治州|盟|特别行政区|省|自治区)$/, '')
    .trim()
}

// 判断是否为底图自带名称的大城市
function isMajorCity(name) {
  return MAJOR_CITIES.has(normalizeCityName(name))
}

// 从 AMap PlaceSearch 的 POI 结果中提取经纬度（兼容 LngLat 实例与纯对象两种形态）
function poiLngLat(poi) {
  const loc = poi && poi.location
  if (!loc) return null
  const lng = Number(loc.lng != null ? loc.lng : (typeof loc.getLng === 'function' ? loc.getLng() : NaN))
  const lat = Number(loc.lat != null ? loc.lat : (typeof loc.getLat === 'function' ? loc.getLat() : NaN))
  if (Number.isNaN(lng) || Number.isNaN(lat)) return null
  return { lng, lat }
}

// 把 AMap LngLat（实例 / {lng,lat} 纯对象 / "lng,lat" 字符串）统一转成 [lng, lat]
function llToArray(ll) {
  if (!ll) return null
  if (typeof ll === 'string') {
    const [lng, lat] = ll.split(',').map(Number)
    if (!Number.isNaN(lng) && !Number.isNaN(lat)) return [lng, lat]
    return null
  }
  const lng = Number(ll.lng != null ? ll.lng : (typeof ll.getLng === 'function' ? ll.getLng() : NaN))
  const lat = Number(ll.lat != null ? ll.lat : (typeof ll.getLat === 'function' ? ll.getLat() : NaN))
  if (Number.isNaN(lng) || Number.isNaN(lat)) return null
  return [lng, lat]
}

// 距离格式化：米 / 公里
function fmtDistance(m) {
  if (m == null) return ''
  const n = Number(m)
  if (Number.isNaN(n)) return ''
  if (n < 1000) return `${Math.round(n)}米`
  return `${(n / 1000).toFixed(1)}公里`
}

// 时长格式化：秒 → 约X分钟 / 约X小时X分
function fmtDuration(sec) {
  if (sec == null) return ''
  const mins = Math.round(Number(sec) / 60)
  if (Number.isNaN(mins) || mins <= 0) return ''
  if (mins < 60) return `约${mins}分钟`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m ? `约${h}小时${m}分` : `约${h}小时`
}

// 步行段文案：🚶 步行 800米 (约12分钟)
function buildWalkingLabel(dist, time) {
  const d = fmtDistance(dist)
  const t = fmtDuration(time)
  if (d && t) return `🚶 步行 ${d} (${t})`
  if (d) return `🚶 步行 ${d}`
  if (t) return `🚶 步行 (${t})`
  return '🚶 步行'
}

// 公交/地铁段文案：🚇 地铁3号线 (佛山大学 → 中山公园)
function buildTransitLineLabel(name, type, fromStop, toStop) {
  const icon = type === 'subway' ? '🚇' : '🚌'
  const clean = (name || '').replace(/\s*\(.*\)\s*$/, '').trim() || '公交/地铁'
  const stops = fromStop && toStop ? ` (${fromStop} → ${toStop})` : ''
  return `${icon} ${clean}${stops}`
}

// 从 AMap.Transfer 结果中提取第一个换乘方案（兼容 route.transits 与 plans 两种结构）
function extractTransitPlan(result) {
  if (!result) return null
  if (result.route && Array.isArray(result.route.transits) && result.route.transits.length > 0) {
    return result.route.transits[0]
  }
  if (Array.isArray(result.plans) && result.plans.length > 0) {
    return result.plans[0]
  }
  return null
}

// 提取换乘方案总耗时（秒），用于解析失败时的兜底文案
function extractTransitDuration(result, plan) {
  if (plan) {
    if (plan.duration != null) return Number(plan.duration)
    if (plan.time != null) return Number(plan.time)
  }
  if (result && result.route && result.route.time != null) return Number(result.route.time)
  return null
}

// 解析 Transfer 单个换乘方案为「全链路分段」：步行段 + 公交/地铁段，逐段拆开
// 真实结构：route.transits[0].segments[]，每段含 walking 和/或 bus；兼容 plans / transit.lines
function parseTransferPlan(transit) {
  const segs = []
  if (!transit || !Array.isArray(transit.segments)) return segs
  for (const seg of transit.segments) {
    if (!seg) continue

    // 步行段：walking.distance + walking.duration（旧结构可能是 walking.time）
    if (seg.walking) {
      const points = []
      const steps = seg.walking.steps || []
      for (const step of steps) {
        if (step && Array.isArray(step.path)) {
          for (const p of step.path) {
            const arr = llToArray(p)
            if (arr) points.push(arr)
          }
        }
      }
      const dur = seg.walking.duration != null ? seg.walking.duration : seg.walking.time
      segs.push({
        type: 'walking',
        points,
        label: buildWalkingLabel(seg.walking.distance, dur),
      })
    }

    // 公交/地铁段：真实结构 bus.buslines；兼容旧结构 transit.lines
    const lines = (seg.bus && seg.bus.buslines) || (seg.transit && seg.transit.lines) || []
    for (const line of lines) {
      if (!line) continue
      const points = []
      const viaStops = line.via_stops || line.stations || []
      if (Array.isArray(viaStops)) {
        for (const st of viaStops) {
          const arr = llToArray(st && st.location)
          if (arr) points.push(arr)
        }
      }
      if (points.length === 0 && Array.isArray(line.path)) {
        for (const p of line.path) {
          const arr = llToArray(p)
          if (arr) points.push(arr)
        }
      }
      // 仍没有坐标：退化为上下车站连线
      if (points.length === 0) {
        const dep = llToArray(line.departure_stop && line.departure_stop.location)
        const arr = llToArray(line.arrival_stop && line.arrival_stop.location)
        if (dep) points.push(dep)
        if (arr) points.push(arr)
      }
      const stations = line.stations || []
      const fromStop = (line.departure_stop && line.departure_stop.name) || (stations[0] && stations[0].name) || ''
      const toStop = (line.arrival_stop && line.arrival_stop.name) || (stations[stations.length - 1] && stations[stations.length - 1].name) || ''
      const type = String(line.type || '').includes('地铁') ? 'subway' : 'bus'
      segs.push({
        type,
        points,
        label: buildTransitLineLabel(line.name, type, fromStop, toStop),
      })
    }
  }
  return segs
}

// 从 Driving 路线中提取坐标路径：拼接每个 step.path
function extractDrivingPath(route) {
  const points = []
  if (!route || !Array.isArray(route.steps)) return points
  for (const step of route.steps) {
    if (step && Array.isArray(step.path)) {
      for (const p of step.path) {
        const arr = llToArray(p)
        if (arr) points.push(arr)
      }
    }
  }
  return points
}

// 交通方式 → 折线颜色（给用户最直观的视觉反馈）
const TRANSIT_MODE_STYLE = {
  transit: { color: '#a78bfa', label: '🚌 公交' }, // 浅紫
  driving: { color: '#60a5fa', label: '🚕 打车' }, // 浅蓝
  walking: { color: '#34d399', label: '🚶 步行' }, // 浅绿
}

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

  const { tripData, activeMode, activeCityId, addCity, addPoi, setActiveCity, fitSignal } = useTripStore()

  // 单城模式下当前聚焦的城市节点
  const activeCityNode = tripData.find(n => n.type === 'city' && n.cityId === activeCityId)

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
  const poiSearchRef = useRef(null)

  // 单城交通路线（公交/地铁 / 打车 / 步行）
  const transferRef = useRef(null)
  const drivingRef = useRef(null)
  const walkingRef = useRef(null)
  const transitPolylineRef = useRef([])
  const transitRequestIdRef = useRef(0)
  const [transitInfo, setTransitInfo] = useState([])
  const [transitMode, setTransitMode] = useState('transit') // transit | driving | walking

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

  // 切换 overview / city_detail 时清空底部搜索框状态，避免两种检索串味
  useEffect(() => {
    setSearchQuery('')
    setSearchResults([])
    setSearching(false)
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
  }, [activeMode, activeCityId])

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

  // 单城模式下的 POI 检索（限在该城市范围内，extensions: 'all' 返回照片）
  const ensurePoiSearch = useCallback((cb) => {
    if (!window.AMap) {
      cb(null)
      return
    }
    if (poiSearchRef.current) {
      cb(poiSearchRef.current)
      return
    }
    window.AMap.plugin('AMap.PlaceSearch', () => {
      poiSearchRef.current = new window.AMap.PlaceSearch({
        pageSize: 10,
        pageIndex: 1,
        extensions: 'all',
        citylimit: true,
      })
      cb(poiSearchRef.current)
    })
  }, [])

  // 公交/地铁路线规划（AMap.Transfer）
  const ensureTransfer = useCallback((cityName, cb) => {
    if (!window.AMap) {
      cb(null)
      return
    }
    if (transferRef.current) {
      try { transferRef.current.setCity(cityName || '') } catch (e) { /* 忽略 */ }
      cb(transferRef.current)
      return
    }
    window.AMap.plugin('AMap.Transfer', () => {
      transferRef.current = new window.AMap.Transfer({
        city: cityName || '',
        extensions: 'all',
        hideMarkers: true,
      })
      cb(transferRef.current)
    })
  }, [])

  // 驾车/打车路线规划（AMap.Driving），作为 Transfer 无结果时的降级
  const ensureDriving = useCallback((cb) => {
    if (!window.AMap) {
      cb(null)
      return
    }
    if (drivingRef.current) {
      cb(drivingRef.current)
      return
    }
    window.AMap.plugin('AMap.Driving', () => {
      drivingRef.current = new window.AMap.Driving({ hideMarkers: true })
      cb(drivingRef.current)
    })
  }, [])

  // 步行路线规划（AMap.Walking）
  const ensureWalking = useCallback((cb) => {
    if (!window.AMap) {
      cb(null)
      return
    }
    if (walkingRef.current) {
      cb(walkingRef.current)
      return
    }
    window.AMap.plugin('AMap.Walking', () => {
      walkingRef.current = new window.AMap.Walking({ hideMarkers: true })
      cb(walkingRef.current)
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

    // 单城模式：搜索该城市范围内的景点（不再调用行政区划检索）
    if (activeMode === 'city_detail' && activeCityNode) {
      searchTimerRef.current = setTimeout(() => {
        ensurePoiSearch((ps) => {
          if (!ps) {
            setSearching(false)
            setSearchResults([])
            return
          }
          try {
            ps.setCity(activeCityNode.cityName || '')
          } catch (err) {
            console.warn('设置 POI 搜索城市失败：', err)
          }
          ps.search(v.trim(), (status, result) => {
            if (status === 'complete' && result.poiList && result.poiList.pois) {
              const list = result.poiList.pois
                .map(p => {
                  const ll = poiLngLat(p)
                  if (!ll) return null
                  return {
                    poiId: p.id,
                    name: p.name,
                    address: p.address || '',
                    photo: p.photos && p.photos.length > 0 ? p.photos[0].url : '',
                    lng: ll.lng,
                    lat: ll.lat,
                  }
                })
                .filter(Boolean)
              setSearchResults(list)
            } else {
              setSearchResults([])
            }
            setSearching(false)
          })
        })
      }, 300)
      return
    }

    // 总览模式：行政区划检索城市
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

  // 单城模式：点击下拉项，把景点坐标与名称写入 tripData 的 pois 数组
  const handleSelectPoi = (poi) => {
    if (!activeCityId) return
    addPoi(activeCityId, {
      poiId: poi.poiId,
      name: poi.name,
      lng: poi.lng,
      lat: poi.lat,
      stayDuration: 60,
      tip: poi.address || '',
    })
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

    // 单城模式：聚焦城市 + 打点已勾选景点（带序号，与右侧列表 index+1 对应）
    if (mode === 'city_detail' && activeCityNode && activeCityNode.lng != null && activeCityNode.lat != null) {
      addMarker(activeCityNode.lng, activeCityNode.lat, PIN_MARKER_HTML, -12, -24, null)
      ;(activeCityNode.pois || []).forEach((poi, idx) => {
        if (poi.lng == null || poi.lat == null) return
        addMarker(poi.lng, poi.lat, poiNumberMarkerHtml(idx + 1), -12, -12, null)
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
        // 底图自带名称的大城市：只留图钉（尾巴尖指向底图城市名），避免文字重叠
        const isMajor = isMajorCity(city.name)
        const html = isMajor ? cityPinOnlyMarkerHtml(num) : cityPinMarkerHtml(num, city.name)
        const offset = isMajor ? [-22, -54] : [-50, -62]
        const m = addMarker(
          city.lng,
          city.lat,
          html,
          offset[0], offset[1],
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
        transitPolylineRef.current = []
        mapReadyRef.current = false
      }
    }
  }, [renderMarkers])

  // 数据变化时刷新标记（renderMarkers 内部会等到地图 complete）
  useEffect(() => {
    renderMarkers()
  }, [allCities, tripData, activeMode, activeCityId, fitSignal, renderMarkers])

  // 单城模式：按当前交通方式（公交/打车/步行）为相邻景点绘制真实路线，并在绘制完成后 fit 全景
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReadyRef.current || !window.AMap) return

    // 清除上一轮路线与提示
    transitPolylineRef.current.forEach((p) => { try { p.setMap(null) } catch (e) { /* 忽略 */ } })
    transitPolylineRef.current = []
    setTransitInfo([])

    if (activeMode !== 'city_detail') return

    const pois = (activeCityNode?.pois || []).filter(p => p.lng != null && p.lat != null)
    if (pois.length < 2) return

    const requestId = ++transitRequestIdRef.current
    const cityName = activeCityNode?.cityName || ''
    const style = TRANSIT_MODE_STYLE[transitMode] || TRANSIT_MODE_STYLE.transit

    const drawLine = (path, weight = 4, opacity = 0.55) => {
      if (requestId !== transitRequestIdRef.current) return
      if (!path || path.length < 2) return
      const polyline = new window.AMap.Polyline({
        path,
        strokeColor: style.color,
        strokeWeight: weight,
        strokeOpacity: opacity,
        strokeStyle: 'solid',
        lineJoin: 'round',
        lineCap: 'round',
      })
      polyline.setMap(map)
      transitPolylineRef.current.push(polyline)
    }

    const setInfo = (i, segments) => {
      if (requestId !== transitRequestIdRef.current) return
      setTransitInfo(prev => {
        const next = [...prev]
        next[i] = { segments }
        return next
      })
    }

    // 全部绘制完成后，fit 整条路线全景（含内边距）
    const fitToRoute = () => {
      if (requestId !== transitRequestIdRef.current) return
      const overlays = [...markersRef.current, ...transitPolylineRef.current]
      if (overlays.length === 0) return
      try {
        map.setFitView(overlays, false, [60, 60, 60, 60])
      } catch (e) {
        console.warn('setFitView 失败：', e)
      }
    }

    const searchBy = (instance, origin, dest) => new Promise((resolve) => {
      instance.search(origin, dest, (status, result) => resolve({ status, result }))
    })

    ;(async () => {
      for (let i = 0; i < pois.length - 1; i++) {
        if (requestId !== transitRequestIdRef.current) return
        const from = pois[i]
        const to = pois[i + 1]
        const origin = [Number(from.lng), Number(from.lat)]
        const dest = [Number(to.lng), Number(to.lat)]

        let path = null
        let label = ''
        let segments = null

        if (transitMode === 'transit') {
          // 公交/地铁：全链路分段展示（步行 + 地铁/公交 + 步行），查不到就提示不强制降级
          const transfer = await new Promise((res) => ensureTransfer(cityName, res))
          if (requestId !== transitRequestIdRef.current) return
          if (transfer) {
            try {
              const { status, result } = await searchBy(transfer, origin, dest)
              console.log('[AMap.Transfer] status=', status, 'result=', result)
              if (requestId !== transitRequestIdRef.current) return

              if (status === 'no_data') {
                // 高德明确返回无公交方案
                segments = [{ type: 'none', label: '暂无公交，建议打车' }]
              } else {
                const plan = extractTransitPlan(result)
                const totalSec = extractTransitDuration(result, plan)
                const fallbackLabel = totalSec
                  ? `🚌 公交/地铁 · 约${Math.max(1, Math.round(totalSec / 60))}分钟`
                  : '🚌 公交/地铁'

                const parsed = plan ? parseTransferPlan(plan) : []
                if (parsed.length > 0) {
                  // 地图：步行细/淡，地铁、公交粗/实
                  for (const s of parsed) {
                    if (s.points && s.points.length >= 2) {
                      drawLine(s.points, s.type === 'walking' ? 2 : 5, s.type === 'walking' ? 0.4 : 0.65)
                    }
                  }
                  segments = parsed.map(s => ({ type: s.type, label: s.label }))
                } else {
                  // 有返回但解析不出明细：退化为简单文案 + 直线兜底，绝不丢数据
                  drawLine([origin, dest])
                  segments = [{ type: 'bus', label: fallbackLabel }]
                }
              }
            } catch (e) {
              console.warn('公交/地铁规划失败：', e)
              drawLine([origin, dest])
              segments = [{ type: 'bus', label: '🚌 公交/地铁' }]
            }
          } else {
            drawLine([origin, dest])
            segments = [{ type: 'bus', label: '🚌 公交/地铁' }]
          }
        } else if (transitMode === 'driving') {
          // 打车
          const driving = await new Promise((res) => ensureDriving(res))
          if (requestId !== transitRequestIdRef.current) return
          if (driving) {
            try {
              const { status, result } = await searchBy(driving, origin, dest)
              if (requestId !== transitRequestIdRef.current) return
              if (status === 'complete' && result && Array.isArray(result.routes) && result.routes.length > 0) {
                path = extractDrivingPath(result.routes[0])
                const mins = result.routes[0].time ? Math.max(1, Math.round(result.routes[0].time / 60)) : null
                label = mins ? `🚕 打车 · 约${mins}分钟` : '🚕 打车'
              }
            } catch (e) {
              console.warn('驾车规划失败：', e)
            }
          }
        } else {
          // 步行
          const walking = await new Promise((res) => ensureWalking(res))
          if (requestId !== transitRequestIdRef.current) return
          if (walking) {
            try {
              const { status, result } = await searchBy(walking, origin, dest)
              if (requestId !== transitRequestIdRef.current) return
              if (status === 'complete' && result && Array.isArray(result.routes) && result.routes.length > 0) {
                path = extractDrivingPath(result.routes[0])
                const mins = result.routes[0].time ? Math.max(1, Math.round(result.routes[0].time / 60)) : null
                label = mins ? `🚶 步行 · 约${mins}分钟` : '🚶 步行'
              }
            } catch (e) {
              console.warn('步行规划失败：', e)
            }
          }
        }

        // 打车/步行：查不到时用直线兜底；公交模式保持“暂无公交”提示，不做兜底
        if (transitMode !== 'transit') {
          if (!path || path.length < 2) {
            path = [origin, dest]
            label = label || (transitMode === 'walking' ? '🚶 步行' : '🚕 打车')
          }
          if (path && path.length >= 2) {
            drawLine(path)
          }
          segments = [{ type: transitMode === 'walking' ? 'walking' : 'driving', label: label || '🚕 打车' }]
        }

        if (segments) {
          setInfo(i, segments)
        }
      }

      // 绘制完成后 fit 整条路线全景
      fitToRoute()
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMode, activeCityNode?.pois, transitMode])

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  // AI 导游返回的 POI（第二步「Agent 操作地图」会据此打点）
  const aiPoisRef = useRef([])
  const handleAiPois = useCallback((pois) => {
    aiPoisRef.current = pois
  }, [])

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
            placeholder={
              activeMode === 'city_detail'
                ? `搜索${activeCityNode?.cityName || '该城市'}的景点...`
                : '搜索城市，添加下一站...'
            }
            className="w-full bg-white/90 backdrop-blur-md rounded-full pl-11 pr-5 py-3 text-sm text-stone-900 placeholder-stone-400 shadow-xl shadow-black/10 border border-white/60 focus:outline-none focus:ring-2 focus:ring-blue-300"
          />

          {/* 下拉匹配列表（向上弹出）：overview 显示城市，city_detail 显示景点 */}
          {searchQuery.trim() && (
            <div className="absolute left-0 right-0 bottom-full mb-3 bg-white border border-stone-200 rounded-2xl shadow-xl overflow-hidden max-h-72 overflow-y-auto">
              {searching ? (
                <p className="px-4 py-3 text-xs text-stone-400 text-center">搜索中…</p>
              ) : searchResults.length === 0 ? (
                <p className="px-4 py-3 text-xs text-stone-400 text-center">
                  {activeMode === 'city_detail' ? '没有匹配的景点' : '没有匹配的城市'}
                </p>
              ) : activeMode === 'city_detail' ? (
                searchResults.map(poi => (
                  <button
                    key={poi.poiId}
                    onClick={() => handleSelectPoi(poi)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-stone-50 transition"
                  >
                    {poi.photo ? (
                      <img
                        src={poi.photo}
                        alt={poi.name}
                        className="w-10 h-10 rounded-lg object-cover shrink-0 bg-stone-100"
                        onError={(e) => { e.currentTarget.style.display = 'none' }}
                      />
                    ) : (
                      <span className="w-10 h-10 rounded-lg bg-stone-100 shrink-0 flex items-center justify-center text-stone-300">📍</span>
                    )}
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm text-stone-700 truncate">{poi.name}</span>
                      {poi.address && <span className="block text-xs text-stone-400 truncate">{poi.address}</span>}
                    </span>
                    <span className="text-xs text-blue-500 shrink-0 ml-2">+ 添加</span>
                  </button>
                ))
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
        <WorkbenchPanel
          transitInfo={transitInfo}
          transitMode={transitMode}
          onTransitModeChange={setTransitMode}
        />
      </div>

      {/* 左下角 AI 悬浮球（跨城总览与单城模式都可见） */}
      <AiChatWidget
        cityName={activeMode === 'city_detail' ? activeCityNode?.cityName || null : null}
        cityId={activeMode === 'city_detail' ? activeCityId || null : null}
        onPois={handleAiPois}
      />
    </div>
  )
}
