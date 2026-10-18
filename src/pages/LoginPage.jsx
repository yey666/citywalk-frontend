import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'

export default function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [isRegister, setIsRegister] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [transition, setTransition] = useState(false)

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

      setLoading(false)
      setTransition(true)
      setTimeout(() => {
        login(res.data)
        navigate('/', { replace: true })
      }, 800)
    } catch (err) {
      setError(err.response?.data?.message || err.message || '操作失败')
      setLoading(false)
    }
  }

  return (
    <div className="h-screen w-screen relative overflow-hidden">
      {/* 背景图：缓慢放大，让城市“活”起来 */}
      <div
        className="absolute inset-0 bg-cover bg-center animate-slow-zoom"
        style={{ backgroundImage: 'url(/login-bg1.jpg)' }}
      />

      {/* 遮罩：左侧轻，右侧重，让卡片落在暗的一侧 */}
      <div className="absolute inset-0 bg-gradient-to-r from-gray-950/20 via-slate-900/60 to-gray-950/95" />
      {/* 底部渐隐，让城市“从底部升起” */}
      <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-slate-900/80 to-transparent" />

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
          <div className="bg-gray-900/60 backdrop-blur-2xl rounded-2xl border border-white/10 shadow-2xl p-8">
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
                  className="input px-4 py-3"
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
                  className="input px-4 py-3"
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
              className="btn btn-primary relative w-full py-3 shadow-lg shadow-cyan-500/20 overflow-hidden disabled:bg-white/10 disabled:text-gray-500 disabled:opacity-100"
            >
              <span className="absolute bottom-0 left-0 right-0 h-px bg-cyan-300/40" />
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

      {/* 登录过渡层 */}
      {transition && (
        <div className="absolute inset-0 z-[60] bg-surface flex items-center justify-center animate-fade-out-800">
          <div className="text-center">
            <p className="text-white/90 text-2xl tracking-[0.3em]">
              世界之大
            </p>
            <p className="text-white/60 text-2xl tracking-[0.3em] mt-3">
              为何我们相遇
            </p>
            <div className="mt-6 mx-auto w-12 h-px bg-cyan-400/60" />
          </div>
        </div>
      )}
    </div>
  )
}
