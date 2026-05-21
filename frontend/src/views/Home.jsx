import React from 'react'
import { useNavigate } from 'react-router-dom'

const API = import.meta.env.VITE_API_URL || 'http://localhost:4000'
const authHeader = () => ({ 'Authorization': `Bearer ${localStorage.getItem('token')||''}` })
/* ==== Icônes maquette (SVG, stroke blanc) ==== */
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

const IconPC = ({size=28}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"
       style={{color:'#fff'}}>
    <rect x="3" y="4" width="18" height="12" rx="2"/>
    <path d="M8 20h8M12 16v4"/>
  </svg>
)

const IconServer = ({size=28}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"
       style={{color:'#fff'}}>
    <rect x="4" y="4" width="16" height="6" rx="2"/>
    <rect x="4" y="14" width="16" height="6" rx="2"/>
    <path d="M7 7h.01M10 7h.01M7 17h.01M10 17h.01"/>
  </svg>
)

const IconHyperviseur = ({size=28}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"
       style={{color:'#fff'}}>
    <rect x="2" y="3" width="20" height="14" rx="2"/>
    <path d="M8 21h8M12 17v4"/>
    <path d="M7 8h10M7 11h6"/>
  </svg>
)

const IconStorage = ({size=28}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"
       style={{color:'#fff'}}>
    <ellipse cx="12" cy="5" rx="9" ry="3"/>
    <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5"/>
    <path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3"/>
  </svg>
)

const TYPES = [
  { key: 'Camera',      label: 'Caméras',      Icon: IconCamera },
  { key: 'Switch',      label: 'Switches',     Icon: IconSwitch },
  { key: 'PC',          label: 'PC',           Icon: IconPC },
  { key: 'Server',      label: 'Serveurs',     Icon: IconServer },
  { key: 'Hyperviseur', label: 'Hyperviseurs', Icon: IconHyperviseur },
  { key: 'Stockage',    label: 'Stockage',     Icon: IconStorage },
]

