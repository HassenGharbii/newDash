import React from 'react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:4000'
const authHeader = () => ({ 'Authorization': `Bearer ${localStorage.getItem('token')||''}` })

const IconSwitch = ({size=28}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"
       style={{color:'#fff'}}>
    <circle cx="6" cy="18" r="2"/>
    <circle cx="12" cy="6" r="2"/>
    <circle cx="18" cy="18" r="2"/>
    <path d="M12 8v6M12 12h6M12 12H6"/>
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

const IconPort = ({size=24}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="7" width="20" height="10" rx="2"/>
    <line x1="6" y1="11" x2="6" y2="13"/>
    <line x1="10" y1="11" x2="10" y2="13"/>
    <line x1="14" y1="11" x2="14" y2="13"/>
    <line x1="18" y1="11" x2="18" y2="13"/>
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

// Composant pour un port de switch
function SwitchPort({ port, onSelect, isSelected }) {
  const getBandwidthColor = (usage) => {
    if (usage >= 90) return '#ef4444'
    if (usage >= 70) return '#f59e0b'
    return '#10b981'
  }

  return (
    <div 
      className={`switch-port ${isSelected ? 'selected' : ''} ${port.status === 'down' ? 'offline' : ''}`}
      onClick={() => onSelect(port)}
    >
      <div className="port-header">
        <IconPort size={16} />
        <span className="port-name">{port.name}</span>
        <span className={`port-status status-${port.status}`}>
          {port.status === 'up' ? '🟢' : '🔴'}
        </span>
      </div>
      <div className="port-details">
        <div className="detail">Speed: {port.speed || 'N/A'}</div>
        <div className="detail">Type: {port.type || 'N/A'}</div>
        <div className="detail">
          <span>Usage: </span>
          <span style={{ color: getBandwidthColor(port.bandwidth_usage || 0) }}>
            {port.bandwidth_usage || 0}%
          </span>
        </div>
      </div>
      <div className="port-bandwidth">
        <div className="bandwidth-bar">
          <div 
            className="bandwidth-fill" 
            style={{ 
              width: `${port.bandwidth_usage || 0}%`,
              backgroundColor: getBandwidthColor(port.bandwidth_usage || 0)
            }}
          />
        </div>
        <span className="bandwidth-text">
          {port.current_bandwidth || 0} / {port.max_bandwidth || 1000} Mbps
        </span>
      </div>
    </div>
  )
}

export default function Switches() {
  const [switches, setSwitches] = React.useState([])
  const [selectedSwitch, setSelectedSwitch] = React.useState(null)
  const [selectedPort, setSelectedPort] = React.useState(null)
  const [switchMetrics, setSwitchMetrics] = React.useState({})
  const [loading, setLoading] = React.useState(true)

  const fetchSwitches = React.useCallback(async () => {
    try {
      setLoading(true)
      
      const res = await fetch(`${API}/equipment?type=Switch`, { headers: authHeader() })
      
      if (res.status === 401) {
        console.warn('Non authentifié - token expiré ou manquant')
        setSwitches([])
        setLoading(false)
        return
      }
      
      if (res.ok) {
        const data = await res.json()
        
        // Trier les switches : équipements hors ligne en premier - Version restaurée
        const sortedData = data.sort((a, b) => {
          const aStatus = a.status === 'down' ? 0 : 1
          const bStatus = b.status === 'down' ? 0 : 1
          return aStatus - bStatus
        })
        
        setSwitches(sortedData)
        
        // Sélectionner le premier switch par défaut
        if (sortedData.length > 0 && !selectedSwitch) {
          setSelectedSwitch(sortedData[0])
        }
      } else {
        setSwitches([])
      }
      
    } catch (err) {
      console.error('Erreur lors du chargement des switches:', err)
      setSwitches([])
    } finally {
      setLoading(false)
    }
  }, [selectedSwitch])

  const fetchSwitchMetrics = React.useCallback(async (switchId) => {
    try {
      const res = await fetch(`${API}/metrics/switch/${switchId}`, { headers: authHeader() })
      
      if (res.ok) {
        const metrics = await res.json()
        setSwitchMetrics(metrics)
      } else {
        console.warn('API métriques non disponible pour switch:', switchId)
        setSwitchMetrics({})
      }
    } catch (err) {
      console.error('Erreur lors du chargement des métriques:', err)
      setSwitchMetrics({})
    }
  }, [])

  React.useEffect(() => {
    fetchSwitches()
  }, [fetchSwitches])

  React.useEffect(() => {
    if (selectedSwitch) {
      fetchSwitchMetrics(selectedSwitch.id)
      const interval = setInterval(() => fetchSwitchMetrics(selectedSwitch.id), 10000)
      return () => clearInterval(interval)
    }
  }, [selectedSwitch, fetchSwitchMetrics])

  if (loading) {
    return (
      <div className="home-wrap">
        <h1 className="page-title">Switches</h1>
        <div className="loading-message">
          <p>🔄 Chargement des switches...</p>
        </div>
      </div>
    )
  }

  const getMetricStatus = (value, thresholds) => {
    if (value >= thresholds.critical) return 'critical'
    if (value >= thresholds.warning) return 'warning'
    return 'normal'
  }

  const activePorts = switchMetrics.ports?.filter(port => port.status === 'up').length || 0
  const totalPorts = switchMetrics.ports?.length || 0

  return (
    <div className="home-wrap">
      <h1 className="page-title">Gestion des Switches</h1>
      
      {/* Sélecteur de switch */}
      <div className="server-selector mb-6">
        <label>Switch sélectionné :</label>
        <select 
          value={selectedSwitch?.id || ''} 
          onChange={(e) => {
            const switchItem = switches.find(s => s.id === parseInt(e.target.value))
            setSelectedSwitch(switchItem)
            setSelectedPort(null)
          }}
          className="server-select"
        >
          {switches
            .slice()
            .sort((a, b) => a.name.localeCompare(b.name))
            .map(switchItem => (
          <option key={switchItem.id} value={switchItem.id}>
            {switchItem.status === 'down' ? '🔴 ' : '🟢 '}{switchItem.name} - {switchItem.ip || switchItem.ip_address || 'N/A'}
            </option>
          ))}
        </select>
      </div>

      {selectedSwitch && (
        <>
          {/* Métriques principales */}
          <div className="metrics-grid mb-6">
            <div className="kpi-card">
              <div className="kpi-head">
                <span className="kpi-icon"><IconPower size={32} /></span>
                <div className="kpi-title">Alimentation</div>
                <div className="kpi-sub">Voltage PoE et consommation</div>
              </div>
              <div className="kpi-body metrics-body">
                <div className="power-metrics">
                  <div className="power-item">
                    <span>Voltage:</span>
                    <span>{switchMetrics.power?.voltage || 0}V</span>
                  </div>
                  <div className="power-item">
                    <span>Courant:</span>
                    <span>{switchMetrics.power?.current || 0}A</span>
                  </div>
                  <div className="power-status">
                    Status: {switchMetrics.power?.status === 'normal' ? '🟢 Normal' : '🔴 Problème'}
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
                  value={Math.round(switchMetrics.cpu?.usage || 0)}
                  max={100}
                  unit="%"
                  icon={IconCPU}
                  status={getMetricStatus(switchMetrics.cpu?.usage || 0, { warning: 70, critical: 90 })}
                />
                <div className="additional-metrics">
                  <div>Température: {Math.round(switchMetrics.cpu?.temperature || 0)}°C</div>
                </div>
              </div>
            </div>

            <div className="kpi-card">
              <div className="kpi-head">
                <span className="kpi-icon"><IconBandwidth size={32} /></span>
                <div className="kpi-title">Bande Passante</div>
                <div className="kpi-sub">Utilisation globale</div>
              </div>
              <div className="kpi-body metrics-body">
                <MetricGauge
                  title="Bande passante"
                  value={Math.round(switchMetrics.bandwidth?.current || 0)}
                  max={switchMetrics.bandwidth?.max || 1000}
                  unit="Mbps"
                  icon={IconBandwidth}
                  status={getMetricStatus(
                    (switchMetrics.bandwidth?.current || 0) / (switchMetrics.bandwidth?.max || 1000) * 100, 
                    { warning: 70, critical: 90 }
                  )}
                />
              </div>
            </div>

            <div className="kpi-card">
              <div className="kpi-head">
                <span className="kpi-icon"><IconPort size={32} /></span>
                <div className="kpi-title">État des Ports</div>
                <div className="kpi-sub">Ports actifs / Total</div>
              </div>
              <div className="kpi-body metrics-body">
                <div className="ports-summary">
                  <div className="ports-count">
                    <span className="active-ports">{activePorts}</span>
                    <span className="separator">/</span>
                    <span className="total-ports">{totalPorts}</span>
                  </div>
                  <div className="ports-label">Ports actifs</div>
                  <div className="ports-percentage">
                    {totalPorts > 0 ? Math.round((activePorts / totalPorts) * 100) : 0}%
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Ports du switch */}
          {switchMetrics.ports && (
            <div className="ports-section">
              <h2>Ports du Switch ({totalPorts} ports)</h2>
              <div className="ports-grid">
                {switchMetrics.ports.map(port => (
                  <SwitchPort
                    key={port.id}
                    port={port}
                    onSelect={setSelectedPort}
                    isSelected={selectedPort?.id === port.id}
                  />
                ))}
              </div>
              
              {selectedPort && (
                <div className="port-details-panel">
                  <h3>Détails du Port {selectedPort.name}</h3>
                  <div className="port-info-grid">
                    <div className="info-section">
                      <h4>État du Port</h4>
                      <div className="info-item">
                        <span>Statut:</span>
                        <span>{selectedPort.status === 'up' ? '🟢 Actif' : '🔴 Inactif'}</span>
                      </div>
                      <div className="info-item">
                        <span>Vitesse:</span>
                        <span>{selectedPort.speed}</span>
                      </div>
                      <div className="info-item">
                        <span>Type:</span>
                        <span>{selectedPort.type}</span>
                      </div>
                      <div className="info-item">
                        <span>Appareil connecté:</span>
                        <span>{selectedPort.connected_device || 'Aucun'}</span>
                      </div>
                    </div>
                    
                    <div className="info-section">
                      <h4>Bande Passante</h4>
                      <div className="info-item">
                        <span>Utilisation:</span>
                        <span>{selectedPort.bandwidth_usage}%</span>
                      </div>
                      <div className="info-item">
                        <span>Débit actuel:</span>
                        <span>{selectedPort.current_bandwidth} Mbps</span>
                      </div>
                      <div className="info-item">
                        <span>Débit maximum:</span>
                        <span>{selectedPort.max_bandwidth} Mbps</span>
                      </div>
                      <div className="bandwidth-chart">
                        <div className="chart-label">Utilisation en temps réel</div>
                        <div className="bandwidth-bar large">
                          <div 
                            className="bandwidth-fill" 
                            style={{ 
                              width: `${selectedPort.bandwidth_usage}%`,
                              backgroundColor: selectedPort.bandwidth_usage >= 90 ? '#ef4444' : 
                                             selectedPort.bandwidth_usage >= 70 ? '#f59e0b' : '#10b981'
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}