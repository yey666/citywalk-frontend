import { useState, useRef, useEffect } from 'react'
import { useTripStore } from '../store/tripStore'

// 解析一段 SSE 事件为 JSON 对象（后端返回 { type:'text'|'pois', ... }）
function parseSseBlock(block) {
  if (!block) return null
  const dataParts = []
  for (const line of block.split('\n')) {
    if (line.startsWith('data:')) {
      dataParts.push(line.slice(5).trim())
    }
  }
  const raw = dataParts.join('')
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

// 从完整文本中提取以 {"action 开头的合法 JSON 命令（返回命令对象或 null）
function extractJsonCommand(text) {
  if (!text) return null
  const idx = text.indexOf('{"action')
  if (idx < 0) return null
  let depth = 0
  for (let i = idx; i < text.length; i++) {
    const ch = text[i]
    if (ch === '{') {
      depth++
    } else if (ch === '}') {
      depth--
      if (depth === 0) {
        try {
          return JSON.parse(text.slice(idx, i + 1))
        } catch {
          return null
        }
      }
    }
  }
  return null
}

// 去掉命令部分，只保留正常显示文本
function stripCommand(text) {
  if (!text) return ''
  const idx = text.indexOf('{"action')
  return idx >= 0 ? text.slice(0, idx) : text
}

// 把 AMap LngLat / {lng,lat} / "lng,lat" 统一成 { lng, lat }
function toLngLat(loc) {
  if (!loc) return null
  if (typeof loc === 'string') {
    const [lng, lat] = loc.split(',').map(Number)
    if (!Number.isNaN(lng) && !Number.isNaN(lat)) return { lng, lat }
    return null
  }
  const lng = Number(loc.lng != null ? loc.lng : (typeof loc.getLng === 'function' ? loc.getLng() : NaN))
  const lat = Number(loc.lat != null ? loc.lat : (typeof loc.getLat === 'function' ? loc.getLat() : NaN))
  if (Number.isNaN(lng) || Number.isNaN(lat)) return null
  return { lng, lat }
}

// 高德行政区划查城市（返回 addCity 需要的 city 对象）
function searchCityByAmap(name) {
  return new Promise((resolve) => {
    if (!window.AMap) { resolve(null); return }
    window.AMap.plugin('AMap.DistrictSearch', () => {
      const ds = new window.AMap.DistrictSearch({ subdistrict: 0, extensions: 'base' })
      ds.search(name, (status, result) => {
        if (status === 'complete' && result.districtList && result.districtList.length > 0) {
          const d = result.districtList.find(x => x.center && x.center.lng != null && x.center.lat != null)
          if (d) {
            resolve({ id: d.adcode, name: d.name, region: d.name, lng: d.center.lng, lat: d.center.lat })
            return
          }
        }
        resolve(null)
      })
    })
  })
}

// 高德 PlaceSearch 查景点（限城市范围，返回 addPoi 需要的 poi 对象）
function searchPoiByAmap(name, cityName) {
  return new Promise((resolve) => {
    if (!window.AMap) { resolve(null); return }
    window.AMap.plugin('AMap.PlaceSearch', () => {
      const ps = new window.AMap.PlaceSearch({
        pageSize: 5,
        extensions: 'all',
        ...(cityName ? { city: cityName, citylimit: true } : {}),
      })
      ps.search(name, (status, result) => {
        if (status === 'complete' && result.poiList && result.poiList.pois && result.poiList.pois.length > 0) {
          const p = result.poiList.pois[0]
          const ll = toLngLat(p.location)
          if (ll) {
            resolve({ poiId: p.id, name: p.name, lng: ll.lng, lat: ll.lat, stayDuration: 60, tip: p.address || '' })
            return
          }
        }
        resolve(null)
      })
    })
  })
}

// 执行 AI 下发的命令，返回一条确认文案
async function executeCommand(command) {
  try {
    if (command.action === 'add_cities') {
      const names = Array.isArray(command.cities) ? command.cities : []
      const added = []
      for (const name of names) {
        const city = await searchCityByAmap(String(name).trim())
        if (city) {
          useTripStore.getState().addCity(city)
          added.push(city.name)
        }
      }
      return added.length > 0
        ? `✅ 已为您自动添加城市：${added.join('、')}`
        : '⚠️ 没有解析到可添加的城市'
    }

    if (command.action === 'add_pois') {
      const names = Array.isArray(command.pois) ? command.pois : []
      const state = useTripStore.getState()
      const activeCity = state.tripData.find(n => n.type === 'city' && n.cityId === state.activeCityId)
      if (!activeCity) return '⚠️ 请先进入某个城市，再添加景点'
      const added = []
      for (const name of names) {
        const poi = await searchPoiByAmap(String(name).trim(), activeCity.cityName)
        if (poi) {
          state.addPoi(activeCity.cityId, poi)
          added.push(poi.name)
        }
      }
      return added.length > 0
        ? `✅ 已为您自动添加景点：${added.join('、')}`
        : '⚠️ 没有解析到可添加的景点'
    }
  } catch (e) {
    return `⚠️ 自动添加失败：${e.message}`
  }
  return null
}

// 左下角 AI 悬浮球 + 对话窗（SSE 流式聊天，可下发给地图添加城市/景点）
export default function AiChatWidget({ cityName, cityId, onPois }) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)

  const listRef = useRef(null)
  const historyRef = useRef([]) // 完整对话历史，供后端多轮上下文
  const abortRef = useRef(null)

  // 新消息 / 打开窗口时滚动到底部
  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, streaming, open])

  // 卸载时中断请求
  useEffect(() => () => {
    if (abortRef.current) abortRef.current.abort()
  }, [])

  // 追加一个 assistant 气泡
  const pushAssistant = (content) => {
    setMessages(prev => [...prev, { role: 'assistant', content }])
  }

  // 更新最后一个 assistant 气泡的内容（用于流式）
  const setLastAssistant = (content) => {
    setMessages(prev => {
      const next = [...prev]
      const last = next[next.length - 1]
      if (last && last.role === 'assistant') {
        next[next.length - 1] = { role: 'assistant', content }
      } else {
        next.push({ role: 'assistant', content })
      }
      return next
    })
  }

  const send = async () => {
    const text = input.trim()
    if (!text || streaming) return
    setInput('')

    const history = [...historyRef.current, { role: 'user', content: text }]
    historyRef.current = history
    setMessages(prev => [...prev, { role: 'user', content: text }, { role: 'assistant', content: '' }])
    setStreaming(true)

    const controller = new AbortController()
    abortRef.current = controller
    let assistantText = '' // 含命令的完整文本

    try {
      const token = localStorage.getItem('token') || ''
      const res = await fetch('/api/guide/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          cityId: cityId || null,
          cityName: cityName || null,
          messages: history,
        }),
        signal: controller.signal,
      })

      if (!res.ok || !res.body) throw new Error(`请求失败(${res.status})`)

      const reader = res.body.getReader()
      const decoder = new TextDecoder('utf-8')
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        let idx
        while ((idx = buffer.indexOf('\n\n')) !== -1) {
          const block = buffer.slice(0, idx)
          buffer = buffer.slice(idx + 2)
          const evt = parseSseBlock(block)
          if (!evt) continue
          if (evt.type === 'text' && evt.content) {
            assistantText += evt.content
            setLastAssistant(stripCommand(assistantText)) // 命令部分不显示
          } else if (evt.type === 'pois') {
            onPois?.(Array.isArray(evt.pois) ? evt.pois : [])
          }
        }
      }

      if (buffer.trim()) {
        const evt = parseSseBlock(buffer)
        if (evt && evt.type === 'text' && evt.content) {
          assistantText += evt.content
          setLastAssistant(stripCommand(assistantText))
        }
      }

      // 提取并执行地图操作命令
      const command = extractJsonCommand(assistantText)
      const cleanText = stripCommand(assistantText)

      // 历史里只存干净文本，不存命令
      if (cleanText) {
        historyRef.current = [...historyRef.current, { role: 'assistant', content: cleanText }]
      }

      // 确保最后一个气泡最终显示干净文本
      setLastAssistant(cleanText || '（无回复）')

      if (command) {
        const confirm = await executeCommand(command)
        if (confirm) pushAssistant(confirm)
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        const msg = `[出错了：${err.message}]`
        setLastAssistant(msg)
        historyRef.current = [...historyRef.current, { role: 'assistant', content: msg }]
      }
    } finally {
      setStreaming(false)
      abortRef.current = null
    }
  }

  return (
    <>
      {/* 悬浮球 */}
      <button
        onClick={() => setOpen(o => !o)}
        className="fixed bottom-6 left-6 z-50 w-14 h-14 rounded-full bg-stone-900 text-white shadow-xl shadow-black/20 hover:scale-105 active:scale-95 transition flex items-center justify-center"
        title="AI 导游"
      >
        <span className="text-2xl leading-none">🤖</span>
      </button>

      {/* 对话窗 */}
      {open && (
        <div className="fixed bottom-24 left-6 z-50 w-[360px] max-w-[calc(100vw-3rem)] h-[480px] max-h-[70vh] bg-white/95 backdrop-blur-md border border-white/60 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100 shrink-0">
            <span className="font-bold text-stone-900 text-sm">AI 导游</span>
            <button onClick={() => setOpen(false)} className="text-stone-400 hover:text-stone-700 text-sm">✕</button>
          </div>

          <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.length === 0 && (
              <p className="text-xs text-stone-400 text-center pt-10 leading-relaxed">
                你好，我是你的 Citywalk AI 导游<br />想加城市或景点，直接跟我说～
              </p>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap break-words ${
                    m.role === 'user'
                      ? 'bg-stone-900 text-white rounded-br-md'
                      : 'bg-stone-100 text-stone-800 rounded-bl-md'
                  }`}
                >
                  {m.content || (streaming && m.role === 'assistant' ? '…' : '')}
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 px-3 py-3 border-t border-stone-100 shrink-0">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  send()
                }
              }}
              placeholder="比如：帮我把北京、上海加进行程"
              className="flex-1 bg-stone-100 border border-stone-200 rounded-full px-4 py-2 text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-300"
            />
            <button
              onClick={send}
              disabled={streaming || !input.trim()}
              className="px-4 py-2 rounded-full bg-stone-900 text-white text-sm font-medium hover:bg-black transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {streaming ? '…' : '发送'}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
