import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import axios from 'axios'

function formatTime(s) {
  if (!s) return ''
  const d = new Date(s)
  const now = new Date()
  const diff = (now - d) / 1000
  if (diff < 60) return '刚刚'
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

export default function PostDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [post, setPost] = useState(null)
  const [comments, setComments] = useState([])
  const [imgIndex, setImgIndex] = useState(0)
  const [commentText, setCommentText] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      axios.get(`/api/post/${id}`),
      axios.get(`/api/post/${id}/comments`),
    ]).then(([postRes, commentRes]) => {
      setPost(postRes.data)
      setComments(commentRes.data)
    }).catch(err => console.error('加载帖子失败：', err))
      .finally(() => setLoading(false))
  }, [id])

  const toggleLike = async () => {
    if (!post) return
    const liked = !post.liked
    setPost(prev => ({ ...prev, liked, likeCount: (prev.likeCount || 0) + (liked ? 1 : -1) }))
    try {
      if (liked) await axios.post(`/api/post/${id}/like`)
      else await axios.delete(`/api/post/${id}/like`)
    } catch (err) {
      console.error('点赞失败：', err)
      setPost(prev => ({ ...prev, liked: !liked, likeCount: (prev.likeCount || 0) + (liked ? -1 : 1) }))
    }
  }

  const submitComment = async () => {
    if (!commentText.trim()) return
    try {
      const res = await axios.post(`/api/post/${id}/comment`, { content: commentText.trim() })
      setComments(prev => [...prev, res.data])
      setCommentText('')
    } catch (err) {
      console.error('评论失败：', err)
    }
  }

  if (loading) {
    return <div className="h-full w-full bg-gray-950 text-white flex items-center justify-center text-gray-500">加载中...</div>
  }

  if (!post) {
    return <div className="h-full w-full bg-gray-950 text-white flex items-center justify-center text-gray-500">帖子不存在</div>
  }

  const images = post.images || []

  return (
    <div className="h-full w-full flex flex-col bg-gray-950 text-white">
      <div className="h-14 flex items-center px-6 border-b border-white/5 flex-shrink-0">
        <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-white text-sm">← 返回</button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* 大图 */}
        {images.length > 0 && (
          <div className="relative bg-gray-900 rounded-lg flex justify-center">
            <img
              src={images[imgIndex]}
              alt=""
              className="max-h-[50vh] object-contain"
            />
            {images.length > 1 && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                {images.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setImgIndex(i)}
                    className={`w-2 h-2 rounded-full ${i === imgIndex ? 'bg-cyan-400' : 'bg-white/40'}`}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        <div className="max-w-2xl mx-auto p-8">
          <h1 className="text-2xl font-semibold mb-4">{post.title || '无标题'}</h1>

          <div className="flex items-center gap-3 mb-6 text-sm text-gray-400">
            {post.authorAvatar && <img src={post.authorAvatar} alt="" className="w-8 h-8 rounded-full object-cover" />}
            <span>{post.authorNickname || '匿名'}</span>
            {post.poiName && <span className="text-cyan-300">📍 {post.poiName}</span>}
          </div>

          {post.content && (
            <p className="text-gray-300 leading-relaxed whitespace-pre-wrap mb-8">{post.content}</p>
          )}

          <button
            onClick={toggleLike}
            className={`px-6 py-2 rounded-lg text-sm border transition ${post.liked ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400/40' : 'bg-white/5 text-gray-300 border-white/10 hover:bg-white/10'}`}
          >
            <span className={post.liked ? 'text-red-500' : 'text-gray-500'}>
              {post.liked ? '♥' : '♡'}
            </span>{' '}
            {post.likeCount || 0}
          </button>

          {/* 评论区 */}
          <div className="mt-10 border-t border-white/10 pt-6">
            <h2 className="font-medium mb-4">评论（{comments.length}）</h2>

            <div className="flex gap-2 mb-6">
              <input
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submitComment()}
                placeholder="说点什么..."
                className="flex-1 px-3 py-2 rounded-lg text-sm bg-white/5 border border-white/10 focus:border-cyan-400/40 outline-none"
              />
              <button
                onClick={submitComment}
                className="px-4 py-2 rounded-lg text-sm bg-cyan-500/10 text-cyan-300 border border-cyan-400/30 hover:bg-cyan-500/20 transition"
              >
                发布
              </button>
            </div>

            <div className="space-y-4">
              {comments.length === 0 && <p className="text-gray-500 text-sm">还没有评论</p>}
              {comments.map(c => (
                <div key={c.id} className="flex gap-3">
                  {c.authorAvatar ? (
                    <img src={c.authorAvatar} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-white/10 flex-shrink-0" />
                  )}
                  <div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium">{c.authorNickname || '匿名'}</span>
                      <span className="text-xs text-gray-500">{formatTime(c.createdAt)}</span>
                    </div>
                    <p className="text-sm text-gray-300 mt-1">{c.content}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
