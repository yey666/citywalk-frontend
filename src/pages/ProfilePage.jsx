import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import Skeleton from '../components/ui/Skeleton'
import { useAuth } from '../context/AuthContext'

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

export default function ProfilePage() {
  const navigate = useNavigate()
  const { logout } = useAuth()
  const [activeTab, setActiveTab] = useState('plans')
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState(null)
  const [expandedDetail, setExpandedDetail] = useState(null)
  const [toast, setToast] = useState(null)

  const showToast = (msg, ms = 2000) => {
    setToast(msg)
    setTimeout(() => setToast(null), ms)
  }

  const nickname = localStorage.getItem('nickname') || '用户'
  const username = localStorage.getItem('username') || 'user'

  useEffect(() => {
    axios.get('/api/user/my-plans')
      .then(res => setPlans(res.data))
      .catch(err => console.error('加载计划失败：', err))
      .finally(() => setLoading(false))
  }, [])

  const handleExpand = async (routeId) => {
    if (expandedId === routeId) {
      setExpandedId(null)
      setExpandedDetail(null)
      return
    }
    try {
      const res = await axios.get(`/api/route/${routeId}`)
      setExpandedId(routeId)
      setExpandedDetail(res.data)
    } catch (err) {
      console.error('加载详情失败：', err)
    }
  }

  const handleDelete = async (routeId) => {
    if (!confirm('确定删除这个计划？')) return
    try {
      await axios.delete(`/api/route/${routeId}`)
      setPlans(plans.filter(p => p.id !== routeId))
      if (expandedId === routeId) {
        setExpandedId(null)
        setExpandedDetail(null)
      }
    } catch (err) {
      console.error('删除失败：', err)
      alert('删除失败：' + (err.response?.data?.message || err.message))
    }
  }

  const handleShare = async (planId) => {
    const link = window.location.origin + '/route/' + planId
    try {
      await navigator.clipboard.writeText(link)
    } catch {
      // http 等非安全环境下 navigator.clipboard 不可用，走降级方案
      const ta = document.createElement('textarea')
      ta.value = link
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    showToast('链接已复制')
  }

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

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
          <button onClick={() => navigate('/community')} className="text-stone-500 hover:text-stone-900 transition">社区</button>
          <button onClick={() => navigate('/profile')} className="text-stone-900 transition">我的</button>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-stone-500">{nickname}</span>
          <button onClick={handleLogout} className="text-stone-400 hover:text-stone-700 transition">退出</button>
        </div>
      </nav>

      <div className="flex-1 flex overflow-hidden p-6 pt-20 gap-6">
        {/* 左侧栏：悬浮白卡片 */}
        <aside className="w-72 flex-shrink-0">
          <div className="bg-white rounded-3xl shadow-sm p-6 h-full flex flex-col">
            {/* 用户信息 */}
            <div className="pb-6 mb-6 border-b border-stone-100">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-3xl font-bold text-white mb-4">
                {nickname.charAt(0).toUpperCase()}
              </div>
              <h2 className="text-lg font-semibold text-stone-900">{nickname}</h2>
              <p className="text-xs text-stone-500 mt-1">@{username}</p>
            </div>

            {/* 侧边导航 */}
            <nav className="flex-1 space-y-1">
              <button
                onClick={() => setActiveTab('plans')}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm transition ${
                  activeTab === 'plans'
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-stone-500 hover:bg-stone-50 hover:text-stone-900'
                }`}
              >
                <span className="flex items-center gap-3">
                  <span>📋</span>
                  <span>我的计划</span>
                </span>
                <span className="text-xs">{plans.length}</span>
              </button>

              <button
                onClick={() => setActiveTab('collections')}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm transition ${
                  activeTab === 'collections'
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-stone-500 hover:bg-stone-50 hover:text-stone-900'
                }`}
              >
                <span className="flex items-center gap-3">
                  <span>⭐</span>
                  <span>我的收藏</span>
                </span>
                <span className="text-xs">0</span>
              </button>

              <button
                onClick={() => setActiveTab('posts')}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm transition ${
                  activeTab === 'posts'
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-stone-500 hover:bg-stone-50 hover:text-stone-900'
                }`}
              >
                <span className="flex items-center gap-3">
                  <span>📝</span>
                  <span>我的发布</span>
                </span>
                <span className="text-xs">0</span>
              </button>
            </nav>

            {/* 底部退出 */}
            <div className="pt-4 mt-4 border-t border-stone-100">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-stone-500 hover:bg-stone-50 hover:text-stone-900 transition"
              >
                <span>🚪</span>
                <span>退出登录</span>
              </button>
            </div>
          </div>
        </aside>

        {/* 右侧内容区 */}
        <main className="flex-1 overflow-y-auto">
          <div key={activeTab} className="max-w-4xl mx-auto px-2 py-6 animate-fade-in">
            {/* 我的计划 */}
            {activeTab === 'plans' && (
              <>
                <h1 className="text-2xl font-bold text-stone-900 mb-6">我的计划</h1>

                {loading ? (
                  <div className="space-y-4">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="bg-white rounded-2xl p-5 shadow-sm border border-stone-100">
                        <Skeleton className="h-5 w-1/3 mb-3 bg-stone-200/60" />
                        <Skeleton className="h-3 w-1/2 bg-stone-200/60" />
                      </div>
                    ))}
                  </div>
                ) : plans.length === 0 ? (
                  <LightEmpty
                    title="还没有保存任何计划"
                    description="去首页选个城市，规划你的第一条路线"
                    action={
                      <button
                        onClick={() => navigate('/')}
                        className="px-5 py-2 text-sm rounded-full bg-blue-500 text-white hover:bg-blue-600 transition"
                      >
                        去规划
                      </button>
                    }
                  />
                ) : (
                  <div className="space-y-4">
                    {plans.map(plan => (
                      <div
                        key={plan.id}
                        className="bg-white rounded-2xl p-5 shadow-sm border border-stone-100 overflow-hidden"
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1 min-w-0">
                            <h3
                              className="font-semibold text-stone-900 mb-2 truncate cursor-pointer hover:text-blue-600 transition"
                              onClick={() => navigate(`/route/${plan.id}`)}
                              title="查看路线详情"
                            >
                              {plan.title}
                            </h3>
                            <div className="flex gap-3 text-xs text-stone-500">
                              {plan.duration && <span>{plan.duration} 小时</span>}
                              {plan.theme && <span>· {plan.theme}</span>}
                              {plan.createdAt && (
                                <span>
                                  · {plan.updatedAt && plan.createdAt !== plan.updatedAt
                                    ? `更新于 ${plan.updatedAt.split('T')[0]}`
                                    : plan.createdAt.split('T')[0]}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-2 ml-4 flex-shrink-0">
                            <button
                              onClick={() => window.open('/print/' + plan.id, '_blank')}
                              className="bg-stone-100 hover:bg-stone-200 text-stone-600 text-xs px-3 py-1.5 rounded-md transition-colors"
                            >
                              存到手机
                            </button>
                            <button
                              onClick={() => handleShare(plan.id)}
                              className="bg-stone-100 hover:bg-stone-200 text-stone-600 text-xs px-3 py-1.5 rounded-md transition-colors"
                            >
                              分享
                            </button>
                            <button
                              onClick={() => handleExpand(plan.id)}
                              className="bg-stone-100 hover:bg-stone-200 text-stone-600 text-xs px-3 py-1.5 rounded-md transition-colors"
                            >
                              {expandedId === plan.id ? '收起' : '查看'}
                            </button>
                            <button
                              onClick={() => handleDelete(plan.id)}
                              className="bg-stone-100 hover:bg-red-100 hover:text-red-600 text-stone-600 text-xs px-3 py-1.5 rounded-md transition-colors"
                            >
                              删除
                            </button>
                          </div>
                        </div>

                        {/* 展开详情 */}
                        {expandedId === plan.id && expandedDetail && (
                          <div className="mt-5 -mx-5 -mb-5 border-t border-stone-100 p-5 bg-stone-50">
                            {expandedDetail.nodes?.map((node, idx) => (
                              <div key={idx} className="flex gap-3 py-2">
                                <span className="w-6 h-6 rounded-md bg-blue-50 text-blue-600 border border-blue-200 text-xs font-semibold flex items-center justify-center flex-shrink-0">
                                  {node.order}
                                </span>
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm text-stone-900">{node.poiName}</p>
                                  <p className="text-xs text-stone-500 mt-0.5">
                                    {node.stayDuration} 分钟
                                  </p>
                                  {node.tip && (
                                    <p className="text-xs text-stone-500 mt-1">
                                      💡 {node.tip}
                                    </p>
                                  )}
                                </div>
                              </div>
                            ))}
                            {expandedDetail.tickets?.length > 0 && (
                              <div className="mt-4 pt-4 border-t border-stone-200">
                                <p className="text-xs text-stone-500 mb-2">🚄 已绑定车次</p>
                                {expandedDetail.tickets.map((t, idx) => (
                                  <div key={idx} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-1.5 text-sm">
                                    <span className="text-blue-600">{t.travelDate || '—'}</span>
                                    <span className="text-stone-900 font-medium">{t.trainCode}</span>
                                    <span className="text-stone-500 text-xs">
                                      {t.startTime} → {t.arriveTime}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {activeTab === 'collections' && (
              <LightEmpty
                title="收藏功能开发中"
                description="很快就能在这里看到你收藏的路线了"
              />
            )}

            {activeTab === 'posts' && (
              <LightEmpty
                title="社区功能开发中"
                description="很快就能在这里看到你发布的帖子了"
              />
            )}
          </div>
        </main>
      </div>

      {toast && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 bg-stone-900/90 text-white px-6 py-3 rounded-full shadow-lg z-50">
          {toast}
        </div>
      )}
    </div>
  )
}
