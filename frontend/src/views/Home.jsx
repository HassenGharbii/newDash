import React from 'react'

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


const TYPES = [
  { key: 'Camera', label: 'Caméras', Icon: IconCamera },
  { key: 'Switch', label: 'Switchs', Icon: IconSwitch },
  { key: 'PC',     label: 'PC',      Icon: IconPC },
  { key: 'Server', label: 'Serveurs',Icon: IconServer },
]


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
    const onChanged = ()=>refreshAll()
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
    const map = Object.fromEntries(TYPES.map(t => [t.key, {up:0,down:0}]))
    for (const r of (overview.byTypeUpDown||[])) {
      if (!map[r.type]) map[r.type] = {up:0,down:0}
      map[r.type].up = r.up||0
      map[r.type].down = r.down||0
    }
    return map
  },[overview])



  return (
    <div className="home-wrap">
      <h1 className="page-title">Dashboard - Semmaris</h1>

      {/* Cartes totaux par type */}
      <div className="cards-grid">
        {TYPES.map(t=>{
          const s = byTypeMap[t.key] || {up:0,down:0}
          const total = s.up + s.down
          const allDown = total>0 && s.up===0
          return (
            <div key={t.key} className={`kpi-card ${allDown?'kpi-danger':''}`}>
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
            </div>
          )
        })}
      </div>

      {/* Graph placeholder */}
      <div className="card panel mt-6">
        <LineChart/>
      </div>
    </div>
  )
}
