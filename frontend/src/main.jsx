import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import './styles.css'
import { useAuthStore } from './store'
import Layout from './ui/Layout'
import Home from './views/Home'
import Equipment from './views/Equipment'
import Stats from './views/Stats'
import SafeKit from './views/SafeKit'
import AdminPanel from './views/AdminPanel'
import Login from './views/Login'
// ❌ on supprime l'import de ./App.jsx qui entrait en conflit
// import App from './App.jsx'

function RequireAuth({ children, role }) {
  const isAuthed = useAuthStore(s => s.isAuthenticated())
  const user = useAuthStore(s => s.user)
  const location = useLocation()
  if (!isAuthed) return <Navigate to="/login" state={{ from: location }} replace />
  if (role && user?.role !== role) return <Navigate to="/" replace />
  return children
}

// Redirection automatique vers l'accueil toutes les 10 min
function AutoRedirectWrapper({ children }) {
  const navigate = useNavigate()
  const isAuthed = useAuthStore(s => s.isAuthenticated())
  const location = useLocation()
  React.useEffect(() => {
    const t = setInterval(() => {
      // évite de casser l'écran de login et ne fait rien si pas authentifié
      if (isAuthed && location.pathname !== '/') navigate('/')
    }, 10 * 60 * 1000)
    return () => clearInterval(t)
  }, [navigate, isAuthed, location.pathname])
  return children
}

// Au boot, forcer l’arrivée sur /login si non authentifié
function BootToLogin({ children }) {
  const isAuthed = useAuthStore(s => s.isAuthenticated())
  const location = useLocation()
  const navigate = useNavigate()
  React.useEffect(() => {
    if (!isAuthed && location.pathname !== '/login') {
      navigate('/login', { replace: true })
    }
  }, [isAuthed, location.pathname, navigate])
  return children
}

function App() {
  return (
    <BrowserRouter>
      <AutoRedirectWrapper>
        <BootToLogin>
          <Routes>
            {/* Zone protégée : nécessite d'être connecté */}
            <Route path="/" element={<RequireAuth><Layout/></RequireAuth>}>
              <Route index element={<Home/>} />
              {/* 🔁 routes alignées avec le menu */}
              <Route path="equipements" element={<Equipment/>} />
              <Route path="stats" element={<Stats/>} />
              <Route path="safekitlanalert" element={<SafeKit/>} />
              <Route path="paneladmin" element={<RequireAuth role="Admin"><AdminPanel/></RequireAuth>} />
            </Route>

            {/* Login accessible sans auth */}
            <Route path="/login" element={<Login/>} />

            {/* Toute autre route -> racine (qui renverra vers /login si non auth) */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BootToLogin>
      </AutoRedirectWrapper>
    </BrowserRouter>
  )
}

createRoot(document.getElementById('root')).render(<App/>)
