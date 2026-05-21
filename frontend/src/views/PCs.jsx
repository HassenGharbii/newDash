import React from 'react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:4000'
const authHeader = () => ({ 'Authorization': `Bearer ${localStorage.getItem('token')||''}` })

const IconPC = ({size=28}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"
       style={{color:'#fff'}}>
    <rect x="3" y="4" width="18" height="12" rx="2"/>
    <path d="M8 20h8M12 16v4"/>
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

export default function PCs() {
  const [pcs, setPcs] = React.useState([])
  const [stats, setStats] = React.useState({ total: 0, up: 0, down: 0 })
  const [loading, setLoading] = React.useState(true)
  const [currentPage, setCurrentPage] = React.useState(1)
  const itemsPerPage = 10

  const fetchPCs = React.useCallback(async () => {
    try {
      setLoading(true)
      
      const res = await fetch(`${API}/equipment?type=PC`, { headers: authHeader() })
      
      if (res.status === 401) {
        console.warn('Non authentifié - token expiré ou manquant')
        setPCs([])
        setLoading(false)
        return
      }
      
      if (res.ok) {
        const data = await res.json()
        
        // Trier les PCs : équipements hors ligne en premier - Version restaurée
        const sortedData = data.sort((a, b) => {
          const aStatus = a.status === 'down' ? 0 : 1
          const bStatus = b.status === 'down' ? 0 : 1
          return aStatus - bStatus
        })
        
        setPcs(sortedData)
        
        const up = data.filter(pc => pc.status === 'up').length
        const down = data.filter(pc => pc.status === 'down').length
        
        setStats({
          total: data.length,
          up: up,
          down: down
        })
      } else {
        setPcs([])
        setStats({ total: 0, up: 0, down: 0 })
      }
      
    } catch (err) {
      console.error('Erreur lors du chargement des PCs:', err)
      setPcs([])
      setStats({ total: 0, up: 0, down: 0 })
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    fetchPCs()
    const interval = setInterval(fetchPCs, 30000)
    return () => clearInterval(interval)
  }, [fetchPCs])

  // Pagination
  const totalPages = Math.ceil(pcs.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentPCs = pcs.slice(startIndex, endIndex)

  if (loading) {
    return (
      <div className="home-wrap">
        <h1 className="page-title">PCs</h1>
        <div className="loading-message">
          <p>🔄 Chargement des PCs...</p>
        </div>
      </div>
    )
  }

  const allDown = stats.total > 0 && stats.up === 0

  return (
    <div className="home-wrap">
      <h1 className="page-title">Gestion des Ordinateurs</h1>
      
      {/* Section principale avec camembert et tableau */}
      <div className="equipment-layout">
        {/* Carte camembert des statuts */}
        <div className={`kpi-card ${allDown ? 'kpi-danger' : ''}`}>
          <div className="kpi-head">
            <span className="kpi-icon">
              <IconPC size={32} />
            </span>
            <div className="kpi-title">Statut des PCs</div>
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
                Total : {stats.total} ordinateurs
              </div>
            </div>
          </div>
        </div>

        {/* Tableau des PCs avec pagination */}
        <div className="equipment-table-card">
          <div className="table-header">
            <h2>Liste des Ordinateurs</h2>
            <div className="pagination-info">
              Page {currentPage} sur {totalPages} ({pcs.length} PCs) 
              {stats.down > 0 && <span className="priority-note"></span>}
            </div>
          </div>
          
          <div className="table-container">
            {pcs.length === 0 ? (
              <div className="no-data">
                <p>Aucun ordinateur trouvé dans le système.</p>
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
                  {currentPCs.map(pc => (
                    <tr key={pc.id} className={pc.status === 'down' ? 'row-offline priority-row' : ''}>
                      <td>
                        <span className={`status-badge status-${pc.status}`}>
                          {pc.status === 'up' ? '🟢 En ligne' : '🔴 Hors ligne'}
                        </span>
                      </td>
                      <td className="pc-name">{pc.name}</td>
                      <td className="pc-ip">{pc.ip || pc.ip_address || 'N/A'}</td>
                      <td className="last-seen">
                        {(pc.last_ping_at || pc.last_check) ? 
                          new Date(pc.last_ping_at || pc.last_check).toLocaleString('fr-FR', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit'
                          }) : 
                          'Jamais vu'
                        }
                      </td>
                      <td className="pc-location">
                        {pc.location || 'Non spécifié'}
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
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    className={`page-number ${page === currentPage ? 'active' : ''}`}
                    onClick={() => setCurrentPage(page)}
                  >
                    {page}
                  </button>
                ))}
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