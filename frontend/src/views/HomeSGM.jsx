import React, { useState, useEffect } from 'react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:4000'
const authHeader = () => ({ 'Authorization': `Bearer ${localStorage.getItem('token')||''}` })

const IconCamera = ({size=28}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"
       style={{color:'#fff'}}>
    <rect x="3" y="7" width="13" height="10" rx="2"/>
    <path d="M22 8.5v7l-6-3.5 6-3.5z"/>
  </svg>
)

const IconSwitch = ({size=28}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"
       style={{color:'#fff'}}>
    <circle cx="6" cy="18" r="2"/><circle cx="12" cy="6" r="2"/><circle cx="18" cy="18" r="2"/>
    <path d="M12 8v6M12 12h6M12 12H6"/>
  </svg>
)

export default function HomeSGM() {
  console.log('🟢🟢🟢 COMPONENT HOMESGM.JSX RENDERED (SGM VERSION - 2 CARDS ONLY)')
  const [cameras, setCameras] = useState([])
  const [switches, setSwitches] = useState([])
  const [offlineEquipment, setOfflineEquipment] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 30000) // Refresh toutes les 30s
    return () => clearInterval(interval)
  }, [])

  const loadData = async () => {
    try {
      console.log('🔍 HomeSGM: Chargement des données...')
      console.log('🔍 API URL:', API)
      console.log('🔍 Token:', localStorage.getItem('token') ? 'présent' : 'absent')
      
      const [camerasRes, switchesRes] = await Promise.all([
        fetch(`${API}/equipment?type=Camera`, { headers: authHeader() }),
        fetch(`${API}/equipment?type=Switch`, { headers: authHeader() })
      ])

      console.log('🔍 Cameras response status:', camerasRes.status)
      console.log('🔍 Switches response status:', switchesRes.status)

      const camerasData = await camerasRes.json()
      const switchesData = await switchesRes.json()

      console.log('🔍 Cameras data:', camerasData)
      console.log('🔍 Switches data:', switchesData)

      setCameras(camerasData.equipment || [])
      setSwitches(switchesData.equipment || [])

      // Récupérer tous les équipements hors ligne (caméras + switches)
      const allOffline = [
        ...(camerasData.equipment || []).filter(e => e.ping_status === 'DOWN'),
        ...(switchesData.equipment || []).filter(e => e.ping_status === 'DOWN')
      ].sort((a, b) => a.name.localeCompare(b.name))

      setOfflineEquipment(allOffline)
    } catch (error) {
      console.error('Erreur chargement données:', error)
    } finally {
      setLoading(false)
    }
  }

  const countByStatus = (items) => {
    const up = items.filter(e => e.ping_status === 'UP').length
    const down = items.filter(e => e.ping_status === 'DOWN').length
    const unknown = items.filter(e => e.ping_status === 'UNKNOWN').length
    return { up, down, unknown, total: items.length }
  }

  const camerasStats = countByStatus(cameras)
  const switchesStats = countByStatus(switches)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-400">Chargement...</div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold text-white mb-6">Accueil</h1>

      {/* Cartes de statistiques */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Carte Caméras */}
        <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-xl p-6 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-3 rounded-lg">
                <IconCamera size={32} />
              </div>
              <div>
                <h2 className="text-white text-2xl font-bold">Caméras</h2>
                <p className="text-blue-100 text-sm">Total: {camerasStats.total}</p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white/10 rounded-lg p-3 text-center">
              <div className="text-3xl font-bold text-green-300">{camerasStats.up}</div>
              <div className="text-xs text-blue-100 mt-1">En ligne</div>
            </div>
            <div className="bg-white/10 rounded-lg p-3 text-center">
              <div className="text-3xl font-bold text-red-300">{camerasStats.down}</div>
              <div className="text-xs text-blue-100 mt-1">Hors ligne</div>
            </div>
            <div className="bg-white/10 rounded-lg p-3 text-center">
              <div className="text-3xl font-bold text-gray-300">{camerasStats.unknown}</div>
              <div className="text-xs text-blue-100 mt-1">Inconnu</div>
            </div>
          </div>
        </div>

        {/* Carte Switches */}
        <div className="bg-gradient-to-br from-purple-600 to-purple-800 rounded-xl p-6 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-3 rounded-lg">
                <IconSwitch size={32} />
              </div>
              <div>
                <h2 className="text-white text-2xl font-bold">Switches</h2>
                <p className="text-purple-100 text-sm">Total: {switchesStats.total}</p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white/10 rounded-lg p-3 text-center">
              <div className="text-3xl font-bold text-green-300">{switchesStats.up}</div>
              <div className="text-xs text-purple-100 mt-1">En ligne</div>
            </div>
            <div className="bg-white/10 rounded-lg p-3 text-center">
              <div className="text-3xl font-bold text-red-300">{switchesStats.down}</div>
              <div className="text-xs text-purple-100 mt-1">Hors ligne</div>
            </div>
            <div className="bg-white/10 rounded-lg p-3 text-center">
              <div className="text-3xl font-bold text-gray-300">{switchesStats.unknown}</div>
              <div className="text-xs text-purple-100 mt-1">Inconnu</div>
            </div>
          </div>
        </div>
      </div>

      {/* Liste des équipements hors ligne */}
      <div className="bg-gray-800 rounded-xl shadow-lg">
        <div className="p-6 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <svg className="w-6 h-6 text-red-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/>
            </svg>
            Équipements hors ligne ({offlineEquipment.length})
          </h2>
        </div>
        <div className="p-6">
          {offlineEquipment.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <svg className="w-16 h-16 mx-auto mb-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
              </svg>
              <p className="text-lg">Tous les équipements sont en ligne !</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left py-3 px-4 text-gray-400 font-semibold">Type</th>
                    <th className="text-left py-3 px-4 text-gray-400 font-semibold">Nom</th>
                    <th className="text-left py-3 px-4 text-gray-400 font-semibold">IP</th>
                    <th className="text-left py-3 px-4 text-gray-400 font-semibold">Localisation</th>
                  </tr>
                </thead>
                <tbody>
                  {offlineEquipment.map(eq => (
                    <tr key={eq.id} className="border-b border-gray-700 hover:bg-gray-750">
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${
                          eq.type === 'Camera' 
                            ? 'bg-blue-900/50 text-blue-300' 
                            : 'bg-purple-900/50 text-purple-300'
                        }`}>
                          {eq.type === 'Camera' ? <IconCamera size={14} /> : <IconSwitch size={14} />}
                          {eq.type === 'Camera' ? 'Caméra' : 'Switch'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-white font-medium">{eq.name || '—'}</td>
                      <td className="py-3 px-4 text-gray-300 font-mono text-sm">{eq.ip || '—'}</td>
                      <td className="py-3 px-4 text-gray-400">{eq.location || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
