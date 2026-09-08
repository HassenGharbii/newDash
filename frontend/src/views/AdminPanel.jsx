import React from 'react'
// Fonction simple pour vérifier si l'utilisateur est admin
function isUserAdmin() {
  try {
    const token = localStorage.getItem('token')
    if (!token) return false
    const payload = JSON.parse(atob(token.split('.')[1]))
    return payload.role === 'Admin'
  } catch {
    return false
  }
}

/* ====== UI avec dégradés rouge-noir et fond cohérent ====== */
const ui = {
  h1: { fontSize: 28, fontWeight: 700, margin: 0, color: '#fff' },
  tabs: { display:'flex', gap:12, marginTop:12, borderBottom:'1px solid rgba(239, 68, 68, 0.3)' },
  tab: (active)=>({
    padding:'10px 12px',
    borderRadius:8,
    background: active ? 'linear-gradient(to right, #dc2626, #000)' : 'rgba(0,0,0,0.2)',
    color: '#fff',
    border: active ? 'none' : '1px solid rgba(239, 68, 68, 0.3)',
    marginBottom:8,
    cursor:'pointer',
    fontWeight: active ? 600 : 400,
    transition: 'all 0.3s ease'
  }),
  bar: { display:'flex', flexWrap:'wrap', gap:8, alignItems:'center', marginTop:12 },
  // Tous les boutons avec le même dégradé rouge-noir
  btn: { 
    padding:'8px 12px', 
    border:'none', 
    borderRadius:8, 
    background:'linear-gradient(to right, #dc2626, #000)', 
    color:'#fff', 
    cursor:'pointer',
    fontWeight: 500,
    transition: 'all 0.3s ease'
  },
  linkBtn: { 
    padding:'4px 8px', 
    border:'none', 
    background:'linear-gradient(to right, #dc2626, #000)', 
    color:'#fff', 
    textDecoration:'none', 
    cursor:'pointer',
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 500
  },
  input: { 
    height:36, 
    border:'1px solid rgba(239, 68, 68, 0.3)', 
    borderRadius:8, 
    padding:'0 10px', 
    background:'rgba(0,0,0,0.2)', 
    color:'#fff',
    '::placeholder': { color: '#9ca3af' }
  },
  select:{ 
    height:36, 
    border:'1px solid rgba(239, 68, 68, 0.3)', 
    borderRadius:8, 
    padding:'0 8px', 
    background:'rgba(0,0,0,0.2)', 
    color:'#fff' 
  },
  tableWrap:{ 
    overflow:'auto', 
    border:'1px solid rgba(239, 68, 68, 0.2)', 
    borderRadius:12, 
    background:'rgba(0,0,0,0.1)', 
    backdropFilter: 'blur(10px)' 
  },
  th: { 
    textAlign:'left', 
    fontWeight:600, 
    padding:'10px 8px', 
    fontSize:13, 
    whiteSpace:'nowrap', 
    background:'rgba(0,0,0,0.3)', 
    borderBottom:'1px solid rgba(239, 68, 68, 0.2)', 
    color:'#fff' 
  },
  td: { 
    padding:'10px 8px', 
    fontSize:13, 
    borderBottom:'1px solid rgba(239, 68, 68, 0.1)', 
    color:'#e5e7eb' 
  },
  muted:{ opacity:.7, fontSize:12, color:'#9ca3af' },
  rowActions:{ display:'flex', gap:8 },
  drawerBack:{ 
    position:'fixed', 
    inset:0, 
    background:'rgba(0,0,0,.5)', 
    backdropFilter: 'blur(4px)' 
  },
  drawer:{ 
    position:'fixed', 
    top:0, 
    right:0, 
    width:'min(420px, 100%)', 
    height:'100%', 
    background:'linear-gradient(to bottom, #1f1f1f, #000)', 
    boxShadow:'-12px 0 30px rgba(0,0,0,.3)', 
    padding:20, 
    display:'flex', 
    flexDirection:'column', 
    gap:12, 
    border:'1px solid rgba(239, 68, 68, 0.3)' 
  },
  formGrid:{ display:'grid', gap:10 },
  toast:{ 
    position:'fixed', 
    bottom:16, 
    right:16, 
    background:'linear-gradient(to right, #dc2626, #000)', 
    color:'#fff', 
    padding:'12px 16px', 
    borderRadius:10, 
    fontSize:12, 
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)' 
  },
  pagination:{ display:'flex', alignItems:'center', gap:6, marginTop:12 }
}

const API = import.meta.env.VITE_API_URL || 'http://localhost:4000'
const authHeader = () => ({ 'Authorization': `Bearer ${localStorage.getItem('token')||''}` })
const jsonHeader = () => ({ ...authHeader(), 'Content-Type':'application/json' })
const ALLOWED_TYPES = ['Server','Switch','Camera','PC','Hyperviseur','Stockage']

