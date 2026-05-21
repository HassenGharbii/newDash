import React from 'react'
import { useNavigate, useParams } from 'react-router-dom'

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

// Composant Camembert pour les statuts
function StatusPieChart({ up, down, unknown, size = 140 }) {
  const total = up + down + unknown
  
  // Si pas de données, afficher le camembert vide
  if (total === 0) {
    return (
      <div className="status-pie-chart" style={{ width: size, height: size }}>
        <div className="no-data-pie" style={{ width: size, height: size }}>
          <span>Aucune donnée</span>
        </div>
      </div>
    )
  }

  // Calcul des pourcentages et angles
  const upPercent = (up / total) * 100
  const downPercent = (down / total) * 100
  const unknownPercent = (unknown / total) * 100
  
  // Création du camembert avec CSS conic-gradient pour simplicité
  const gradientStops = []
  let currentPercent = 0
  
  if (up > 0) {
    gradientStops.push(`#10b981 ${currentPercent}% ${currentPercent + upPercent}%`)
    currentPercent += upPercent
  }
  
  if (down > 0) {
    gradientStops.push(`#ef4444 ${currentPercent}% ${currentPercent + downPercent}%`)
    currentPercent += downPercent
  }
  
  if (unknown > 0) {
    gradientStops.push(`#6b7280 ${currentPercent}% ${currentPercent + unknownPercent}%`)
  }
  
  const gradientStyle = {
    width: size,
    height: size,
    borderRadius: '50%',
    background: `conic-gradient(${gradientStops.join(', ')})`,
    border: '3px solid #fff',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
  }

  return (
    <div className="status-pie-chart" style={{ width: size, height: size }}>
      <div style={gradientStyle}></div>
    </div>
  )
}

