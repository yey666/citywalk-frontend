/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useCallback } from 'react'

const PlanContext = createContext(null)

export function PlanProvider({ children }) {
  const [cityId, setCityId] = useState(null)
  const [planStops, setPlanStops] = useState([])
  const [markedIds, setMarkedIds] = useState(() => new Set())

  // 进入某个城市时，从 localStorage 恢复它的草稿（计划 + 已标记）
  const loadCity = useCallback((id) => {
    setCityId(id)
    setPlanStops(JSON.parse(localStorage.getItem(`planDraft:${id}`) || '[]'))
    setMarkedIds(new Set(JSON.parse(localStorage.getItem(`markedIds:${id}`) || '[]')))
  }, [])

  // 计划草稿按城市分键持久化，刷新不丢
  useEffect(() => {
    if (cityId == null) return
    localStorage.setItem(`planDraft:${cityId}`, JSON.stringify(planStops))
  }, [planStops, cityId])

  useEffect(() => {
    if (cityId == null) return
    localStorage.setItem(`markedIds:${cityId}`, JSON.stringify([...markedIds]))
  }, [markedIds, cityId])

  const toggleMark = useCallback((poiId) => {
    setMarkedIds(prev => {
      const next = new Set(prev)
      if (next.has(poiId)) next.delete(poiId)
      else next.add(poiId)
      return next
    })
  }, [])

  const addToPlan = useCallback((poi) => {
    setPlanStops(prev => {
      if (prev.some(s => s.poiId === poi.id)) return prev
      return [...prev, {
        poiId: poi.id,
        name: poi.name,
        lng: poi.lng,
        lat: poi.lat,
        stayDuration: 60,
        tip: poi.description || '',
      }]
    })
  }, [])

  const addStops = useCallback((newStops) => {
    setPlanStops(prev => {
      const existing = new Set(prev.map(s => s.poiId))
      const toAdd = newStops.filter(s => !existing.has(s.poiId))
      return [...prev, ...toAdd]
    })
  }, [])

  const removeFromPlan = useCallback((poiId) => {
    setPlanStops(prev => prev.filter(s => s.poiId !== poiId))
  }, [])

  const clearPlan = useCallback(() => {
    setPlanStops([])
  }, [])

  return (
    <PlanContext.Provider value={{
      cityId,
      planStops,
      markedIds,
      loadCity,
      toggleMark,
      addToPlan,
      addStops,
      removeFromPlan,
      clearPlan,
      setPlanStops,
    }}>
      {children}
    </PlanContext.Provider>
  )
}

export function usePlan() {
  const ctx = useContext(PlanContext)
  if (!ctx) throw new Error('usePlan must be used within PlanProvider')
  return ctx
}
