import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store'
import AppLayout from './ui/Layout'
import Home from './views/Home'
import SitePlan from './views/SitePlan'
import AdminPanel from './views/AdminPanel'
import Login from './views/Login'

import Cameras from './views/Cameras'
import Switches from './views/Switches'
import PCs from './views/PCs'
import Servers from './views/Servers'
import Bandwidth from './views/Bandwidth'
import Equipment from './views/Equipment'
import Stats from './views/Stats'
import SafeKit from './views/SafeKit'
import VMware from './views/VMware'
import Storage from './views/Storage'

// (temp) pages simples pour debug
const NotFound = () => <div className="p-4">Page introuvable</div>

function Private({ children }){
  const isAuthed = useAuthStore(s => !!s.token)
  const token = useAuthStore(s => s.token)
  console.log('🔐 Private component - isAuthed:', isAuthed, 'token:', token ? 'présent' : 'absent')
  
  if (!isAuthed) {
    console.log('🔐 Redirection vers /login car non authentifié')
    return <Navigate to="/login" replace />
  }
  
  return children
}

export default function App(){
  console.log('🚀 App component rendered - Location:', window.location.pathname)
  
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login/>} />

        <Route path="/" element={<Private><AppLayout/></Private>}>
          <Route index element={<Home/>} />
          <Route path="accueil" element={<Home/>} />
          <Route path="plan" element={<SitePlan/>} />
          <Route path="cameras" element={<Cameras/>} />
          <Route path="switches" element={<Switches/>} />
          <Route path="pcs" element={<PCs/>} />
          <Route path="servers" element={<Servers/>} />
          <Route path="equipements" element={<Equipment/>} />
          <Route path="equipment/:id" element={<Equipment/>} />
          <Route path="stats" element={<Stats/>} />
          <Route path="safekit" element={<SafeKit/>} />
          <Route path="vmware" element={<VMware/>} />
          <Route path="stockage" element={<Storage/>} />
          <Route path="bande-passante" element={<Bandwidth/>} />
          <Route path="paneladmin" element={<AdminPanel/>} />
          <Route path="*" element={<NotFound/>} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
