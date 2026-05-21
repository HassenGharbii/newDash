import React from 'react'
import { useNavigate, useLocation, Navigate } from 'react-router-dom'
import { useAuthStore } from '../store'

// Icône utilisateur moderne
const UserIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>
)

// Icône cadenas moderne
const LockIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
    <circle cx="12" cy="16" r="1"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
)

// Icône œil pour afficher/masquer le mot de passe
const EyeIcon = ({ isVisible }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {isVisible ? (
      <>
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
        <circle cx="12" cy="12" r="3"/>
      </>
    ) : (
      <>
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
        <line x1="1" y1="1" x2="23" y2="23"/>
      </>
    )}
  </svg>
)

export default function Login() {
  const isAuthed = useAuthStore(s => s.isAuthenticated())
  const setAuth = useAuthStore(s => s.setAuth)
  const navigate = useNavigate()
  const location = useLocation()
  const from = location.state?.from?.pathname || '/'

  const [identifier, setIdentifier] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [error, setError] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [showPassword, setShowPassword] = React.useState(false)

  if (isAuthed) return <Navigate to={from} replace />

  const onSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    
    try {
      const res = await fetch((import.meta.env.VITE_API_URL || 'http://localhost:4000') + '/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password })
      })
      
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Erreur d\'authentification')

      setAuth(data.token, data.user)
      navigate(from, { replace: true })
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="split-login-container">
      {/* Partie gauche - Formulaire de connexion */}
      <div className="login-left-panel">
        <div className="login-form-wrapper">
          {/* Logo Axone centré */}
          <div className="brand-logo">
            <img 
              src="/axone.png" 
              alt="Logo Axone" 
              width="80" 
              height="80"
            />
          </div>

          {/* Titre */}
          <div className="login-header-split">
            <h1 className="login-title-split">Connexion Dashboard</h1>
          </div>

          {/* Formulaire */}
          <form onSubmit={onSubmit} className="split-login-form">
            {/* Champ Identifiant */}
            <div className="split-form-group">
              <label className="split-form-label">Identifiant</label>
              <div className="split-input-wrapper">
                <UserIcon />
                <input
                  className="split-form-input"
                  type="text"
                  value={identifier}
                  onChange={e => setIdentifier(e.target.value)}
                  placeholder="Entrez votre identifiant"
                  required
                  autoComplete="username"
                />
              </div>
            </div>

            {/* Champ Mot de passe */}
            <div className="split-form-group">
              <label className="split-form-label">Mot de passe</label>
              <div className="split-input-wrapper">
                <LockIcon />
                <input
                  className="split-form-input"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Entrez votre mot de passe"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="split-password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  <EyeIcon isVisible={showPassword} />
                </button>
              </div>
            </div>

            {/* Message d'erreur */}
            {error && (
              <div className="split-error-message">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                {error}
              </div>
            )}

            {/* Bouton de connexion */}
            <button 
              type="submit" 
              className="split-login-button"
              disabled={loading || !identifier || !password}
            >
              {loading ? (
                <>
                  <svg className="loading-spinner" width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray="32" strokeDashoffset="32">
                      <animate attributeName="stroke-dasharray" dur="2s" values="0 32;16 16;0 32;0 32" repeatCount="indefinite"/>
                      <animate attributeName="stroke-dashoffset" dur="2s" values="0;-16;-32;-32" repeatCount="indefinite"/>
                    </circle>
                  </svg>
                  Connexion...
                </>
              ) : (
                'Se connecter'
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="split-login-footer">
            <p>© 2025 Semmaris Dashboard. Tous droits réservés.</p>
          </div>
        </div>
      </div>

      {/* Partie droite - Visualisation Dashboard */}
      <div className="login-right-panel">
        <div className="dashboard-preview">
          <div className="preview-content">
            <div className="preview-header">
              <h2>Semmaris Dashboard</h2>
              <p>Systéme de monitoring des équipements de la Semmaris</p>
            </div>
            
            {/* Simulation de graphiques Dashboard */}
            <div className="preview-widgets">
              <div className="preview-widget analytics-widget">
                <div className="widget-header">
                  <h3>Equipements</h3>
                  <div className="widget-tabs">
                    <span className="tab active">Caméras</span>
                    <span className="tab">Serveurs</span>
                    <span className="tab">Switchs</span>
                  </div>
                </div>
                <div className="widget-chart">
                  <svg width="100%" height="120" viewBox="0 0 300 120">
                    <defs>
                      <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="rgba(199,25,25,0.3)"/>
                        <stop offset="100%" stopColor="rgba(199,25,25,0.05)"/>
                      </linearGradient>
                    </defs>
                    <path d="M 0 100 L 50 80 L 100 60 L 150 70 L 200 40 L 250 50 L 300 30" 
                          stroke="rgba(199,25,25,0.8)" 
                          strokeWidth="3" 
                          fill="none"/>
                    <path d="M 0 100 L 50 80 L 100 60 L 150 70 L 200 40 L 250 50 L 300 30 L 300 120 L 0 120 Z" 
                          fill="url(#chartGradient)"/>
                  </svg>
                </div>
              </div>

              <div className="preview-widget status-widget">
                <div className="status-circle">
                  <svg width="80" height="80" viewBox="0 0 80 80">
                    <circle cx="40" cy="40" r="35" stroke="#e5e7eb" strokeWidth="6" fill="none"/>
                    <circle cx="40" cy="40" r="35" stroke="rgba(199,25,25,0.8)" strokeWidth="6" fill="none"
                            strokeDasharray="147" strokeDashoffset="43" strokeLinecap="round"/>
                  </svg>
                  <div className="status-text">
                    <span className="status-value">89%</span>
                    <span className="status-label">Système</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Particules décoratives */}
          <div className="preview-particles">
            <div className="particle particle-1"></div>
            <div className="particle particle-2"></div>
            <div className="particle particle-3"></div>
          </div>
        </div>
      </div>
    </div>
  )
}
