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
  { key: 'Switch', label: 'Switches', Icon: IconSwitch }
]

// Composant pour le graphique miniature de bande passante sur les cartes - Version restaurée
function MiniBandwidthChart({ equipmentType, size = 200 }) {
  const [bandwidthData, setBandwidthData] = React.useState([])
  const [stats, setStats] = React.useState({ max: 0, avg: 0, min: 0, current: 0 })
  const [loading, setLoading] = React.useState(true)
  
  const fetchBandwidthData = React.useCallback(async () => {
    try {
      setLoading(true)
      
      // Essayer de récupérer les vraies données depuis l'API
      try {
        const [dataRes, statsRes] = await Promise.all([
          fetch(`${API}/bandwidth?type=${equipmentType}&hours=24`, { headers: authHeader() }),
          fetch(`${API}/bandwidth/stats?type=${equipmentType}&hours=24`, { headers: authHeader() })
        ])
        
        if (dataRes.status === 401 || statsRes.status === 401) {
          console.warn('Non authentifié - token expiré ou manquant')
          setBandwidthData([])
          setStats({ max: 0, avg: 0, min: 0, current: 0 })
          setLoading(false)
          return
        }
        
        if (dataRes.ok && statsRes.ok) {
          const data = await dataRes.json()
          const statsData = await statsRes.json()
          
          // Si on a des vraies données, les utiliser
          if (data && data.length > 0) {
            const transformedData = data.map(item => ({
              time: new Date(item.timestamp).getHours(),
              value: item.value_mbps,
              timestamp: item.timestamp
            }))
            
            setBandwidthData(transformedData)
            setStats({
              max: statsData.max_mbps || 0,
              avg: statsData.avg_mbps || 0,
              min: statsData.min_mbps || 0,
              current: transformedData.length > 0 ? transformedData[transformedData.length - 1].value : 0
            })
            setLoading(false)
            return
          }
        }
      } catch (apiError) {
        console.log('API non disponible - aucune donnée à afficher')
        // Pas de données simulées - laisser vide
        setBandwidthData([])
        setStats({ max: 0, avg: 0, min: 0, current: 0 })
      }
      
    } catch (err) {
      console.error('Erreur bandwidth:', err)
      // En cas d'erreur, pas de données simulées
      setBandwidthData([])
      setStats({ max: 0, avg: 0, min: 0, current: 0 })
    } finally {
      setLoading(false)
    }
  }, [equipmentType])
  
  React.useEffect(() => {
    fetchBandwidthData()
    // Rafraîchir toutes les 30 secondes
    const interval = setInterval(fetchBandwidthData, 30000)
    return () => clearInterval(interval)
  }, [fetchBandwidthData])
  
  const maxValue = Math.max(...bandwidthData.map(d => d.value), 10)
  
  // État de chargement
  if (loading) {
    return (
      <div className="mini-bandwidth-chart">
        <div className="mini-chart-header">
          <div className="chart-title">Bande passante</div>
          <div className="current-value">
            <span className="value">--</span>
            <span className="status">🔄 Chargement...</span>
          </div>
        </div>
        <div className="mini-chart-loading">
          <p>Chargement des données...</p>
        </div>
      </div>
    )
  }
  
  // Si aucune donnée, créer des données vides pour garder la structure graphique
  const displayData = bandwidthData.length === 0 ? 
    Array.from({length: 24}, (_, i) => ({time: i, value: 0})) : 
    bandwidthData
  
  return (
    <div className="mini-bandwidth-chart">
      <div className="mini-chart-header">
        <div className="chart-title">Bande passante</div>
        <div className="current-value">
          <span className="value">{stats.current.toFixed(1)} Mbps</span>
          <span className={`status ${bandwidthData.length === 0 ? 'no-data' : stats.current > 30 ? 'high' : stats.current > 15 ? 'medium' : 'low'}`}>
            {bandwidthData.length === 0 ? '📊 Aucune donnée' : stats.current > 30 ? '🔴 Élevée' : stats.current > 15 ? '🟡 Moyenne' : '🟢 Faible'}
          </span>
        </div>
      </div>
      
      <div className="mini-chart-graph">
        {bandwidthData.length === 0 && (
          <div className="no-data-overlay">
            <p>Les données apparaîtront une fois connecté au réseau</p>
          </div>
        )}
        <svg width="100%" height={size * 0.6} viewBox={`0 0 300 ${size * 0.6}`} preserveAspectRatio="none">
          <defs>
            <linearGradient id={`areaGradient-${equipmentType}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(239, 68, 68, 0.3)"/>
              <stop offset="100%" stopColor="rgba(239, 68, 68, 0.05)"/>
            </linearGradient>
          </defs>
          
          {displayData.length > 1 && (
            <>
              {/* Zone sous la courbe */}
              <path
                d={`M 0 ${size * 0.6} ${displayData.map((d, i) => 
                  `L ${(i / (displayData.length - 1)) * 300} ${size * 0.6 - (d.value / Math.max(maxValue, 1)) * (size * 0.5)}`
                ).join(' ')} L 300 ${size * 0.6} Z`}
                fill={`url(#areaGradient-${equipmentType})`}
                opacity={bandwidthData.length === 0 ? 0.2 : 1}
              />
              
              {/* Ligne principale */}
              <path
                d={`M ${displayData.map((d, i) => 
                  `${(i / (displayData.length - 1)) * 300} ${size * 0.6 - (d.value / Math.max(maxValue, 1)) * (size * 0.5)}`
                ).join(' L ')}`}
                fill="none"
                stroke="#ef4444"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={bandwidthData.length === 0 ? 0.2 : 1}
              />
            </>
          )}
        </svg>
      </div>
      
      <div className="mini-chart-stats">
        <div className="stat-item">
          <span className="stat-label">Max:</span>
          <span className="stat-value">{stats.max.toFixed(1)} Mbps</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Moy:</span>
          <span className="stat-value">{stats.avg.toFixed(1)} Mbps</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Min:</span>
          <span className="stat-value">{stats.min.toFixed(1)} Mbps</span>
        </div>
      </div>
    </div>
  )
}

