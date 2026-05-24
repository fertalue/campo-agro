import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

const CENTROS = ['Producción','Costos únicos','Comercializacion','Alquiler','Administrativo','Mantenimiento de infraestructura','Inversiones / infraestructura','Servicios']
const CAMPANHAS = ['25-26','24-25','23-24']
const PRIORIDADES = ['alta','media','baja']
const ESTADOS = ['pendiente','en_progreso','hecho']

const PRIO_COLOR = { alta:'#993C1D', media:'#6B3E22', baja:'#4A7C3F' }
const PRIO_BG    = { alta:'#FAECE7', media:'#F5EDD8', baja:'#EBF4E8' }
const PRIO_BD    = { alta:'#F0997B', media:'#C8A96E', baja:'#9DC87A' }
const ESTADO_COLOR = { pendiente:'#A08060', en_progreso:'#2C5A6A', hecho:'#2E4F26' }
const ESTADO_BG    = { pendiente:'#EFECE4', en_progreso:'#E4F0F4', hecho:'#EBF4E8' }
const ESTADO_LABEL = { pendiente:'Pendiente', en_progreso:'En progreso', hecho:'✓ Hecho' }

function fmtFecha(f) {
  if (!f) return '—'
  return new Date(f+'T12:00:00').toLocaleDateString('es-AR',{day:'2-digit',month:'short',year:'2-digit'})
}
function fmtCantidad(v) {
  return v === 0.5 ? '½ día' : v === 1 ? '1 día' : `${v} días`
}

