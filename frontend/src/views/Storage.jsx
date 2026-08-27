import React from 'react'
import Sparkline from '../components/Sparkline.jsx'

const API = import.meta.env.VITE_API_URL || 'http://localhost:4000'
const authHeader = () => ({ 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` })

const IconDisk = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <ellipse cx="12" cy="5" rx="9" ry="3" />
    <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
    <path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3" />
  </svg>
)

const IconShield = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
)

const IconController = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="6" width="20" height="12" rx="2" />
    <circle cx="12" cy="12" r="2" />
    <path d="M6 12h2M16 12h2" />
  </svg>
)

function GaugeBar({ value, label, color, showPct = true }) {
  const pct = Math.min(Math.max(value || 0, 0), 100)
  const barColor = pct >= 90 ? '#ef4444' : pct >= 75 ? '#f59e0b' : color || '#3b82f6'
  return (
    <div style={{ marginBottom: '10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '3px', color: '#6b7280' }}>
        <span>{label}</span>
        {showPct && <span style={{ fontWeight: '600', color: barColor }}>{pct.toFixed(0)}%</span>}
      </div>
      <div style={{ height: '8px', backgroundColor: '#e5e7eb', borderRadius: '4px', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, backgroundColor: barColor, borderRadius: '4px', transition: 'width 0.5s' }} />
      </div>
    </div>
  )
}

function HealthBadge({ health }) {
  const h = (health || '').toLowerCase()
  const ok = h === 'ok' || h === 'healthy' || h === 'good'
  const warn = h === 'warning' || h === 'degraded'
  const color = ok ? '#16a34a' : warn ? '#d97706' : '#dc2626'
  const bg = ok ? '#dcfce7' : warn ? '#fef3c7' : '#fee2e2'
  const label = ok ? '✓ OK' : warn ? '⚠ Dégradé' : '✕ Critique'
  return (
    <span style={{ padding: '3px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: '600', backgroundColor: bg, color }}>
      {label}
    </span>
  )
}

function DiskStats({ total, ok, failed, rebuilding }) {
  return (
    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
      {[
        { label: 'Opérationnels', count: ok || 0, color: '#16a34a', bg: '#dcfce7' },
        { label: 'En défaut', count: failed || 0, color: '#dc2626', bg: '#fee2e2' },
        { label: 'Reconstruction', count: rebuilding || 0, color: '#d97706', bg: '#fef3c7' },
        { label: 'Total', count: total || 0, color: '#374151', bg: '#f3f4f6' },
      ].map(s => (
        <div key={s.label} style={{
          flex: 1, minWidth: '70px', textAlign: 'center', padding: '10px 8px',
          backgroundColor: s.bg, borderRadius: '8px'
        }}>
          <div style={{ fontSize: '22px', fontWeight: '700', color: s.color }}>{s.count}</div>
          <div style={{ fontSize: '11px', color: '#6b7280' }}>{s.label}</div>
        </div>
      ))}
    </div>
  )
}

function StorageCard({ baie, onSelect, isSelected }) {
  const info = baie.info_json || {}
  const usedPct = info.capacity_used_pct || 0
  const isHealthy = (info.health || '').toLowerCase() === 'ok'

  return (
    <div
      onClick={() => onSelect(baie)}
      style={{
        background: 'white', border: `2px solid ${isSelected ? '#dc2626' : '#e5e7eb'}`,
        borderRadius: '12px', padding: '20px', cursor: 'pointer',
        transition: 'all 0.2s',
        boxShadow: isSelected ? '0 4px 12px rgba(220,38,38,0.15)' : '0 1px 3px rgba(0,0,0,0.08)'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
        <div>
          <div style={{ fontWeight: '700', fontSize: '15px', color: '#1f2937', marginBottom: '2px' }}>{baie.name}</div>
          <div style={{ fontSize: '12px', color: '#6b7280', fontFamily: 'monospace' }}>{baie.ip}</div>
          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>{baie.model || 'Seagate Exos X'}</div>
        </div>
        <HealthBadge health={info.health || (baie.ping_status === 'UP' ? 'OK' : 'Critical')} />
      </div>

      {/* Capacité */}
      <GaugeBar
        value={usedPct}
        label={`Capacité — ${info.capacity_used_tb?.toFixed(1) || 0} To / ${info.capacity_total_tb?.toFixed(1) || 0} To`}
        color="#3b82f6"
      />

      {/* Disques */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginTop: '10px', color: '#6b7280' }}>
        <span>
          <span style={{ color: '#16a34a', fontWeight: '600' }}>{info.disks_ok || 0}</span> / {info.disks_total || 0} disques OK
        </span>
        {info.disks_failed > 0 && (
          <span style={{ color: '#dc2626', fontWeight: '600' }}>⚠ {info.disks_failed} disque(s) en défaut</span>
        )}
        {info.controllers?.length > 0 && (
          <span>{info.controllers.length} contrôleur(s)</span>
        )}
      </div>
    </div>
  )
}

function HistorySection({ history }) {
  const capacityPct = history.map(h => h.capacity_used_pct).filter(v => v !== null && v !== undefined)
  const capacityTb = history.map(h => h.capacity_used_tb).filter(v => v !== null && v !== undefined)
  const failedDisks = history.map(h => h.disks_failed).filter(v => v !== null && v !== undefined)

  return (
    <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e5e7eb', marginBottom: '16px' }}>
      <div style={{ fontWeight: '600', color: '#374151', marginBottom: '12px' }}>Historique (24h)</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
        <div>
          <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '6px' }}>Capacité utilisée %</div>
          <Sparkline data={capacityPct} color="#3b82f6" suffix="%" />
        </div>
        <div>
          <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '6px' }}>Capacité utilisée (To)</div>
          <Sparkline data={capacityTb} color="#1d4ed8" />
        </div>
        <div>
          <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '6px' }}>Disques en défaut</div>
          <Sparkline data={failedDisks} color="#dc2626" />
        </div>
      </div>
    </div>
  )
}

function StorageDetail({ baie, history }) {
  const info = baie.info_json || {}
  const controllers = info.controllers || []
  const pools = info.pools || []
  const usedPct = info.capacity_used_pct || 0

  return (
    <div style={{ background: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#1f2937', margin: 0 }}>{baie.name}</h2>
          <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '2px' }}>
            {baie.ip} — {baie.model || 'Seagate Exos X 5U84'}
          </div>
          {info.serial_number && (
            <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>S/N : {info.serial_number}</div>
          )}
        </div>
        <HealthBadge health={info.health || (baie.ping_status === 'UP' ? 'OK' : 'Critical')} />
      </div>

      {/* Capacité */}
      <div style={{ padding: '16px', background: '#eff6ff', borderRadius: '10px', border: '1px solid #bfdbfe', marginBottom: '16px' }}>
        <div style={{ fontWeight: '600', color: '#1d4ed8', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <IconDisk size={16} /> Capacité de stockage
        </div>
        <GaugeBar value={usedPct} label={`Utilisé : ${info.capacity_used_tb?.toFixed(2) || 0} To sur ${info.capacity_total_tb?.toFixed(2) || 0} To`} color="#3b82f6" />
        <div style={{ display: 'flex', gap: '20px', fontSize: '12px', color: '#6b7280', marginTop: '8px' }}>
          <span>Libre : <b style={{ color: '#1d4ed8' }}>{info.capacity_free_tb?.toFixed(2) || 0} To</b></span>
          <span>Volumes : <b style={{ color: '#374151' }}>{info.volumes_count || 0}</b></span>
          <span>Snapshots : <b style={{ color: '#374151' }}>{info.snapshots_count || 0}</b></span>
        </div>
      </div>

      {/* Disques */}
      <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e5e7eb', marginBottom: '16px' }}>
        <div style={{ fontWeight: '600', color: '#374151', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <IconDisk size={16} /> Disques ({info.disks_total || 0} emplacements)
        </div>
        <DiskStats
          total={info.disks_total}
          ok={info.disks_ok}
          failed={info.disks_failed}
          rebuilding={info.disks_rebuilding}
        />
        {info.disks_failed > 0 && (
          <div style={{ marginTop: '10px', padding: '8px 12px', background: '#fee2e2', borderRadius: '6px', fontSize: '13px', color: '#dc2626', fontWeight: '500' }}>
            ⚠ Attention : {info.disks_failed} disque(s) en défaut — intervention requise
          </div>
        )}
        {info.disks_rebuilding > 0 && (
          <div style={{ marginTop: '8px', padding: '8px 12px', background: '#fef3c7', borderRadius: '6px', fontSize: '13px', color: '#92400e', fontWeight: '500' }}>
            🔄 {info.disks_rebuilding} disque(s) en reconstruction ADAPT
          </div>
        )}
      </div>

      {/* Historique */}
      <HistorySection history={history} />

      {/* Contrôleurs */}
      {controllers.length > 0 && (
        <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e5e7eb', marginBottom: '16px' }}>
          <div style={{ fontWeight: '600', color: '#374151', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <IconController size={16} /> Contrôleurs ({controllers.length})
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {controllers.map((ctrl, i) => {
              const ok = (ctrl.status || '').toLowerCase() === 'ok'
              return (
                <div key={i} style={{
                  flex: 1, minWidth: '120px', padding: '12px', borderRadius: '8px',
                  border: `1px solid ${ok ? '#bbf7d0' : '#fecaca'}`,
                  background: ok ? '#f0fdf4' : '#fff1f2'
                }}>
                  <div style={{ fontWeight: '600', fontSize: '13px', color: '#374151' }}>
                    {ctrl.name || `Contrôleur ${i + 1}`}
                  </div>
                  <div style={{ fontSize: '12px', color: ok ? '#16a34a' : '#dc2626', marginTop: '4px' }}>
                    {ok ? '● Actif' : '● Défaut'}
                  </div>
                  {ctrl.role && <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>{ctrl.role}</div>}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Pools de stockage */}
      {pools.length > 0 && (
        <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e5e7eb', marginBottom: '16px' }}>
          <div style={{ fontWeight: '600', color: '#374151', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <IconShield size={16} /> Pools RAID ({pools.length})
          </div>
          {pools.map((pool, i) => {
            const poolUsedPct = pool.capacity_gb > 0 ? ((pool.used_gb / pool.capacity_gb) * 100) : 0
            return (
              <div key={i} style={{ marginBottom: '10px', paddingBottom: '10px', borderBottom: i < pools.length - 1 ? '1px solid #e5e7eb' : 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
                  <span style={{ fontWeight: '500' }}>{pool.name} <span style={{ fontSize: '11px', color: '#9ca3af' }}>({pool.raid_level || 'ADAPT'})</span></span>
                  <span style={{ color: '#6b7280' }}>{pool.used_gb?.toFixed(0) || 0} / {pool.capacity_gb?.toFixed(0) || 0} GB</span>
                </div>
                <GaugeBar value={poolUsedPct} label="" color="#3b82f6" />
              </div>
            )
          })}
        </div>
      )}

      {/* Infos firmware / uptime */}
      <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: '#6b7280', flexWrap: 'wrap' }}>
        {info.firmware_version && <span>Firmware : <b style={{ color: '#374151' }}>{info.firmware_version}</b></span>}
        {info.uptime_hours > 0 && <span>Uptime : <b style={{ color: '#374151' }}>{(info.uptime_hours / 24).toFixed(0)} jours</b></span>}
        {baie.last_info_at && <span>Dernière collecte : <b style={{ color: '#374151' }}>{new Date(baie.last_info_at).toLocaleString('fr-FR')}</b></span>}
      </div>
    </div>
  )
}

export default function Storage() {
  const [baies, setBaies] = React.useState([])
  const [selected, setSelected] = React.useState(null)
  const [history, setHistory] = React.useState([])
  const [loading, setLoading] = React.useState(true)

  const fetchBaies = React.useCallback(async () => {
    try {
      const res = await fetch(`${API}/equipment?type=Stockage`, { headers: authHeader() })
      if (res.status === 401) { window.location.assign('/login'); return }
      if (res.ok) {
        const data = await res.json()
        setBaies(Array.isArray(data) ? data : [])
        if (!selected && data.length > 0) setSelected(data[0])
      }
    } catch (e) {
      console.error('Erreur chargement stockage:', e)
    } finally {
      setLoading(false)
    }
  }, [selected])

  React.useEffect(() => {
    fetchBaies()
    const id = setInterval(fetchBaies, 60000)
    return () => clearInterval(id)
  }, [fetchBaies])

  React.useEffect(() => {
    if (!selected) { setHistory([]); return }
    let cancelled = false
    fetch(`${API}/metrics/storage/${selected.id}/history?hours=24`, { headers: authHeader() })
      .then(res => res.ok ? res.json() : [])
      .then(data => { if (!cancelled) setHistory(Array.isArray(data) ? data : []) })
      .catch(() => { if (!cancelled) setHistory([]) })
    return () => { cancelled = true }
  }, [selected?.id])

  const totalCapacity = baies.reduce((a, b) => a + (b.info_json?.capacity_total_tb || 0), 0)
  const usedCapacity = baies.reduce((a, b) => a + (b.info_json?.capacity_used_tb || 0), 0)
  const baiesOk = baies.filter(b => (b.info_json?.health || '').toLowerCase() === 'ok' || b.ping_status === 'UP').length
  const disksFailed = baies.reduce((a, b) => a + (b.info_json?.disks_failed || 0), 0)

  if (loading) {
    return (
      <div className="home-wrap">
        <h1 className="page-title">Stockage — Baies Seagate</h1>
        <div className="loading-message"><p>🔄 Chargement des baies de stockage...</p></div>
      </div>
    )
  }

  if (baies.length === 0) {
    return (
      <div className="home-wrap">
        <h1 className="page-title">Stockage — Baies Seagate</h1>
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#6b7280' }}>
          <IconDisk size={64} />
          <p style={{ fontSize: '18px', marginTop: '16px', fontWeight: '600' }}>Aucune baie de stockage configurée</p>
          <p style={{ fontSize: '14px', marginTop: '8px' }}>
            Ajoutez les baies Seagate via l'onglet Équipements (type : Stockage)<br />
            ou via le script <code>CollectStorageInfo.ps1</code>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="home-wrap">
      <h1 className="page-title">Stockage — Baies Seagate Exos X</h1>

      {/* KPIs globaux */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
        {[
          { label: 'Baies opérationnelles', value: `${baiesOk} / ${baies.length}`, sub: 'En ligne', color: baiesOk < baies.length ? '#dc2626' : '#16a34a' },
          { label: 'Capacité totale', value: `${totalCapacity.toFixed(1)} To`, sub: `${usedCapacity.toFixed(1)} To utilisé`, color: '#2563eb' },
          { label: 'Taux d\'occupation', value: `${totalCapacity > 0 ? ((usedCapacity / totalCapacity) * 100).toFixed(0) : 0}%`, sub: `${(totalCapacity - usedCapacity).toFixed(1)} To libre`, color: (usedCapacity / totalCapacity) > 0.85 ? '#dc2626' : '#374151' },
          ...(disksFailed > 0 ? [{ label: 'Disques en défaut', value: disksFailed, sub: 'Intervention requise', color: '#dc2626' }] : []),
        ].map(k => (
          <div key={k.label} style={{
            flex: 1, minWidth: '150px', background: 'white', borderRadius: '12px',
            padding: '16px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            border: k.color === '#dc2626' ? '1px solid #fecaca' : '1px solid #e5e7eb'
          }}>
            <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '4px' }}>{k.label}</div>
            <div style={{ fontSize: '26px', fontWeight: '700', color: k.color }}>{k.value}</div>
            <div style={{ fontSize: '12px', color: '#6b7280' }}>{k.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 360px) 1fr', gap: '20px', alignItems: 'start' }}>
        {/* Liste des baies */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {baies.map(b => (
            <StorageCard
              key={b.id}
              baie={{ ...b, info_json: b.info_json || {} }}
              onSelect={setSelected}
              isSelected={selected?.id === b.id}
            />
          ))}
        </div>

        {/* Détail baie sélectionnée */}
        {selected && (
          <StorageDetail baie={{ ...selected, info_json: selected.info_json || {} }} history={history} />
        )}
      </div>
    </div>
  )
}