// Composant graphique pour la bande passante par type
function BandwidthChart({ 
  equipmentType, 
  equipmentList = [], 
  selectedEquipment = null, 
  onEquipmentSelect 
}) {
  const [bandwidthData, setBandwidthData] = React.useState([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState(null)
  
  const fetchBandwidthData = React.useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      
      // Construire les paramètres de requête
      const params = new URLSearchParams({
        hours: '24'
      })
      
      // Ajouter le filtre par type d'équipement
      if (equipmentType) {
        params.append('type', equipmentType)
      }
      
      // Ajouter le filtre par équipement spécifique si sélectionné
      if (selectedEquipment?.id) {
        params.append('equipment_id', selectedEquipment.id.toString())
      }
      
      // Récupérer les vraies données de bande passante
      const res = await fetch(`${API}/bandwidth?${params}`, { headers: authHeader() })
      
      if (res.status === 401) {
        console.warn('Non authentifié - token expiré ou manquant')
        setError('Non authentifié')
        setBandwidthData([])
        setLoading(false)
        return
      }
      
      if (!res.ok) {
        throw new Error(`Erreur API: ${res.status}`)
      }
      
      const data = await res.json()
      
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
      
    } catch (err) {
      console.error('Erreur lors de la récupération des données de bande passante:', err)
      setError(err.message)
      // En cas d'erreur, laisser les données vides
      setBandwidthData([])
    } finally {
      setLoading(false)
    }
  }, [equipmentType, selectedEquipment])
  
  React.useEffect(() => {
    fetchBandwidthData()
    // Rafraîchir toutes les 2 minutes
    const interval = setInterval(fetchBandwidthData, 2 * 60 * 1000)
    return () => clearInterval(interval)
  }, [fetchBandwidthData])
  
  const maxValue = Math.max(...bandwidthData.map(d => d.value), 10)
  const currentValue = bandwidthData[bandwidthData.length - 1]?.value || 0
  const avgValue = bandwidthData.length > 0 ? 
    bandwidthData.reduce((sum, d) => sum + d.value, 0) / bandwidthData.length : 0
  
  const typeInfo = TYPES.find(t => t.key === equipmentType)
  const displayTitle = selectedEquipment ? 
    `${selectedEquipment.name} (${typeInfo?.label || equipmentType})` : 
    typeInfo?.label || equipmentType
  
  if (loading) {
    return (
      <div className="card panel">
        <div className="card-body">
          <div className="bandwidth-header">
            <div className="chart-title">{displayTitle}</div>
            <div className="bandwidth-current">
              <span className="bandwidth-value">...</span>
              <span className="bandwidth-status">🔄 Chargement...</span>
            </div>
          </div>
          <div className="bandwidth-loading">
            <p>Chargement des données de bande passante...</p>
          </div>
        </div>
      </div>
    )
  }
  
  return (
    <div className="card panel">
      <div className="card-body">
        <div className="bandwidth-header">
          <div className="chart-title">{displayTitle}</div>
          <div className="bandwidth-current">
            <span className="bandwidth-value">{currentValue.toFixed(1)} Mbps</span>
            <span className="bandwidth-status">
              {currentValue > 40 ? '🔴 Élevée' : currentValue > 20 ? '🟡 Moyenne' : '🟢 Faible'}
            </span>
          </div>
        </div>
        
        {/* Sélecteur d'équipement si on n'a pas sélectionné d'équipement spécifique */}
        {!selectedEquipment && equipmentList.length > 0 && (
          <div className="equipment-selector">
            <label>Équipement spécifique:</label>
            <select 
              onChange={(e) => {
                const eq = equipmentList.find(eq => eq.id === parseInt(e.target.value))
                onEquipmentSelect(eq)
              }}
              className="equipment-select"
            >
              <option value="">Tous les {typeInfo?.label || equipmentType} (somme)</option>
              {equipmentList.map(eq => (
                <option key={eq.id} value={eq.id}>
                  {eq.name} - {eq.ip_address}
                </option>
              ))}
            </select>
          </div>
        )}
        
        {/* Bouton retour si équipement spécifique sélectionné */}
        {selectedEquipment && (
          <div className="equipment-selector">
            <button 
              onClick={() => onEquipmentSelect(null)}
              className="back-button"
            >
              ← Retour à tous les {typeInfo?.label || equipmentType}
            </button>
          </div>
        )}
        
        <div className="bandwidth-chart">
          <svg width="100%" height="200" viewBox="0 0 800 200" preserveAspectRatio="none">
            {/* Grille */}
            <defs>
              <pattern id={`grid-${equipmentType}`} width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(0,0,0,0.05)" strokeWidth="1"/>
              </pattern>
              <linearGradient id={`areaGradient-${equipmentType}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(239, 68, 68, 0.3)"/>
                <stop offset="100%" stopColor="rgba(239, 68, 68, 0.05)"/>
              </linearGradient>
            </defs>
            
            <rect width="100%" height="100%" fill={`url(#grid-${equipmentType})`}/>
            
            {/* Ligne de bande passante */}
            {bandwidthData.length > 1 && (
              <>
                {/* Zone sous la courbe */}
                <path
                  d={`M 0 200 ${bandwidthData.map((d, i) => 
                    `L ${(i / (bandwidthData.length - 1)) * 800} ${200 - (d.value / maxValue) * 180}`
                  ).join(' ')} L 800 200 Z`}
                  fill={`url(#areaGradient-${equipmentType})`}
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
        
        {/* Statistiques */}
        <div className="bandwidth-stats">
          <div className="bandwidth-stat">
            <span className="stat-label">Actuel:</span>
            <span className="stat-value">{currentValue.toFixed(1)} Mbps</span>
          </div>
          <div className="bandwidth-stat">
            <span className="stat-label">Moyenne:</span>
            <span className="stat-value">{avgValue.toFixed(1)} Mbps</span>
          </div>
          <div className="bandwidth-stat">
            <span className="stat-label">Max 24h:</span>
            <span className="stat-value">{maxValue.toFixed(1)} Mbps</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Bandwidth() {
  console.log('Bandwidth component rendered')
  const [equipmentByType, setEquipmentByType] = React.useState({})
  const [overview, setOverview] = React.useState({ total:0, up:0, down:0, byTypeUpDown:[] })
  const [selectedType, setSelectedType] = React.useState(null)
  const [selectedEquipment, setSelectedEquipment] = React.useState(null)
  const [loading, setLoading] = React.useState(true)

  // Charger les statistiques d'overview (comme page d'accueil)
  const fetchOverview = React.useCallback(async () => {
    try {
      const res = await fetch(`${API}/stats/overview`, { headers: authHeader() })
      if (res.status === 401) { 
        console.warn('Non authentifié - token expiré ou manquant')
        setOverview({ total:0, up:0, down:0, byTypeUpDown:[] })
        return 
      }
      const data = await res.json().catch(() => ({}))
      setOverview({
        total: data.total || 0,
        up: data.up || 0,
        down: data.down || 0,
        byTypeUpDown: Array.isArray(data.byTypeUpDown) ? data.byTypeUpDown : []
      })
    } catch (err) {
      console.error('Erreur overview:', err)
      setOverview({ total:0, up:0, down:0, byTypeUpDown:[] })
    }
  }, [])

  // Récupérer tous les équipements par type depuis l'API
  const fetchEquipment = React.useCallback(async () => {
    try {
      setLoading(true)
      
      // Récupérer les vrais équipements depuis l'API
      const res = await fetch(`${API}/equipment`, { headers: authHeader() })
      
      if (res.status === 401) {
        console.warn('Non authentifié - token expiré ou manquant')
        setEquipmentByType({})
        setLoading(false)
        return
      }
      
      if (!res.ok) {
        throw new Error('Erreur lors de la récupération des équipements')
      }
      
      const equipment = await res.json()
      
      // Grouper les équipements par type
      const byType = {}
      equipment.forEach(eq => {
        const type = eq.type || 'Unknown'
        if (!byType[type]) {
          byType[type] = []
        }
        byType[type].push(eq)
      })
      
      setEquipmentByType(byType)
      
    } catch (err) {
      console.error('Erreur lors du chargement des équipements:', err)
      // En cas d'erreur, laisser vide
      setEquipmentByType({})
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    Promise.all([fetchEquipment(), fetchOverview()])
  }, [fetchEquipment, fetchOverview])

  // Créer un mapping des statistiques par type (comme page d'accueil)
  const byTypeMap = React.useMemo(() => {
    const map = Object.fromEntries(TYPES.map(t => [t.key, {up:0,down:0}]))
    for (const r of (overview.byTypeUpDown||[])) {
      if (!map[r.type]) map[r.type] = {up:0,down:0}
      map[r.type].up = r.up||0
      map[r.type].down = r.down||0
    }
    return map
  }, [overview])

  const handleCardClick = (type) => {
    setSelectedType(type)
    setSelectedEquipment(null)
  }

  const handleEquipmentSelect = (equipment) => {
    setSelectedEquipment(equipment)
  }

  const handleBackToOverview = () => {
    setSelectedType(null)
    setSelectedEquipment(null)
  }

  if (loading) {
    return (
      <div className="home-wrap">
        <h1 className="page-title">Bande Passante</h1>
        <div className="loading-message">
          <p>🔄 Chargement des équipements...</p>
        </div>
      </div>
    )
  }

  // Vue détaillée d'un type d'équipement
  if (selectedType) {
    const typeInfo = TYPES.find(t => t.key === selectedType)
    const equipmentList = equipmentByType[selectedType] || []
    
    return (
      <div className="home-wrap">
        <div className="bandwidth-header-nav">
          <button onClick={handleBackToOverview} className="back-button">
            ← Retour à la vue d'ensemble
          </button>
          <h1 className="page-title">
            Bande Passante - {typeInfo?.label || selectedType}
          </h1>
        </div>
        
        <BandwidthChart
          equipmentType={selectedType}
          equipmentList={equipmentList}
          selectedEquipment={selectedEquipment}
          onEquipmentSelect={handleEquipmentSelect}
        />
      </div>
    )
  }

  // Vue d'ensemble avec cartes par type
  return (
    <div className="home-wrap">
      <h1 className="page-title">Bande Passante des Switches</h1>
      
      <p className="page-subtitle">
        Consommation en bande passante des switches réseau
      </p>

      {/* Message si pas de données */}
      {Object.keys(equipmentByType).length === 0 && (
        <div className="no-data-message">
          <p>Aucune donnée d'équipement disponible. Vérifiez la connexion à l'API.</p>
        </div>
      )}

      {/* Cartes cliquables par type d'équipement */}
      <div className="cards-grid">
        {TYPES.map(type => {
          const equipmentList = equipmentByType[type.key] || []
          const totalEquipment = equipmentList.length
          
          return (
            <div 
              key={type.key} 
              className="kpi-card bandwidth-card"
              onClick={() => handleCardClick(type.key)}
              style={{ cursor: 'pointer' }}
            >
              <div className="kpi-head">
                <span className="kpi-icon">
                  <type.Icon size={32} />
                </span>
                <div className="kpi-title">{type.label}</div>
                <div className="kpi-sub">
                  {totalEquipment} équipement{totalEquipment > 1 ? 's' : ''} • Consommation globale
                </div>
              </div>
              <div className="kpi-body">
                <MiniBandwidthChart equipmentType={type.key} size={200} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}