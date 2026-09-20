import { useState, useEffect } from 'react'
import axios from 'axios'
import Navbar from '../components/Navbar'

export default function ProfilePage({ onLogout, onGoHome }) {
  const [activeTab, setActiveTab] = useState('plans')
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState(null)
  const [expandedDetail, setExpandedDetail] = useState(null)

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

  return (
    <div className="h-screen w-screen flex flex-col bg-gray-900 text-white">
          <Navbar
      onLogout={onLogout}
      onGoHome={onGoHome}
      onGoProfile={() => {}}
      currentPage="profile"
    />

      <div className="flex-1 flex overflow-hidden">
        {/* 左侧栏 */}
        <aside className="w-72 bg-gray-950 border-r border-gray-800 flex flex-col flex-shrink-0">
          {/* 用户信息 */}
          <div className="p-6 border-b border-gray-800">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-3xl font-bold text-white mb-4">
              {nickname.charAt(0).toUpperCase()}
            </div>
            <h2 className="text-lg font-semibold text-white">{nickname}</h2>
            <p className="text-xs text-gray-500 mt-1">@{username}</p>
          </div>

          {/* 侧边导航 */}
          <nav className="flex-1 p-3">
            <button
              onClick={() => setActiveTab('plans')}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-lg text-sm transition mb-1 ${
                activeTab === 'plans'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
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
              className={`w-full flex items-center justify-between px-4 py-3 rounded-lg text-sm transition mb-1 ${
                activeTab === 'collections'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
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
              className={`w-full flex items-center justify-between px-4 py-3 rounded-lg text-sm transition ${
                activeTab === 'posts'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
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
          <div className="p-3 border-t border-gray-800">
            <button
              onClick={onLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm text-gray-400 hover:bg-gray-800 hover:text-red-400 transition"
            >
              <span>🚪</span>
              <span>退出登录</span>
            </button>
          </div>
        </aside>

        {/* 右侧内容区 */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto px-8 py-10">
            {/* 我的计划 */}
            {activeTab === 'plans' && (
              <>
                <h1 className="text-2xl font-bold mb-6">我的计划</h1>

                {loading ? (
                  <p className="text-gray-500">加载中...</p>
                ) : plans.length === 0 ? (
                  <div className="text-center py-20 text-gray-500">
                    <p className="text-lg mb-2">还没有保存任何计划</p>
                    <p className="text-sm">去首页规划你的第一条路线吧</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {plans.map(plan => (
                      <div
                        key={plan.id}
                        className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden hover:border-gray-600 transition"
                      >
                        <div className="p-5 flex justify-between items-start">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-white mb-2 truncate">
                              {plan.title}
                            </h3>
                            <div className="flex gap-3 text-xs text-gray-400">
                              {plan.duration && <span>{plan.duration} 小时</span>}
                              {plan.theme && <span>· {plan.theme}</span>}
                              {plan.createdAt && (
                                <span>· {plan.createdAt.split('T')[0]}</span>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-2 ml-4 flex-shrink-0">
                            <button
                              onClick={() => handleExpand(plan.id)}
                              className="px-3 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 rounded transition"
                            >
                              {expandedId === plan.id ? '收起' : '查看'}
                            </button>
                            <button
                              onClick={() => handleDelete(plan.id)}
                              className="px-3 py-1.5 text-xs bg-gray-700 hover:bg-red-600 rounded transition"
                            >
                              删除
                            </button>
                          </div>
                        </div>

                        {/* 展开详情 */}
                        {expandedId === plan.id && expandedDetail && (
                          <div className="border-t border-gray-700 p-5 bg-gray-900/50">
                            {expandedDetail.nodes?.map((node, idx) => (
                              <div key={idx} className="flex gap-3 py-2">
                                <span className="bg-blue-600 text-xs px-2 py-0.5 rounded h-fit mt-0.5 flex-shrink-0">
                                  {node.order}
                                </span>
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm text-white">{node.poiName}</p>
                                  <p className="text-xs text-gray-400 mt-0.5">
                                    {node.stayDuration} 分钟
                                  </p>
                                  {node.tip && (
                                    <p className="text-xs text-gray-500 mt-1">
                                      💡 {node.tip}
                                    </p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {activeTab === 'collections' && (
              <div className="text-center py-20 text-gray-500">
                <p className="text-lg mb-2">收藏功能开发中</p>
                <p className="text-sm">敬请期待</p>
              </div>
            )}

            {activeTab === 'posts' && (
              <div className="text-center py-20 text-gray-500">
                <p className="text-lg mb-2">社区功能开发中</p>
                <p className="text-sm">敬请期待</p>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}