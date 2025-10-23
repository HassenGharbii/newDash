import React from 'react'

const API = 'http://localhost:4000'
const authHeader = () => ({ 'Authorization': `Bearer ${localStorage.getItem('token')||''}` })

const TYPES = ['Camera','Switch','Server','PC']

export default function Equipment(){
  const [query,setQuery] = React.useState('')
  const [typeFilter,setTypeFilter] = React.useState('')
  const [rows,setRows] = React.useState([])
  const [loading,setLoading] = React.useState(true)

  const normalizeType = (t) => {
    const s = String(t||'').trim().toLowerCase()
    if (['server','serveur'].includes(s)) return 'Server'
    if (['switch','commutateur'].includes(s)) return 'Switch'
    if (['pc','poste'].includes(s)) return 'PC'
    if (['camera','caméra','cam'].includes(s)) return 'Camera'
    return t || ''
  }

  const loadLatest10 = React.useCallback(async ()=>{
    setLoading(true)
    try{
      const r = await fetch(`${API}/equipment`, { headers: authHeader() })
      const data = await r.json()
      let arr = Array.isArray(data) ? data : []
      arr.sort((a,b)=>(b.id||0)-(a.id||0))
      setRows(arr.slice(0,10))
    }catch{
      setRows([])
    }finally{
      setLoading(false)
    }
  },[])

  const fallbackLocalFilter = React.useCallback(async ()=>{
    const all = await (await fetch(`${API}/equipment`, { headers: authHeader() })).json()
    let arr = Array.isArray(all) ? all : []
    const q = query.trim().toLowerCase()
    if (q){
      arr = arr.filter(e =>
        (e.name||'').toLowerCase().includes(q) ||
        (e.ip||'').toLowerCase().includes(q) ||
        (e.model||'').toLowerCase().includes(q) ||
        (e.location||'').toLowerCase().includes(q)
      )
    }
    if (typeFilter){
      const wanted = normalizeType(typeFilter)
      arr = arr.filter(e => normalizeType(e.type) === wanted)
    }
    arr.sort((a,b)=>(b.id||0)-(a.id||0))
    return arr.slice(0,10)
  },[API, query, typeFilter])

  const search = React.useCallback(async ()=>{
    setLoading(true)
    try{
      if (!query.trim() && !typeFilter) { await loadLatest10(); return }
      const u = new URL(`${API}/equipment/search`)
      if (query.trim()) u.searchParams.set('q', query.trim())
      if (typeFilter) u.searchParams.set('type', normalizeType(typeFilter))
      u.searchParams.set('limit','10')

      let usedFallback = false
      let list = []

      try{
        const r = await fetch(u, { headers: authHeader() })
        if (r.ok){
          const d = await r.json()
          if (Array.isArray(d) && d.length) list = d.slice(0,10)
          else usedFallback = true
        } else usedFallback = true
      }catch{ usedFallback = true }

      if (usedFallback) list = await fallbackLocalFilter()
      setRows(list)
    }catch{
      setRows([])
    }finally{
      setLoading(false)
    }
  },[API, query, typeFilter, loadLatest10, fallbackLocalFilter])

  React.useEffect(()=>{ loadLatest10() },[loadLatest10])

  const onEnter = (e)=>{ if (e.key==='Enter'){ e.preventDefault(); search() } }

  return (
    <div>
      <h1 className="page-title">Équipements</h1>

      <div className="card panel mb-6">
        <div className="panel-head">
          <div className="panel-title">Recherche (10 max)</div>
        </div>
        <div className="panel-body">
          <div className="grid-3 gap-3 mb-3">
            <input
              className="inpt"
              placeholder="Nom, IP, modèle ou localisation"
              value={query}
              onChange={e=>setQuery(e.target.value)}
              onKeyDown={onEnter}
            />
            <select
              className="inpt"
              value={typeFilter}
              onChange={e=>setTypeFilter(e.target.value)}
              onKeyDown={onEnter}
            >
              <option value="">Tous types</option>
              {TYPES.map(t=><option key={t} value={t}>{t}</option>)}
            </select>
            <button className="button" onClick={search} disabled={loading}>
              {loading ? 'Recherche…' : 'Rechercher'}
            </button>
          </div>

          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th style={{width:80}}>#ID</th>
                  <th>Nom</th><th>IP</th><th>Type</th><th>Modèle</th><th>Localisation</th><th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7}>Chargement…</td></tr>
                ) : rows.length ? rows.map(r=>(
                  <tr key={r.id}>
                    <td className="muted">#{r.id}</td>
                    <td>{r.name}</td>
                    <td>{r.ip || '-'}</td>
                    <td>{r.type}</td>
                    <td>{r.model || '-'}</td>
                    <td>{r.location || '-'}</td>
                    <td>
                      <span className={`badge ${String(r.ping_status||'').toUpperCase()==='UP'?'bg-green':'bg-red'}`}>
                        {String(r.ping_status||'UNKNOWN').toUpperCase()}
                      </span>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan={7} className="muted">Aucun résultat</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
