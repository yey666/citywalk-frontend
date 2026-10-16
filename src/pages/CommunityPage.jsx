import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import axios from 'axios'

const PAGE_SIZE = 10

function PostCard({ post, onOpen }) {
  return (
    <div
      onClick={onOpen}
      className="rounded-lg overflow-hidden border border-white/10 bg-white/5 hover:border-white/20 transition cursor-pointer"
    >
      {post.images && post.images.length > 0 && (
        <img src={post.images[0]} alt="" className="w-full aspect-[3/4] object-cover" />
      )}
      <div className="p-2">
        <h3 className="font-medium text-sm truncate">{post.title || '无标题'}</h3>
        <div className="flex items-center justify-between text-xs text-gray-500 mt-1">
          <span className="flex items-center gap-1 min-w-0">
            {post.authorAvatar && (
              <img src={post.authorAvatar} alt="" className="w-4 h-4 rounded-full object-cover flex-shrink-0" />
            )}
            <span className="truncate">{post.authorNickname || '匿名'}</span>
          </span>
          <span className={`flex-shrink-0 ${post.liked ? 'text-red-500' : 'text-gray-500'}`}>
            {post.liked ? '♥' : '♡'} {post.likeCount || 0}
          </span>
        </div>
      </div>
    </div>
  )
}

export default function CommunityPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const poiId = searchParams.get('poiId')

  const [posts, setPosts] = useState([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [poiName, setPoiName] = useState('')

  useEffect(() => {
    const params = { page: 1, size: PAGE_SIZE }
    if (poiId) params.poiId = poiId
    axios.get('/api/post/list', { params })
      .then(res => {
        setPosts(res.data.list)
        setHasMore(res.data.hasMore)
        setPage(1)
        const first = res.data.list[0]
        if (poiId && first && first.poiName) setPoiName(first.poiName)
      })
      .catch(err => console.error('加载帖子失败：', err))
      .finally(() => setLoading(false))
  }, [poiId])

  const loadMore = () => {
    setLoading(true)
    const next = page + 1
    const params = { page: next, size: PAGE_SIZE }
    if (poiId) params.poiId = poiId
    axios.get('/api/post/list', { params })
      .then(res => {
        setPosts(prev => [...prev, ...res.data.list])
        setHasMore(res.data.hasMore)
        setPage(next)
      })
      .catch(err => console.error('加载更多失败：', err))
      .finally(() => setLoading(false))
  }

  const leftPosts = posts.filter((_, i) => i % 2 === 0)
  const rightPosts = posts.filter((_, i) => i % 2 === 1)

  return (
    <div className="h-full w-full flex flex-col bg-gray-950 text-white">
      {/* 顶部栏 */}
      <div className="h-14 flex items-center justify-between px-6 border-b border-white/5 flex-shrink-0">
        <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-white text-sm">
          ← 返回
        </button>
        <h1 className="text-lg font-semibold">社区</h1>
        <button
          onClick={() => navigate(poiId ? `/community/new?poiId=${poiId}` : '/community/new')}
          className="px-4 py-1.5 rounded-lg text-sm bg-cyan-500/10 text-cyan-300 border border-cyan-400/30 hover:bg-cyan-500/20 transition"
        >
          + 发帖
        </button>
      </div>

      {/* 筛选提示 */}
      {poiId && (
        <div className="px-6 pt-4 flex items-center gap-2 text-sm">
          <span className="text-gray-400">正在看</span>
          <span className="px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-400/30">
            {poiName || `POI #${poiId}`}
          </span>
          <button onClick={() => navigate('/community')} className="text-gray-500 hover:text-gray-300">
            ✕ 取消筛选
          </button>
        </div>
      )}

      {/* 瀑布流 */}
      <div className="flex-1 overflow-y-auto py-6">
        {posts.length === 0 && !loading && (
          <p className="text-gray-500 text-center py-16">还没有帖子，来发第一帖吧～</p>
        )}

        <div className="max-w-5xl mx-auto flex gap-3 px-4">
          <div className="flex-1 flex flex-col gap-4">
            {leftPosts.map(post => (
              <PostCard key={post.id} post={post} onOpen={() => navigate(`/community/${post.id}`)} />
            ))}
          </div>
          <div className="flex-1 flex flex-col gap-4">
            {rightPosts.map(post => (
              <PostCard key={post.id} post={post} onOpen={() => navigate(`/community/${post.id}`)} />
            ))}
          </div>
        </div>

        {loading && <p className="text-gray-500 text-center py-4">加载中...</p>}

        {hasMore && !loading && (
          <div className="text-center pt-4 pb-2">
            <button
              onClick={loadMore}
              className="px-6 py-2 rounded-lg text-sm bg-white/5 text-gray-300 border border-white/10 hover:bg-white/10 transition"
            >
              加载更多
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
