// 通用骨架屏：灰块 + 流光。尺寸/圆角通过 className 控制，默认填满父容器。
export default function Skeleton({ className = '' }) {
  return <div className={`skeleton ${className}`} />
}
