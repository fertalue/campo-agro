import { useState, useEffect } from 'react'
import { db, supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

const CATEGORIAS = ['Producción', 'Mantenimiento casco', 'Esparcimiento', 'Otro']

const chipClass = (cat) => ({
  'Producción': 'chip-green',
  'Mantenimiento casco': 'chip-amber',
  'Esparcimiento': 'chip-sky',
  'Otro': 'chip-muted',
}[cat] || 'chip-muted')

export default function Viajes() {
  const { role, displayName, puedeEditar, isAdmin } = useAuth()
  const canEdit = isAdmin || puedeEditar('viajes')
  const [viajes, setViajes]   = useState([])
  const [loading, setLoading] = useState(true)
  const [fCategoria, setFCategoria] = useState('todas')
  const [fQuien, setFQuien] = useState('todos')
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving]   = useState(false)
  const [editando, setEditando] = useState(null)
  const [form, setForm]       = useState({
    fecha: new Date().toISOString().split('T')[0],
    quien: 'Fer',
    categoria: 'Producción',
    motivo: '',
    observaciones: '',
  })

  useEffect(() => { fetchViajes() }, [])

  async function fetchViajes() {
    setLoading(true)
    const { data } = await db.viajes.list()
    setViajes(data || [])
    setLoading(false)
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    console.log('Guardando:', form)
    const { data, error } = await db.viajes.insert(form)
    console.log('Resultado:', data, error)
    setShowForm(false)
    setForm({ fecha: new Date().toISOString().split('T')[0], quien: displayName || 'Fer', categoria: 'Producción', motivo: '', observaciones: '' })
    await fetchViajes()
    setSaving(false)
  }

  const viajesFiltrados = viajes.filter(v => {
    if (fCategoria !== 'todas' && v.categoria !== fCategoria) return false
    if (fQuien !== 'todos' && v.quien !== fQuien) return false
    return true
  })
  async function handleUpdate(e) {
    e.preventDefault()
    await supabase.from('viajes').update({
      fecha:        editando.fecha,
      quien:        editando.quien,
      categoria:    editando.categoria,
      motivo:       editando.motivo,
      observaciones: editando.observaciones,
    }).eq('id', editando.id)
    setEditando(null)
    await fetchViajes()
  }

  async function handleDelete(id) {
    if (!confirm('¿Eliminar esta visita?')) return
    await supabase.from('viajes').delete().eq('id', id)
    await fetchViajes()
  }

  const totalFer = viajes.filter(v => v.quien === 'Fer').length
  const totalLeo = viajes.filter(v => v.quien === 'Leo').length
  const quienes = [...new Set(viajes.map(v => v.quien).filter(Boolean))].sort()
  const porCategoria = CATEGORIAS.map(cat => ({
    cat,
    total: viajes.filter(v => v.categoria === cat).length,
    fer:   viajes.filter(v => v.categoria === cat && v.quien === 'Fer').length,
    leo:   viajes.filter(v => v.categoria === cat && v.quien === 'Leo').length,
  })).filter(c => c.total > 0)
  const maxCat = Math.max(...porCategoria.map(c => c.total), 1)

  return (
    <div>
      {/* Header */}
      <div className="flex-between mb-2">
        <div>
          <h2>Viajes al campo</h2>
          <p style={{ fontSize: 12, color: 'var(--arcilla)', marginTop: 2 }}>
            {viajesFiltrados.length}{viajes.length !== viajesFiltrados.length ? ' de ' + viajes.length : ''} visitas
          </p>
        </div>
        {canEdit && <button className="btn btn-primary btn-sm" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancelar' : '+ Registrar visita'}
        </button>}
      </div>

      {/* Stats */}
      <div className="grid-4 mb-3" style={{ gridTemplateColumns: 'repeat(3, minmax(0,1fr))' }}>
        <div className="stat-card">
          <div className="stat-label">Total visitas</div>
          <div className="stat-value">{viajes.length}</div>
          <div className="stat-sub">campaña activa</div>
          <div className="stat-bar"><div className="stat-fill" style={{ width: '100%', background: 'var(--pasto)' }} /></div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Fer</div>
          <div className="stat-value">{totalFer}</div>
          <div className="stat-sub">{viajes.length ? Math.round(totalFer/viajes.length*100) : 0}% del total</div>
          <div className="stat-bar"><div className="stat-fill" style={{ width: `${viajes.length ? totalFer/viajes.length*100 : 0}%`, background: 'var(--hoja)' }} /></div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Leo</div>
          <div className="stat-value">{totalLeo}</div>
          <div className="stat-sub">{viajes.length ? Math.round(totalLeo/viajes.length*100) : 0}% del total</div>
          <div className="stat-bar"><div className="stat-fill" style={{ width: `${viajes.length ? totalLeo/viajes.length*100 : 0}%`, background: 'var(--paja)' }} /></div>
        </div>
      </div>

      {/* Form */}
      {showForm && canEdit && (
        <div className="card mb-3" style={{ background: '#F9F6EE', borderColor: 'var(--paja)' }}>
          <h3 style={{ marginBottom: 14 }}>Nueva visita</h3>
          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="grid-2">
              <div className="field">
                <label className="label">Fecha</label>
                <input className="input" type="date" value={form.fecha}
                  onChange={e => setForm({ ...form, fecha: e.target.value })} required />
              </div>
              <div className="field">
                <label className="label">¿Quién fue?</label>
                <select className="select" value={form.quien}
                  onChange={e => setForm({ ...form, quien: e.target.value })}>
                  <option>Fer</option>
                  <option>Leo</option>
                </select>
              </div>
            </div>
            <div className="field">
              <label className="label">Categoría</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {CATEGORIAS.map(c => (
                  <button key={c} type="button"
                    onClick={() => setForm({ ...form, categoria: c })}
                    style={{
                      padding: '6px 12px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
                      border: '1px solid',
                      background: form.categoria === c ? 'var(--pasto)' : 'transparent',
                      color: form.categoria === c ? '#F5F0E4' : 'var(--arcilla)',
                      borderColor: form.categoria === c ? 'var(--pasto)' : 'var(--border)',
                    }}>{c}</button>
                ))}
              </div>
            </div>
            <div className="field">
              <label className="label">Motivo / tarea del día</label>
              <input className="input" type="text" value={form.motivo}
                onChange={e => setForm({ ...form, motivo: e.target.value })}
                placeholder="Revisión lote norte, fumigación, etc." />
            </div>
            <div className="field">
              <label className="label">Observaciones</label>
              <textarea className="textarea" value={form.observaciones}
                onChange={e => setForm({ ...form, observaciones: e.target.value })}
                placeholder="Notas libres..." style={{ minHeight: 60 }} />
            </div>
            <button className="btn btn-primary" type="submit" disabled={saving} style={{ alignSelf: 'flex-start' }}>
              {saving ? 'Guardando...' : 'Guardar visita'}
            </button>
          </form>
        </div>
      )}

      {/* Filtros + panel por categoria */}
      <div style={{ display:'flex', gap:14, marginBottom:14, flexWrap:'wrap', alignItems:'flex-start' }}>

        {/* Filtros */}
        <div style={{ display:'flex', flexWrap:'wrap', gap:8, flex:1, padding:'10px 14px', background:'#FDFAF4', border:'1px solid #D8C9A8', borderRadius:10, alignItems:'flex-end' }}>
          <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
            <div style={{ fontSize:10, fontWeight:600, color:'#A08060', textTransform:'uppercase', letterSpacing:'0.05em' }}>Categoría</div>
            <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
              {['todas', ...CATEGORIAS].map(c => (
                <button key={c} onClick={() => setFCategoria(c)}
                  style={{ padding:'5px 10px', borderRadius:6, fontSize:11, cursor:'pointer', border:'1px solid', fontFamily:'inherit', whiteSpace:'nowrap',
                    background: fCategoria===c ? 'var(--pasto)' : 'transparent',
                    color: fCategoria===c ? '#F5F0E4' : 'var(--arcilla)',
                    borderColor: fCategoria===c ? 'var(--pasto)' : '#D8C9A8' }}>
                  {c === 'todas' ? 'Todas' : c}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
            <div style={{ fontSize:10, fontWeight:600, color:'#A08060', textTransform:'uppercase', letterSpacing:'0.05em' }}>Quién</div>
            <div style={{ display:'flex', gap:4 }}>
              {['todos', ...quienes].map(q => (
                <button key={q} onClick={() => setFQuien(q)}
                  style={{ padding:'5px 10px', borderRadius:6, fontSize:11, cursor:'pointer', border:'1px solid', fontFamily:'inherit',
                    background: fQuien===q ? '#7A9EAD' : 'transparent',
                    color: fQuien===q ? '#fff' : 'var(--arcilla)',
                    borderColor: fQuien===q ? '#7A9EAD' : '#D8C9A8' }}>
                  {q === 'todos' ? 'Todos' : q}
                </button>
              ))}
            </div>
          </div>
          {(fCategoria !== 'todas' || fQuien !== 'todos') && (
            <button onClick={() => { setFCategoria('todas'); setFQuien('todos') }}
              style={{ padding:'5px 10px', borderRadius:6, fontSize:11, cursor:'pointer', border:'1px solid #D8C9A8', background:'transparent', color:'var(--arcilla)', fontFamily:'inherit' }}>
              Limpiar
            </button>
          )}
        </div>

        {/* Panel por categoría */}
        {porCategoria.length > 0 && (
          <div style={{ minWidth:180, background:'#FDFAF4', border:'1px solid #D8C9A8', borderRadius:10, padding:'12px 14px' }}>
            <div style={{ fontSize:11, fontWeight:600, color:'#A08060', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:10 }}>Por categoría</div>
            {porCategoria.map(({cat, total, fer, leo}) => (
              <div key={cat} style={{ marginBottom:8, cursor:'pointer' }} onClick={() => setFCategoria(fCategoria===cat?'todas':cat)}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                  <span style={{ fontSize:11, color: fCategoria===cat?'var(--pasto)':'var(--tierra)', fontWeight: fCategoria===cat?600:400 }}>{cat}</span>
                  <span style={{ fontSize:11, fontWeight:600, color:'var(--tierra)' }}>{total}</span>
                </div>
                <div style={{ height:6, background:'#E8D5A3', borderRadius:3, overflow:'hidden', marginBottom:3 }}>
                  <div style={{ height:6, background: fCategoria===cat?'var(--pasto)':'#7A9EAD', borderRadius:3, width:(total/maxCat*100)+'%' }}/>
                </div>
                <div style={{ display:'flex', gap:6, fontSize:10, color:'var(--text-muted)' }}>
                  {fer > 0 && <span style={{color:'#2E4F26'}}>Fer: {fer}</span>}
                  {leo > 0 && <span style={{color:'#6B3E22'}}>Leo: {leo}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* List */}
      <div className="card" style={{ padding: 0 }}>
        {loading ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--arcilla)', fontSize: 13 }}>
            Cargando...
          </div>
        ) : viajesFiltrados.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--arcilla)', fontSize: 13 }}>
            Todavía no hay visitas registradas
          </div>
        ) : (
          <div>

            {viajesFiltrados.map((v, i) => {
              const isEdit = editando?.id === v.id
              if (isEdit) return (
                <form key={v.id} onSubmit={handleUpdate} style={{
                  padding: '12px 16px', borderBottom: i < viajesFiltrados.length - 1 ? '1px solid var(--border-light)' : 'none',
                  background: '#FFF9EE', display: 'flex', flexDirection: 'column', gap: 10
                }}>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <div className="field" style={{ minWidth: 130 }}>
                      <label className="label">Fecha</label>
                      <input className="input" type="date" value={editando.fecha}
                        onChange={e => setEditando(p => ({ ...p, fecha: e.target.value }))} required />
                    </div>
                    <div className="field" style={{ minWidth: 100 }}>
                      <label className="label">Quién</label>
                      <select className="select" value={editando.quien}
                        onChange={e => setEditando(p => ({ ...p, quien: e.target.value }))}>
                        <option>Fer</option><option>Leo</option>
                      </select>
                    </div>
                    <div className="field" style={{ flex: 1, minWidth: 160 }}>
                      <label className="label">Categoría</label>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {CATEGORIAS.map(c => (
                          <button key={c} type="button" onClick={() => setEditando(p => ({ ...p, categoria: c }))}
                            style={{ padding: '5px 10px', borderRadius: 20, fontSize: 11, cursor: 'pointer', border: '1px solid', fontFamily: 'inherit',
                              background: editando.categoria === c ? 'var(--pasto)' : 'transparent',
                              color: editando.categoria === c ? '#F5F0E4' : 'var(--arcilla)',
                              borderColor: editando.categoria === c ? 'var(--pasto)' : 'var(--border)' }}>
                            {c}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <input className="input" value={editando.motivo || ''} placeholder="Motivo / tarea"
                      onChange={e => setEditando(p => ({ ...p, motivo: e.target.value }))}
                      style={{ flex: 1 }} />
                    <input className="input" value={editando.observaciones || ''} placeholder="Observaciones"
                      onChange={e => setEditando(p => ({ ...p, observaciones: e.target.value }))}
                      style={{ flex: 1 }} />
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-primary btn-sm" type="submit">✓ Guardar</button>
                    <button className="btn btn-secondary btn-sm" type="button" onClick={() => setEditando(null)}>Cancelar</button>
                    <button type="button" onClick={() => handleDelete(v.id)}
                      style={{ marginLeft: 'auto', padding: '4px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer', border: '1px solid #F0997B', background: '#FAECE7', color: '#993C1D', fontFamily: 'inherit' }}>
                      🗑 Eliminar
                    </button>
                  </div>
                </form>
              )
              return (
                <div key={v.id} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 16px',
                  borderBottom: i < viajesFiltrados.length - 1 ? '1px solid var(--border-light)' : 'none'
                }}>
                  <div style={{
                    width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                    background: v.quien === 'Fer' ? 'var(--verde-light)' : '#F5EDD8',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 600,
                    color: v.quien === 'Fer' ? 'var(--musgo)' : '#6B3E22'
                  }}>{v.quien}</div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--tierra)' }}>
                        {v.motivo || 'Visita al campo'}
                      </span>
                      <span className={`chip ${chipClass(v.categoria)}`}>{v.categoria}</span>
                    </div>
                    {v.observaciones && (
                      <div style={{ fontSize: 12, color: 'var(--arcilla)', marginTop: 3 }}>{v.observaciones}</div>
                    )}
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
                      {new Date(v.fecha + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </div>
                  </div>

                  {canEdit && (
                    <button onClick={() => setEditando({ ...v })}
                      style={{ flexShrink: 0, background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', color: 'var(--arcilla)', fontFamily: 'inherit' }}>
                      Editar
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
