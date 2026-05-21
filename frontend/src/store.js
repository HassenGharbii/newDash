import { create } from 'zustand'
import axios from 'axios'

const API = import.meta.env.VITE_API_URL || 'http://localhost:4000'

function loadFromStorage() {
  const token = localStorage.getItem('token')
  const userStr = localStorage.getItem('user')
  return {
    token: token || null,
    user: userStr ? JSON.parse(userStr) : null,
  }
}

// Decode JWT pour obtenir l'expiration
function decodeJWT(token) {
  try {
    const base64Url = token.split('.')[1]
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    const jsonPayload = decodeURIComponent(atob(base64).split('').map((c) => {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
    }).join(''))
    return JSON.parse(jsonPayload)
  } catch (e) {
    return null
  }
}

// Variable pour stocker l'intervalle de vérification
let tokenCheckInterval = null

export const useAuthStore = create((set, get) => ({
  ...loadFromStorage(),
  setAuth(token, user) {
    localStorage.setItem('token', token || '')
    localStorage.setItem('user', user ? JSON.stringify(user) : '')
    set({ token, user })
    
    // Démarrer la vérification automatique du token
    if (token) {
      get().startTokenRefresh()
    }
  },
  clearAuth() {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    set({ token: null, user: null })
    
    // Arrêter la vérification
    if (tokenCheckInterval) {
      clearInterval(tokenCheckInterval)
      tokenCheckInterval = null
    }
  },
  isAuthenticated() {
    return !!get().token
  },
  
  // Nouvelle fonction pour vérifier et rafraîchir le token
  async refreshTokenIfNeeded() {
    const { token, user } = get()
    if (!token || !user) return
    
    const decoded = decodeJWT(token)
    if (!decoded || !decoded.exp) return
    
    const now = Date.now() / 1000
    const timeUntilExpiry = decoded.exp - now
    
    // Si le token expire dans moins de 7 jours, on le rafraîchit
    if (timeUntilExpiry < 604800) { // 604800 = 7 jours
      console.log('Token expires in', Math.floor(timeUntilExpiry / 86400), 'days, refreshing...')
      try {
        // Utiliser l'endpoint /auth/refresh avec le token actuel
        const response = await axios.post(`${API}/auth/refresh`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        })
        
        if (response.data.token) {
          get().setAuth(response.data.token, response.data.user)
          console.log('Token refreshed successfully, new expiry:', new Date((decodeJWT(response.data.token).exp) * 1000).toLocaleString())
        }
      } catch (error) {
        console.error('Failed to refresh token:', error)
        // Si le refresh échoue et que le token est expiré, on force la reconnexion
        if (timeUntilExpiry < 0) {
          console.log('Token expired, redirecting to login')
          get().clearAuth()
          window.location.href = '/login'
        }
      }
    } else {
      console.log('Token still valid for', Math.floor(timeUntilExpiry / 86400), 'days')
    }
  },
  
  // Démarrer la vérification périodique du token
  startTokenRefresh() {
    // Vérifier immédiatement
    get().refreshTokenIfNeeded()
    
    // Puis vérifier toutes les heures
    if (tokenCheckInterval) clearInterval(tokenCheckInterval)
    tokenCheckInterval = setInterval(() => {
      get().refreshTokenIfNeeded()
    }, 3600000) // 1 heure
  }
}))

// Démarrer la vérification au chargement si un token existe
const { token } = useAuthStore.getState()
if (token) {
  useAuthStore.getState().startTokenRefresh()
}

export const api = axios.create({ baseURL: API })
api.interceptors.request.use((config) => {
  const { token } = useAuthStore.getState()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Intercepteur de réponse pour gérer les erreurs 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      const { clearAuth } = useAuthStore.getState()
      clearAuth()
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)
