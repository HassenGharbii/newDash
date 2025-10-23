import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store'
import AppLayout from './ui/Layout'
import Home from './views/Home'
import AdminPanel from './views/AdminPanel'
import Login from './views/Login'
import Cameras from './views/Cameras'
import Switches from './views/Switches'
import PCs from './views/PCs'
import Servers from './views/Servers'

// (temp) pages simples pour debug
const Equipements = () => <div className="p-4">Équipements (debug)</div>
const Stats = () => <div className="p-4">Statistiques (debug)</div>
const SafeKit = () => <div className="p-4">SafeKit / LAN Alert (debug)</div>
const BandePassante = () => <div className="p-4">Bande Passante (debug)</div>
const NotFound = () => <div className="p-4">Page introuvable</div>

function Private({ children }){
  const isAuthed = useAuthStore(s => !!s.token)
  return isAuthed ? children : <Navigate to="/login" replace />
}

export default function App(){
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login/>} />
        <Route path="/" element={<Private><AppLayout/></Private>}>
          <Route index element={<Home/>} />
          <Route path="cameras" element={<Cameras/>} />
          <Route path="switches" element={<Switches/>} />
          <Route path="pcs" element={<PCs/>} />
          <Route path="servers" element={<Servers/>} />
          <Route path="equipements" element={<Equipements/>} />
          <Route path="stats" element={<Stats/>} />
          <Route path="safekit" element={<SafeKit/>} />
          <Route path="bande-passante" element={<BandePassante/>} />
          <Route path="paneladmin" element={<AdminPanel/>} />
          <Route path="*" element={<NotFound/>} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