// Composant pour formater la dernière fois vu online
function formatLastSeen(lastSeen) {
  if (!lastSeen) return 'Jamais'
  
  const date = new Date(lastSeen)
  const now = new Date()
  const diffMs = now - date
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffHours / 24)
  
  if (diffMs < 60000) return 'À l\'instant'
  if (diffHours < 1) return 'Il y a moins d\'1h'
  if (diffHours < 24) return `Il y a ${diffHours}h`
  if (diffDays === 1) return 'Il y a 1 jour'
  if (diffDays < 7) return `Il y a ${diffDays} jours`
  
  return date.toLocaleDateString('fr-FR', { 
    day: '2-digit', 
    month: '2-digit', 
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// Composant Liste d'équipements avec pagination (style maquette)
function EquipmentList({ equipments, type, onEquipmentClick }) {
  const [currentPage, setCurrentPage] = React.useState(1)
  const itemsPerPage = 5
  
  // Filtrer pour ne montrer que les équipements hors ligne (DOWN) - Version restaurée
  const downEquipments = equipments.filter(equipment => {
    const status = (equipment.ping_status || 'UNKNOWN').toUpperCase()
    return status === 'DOWN' || status === 'UNKNOWN'
  })
  
  const totalPages = Math.ceil(downEquipments.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const currentEquipments = downEquipments.slice(startIndex, startIndex + itemsPerPage)
  
  React.useEffect(() => {
    setCurrentPage(1) // Reset pagination when equipment list changes
  }, [equipments])
  
  if (downEquipments.length === 0) {
    return (
      <div className="equipment-list-empty">
        <p>{type} hors ligne</p>
        <div className="empty-list">
          <div className="list-header">
            <span className="list-col-name">Nom</span>
            <span className="list-col-ip">IP</span>
          </div>
          <div className="no-equipment-message">Aucun équipement hors ligne</div>
        </div>
      </div>
    )
  }
  
  return (
    <div className="equipment-list-container">
      <h4 className="equipment-list-title">{type} hors ligne</h4>
      <div className="equipment-simple-list">
        <div className="list-header">
          <span className="list-col-name">Nom</span>
          <span className="list-col-ip">IP</span>
        </div>
        <div className="list-items">
          {currentEquipments.map(equipment => (
            <div 
              key={equipment.id} 
              className="list-item"
              onClick={() => onEquipmentClick(equipment)}
            >
              <span className="item-name">{equipment.name}</span>
              <span className="item-ip">{equipment.ip || 'N/A'}</span>
            </div>
          ))}
        </div>
        
        {totalPages > 1 && (
          <div className="simple-pagination">
            <button 
              className="page-btn"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              ‹
            </button>
            <span className="page-info">{currentPage}/{totalPages}</span>
            <button 
              className="page-btn"
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
            >
              ›
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// Composant Carte d'équipement par type (style uniformisé avec Home)
function EquipmentTypeCard({ type, equipments, onCardClick, onEquipmentClick }) {
  const icons = {
    'Camera': IconCamera,
    'PC': IconPC,
    'Server': IconServer,
    'Switch': IconSwitch
  }
  
  const labels = {
    'Camera': 'Caméras',
    'PC': 'PCs',
    'Server': 'Serveur',
    'Switch': 'Switches'
  }
  
  const Icon = icons[type] || IconPC
  const label = labels[type] || `${type}s`
  
  // Calculer les statuts
  const statusCount = equipments.reduce((acc, eq) => {
    const status = (eq.ping_status || 'UNKNOWN').toUpperCase()
    if (status === 'UP') acc.up++
    else if (status === 'DOWN') acc.down++
    else acc.unknown++
    return acc
  }, { up: 0, down: 0, unknown: 0 })
  
  const onlineCount = statusCount.up
  const offlineCount = statusCount.down + statusCount.unknown
  const total = equipments.length
  const allDown = total > 0 && onlineCount === 0
  
  return (
    <div className={`kpi-card clickable ${allDown ? 'kpi-danger' : ''}`} 
         onClick={(e) => {
           console.log('🔄 Clic sur carte détecté:', type, e.target)
           e.stopPropagation()
           onCardClick(type)
         }}>
      {/* Header uniformisé avec Home */}
      <div className="kpi-head">
        <span className="kpi-icon"><Icon size={32} /></span>
        <div className="kpi-title">{label}</div>
        <div className="kpi-sub">{onlineCount} en ligne / {offlineCount} hors ligne — Total {total}</div>
        <div className="card-action-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m9 18 6-6-6-6"/>
          </svg>
        </div>
      </div>
      
      {/* Camembert centré */}
      <div className="card-pie-section">
        <StatusPieChart 
          up={statusCount.up} 
          down={statusCount.down} 
          unknown={statusCount.unknown}
          size={140}
        />
      </div>
      
      {/* Indicateurs de statut */}
      <div className="status-indicators">
        <div className="status-indicator">
          <span className="indicator-dot green"></span>
          <span className="indicator-text">{statusCount.up}</span>
        </div>
        <div className="status-indicator">
          <span className="indicator-dot red"></span>
          <span className="indicator-text">{statusCount.down + statusCount.unknown}</span>
        </div>
      </div>
      
      {/* Liste des équipements */}
      <div className="card-equipment-list" onClick={(e) => e.stopPropagation()}>
        <EquipmentList 
          equipments={equipments}
          type={type}
          onEquipmentClick={onEquipmentClick}
        />
      </div>
    </div>
  )
}

export default function Equipment() {
  const navigate = useNavigate()
  const { id } = useParams()
  const [equipmentByType, setEquipmentByType] = React.useState({})
  const [selectedEquipment, setSelectedEquipment] = React.useState(null)
  const [loading, setLoading] = React.useState(true)
  
  // Charger tous les équipements groupés par type
  const loadEquipments = React.useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch(`${API}/equipment`, { headers: authHeader() })
      
      if (res.status === 401) {
        // Supprimer la redirection automatique - juste logger l'erreur
        console.warn('Non authentifié - token expiré ou manquant')
        setEquipmentByType({})
        setLoading(false)
        return
      }
      
      const equipments = await res.json()
      
      // Grouper par type
      const byType = {}
      if (Array.isArray(equipments)) {
        equipments.forEach(equipment => {
          const type = equipment.type || 'Unknown'
          if (!byType[type]) byType[type] = []
          byType[type].push(equipment)
        })
      }
      
      setEquipmentByType(byType)
      
      // Si on a un ID dans l'URL, chercher l'équipement correspondant
      if (id) {
        const equipment = equipments.find(eq => eq.id === parseInt(id))
        if (equipment) {
          setSelectedEquipment(equipment)
        } else {
          console.warn(`Équipement avec ID ${id} non trouvé`)
          navigate('/equipements') // Rediriger vers la liste si pas trouvé
        }
      }
    } catch (err) {
      console.error('Erreur lors du chargement des équipements:', err)
      setEquipmentByType({})
    } finally {
      setLoading(false)
    }
  }, [id, navigate])
  
  React.useEffect(() => {
    loadEquipments()
    // Rafraîchir toutes les minutes
    const interval = setInterval(loadEquipments, 60000)
    return () => clearInterval(interval)
  }, [loadEquipments])
  
  const handleCardClick = (type) => {
    console.log('🔄 Clic détecté sur carte:', type)
    // Redirection vers la page spécifique du type d'équipement
    const routeMap = {
      'Camera': '/cameras',
      'Switch': '/switches', 
      'PC': '/pcs',
      'Server': '/servers'
    }
    
    const route = routeMap[type]
    console.log('🔄 Route calculée:', route)
    if (route) {
      console.log('🔄 Navigation vers:', route)
      // Utiliser window.location au lieu de navigate() pour forcer la navigation
      window.location.href = route
    } else {
      console.warn(`Aucune route définie pour le type d'équipement: ${type}`)
    }
  }
  
  const handleEquipmentClick = (equipment) => {
    // Redirection vers la page de l'équipement spécifique
    navigate(`/equipment/${equipment.id}`)
  }
  
  if (loading) {
    return (
      <div className="equipment-page">
        <h1 className="page-title">Équipements</h1>
        <div className="loading-state">
          <p>Chargement des équipements...</p>
        </div>
      </div>
    )
  }
  
  // Vue détaillée d'un équipement spécifique
  if (selectedEquipment) {
    return (
      <div className="equipment-page">
        <div className="equipment-detail-header">
          <button 
            onClick={() => navigate('/equipements')} 
            className="back-button"
          >
            ← Retour aux équipements
          </button>
          <h1 className="page-title">Détails de l'équipement</h1>
        </div>
        
        <div className="equipment-detail-card">
          <div className="equipment-detail-info">
            <h2>{selectedEquipment.name}</h2>
            <div className="equipment-detail-grid">
              <div className="detail-item">
                <span className="detail-label">Type:</span>
                <span className="detail-value">{selectedEquipment.type}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Adresse IP:</span>
                <span className="detail-value">{selectedEquipment.ip_address || selectedEquipment.ip || 'N/A'}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Statut:</span>
                <span className={`detail-value status-${(selectedEquipment.ping_status || 'unknown').toLowerCase()}`}>
                  {selectedEquipment.ping_status === 'UP' ? '🟢 En ligne' : 
                   selectedEquipment.ping_status === 'DOWN' ? '🔴 Hors ligne' : 
                   '⚪ Inconnu'}
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Dernière connexion:</span>
                <span className="detail-value">{formatLastSeen(selectedEquipment.last_seen)}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Localisation:</span>
                <span className="detail-value">{selectedEquipment.location || 'Non spécifiée'}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Description:</span>
                <span className="detail-value">{selectedEquipment.description || 'Aucune description'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }
  
  const equipmentTypes = Object.keys(equipmentByType).sort()
  
  return (
    <div className="equipment-page">
      <h1 className="page-title">Équipements</h1>
      
      {equipmentTypes.length === 0 ? (
        <div className="no-equipment-message">
          <p>Aucun équipement trouvé. Vérifiez la connexion à l'API ou ajoutez des équipements depuis le panneau d'administration.</p>
        </div>
      ) : (
        <div className="equipment-grid">
          {equipmentTypes.map(type => (
            <EquipmentTypeCard
              key={type}
              type={type}
              equipments={equipmentByType[type]}
              onCardClick={handleCardClick}
              onEquipmentClick={handleEquipmentClick}
            />
          ))}
        </div>
      )}
    </div>
  )
}
