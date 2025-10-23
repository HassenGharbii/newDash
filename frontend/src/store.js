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

export const useAuthStore = create((set, get) => ({
  ...loadFromStorage(),
  setAuth(token, user) {
    localStorage.setItem('token', token || '')
    localStorage.setItem('user', user ? JSON.stringify(user) : '')
    set({ token, user })
  },
  clearAuth() {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    set({ token: null, user: null })
  },
  isAuthenticated() {
    return !!get().token
  },
}))

export const api = axios.create({ baseURL: API })
api.interceptors.request.use((config) => {
  const { token } = useAuthStore.getState()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})
