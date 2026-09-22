import { useState } from 'react'
import axios from 'axios'

export default function LoginPage({ onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [isRegister, setIsRegister] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const url = isRegister ? '/api/auth/register' : '/api/auth/login'
      const res = await axios.post(url, { username, password })

      localStorage.setItem('token', res.data.token)
      localStorage.setItem('userId', res.data.userId)
      localStorage.setItem('username', res.data.username)
      localStorage.setItem('nickname', res.data.nickname || res.data.username)

      onLogin(res.data)
    } catch (err) {
      setError(err.response?.data?.message || err.message || '操作失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="h-screen w-screen relative overflow-hidden bg-gray-950">
      {/* 背景图：缓慢放大，让城市“活”起来 */}
      <div
        className="absolute inset-0 bg-cover bg-center animate-slow-zoom"
        style={{ backgroundImage: 'url(/login-bg1.jpg)' }}
      />

      {/* 遮罩：左侧轻，右侧重，让卡片落在暗的一侧 */}
      <div className="absolute inset-0 bg-gradient-to-r from-gray-950/20 via-blue-950/60 to-gray-950/95" />
      {/* 底部渐隐，让城市“从底部升起” */}
      <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-blue-950/80 to-transparent" />

      {/* 内容 */}
      <div className="relative h-full flex items-center justify-end px-6 md:px-24">
        <div className="w-full max-w-md">
          {/* 标题 */}
          <div className="mb-10">
            <h1 className="text-6xl font-bold text-white tracking-tight">
              Citywalk
            </h1>
            <p className="text-gray-300 text-sm mt-3 tracking-wide">
              从世界各地出发
            </p>
          </div>

          {/* 卡片 */}
          <div className="bg-gray-950/60 backdrop-blur-2xl rounded-2xl border border-white/10 shadow-2xl p-8">
            {/* Tab */}
            <div className="flex mb-8 border-b border-white/10">
              <button
                onClick={() => { setIsRegister(false); setError('') }}
                className={`flex-1 pb-3 text-sm font-medium transition relative ${
                  !isRegister ? 'text-white' : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                登录
                {!isRegister && (
                 <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-400 rounded-full" />
                )}
              </button>
              <button
                onClick={() => { setIsRegister(true); setError('') }}
                className={`flex-1 pb-3 text-sm font-medium transition relative ${
                  isRegister ? 'text-white' : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                注册
                {isRegister && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-400 rounded-full" />
                )}
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-xs text-gray-400 mb-2 tracking-wide">
                  用户名
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500/60 focus:bg-white/10 transition"
                  placeholder="输入用户名"
                  required
                />
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-2 tracking-wide">
                  密码
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400/60 focus:bg-white/10 transition"
                  placeholder="输入密码"
                  required
                />
              </div>

              {error && (
                <div className="bg-red-900/30 border border-red-700/40 text-red-300 text-sm px-4 py-2 rounded-lg">
                  {error}
                </div>
              )}

            <button
              type="submit"
              disabled={loading}
className="relative w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:from-gray-700 disabled:to-gray-700 text-white font-semibold py-3 rounded-lg transition shadow-lg shadow-blue-600/30 overflow-hidden"            >
              <span className="absolute bottom-0 left-0 right-0 h-px bg-blue-500/40" />
              {loading ? '处理中...' : (isRegister ? '创建账号' : '登录')}
            </button>
            </form>

            <p className="text-center text-xs text-gray-500 mt-6">
              {isRegister ? '注册后自动登录' : '登录后开始规划你的旅行'}
            </p>
          </div>
        </div>
      </div>

      {/* 底部目的地 */}
     <div className="absolute bottom-8 left-0 right-0 flex items-center justify-center gap-2 text-xs tracking-widest">
     <span className="w-1.5 h-1.5 rounded-full bg-cyan-400/80" />
      <span className="text-gray-500">佛山 · 成都 · 西安 · 杭州 · 厦门 · 苏州</span>
    </div>
    </div>
  )
}