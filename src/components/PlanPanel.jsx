import { useState } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

// 时间轴推算
function computeTimeline(startTime, stops, transitMinutes = 10) {
  const [h, m] = startTime.split(':').map(Number)
  let current = h * 60 + m
  const result = []

  stops.forEach((stop, i) => {
    result.push({ type: 'stop', time: formatTime(current), ...stop })
    current += stop.stayDuration

    if (i < stops.length - 1) {
      result.push({ type: 'transit', time: formatTime(current), duration: transitMinutes })
      current += transitMinutes
    }
  })

  return result
}

function formatTime(minutes) {
  const h = Math.floor(minutes / 60) % 24
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

// 单个可拖拽的节点
function SortableStop({ stop, onRemove, onUpdateDuration }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: stop.poiId })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} className="bg-gray-900 rounded-lg p-3 mb-2 border border-gray-700">
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-2 flex-1">
          {/* 拖拽手柄 */}
          <div {...attributes} {...listeners} className="cursor-grab text-gray-500 hover:text-white">
            ≡
          </div>
          <h4 className="font-semibold text-sm">{stop.name}</h4>
        </div>
        <button onClick={() => onRemove(stop.poiId)} className="text-gray-500 hover:text-red-400 text-xs">
          ✕
        </button>
      </div>
      <div className="flex items-center gap-2 mt-2 ml-6">
        <input
          type="number"
          value={stop.stayDuration}
          onChange={e => onUpdateDuration(stop.poiId, Number(e.target.value))}
          className="bg-gray-700 rounded px-2 py-0.5 text-xs w-16"
        />
        <span className="text-xs text-gray-400">分钟</span>
      </div>
      {stop.tip && <p className="text-xs text-gray-500 mt-1 ml-6">💡 {stop.tip}</p>}
    </div>
  )
}

export default function PlanPanel({ stops, setStops }) {
  const [startTime, setStartTime] = useState('09:00')

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragEnd = (event) => {
    const { active, over } = event
    if (active.id !== over?.id) {
      const oldIndex = stops.findIndex(s => s.poiId === active.id)
      const newIndex = stops.findIndex(s => s.poiId === over.id)
      setStops(arrayMove(stops, oldIndex, newIndex))
    }
  }

  const handleRemove = (poiId) => setStops(stops.filter(s => s.poiId !== poiId))

  const handleUpdateDuration = (poiId, duration) => {
    setStops(stops.map(s => s.poiId === poiId ? { ...s, stayDuration: duration } : s))
  }

  const handleClear = () => {
    if (confirm('确定清空计划？')) setStops([])
  }

  if (stops.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-center text-gray-500 text-sm">
        <div>
          <p>还没有添加景点</p>
          <p className="mt-2 text-xs">从中栏的景点列表点击「+ 加入」</p>
        </div>
      </div>
    )
  }

  const timeline = computeTimeline(startTime, stops)

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-sm text-gray-400">出发时间</span>
        <input
          type="time"
          value={startTime}
          onChange={e => setStartTime(e.target.value)}
          className="bg-gray-700 rounded px-2 py-1 text-sm"
        />
      </div>

      <div className="flex-1 overflow-y-auto pr-2">
        {/* 用 DndContext 包裹 */}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={stops.map(s => s.poiId)} strategy={verticalListSortingStrategy}>
            {timeline.map((item, idx) => {
              if (item.type === 'transit') {
                return (
                  <div key={`t-${idx}`} className="flex items-center gap-2 py-2 pl-3">
                    <div className="w-2 h-2 rounded-full bg-gray-600" />
                    <div className="text-xs text-gray-500">{item.duration} 分钟</div>
                  </div>
                )
              }
              return (
                <div key={item.poiId} className="flex gap-3">
                  <div className="w-14 text-right text-sm text-blue-400 pt-1 flex-shrink-0">{item.time}</div>
                  <div className="flex-1">
                    <SortableStop
                      stop={item}
                      onRemove={handleRemove}
                      onUpdateDuration={handleUpdateDuration}
                    />
                  </div>
                </div>
              )
            })}
          </SortableContext>
        </DndContext>
      </div>

      <div className="pt-4 border-t border-gray-700 flex gap-2">
        <button onClick={handleClear} className="flex-1 bg-gray-700 hover:bg-gray-600 rounded py-2 text-sm">
          清空
        </button>
        <button className="flex-1 bg-blue-600 hover:bg-blue-700 rounded py-2 text-sm font-semibold">
          保存路线
        </button>
      </div>
    </div>
  )
}