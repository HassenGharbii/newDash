import React from 'react'
import { useNavigate, useLocation, Navigate } from 'react-router-dom'
import { useAuthStore } from '../store'

export default function Login(){
  const isAuthed = useAuthStore(s => s.isAuthenticated())
  const setAuth = useAuthStore(s => s.setAuth)
  const navigate = useNavigate()
  const location = useLocation()
  const from = location.state?.from?.pathname || '/'

  const [identifier,setIdentifier] = React.useState('')
  const [password,setPassword] = React.useState('')
  const [error,setError] = React.useState('')

  if (isAuthed) return <Navigate to={from} replace />

  const onSubmit = async (e)=>{
    e.preventDefault()
    setError('')
    try {
      const res = await fetch((import.meta.env.VITE_API_URL||'http://localhost:4000')+'/auth/login', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ identifier, password })
      })
      const data = await res.json().catch(()=>({}))
      if (!res.ok) throw new Error(data.error||'Erreur d’authentification')

      setAuth(data.token, data.user)
      navigate(from, { replace: true })
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <div className="max-w-sm mx-auto space-y-4">
      <h1 className="text-2xl font-bold">Connexion</h1>
      <form onSubmit={onSubmit} className="grid gap-3">
        <input className="border p-2 rounded" value={identifier} onChange={e=>setIdentifier(e.target.value)} placeholder="Email ou Nom" />
        <input className="border p-2 rounded" value={password} onChange={e=>setPassword(e.target.value)} type="password" placeholder="Mot de passe" />
        <button className="button" type="submit">Se connecter</button>
        {error && <div className="text-red-700">{error}</div>}
      </form>
    </div>
  )
}
