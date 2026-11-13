import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

// 行程全局状态：
// tripData: [{ type: 'city', cityId, cityName, lng, lat, coverImage, slogan, description, pois: [] }
//            | { type: 'transport', from, to }]
// activeMode: 'overview'（总览）| 'city_detail'（单城规划）
export const useTripStore = create(
  persist(
    (set) => ({
      tripData: [],
      activeMode: 'overview',
      activeCityId: null,
      fitSignal: 0,
      autoSaveEnabled: true,
      tripRouteId: null, // 整条行程对应的唯一 routeId

      // 追加一座城市（自动去重）
      addCity: (city) =>
        set((state) => {
          if (state.tripData.some((n) => n.type === 'city' && n.cityId === city.id)) {
            return {}
          }
          return {
            tripData: [
              ...state.tripData,
              {
                type: 'city',
                cityId: city.id,
                cityName: city.name,
                region: city.region,
                lng: city.lng,
                lat: city.lat,
                coverImage: city.coverImage,
                slogan: city.slogan,
                description: city.description,
                pois: [],
                transport: {
                  note: '',
                  trainCode: '',
                  fromStation: '',
                  toStation: '',
                  startTime: '',
                  arriveTime: '',
                  travelDate: '',
                  duration: '',
                  price: null,
                },
              },
            ],
          }
        }),

      // 进入某座城市的单城规划
      setActiveCity: (cityId) => set({ activeCityId: cityId, activeMode: 'city_detail' }),

      // 返回行程总览
      backToOverview: () => set({ activeMode: 'overview', activeCityId: null }),

      // 触发左侧地图重新 fit 到全国视野
      requestFit: () => set((s) => ({ fitSignal: s.fitSignal + 1 })),

      // 自动保存开关
      setAutoSaveEnabled: (enabled) => set({ autoSaveEnabled: enabled }),

      // 更新某座城市勾选的景点（pois 数组）
      updateCityPois: (cityId, pois) =>
        set((state) => ({
          tripData: state.tripData.map((n) =>
            n.type === 'city' && n.cityId === cityId ? { ...n, pois } : n
          ),
        })),

      // 更新某座城市入城交通信息（note / 高铁班次等，部分字段合并）
      updateTransport: (cityId, patch) =>
        set((state) => ({
          tripData: state.tripData.map((n) =>
            n.type === 'city' && n.cityId === cityId
              ? { ...n, transport: { ...(n.transport || {}), ...patch } }
              : n
          ),
        })),

      // 回存整条行程保存后得到的 routeId（供后续 UPDATE 使用）
      setTripRouteId: (routeId) => set({ tripRouteId: routeId }),

      removeCity: (cityId) =>
        set((state) => ({
          tripData: state.tripData.filter((n) => !(n.type === 'city' && n.cityId === cityId)),
        })),

      // 拖拽排序：按新的城市顺序重排 tripData（当前 tripData 仅含城市节点）
      reorderCities: (activeId, overId) =>
        set((state) => {
          const cityNodes = state.tripData.filter((n) => n.type === 'city')
          const oldIndex = cityNodes.findIndex((n) => n.cityId === activeId)
          const newIndex = cityNodes.findIndex((n) => n.cityId === overId)
          if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return state
          const reordered = [...cityNodes]
          const [moved] = reordered.splice(oldIndex, 1)
          reordered.splice(newIndex, 0, moved)
          return { tripData: reordered }
        }),

      addTransport: (from, to) =>
        set((state) => ({
          tripData: [...state.tripData, { type: 'transport', from, to }],
        })),

      // 从后端 getDetail 回显整条行程（城市顺序 + 交通备注 + 景点）
      restoreTrip: (tripData, tripRouteId) =>
        set({
          tripData: Array.isArray(tripData) ? tripData : [],
          tripRouteId: tripRouteId ?? null,
          activeMode: 'overview',
          activeCityId: null,
        }),

      resetTrip: () => set({ tripData: [], activeMode: 'overview', activeCityId: null, tripRouteId: null }),
    }),
    {
      name: 'citywalk-trip',
      storage: createJSONStorage(() => localStorage),
    }
  )
)