export default function AdminPanel(){
  const [tab, setTab] = React.useState('equip')
  
  // Vérification simple au début du composant
  if (!isUserAdmin()) {
    return (
      <div className="p-6 bg-gradient-to-b from-red-700/30 to-gray-900 min-h-screen">
        <div className="bg-black/10 backdrop-blur-sm rounded-xl border border-red-800/20 p-8 text-center">
          <div className="text-4xl mb-4">🚫</div>
          <h2 className="text-xl font-bold text-white mb-4">Accès Refusé</h2>
          <p className="text-gray-300 mb-6">Cette page est réservée aux administrateurs.</p>
          <button 
            onClick={() => window.history.back()}
            className="px-4 py-2 bg-gradient-to-r from-red-600 to-black text-white rounded-lg hover:from-red-700 hover:to-gray-900 transition-all"
          >
            Retour
          </button>
        </div>
      </div>
    )
  }
  
  return (
    <div className="p-6 bg-gradient-to-b from-red-700/30 to-gray-900 min-h-screen">
      <div style={{display:'grid', gap:12}}>
        <div>
          <h1 style={ui.h1}>Panel Administration</h1>
          <div style={ui.tabs}>
            <button style={ui.tab(tab==='equip')} onClick={()=>setTab('equip')}>Équipements</button>
            <button style={ui.tab(tab==='users')} onClick={()=>setTab('users')}>Utilisateurs & Rôles</button>
            <button style={ui.tab(tab==='integrations')} onClick={()=>setTab('integrations')}>Intégrations</button>
          </div>
        </div>

        <div className="bg-black/10 backdrop-blur-sm rounded-xl border border-red-800/20 p-6">
          {tab==='equip' ? <EquipmentsAdmin/> : tab==='users' ? <UsersAdmin/> : <IntegrationsAdmin/>}
        </div>
      </div>
    </div>
  )
}

