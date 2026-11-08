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

  const inputCls = 'w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition'

  return (
    <div className="h-screen w-screen relative overflow-hidden">
      {/* 背景图：缓慢放大 + 高斯模糊，让背景更柔和 */}
      <div
        className="absolute -inset-4 bg-cover bg-center animate-slow-zoom blur-sm"
        style={{ backgroundImage: 'url(/login-bg1.jpg)' }}
      />
      {/* 轻微暗化，让毛玻璃卡片更突出 */}
      <div className="absolute inset-0 bg-slate-900/40" />

      {/* 居中一体化毛玻璃卡片 */}
      <div className="relative h-full flex items-center justify-center px-6">
        <div className="w-full max-w-2xl h-[420px] bg-slate-900/40 backdrop-blur-2xl border border-white/10 shadow-2xl rounded-3xl overflow-hidden flex">

          {/* 左侧：品牌区 */}
          <div className="w-1/2 flex flex-col justify-end p-12">
            <h1 className="text-5xl font-black text-white tracking-tight">Citywalk</h1>
            <p className="text-slate-300 mt-4 text-sm tracking-wide">从世界各地出发</p>
          </div>

          {/* 右侧：表单区 */}
          <div className="w-1/2 flex flex-col justify-center p-12 gap-6">
            {/* Tab */}
            <div className="flex border-b border-white/10">
              <button
                onClick={() => { setIsRegister(false); setError('') }}
                className={`flex-1 pb-3 text-sm transition relative ${
                  !isRegister ? 'text-white font-semibold' : 'text-slate-400 hover:text-white'
                }`}
              >
                登录
                {!isRegister && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-full" />
                )}
              </button>
              <button
                onClick={() => { setIsRegister(true); setError('') }}
                className={`flex-1 pb-3 text-sm transition relative ${
                  isRegister ? 'text-white font-semibold' : 'text-slate-400 hover:text-white'
                }`}
              >
                注册
                {isRegister && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-full" />
                )}
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <div>
                <label className="block text-xs text-slate-200 mb-2 tracking-wide">
                  用户名
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  className={inputCls}
                  placeholder="输入用户名"
                  required
                />
              </div>

              <div>
                <label className="block text-xs text-slate-200 mb-2 tracking-wide">
                  密码
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className={inputCls}
                  placeholder="输入密码"
                  required
                />
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-sm px-4 py-2 rounded-lg">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-medium transition shadow-lg shadow-blue-500/30 disabled:bg-white/10 disabled:text-slate-500 disabled:cursor-not-allowed"
              >
                {loading ? '处理中...' : (isRegister ? '创建账号' : '登录')}
              </button>
            </form>

            <p className="text-center text-xs text-slate-400">
              {isRegister ? '注册后自动登录' : '登录后开始规划你的旅行'}
            </p>
          </div>
        </div>
      </div>

      {/* 底部目的地 */}
      <div className="absolute bottom-8 left-0 right-0 flex items-center justify-center gap-2 text-xs tracking-widest">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-400/80" />
        <span className="text-slate-400 drop-shadow-md">佛山 · 成都 · 西安 · 杭州 · 厦门 · 苏州</span>
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
