import React from 'react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:4000'
const authHeader = () => ({ 'Authorization': `Bearer ${localStorage.getItem('token')||''}` })

const IconServer = ({size=28}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"
       style={{color:'#fff'}}>
    <rect x="4" y="4" width="16" height="6" rx="2"/>
    <rect x="4" y="14" width="16" height="6" rx="2"/>
    <path d="M7 7h.01M10 7h.01M7 17h.01M10 17h.01"/>
  </svg>
)

const IconPower = ({size=24}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2v6"/>
    <path d="M12 18v4"/>
    <circle cx="12" cy="12" r="10"/>
  </svg>
)

const IconCPU = ({size=24}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="4" width="16" height="16" rx="2"/>
    <rect x="9" y="9" width="6" height="6"/>
    <line x1="9" y1="1" x2="9" y2="4"/>
    <line x1="15" y1="1" x2="15" y2="4"/>
    <line x1="9" y1="20" x2="9" y2="23"/>
    <line x1="15" y1="20" x2="15" y2="23"/>
    <line x1="20" y1="9" x2="23" y2="9"/>
    <line x1="20" y1="14" x2="23" y2="14"/>
    <line x1="1" y1="9" x2="4" y2="9"/>
    <line x1="1" y1="14" x2="4" y2="14"/>
  </svg>
)

const IconGPU = ({size=24}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="6" width="20" height="12" rx="2"/>
    <circle cx="12" cy="12" r="2"/>
    <path d="m4.93 19.07 1.41-1.41"/>
    <path d="m17.66 6.34 1.41-1.41"/>
    <path d="m6.34 17.66-1.41 1.41"/>
    <path d="m19.07 4.93-1.41 1.41"/>
  </svg>
)

const IconNetwork = ({size=24}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="16" y="16" width="6" height="6" rx="1"/>
    <rect x="2" y="16" width="6" height="6" rx="1"/>
    <rect x="9" y="2" width="6" height="6" rx="1"/>
    <path d="m5 16 4-4"/>
    <path d="m15 8 4 4"/>
  </svg>
)

const IconBandwidth = ({size=24}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22,6 12,16 2,6"/>
  </svg>
)

// Composant pour une métrique avec gauge
function MetricGauge({ title, value, max, unit, icon: Icon, status }) {
  const percentage = Math.min((value / max) * 100, 100)
  const getStatusColor = () => {
    if (status === 'critical') return '#ef4444'
    if (status === 'warning') return '#f59e0b'
    return '#10b981'
  }

  return (
    <div className="metric-gauge">
      <div className="metric-header">
        <Icon size={20} />
        <span className="metric-title">{title}</span>
      </div>
      <div className="gauge-container">
        <div className="gauge-track">
          <div 
            className="gauge-fill"
            style={{ 
              width: `${percentage}%`,
              backgroundColor: getStatusColor()
            }}
          />
        </div>
        <div className="metric-value">
          <span className="value">{value}</span>
          <span className="unit">{unit}</span>
        </div>
      </div>
      <div className={`metric-status status-${status}`}>
        {status === 'critical' ? '🔴 Critique' : 
         status === 'warning' ? '🟡 Attention' : '🟢 Normal'}
      </div>
    </div>
  )
}

