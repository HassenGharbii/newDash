import React from 'react'
import { NavLink, useNavigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '../store'

// Fonction simple pour vérifier si l'utilisateur est admin
function isUserAdmin() {
  try {
    const token = localStorage.getItem('token')
    if (!token) return false
    const payload = JSON.parse(atob(token.split('.')[1]))
    return payload.role === 'Admin'
  } catch {
    return false
  }
}

/* ==== Icônes maquette (SVG, exactement comme Home.jsx) ==== */
const IconHome = ({size=20}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
    <polyline points="9,22 9,12 15,12 15,22"/>
  </svg>
)

const IconCamera = ({size=20}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="7" width="13" height="10" rx="2"/>
    <path d="M22 8.5v7l-6-3.5 6-3.5z"/>
  </svg>
)

const IconSwitch = ({size=20}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="6" cy="18" r="2"/><circle cx="12" cy="6" r="2"/><circle cx="18" cy="18" r="2"/>
    <path d="M12 8v6M12 12h6M12 12H6"/>
  </svg>
)

const IconPC = ({size=20}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="12" rx="2"/>
    <path d="M8 20h8M12 16v4"/>
  </svg>
)

const IconServer = ({size=20}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="4" width="16" height="6" rx="2"/>
    <rect x="4" y="14" width="16" height="6" rx="2"/>
    <path d="M7 7h.01M10 7h.01M7 17h.01M10 17h.01"/>
  </svg>
)

const IconStats = ({size=20}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22,12 18,12 15,21 9,3 6,12 2,12"/>
  </svg>
)

const IconSafeKit = ({size=20}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    <path d="M9 12l2 2 4-4"/>
  </svg>
)

const IconBandwidth = ({size=20}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
    <polyline points="17 6 23 6 23 12"/>
  </svg>
)

const IconAdmin = ({size=20}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
)

const menu = [
  { to: '/', label: 'Accueil', Icon: IconHome, exact: true },
  { to: '/equipements', label: 'Équipements', Icon: IconSwitch },
  { to: '/stats', label: 'Statistiques', Icon: IconStats },
  { to: '/safekit', label: 'SafeKit / LAN Alert', Icon: IconSafeKit },
  { to: '/bande-passante', label: 'Bande Passante', Icon: IconBandwidth },
  { to: '/paneladmin', label: 'Panel Admin', Icon: IconAdmin },
]

export default function AppLayout(){
  const navigate = useNavigate()
  const { user, clearAuth } = useAuthStore(s => ({ user: s.user, clearAuth: s.clearAuth }))

  const logout = ()=>{
    clearAuth()
    navigate('/login', { replace:true })
  }

  return (
    <div className="layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <img src="/semmaris.png" alt="Semmaris" onError={e=>{e.currentTarget.style.display='none'}}/>
        </div>
        <nav className="sidebar-nav">
          {menu.map(m=>{
            // Masquer Panel Admin si l'utilisateur n'est pas admin
            if (m.to === '/paneladmin' && !isUserAdmin()) {
              return null
            }
            return (
              <NavLink
                key={m.to}
                to={m.to}
                end={!!m.exact}
                className={({isActive})=>`navlink ${isActive?'active':''}`}
              >
                <span className="mr-2"><m.Icon size={20}/></span>{m.label}
              </NavLink>
            )
          })}
        </nav>
      </aside>

      {/* Main */}
      <div className="main">
        <header className="topbar">
          <div className="topbar-title">Semmaris Dashboard</div>
          <div className="topbar-right">
            <div className="user-chip">
              <span className="dot-online" />
              <span>{user?.name || user?.email || 'Utilisateur'}</span>
              {user?.role ? <span className="role-badge">{user.role}</span> : null}
            </div>
            <img src="/axone.png" alt="Axone" className="right-logo" onError={e=>{e.currentTarget.style.display='none'}}/>
            <button className="button ml-3" onClick={logout}>Déconnexion</button>
          </div>
        </header>

        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