// ── FormTarea ────────────────────────────────────────────────────────────────
function FormTarea({ tarea, onSave, onCancel, categorias = ['Campo','Taller','Infraestructura','Otro'] }) {
  const isEdit = !!tarea
  const [form, setForm] = useState(tarea ? {
    titulo: tarea.titulo, descripcion: tarea.descripcion||'',
    prioridad: tarea.prioridad, estado: tarea.estado,
    categoria: tarea.categoria||'Campo', campanha: tarea.campanha||'25-26',
  } : { titulo:'', descripcion:'', prioridad:'media', estado:'pendiente', categoria:'Campo', campanha:'25-26' })
  const f = (k,v) => setForm(p=>({...p,[k]:v}))
  const [saving, setSaving] = useState(false)

  async function save(e) {
    e.preventDefault(); setSaving(true)
    if (isEdit) {
      await supabase.from('trabajos_tareas').update({...form, updated_at: new Date().toISOString()}).eq('id', tarea.id)
    } else {
      await supabase.from('trabajos_tareas').insert(form)
    }
    setSaving(false); onSave()
  }

  const si = {padding:'7px 10px',border:'1px solid #D8C9A8',borderRadius:7,fontSize:13,fontFamily:'inherit',width:'100%',background:'#FDFAF4'}

  return (
    <div className="card mb-3" style={{background:'#F9F6EE',borderColor:'var(--paja)'}}>
      <h3 style={{marginBottom:14}}>{isEdit ? 'Editar tarea' : 'Nueva tarea'}</h3>
      <form onSubmit={save} style={{display:'flex',flexDirection:'column',gap:12}}>
        <div className="field"><label className="label">Título</label>
          <input style={si} value={form.titulo} onChange={e=>f('titulo',e.target.value)} placeholder="¿Qué hay que hacer?" required/>
        </div>
        <div className="field"><label className="label">Descripción</label>
          <textarea style={{...si,minHeight:60}} value={form.descripcion} onChange={e=>f('descripcion',e.target.value)} placeholder="Detalles, materiales necesarios, etc."/>
        </div>
        <div className="grid-2">
          <div className="field"><label className="label">Prioridad</label>
            <div style={{display:'flex',gap:6}}>
              {PRIORIDADES.map(p=>(
                <button key={p} type="button" onClick={()=>f('prioridad',p)}
                  style={{flex:1,padding:'7px 4px',borderRadius:6,fontSize:12,cursor:'pointer',border:`1px solid ${PRIO_BD[p]}`,fontFamily:'inherit',
                    background:form.prioridad===p?PRIO_BG[p]:'transparent',color:form.prioridad===p?PRIO_COLOR[p]:'var(--arcilla)',fontWeight:form.prioridad===p?600:400}}>
                  {p.charAt(0).toUpperCase()+p.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div className="field"><label className="label">Estado</label>
            <select style={si} value={form.estado} onChange={e=>f('estado',e.target.value)}>
              {ESTADOS.map(s=><option key={s} value={s}>{ESTADO_LABEL[s]}</option>)}
            </select>
          </div>
        </div>
        <div className="grid-2">
          <div className="field"><label className="label">Categoría</label>
            <select style={si} value={form.categoria} onChange={e=>f('categoria',e.target.value)}>
              {categorias.map(c=><option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="field"><label className="label">Campaña</label>
            <select style={si} value={form.campanha} onChange={e=>f('campanha',e.target.value)}>
              {CAMPANHAS.map(c=><option key={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div style={{display:'flex',gap:8}}>
          <button className="btn btn-primary" type="submit" disabled={saving}>{saving?'Guardando...':isEdit?'Guardar cambios':'Crear tarea'}</button>
          <button className="btn btn-secondary" type="button" onClick={onCancel}>Cancelar</button>
        </div>
      </form>
    </div>
  )
}

// ── FormRegistro ─────────────────────────────────────────────────────────────
function FormRegistro({ tareas, quienRegistra, onSave, onCancel }) {
  const [form, setForm] = useState({
    fecha: new Date().toISOString().split('T')[0],
    cantidad: 1,
    descripcion: '',
    tarea_id: '',
    campanha: '25-26',
  })
  const [centros, setCentros] = useState([{ centro: 'Producción', pct: 100 }])
  const [saving, setSaving] = useState(false)
  const f = (k,v) => setForm(p=>({...p,[k]:v}))

  const totalPct = centros.reduce((a,c)=>a+(parseFloat(c.pct)||0),0)
  const pctOk    = Math.abs(totalPct - 100) < 0.1

  function updateCentro(i, k, v) {
    setCentros(prev => prev.map((c,idx) => idx===i ? {...c,[k]:v} : c))
  }
  function addCentro() {
    if (centros.length >= CENTROS.length) return
    setCentros(prev => [...prev, { centro: CENTROS.find(c=>!prev.map(p=>p.centro).includes(c))||CENTROS[0], pct: 0 }])
  }
  function removeCentro(i) {
    if (centros.length <= 1) return
    setCentros(prev => prev.filter((_,idx)=>idx!==i))
  }

  async function save(e) {
    e.preventDefault()
    if (!pctOk) { alert('Los porcentajes de centro de costos deben sumar 100%'); return }
    setSaving(true)
    await supabase.from('trabajos_registros').insert({
      fecha: form.fecha,
      cantidad: form.cantidad,
      descripcion: form.descripcion || null,
      tarea_id: form.tarea_id || null,
      campanha: form.campanha,
      centros_costos: centros,
      quien_registro: quienRegistra,
    })
    setSaving(false); onSave()
  }

  const si = {padding:'7px 10px',border:'1px solid #D8C9A8',borderRadius:7,fontSize:13,fontFamily:'inherit',width:'100%',background:'#FDFAF4'}

  return (
    <div className="card mb-3" style={{background:'#F5F9F0',borderColor:'var(--brote)'}}>
      <h3 style={{marginBottom:14}}>Registrar jornada — Santi</h3>
      <form onSubmit={save} style={{display:'flex',flexDirection:'column',gap:12}}>
        <div className="grid-2">
          <div className="field"><label className="label">Fecha</label>
            <input style={si} type="date" value={form.fecha} onChange={e=>f('fecha',e.target.value)} required/>
          </div>
          <div className="field"><label className="label">Cantidad trabajada</label>
            <div style={{display:'flex',gap:6}}>
              {[[0.5,'½ día'],[1,'1 día completo']].map(([val,lbl])=>(
                <button key={val} type="button" onClick={()=>f('cantidad',val)}
                  style={{flex:1,padding:'8px 6px',borderRadius:7,fontSize:13,cursor:'pointer',border:'1px solid',fontFamily:'inherit',
                    background:form.cantidad===val?'var(--pasto)':'transparent',
                    color:form.cantidad===val?'#F5F0E4':'var(--arcilla)',
                    borderColor:form.cantidad===val?'var(--pasto)':'var(--border)',
                    fontWeight:form.cantidad===val?600:400}}>
                  {lbl}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid-2">
          <div className="field"><label className="label">Tarea asociada (opcional)</label>
            <select style={si} value={form.tarea_id} onChange={e=>f('tarea_id',e.target.value)}>
              <option value="">— Sin tarea específica —</option>
              {tareas.filter(t=>t.estado!=='hecho').map(t=>(
                <option key={t.id} value={t.id}>{t.titulo}</option>
              ))}
            </select>
          </div>
          <div className="field"><label className="label">Campaña</label>
            <select style={si} value={form.campanha} onChange={e=>f('campanha',e.target.value)}>
              {CAMPANHAS.map(c=><option key={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div className="field"><label className="label">Descripción del trabajo</label>
          <textarea style={{...si,minHeight:60}} value={form.descripcion} onChange={e=>f('descripcion',e.target.value)}
            placeholder="Qué se hizo, dónde, con qué materiales..."/>
        </div>

        {/* Centros de costos */}
        <div style={{background:'#EAF2F8',border:'1px solid #7A9EAD',borderRadius:8,padding:'12px 14px'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
            <div style={{fontSize:11,fontWeight:600,color:'#2C5A6A',textTransform:'uppercase',letterSpacing:'0.05em'}}>Centro de costos</div>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <span style={{fontSize:11,color:pctOk?'#2E4F26':'#993C1D',fontWeight:600}}>Total: {totalPct.toFixed(0)}%</span>
              <button type="button" onClick={addCentro}
                style={{padding:'3px 10px',borderRadius:5,fontSize:11,cursor:'pointer',border:'1px solid #7A9EAD',background:'white',color:'#2C5A6A',fontFamily:'inherit'}}>
                + Centro
              </button>
            </div>
          </div>
          {centros.map((c,i)=>(
            <div key={i} style={{display:'flex',gap:8,alignItems:'center',marginBottom:8}}>
              <select value={c.centro} onChange={e=>updateCentro(i,'centro',e.target.value)}
                style={{flex:1,padding:'6px 8px',border:'1px solid #B8D0D8',borderRadius:6,fontSize:12,fontFamily:'inherit',background:'white'}}>
                {CENTROS.map(ct=><option key={ct}>{ct}</option>)}
              </select>
              <div style={{display:'flex',alignItems:'center',gap:4,flexShrink:0}}>
                <input type="number" min="0" max="100" step="5" value={c.pct}
                  onChange={e=>updateCentro(i,'pct',e.target.value)}
                  style={{width:64,padding:'6px 8px',border:'1px solid #B8D0D8',borderRadius:6,fontSize:12,fontFamily:'inherit',textAlign:'right'}}/>
                <span style={{fontSize:12,color:'#4E7A8A'}}>%</span>
              </div>
              {centros.length > 1 && (
                <button type="button" onClick={()=>removeCentro(i)}
                  style={{width:24,height:24,borderRadius:4,border:'1px solid #F0997B',background:'#FAECE7',color:'#993C1D',cursor:'pointer',fontSize:13,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                  ×
                </button>
              )}
            </div>
          ))}
          {!pctOk && <div style={{fontSize:11,color:'#993C1D',marginTop:4}}>⚠ Los porcentajes deben sumar 100%</div>}
        </div>

        {quienRegistra && (
          <div style={{fontSize:11,color:'var(--text-muted)'}}>Registrado como: <strong>{quienRegistra}</strong></div>
        )}
        <div style={{display:'flex',gap:8}}>
          <button className="btn btn-primary" type="submit" disabled={saving||!pctOk}>{saving?'Guardando...':'Guardar jornada'}</button>
          <button className="btn btn-secondary" type="button" onClick={onCancel}>Cancelar</button>
        </div>
      </form>
    </div>
  )
}

// ── Componente principal ─────────────────────────────────────────────────────
export default function Trabajos() {
  const { user, puedeEditar, isAdmin } = useAuth()
  const canEdit = isAdmin || puedeEditar('trabajos')
  const quienRegistra = user?.user_metadata?.nombre || user?.email || ''

  const [tab, setTab]         = useState('organizacion')
  const [tareas, setTareas]       = useState([])
  const [categorias, setCategorias] = useState(['Campo','Taller','Infraestructura','Administración','Otro'])
  const [registros, setRegistros] = useState([])
  const [loading, setLoading] = useState(true)

  // Estados UI
  const [showFormTarea, setShowFormTarea]       = useState(false)
  const [showFormRegistro, setShowFormRegistro] = useState(false)
  const [editTarea, setEditTarea]               = useState(null)

  // Filtros registros
  const [fCampanha, setFCampanha] = useState('todas')
  const [fMes, setFMes]           = useState('todos')

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [{ data: t }, { data: r }, { data: cats }] = await Promise.all([
      supabase.from('trabajos_tareas').select('*').order('orden').order('created_at'),
      supabase.from('trabajos_registros').select('*').order('fecha', { ascending: false }),
      supabase.from('maestros').select('valor').eq('tipo','categoria_trabajo').eq('activo',true).order('orden'),
    ])
    setTareas(t || [])
    setRegistros(r || [])
    if (cats?.length) setCategorias(cats.map(c => c.valor))
    setLoading(false)
  }

  async function deleteTarea(id) {
    if (!confirm('¿Eliminar esta tarea?')) return
    await supabase.from('trabajos_tareas').delete().eq('id', id)
    await fetchAll()
  }
  async function deleteRegistro(id) {
    if (!confirm('¿Eliminar este registro?')) return
    await supabase.from('trabajos_registros').delete().eq('id', id)
    await fetchAll()
  }
  async function setEstado(id, estado) {
    await supabase.from('trabajos_tareas').update({ estado, updated_at: new Date().toISOString() }).eq('id', id)
    await fetchAll()
  }

  // ── Stats registros ─────────────────────────────────────────────────────
  const registrosFiltrados = registros.filter(r => {
    if (fCampanha !== 'todas' && r.campanha !== fCampanha) return false
    if (fMes !== 'todos' && !r.fecha?.startsWith(fMes)) return false
    return true
  })
  const totalDias    = registrosFiltrados.reduce((a,r)=>a+(r.cantidad||0),0)
  const mesesDisp    = [...new Set(registros.map(r=>r.fecha?.slice(0,7)).filter(Boolean))].sort().reverse()

  // ── Kanban ─────────────────────────────────────────────────────────────
  const kanbanCols = ESTADOS.map(estado => ({
    estado,
    tareas: tareas.filter(t => t.estado === estado)
  }))

  const ESTADO_ICON = { pendiente:'○', en_progreso:'◐', hecho:'●' }

  return (
    <div>
      {/* Header */}
      <div className="flex-between mb-2">
        <div>
          <h2>Trabajos</h2>
          <p style={{fontSize:12,color:'var(--arcilla)',marginTop:2}}>
            {tareas.filter(t=>t.estado!=='hecho').length} tareas pendientes · {totalDias} días registrados
          </p>
        </div>
        <div style={{display:'flex',gap:8}}>
          {tab === 'organizacion' && canEdit && (
            <button className="btn btn-primary btn-sm" onClick={()=>{ setShowFormTarea(v=>!v); setEditTarea(null) }}>
              {showFormTarea&&!editTarea ? 'Cancelar' : '+ Nueva tarea'}
            </button>
          )}
          {tab === 'registros' && canEdit && (
            <button className="btn btn-primary btn-sm" onClick={()=>setShowFormRegistro(v=>!v)}>
              {showFormRegistro ? 'Cancelar' : '+ Registrar jornada'}
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{display:'flex',gap:4,marginBottom:16,borderBottom:'1px solid #D8C9A8'}}>
        {[['organizacion','Organización'],['registros','Días trabajados']].map(([id,lbl])=>(
          <button key={id} onClick={()=>setTab(id)}
            style={{padding:'8px 16px',fontSize:12,cursor:'pointer',borderRadius:'8px 8px 0 0',border:'1px solid transparent',borderBottom:'none',
              fontFamily:'inherit',marginBottom:-1,transition:'all .15s',
              background:tab===id?'#FDFAF4':'transparent',
              borderColor:tab===id?'#D8C9A8':'transparent',
              color:tab===id?'#3B2E1E':'#A08060',fontWeight:tab===id?500:400}}>
            {lbl}
          </button>
        ))}
      </div>

      {/* ── TAB ORGANIZACIÓN ── */}
      {tab === 'organizacion' && (
        <div>
          {/* Form nueva tarea */}
          {(showFormTarea || editTarea) && canEdit && (
            <FormTarea
              key={editTarea?.id || 'new'}
              categorias={categorias}
              tarea={editTarea}
              onSave={async()=>{ setShowFormTarea(false); setEditTarea(null); await fetchAll() }}
              onCancel={()=>{ setShowFormTarea(false); setEditTarea(null) }}
            />
          )}

          {/* Stats rápidas */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,minmax(0,1fr))',gap:10,marginBottom:20}}>
            {ESTADOS.map(estado=>{
              const n = tareas.filter(t=>t.estado===estado).length
              return (
                <div key={estado} className="stat-card">
                  <div className="stat-label">{ESTADO_LABEL[estado]}</div>
                  <div className="stat-value" style={{color:ESTADO_COLOR[estado]}}>{n}</div>
                  <div className="stat-sub">{n===1?'tarea':'tareas'}</div>
                  <div className="stat-bar"><div className="stat-fill" style={{width:`${tareas.length?n/tareas.length*100:0}%`,background:ESTADO_COLOR[estado]}}/></div>
                </div>
              )
            })}
          </div>

          {/* Kanban */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,minmax(0,1fr))',gap:14}}>
            {kanbanCols.map(({estado, tareas: cols})=>(
              <div key={estado}>
                {/* Header columna */}
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10,padding:'6px 10px',background:ESTADO_BG[estado],borderRadius:8,border:`1px solid ${PRIO_BD.media}`}}>
                  <span style={{fontSize:14,color:ESTADO_COLOR[estado]}}>{ESTADO_ICON[estado]}</span>
                  <span style={{fontSize:12,fontWeight:600,color:ESTADO_COLOR[estado]}}>{ESTADO_LABEL[estado]}</span>
                  <span style={{marginLeft:'auto',fontSize:11,color:'var(--text-muted)',background:'white',borderRadius:10,padding:'1px 7px'}}>{cols.length}</span>
                </div>

                {/* Tarjetas */}
                <div style={{display:'flex',flexDirection:'column',gap:8,minHeight:80}}>
                  {loading ? (
                    <div style={{fontSize:12,color:'var(--arcilla)',textAlign:'center',padding:16}}>Cargando...</div>
                  ) : cols.length === 0 ? (
                    <div style={{fontSize:11,color:'var(--text-muted)',textAlign:'center',padding:16,borderRadius:8,border:'1px dashed #D8C9A8'}}>
                      Sin tareas
                    </div>
                  ) : cols.map(t=>(
                    <div key={t.id} style={{background:'#FDFAF4',border:`1px solid ${PRIO_BD[t.prioridad]}`,borderRadius:10,padding:'12px 14px',borderLeft:`3px solid ${PRIO_COLOR[t.prioridad]}`}}>
                      {/* Badges */}
                      <div style={{display:'flex',gap:5,marginBottom:8,flexWrap:'wrap'}}>
                        <span style={{fontSize:9,fontWeight:600,background:PRIO_BG[t.prioridad],color:PRIO_COLOR[t.prioridad],borderRadius:20,padding:'2px 7px',textTransform:'uppercase'}}>
                          {t.prioridad}
                        </span>
                        {t.categoria && (
                          <span style={{fontSize:9,background:'#EFECE4',color:'#7A6040',borderRadius:20,padding:'2px 7px'}}>{t.categoria}</span>
                        )}
                        {t.campanha && (
                          <span style={{fontSize:9,background:'#E4F0F4',color:'#2C5A6A',borderRadius:20,padding:'2px 7px'}}>{t.campanha}</span>
                        )}
                      </div>
                      {/* Título */}
                      <div style={{fontSize:13,fontWeight:500,color:'var(--tierra)',marginBottom:4,lineHeight:1.3}}>{t.titulo}</div>
                      {/* Descripción */}
                      {t.descripcion && (
                        <div style={{fontSize:11,color:'var(--text-muted)',marginBottom:8,lineHeight:1.4}}>{t.descripcion}</div>
                      )}
                      {/* Acciones */}
                      {canEdit && (
                        <div style={{display:'flex',gap:5,marginTop:8,flexWrap:'wrap'}}>
                          {/* Mover de estado */}
                          {estado !== 'en_progreso' && estado !== 'hecho' && (
                            <button onClick={()=>setEstado(t.id,'en_progreso')}
                              style={{fontSize:10,padding:'3px 8px',borderRadius:5,cursor:'pointer',border:'1px solid #7A9EAD',background:'#E4F0F4',color:'#2C5A6A',fontFamily:'inherit'}}>
                              → En progreso
                            </button>
                          )}
                          {estado !== 'hecho' && (
                            <button onClick={()=>setEstado(t.id,'hecho')}
                              style={{fontSize:10,padding:'3px 8px',borderRadius:5,cursor:'pointer',border:'1px solid #9DC87A',background:'#EBF4E8',color:'#2E4F26',fontFamily:'inherit'}}>
                              ✓ Hecho
                            </button>
                          )}
                          {estado === 'hecho' && (
                            <button onClick={()=>setEstado(t.id,'pendiente')}
                              style={{fontSize:10,padding:'3px 8px',borderRadius:5,cursor:'pointer',border:'1px solid #D8C9A8',background:'#EFECE4',color:'#7A6040',fontFamily:'inherit'}}>
                              ↺ Reabrir
                            </button>
                          )}
                          <button onClick={()=>{ setEditTarea(t); setShowFormTarea(false) }}
                            style={{fontSize:10,padding:'3px 8px',borderRadius:5,cursor:'pointer',border:'1px solid var(--border)',background:'transparent',color:'var(--arcilla)',fontFamily:'inherit',marginLeft:'auto'}}>
                            Editar
                          </button>
                          <button onClick={()=>deleteTarea(t.id)}
                            style={{fontSize:10,padding:'3px 8px',borderRadius:5,cursor:'pointer',border:'1px solid #F0997B',background:'#FAECE7',color:'#993C1D',fontFamily:'inherit'}}>
                            🗑
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB REGISTROS ── */}
      {tab === 'registros' && (
        <div>
          {/* Form registro */}
          {showFormRegistro && canEdit && (
            <FormRegistro
              tareas={tareas}
              quienRegistra={quienRegistra}
              onSave={async()=>{ setShowFormRegistro(false); await fetchAll() }}
              onCancel={()=>setShowFormRegistro(false)}
            />
          )}

          {/* Stats */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,minmax(0,1fr))',gap:10,marginBottom:16}}>
            {[
              ['Total días',`${registros.reduce((a,r)=>a+(r.cantidad||0),0)} días`,`${registros.length} jornadas`,'#4A7C3F'],
              ['Este mes',`${registros.filter(r=>r.fecha?.startsWith(new Date().toISOString().slice(0,7))).reduce((a,r)=>a+(r.cantidad||0),0)} días`,new Date().toLocaleDateString('es-AR',{month:'long',year:'numeric'}),'#7A9EAD'],
              ['Filtrado',`${totalDias} días`,`${registrosFiltrados.length} jornadas`,'#A0714F'],
            ].map(([l,v,s,col])=>(
              <div key={l} className="stat-card">
                <div className="stat-label">{l}</div>
                <div className="stat-value" style={{color:col}}>{v}</div>
                <div className="stat-sub">{s}</div>
                <div className="stat-bar"><div className="stat-fill" style={{width:'70%',background:col}}/></div>
              </div>
            ))}
          </div>

          {/* Filtros */}
          <div style={{display:'flex',gap:10,marginBottom:14,flexWrap:'wrap',alignItems:'flex-end'}}>
            <div style={{display:'flex',flexDirection:'column',gap:3}}>
              <div style={{fontSize:10,fontWeight:600,color:'#A08060',textTransform:'uppercase',letterSpacing:'0.05em'}}>Campaña</div>
              <div style={{display:'flex',gap:4}}>
                {['todas',...CAMPANHAS].map(c=>(
                  <button key={c} onClick={()=>setFCampanha(c)}
                    style={{padding:'5px 10px',borderRadius:6,fontSize:11,cursor:'pointer',border:'1px solid',fontFamily:'inherit',
                      background:fCampanha===c?'#4A7C3F':'transparent',color:fCampanha===c?'#F5F0E4':'var(--arcilla)',borderColor:fCampanha===c?'#4A7C3F':'#D8C9A8'}}>
                    {c==='todas'?'Todas':c}
                  </button>
                ))}
              </div>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:3}}>
              <div style={{fontSize:10,fontWeight:600,color:'#A08060',textTransform:'uppercase',letterSpacing:'0.05em'}}>Mes</div>
              <select value={fMes} onChange={e=>setFMes(e.target.value)}
                style={{padding:'6px 10px',border:'1px solid #D8C9A8',borderRadius:6,fontSize:12,background:'#F5F0E4',fontFamily:'inherit'}}>
                <option value="todos">Todos los meses</option>
                {mesesDisp.map(m=><option key={m} value={m}>{new Date(m+'-01T12:00:00').toLocaleDateString('es-AR',{month:'long',year:'numeric'})}</option>)}
              </select>
            </div>
          </div>

          {/* Lista de registros */}
          <div className="card" style={{padding:0,overflowX:'auto'}}>
            {registrosFiltrados.length === 0 ? (
              <div style={{padding:32,textAlign:'center',fontSize:13,color:'var(--arcilla)'}}>Sin registros con estos filtros</div>
            ) : (
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                <thead>
                  <tr style={{background:'#EDE0C8'}}>
                    <th style={{padding:'8px 12px',textAlign:'left',fontSize:10,fontWeight:600,color:'#A08060',textTransform:'uppercase'}}>Fecha</th>
                    <th style={{padding:'8px 12px',textAlign:'center',fontSize:10,fontWeight:600,color:'#A08060',textTransform:'uppercase'}}>Cantidad</th>
                    <th style={{padding:'8px 12px',textAlign:'left',fontSize:10,fontWeight:600,color:'#A08060',textTransform:'uppercase'}}>Descripción / Tarea</th>
                    <th style={{padding:'8px 12px',textAlign:'left',fontSize:10,fontWeight:600,color:'#A08060',textTransform:'uppercase'}}>Centros de costo</th>
                    <th style={{padding:'8px 12px',textAlign:'left',fontSize:10,fontWeight:600,color:'#A08060',textTransform:'uppercase'}}>Campaña</th>
                    {canEdit && <th></th>}
                  </tr>
                </thead>
                <tbody>
                  {registrosFiltrados.map(r=>{
                    const tarea = tareas.find(t=>t.id===r.tarea_id)
                    return (
                      <tr key={r.id} style={{borderBottom:'1px solid #EDE0C8'}}>
                        <td style={{padding:'10px 12px',whiteSpace:'nowrap',color:'var(--text-muted)'}}>{fmtFecha(r.fecha)}</td>
                        <td style={{padding:'10px 12px',textAlign:'center'}}>
                          <span style={{background:r.cantidad===1?'#EBF4E8':'#F5EDD8',color:r.cantidad===1?'#2E4F26':'#6B3E22',borderRadius:20,padding:'3px 10px',fontSize:11,fontWeight:600,whiteSpace:'nowrap'}}>
                            {fmtCantidad(r.cantidad)}
                          </span>
                        </td>
                        <td style={{padding:'10px 12px',maxWidth:200}}>
                          {tarea && <div style={{fontSize:11,fontWeight:600,color:'var(--tierra)',marginBottom:2}}>{tarea.titulo}</div>}
                          {r.descripcion && <div style={{fontSize:11,color:'var(--text-muted)',lineHeight:1.3}}>{r.descripcion}</div>}
                          {!tarea && !r.descripcion && <span style={{color:'var(--text-muted)'}}>—</span>}
                        </td>
                        <td style={{padding:'10px 12px'}}>
                          <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                            {(r.centros_costos||[]).map((c,i)=>(
                              <span key={i} style={{fontSize:10,background:'#E4F0F4',color:'#2C5A6A',borderRadius:20,padding:'2px 7px',whiteSpace:'nowrap'}}>
                                {c.centro} {c.pct}%
                              </span>
                            ))}
                          </div>
                        </td>
                        <td style={{padding:'10px 12px'}}>
                          <span style={{fontSize:10,background:'#EFECE4',color:'#7A6040',borderRadius:20,padding:'2px 7px'}}>{r.campanha||'—'}</span>
                        </td>
                        {canEdit && (
                          <td style={{padding:'10px 12px'}}>
                            <button onClick={()=>deleteRegistro(r.id)}
                              style={{background:'#FAECE7',border:'1px solid #F0997B',borderRadius:5,padding:'3px 8px',fontSize:11,cursor:'pointer',color:'#993C1D'}}>
                              🗑
                            </button>
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr style={{background:'#F5F0E4',fontWeight:600}}>
                    <td style={{padding:'10px 12px',fontSize:11,color:'var(--text-muted)'}}>{registrosFiltrados.length} jornadas</td>
                    <td style={{padding:'10px 12px',textAlign:'center',color:'#2E4F26'}}>{totalDias} días</td>
                    <td colSpan={4}></td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
