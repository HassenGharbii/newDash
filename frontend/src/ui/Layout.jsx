import React, { useState, useEffect } from 'react'
import { useNavigate, Outlet, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store'
// import AlertSystem from '../components/AlertSystem'  // DÉSACTIVÉ - Alertes supprimées

// Menu complet pour admin et user
const menuFull = [
  { 
    to: '/', 
    label: 'Accueil', 
    icon: (
      <svg style={{width: '20px', height: '20px'}} fill="white" viewBox="0 0 24 24">
        <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
      </svg>
    ), 
    exact: true 
  },
  { 
    to: '/equipements', 
    label: 'Équipements', 
    icon: (
      <svg style={{width: '20px', height: '20px'}} fill="white" viewBox="0 0 24 24">
        <path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-1 9H9V9h10v2zm-4 4H9v-2h6v2zm4-8H9V5h10v2z"/>
      </svg>
    )
  },
  { 
    to: '/stats', 
    label: 'Statistiques', 
    icon: (
      <svg style={{width: '20px', height: '20px'}} fill="white" viewBox="0 0 24 24">
        <path d="M5 9.2h3V19H5zM10.6 5h2.8v14h-2.8zm5.6 8H19v6h-2.8z"/>
      </svg>
    )
  },
  { 
    to: '/bande-passante', 
    label: 'Bande Passante', 
    icon: (
      <svg style={{width: '20px', height: '20px'}} fill="white" viewBox="0 0 24 24">
        <path d="M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z"/>
      </svg>
    )
  },
  {
    to: '/vmware',
    label: 'VMware',
    icon: (
      <svg style={{width: '20px', height: '20px'}} fill="white" viewBox="0 0 24 24">
        <path d="M20 3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H4V5h16v14zM6 7h12v2H6zm0 4h8v2H6z"/>
      </svg>
    )
  },
  {
    to: '/stockage',
    label: 'Stockage',
    icon: (
      <svg style={{width: '20px', height: '20px'}} fill="white" viewBox="0 0 24 24">
        <path d="M12 2C6.48 2 2 3.79 2 6v12c0 2.21 4.48 4 10 4s10-1.79 10-4V6c0-2.21-4.48-4-10-4zm0 2c4.42 0 8 1.34 8 3s-3.58 3-8 3-8-1.34-8-3 3.58-3 8-3zm0 16c-4.42 0-8-1.34-8-3v-2.46C5.71 15.46 8.73 16 12 16s6.29-.54 8-1.46V18c0 1.66-3.58 3-8 3zm0-6c-4.42 0-8-1.34-8-3V8.54C5.71 9.46 8.73 10 12 10s6.29-.54 8-1.46V11c0 1.66-3.58 3-8 3z"/>
      </svg>
    )
  },
  {
    to: '/safekit',
    label: 'PCA / PRA',
    icon: (
      <svg style={{width: '20px', height: '20px'}} fill="white" viewBox="0 0 24 24">
        <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/>
      </svg>
    )
  },
  {
    to: '/paneladmin',
    label: 'Panel Admin',
    icon: (
      <svg style={{width: '20px', height: '20px'}} fill="white" viewBox="0 0 24 24">
        <path d="M12 15.5A3.5 3.5 0 0 1 8.5 12A3.5 3.5 0 0 1 12 8.5a3.5 3.5 0 0 1 3.5 3.5 3.5 3.5 0 0 1-3.5 3.5m7.43-2.53c.04-.32.07-.64.07-.97c0-.33-.03-.66-.07-1l2.11-1.63c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.31-.61-.22l-2.49 1c-.52-.39-1.06-.73-1.69-.98l-.37-2.65A.506.506 0 0 0 14 2h-4c-.25 0-.46.18-.5.42l-.37 2.65c-.63.25-1.17.59-1.69.98l-2.49-1c-.22-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64L4.57 11c-.04.34-.07.67-.07 1c0 .33.03.65.07.97l-2.11 1.66c-.19.15-.25.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1.01c.52.4 1.06.74 1.69.99l.37 2.65c.04.24.25.42.5.42h4c.25 0 .46-.18.5-.42l.37-2.65c.63-.26 1.17-.59 1.69-.99l2.49 1.01c.22.08.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.66Z"/>
      </svg>
    ),
    adminOnly: true
  },
]

// Menu simplifié pour SGM
const menuSGM = [
  { 
    to: '/', 
    label: 'Accueil', 
    icon: (
      <svg style={{width: '20px', height: '20px'}} fill="white" viewBox="0 0 24 24">
        <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
      </svg>
    ), 
    exact: true 
  },
]

export default function AppLayout(){
  const navigate = useNavigate()
  const location = useLocation()
  const { user, clearAuth } = useAuthStore(s => ({ user: s.user, clearAuth: s.clearAuth }))
  const [showUserMenu, setShowUserMenu] = useState(false)

  // Sélectionner le menu en fonction du rôle
  const menu = user?.role === 'SGM' ? menuSGM : menuFull

  const logout = ()=>{
    clearAuth()
    navigate('/login', { replace:true })
  }

  // Fermer le menu quand on clique ailleurs
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.user-menu-container')) {
        setShowUserMenu(false)
      }
    }
    
    if (showUserMenu) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [showUserMenu])

  return (
    <div className="layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <img src="/semmaris.png" alt="Semmaris" onError={e=>{e.currentTarget.style.display='none'}}/>
        </div>
        <nav className="sidebar-nav">
          {menu
            .filter(m => !m.adminOnly || user?.role === 'Admin')
            .map(m=>(
              <div
                key={m.to}
                onClick={() => {
                  console.log('🔗 Navigation vers:', m.to)
                  navigate(m.to)
                }}
                className={`navlink ${location.pathname === m.to ? 'active' : ''}`}
                style={{ cursor: 'pointer' }}
              >
                <span className="mr-2">{m.icon}</span>{m.label}
              </div>
            ))
          }
        </nav>
        
        {/* Logo Axone en bas */}
        <div className="sidebar-bottom-logo">
          <img src="/axone.png" alt="Axone" onError={e=>{e.currentTarget.style.display='none'}}/>
          <div className="copyright-text">
            © 2025 Axone. Tous droits réservés.
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="main">
        <header className="topbar">
          <div className="topbar-title">Semmaris Dashboard</div>
          <div className="topbar-right">
            {/* Menu déroulant utilisateur */}
            <div className="user-menu-container">
              <div 
                className="user-chip clickable"
                onClick={() => setShowUserMenu(!showUserMenu)}
              >
                <span className="dot-online" />
                <span>{user?.name || user?.email || 'Utilisateur'}</span>
                {user?.role ? <span className="role-badge">{user.role}</span> : null}
                <svg 
                  style={{width: '16px', height: '16px', marginLeft: '8px'}} 
                  fill="white" 
                  viewBox="0 0 24 24"
                >
                  <path d="M7 10l5 5 5-5z"/>
                </svg>
              </div>
              
              {showUserMenu && (
                <div className="user-dropdown">
                  <button className="dropdown-item" onClick={logout}>
                    <svg style={{width: '16px', height: '16px'}} fill="currentColor" viewBox="0 0 24 24">
                      <path d="M16 17v-3H9v-4h7V7l5 5-5 5M14 2a2 2 0 012 2v2h-2V4H4v16h10v-2h2v2a2 2 0 01-2 2H4a2 2 0 01-2-2V4a2 2 0 012-2h10z"/>
                    </svg>
                    Déconnexion
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