// Composant de recherche pour SGM (seulement Caméras et Switches)
function SGMSearchBar() {
  const [searchTerm, setSearchTerm] = React.useState('')
  const [filterType, setFilterType] = React.useState('')
  const [results, setResults] = React.useState([])
  const [searching, setSearching] = React.useState(false)

  const handleSearch = async () => {
    if (!searchTerm.trim() && !filterType) {
      setResults([])
      return
    }
    
    setSearching(true)
    try {
      const params = new URLSearchParams()
      if (searchTerm.trim()) params.set('q', searchTerm.trim())
      if (filterType) params.set('type', filterType)
      
      const res = await fetch(`${API}/equipment?${params}`, { headers: authHeader() })
      const data = await res.json()
      // Filtrer uniquement Camera et Switch pour SGM
      const filtered = Array.isArray(data) ? data.filter(eq => eq.type === 'Camera' || eq.type === 'Switch') : []
      setResults(filtered)
    } catch (err) {
      console.error('Erreur recherche:', err)
    } finally {
      setSearching(false)
    }
  }

  React.useEffect(() => {
    const timer = setTimeout(() => {
      handleSearch()
    }, 300)
    return () => clearTimeout(timer)
  }, [searchTerm, filterType])

  return (
    <div className="card panel mt-6">
      <h2 className="text-xl font-bold mb-4" style={{ color: '#1f2937' }}>🔍 Recherche d'équipements</h2>
      
      {/* Barre de recherche */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
        <input
          type="text"
          placeholder="Rechercher par nom, IP, modèle..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            flex: 1,
            padding: '10px 14px',
            border: '1px solid #d1d5db',
            borderRadius: '8px',
            fontSize: '14px'
          }}
        />
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          style={{
            padding: '10px 14px',
            border: '1px solid #d1d5db',
            borderRadius: '8px',
            fontSize: '14px',
            minWidth: '150px'
          }}
        >
          <option value="">Tous les types</option>
          <option value="Camera">Caméras</option>
          <option value="Switch">Switches</option>
        </select>
      </div>

      {/* Résultats */}
      {searching && <div className="text-center text-gray-500 py-4">Recherche...</div>}
      
      {!searching && results.length > 0 && (
        <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
          <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
            <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f9fafb' }}>
              <tr>
                <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Type</th>
                <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Nom</th>
                <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>IP</th>
                <th style={{ padding: '8px', textAlign: 'center', borderBottom: '2px solid #e5e7eb' }}>État</th>
              </tr>
            </thead>
            <tbody>
              {results.map(eq => (
                <tr key={eq.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '8px' }}>
                    <span style={{
                      padding: '2px 8px',
                      backgroundColor: eq.type === 'Camera' ? '#dbeafe' : '#fef3c7',
                      color: eq.type === 'Camera' ? '#1e40af' : '#92400e',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: '600'
                    }}>
                      {eq.type === 'Camera' ? 'Caméra' : 'Switch'}
                    </span>
                  </td>
                  <td style={{ padding: '8px', fontWeight: '500' }}>{eq.name}</td>
                  <td style={{ padding: '8px', fontFamily: 'monospace', color: '#6b7280' }}>{eq.ip}</td>
                  <td style={{ padding: '8px', textAlign: 'center' }}>
                    {eq.ping_status?.toUpperCase() === 'UP' ? (
                      <span style={{ color: '#16a34a', fontWeight: '600' }}>● En ligne</span>
                    ) : (
                      <span style={{ color: '#dc2626', fontWeight: '600' }}>● Hors ligne</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      
      {!searching && searchTerm && results.length === 0 && (
        <div className="text-center text-gray-500 py-4">Aucun résultat trouvé</div>
      )}
    </div>
  )
}

// Composant de liste d'équipements offline intégré dans la carte
function OfflineList({ type }) {
  const [offlineItems, setOfflineItems] = React.useState([])
  const [loading, setLoading] = React.useState(true)
  const [currentPage, setCurrentPage] = React.useState(1)
  const itemsPerPage = 4

  React.useEffect(() => {
    const fetchOffline = async () => {
      try {
        const res = await fetch(`${API}/equipment?type=${type}&status=down`, { headers: authHeader() })
        const data = await res.json()
        setOfflineItems(Array.isArray(data) ? data : [])
      } catch (err) {
        console.error('Erreur chargement offline:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchOffline()
  }, [type])

  if (loading || offlineItems.length === 0) return null

  const totalPages = Math.ceil(offlineItems.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const currentItems = offlineItems.slice(startIndex, startIndex + itemsPerPage)

  return (
    <div style={{ width: '100%', marginTop: '12px' }}>
      {/* Tableau simple sans titre */}
      <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ backgroundColor: '#f3f4f6' }}>
            <th style={{ padding: '4px 6px', textAlign: 'left', fontWeight: '600', borderBottom: '1px solid #e5e7eb' }}>NOM</th>
            <th style={{ padding: '4px 6px', textAlign: 'right', fontWeight: '600', borderBottom: '1px solid #e5e7eb' }}>IP</th>
          </tr>
        </thead>
        <tbody>
          {currentItems.map(eq => (
            <tr key={eq.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
              <td style={{ padding: '5px 6px', fontWeight: '500', color: '#1f2937' }}>{eq.name}</td>
              <td style={{ padding: '5px 6px', fontFamily: 'monospace', color: '#6b7280', textAlign: 'right', fontSize: '10px' }}>{eq.ip}</td>
            </tr>
          ))}
        </tbody>
      </table>
      
      {/* Pagination compacte */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '8px' }}>
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            style={{
              padding: '2px 6px',
              fontSize: '11px',
              border: '1px solid #d1d5db',
              borderRadius: '3px',
              backgroundColor: 'white',
              cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
              opacity: currentPage === 1 ? 0.4 : 1
            }}
          >
            ‹
          </button>
          <span style={{ fontSize: '11px', color: '#6b7280' }}>{currentPage}/{totalPages}</span>
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            style={{
              padding: '2px 6px',
              fontSize: '11px',
              border: '1px solid #d1d5db',
              borderRadius: '3px',
              backgroundColor: 'white',
              cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
              opacity: currentPage === totalPages ? 0.4 : 1
            }}
          >
            ›
          </button>
        </div>
      )}
    </div>
  )
}

function MiniPie({ up=0, down=0, size=120 }) {
  const total = Math.max(0, up + down)
  const radius = size/2
  const cx = radius, cy = radius
  if (total === 0 || (up===0 && down>0)) {
    return <svg width={size} height={size}><circle cx={cx} cy={cy} r={radius} fill="#e53935"/></svg>
  }
  const ratioDown = down/total
  const a = ratioDown * 2*Math.PI
  const largeArc = a > Math.PI ? 1 : 0
  const x = cx + Math.sin(a) * radius
  const y = cy - Math.cos(a) * radius
  return (
    <svg width={size} height={size}>
      <circle cx={cx} cy={cy} r={radius} fill="#2ecc71" />
      {down>0 && (
        <path d={`M ${cx} ${cy - radius} A ${radius} ${radius} 0 ${largeArc} 1 ${x} ${y} L ${cx} ${cy} Z`} fill="#e53935"/>
      )}
    </svg>
  )
}

// Composant pour afficher la bande passante d'un switch spécifique
function SwitchBandwidthCard({ switchName, switchIp }) {
  const [bandwidthData, setBandwidthData] = React.useState([])
  const [bandwidthStats, setBandwidthStats] = React.useState({
    avg_mbps: 0,
    min_mbps: 0,
    max_mbps: 0,
    count: 0
  })
  const [loading, setLoading] = React.useState(true)
  const [switchInfo, setSwitchInfo] = React.useState(null)
  
  // Récupérer l'ID du switch par son nom
  React.useEffect(() => {
    const fetchSwitchInfo = async () => {
      try {
        const res = await fetch(`${API}/equipment?type=Switch`, { headers: authHeader() })
        if (res.ok) {
          const switches = await res.json()
          const found = switches.find(s => s.name === switchName)
          setSwitchInfo(found)
        }
      } catch (err) {
        console.error('Erreur récupération switch:', err)
      }
    }
    fetchSwitchInfo()
  }, [switchName])
  
  // Fonction pour récupérer les données de bande passante du switch
  const fetchBandwidthData = React.useCallback(async () => {
    if (!switchInfo?.id) return
    
    try {
      setLoading(true)
      const [dataRes, statsRes] = await Promise.all([
        fetch(`${API}/bandwidth?equipment_id=${switchInfo.id}&hours=24`, { headers: authHeader() }),
        fetch(`${API}/bandwidth/stats?equipment_id=${switchInfo.id}&hours=24`, { headers: authHeader() })
      ])
      
      if (dataRes.ok && statsRes.ok) {
        const data = await dataRes.json()
        const stats = await statsRes.json()
        
        const transformedData = data.map(item => ({
          time: new Date(item.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
          value: item.value_mbps,
          timestamp: item.timestamp
        }))
        
        setBandwidthData(transformedData)
        setBandwidthStats(stats)
      }
    } catch (err) {
      console.error('Erreur bandwidth:', err)
    } finally {
      setLoading(false)
    }
  }, [switchInfo])
  
  React.useEffect(() => {
    fetchBandwidthData()
    const interval = setInterval(fetchBandwidthData, 60000)
    return () => clearInterval(interval)
  }, [fetchBandwidthData])
  
  if (loading) {
    return (
      <div className="card-body">
        <div className="bandwidth-header">
          <div className="chart-title">
            FED-VIDG3ST2 + SWVID-PI2-STK1-2
          </div>
          <div className="bandwidth-current">
            <span className="bandwidth-status">🔄 Chargement...</span>
          </div>
        </div>
        <div className="bandwidth-empty">
          <p>Chargement des données...</p>
        </div>
      </div>
    )
  }
  
  if (bandwidthData.length === 0) {
    return (
      <div className="card-body">
        <div className="bandwidth-header">
          <div className="chart-title">
            FED-VIDG3ST2 + SWVID-PI2-STK1-2
          </div>
          <div className="bandwidth-current">
            <span className="bandwidth-value">0.0 Mbps</span>
            <span className="bandwidth-status">📊 Aucune donnée</span>
          </div>
        </div>
        <div className="bandwidth-empty">
          <p>📊 Aucune donnée de bande passante disponible pour ce switch</p>
        </div>
      </div>
    )
  }
  
  const maxValue = Math.max(...bandwidthData.map(d => d.value), 50)
  const currentValue = bandwidthData[bandwidthData.length - 1]?.value || 0
  
  return (
    <div className="card-body">
      <div className="bandwidth-header">
        <div className="chart-title">
          FED-VIDG3ST2 + SWVID-PI2-STK1-2
        </div>
        <div className="bandwidth-current">
          <span className="bandwidth-value">{currentValue.toFixed(1)} Mbps</span>
          <span className="bandwidth-status">
            {currentValue > 40 ? '🔴 Élevée' : currentValue > 20 ? '🟡 Moyenne' : '🟢 Faible'}
          </span>
        </div>
      </div>
      
      <div className="bandwidth-chart">
        <svg width="100%" height="200" viewBox="0 0 800 200" preserveAspectRatio="none">
          <defs>
            <pattern id={`grid-${switchName}`} width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(0,0,0,0.05)" strokeWidth="1"/>
            </pattern>
            <linearGradient id={`areaGradient-${switchName}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(239, 68, 68, 0.3)"/>
              <stop offset="100%" stopColor="rgba(239, 68, 68, 0.05)"/>
            </linearGradient>
          </defs>
          
          <rect width="100%" height="100%" fill={`url(#grid-${switchName})`}/>
          
          {bandwidthData.length > 1 && (
            <>
              <path
                d={`M 0 200 ${bandwidthData.map((d, i) => 
                  `L ${(i / (bandwidthData.length - 1)) * 800} ${200 - (d.value / maxValue) * 180}`
                ).join(' ')} L 800 200 Z`}
                fill={`url(#areaGradient-${switchName})`}
              />
              
              <path
                d={`M ${bandwidthData.map((d, i) => 
                  `${(i / (bandwidthData.length - 1)) * 800} ${200 - (d.value / maxValue) * 180}`
                ).join(' L ')}`}
                fill="none"
                stroke="#ef4444"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              
              {bandwidthData.map((d, i) => (
                <circle
                  key={i}
                  cx={(i / (bandwidthData.length - 1)) * 800}
                  cy={200 - (d.value / maxValue) * 180}
                  r="3"
                  fill="#ef4444"
                  className="bandwidth-point"
                >
                  <title>{d.time}: {d.value.toFixed(1)} Mbps</title>
                </circle>
              ))}
            </>
          )}
        </svg>
        
        <div className="bandwidth-labels">
          {bandwidthData.filter((_, i) => i % Math.max(1, Math.floor(bandwidthData.length / 6)) === 0).map((d, i) => (
            <span key={i} className="bandwidth-label">{d.time}</span>
          ))}
        </div>
      </div>
      
      <div className="bandwidth-stats">
        <div className="bandwidth-stat">
          <span className="stat-label">Max 24h:</span>
          <span className="stat-value">{bandwidthStats.max_mbps?.toFixed(1) || '0.0'} Mbps</span>
        </div>
        <div className="bandwidth-stat">
          <span className="stat-label">Moyenne:</span>
          <span className="stat-value">{bandwidthStats.avg_mbps?.toFixed(1) || '0.0'} Mbps</span>
        </div>
        <div className="bandwidth-stat">
          <span className="stat-label">Min 24h:</span>
          <span className="stat-value">{bandwidthStats.min_mbps?.toFixed(1) || '0.0'} Mbps</span>
        </div>
      </div>
    </div>
  )
}

function LineChart(){
  // État pour les données réelles de bande passante
  const [bandwidthData, setBandwidthData] = React.useState([])
  const [bandwidthStats, setBandwidthStats] = React.useState({
    avg_mbps: 0,
    min_mbps: 0,
    max_mbps: 0,
    count: 0
  })
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState(null)
  
  // Fonction pour récupérer les données de bande passante
  const fetchBandwidthData = React.useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      
      // Récupérer les données des 24 dernières heures
      const [dataRes, statsRes] = await Promise.all([
        fetch(`${API}/bandwidth?hours=24`, { headers: authHeader() }),
        fetch(`${API}/bandwidth/stats?hours=24`, { headers: authHeader() })
      ])
      
      if (dataRes.status === 401 || statsRes.status === 401) {
        window.location.assign('/login')
        return
      }
      
      if (!dataRes.ok || !statsRes.ok) {
        throw new Error('Erreur lors de la récupération des données')
      }
      
      const data = await dataRes.json()
      const stats = await statsRes.json()
      
      // Transformer les données pour le graphique
      const transformedData = data.map(item => ({
        time: new Date(item.timestamp).toLocaleTimeString('fr-FR', { 
          hour: '2-digit', 
          minute: '2-digit' 
        }),
        value: item.value_mbps,
        timestamp: item.timestamp,
        hour: new Date(item.timestamp).getHours()
      }))
      
      setBandwidthData(transformedData)
      setBandwidthStats(stats)
      
    } catch (err) {
      console.error('Erreur bandwidth:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])
  
  React.useEffect(() => {
    fetchBandwidthData()
    
    // Mise à jour toutes les 2 minutes pour les vraies données
    const interval = setInterval(fetchBandwidthData, 2 * 60 * 1000)
    
    return () => clearInterval(interval)
  }, [fetchBandwidthData])
  
  // Si pas de données, afficher un message
  if (loading) {
    return (
      <div className="card-body">
        <div className="bandwidth-header">
          <div className="chart-title">Bande passante</div>
          <div className="bandwidth-current">
            <span className="bandwidth-value">...</span>
            <span className="bandwidth-status">🔄 Chargement...</span>
          </div>
        </div>
        <div className="bandwidth-loading">
          <p>Chargement des données de bande passante...</p>
        </div>
      </div>
    )
  }
  
  if (error) {
    return (
      <div className="card-body">
        <div className="bandwidth-header">
          <div className="chart-title">Bande passante</div>
          <div className="bandwidth-current">
            <span className="bandwidth-value">--</span>
            <span className="bandwidth-status">❌ Erreur</span>
          </div>
        </div>
        <div className="bandwidth-error">
          <p>❌ {error}</p>
          <button onClick={fetchBandwidthData} className="retry-button">
            🔄 Réessayer
          </button>
        </div>
      </div>
    )
  }
  
  if (bandwidthData.length === 0) {
    return (
      <div className="card-body">
        <div className="bandwidth-header">
          <div className="chart-title">Bande passante</div>
          <div className="bandwidth-current">
            <span className="bandwidth-value">0.0 Mbps</span>
            <span className="bandwidth-status">📊 Aucune donnée</span>
          </div>
        </div>
        <div className="bandwidth-empty">
          <p>📊 Aucune donnée de bande passante disponible</p>
          <p className="empty-hint">
            💡 Pour ajouter des données, utilisez l'API: 
            <code>POST /bandwidth/ingest</code>
          </p>
        </div>
      </div>
    )
  }
  
  const maxValue = Math.max(...bandwidthData.map(d => d.value), 50)
  const currentValue = bandwidthData[bandwidthData.length - 1]?.value || 0
  
  return (
    <div className="card-body">
      <div className="bandwidth-header">
        <div className="chart-title">Bande passante</div>
        <div className="bandwidth-current">
          <span className="bandwidth-value">{currentValue.toFixed(1)} Mbps</span>
          <span className="bandwidth-status">
            {currentValue > 40 ? '🔴 Élevée' : currentValue > 20 ? '🟡 Moyenne' : '🟢 Faible'}
          </span>
        </div>
      </div>
      
      <div className="bandwidth-chart">
        <svg width="100%" height="200" viewBox="0 0 800 200" preserveAspectRatio="none">
          {/* Grille */}
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(0,0,0,0.05)" strokeWidth="1"/>
            </pattern>
            <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(239, 68, 68, 0.3)"/>
              <stop offset="100%" stopColor="rgba(239, 68, 68, 0.05)"/>
            </linearGradient>
          </defs>
          
          <rect width="100%" height="100%" fill="url(#grid)"/>
          
          {/* Ligne de bande passante */}
          {bandwidthData.length > 1 && (
            <>
              {/* Zone sous la courbe */}
              <path
                d={`M 0 200 ${bandwidthData.map((d, i) => 
                  `L ${(i / (bandwidthData.length - 1)) * 800} ${200 - (d.value / maxValue) * 180}`
                ).join(' ')} L 800 200 Z`}
                fill="url(#areaGradient)"
              />
              
              {/* Ligne principale */}
              <path
                d={`M ${bandwidthData.map((d, i) => 
                  `${(i / (bandwidthData.length - 1)) * 800} ${200 - (d.value / maxValue) * 180}`
                ).join(' L ')}`}
                fill="none"
                stroke="#ef4444"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              
              {/* Points sur la courbe */}
              {bandwidthData.map((d, i) => (
                <circle
                  key={i}
                  cx={(i / (bandwidthData.length - 1)) * 800}
                  cy={200 - (d.value / maxValue) * 180}
                  r="3"
                  fill="#ef4444"
                  className="bandwidth-point"
                >
                  <title>{d.time}: {d.value.toFixed(1)} Mbps</title>
                </circle>
              ))}
            </>
          )}
        </svg>
        
        {/* Légendes des heures */}
        <div className="bandwidth-labels">
          {bandwidthData.filter((_, i) => i % Math.max(1, Math.floor(bandwidthData.length / 6)) === 0).map((d, i) => (
            <span key={i} className="bandwidth-label">{d.time}</span>
          ))}
        </div>
      </div>
      
      {/* Statistiques réelles */}
      <div className="bandwidth-stats">
        <div className="bandwidth-stat">
          <span className="stat-label">Max 24h:</span>
          <span className="stat-value">{bandwidthStats.max_mbps?.toFixed(1) || '0.0'} Mbps</span>
        </div>
        <div className="bandwidth-stat">
          <span className="stat-label">Moyenne:</span>
          <span className="stat-value">{bandwidthStats.avg_mbps?.toFixed(1) || '0.0'} Mbps</span>
        </div>
        <div className="bandwidth-stat">
          <span className="stat-label">Min 24h:</span>
          <span className="stat-value">{bandwidthStats.min_mbps?.toFixed(1) || '0.0'} Mbps</span>
        </div>
      </div>
      
      {/* Indicateur de mise à jour */}
      <div className="bandwidth-footer">
        <span className="update-info">
          📊 {bandwidthStats.count || 0} mesures • 
          Dernière MAJ: {bandwidthData.length > 0 ? 
            new Date(bandwidthData[bandwidthData.length - 1].timestamp).toLocaleString('fr-FR') : 
            'N/A'}
        </span>
      </div>
    </div>
  )
}

export default function Home(){
  console.log('🏠🏠🏠 COMPONENT HOME.JSX RENDERED')
  
  const navigate = useNavigate()
  
  // Récupérer le rôle depuis localStorage directement
  const userStr = localStorage.getItem('user')
  const userRole = userStr ? JSON.parse(userStr).role : null
  
  console.log('🏠 User role from localStorage:', userRole)
  
  // Si l'utilisateur est SGM, afficher uniquement Caméras et Switches
  const displayTypes = userRole === 'SGM' 
    ? TYPES.filter(t => t.key === 'Camera' || t.key === 'Switch')
    : TYPES
  
  console.log('🏠 Types à afficher:', displayTypes.map(t => t.key).join(', '))
  
  const [overview, setOverview] = React.useState({ total:0, up:0, down:0, byTypeUpDown:[] })
  const [recent, setRecent] = React.useState([])

  const fetchOverview = React.useCallback(async ()=>{
    const res = await fetch(`${API}/stats/overview`, { headers: authHeader() })
    if (res.status === 401) { window.location.assign('/login'); return }
    const data = await res.json().catch(()=>({}))
    setOverview({
      total: data.total||0,
      up: data.up||0,
      down: data.down||0,
      byTypeUpDown: Array.isArray(data.byTypeUpDown) ? data.byTypeUpDown : []
    })
  },[])

  const fetchRecent = React.useCallback(async ()=>{
    const res = await fetch(`${API}/equipment?limit=10`, { headers: authHeader() })
    if (res.status === 401) { window.location.assign('/login'); return }
    const data = await res.json().catch(()=>[])
    setRecent(Array.isArray(data) ? data : [])
  },[])

  const refreshAll = React.useCallback(async ()=>{
    await Promise.all([fetchOverview(), fetchRecent()])
  },[fetchOverview, fetchRecent])

  // Mount + polling + focus + événement PanelAdmin
  React.useEffect(()=>{
    refreshAll()
    const onChanged = () => {
      // Rafraîchissement immédiat + second rafraîchissement après délai pour les nouvelles données
      refreshAll()
      setTimeout(() => refreshAll(), 1000)
    }
    const onFocus = ()=>document.visibilityState==='visible' && refreshAll()
    window.addEventListener('equipment:changed', onChanged)
    document.addEventListener('visibilitychange', onFocus)
    const id = setInterval(refreshAll, 20000) // 20s
    return ()=>{
      window.removeEventListener('equipment:changed', onChanged)
      document.removeEventListener('visibilitychange', onFocus)
      clearInterval(id)
    }
  },[refreshAll])

  const byTypeMap = React.useMemo(()=>{
    const map = Object.fromEntries(displayTypes.map(t => [t.key, {up:0,down:0}]))
    for (const r of (overview.byTypeUpDown||[])) {
      if (!map[r.type]) map[r.type] = {up:0,down:0}
      map[r.type].up = r.up||0
      map[r.type].down = r.down||0
    }
    return map
  },[overview, displayTypes])



  return (
    <div className="home-wrap">
      <h1 className="page-title">Dashboard - Semmaris</h1>

      {/* Bouton Plan du Site pour SGM */}
      {userRole === 'SGM' && (
        <div style={{ marginBottom: '20px', textAlign: 'center' }}>
          <a
            href="/plan-site.jpg"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 24px',
              backgroundColor: '#dc2626',
              color: 'white',
              borderRadius: '8px',
              textDecoration: 'none',
              fontWeight: '600',
              fontSize: '16px',
              boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#b91c1c'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#dc2626'}
          >
            <svg style={{width: '20px', height: '20px'}} fill="white" viewBox="0 0 24 24">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
            </svg>
            Voir le plan du site
          </a>
        </div>
      )}

      {/* Cartes totaux par type */}
      <div className="cards-grid">
        {displayTypes.map(t=>{
          const s = byTypeMap[t.key] || {up:0,down:0}
          const total = s.up + s.down
          const allDown = total>0 && s.up===0
          
          // Mapping des types vers les routes
          const routeMap = {
            'Camera': 'cameras',
            'Switch': 'switches',
            'PC': 'pcs',
            'Server': 'servers',
            'Hyperviseur': 'vmware',
            'Stockage': 'stockage'
          }
          const route = routeMap[t.key]
          
          return (
            <div 
              key={t.key} 
              className={`kpi-card ${allDown?'kpi-danger':''}`}
              onClick={() => route && navigate(route)}
              style={{ cursor: route ? 'pointer' : 'default' }}
            >
              <div className="kpi-head">
                <span className="kpi-icon"><t.Icon size={32} /></span>
                <div className="kpi-title">{t.label}</div>
                <div className="kpi-sub">{s.up} en ligne / {s.down} hors ligne — Total {total}</div>
              </div>
              <div className="kpi-body">
                <MiniPie up={s.up} down={s.down} size={130}/>
                <div className="kpi-legend">
                  <div><span className="dot dot-green"></span> <span className="lg">En ligne :</span> <b className="big">{s.up}</b></div>
                  <div><span className="dot dot-red"></span> <span className="lg">Hors ligne :</span> <b className="big">{s.down}</b></div>
                  <div className="muted">Total : {total}</div>
                </div>
              </div>
              {/* Liste offline en bas de la carte pour SGM */}
              {userRole === 'SGM' && s.down > 0 && (
                <div style={{ padding: '0 20px 20px 20px' }} onClick={(e) => e.stopPropagation()}>
                  <OfflineList type={t.key} />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Cartes de bande passante pour les switches principaux - Masqué pour SGM */}
      {userRole !== 'SGM' && (
        <div style={{ marginTop: '24px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '16px', color: '#1f2937' }}>
            📊 Bande Passante BoucleFleur
          </h2>
          <div style={{ maxWidth: '800px' }}>
            <div className="card panel">
              <SwitchBandwidthCard switchName="FED-VIDG3ST2" switchIp="172.16.5.3" />
            </div>
          </div>
        </div>
      )}

      {/* Barre de recherche pour SGM */}
      {userRole === 'SGM' && <SGMSearchBar />}
    </div>
  )
}
