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

  const inputCls =
    'w-full bg-white/40 backdrop-blur-md border border-white/60 rounded-full py-4 px-6 text-[15px] text-gray-800 placeholder-[#A39A8A] focus:outline-none focus:bg-white/90 focus:shadow-lg transition'

  return (
    <div className="relative min-h-screen w-full bg-[url('/login_bg_v2.png')] bg-cover bg-center bg-no-repeat flex justify-end items-center pr-[12%] px-6">
      {/* 右侧表单：极简杂志风 */}
      <div className="w-[320px]">
        {/* Logo：手写体 */}
        <h1 className="font-hand text-6xl text-[#3E3A33] -rotate-2 drop-shadow-md leading-none">
          Citywalk
        </h1>

        {/* 主文案：明朝体 */}
        <p className="mt-5 font-serif font-bold text-2xl leading-relaxed text-[#3E3A33]">
          明天在脚下
          <br />
          世界也是。
        </p>

        {/* 点缀文案 */}
        <p className="mt-2 mb-10 text-xs uppercase tracking-widest text-[#8A8478]">
          TASHI DELEK · 扎西德勒
        </p>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={inputCls}
              placeholder="账号 / Email"
              required
            />

            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputCls}
              placeholder="密码 / Password"
              required
            />

            {error && (
              <div className="px-6 text-xs text-red-500/90">{error}</div>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 mt-6 bg-[#2C2C2C] text-[#FDFBF7] text-sm font-medium tracking-widest rounded-full shadow-lg hover:bg-black hover:-translate-y-0.5 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? '处理中...' : isRegister ? '创建账号 →' : '出发 →'}
          </button>
        </form>

        {/* 登录 / 注册切换（保留原逻辑） */}
        <p className="mt-5 text-center text-xs text-[#8A8478]">
          {isRegister ? '已有账号？' : '还没有账号？'}
          <button
            type="button"
            onClick={() => {
              setIsRegister(!isRegister)
              setError('')
            }}
            className="ml-1 text-[#3E3A33] font-medium hover:underline"
          >
            {isRegister ? '去登录' : '去注册'}
          </button>
        </p>
      </div>

      {/* 登录过渡层 */}
      {transition && (
        <div className="absolute inset-0 z-[60] bg-white/90 backdrop-blur flex items-center justify-center animate-fade-out-800">
          <div className="text-center">
            <p className="text-[#3E3A33]/90 text-2xl tracking-[0.3em]">
              世界之大
            </p>
            <p className="text-[#3E3A33]/60 text-2xl tracking-[0.3em] mt-3">
              为何我们相遇
            </p>
            <div className="mt-6 mx-auto w-12 h-px bg-[#3E3A33]/40" />
          </div>
        </div>
      )}
    </div>
  )
}
