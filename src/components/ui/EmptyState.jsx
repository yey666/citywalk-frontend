// 通用空状态：居中 SVG 图标 + 温柔文案 + 可选操作按钮。
// icon 传内联 SVG 覆盖默认图标；action 传一个 React 节点（通常是按钮）。
export default function EmptyState({
  icon,
  title,
  description,
  action,
  className = '',
}) {
  return (
    <div className={`flex flex-col items-center justify-center text-center px-6 py-10 ${className}`}>
      <div className="w-16 h-16 mb-4 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
        {icon || (
          <svg
            className="w-7 h-7 text-gray-500"
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
        )}
      </div>
      {title && <h3 className="text-sm font-medium text-gray-300 mb-1">{title}</h3>}
      {description && (
        <p className="text-xs text-gray-500 max-w-xs leading-relaxed">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
