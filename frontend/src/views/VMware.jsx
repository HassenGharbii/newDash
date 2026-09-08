import React from 'react'
import Sparkline from '../components/Sparkline.jsx'

const API = import.meta.env.VITE_API_URL || 'http://localhost:4000'
const authHeader = () => ({ 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` })

const IconVM = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="14" rx="2" />
    <path d="M8 21h8M12 17v4" />
    <path d="M7 8h10M7 11h6" />
  </svg>
)

const IconCPU = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="4" width="16" height="16" rx="2" /><rect x="9" y="9" width="6" height="6" />
    <line x1="9" y1="1" x2="9" y2="4" /><line x1="15" y1="1" x2="15" y2="4" />
    <line x1="9" y1="20" x2="9" y2="23" /><line x1="15" y1="20" x2="15" y2="23" />
    <line x1="20" y1="9" x2="23" y2="9" /><line x1="20" y1="14" x2="23" y2="14" />
    <line x1="1" y1="9" x2="4" y2="9" /><line x1="1" y1="14" x2="4" y2="14" />
  </svg>
)

const IconMemory = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="7" width="20" height="10" rx="1" />
    <path d="M7 7V5M12 7V5M17 7V5M7 17v2M12 17v2M17 17v2" />
  </svg>
)

const IconStorage = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <ellipse cx="12" cy="5" rx="9" ry="3" />
    <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
    <path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3" />
  </svg>
)

function GaugeBar({ value, label, color }) {
  const pct = Math.min(Math.max(value || 0, 0), 100)
  const barColor = pct >= 90 ? '#ef4444' : pct >= 70 ? '#f59e0b' : color || '#10b981'
  return (
    <div style={{ marginBottom: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '3px', color: '#6b7280' }}>
        <span>{label}</span>
        <span style={{ fontWeight: '600', color: barColor }}>{pct.toFixed(0)}%</span>
      </div>
      <div style={{ height: '6px', backgroundColor: '#e5e7eb', borderRadius: '3px', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, backgroundColor: barColor, borderRadius: '3px', transition: 'width 0.5s' }} />
      </div>
    </div>
  )
}

function StatusBadge({ status }) {
  const isUp = (status || '').toUpperCase() === 'UP'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '5px',
      padding: '3px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: '600',
      backgroundColor: isUp ? '#dcfce7' : '#fee2e2',
      color: isUp ? '#16a34a' : '#dc2626'
    }}>
      <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: isUp ? '#16a34a' : '#dc2626', display: 'inline-block' }} />
      {isUp ? 'En ligne' : 'Hors ligne'}
    </span>
  )
}

function HyperviseurCard({ host, onSelect, isSelected }) {
  const info = host.info_json || {}
  const vmRunning = info.vm_running || 0
  const vmTotal = info.vm_total || 0

  return (
    <div
      onClick={() => onSelect(host)}
      style={{
        background: 'white', border: `2px solid ${isSelected ? '#dc2626' : '#e5e7eb'}`,
        borderRadius: '12px', padding: '20px', cursor: 'pointer',
        transition: 'all 0.2s', boxShadow: isSelected ? '0 4px 12px rgba(220,38,38,0.15)' : '0 1px 3px rgba(0,0,0,0.08)'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
        <div>
          <div style={{ fontWeight: '700', fontSize: '15px', color: '#1f2937', marginBottom: '2px' }}>{host.name}</div>
          <div style={{ fontSize: '12px', color: '#6b7280', fontFamily: 'monospace' }}>{host.ip}</div>
          {info.esxi_version && (
            <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>ESXi {info.esxi_version}</div>
          )}
          {info.connection_name && (
            <div style={{ fontSize: '11px', color: '#2563eb', marginTop: '2px' }}>{info.connection_name}</div>
          )}
        </div>
        <StatusBadge status={host.ping_status} />
      </div>

      <GaugeBar value={info.cpu_usage_pct} label={`CPU — ${info.cpu_cores_total || '?'} cœurs`} />
      <GaugeBar value={info.memory_usage_pct} label={`RAM — ${info.memory_total_gb || '?'} GB`} />

      <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
        <div style={{ flex: 1, textAlign: 'center', padding: '8px', backgroundColor: '#f0fdf4', borderRadius: '8px' }}>
          <div style={{ fontSize: '20px', fontWeight: '700', color: '#16a34a' }}>{vmRunning}</div>
          <div style={{ fontSize: '11px', color: '#6b7280' }}>VMs actives</div>
        </div>
        <div style={{ flex: 1, textAlign: 'center', padding: '8px', backgroundColor: '#fef2f2', borderRadius: '8px' }}>
          <div style={{ fontSize: '20px', fontWeight: '700', color: '#dc2626' }}>{info.vm_stopped || 0}</div>
          <div style={{ fontSize: '11px', color: '#6b7280' }}>VMs arrêtées</div>
        </div>
        <div style={{ flex: 1, textAlign: 'center', padding: '8px', backgroundColor: '#f8fafc', borderRadius: '8px' }}>
          <div style={{ fontSize: '20px', fontWeight: '700', color: '#374151' }}>{vmTotal}</div>
          <div style={{ fontSize: '11px', color: '#6b7280' }}>Total VMs</div>
        </div>
      </div>
    </div>
  )
}

function HistorySection({ history }) {
  const cpu = history.map(h => h.cpu_usage_pct).filter(v => v !== null && v !== undefined)
  const ram = history.map(h => h.memory_usage_pct).filter(v => v !== null && v !== undefined)
  const vms = history.map(h => h.vm_total).filter(v => v !== null && v !== undefined)

  return (
    <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e5e7eb', marginBottom: '16px' }}>
      <div style={{ fontWeight: '600', color: '#374151', marginBottom: '12px' }}>Historique (24h)</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
        <div>
          <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '6px' }}>CPU %</div>
          <Sparkline data={cpu} color="#ef4444" suffix="%" />
        </div>
        <div>
          <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '6px' }}>RAM %</div>
          <Sparkline data={ram} color="#f59e0b" suffix="%" />
        </div>
        <div>
          <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '6px' }}>VMs</div>
          <Sparkline data={vms} color="#2563eb" />
        </div>
      </div>
    </div>
  )
}

function VmPowerBadge({ state }) {
  const s = (state || '').toLowerCase()
  const isOn = s === 'poweredon'
  const isSuspended = s === 'suspended'
  const color = isOn ? '#16a34a' : isSuspended ? '#d97706' : '#dc2626'
  const bg = isOn ? '#dcfce7' : isSuspended ? '#fef3c7' : '#fee2e2'
  const label = isOn ? 'En cours' : isSuspended ? 'Suspendue' : 'Arrêtée'
  return (
    <span style={{ padding: '2px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: '600', backgroundColor: bg, color }}>
      {label}
    </span>
  )
}

function HyperviseurDetail({ host, history }) {
  const info = host.info_json || {}
  const datastores = info.datastores || []
  const vms = info.vms || []

  return (
    <div style={{ background: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#1f2937', margin: 0 }}>{host.name}</h2>
          <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '2px' }}>{host.ip} — {host.model || 'VMware ESXi'}</div>
        </div>
        <StatusBadge status={host.ping_status} />
      </div>

      {/* Métriques CPU / RAM */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
        <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e5e7eb' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', color: '#374151', fontWeight: '600' }}>
            <IconCPU size={18} /> Processeur
          </div>
          <GaugeBar value={info.cpu_usage_pct} label="Utilisation" />
          <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '6px' }}>
            {info.cpu_sockets || 1} socket(s) · {info.cpu_cores_total || '?'} cœurs · {info.cpu_mhz ? `${(info.cpu_mhz / 1000).toFixed(1)} GHz` : ''}
          </div>
        </div>

        <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e5e7eb' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', color: '#374151', fontWeight: '600' }}>
            <IconMemory size={18} /> Mémoire RAM
          </div>
          <GaugeBar value={info.memory_usage_pct} label="Utilisation" />
          <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '6px' }}>
            {info.memory_used_gb?.toFixed(1) || '0'} GB utilisé / {info.memory_total_gb?.toFixed(0) || '?'} GB total
          </div>
        </div>
      </div>

      {/* Machines virtuelles */}
      <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e5e7eb', marginBottom: '20px' }}>
        <div style={{ fontWeight: '600', color: '#374151', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <IconVM size={18} /> Machines Virtuelles ({info.vm_total || 0})
        </div>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {[
            { label: 'En cours', count: info.vm_running || 0, color: '#16a34a', bg: '#dcfce7' },
            { label: 'Arrêtées', count: info.vm_stopped || 0, color: '#dc2626', bg: '#fee2e2' },
            { label: 'Suspendues', count: info.vm_suspended || 0, color: '#d97706', bg: '#fef3c7' },
          ].map(s => (
            <div key={s.label} style={{ flex: 1, minWidth: '80px', textAlign: 'center', padding: '10px', backgroundColor: s.bg, borderRadius: '8px' }}>
              <div style={{ fontSize: '22px', fontWeight: '700', color: s.color }}>{s.count}</div>
              <div style={{ fontSize: '11px', color: '#6b7280' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {vms.length > 0 && (
          <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {vms.map((vm, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px 10px', background: 'white', borderRadius: '6px', border: '1px solid #e5e7eb', fontSize: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                  <VmPowerBadge state={vm.power_state} />
                  <span style={{ fontWeight: '600', color: '#1f2937', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{vm.name}</span>
                </div>
                <div style={{ display: 'flex', gap: '14px', color: '#6b7280', flexShrink: 0 }}>
                  {vm.ip_address && <span style={{ fontFamily: 'monospace' }}>{vm.ip_address}</span>}
                  {vm.guest_os && <span>{vm.guest_os}</span>}
                  <span>{vm.cpu_count || '?'} vCPU</span>
                  <span>{vm.memory_gb ? `${vm.memory_gb} GB` : '?'}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Historique */}
      <HistorySection history={history} />

      {/* Datastores */}
      {datastores.length > 0 && (
        <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e5e7eb', marginBottom: '16px' }}>
          <div style={{ fontWeight: '600', color: '#374151', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <IconStorage size={18} /> Datastores ({datastores.length})
          </div>
          {datastores.map((ds, i) => {
            const usedPct = ds.capacity_gb > 0 ? ((ds.used_gb / ds.capacity_gb) * 100) : 0
            return (
              <div key={i} style={{ marginBottom: '10px', paddingBottom: '10px', borderBottom: i < datastores.length - 1 ? '1px solid #e5e7eb' : 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
                  <span style={{ fontWeight: '500', color: '#374151' }}>{ds.name}</span>
                  <span style={{ color: '#6b7280' }}>{ds.used_gb?.toFixed(0) || 0} / {ds.capacity_gb?.toFixed(0) || 0} GB</span>
                </div>
                <GaugeBar value={usedPct} label="" />
              </div>
            )
          })}
        </div>
      )}

      {/* Uptime et version */}
      <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: '#6b7280', flexWrap: 'wrap' }}>
        {info.esxi_version && <span>Version ESXi : <b style={{ color: '#374151' }}>{info.esxi_version}</b></span>}
        {info.uptime_days > 0 && <span>Uptime : <b style={{ color: '#374151' }}>{info.uptime_days} jours</b></span>}
        {host.last_info_at && <span>Dernière collecte : <b style={{ color: '#374151' }}>{new Date(host.last_info_at).toLocaleString('fr-FR')}</b></span>}
      </div>
    </div>
  )
}

export default function VMware() {
  const [hosts, setHosts] = React.useState([])
  const [selected, setSelected] = React.useState(null)
  const [history, setHistory] = React.useState([])
  const [loading, setLoading] = React.useState(true)
  const [connectionFilter, setConnectionFilter] = React.useState('')

  const fetchHosts = React.useCallback(async () => {
    try {
      const res = await fetch(`${API}/equipment?type=Hyperviseur`, { headers: authHeader() })
      if (res.status === 401) { window.location.assign('/login'); return }
      if (res.ok) {
        const data = await res.json()
        setHosts(Array.isArray(data) ? data : [])
        if (!selected && data.length > 0) setSelected(data[0])
      }
    } catch (e) {
      console.error('Erreur chargement hyperviseurs:', e)
    } finally {
      setLoading(false)
    }
  }, [selected])

  React.useEffect(() => {
    fetchHosts()
    const id = setInterval(fetchHosts, 30000)
    return () => clearInterval(id)
  }, [fetchHosts])

  React.useEffect(() => {
    if (!selected) { setHistory([]); return }
    let cancelled = false
    fetch(`${API}/metrics/hyperviseur/${selected.id}/history?hours=24`, { headers: authHeader() })
      .then(res => res.ok ? res.json() : [])
      .then(data => { if (!cancelled) setHistory(Array.isArray(data) ? data : []) })
      .catch(() => { if (!cancelled) setHistory([]) })
    return () => { cancelled = true }
  }, [selected?.id])

  const connectionNames = [...new Set(hosts.map(h => h.info_json?.connection_name).filter(Boolean))]
  const visibleHosts = connectionFilter ? hosts.filter(h => h.info_json?.connection_name === connectionFilter) : hosts

  const totalVMs = visibleHosts.reduce((acc, h) => acc + (h.info_json?.vm_total || 0), 0)
  const runningVMs = visibleHosts.reduce((acc, h) => acc + (h.info_json?.vm_running || 0), 0)
  const hostsUp = visibleHosts.filter(h => h.ping_status === 'UP').length

  if (loading) {
    return (
      <div className="home-wrap">
        <h1 className="page-title">VMware — Hyperviseurs</h1>
        <div className="loading-message"><p>🔄 Chargement des hyperviseurs...</p></div>
      </div>
    )
  }

  if (hosts.length === 0) {
    return (
      <div className="home-wrap">
        <h1 className="page-title">VMware — Hyperviseurs</h1>
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#6b7280' }}>
          <IconVM size={64} />
          <p style={{ fontSize: '18px', marginTop: '16px', fontWeight: '600' }}>Aucun hyperviseur configuré</p>
          <p style={{ fontSize: '14px', marginTop: '8px' }}>
            Ajoutez des ESXi hosts via l'onglet Équipements (type : Hyperviseur)<br />
            ou via le script <code>CollectHyperviseurInfo.ps1</code>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="home-wrap">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <h1 className="page-title">VMware — Hyperviseurs ESXi</h1>
        {connectionNames.length > 1 && (
          <select
            value={connectionFilter}
            onChange={e => setConnectionFilter(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '13px', background: 'white' }}
          >
            <option value="">Toutes les connexions</option>
            {connectionNames.map(name => <option key={name} value={name}>{name}</option>)}
          </select>
        )}
      </div>

      {/* KPIs globaux */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
        {[
          { label: 'Hosts ESXi', value: `${hostsUp} / ${hosts.length}`, sub: 'En ligne', color: hostsUp < hosts.length ? '#dc2626' : '#16a34a' },
          { label: 'VMs actives', value: runningVMs, sub: `sur ${totalVMs} total`, color: '#2563eb' },
          { label: 'VMs arrêtées', value: totalVMs - runningVMs, sub: 'sur tous les hosts', color: '#6b7280' },
        ].map(k => (
          <div key={k.label} style={{
            flex: 1, minWidth: '160px', background: 'white', borderRadius: '12px',
            padding: '16px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', border: '1px solid #e5e7eb'
          }}>
            <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '4px' }}>{k.label}</div>
            <div style={{ fontSize: '28px', fontWeight: '700', color: k.color }}>{k.value}</div>
            <div style={{ fontSize: '12px', color: '#6b7280' }}>{k.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 380px) 1fr', gap: '20px', alignItems: 'start' }}>
        {/* Liste des hosts */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {visibleHosts.map(h => (
            <HyperviseurCard
              key={h.id}
              host={{ ...h, info_json: h.info_json || {} }}
              onSelect={setSelected}
              isSelected={selected?.id === h.id}
            />
          ))}
        </div>

        {/* Détail du host sélectionné */}
        {selected && (
          <HyperviseurDetail host={{ ...selected, info_json: selected.info_json || {} }} history={history} />
        )}
      </div>
    </div>
  )
}
