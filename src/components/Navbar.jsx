export default function Navbar({ onLogout, onGoProfile, onGoHome, currentPage }) {
  const nickname = localStorage.getItem('nickname') || '用户'

  return (
    <nav className="h-14 bg-gray-950 border-b border-gray-800 flex items-center justify-between px-6 flex-shrink-0">
      <div 
        className="text-white font-bold tracking-wide cursor-pointer"
        onClick={onGoHome}
      >
        Citywalk
      </div>
      <div className="flex items-center gap-6">
        <button
          onClick={onGoHome}
          className={`text-sm transition ${
            currentPage === 'home' ? 'text-white' : 'text-gray-400 hover:text-white'
          }`}
        >
          首页
        </button>
        <span className="text-sm text-gray-500 cursor-not-allowed">社区（开发中）</span>
        <button
          onClick={onGoProfile}
          className={`text-sm transition ${
            currentPage === 'profile' ? 'text-white' : 'text-gray-400 hover:text-white'
          }`}
        >
          个人中心
        </button>
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