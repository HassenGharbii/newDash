import React from 'react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:4000'
const authHeader = () => ({ 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` })

// Définition des sites PCA/PRA — à adapter selon votre configuration réelle
// Ces données sont enrichies avec les serveurs remontés par le monitoring
const SITES_CONFIG = [
  {
    id: 'pca1',
    label: 'PCA Site 1',
    type: 'PCA',
    description: 'Plan de Continuité d\'Activité — Site principal',
    color: '#2563eb',
    bgColor: '#eff6ff',
    borderColor: '#bfdbfe',
    // Filtrer les serveurs dont le nom ou la localisation contient ce tag
    tag: 'PCA1',
  },
  {
    id: 'pca2',
    label: 'PCA Site 2',
    type: 'PCA',
    description: 'Plan de Continuité d\'Activité — Site secondaire',
    color: '#7c3aed',
    bgColor: '#f5f3ff',
    borderColor: '#ddd6fe',
    tag: 'PCA2',
  },
  {
    id: 'pra',
    label: 'PRA',
    type: 'PRA',
    description: 'Plan de Reprise d\'Activité — Site de secours',
    color: '#d97706',
    bgColor: '#fffbeb',
    borderColor: '#fde68a',
    tag: 'PRA',
  },
]

const IconSite = ({ size = 24, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
)

const IconServer = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="4" width="16" height="6" rx="2" />
    <rect x="4" y="14" width="16" height="6" rx="2" />
    <path d="M7 7h.01M10 7h.01M7 17h.01M10 17h.01" />
  </svg>
)

const IconLink = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
)

const IconVM = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="14" rx="2" />
    <path d="M8 21h8M12 17v4" />
  </svg>
)

function StatusDot({ status }) {
  const isUp = (status || '').toUpperCase() === 'UP'
  return (
    <span style={{
      display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%',
      backgroundColor: isUp ? '#16a34a' : '#dc2626',
      boxShadow: isUp ? '0 0 0 3px rgba(22,163,74,0.2)' : '0 0 0 3px rgba(220,38,38,0.2)'
    }} />
  )
}

function SiteCard({ site, servers, hyperviseurs }) {
  const siteServers = servers.filter(s => {
    const loc = (s.location || '').toUpperCase()
    const name = (s.name || '').toUpperCase()
    return loc.includes(site.tag) || name.includes(site.tag)
  })

  const siteHyperviseurs = hyperviseurs.filter(h => {
    const loc = (h.location || '').toUpperCase()
    const name = (h.name || '').toUpperCase()
    return loc.includes(site.tag) || name.includes(site.tag)
  })

  const allEquip = [...siteServers, ...siteHyperviseurs]
  const upCount = allEquip.filter(e => e.ping_status === 'UP').length
  const totalCount = allEquip.length
  const vmRunning = siteHyperviseurs.reduce((a, h) => a + (h.info_json?.vm_running || 0), 0)
  const vmTotal = siteHyperviseurs.reduce((a, h) => a + (h.info_json?.vm_total || 0), 0)

  const siteStatus = totalCount === 0 ? 'unknown' : upCount === totalCount ? 'ok' : upCount === 0 ? 'critical' : 'degraded'
  const statusLabel = { ok: '✓ Opérationnel', critical: '✕ Hors ligne', degraded: '⚠ Dégradé', unknown: '? Non configuré' }
  const statusColor = { ok: '#16a34a', critical: '#dc2626', degraded: '#d97706', unknown: '#6b7280' }

  return (
    <div style={{
      background: site.bgColor, borderRadius: '16px', padding: '24px',
      border: `2px solid ${site.borderColor}`, position: 'relative', overflow: 'hidden'
    }}>
      {/* Badge type */}
      <div style={{
        position: 'absolute', top: '16px', right: '16px',
        padding: '3px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: '700',
        backgroundColor: site.color, color: 'white', letterSpacing: '0.5px'
      }}>
        {site.type}
      </div>

      {/* En-tête */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
        <div style={{ padding: '10px', borderRadius: '10px', backgroundColor: site.color, color: 'white' }}>
          <IconSite size={24} color="white" />
        </div>
        <div>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#1f2937' }}>{site.label}</h3>
          <p style={{ margin: 0, fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>{site.description}</p>
        </div>
      </div>

      {/* Statut global */}
      <div style={{
        padding: '10px 14px', borderRadius: '8px', marginBottom: '16px',
        backgroundColor: 'white', border: '1px solid rgba(0,0,0,0.06)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
      }}>
        <span style={{ fontSize: '14px', fontWeight: '600', color: statusColor[siteStatus] }}>
          {statusLabel[siteStatus]}
        </span>
        {totalCount > 0 && (
          <span style={{ fontSize: '13px', color: '#6b7280' }}>
            {upCount} / {totalCount} équipements opérationnels
          </span>
        )}
      </div>

      {/* VMs */}
      {vmTotal > 0 && (
        <div style={{
          padding: '10px 14px', borderRadius: '8px', marginBottom: '12px',
          backgroundColor: 'white', border: '1px solid rgba(0,0,0,0.06)',
          display: 'flex', alignItems: 'center', gap: '8px'
        }}>
          <IconVM size={16} />
          <span style={{ fontSize: '13px', color: '#374151' }}>
            <b style={{ color: '#16a34a' }}>{vmRunning}</b> VMs actives / <b>{vmTotal}</b> total
          </span>
        </div>
      )}

      {/* Liste équipements */}
      {allEquip.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '20px', color: '#9ca3af', fontSize: '13px' }}>
          <p>Aucun équipement associé à ce site.</p>
          <p style={{ fontSize: '12px' }}>
            Renseignez "<b>{site.tag}</b>" dans le champ Localisation<br />
            de vos serveurs ou hyperviseurs.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {allEquip.slice(0, 8).map(eq => (
            <div key={eq.id} style={{
              display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px',
              backgroundColor: 'white', borderRadius: '6px', border: '1px solid rgba(0,0,0,0.05)'
            }}>
              <StatusDot status={eq.ping_status} />
              <span style={{ flex: 1, fontSize: '13px', fontWeight: '500', color: '#374151' }}>{eq.name}</span>
              <span style={{ fontSize: '11px', color: '#9ca3af', fontFamily: 'monospace' }}>{eq.ip}</span>
              <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', backgroundColor: '#f3f4f6', color: '#6b7280' }}>
                {eq.type === 'Hyperviseur' ? 'ESXi' : 'VM'}
              </span>
            </div>
          ))}
          {allEquip.length > 8 && (
            <div style={{ textAlign: 'center', fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>
              +{allEquip.length - 8} autres équipements
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ReplicationStatus({ sites, servers }) {
  const hasPca1 = sites[0]
  const hasPca2 = sites[1]
  const hasPra = sites[2]

  const links = [
    { from: 'PCA Site 1', to: 'PCA Site 2', type: 'Active-Active', color: '#2563eb' },
    { from: 'PCA Site 1', to: 'PRA', type: 'Réplication async', color: '#d97706' },
    { from: 'PCA Site 2', to: 'PRA', type: 'Réplication async', color: '#d97706' },
  ]

  return (
    <div style={{
      background: 'white', borderRadius: '12px', padding: '20px',
      border: '1px solid #e5e7eb', marginBottom: '24px'
    }}>
      <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: '700', color: '#1f2937', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <IconLink size={18} /> Architecture PCA / PRA
      </h3>

      {/* Schéma visuel simplifié */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0', flexWrap: 'wrap', padding: '10px 0' }}>
        {SITES_CONFIG.map((site, i) => (
          <React.Fragment key={site.id}>
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: '90px', height: '90px', borderRadius: '12px',
                backgroundColor: site.bgColor, border: `2px solid ${site.color}`,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: '4px'
              }}>
                <IconSite size={28} color={site.color} />
                <span style={{ fontSize: '10px', fontWeight: '700', color: site.color }}>{site.type}</span>
              </div>
              <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '6px', maxWidth: '90px' }}>{site.label}</div>
            </div>
            {i < SITES_CONFIG.length - 1 && (
              <div style={{ display: 'flex', alignItems: 'center', padding: '0 8px' }}>
                <div style={{ height: '2px', width: '50px', backgroundColor: '#d1d5db', position: 'relative' }}>
                  <div style={{
                    position: 'absolute', top: '-8px', left: '50%', transform: 'translateX(-50%)',
                    fontSize: '9px', color: '#9ca3af', whiteSpace: 'nowrap', backgroundColor: 'white', padding: '0 4px'
                  }}>
                    {i === 0 ? 'Active-Active' : 'Async'}
                  </div>
                </div>
                <span style={{ fontSize: '16px', color: '#d1d5db' }}>→</span>
              </div>
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Légende */}
      <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', marginTop: '12px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#6b7280' }}>
          <div style={{ width: '20px', height: '2px', backgroundColor: '#2563eb' }} /> Active-Active (PCA)
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#6b7280' }}>
          <div style={{ width: '20px', height: '2px', backgroundColor: '#d97706', borderTop: '2px dashed #d97706' }} /> Réplication async (PRA)
        </div>
      </div>
    </div>
  )
}

export default function SafeKit() {
  const [servers, setServers] = React.useState([])
  const [hyperviseurs, setHyperviseurs] = React.useState([])
  const [loading, setLoading] = React.useState(true)
  const [lastRefresh, setLastRefresh] = React.useState(null)

  const fetchData = React.useCallback(async () => {
    try {
      const [srvRes, hypRes] = await Promise.all([
        fetch(`${API}/equipment?type=Server`, { headers: authHeader() }),
        fetch(`${API}/equipment?type=Hyperviseur`, { headers: authHeader() }),
      ])

      if (srvRes.status === 401) { window.location.assign('/login'); return }

      const srvData = srvRes.ok ? await srvRes.json() : []
      const hypData = hypRes.ok ? await hypRes.json() : []

      setServers(Array.isArray(srvData) ? srvData : [])
      setHyperviseurs(Array.isArray(hypData) ? hypData : [])
      setLastRefresh(new Date())
    } catch (e) {
      console.error('Erreur chargement PCA/PRA:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    fetchData()
    const id = setInterval(fetchData, 30000)
    return () => clearInterval(id)
  }, [fetchData])

  const allEquip = [...servers, ...hyperviseurs]
  const upTotal = allEquip.filter(e => e.ping_status === 'UP').length

  if (loading) {
    return (
      <div className="home-wrap">
        <h1 className="page-title">PCA / PRA — Continuité et Reprise d'Activité</h1>
        <div className="loading-message"><p>🔄 Chargement...</p></div>
      </div>
    )
  }

  return (
    <div className="home-wrap">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
        <h1 className="page-title" style={{ margin: 0 }}>PCA / PRA — Continuité et Reprise d'Activité</h1>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          {lastRefresh && (
            <span style={{ fontSize: '12px', color: '#9ca3af' }}>
              Actualisé à {lastRefresh.toLocaleTimeString('fr-FR')}
            </span>
          )}
          <button
            onClick={fetchData}
            style={{
              padding: '6px 14px', borderRadius: '6px', border: '1px solid #e5e7eb',
              background: 'white', fontSize: '13px', cursor: 'pointer', color: '#374151'
            }}
          >
            🔄 Actualiser
          </button>
        </div>
      </div>

      {/* Vue d'ensemble */}
      <div style={{ display: 'flex', gap: '14px', marginBottom: '24px', flexWrap: 'wrap' }}>
        {[
          { label: 'Équipements en ligne', value: `${upTotal} / ${allEquip.length}`, color: upTotal < allEquip.length ? '#dc2626' : '#16a34a' },
          { label: 'Sites PCA', value: 2, sub: 'Active-Active', color: '#2563eb' },
          { label: 'Site PRA', value: 1, sub: 'Secours', color: '#d97706' },
          { label: 'Hyperviseurs ESXi', value: hyperviseurs.length, sub: `${hyperviseurs.filter(h => h.ping_status === 'UP').length} en ligne`, color: '#374151' },
        ].map(k => (
          <div key={k.label} style={{
            flex: 1, minWidth: '140px', background: 'white', borderRadius: '10px',
            padding: '14px 18px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', border: '1px solid #e5e7eb'
          }}>
            <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '3px' }}>{k.label}</div>
            <div style={{ fontSize: '26px', fontWeight: '700', color: k.color }}>{k.value}</div>
            {k.sub && <div style={{ fontSize: '11px', color: '#6b7280' }}>{k.sub}</div>}
          </div>
        ))}
      </div>

      {/* Schéma d'architecture */}
      <ReplicationStatus sites={SITES_CONFIG} servers={allEquip} />

      {/* Note de configuration */}
      {allEquip.length > 0 && servers.filter(s => !SITES_CONFIG.some(site => (s.location || '').toUpperCase().includes(site.tag))).length > 0 && (
        <div style={{
          padding: '12px 16px', background: '#fffbeb', borderRadius: '8px',
          border: '1px solid #fde68a', marginBottom: '20px', fontSize: '13px', color: '#92400e'
        }}>
          💡 <b>Astuce :</b> Pour associer un serveur ou hyperviseur à un site, renseignez <b>PCA1</b>, <b>PCA2</b> ou <b>PRA</b>
          dans le champ <b>Localisation</b> de l'équipement (via la page Équipements).
        </div>
      )}

      {/* Cartes par site */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        {SITES_CONFIG.map(site => (
          <SiteCard
            key={site.id}
            site={site}
            servers={servers}
            hyperviseurs={hyperviseurs}
          />
        ))}
      </div>
    </div>
  )
}
