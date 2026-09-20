export default function Navbar({ onLogout }) {
  const nickname = localStorage.getItem('nickname') || '用户'

  return (
    <nav className="h-14 bg-gray-950 border-b border-gray-800 flex items-center justify-between px-6 flex-shrink-0">
      <div className="text-white font-bold tracking-wide">Citywalk</div>
      <div className="flex items-center gap-6">
        <span className="text-sm text-gray-300">首页</span>
        <span className="text-sm text-gray-500 cursor-not-allowed">社区（开发中）</span>
        <span className="text-sm text-gray-500 cursor-not-allowed">个人中心（开发中）</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-300">{nickname}</span>
        <button
          onClick={onLogout}
          className="text-sm text-gray-400 hover:text-red-400 transition"
        >
          退出
        </button>
      </div>
    </nav>
  )
}