// Composant pour les cartes réseau avec design moderne
function NetworkCard({ card, onSelect, isSelected }) {
  const isOnline = card.status === 'up';
  
  return (
    <div 
      className={`network-card-modern ${isSelected ? 'selected' : ''} ${!isOnline ? 'offline' : ''}`}
      onClick={() => onSelect(card)}
    >
      <div className="card-header">
        <div className="card-icon">
          <IconNetwork size={24} />
        </div>
        <div className="card-title-section">
          <h4 className="card-title">{card.name}</h4>
          <div className={`status-badge ${isOnline ? 'online' : 'offline'}`}>
            <div className="status-dot"></div>
            <span className="status-text">{isOnline ? 'En ligne' : 'Hors ligne'}</span>
          </div>
        </div>
      </div>
      <div className="card-body">
        <div className="card-info-row">
          <span className="info-label">Interface:</span>
          <span className="info-value">{card.interface || 'N/A'}</span>
        </div>
        <div className="card-info-row">
          <span className="info-label">Type:</span>
          <span className="info-value">{card.type || 'Unknown'}</span>
        </div>
        <div className="card-info-row">
          <span className="info-label">Vitesse:</span>
          <span className="info-value">{card.speed || 'N/A'}</span>
        </div>
        {card.ip_address && (
          <div className="card-info-row">
            <span className="info-label">IP:</span>
            <span className="info-value">{card.ip_address}</span>
          </div>
        )}
        {card.mac_address && (
          <div className="card-info-row">
            <span className="info-label">MAC:</span>
            <span className="info-value mac-address">{card.mac_address}</span>
          </div>
        )}
        {card.bandwidth_mbps !== undefined && card.bandwidth_mbps > 0 && (
          <div className="card-info-row highlight">
            <span className="info-label">Bande passante:</span>
            <span className="info-value">{card.bandwidth_mbps} Mbps</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default function Servers() {
  const [servers, setServers] = React.useState([])
  const [selectedServer, setSelectedServer] = React.useState(null)
  const [selectedNetworkCard, setSelectedNetworkCard] = React.useState(null)
  const [serverMetrics, setServerMetrics] = React.useState({})
  const [loading, setLoading] = React.useState(true)

  const fetchServers = React.useCallback(async () => {
    try {
      setLoading(true)
      
      const res = await fetch(`${API}/equipment?type=Server`, { headers: authHeader() })
      
      if (res.status === 401) {
        console.warn('Non authentifié - token expiré ou manquant')
        setServers([])
        setLoading(false)
        return
      }
      
      if (res.ok) {
        const data = await res.json()
        
        // Trier les serveurs : équipements hors ligne en premier - Version restaurée
        const sortedData = data.sort((a, b) => {
          const aStatus = a.status === 'down' ? 0 : 1
          const bStatus = b.status === 'down' ? 0 : 1
          return aStatus - bStatus
        })
        
        setServers(sortedData)
        
        // Sélectionner le premier serveur par défaut
        if (sortedData.length > 0 && !selectedServer) {
          setSelectedServer(sortedData[0])
        }
      } else {
        setServers([])
      }
      
    } catch (err) {
      console.error('Erreur lors du chargement des serveurs:', err)
      setServers([])
    } finally {
      setLoading(false)
    }
  }, [selectedServer])

  const fetchServerMetrics = React.useCallback(async (serverId) => {
    try {
      const res = await fetch(`${API}/metrics/server/${serverId}`, { headers: authHeader() })
      
      if (res.ok) {
        const metrics = await res.json()
        console.log('📊 Métriques serveur reçues:', {
          cpu: metrics.cpu?.usage,
          gpu: metrics.gpu?.usage,
          bandwidth: metrics.bandwidth?.current,
          network_cards: metrics.network_cards?.length
        })
        setServerMetrics(metrics)
      } else {
        // Si pas de métriques détaillées, utiliser les données de base du serveur
        const server = servers.find(s => s.id === serverId)
        setServerMetrics({
          server_id: serverId,
          server_name: server?.name || 'Serveur',
          ip_address: server?.ip,
          model: server?.model,
          location: server?.location,
          ping_status: server?.ping_status,
          latency_ms: server?.latency_ms,
          last_ping_at: server?.last_ping_at,
          timestamp: new Date().toISOString()
        })
      }
    } catch (err) {
      console.error('Erreur lors du chargement des métriques:', err)
      setServerMetrics({})
    }
  }, [servers])

  React.useEffect(() => {
    fetchServers()
  }, [fetchServers])

  React.useEffect(() => {
    if (selectedServer) {
      fetchServerMetrics(selectedServer.id)
      const interval = setInterval(() => fetchServerMetrics(selectedServer.id), 10000)
      return () => clearInterval(interval)
    }
  }, [selectedServer, fetchServerMetrics])

  if (loading) {
    return (
      <div className="home-wrap">
        <h1 className="page-title">Serveur</h1>
        <div className="loading-message">
          <p>🔄 Chargement des serveur...</p>
        </div>
      </div>
    )
  }

  const getMetricStatus = (value, thresholds) => {
    if (value >= thresholds.critical) return 'critical'
    if (value >= thresholds.warning) return 'warning'
    return 'normal'
  }

  return (
    <div className="home-wrap">
      <h1 className="page-title">Gestion des Serveur</h1>
      
      {/* Sélecteur de serveur */}
      <div className="server-selector mb-6">
        <label>Serveur sélectionné :</label>
        <select 
          value={selectedServer?.id || ''} 
          onChange={(e) => {
            const server = servers.find(s => s.id === parseInt(e.target.value))
            setSelectedServer(server)
            setSelectedNetworkCard(null)
          }}
          className="server-select"
        >
          {servers
            .slice()
            .sort((a, b) => a.name.localeCompare(b.name))
            .map(server => (
          <option key={server.id} value={server.id}>
            {server.status === 'down' ? '🔴 ' : '🟢 '}{server.name} - {server.ip || server.ip_address || 'N/A'}
            </option>
          ))}
        </select>
      </div>

      {selectedServer && (
        <>
          {/* Métriques principales */}
          <div className="metrics-grid mb-6">
            <div className="kpi-card">
              <div className="kpi-head">
                <span className="kpi-icon"><IconPower size={32} /></span>
                <div className="kpi-title">Alimentation</div>
                <div className="kpi-sub">Voltage et consommation</div>
              </div>
              <div className="kpi-body metrics-body">
                <div className="power-metrics">
                  <div className="power-item">
                    <span>Voltage:</span>
                    <span>{serverMetrics.power?.voltage || 0}V</span>
                  </div>
                  <div className="power-item">
                    <span>Courant:</span>
                    <span>{serverMetrics.power?.current || 0}A</span>
                  </div>
                  <div className="power-status">
                    Status: {serverMetrics.power?.status === 'normal' ? '🟢 Normal' : '🔴 Problème'}
                  </div>
                </div>
              </div>
            </div>

            <div className="kpi-card">
              <div className="kpi-head">
                <span className="kpi-icon"><IconCPU size={32} /></span>
                <div className="kpi-title">Processeur</div>
                <div className="kpi-sub">Utilisation et température</div>
              </div>
              <div className="kpi-body metrics-body">
                <MetricGauge
                  title="Utilisation CPU"
                  value={Math.round(serverMetrics.cpu?.usage || 0)}
                  max={100}
                  unit="%"
                  icon={IconCPU}
                  status={getMetricStatus(serverMetrics.cpu?.usage || 0, { warning: 70, critical: 90 })}
                />
                <div className="additional-metrics">
                  <div>Température: {Math.round(serverMetrics.cpu?.temperature || 0)}°C</div>
                  <div>Cœurs: {serverMetrics.cpu?.cores || 0}</div>
                </div>
              </div>
            </div>

            <div className="kpi-card">
              <div className="kpi-head">
                <span className="kpi-icon"><IconGPU size={32} /></span>
                <div className="kpi-title">GPU</div>
                <div className="kpi-sub">Utilisation et mémoire</div>
              </div>
              <div className="kpi-body metrics-body">
                <MetricGauge
                  title="Utilisation GPU"
                  value={Math.round(serverMetrics.gpu?.usage || 0)}
                  max={100}
                  unit="%"
                  icon={IconGPU}
                  status={getMetricStatus(serverMetrics.gpu?.usage || 0, { warning: 75, critical: 95 })}
                />
                <div className="additional-metrics">
                  <div>Température: {Math.round(serverMetrics.gpu?.temperature || 0)}°C</div>
                  <div>Mémoire: {serverMetrics.gpu?.memory || 0}MB</div>
                </div>
              </div>
            </div>

            <div className="kpi-card">
              <div className="kpi-head">
                <span className="kpi-icon"><IconBandwidth size={32} /></span>
                <div className="kpi-title">Bande Passante</div>
                <div className="kpi-sub">Utilisation réseau</div>
              </div>
              <div className="kpi-body metrics-body">
                <MetricGauge
                  title="Bande passante"
                  value={Math.round(serverMetrics.bandwidth?.current || 0)}
                  max={serverMetrics.bandwidth?.max || 1000}
                  unit="Mbps"
                  icon={IconBandwidth}
                  status={getMetricStatus(
                    (serverMetrics.bandwidth?.current || 0) / (serverMetrics.bandwidth?.max || 1000) * 100, 
                    { warning: 70, critical: 90 }
                  )}
                />
              </div>
            </div>
          </div>

          {/* Cartes réseau */}
          {serverMetrics.network_cards && serverMetrics.network_cards.length > 0 && (
            <div className="network-section">
              <h2 className="section-title">
                <IconNetwork size={28} />
                Cartes Réseau ({serverMetrics.network_cards.length})
              </h2>
              <div className="network-cards-grid">
                {serverMetrics.network_cards.map(card => (
                  <NetworkCard
                    key={card.id}
                    card={card}
                    onSelect={setSelectedNetworkCard}
                    isSelected={selectedNetworkCard?.id === card.id}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}