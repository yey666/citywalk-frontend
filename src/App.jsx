import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { PlanProvider } from './context/PlanContext'
import GlobePage from './pages/GlobePage'
import CityDetailPage from './pages/CityDetailPage'
import WorkbenchPage from './pages/WorkbenchPage'
import RouteDetailPage from './pages/RouteDetailPage'
import ProfilePage from './pages/ProfilePage'
import PrintPage from './pages/PrintPage'
import LoginPage from './pages/LoginPage'

function RequireAuth({ children }) {
  const { user } = useAuth()
  if (!user) {
    return <Navigate to="/login" replace />
  }
  return children
}

export default function App() {
  return (
    <AuthProvider>
      <PlanProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<RequireAuth><GlobePage /></RequireAuth>} />
          <Route path="/city/:id" element={<RequireAuth><CityDetailPage /></RequireAuth>} />
          <Route path="/plan/:id" element={<RequireAuth><WorkbenchPage /></RequireAuth>} />
          <Route path="/route/:id" element={<RequireAuth><RouteDetailPage /></RequireAuth>} />
          <Route path="/profile" element={<RequireAuth><ProfilePage /></RequireAuth>} />
          <Route path="/print/:id" element={<PrintPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </PlanProvider>
    </AuthProvider>
  )
}
