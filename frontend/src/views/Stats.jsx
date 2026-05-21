import React from 'react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:4000'
const authHeader = () => ({ 'Authorization': `Bearer ${localStorage.getItem('token')||''}` })

const IconStats = ({size=28}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"
       style={{color:'#fff'}}>
    <line x1="18" y1="6" x2="6" y2="18"/>
    <line x1="6" y1="6" x2="18" y2="18"/>
    <circle cx="12" cy="12" r="10"/>
  </svg>
)

const IconChart = ({size=28}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"
       style={{color:'#fff'}}>
    <line x1="12" y1="20" x2="12" y2="10"/>
    <line x1="18" y1="20" x2="18" y2="4"/>
    <line x1="6" y1="20" x2="6" y2="16"/>
  </svg>
)

const IconAlert = ({size=28}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"
       style={{color:'#fff'}}>
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
    <path d="M12 9v4"/>
    <path d="m12 17 .01 0"/>
  </svg>
)

const IconUptime = ({size=28}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"
       style={{color:'#fff'}}>
    <circle cx="12" cy="12" r="10"/>
    <polyline points="12,6 12,12 16,14"/>
  </svg>
)

export default function Stats() {
  const [globalStats, setGlobalStats] = React.useState({
    total_equipment: 0,
    equipment_up: 0,
    equipment_down: 0,
    avg_response_time: 0,
    uptime_percentage: 0
  })
  const [equipmentByType, setEquipmentByType] = React.useState({})
  const [dailyStats, setDailyStats] = React.useState([])
  const [alerts, setAlerts] = React.useState([])
  const [lastUpdate, setLastUpdate] = React.useState(new Date())
  const [loading, setLoading] = React.useState(true)

  const fetchStats = React.useCallback(async () => {
    try {
      setLoading(true)
      
      // Récupérer les statistiques globales et les équipements par type
      const [overviewRes, equipmentRes, alertsRes] = await Promise.all([
        fetch(`${API}/stats/overview`, { headers: authHeader() }),
        fetch(`${API}/equipment`, { headers: authHeader() }),
        fetch(`${API}/alerts/recent?limit=10`, { headers: authHeader() })
      ])
      
      if (overviewRes.status === 401 || equipmentRes.status === 401 || alertsRes.status === 401) {
        console.warn('Non authentifié - token expiré ou manquant')
        setGlobalStats({
          total_equipment: 0,
          equipment_up: 0,
          equipment_down: 0,
          avg_response_time: 0,
          uptime_percentage: 0
        })
        setEquipmentByType({})
        setAlerts([])
        setLoading(false)
        return
      }
      
      // Traiter les statistiques globales
      if (overviewRes.ok) {
        const overview = await overviewRes.json()
        setGlobalStats({
          total_equipment: overview.total || 0,
          equipment_up: overview.up || 0,
          equipment_down: overview.down || 0,
          avg_response_time: overview.avg_response_time || 0,
          uptime_percentage: overview.total > 0 ? ((overview.up / overview.total) * 100) : 0
        })
      }
      
      // Traiter les équipements par type
      if (equipmentRes.ok) {
        const equipments = await equipmentRes.json()
        
        // Grouper par type et calculer les statistiques
        const byType = {}
        let totalLatency = 0
        let latencyCount = 0
        
        if (Array.isArray(equipments)) {
          equipments.forEach(equipment => {
            const type = equipment.type || 'Unknown'
            if (!byType[type]) {
              byType[type] = { total: 0, up: 0, down: 0, unknown: 0, avg_latency: 0 }
            }
            byType[type].total++
            
            const status = (equipment.ping_status || equipment.status || 'UNKNOWN').toUpperCase()
            if (status === 'UP') {
              byType[type].up++
              // Calculer la latence moyenne si disponible
              if (equipment.latency_ms && equipment.latency_ms > 0) {
                totalLatency += equipment.latency_ms
                latencyCount++
              }
            } else if (status === 'DOWN') {
              byType[type].down++
            } else {
              byType[type].unknown++
            }
          })
          
          // Mettre à jour les statistiques globales avec la latence calculée
          if (latencyCount > 0) {
            const avgLatency = Math.round(totalLatency / latencyCount)
            setGlobalStats(prev => ({
              ...prev,
              avg_response_time: avgLatency
            }))
          }
        }
        setEquipmentByType(byType)
      }
      
      // Traiter les alertes
      if (alertsRes.ok) {
        const alertsData = await alertsRes.json()
        setAlerts(Array.isArray(alertsData) ? alertsData : [])
      }
      
    } catch (err) {
      console.error('Erreur lors du chargement des statistiques:', err)
      setGlobalStats({
        total_equipment: 0,
        equipment_up: 0,
        equipment_down: 0,
        avg_response_time: 0,
        uptime_percentage: 0
      })
      setEquipmentByType({})
      setAlerts([])
    } finally {
      setLastUpdate(new Date())
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    fetchStats()
    const interval = setInterval(fetchStats, 60000) // Rafraîchir toutes les minutes
    return () => clearInterval(interval)
  }, [fetchStats])

  if (loading) {
    return (
      <div className="home-wrap">
        <h1 className="page-title">Statistiques</h1>
        <div className="loading-message">
          <p>🔄 Chargement des statistiques...</p>
        </div>
      </div>
    )
  }

  const criticalAlerts = alerts.filter(alert => alert.severity === 'critical').length
  const warningAlerts = alerts.filter(alert => alert.severity === 'warning').length

  return (
    <div className="home-wrap">
      <h1 className="page-title">Statistiques du Système</h1>
      
      {/* Cartes de statistiques principales */}
      <div className="cards-grid mb-6">
        <div className={`kpi-card ${globalStats.equipment_down > 0 ? 'kpi-danger' : ''}`}>
          <div className="kpi-head">
            <span className="kpi-icon">
              <IconStats size={32} />
            </span>
            <div className="kpi-title">Équipements</div>
            <div className="kpi-sub">
              {globalStats.equipment_up} en ligne / {globalStats.equipment_down} hors ligne
            </div>
          </div>
          <div className="kpi-body">
            <div className="kpi-legend">
              <div>
                <span className="dot dot-green"></span> 
                <span className="lg">Actifs :</span> 
                <b className="big">{globalStats.equipment_up}</b>
              </div>
              <div>
                <span className="dot dot-red"></span> 
                <span className="lg">Inactifs :</span> 
                <b className="big">{globalStats.equipment_down}</b>
              </div>
              <div className="muted">Total : {globalStats.total_equipment}</div>
            </div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-head">
            <span className="kpi-icon">
              <IconUptime size={32} />
            </span>
            <div className="kpi-title">Disponibilité</div>
            <div className="kpi-sub">
              Temps de fonctionnement global
            </div>
          </div>
          <div className="kpi-body">
            <div className="kpi-legend">
              <div className="muted">
                <b className="big">{globalStats.uptime_percentage.toFixed(1)}%</b>
              </div>
              <div className="muted">Uptime système</div>
              <div className="muted">
                Temps de réponse moyen: {globalStats.avg_response_time > 0 ? `${globalStats.avg_response_time}ms` : 'N/A'}
              </div>
            </div>
          </div>
        </div>

        <div className={`kpi-card ${criticalAlerts > 0 ? 'kpi-danger' : warningAlerts > 0 ? 'kpi-warning' : ''}`}>
          <div className="kpi-head">
            <span className="kpi-icon">
              <IconAlert size={32} />
            </span>
            <div className="kpi-title">Alertes</div>
            <div className="kpi-sub">
              {criticalAlerts} critiques / {warningAlerts} avertissements
            </div>
          </div>
          <div className="kpi-body">
            <div className="kpi-legend">
              <div>
                <span className="dot dot-red"></span> 
                <span className="lg">Critiques :</span> 
                <b className="big">{criticalAlerts}</b>
              </div>
              <div>
                <span className="dot dot-yellow"></span> 
                <span className="lg">Avertissements :</span> 
                <b className="big">{warningAlerts}</b>
              </div>
              <div className="muted">Total : {alerts.length}</div>
            </div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-head">
            <span className="kpi-icon">
              <IconChart size={32} />
            </span>
            <div className="kpi-title">Performance</div>
            <div className="kpi-sub">
              Métriques temps réel
            </div>
          </div>
          <div className="kpi-body">
            <div className="kpi-legend">
              <div className="muted">Surveillance continue</div>
              <div className="muted">Dernière maj: {new Date().toLocaleTimeString('fr-FR')}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Métriques de performance en temps réel */}
      <div className="card panel mb-6">
        <div className="card-body">
          <div className="performance-metrics-grid">
            <div className="metric-item">
              <div className="metric-label">Temps de réponse moyen</div>
              <div className="metric-value">
                {globalStats.avg_response_time > 0 ? `${globalStats.avg_response_time}ms` : 'N/A'}
              </div>
              <div className="metric-status">
                {globalStats.avg_response_time === 0 ? '⚪ Aucune donnée' :
                 globalStats.avg_response_time < 100 ? '🟢 Excellent' : 
                 globalStats.avg_response_time < 300 ? '🟡 Correct' : '🔴 Lent'}
              </div>
            </div>
            
            <div className="metric-item">
              <div className="metric-label">Disponibilité globale</div>
              <div className="metric-value">{globalStats.uptime_percentage.toFixed(1)}%</div>
              <div className="metric-status">
                {globalStats.uptime_percentage >= 99 ? '🟢 Excellent' :
                 globalStats.uptime_percentage >= 95 ? '🟡 Correct' : '🔴 Critique'}
              </div>
            </div>
            
            <div className="metric-item">
              <div className="metric-label">Équipements surveillés</div>
              <div className="metric-value">{globalStats.total_equipment}</div>
              <div className="metric-status">🔄 Monitoring actif</div>
            </div>
            
            <div className="metric-item">
              <div className="metric-label">Dernière mise à jour</div>
              <div className="metric-value">{lastUpdate.toLocaleTimeString('fr-FR')}</div>
              <div className="metric-status">⏱️ En temps réel</div>
            </div>
          </div>
        </div>
      </div>

      {/* Statistiques par type d'équipement */}
      {Object.keys(equipmentByType).length > 0 && (
        <div className="card panel mb-6">
          <div className="card-body">
            <div className="equipment-stats-grid">
              {Object.entries(equipmentByType).map(([type, stats]) => {
                const labels = {
                  'Camera': 'Caméras',
                  'PC': 'PCs',
                  'Server': 'Serveur',
                  'Switch': 'Switches'
                }
                const displayLabel = labels[type] || `${type}s`
                
                return (
                <div key={type} className="equipment-stat-card">
                  <div className="stat-header">
                    <h3>{displayLabel}</h3>
                    <span className="stat-total">{stats.total}</span>
                  </div>
                  <div className="stat-breakdown">
                    <div className="stat-item">
                      <span className="dot dot-green"></span>
                      <span>En ligne: <strong>{stats.up}</strong></span>
                    </div>
                    <div className="stat-item">
                      <span className="dot dot-red"></span>
                      <span>Hors ligne: <strong>{stats.down + stats.unknown}</strong></span>
                    </div>
                    <div className="stat-percentage">
                      {stats.total > 0 ? Math.round((stats.up / stats.total) * 100) : 0}% disponible
                    </div>
                  </div>
                </div>
              )})}}
            </div>
          </div>
        </div>
      )}

      {/* Alertes récentes */}
      <div className="card panel">
        <div className="card-body">
          {alerts.length === 0 ? (
            <div className="no-data">
              <p>Aucune alerte récente. Le système fonctionne normalement.</p>
            </div>
          ) : (
            <div className="alerts-list">
              {alerts.map((alert, index) => (
                <div key={index} className={`alert-item alert-${alert.severity || 'info'}`}>
                  <div className="alert-header">
                    <span className={`alert-icon ${alert.severity === 'critical' ? '🔴' : alert.severity === 'warning' ? '🟡' : '🔵'}`}>
                      {alert.severity === 'critical' ? '🔴' : alert.severity === 'warning' ? '🟡' : '🔵'}
                    </span>
                    <div className="alert-info">
                      <div className="alert-title">{alert.title || 'Alerte système'}</div>
                      <div className="alert-time">
                        {alert.timestamp ? new Date(alert.timestamp).toLocaleString('fr-FR') : 'Maintenant'}
                      </div>
                    </div>
                    <div className={`alert-severity severity-${alert.severity || 'info'}`}>
                      {alert.severity || 'info'}
                    </div>
                  </div>
                  <div className="alert-message">
                    {alert.message || 'Aucun détail disponible'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}