/* ============================ ÉQUIPEMENTS ============================ */
function EquipmentsAdmin(){
  const [items,setItems]   = React.useState([])
  const [loading,setLoading]= React.useState(false)
  const [msg,setMsg]       = React.useState('')
  const [q,setQ]           = React.useState('')
  const [ftype,setFtype]   = React.useState('')

  const [page,setPage]     = React.useState(1)
  const pageSize           = 10
  const [total,setTotal]   = React.useState(0)
  const [selected, setSelected] = React.useState([])

  const [drawerOpen,setDrawerOpen] = React.useState(false)
  const emptyForm = { name:'', ip:'', type:'Server', model:'', location:'' }
  const [form,setForm]   = React.useState(emptyForm)
  const [editId,setEditId]= React.useState(null)

  const totalPages = Math.max(1, Math.ceil((total||0) / pageSize))

  const search = React.useCallback(async ()=>{
    setLoading(true)
    try{
      const p = new URLSearchParams()
      if (q.trim()) p.set('q', q.trim())
      if (ftype) p.set('type', ftype)
      p.set('page', String(page))
      p.set('pageSize', String(pageSize))
      const res  = await fetch(`${API}/equipment/search?${p.toString()}`, { headers: authHeader() })
      if (res.status === 401) { window.location.assign('/login'); return }
      const data = await res.json().catch(()=>null)

      if (res.ok && data && Array.isArray(data.items)) { setItems(data.items); setTotal(data.total||0) }
      else if (Array.isArray(data)) { setItems(data); setTotal(data.length) }
      else { setItems([]); setTotal(0) }
    } finally { setLoading(false) }
  },[q,ftype,page,pageSize])

  React.useEffect(()=>{ search() },[search])

  const notifyChange = () => window.dispatchEvent(new Event('equipment:changed'))

  const openCreate = ()=>{ setForm(emptyForm); setEditId(null); setDrawerOpen(true); setMsg('') }
  const openEdit   = (it)=>{ setForm({ name:it.name||'', ip:it.ip||'', type:it.type||'Server', model:it.model||'', location:it.location||'' }); setEditId(it.id); setDrawerOpen(true); setMsg('') }
  const closeDrawer= ()=>{ setDrawerOpen(false); setForm(emptyForm); setEditId(null) }

  const onSubmit = async (e)=>{
    e.preventDefault(); setMsg('')
    const payload = { ...form }
    const method  = editId ? 'PUT' : 'POST'
    const url     = editId ? `${API}/equipment/${editId}` : `${API}/equipment`
    try{
      const res = await fetch(url, { method, headers: jsonHeader(), body: JSON.stringify(payload) })
      const data = await res.json().catch(()=>null)
      if (res.ok){
        setMsg(editId?'Équipement mis à jour ✅':'Équipement créé ✅')
        closeDrawer()
        search()
        // Délai pour laisser le backend traiter les nouvelles données
        setTimeout(() => notifyChange(), 500)
      } else {
        // Messages d'erreur personnalisés
        if (data?.error === 'duplicate_model') {
          setMsg('❌ Ce modèle existe déjà')
        } else if (data?.error === 'duplicate_ip') {
          setMsg('❌ Cette IP existe déjà')
        } else if (data?.message) {
          setMsg('❌ ' + data.message)
        } else {
          setMsg('❌ ' + (data?.error || 'Erreur'))
        }
      }
    }catch{
      setMsg('❌ Erreur de connexion')
    }
  }

  const onDelete = async (id)=>{
    if(!confirm('Supprimer cet équipement ?')) return
    try{
      const r=await fetch(`${API}/equipment/${id}`,{method:'DELETE',headers:authHeader()})
      if(r.ok){ 
        search(); 
        // Délai pour laisser le backend traiter les changements
        setTimeout(() => notifyChange(), 500)
      } else { 
        setMsg('Suppression impossible') 
      }
    }catch{ setMsg('Suppression impossible') }
  }

  const onBulkDelete = async ()=>{
    if(selected.length === 0) { setMsg('Aucun équipement sélectionné'); return }
    if(!confirm(`Supprimer ${selected.length} équipement(s) sélectionné(s) ?`)) return
    try{
      const r=await fetch(`${API}/equipment/bulk-delete`,{method:'POST',headers:jsonHeader(),body:JSON.stringify({ids:selected})})
      if(r.ok){ 
        const data = await r.json().catch(()=>null)
        setMsg(`${data?.deleted || 0} équipement(s) supprimé(s) ✅`)
        setSelected([])
        search(); 
        setTimeout(() => notifyChange(), 500)
      } else { 
        const errorData = await r.json().catch(()=>null)
        console.error('Bulk delete error:', r.status, errorData)
        setMsg(`❌ Suppression impossible (${errorData?.error || r.status})`) 
      }
    }catch(err){ 
      console.error('Bulk delete exception:', err)
      setMsg('❌ Erreur de connexion') 
    }
  }

  const toggleSelect = (id) => {
    setSelected(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])
  }

  const toggleSelectAll = () => {
    if(selected.length === items.length) setSelected([])
    else setSelected(items.map(it => it.id))
  }

  const deleteByType = async () => {
    const type = prompt('Supprimer tous les équipements de type :\n\nCamera\nSwitch\nServer\nPC\n\nEntrez le type:')
    if (!type) return
    const validTypes = ['Camera', 'Switch', 'Server', 'PC']
    if (!validTypes.includes(type)) {
      setMsg('Type invalide. Utilisez: Camera, Switch, Server ou PC')
      return
    }
    if (!confirm(`⚠️ ATTENTION: Supprimer TOUS les équipements de type "${type}" ?`)) return
    
    try {
      const r = await fetch(`${API}/equipment/delete-by-type/${type}`, {method:'DELETE', headers:authHeader()})
      if (r.ok) {
        const data = await r.json().catch(()=>null)
        setMsg(`${data?.deleted || 0} équipement(s) de type "${type}" supprimé(s) ✅`)
        search()
        setTimeout(() => notifyChange(), 500)
      } else {
        setMsg('❌ Suppression impossible')
      }
    } catch(err) {
      console.error('Delete by type error:', err)
      setMsg('❌ Erreur de connexion')
    }
  }

  const deleteAll = async () => {
    if (!confirm('⚠️ DANGER: Supprimer TOUS les équipements de la base ?')) return
    if (!confirm('⚠️ Êtes-vous VRAIMENT sûr ? Cette action est irréversible !')) return
    
    try {
      const r = await fetch(`${API}/equipment/delete-all`, {method:'DELETE', headers:authHeader()})
      if (r.ok) {
        const data = await r.json().catch(()=>null)
        setMsg(`${data?.deleted || 0} équipement(s) supprimé(s) ✅`)
        search()
        setTimeout(() => notifyChange(), 500)
      } else {
        setMsg('❌ Suppression impossible')
      }
    } catch(err) {
      console.error('Delete all error:', err)
      setMsg('❌ Erreur de connexion')
    }
  }

  const downloadTemplate = async ()=>{
    setMsg('')
    try{
      const res = await fetch(`${API}/equipment/template-excel`, { headers: authHeader() })
      if(!res.ok) throw new Error()
      const blob = await res.blob()
      const url  = window.URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = 'equipements-template.xlsx'
      document.body.appendChild(a); a.click(); a.remove(); window.URL.revokeObjectURL(url)
    }catch{ setMsg('Erreur lors du téléchargement') }
  }

  const exportAllToExcel = async ()=>{
    setMsg('Export en cours...')
    try{
      const res = await fetch(`${API}/equipment/export-excel`, { headers: authHeader() })
      if(!res.ok) throw new Error()
      const blob = await res.blob()
      const url  = window.URL.createObjectURL(blob)
      const timestamp = new Date().toISOString().split('T')[0]
      const a = document.createElement('a'); a.href = url; a.download = `equipements-export-${timestamp}.xlsx`
      document.body.appendChild(a); a.click(); a.remove(); window.URL.revokeObjectURL(url)
      setMsg('✅ Export réussi')
    }catch{ setMsg('❌ Erreur lors de l\'export') }
  }

  function normalizeType(t){
    const s=(t||'').toString().trim().toLowerCase()
    if(s.startsWith('serv')) return 'Server'
    if(s.startsWith('sw'))   return 'Switch'
    if(s.startsWith('cam'))  return 'Camera'
    if(s==='pc')             return 'PC'
    if(s==='hyperviseur' || s==='hypervisor' || s==='esxi' || s==='vmware') return 'Hyperviseur'
    if(s==='stockage' || s==='storage' || s==='baie' || s==='san' || s==='nas') return 'Stockage'
    if(['server','switch','camera','pc','hyperviseur','stockage'].includes(s)) return s[0].toUpperCase()+s.slice(1)
    return 'PC'
  }
  function detectDelimiter(h){ const D=[',',';','\t','|']; let b=',',m=-1; for(const d of D){ const c=(h.match(new RegExp(d.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'g'))||[]).length; if(c>m){m=c;b=d}} if(b!==';' && h.includes(';')) b=';'; return b }
  const stripBOM = s => s && s.charCodeAt(0)===0xFEFF ? s.slice(1) : s
  function smartSplit(line,delim){ const out=[]; let cur='',q=false; for(let i=0;i<line.length;i++){ const ch=line[i]; if(ch==='"'){ if(q&&line[i+1]==='"'){cur+='"'; i++} else q=!q } else if(ch===delim && !q){ out.push(cur); cur='' } else cur+=ch } out.push(cur); return out.map(s=>s.trim().replace(/^"|"$/g,'')) }
  function parseCsvText(text){
    const t=stripBOM(text||''); const lines=t.split(/\r?\n/).filter(l=>l.trim().length>0); if(lines.length<2) return {items:[]}
    const d=detectDelimiter(lines[0]); const headers=smartSplit(lines[0],d).map(h=>h.trim().toLowerCase()); const idx=k=>headers.indexOf(k)
    const items=[]; for(let i=1;i<lines.length;i++){ const cols=smartSplit(lines[i],d); const get=k=>{const j=idx(k); return j>=0?(cols[j]||''):''}
      const it={ name:get('name')||get('nom'), ip:get('ip')||null, type:normalizeType(get('type')), model:get('model')||get('modèle')||get('modele')||null, location:get('location')||get('localisation')||null }
      if(it.name && it.type) items.push(it)
    } return { items }
  }
  async function onCsvFileSelected(e){
    setMsg(''); const file=e.target.files?.[0]; if(!file) return
    try{
      const text=await file.text(); const { items }=parseCsvText(text); if(!items.length) throw new Error()
      const norm=items.map(it=>({ ...it, type: ALLOWED_TYPES.includes(it.type)?it.type:'PC' }))
      const res=await fetch(`${API}/equipment/bulk`,{method:'POST',headers:jsonHeader(),body:JSON.stringify({items:norm})})
      if(!res.ok) throw new Error(); const data=await res.json().catch(()=>null)
      setMsg(`Import CSV: ${data?.inserted??0} insérés, ${data?.updated??0} MAJ, ignorés: ${data?.skipped_invalid??0}`)
      search(); notifyChange()
    }catch{ setMsg('Erreur import CSV') } finally { e.target.value='' }
  }
  async function onExcelFileSelected(e){
    setMsg(''); const file=e.target.files?.[0]; if(!file) return
    try{
      const fd=new FormData(); fd.append('file',file)
      const res=await fetch(`${API}/equipment/bulk-excel`,{method:'POST',headers:authHeader(),body:fd})
      if(!res.ok) throw new Error(); const data=await res.json().catch(()=>null)
      setMsg(`Import Excel: ${data?.inserted??0} insérés, ${data?.updated??0} MAJ, ignorés: ${data?.skipped_invalid??0}`)
      search(); notifyChange()
    }catch{ setMsg('Erreur import Excel') } finally { e.target.value='' }
  }

  const totalPagesArr = React.useMemo(()=>{
    const n = Math.max(1, totalPages), win = 7
    let a = Math.max(1, page - Math.floor(win/2)), b = Math.min(n, a + win - 1)
    if (b - a + 1 < win) a = Math.max(1, b - win + 1)
    return Array.from({length:b-a+1},(_,i)=>a+i)
  },[page,totalPages])

  return (
    <div style={{display:'grid', gap:10}}>
      {/* Toolbar avec boutons uniformes */}
      <div style={ui.bar}>
        <button style={ui.btn} onClick={openCreate}>+ Nouvel équipement</button>
        <button style={ui.btn} onClick={downloadTemplate}>Modèle Excel</button>
        <button style={ui.btn} onClick={exportAllToExcel}>📥 Exporter tout</button>
        <label style={ui.btn}>Importer CSV
          <input type="file" accept=".csv" style={{display:'none'}} onChange={onCsvFileSelected}/>
        </label>
        <label style={ui.btn}>Importer Excel
          <input type="file" accept=".xlsx,.xls" style={{display:'none'}} onChange={onExcelFileSelected}/>
        </label>
        <button style={{...ui.btn, background:'linear-gradient(to right, #dc2626, #b91c1c)'}} onClick={deleteByType}>
          🗑️ Supprimer par type
        </button>
        <button style={{...ui.btn, background:'linear-gradient(to right, #7f1d1d, #991b1b)'}} onClick={deleteAll}>
          ⚠️ Tout supprimer
        </button>
        {selected.length > 0 && (
          <button 
            style={{...ui.btn, background:'linear-gradient(to right, #b91c1c, #991b1b)'}} 
            onClick={onBulkDelete}
          >
            Supprimer ({selected.length})
          </button>
        )}
      </div>

      {/* Filtres avec inputs transparents */}
      <div style={ui.bar}>
        <input 
          style={{...ui.input, width:260}} 
          placeholder="Nom, IP, modèle ou localisation"
          value={q} 
          onChange={e=>{setQ(e.target.value); setPage(1)}}
        />
        <select 
          style={ui.select} 
          value={ftype} 
          onChange={e=>{setFtype(e.target.value); setPage(1)}}
        >
          <option value="">Tous types</option>
          {ALLOWED_TYPES.map(t=> <option key={t} value={t}>{t}</option>)}
        </select>
        <button style={ui.btn} onClick={()=>{ setPage(1); search() }} type="button">Rechercher</button>
        <button style={ui.linkBtn} onClick={search} type="button">Actualiser</button>
        <div style={{...ui.muted, marginLeft:8}}>{loading ? 'Recherche…' : `Résultats: ${total}`}</div>
      </div>

      {/* Tableau avec fond transparent */}
      <div style={ui.tableWrap}>
        {!loading && items.length>0 ? (
          <table style={{borderCollapse:'separate', borderSpacing:0, width:'100%'}}>
            <thead>
              <tr>
                <th style={{...ui.th, width: 40}}>
                  <input 
                    type="checkbox" 
                    checked={selected.length === items.length && items.length > 0}
                    onChange={toggleSelectAll}
                    style={{cursor: 'pointer'}}
                  />
                </th>
                {['Nom','IP','Type','Modèle','Localisation','Statut','Actions'].map(h=>(
                  <th key={h} style={ui.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((it, idx)=>(
                <tr key={it.id} style={{
                  ...(idx % 2 === 0 ? {background: 'rgba(0,0,0,0.1)'} : {}),
                  ...(selected.includes(it.id) ? {background: 'rgba(220, 38, 38, 0.15)'} : {})
                }}>
                  <td style={ui.td}>
                    <input 
                      type="checkbox" 
                      checked={selected.includes(it.id)}
                      onChange={() => toggleSelect(it.id)}
                      style={{cursor: 'pointer'}}
                    />
                  </td>
                  <td style={ui.td}>{it.name}</td>
                  <td style={ui.td}>{it.ip||'-'}</td>
                  <td style={ui.td}>{it.type}</td>
                  <td style={ui.td}>{it.model||'-'}</td>
                  <td style={ui.td}>{it.location||'-'}</td>
                  <td style={ui.td}>
                    <span style={{
                      color: it.ping_status === 'UP' ? '#10b981' : it.ping_status === 'DOWN' ? '#ef4444' : '#6b7280'
                    }}>
                      {it.ping_status||'UNKNOWN'}
                    </span>
                    {typeof it.latency_ms==='number' ? ` (${it.latency_ms}ms)` : ''}
                  </td>
                  <td style={ui.td}>
                    <div style={ui.rowActions}>
                      <button style={ui.btn} onClick={()=>openEdit(it)}>Éditer</button>
                      <button style={ui.btn} onClick={()=>onDelete(it.id)}>Supprimer</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : loading ? (
          <div style={{padding:10, ...ui.muted}}>Chargement…</div>
        ) : (
          <div style={{padding:10, ...ui.muted}}>Aucun résultat.</div>
        )}
      </div>

      {/* Pagination avec boutons uniformes */}
      {totalPages>1 && (
        <div style={ui.pagination}>
          <button 
            style={{...ui.btn, opacity: page<=1 ? 0.5 : 1}} 
            disabled={page<=1} 
            onClick={()=>setPage(p=>Math.max(1,p-1))}
          >
            Précédent
          </button>
          {totalPagesArr[0] > 1 && (
            <>
              <button style={ui.btn} onClick={()=>setPage(1)}>1</button>
              <span style={ui.muted}>…</span>
            </>
          )}
          {totalPagesArr.map(n=>(
            <button 
              key={n} 
              style={{
                ...ui.btn, 
                ...(n===page ? {background:'linear-gradient(to right, #b91c1c, #1f1f1f)'} : {})
              }} 
              onClick={()=>setPage(n)}
            >
              {n}
            </button>
          ))}
          {totalPagesArr[totalPagesArr.length-1] < totalPages && (
            <>
              <span style={ui.muted}>…</span>
              <button style={ui.btn} onClick={()=>setPage(totalPages)}>{totalPages}</button>
            </>
          )}
          <button 
            style={{...ui.btn, opacity: page>=totalPages ? 0.5 : 1}} 
            disabled={page>=totalPages} 
            onClick={()=>setPage(p=>p+1)}
          >
            Suivant
          </button>
          <span style={{...ui.muted, marginLeft:8}}>Résultats: {total} — Page {page}/{totalPages}</span>
        </div>
      )}

      {/* Drawer avec fond sombre */}
      {drawerOpen && (
        <>
          <div style={ui.drawerBack} onClick={closeDrawer} />
          <div style={ui.drawer}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
              <div style={{fontWeight:600, color: '#fff'}}>
                {editId?'Modifier un équipement':'Ajouter un équipement'}
              </div>
              <button style={ui.btn} onClick={closeDrawer}>Fermer</button>
            </div>
            <form onSubmit={onSubmit} style={ui.formGrid}>
              <input 
                style={ui.input} 
                placeholder="Nom" 
                value={form.name} 
                onChange={e=>setForm(f=>({...f,name:e.target.value}))} 
                required
              />
              <input 
                style={ui.input} 
                placeholder="IP" 
                value={form.ip} 
                onChange={e=>setForm(f=>({...f,ip:e.target.value}))}
              />
              <select 
                style={ui.select} 
                value={form.type} 
                onChange={e=>setForm(f=>({...f,type:e.target.value}))}
              >
                {ALLOWED_TYPES.map(t=> <option key={t}>{t}</option>)}
              </select>
              <input 
                style={ui.input} 
                placeholder="Modèle" 
                value={form.model} 
                onChange={e=>setForm(f=>({...f,model:e.target.value}))}
              />
              <input 
                style={ui.input} 
                placeholder="Localisation" 
                value={form.location} 
                onChange={e=>setForm(f=>({...f,location:e.target.value}))}
              />
              <div style={{display:'flex', gap:8}}>
                <button style={ui.btn} type="submit">{editId?'Mettre à jour':'Créer'}</button>
                {editId && <button type="button" style={ui.btn} onClick={closeDrawer}>Annuler</button>}
              </div>
            </form>
          </div>
        </>
      )}

      {msg && <div style={ui.toast}>{msg}</div>}
    </div>
  )
}

/* ============================ UTILISATEURS & RÔLES ============================ */
function UsersAdmin(){
  const [rows,setRows]   = React.useState([])
  const [loading,setLoading]= React.useState(true)
  const [form,setForm]   = React.useState({ name:'', email:'', password:'', role:'User' })
  const [editId,setEditId]= React.useState(null)
  const [msg,setMsg]     = React.useState('')

  const load = React.useCallback(async ()=>{
    setLoading(true); setMsg('')
    try{
      const res = await fetch(`${API}/users`,{ headers: authHeader() })
      if (res.status === 401) { window.location.assign('/login'); return }
      if (!res.ok) throw new Error('fetch_users_failed')
      const data = await res.json()
      setRows(Array.isArray(data)?data:[])
    }catch{ setMsg('Erreur lors du chargement des utilisateurs'); setRows([]) }
    finally{ setLoading(false) }
  },[])
  React.useEffect(()=>{ load() },[load])

  const notifyChange = () => window.dispatchEvent(new Event('equipment:changed'))

  const submit = async (e)=>{
    e.preventDefault(); setMsg('')
    if (!editId && !form.password) { setMsg('Mot de passe requis à la création'); return }
    const payload = { name: form.name || undefined, email: form.email || undefined, role: form.role || undefined }
    if (form.password) payload.password = form.password
    const method = editId ? 'PUT' : 'POST'
    const url    = editId ? `${API}/users/${editId}` : `${API}/users`
    try{
      const res = await fetch(url,{ method, headers: jsonHeader(), body: JSON.stringify(payload) })
      if (!res.ok) { const err = await res.json().catch(()=>({error:'Erreur'})); throw new Error(err.error || 'Erreur') }
      setMsg(editId?'Utilisateur mis à jour ✅':'Utilisateur créé ✅')
      setForm({ name:'', email:'', password:'', role:'User' }); setEditId(null); load()
      notifyChange()
    }catch(err){ setMsg(err.message || 'Erreur') }
  }

  const onEdit   = (u)=>{ setEditId(u.id); setForm({ name:u.name||'', email:u.email, password:'', role:u.role }) }
  const onDelete = async (id)=>{
    if(!confirm('Supprimer cet utilisateur ?')) return
    try{
      const r=await fetch(`${API}/users/${id}`,{method:'DELETE',headers:authHeader()})
      if(r.ok){ load(); notifyChange() } else { setMsg('Suppression impossible') }
    }catch{ setMsg('Suppression impossible') }
  }

  return (
    <div style={{display:'grid', gap:12}}>
      {/* Formulaire avec fond transparent */}
      <div style={{
        background: 'rgba(0,0,0,0.2)', 
        border: '1px solid rgba(239, 68, 68, 0.3)', 
        borderRadius: 12, 
        padding: 16
      }}>
        <div style={{fontWeight:600, marginBottom: 12, color: '#fff'}}>Ajouter / Modifier un utilisateur</div>
        <form onSubmit={submit}>
          <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 16}}>
            <input 
              style={ui.input} 
              placeholder="Nom" 
              value={form.name} 
              onChange={e=>setForm(f=>({...f,name:e.target.value}))} 
              required={!editId}
            />
            <input 
              style={ui.input} 
              placeholder="Email" 
              value={form.email} 
              onChange={e=>setForm(f=>({...f,email:e.target.value}))} 
              required
            />
            <input 
              style={ui.input} 
              placeholder={editId?'Nouveau mot de passe (optionnel)':'Mot de passe'} 
              type="password" 
              value={form.password} 
              onChange={e=>setForm(f=>({...f,password:e.target.value}))} 
              {...(editId?{}:{required:true})}
            />
            <select 
              style={ui.select} 
              value={form.role} 
              onChange={e=>setForm(f=>({...f,role:e.target.value}))}
            >
              <option>User</option>
              <option>Admin</option>
              <option>SGM</option>
            </select>
          </div>
          <div style={{display:'flex', gap:8}}>
            <button style={ui.btn} type="submit">{editId?'Mettre à jour':'Créer'}</button>
            {editId && (
              <button 
                type="button" 
                style={ui.btn} 
                onClick={()=>{setEditId(null); setForm({ name:'', email:'', password:'', role:'User' })}}
              >
                Annuler
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Tableau avec fond transparent */}
      <div style={ui.tableWrap}>
        {loading ? (
          <div style={{padding:10, ...ui.muted}}>Chargement…</div>
        ) : rows.length ? (
          <table style={{borderCollapse:'separate', borderSpacing:0, width:'100%'}}>
            <thead>
              <tr>{['Nom','Email','Rôle','Créé le','Actions'].map(h=> <th key={h} style={ui.th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((u, idx)=>(
                <tr key={u.id} style={idx % 2 === 0 ? {background: 'rgba(0,0,0,0.1)'} : {}}>
                  <td style={ui.td}>{u.name || '-'}</td>
                  <td style={ui.td}>{u.email}</td>
                  <td style={ui.td}>
                    <span style={{
                      color: u.role === 'Admin' ? '#f59e0b' : '#3b82f6',
                      fontWeight: 500
                    }}>
                      {u.role}
                    </span>
                  </td>
                  <td style={{...ui.td, fontSize: 11}}>{new Date(u.created_at).toLocaleDateString('fr-FR')}</td>
                  <td style={ui.td}>
                    <div style={ui.rowActions}>
                      <button style={ui.btn} onClick={()=>onEdit(u)}>Éditer</button>
                      <button style={ui.btn} onClick={()=>onDelete(u.id)}>Supprimer</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={{padding:10, ...ui.muted}}>Aucun utilisateur.</div>
        )}
      </div>

      {msg && <div style={ui.toast}>{msg}</div>}
    </div>
  )
}

/* ============================ INTÉGRATIONS (VMware / Stockage) ============================ */
const emptyVmForm = { name:'', vcenterHost:'', vcenterUser:'', vcenterPass:'', esxiHostsText:'', esxiUser:'', esxiPass:'' }

function VMwareConnectionsAdmin(){
  const [connections, setConnections] = React.useState([])
  const [loading, setLoading] = React.useState(true)
  const [msg, setMsg] = React.useState('')
  const [editId, setEditId] = React.useState(null)
  const [form, setForm] = React.useState(emptyVmForm)

  const load = React.useCallback(async ()=>{
    setLoading(true)
    try{
      const res = await fetch(`${API}/integrations/vmware/connections`, { headers: authHeader() })
      const data = await res.json()
      setConnections(Array.isArray(data) ? data : [])
    }catch{ setMsg('Erreur lors du chargement des connexions VMware') }
    finally{ setLoading(false) }
  },[])
  React.useEffect(()=>{ load() },[load])

  const onEdit = (c) => {
    setEditId(c.id)
    setForm({
      name: c.name || '',
      vcenterHost: c.vcenterHost || '',
      vcenterUser: c.vcenterUser || '',
      vcenterPass: '',
      esxiHostsText: (c.esxiHosts || []).join(', '),
      esxiUser: c.esxiUser || '',
      esxiPass: ''
    })
  }
  const onCancel = () => { setEditId(null); setForm(emptyVmForm) }

  const onDelete = async (id) => {
    if (!confirm('Supprimer cette connexion VMware ?')) return
    try{
      const res = await fetch(`${API}/integrations/vmware/connections/${id}`, { method:'DELETE', headers: authHeader() })
      if (!res.ok) throw new Error()
      setMsg('Connexion supprimée ✅')
      if (editId === id) onCancel()
      load()
    }catch{ setMsg('Erreur lors de la suppression') }
  }

  const onCollectNow = async (id) => {
    setMsg('')
    try{
      const res = await fetch(`${API}/integrations/vmware/connections/${id}/trigger`, { method:'POST', headers: authHeader() })
      if (!res.ok) throw new Error()
      setMsg('Collecte demandée — sera traitée sous ~10 secondes ✅')
    }catch{ setMsg('Erreur lors de la demande de collecte') }
  }

  const submit = async (e) => {
    e.preventDefault(); setMsg('')
    if (!editId && !form.name.trim()) { setMsg('Un nom est requis pour identifier la connexion'); return }
    const payload = {
      name: form.name.trim(),
      vcenterHost: form.vcenterHost.trim(),
      vcenterUser: form.vcenterUser.trim(),
      esxiHosts: form.esxiHostsText.split(',').map(s=>s.trim()).filter(Boolean),
      esxiUser: form.esxiUser.trim()
    }
    if (form.vcenterPass) payload.vcenterPass = form.vcenterPass
    if (form.esxiPass) payload.esxiPass = form.esxiPass
    try{
      const url = editId ? `${API}/integrations/vmware/connections/${editId}` : `${API}/integrations/vmware/connections`
      const res = await fetch(url, { method: editId ? 'PUT' : 'POST', headers: jsonHeader(), body: JSON.stringify(payload) })
      if (!res.ok) throw new Error()
      setMsg(editId ? 'Connexion mise à jour ✅' : 'Connexion ajoutée ✅')
      onCancel()
      load()
    }catch{ setMsg("Erreur lors de l'enregistrement") }
  }

  const boxStyle = { background:'rgba(0,0,0,0.2)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:12, padding:16 }
  const gridStyle = { display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:12, marginBottom:12 }

  return (
    <div style={boxStyle}>
      <div style={{fontWeight:600, marginBottom:4, color:'#fff'}}>Connexions VMware (vCenter ou ESXi)</div>
      <div style={{...ui.muted, marginBottom:12}}>
        Ajoutez une connexion par vCenter/site. Chaque hyperviseur collecté est tagué avec le nom
        de sa connexion, utilisable comme filtre sur la page VMware.
      </div>

      {loading ? (
        <div style={{padding:10, ...ui.muted}}>Chargement…</div>
      ) : connections.length > 0 && (
        <div style={{marginBottom:16}}>
          {connections.map(c => (
            <div key={c.id} style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 12px', background:'rgba(0,0,0,0.15)', borderRadius:8, marginBottom:6}}>
              <div>
                <span style={{fontWeight:600, color:'#fff'}}>{c.name}</span>
                <span style={{...ui.muted, marginLeft:10}}>
                  {c.vcenterHost ? `vCenter: ${c.vcenterHost}` : (c.esxiHosts||[]).length ? `ESXi: ${(c.esxiHosts||[]).join(', ')}` : 'Non configuré'}
                </span>
              </div>
              <div style={ui.rowActions}>
                <button style={ui.btn} type="button" onClick={()=>onCollectNow(c.id)}>Collecter maintenant</button>
                <button style={ui.btn} type="button" onClick={()=>onEdit(c)}>Éditer</button>
                <button style={ui.btn} type="button" onClick={()=>onDelete(c.id)}>Supprimer</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{fontWeight:500, marginBottom:8, color:'#fff'}}>{editId ? 'Modifier la connexion' : 'Ajouter une connexion'}</div>
      <form onSubmit={submit}>
        <div style={gridStyle}>
          <input style={ui.input} placeholder="Nom (ex: Site Milan)" value={form.name} onChange={e=>setForm(f=>({...f, name:e.target.value}))} />
          <input style={ui.input} placeholder="Hôte vCenter (ex: vcenter.semmaris.local)" value={form.vcenterHost} onChange={e=>setForm(f=>({...f, vcenterHost:e.target.value}))} />
          <input style={ui.input} placeholder="Utilisateur vCenter" value={form.vcenterUser} onChange={e=>setForm(f=>({...f, vcenterUser:e.target.value}))} />
          <input style={ui.input} type="password" placeholder="Mot de passe vCenter" value={form.vcenterPass} onChange={e=>setForm(f=>({...f, vcenterPass:e.target.value}))} />
        </div>
        <div style={{...ui.muted, marginBottom:8}}>Ou connexion directe à un/des hôtes ESXi (sans vCenter) :</div>
        <div style={gridStyle}>
          <input style={ui.input} placeholder="IPs des hôtes ESXi, séparées par des virgules" value={form.esxiHostsText} onChange={e=>setForm(f=>({...f, esxiHostsText:e.target.value}))} />
          <input style={ui.input} placeholder="Utilisateur ESXi (ex: root)" value={form.esxiUser} onChange={e=>setForm(f=>({...f, esxiUser:e.target.value}))} />
          <input style={ui.input} type="password" placeholder="Mot de passe ESXi" value={form.esxiPass} onChange={e=>setForm(f=>({...f, esxiPass:e.target.value}))} />
        </div>
        <div style={{display:'flex', gap:8}}>
          <button style={ui.btn} type="submit">{editId ? 'Mettre à jour' : 'Ajouter la connexion'}</button>
          {editId && <button style={ui.btn} type="button" onClick={onCancel}>Annuler</button>}
        </div>
      </form>

      {msg && <div style={ui.toast}>{msg}</div>}
    </div>
  )
}

function IntegrationsAdmin(){
  const [storage, setStorage] = React.useState({ configured:false })
  const [stForm, setStForm]   = React.useState({ hostsText:'', apiUser:'', apiPass:'', snmpCommunity:'public' })
  const [loading, setLoading] = React.useState(true)
  const [msg, setMsg]         = React.useState('')

  const load = React.useCallback(async ()=>{
    setLoading(true)
    try{
      const sRes = await fetch(`${API}/integrations/storage`, { headers: authHeader() })
      const s = await sRes.json()
      setStorage(s)
      setStForm(f => ({ ...f, hostsText: (s.hosts||[]).join(', '), apiUser: s.apiUser||'', snmpCommunity: s.snmpCommunity||'public' }))
    }catch{ setMsg('Erreur lors du chargement des intégrations') }
    finally{ setLoading(false) }
  },[])
  React.useEffect(()=>{ load() },[load])

  const saveStorage = async (e)=>{
    e.preventDefault(); setMsg('')
    const payload = {
      hosts: stForm.hostsText.split(',').map(s=>s.trim()).filter(Boolean),
      apiUser: stForm.apiUser.trim(),
      snmpCommunity: stForm.snmpCommunity.trim() || 'public'
    }
    if (stForm.apiPass) payload.apiPass = stForm.apiPass
    try{
      const res = await fetch(`${API}/integrations/storage`, { method:'PUT', headers: jsonHeader(), body: JSON.stringify(payload) })
      if (!res.ok) throw new Error()
      setMsg('Connexion Stockage enregistrée ✅')
      setStForm(f=>({...f, apiPass:''}))
      load()
    }catch{ setMsg("Erreur lors de l'enregistrement Stockage") }
  }

  if (loading) return <div style={{padding:10, ...ui.muted}}>Chargement…</div>

  const boxStyle = { background:'rgba(0,0,0,0.2)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:12, padding:16 }
  const gridStyle = { display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:12, marginBottom:12 }

  return (
    <div style={{display:'grid', gap:20}}>
      <VMwareConnectionsAdmin/>

      <div style={boxStyle}>
        <div style={{fontWeight:600, marginBottom:4, color:'#fff'}}>Connexion Stockage (Seagate)</div>
        <div style={{...ui.muted, marginBottom:12}}>
          {storage.configured
            ? `Configuré${storage.updatedAt ? ' — dernière modification ' + new Date(storage.updatedAt).toLocaleString('fr-FR') : ''}`
            : 'Non configuré'}
        </div>
        <form onSubmit={saveStorage}>
          <div style={gridStyle}>
            <input style={ui.input} placeholder="IPs des baies, séparées par des virgules" value={stForm.hostsText} onChange={e=>setStForm(f=>({...f, hostsText:e.target.value}))} />
            <input style={ui.input} placeholder="Utilisateur API (ex: manage)" value={stForm.apiUser} onChange={e=>setStForm(f=>({...f, apiUser:e.target.value}))} />
            <input style={ui.input} type="password" placeholder={storage.hasApiPass ? 'Mot de passe API (déjà défini)' : 'Mot de passe API'} value={stForm.apiPass} onChange={e=>setStForm(f=>({...f, apiPass:e.target.value}))} />
            <input style={ui.input} placeholder="Communauté SNMP" value={stForm.snmpCommunity} onChange={e=>setStForm(f=>({...f, snmpCommunity:e.target.value}))} />
          </div>
          <button style={ui.btn} type="submit">Enregistrer la connexion Stockage</button>
        </form>
      </div>

      {msg && <div style={ui.toast}>{msg}</div>}
      <div style={ui.muted}>
        Ces identifiants sont chiffrés en base (jamais réaffichés en clair). Les scripts de collecte
        (CollectHyperviseurInfo.ps1 / CollectStorageInfo.ps1) les récupèrent automatiquement à chaque
        cycle — pas besoin de relancer les conteneurs après une modification.
      </div>
    </div>
  )
}