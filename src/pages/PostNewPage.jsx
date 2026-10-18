import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import axios from 'axios'

export default function PostNewPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const prePoiId = searchParams.get('poiId')

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [images, setImages] = useState([])
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [poiKeyword, setPoiKeyword] = useState('')
  const [poiResults, setPoiResults] = useState([])
  const [selectedPoi, setSelectedPoi] = useState(() =>
    prePoiId ? { id: Number(prePoiId), name: '' } : null
  )

  const searchPoi = (kw) => {
    setPoiKeyword(kw)
    if (!kw.trim()) {
      setPoiResults([])
      return
    }
    axios.get('/api/poi/search', { params: { keyword: kw.trim() } })
      .then(res => setPoiResults(res.data))
      .catch(err => console.error('搜索 POI 失败：', err))
  }

  const pickPoi = (poi) => {
    setSelectedPoi(poi)
    setPoiKeyword(poi.name)
    setPoiResults([])
  }

  const onPickFiles = async (e) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    setUploading(true)
    try {
      for (const file of files) {
        const fd = new FormData()
        fd.append('file', file)
        const res = await axios.post('/api/upload', fd)
        setImages(prev => [...prev, res.data.url])
      }
    } catch (err) {
      console.error('上传失败：', err)
      alert('图片上传失败，请重试')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const submit = async () => {
    if (!title.trim() && !content.trim() && images.length === 0) {
      alert('标题、正文、图片至少填一样')
      return
    }
    setSubmitting(true)
    try {
      const res = await axios.post('/api/post', {
        poiId: selectedPoi ? selectedPoi.id : null,
        title: title.trim(),
        content: content.trim(),
        images,
      })
      navigate(`/community/${res.data.id}`)
    } catch (err) {
      console.error('发帖失败：', err)
      alert('发帖失败，请重试')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="h-full w-full flex flex-col text-white">
      <div className="h-14 flex items-center justify-between px-6 border-b border-white/10 bg-gray-900/60 backdrop-blur-xl flex-shrink-0">
        <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-white text-sm">← 返回</button>
        <h1 className="text-lg font-semibold">发帖</h1>
        <button
          onClick={submit}
          disabled={submitting}
          className="px-4 py-1.5 rounded-lg text-sm bg-cyan-500/10 text-cyan-300 border border-cyan-400/30 hover:bg-cyan-500/20 transition disabled:opacity-50"
        >
          {submitting ? '发布中...' : '发布'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto p-8 space-y-6">
          {/* 选图 */}
          <div>
            <label className="text-sm text-gray-500 mb-2 block">图片</label>
            <div className="grid grid-cols-3 gap-3">
              {images.map((url, i) => (
                <div key={i} className="relative aspect-square">
                  <img src={url} alt="" className="w-full h-full object-cover rounded-lg" />
                  <button
                    onClick={() => setImages(prev => prev.filter((_, idx) => idx !== i))}
                    className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white text-xs"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <label className="aspect-square rounded-lg border border-dashed border-white/20 flex flex-col items-center justify-center text-gray-500 hover:border-white/40 cursor-pointer">
                <span className="text-2xl">+</span>
                <span className="text-xs mt-1">{uploading ? '上传中...' : '选图'}</span>
                <input type="file" accept="image/*" multiple hidden onChange={onPickFiles} disabled={uploading} />
              </label>
            </div>
          </div>

          {/* 标题 */}
          <div>
            <label className="text-sm text-gray-500 mb-2 block">标题</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="起个标题..."
              className="w-full px-3 py-2 rounded-lg text-sm bg-white/5 border border-white/10 focus:border-cyan-400/40 outline-none"
            />
          </div>

          {/* 正文 */}
          <div>
            <label className="text-sm text-gray-500 mb-2 block">正文</label>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="分享你的见闻..."
              rows={6}
              className="w-full px-3 py-2 rounded-lg text-sm bg-white/5 border border-white/10 focus:border-cyan-400/40 outline-none resize-none"
            />
          </div>

          {/* 关联 POI */}
          <div>
            <label className="text-sm text-gray-500 mb-2 block">关联 POI（可选）</label>
            {selectedPoi ? (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-cyan-500/10 text-cyan-300 border border-cyan-400/30 text-sm">
                <span>📍 {selectedPoi.name || `POI #${selectedPoi.id}`}</span>
                <button onClick={() => { setSelectedPoi(null); setPoiKeyword('') }} className="ml-auto text-gray-400 hover:text-white">✕</button>
              </div>
            ) : (
              <div className="relative">
                <input
                  value={poiKeyword}
                  onChange={e => searchPoi(e.target.value)}
                  placeholder="搜索景点..."
                  className="w-full px-3 py-2 rounded-lg text-sm bg-white/5 border border-white/10 focus:border-cyan-400/40 outline-none"
                />
                {poiResults.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full rounded-lg border border-white/10 bg-gray-900/90 backdrop-blur-xl overflow-hidden">
                    {poiResults.map(poi => (
                      <button
                        key={poi.id}
                        onClick={() => pickPoi(poi)}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-white/5"
                      >
                        {poi.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
