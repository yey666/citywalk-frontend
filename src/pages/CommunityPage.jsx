import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import axios from 'axios'
import Skeleton from '../components/ui/Skeleton'
import { useAuth } from '../context/AuthContext'

const PAGE_SIZE = 10

function PostCard({ post, onOpen }) {
  return (
    <div
      onClick={onOpen}
      className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-all overflow-hidden border border-stone-100 cursor-pointer"
    >
      {post.images && post.images.length > 0 && (
        <img src={post.images[0]} alt="" className="w-full aspect-[3/4] object-cover" />
      )}
      <div className="p-4">
        <h3 className="text-lg font-bold text-stone-900 truncate">{post.title || '无标题'}</h3>
        <div className="flex items-center justify-between text-sm text-stone-500 mt-2">
          <span className="flex items-center gap-1 min-w-0">
            {post.authorAvatar && (
              <img src={post.authorAvatar} alt="" className="w-4 h-4 rounded-full object-cover flex-shrink-0" />
            )}
            <span className="truncate">{post.authorNickname || '匿名'}</span>
          </span>
          <span className={`flex-shrink-0 ${post.liked ? 'text-red-500' : 'text-stone-400'}`}>
            {post.liked ? '♥' : '♡'} {post.likeCount || 0}
          </span>
        </div>
      </div>
    </div>
  )
}

function PostCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-stone-100 overflow-hidden">
      <Skeleton className="w-full aspect-[3/4] rounded-none bg-stone-200/60" />
      <div className="p-4 space-y-2">
        <Skeleton className="h-4 w-3/4 bg-stone-200/60" />
        <Skeleton className="h-3 w-1/2 bg-stone-200/60" />
      </div>
    </div>
  )
}

function LightEmpty({ title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center text-center px-6 py-16">
      <div className="w-14 h-14 mb-3 rounded-2xl bg-stone-100 border border-stone-200 flex items-center justify-center">
        <svg
          className="w-6 h-6 text-stone-400"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M8 15c1.5 1.5 3.5 1.5 4 1.5s2.5 0 4-1.5" />
          <path d="M9 9h.01M15 9h.01" />
        </svg>
      </div>
      {title && <h3 className="text-sm font-medium text-stone-700 mb-1">{title}</h3>}
      {description && (
        <p className="text-xs text-stone-400 max-w-xs leading-relaxed">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export default function CommunityPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const poiId = searchParams.get('poiId')
  const { logout } = useAuth()
  const nickname = localStorage.getItem('nickname') || '用户'

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

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  const leftPosts = posts.filter((_, i) => i % 2 === 0)
  const rightPosts = posts.filter((_, i) => i % 2 === 1)

  return (
    <div className="h-full w-full flex flex-col bg-stone-50 text-stone-900">
      {/* 顶部：居中悬浮白色毛玻璃胶囊导航 */}
      <nav className="fixed top-4 left-1/2 -translate-x-1/2 w-[95%] max-w-7xl h-14 bg-white/85 backdrop-blur-md rounded-full shadow-sm z-50 flex items-center justify-between px-8">
        <div
          className="font-bold text-stone-900 tracking-wide cursor-pointer"
          onClick={() => navigate('/')}
        >
          Citywalk
        </div>
        <div className="flex items-center gap-6 text-sm">
          <button onClick={() => navigate('/')} className="text-stone-500 hover:text-stone-900 transition">首页</button>
          <button onClick={() => navigate('/community')} className="text-stone-900 transition">社区</button>
          <button onClick={() => navigate('/profile')} className="text-stone-500 hover:text-stone-900 transition">我的</button>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-stone-500">{nickname}</span>
          <button onClick={handleLogout} className="text-stone-400 hover:text-stone-700 transition">退出</button>
        </div>
      </nav>

      {/* 页头 */}
      <div className="max-w-5xl mx-auto w-full px-4 pt-20 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-sm text-stone-500 hover:text-stone-900 transition">
            ← 返回
          </button>
          <h1 className="text-2xl font-bold text-stone-900">社区</h1>
        </div>
        <button
          onClick={() => navigate(poiId ? `/community/new?poiId=${poiId}` : '/community/new')}
          className="px-4 py-1.5 text-sm rounded-full bg-white/70 backdrop-blur-sm border border-stone-200 text-stone-700 font-medium hover:bg-white transition"
        >
          + 发帖
        </button>
      </div>

      {/* 筛选提示 */}
      {poiId && (
        <div className="max-w-5xl mx-auto w-full px-4 pt-2 flex items-center gap-2 text-sm">
          <span className="text-stone-500">正在看</span>
          <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-600 border border-blue-200">
            {poiName || `POI #${poiId}`}
          </span>
          <button onClick={() => navigate('/community')} className="text-stone-400 hover:text-stone-700 transition">
            ✕ 取消筛选
          </button>
        </div>
      )}

      {/* 瀑布流 */}
      <div className="flex-1 overflow-y-auto py-6">
        {posts.length === 0 && !loading && (
          <LightEmpty
            title="还没有帖子"
            description="来发第一帖，记录你的 Citywalk 见闻吧"
            action={
              <button
                onClick={() => navigate(poiId ? `/community/new?poiId=${poiId}` : '/community/new')}
                className="px-4 py-1.5 text-sm rounded-full bg-blue-500 text-white hover:bg-blue-600 transition"
              >
                + 发帖
              </button>
            }
          />
        )}

        {loading && posts.length === 0 && (
          <div className="max-w-5xl mx-auto flex gap-3 px-4">
            <div className="flex-1 flex flex-col gap-4">
              {[0, 1, 2].map(i => <PostCardSkeleton key={i} />)}
            </div>
            <div className="flex-1 flex flex-col gap-4">
              {[3, 4, 5].map(i => <PostCardSkeleton key={i} />)}
            </div>
          </div>
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

        {loading && posts.length > 0 && <p className="text-stone-400 text-center py-4">加载中...</p>}

        {hasMore && !loading && (
          <div className="text-center pt-4 pb-2">
            <button
              onClick={loadMore}
              className="px-6 py-2 text-sm text-stone-600 bg-white border border-stone-200 rounded-full hover:bg-stone-50 transition"
            >
              加载更多
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
