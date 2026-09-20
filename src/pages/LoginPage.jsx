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
    <div className="h-screen w-screen relative overflow-hidden">
      {/* 背景图 */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: 'url(/login-bg.jpg)' }}
      />

      {/* 深色遮罩 */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-950/80 via-gray-950/60 to-blue-950/70" />

      {/* 内容 */}
      <div className="relative h-full flex flex-col items-center justify-center px-4">
        <div className="text-center mb-10">
          <h1 className="text-5xl font-bold text-white tracking-wider mb-3">
            Citywalk
          </h1>
          <p className="text-gray-300 text-sm tracking-widest uppercase">
            AI Travel Planner
          </p>
          <p className="text-gray-400 text-xs mt-4 max-w-md">
            用 AI 规划你的城市漫步路线 · 从世界各地出发
          </p>
        </div>

        <div className="w-full max-w-md bg-gray-900/70 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl p-8">
          {/* Tab */}
          <div className="flex mb-8 bg-gray-800/60 rounded-lg p-1">
            <button
              onClick={() => { setIsRegister(false); setError('') }}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition ${
                !isRegister ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-white'
              }`}
            >
              登录
            </button>
            <button
              onClick={() => { setIsRegister(true); setError('') }}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition ${
                isRegister ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-white'
              }`}
            >
              注册
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs text-gray-400 mb-2 tracking-wide">
                用户名
              </label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="w-full bg-gray-800/60 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:bg-gray-800/80 transition"
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
                className="w-full bg-gray-800/60 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:bg-gray-800/80 transition"
                placeholder="输入密码"
                required
              />
            </div>

            {error && (
              <div className="bg-red-900/40 border border-red-700/50 text-red-300 text-sm px-4 py-2 rounded-lg">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 disabled:from-gray-700 disabled:to-gray-700 text-white font-semibold py-3 rounded-lg transition shadow-lg shadow-blue-600/30"
            >
              {loading ? '处理中...' : (isRegister ? '创建账号' : '登录')}
            </button>
          </form>

          <p className="text-center text-xs text-gray-500 mt-6">
            {isRegister ? '注册后自动登录' : '登录后开始规划你的旅行'}
          </p>
        </div>

        <p className="absolute bottom-8 text-xs text-gray-500">
          © 2026 Citywalk · Made with ❤️ for travelers
        </p>
      </div>
    </div>
  )
}