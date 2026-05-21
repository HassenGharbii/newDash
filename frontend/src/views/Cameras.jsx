import React from 'react'

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

// Composant Camembert pour les statuts
function StatusPieChart({ up, down, size = 140 }) {
  const total = up + down
  
  if (total === 0) {
    return (
      <div className="status-pie-chart" style={{ width: size, height: size }}>
        <div className="no-data-pie">
          <span>Aucune donnée</span>
        </div>
      </div>
    )
  }
  
  const upPercentage = (up / total) * 100
  const downPercentage = (down / total) * 100
  
  return (
    <div className="status-pie-chart" style={{ width: size, height: size }}>
      <div
        className="pie-chart"
        style={{
          background: `conic-gradient(
            #10b981 0deg ${upPercentage * 3.6}deg,
            #ef4444 ${upPercentage * 3.6}deg 360deg
          )`,
          width: size,
          height: size,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <div 
          style={{
            background: 'white',
            borderRadius: '50%',
            width: size * 0.6,
            height: size * 0.6,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '14px',
            fontWeight: 'bold'
          }}
        >
          <div style={{ color: '#10b981' }}>{up}</div>
          <div style={{ color: '#ef4444' }}>{down}</div>
        </div>
      </div>
    </div>
  )
}

export default function Cameras() {
  const [cameras, setCameras] = React.useState([])
  const [stats, setStats] = React.useState({ total: 0, up: 0, down: 0 })
  const [loading, setLoading] = React.useState(true)
  const [currentPage, setCurrentPage] = React.useState(1)
  const itemsPerPage = 20

  const fetchCameras = React.useCallback(async () => {
    try {
      setLoading(true)
      
      const res = await fetch(`${API}/equipment?type=Camera`, { headers: authHeader() })
      
      if (res.status === 401) {
        console.warn('Non authentifié - token expiré ou manquant')
        setCameras([])
        setLoading(false)
        return
      }
      
      if (res.ok) {
        const data = await res.json()
        
        // Trier les caméras : équipements hors ligne en premier - Version restaurée
        const sortedData = data.sort((a, b) => {
          const aStatus = a.status === 'down' ? 0 : 1
          const bStatus = b.status === 'down' ? 0 : 1
          return aStatus - bStatus
        })
        
        setCameras(sortedData)
        
        const up = data.filter(c => c.status === 'up').length
        const down = data.filter(c => c.status === 'down').length
        
        setStats({
          total: data.length,
          up: up,
          down: down
        })
      } else {
        setCameras([])
        setStats({ total: 0, up: 0, down: 0 })
      }
      
    } catch (err) {
      console.error('Erreur lors du chargement des caméras:', err)
      setCameras([])
      setStats({ total: 0, up: 0, down: 0 })
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    fetchCameras()
    const interval = setInterval(fetchCameras, 30000)
    return () => clearInterval(interval)
  }, [fetchCameras])

  // Filtrer pour ne montrer que les caméras hors ligne
  const downCameras = cameras.filter(camera => camera.status === 'down')

  // Pagination pour toutes les caméras (triées avec hors ligne en premier)
  const totalPages = Math.ceil(cameras.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentCameras = cameras.slice(startIndex, endIndex)

  if (loading) {
    return (
      <div className="home-wrap">
        <h1 className="page-title">Caméras</h1>
        <div className="loading-message">
          <p>🔄 Chargement des caméras...</p>
        </div>
      </div>
    )
  }

  const allDown = stats.total > 0 && stats.up === 0

  return (
    <div className="home-wrap">
      <h1 className="page-title">Gestion des Caméras</h1>
      
      {/* Section principale avec camembert et tableau */}
      <div className="equipment-layout">
        {/* Carte camembert des statuts */}
        <div className={`kpi-card ${allDown ? 'kpi-danger' : ''}`}>
          <div className="kpi-head">
            <span className="kpi-icon">
              <IconCamera size={32} />
            </span>
            <div className="kpi-title">Statut des Caméras</div>
            <div className="kpi-sub">
              {stats.up} en ligne / {stats.down} hors ligne — Total {stats.total}
            </div>
          </div>
          <div className="kpi-body chart-section">
            <StatusPieChart up={stats.up} down={stats.down} size={160} />
            <div className="chart-legend">
              <div className="legend-item">
                <span className="dot dot-green"></span> 
                <span>En ligne : <strong>{stats.up}</strong></span>
              </div>
              <div className="legend-item">
                <span className="dot dot-red"></span> 
                <span>Hors ligne : <strong>{stats.down}</strong></span>
              </div>
              <div className="legend-total">
                Total : {stats.total} caméras
              </div>
            </div>
          </div>
        </div>

        {/* Tableau des caméras avec pagination */}
        <div className="equipment-table-card">
          <div className="table-header">
            <h2>Liste des Caméras</h2>
            <div className="pagination-info">
              {cameras.length > 0 ? (
                `Page ${currentPage} sur ${totalPages} (${cameras.length} caméras)`
              ) : (
                `Aucune caméra trouvée`
              )}
              {stats.down > 0 && <span className="priority-note"> </span>}
            </div>
          </div>
          
          <div className="table-container">
            {cameras.length === 0 ? (
              <div className="no-data">
                <p>Aucune caméra trouvée dans le système.</p>
              </div>
            ) : (
              <table className="equipment-table">
                <thead>
                  <tr>
                    <th>Statut</th>
                    <th>Nom</th>
                    <th>Adresse IP</th>
                    <th>Dernière vue</th>
                    <th>Emplacement</th>
                  </tr>
                </thead>
                <tbody>
                  {currentCameras.map(camera => (
                    <tr key={camera.id} className={camera.status === 'down' ? 'row-offline priority-row' : ''}>
                      <td>
                        <span className={`status-badge status-${camera.status}`}>
                          {camera.status === 'up' ? '🟢 En ligne' : '🔴 Hors ligne'}
                        </span>
                      </td>
                      <td className="camera-name">{camera.name}</td>
                      <td className="camera-ip">{camera.ip || camera.ip_address || camera.address || 'N/A'}</td>
                      <td className="last-seen">
                        {(camera.last_ping_at || camera.last_check) ? 
                          new Date(camera.last_ping_at || camera.last_check).toLocaleString('fr-FR', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit'
                          }) : 
                          'Jamais vue'
                        }
                      </td>
                      <td className="camera-location">
                        {camera.location || 'Non spécifié'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="pagination">
              <button 
                className="page-btn"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                ‹ Précédent
              </button>
              
              <div className="page-numbers">
                {(() => {
                  const pages = []
                  const maxVisible = 10
                  
                  if (totalPages <= maxVisible) {
                    // Afficher toutes les pages si <= 10
                    for (let i = 1; i <= totalPages; i++) {
                      pages.push(i)
                    }
                  } else {
                    // Logique pour grandes listes
                    if (currentPage <= 6) {
                      // Début : 1 2 3 4 5 6 7 8 ... 60
                      for (let i = 1; i <= 8; i++) pages.push(i)
                      pages.push('...')
                      pages.push(totalPages)
                    } else if (currentPage >= totalPages - 5) {
                      // Fin : 1 ... 53 54 55 56 57 58 59 60
                      pages.push(1)
                      pages.push('...')
                      for (let i = totalPages - 7; i <= totalPages; i++) pages.push(i)
                    } else {
                      // Milieu : 1 ... 28 29 30 31 32 ... 60
                      pages.push(1)
                      pages.push('...')
                      for (let i = currentPage - 2; i <= currentPage + 2; i++) pages.push(i)
                      pages.push('...')
                      pages.push(totalPages)
                    }
                  }
                  
                  return pages.map((page, index) => 
                    page === '...' ? (
                      <span key={`ellipsis-${index}`} className="page-ellipsis">...</span>
                    ) : (
                      <button
                        key={page}
                        className={`page-number ${page === currentPage ? 'active' : ''}`}
                        onClick={() => setCurrentPage(page)}
                      >
                        {page}
                      </button>
                    )
                  )
                })()}
              </div>
              
              <button 
                className="page-btn"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
              >
                Suivant ›
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}