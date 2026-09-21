import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { cargarMaestro } from '../lib/maestros'

const CAMPANHAS = ['26-27','25-26','24-25','23-24']
cargarMaestro('campanha', CAMPANHAS)
const PRIORIDADES = ['alta','media','baja']
const ESTADOS = ['pendiente','en_progreso','hecho']

const PRIO_COLOR = { alta:'#993C1D', media:'#6B3E22', baja:'#4A7C3F' }
const PRIO_BG    = { alta:'#FAECE7', media:'#F5EDD8', baja:'#EBF4E8' }
const PRIO_BD    = { alta:'#F0997B', media:'#C8A96E', baja:'#9DC87A' }
const ESTADO_COLOR = { pendiente:'#A08060', en_progreso:'#2C5A6A', hecho:'#2E4F26' }
const ESTADO_BG    = { pendiente:'#EFECE4', en_progreso:'#E4F0F4', hecho:'#EBF4E8' }
const ESTADO_LABEL = { pendiente:'Pendiente', en_progreso:'En progreso', hecho:'✓ Hecho' }

// ── Feriados Argentina 2026 (incluye traslados oficiales) ─────────────────────
const FERIADOS_2026 = [
  { fecha:'2026-01-01', nombre:'Año Nuevo' },
  { fecha:'2026-02-16', nombre:'Carnaval' },
  { fecha:'2026-02-17', nombre:'Carnaval' },
  { fecha:'2026-03-24', nombre:'Día Nacional de la Memoria por la Verdad y la Justicia' },
  { fecha:'2026-04-02', nombre:'Día del Veterano y de los Caídos en la Guerra de Malvinas' },
  { fecha:'2026-04-03', nombre:'Viernes Santo' },
  { fecha:'2026-05-01', nombre:'Día del Trabajador' },
  { fecha:'2026-05-25', nombre:'Día de la Revolución de Mayo' },
  { fecha:'2026-06-15', nombre:'Paso a la Inmortalidad del Gral. Güemes (trasladado)' },
  { fecha:'2026-06-20', nombre:'Paso a la Inmortalidad del Gral. Belgrano' },
  { fecha:'2026-07-09', nombre:'Día de la Independencia' },
  { fecha:'2026-08-17', nombre:'Paso a la Inmortalidad del Gral. San Martín' },
  { fecha:'2026-10-12', nombre:'Día del Respeto a la Diversidad Cultural' },
  { fecha:'2026-11-23', nombre:'Día de la Soberanía Nacional (trasladado)' },
  { fecha:'2026-12-08', nombre:'Inmaculada Concepción de María' },
  { fecha:'2026-12-25', nombre:'Navidad' },
]
const FERIADOS_SET = new Set(FERIADOS_2026.map(f=>f.fecha))

// domingo/feriado = 'rojo' · sábado = 'amarillo' · resto = 'gris'
function tipoDia(fecha) {
  if (!fecha) return 'gris'
  const d = new Date(fecha+'T12:00:00')
  const dow = d.getDay()
  if (dow === 0 || FERIADOS_SET.has(fecha)) return 'rojo'
  if (dow === 6) return 'amarillo'
  return 'gris'
}

function fmtFecha(f) {
  if (!f) return '—'
  return new Date(f+'T12:00:00').toLocaleDateString('es-AR',{day:'2-digit',month:'short',year:'2-digit',weekday:'short'})
}
function fmtCantidad(v) {
  return v === 0.5 ? '½ día' : v === 1 ? '1 día' : v === 2 ? '2 días (doble)' : `${v} días`
}
function esNoTrabajado(r) {
  return r?.tipo === 'no_trabajado'
}
function fmtNum(n) {
  return n.toLocaleString('es-AR', { minimumFractionDigits: n % 1 === 0 ? 0 : 1, maximumFractionDigits: 1 })
}

// ── MiniCalendario ──────────────────────────────────────────────────────────
const DIAS_SEMANA = ['L','M','M','J','V','S','D']
const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']
const TIPO_COLOR = {
  rojo:     { bg:'#FAECE7', border:'#F0997B', text:'#993C1D' },
  amarillo: { bg:'#F5EDD8', border:'#C8A96E', text:'#6B3E22' },
  gris:     { bg:'#EFECE4', border:'#D8C9A8', text:'#7A6040' },
}
const VERDE = { bg:'#EBF4E8', border:'#9DC87A', text:'#2E4F26' }
const AUSENTE = { bg:'#EDE7F6', border:'#B39DDB', text:'#5B3E96' } // día marcado explícitamente como no trabajado

// ── Texturas: rayas = medio día trabajado · puntos = no trabajado · sólido = día completo
const rayas = (color) => `repeating-linear-gradient(45deg, ${color}55 0px, ${color}55 3px, transparent 3px, transparent 7px)`
const puntos = (color) => `radial-gradient(${color}70 1.3px, transparent 1.4px)`

function estiloTextura(estado, color) {
  if (estado === 'medioDia') return { backgroundImage: rayas(color) }
  if (estado === 'noTrabajado') return { backgroundImage: puntos(color), backgroundSize:'7px 7px' }
  return { backgroundImage: 'none' }
}

function Leyenda({ bg, border, label, textura }) {
  const patron = textura==='rayas' ? rayas(border) : textura==='puntos' ? puntos(border) : 'none'
  return (
    <span style={{display:'inline-flex',alignItems:'center',gap:4,fontSize:9,color:'var(--text-muted)'}}>
      <span style={{width:10,height:10,borderRadius:2,backgroundColor:bg,backgroundImage:patron,backgroundSize:textura==='puntos'?'5px 5px':'auto',border:`1px solid ${border}`,display:'inline-block'}}/>
      {label}
    </span>
  )
}

function MiniCalendario({ seleccion, onToggle, registros, modo }) {
  const inicial = seleccion[0] ? new Date(seleccion[0]+'T12:00:00') : new Date()
  const [viewY, setViewY] = useState(inicial.getFullYear())
  const [viewM, setViewM] = useState(inicial.getMonth())

  const regByFecha = {}
  registros.forEach(r => { if (r.fecha) regByFecha[r.fecha] = r })
  const seleccionSet = new Set(seleccion)

  const primerDia  = new Date(viewY, viewM, 1)
  const diasEnMes  = new Date(viewY, viewM+1, 0).getDate()
  const offset     = (primerDia.getDay()+6)%7 // lunes = 0

  const celdas = []
  for (let i=0;i<offset;i++) celdas.push(null)
  for (let d=1; d<=diasEnMes; d++) celdas.push(d)

  const hoy = new Date().toISOString().slice(0,10)

  // hábiles y sábados sin trabajar (asumidos o marcados explícitamente) = déficit
  // hábil sin trabajar = -1 día · hábil trabajado medio día = -0,5 día · sábado sin trabajar = -0,5 día (solo se espera medio día)
  let habilesFaltantes = 0, habilesMedioDia = 0, sabadosFaltantes = 0, noRegistrados = 0, domFerTrabajado = 0
  for (let d=1; d<=diasEnMes; d++) {
    const fecha = `${viewY}-${String(viewM+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
    const tipo = tipoDia(fecha)
    const reg = regByFecha[fecha]
    const trabajado = !!reg && !esNoTrabajado(reg)
    const esPasado = fecha <= hoy
    if (tipo==='gris' && !trabajado && esPasado) habilesFaltantes++
    if (tipo==='gris' && trabajado && reg.cantidad===0.5) habilesMedioDia++
    if (tipo==='amarillo' && !trabajado && esPasado) sabadosFaltantes++
    if (tipo!=='rojo' && !reg && esPasado) noRegistrados++
    if (tipo==='rojo' && trabajado) domFerTrabajado += (reg.cantidad||0)
  }
  const totalNoTrabajados = habilesFaltantes + habilesMedioDia*0.5 + sabadosFaltantes*0.5

  function cambiarMes(delta) {
    let m = viewM+delta, y = viewY
    if (m<0){m=11;y--}
    if (m>11){m=0;y++}
    setViewM(m); setViewY(y)
  }

  const navBtn = {width:24,height:24,borderRadius:5,border:'1px solid #D8C9A8',background:'transparent',cursor:'pointer',fontFamily:'inherit',fontSize:14,color:'var(--arcilla)'}
  const anilloSel = modo==='no_trabajado' ? AUSENTE.text : '#2E4F26'

  return (
    <div style={{display:'flex',gap:16,flexWrap:'wrap',alignItems:'flex-start'}}>
      <div style={{minWidth:250,flex:'0 0 auto'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
          <button type="button" onClick={()=>cambiarMes(-1)} style={navBtn}>‹</button>
          <span style={{fontSize:12,fontWeight:600,color:'var(--tierra)',textTransform:'capitalize'}}>{MESES[viewM]} {viewY}</span>
          <button type="button" onClick={()=>cambiarMes(1)} style={navBtn}>›</button>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:3,marginBottom:3}}>
          {DIAS_SEMANA.map((d,i)=><div key={i} style={{fontSize:9,textAlign:'center',color:'#A08060',fontWeight:600}}>{d}</div>)}
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:3}}>
          {celdas.map((d,i)=>{
            if (!d) return <div key={i}/>
            const fecha = `${viewY}-${String(viewM+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
            const reg = regByFecha[fecha]
            const tipo = tipoDia(fecha)
            const esPasadoCelda = fecha <= hoy
            let col, estado
            if (reg && !esNoTrabajado(reg)) {
              col = VERDE
              estado = reg.cantidad === 0.5 ? 'medioDia' : 'completo'
            } else if (reg && esNoTrabajado(reg)) {
              col = AUSENTE
              estado = 'noTrabajado'
            } else {
              col = TIPO_COLOR[tipo]
              estado = (tipo !== 'rojo' && esPasadoCelda) ? 'noTrabajado' : null
            }
            const textura = estiloTextura(estado, col.border)
            const selected = seleccionSet.has(fecha)
            const feriado = FERIADOS_SET.has(fecha)
            return (
              <button key={i} type="button" onClick={()=>onToggle(fecha)}
                title={feriado ? 'Feriado' : tipo==='rojo' ? 'Domingo' : tipo==='amarillo' ? 'Sábado' : ''}
                style={{aspectRatio:'1',border:`1px solid ${selected?anilloSel:col.border}`,borderRadius:6,backgroundColor:col.bg,color:col.text,
                  ...textura,
                  fontSize:11,fontWeight:selected?700:500,cursor:'pointer',fontFamily:'inherit',position:'relative',
                  boxShadow:selected?`0 0 0 2px ${anilloSel}55`:'none',padding:0}}>
                {d}
                {selected && <span style={{position:'absolute',top:1,right:2,fontSize:8}}>✓</span>}
              </button>
            )
          })}
        </div>
        <div style={{display:'flex',gap:10,marginTop:8,flexWrap:'wrap'}}>
          <Leyenda bg={VERDE.bg} border={VERDE.border} label="Día completo trabajado"/>
          <Leyenda bg={VERDE.bg} border={VERDE.border} label="Medio día trabajado" textura="rayas"/>
          <Leyenda bg={AUSENTE.bg} border={AUSENTE.border} label="No trabajado" textura="puntos"/>
          <Leyenda bg={TIPO_COLOR.rojo.bg} border={TIPO_COLOR.rojo.border} label="Domingo/feriado"/>
          <Leyenda bg={TIPO_COLOR.amarillo.bg} border={TIPO_COLOR.amarillo.border} label="Sábado"/>
          <Leyenda bg={TIPO_COLOR.gris.bg} border={TIPO_COLOR.gris.border} label="Día hábil"/>
        </div>
        {seleccion.length > 0 && (
          <div style={{fontSize:10,color:'var(--text-muted)',marginTop:6}}>{seleccion.length} día{seleccion.length>1?'s':''} seleccionado{seleccion.length>1?'s':''}</div>
        )}
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:8,minWidth:190,flex:'1 1 190px'}}>
        <div className="stat-card" style={{padding:'10px 12px'}}>
          <div className="stat-label" style={{fontSize:10}}>Días no trabajados (debían trabajarse)</div>
          <div className="stat-value" style={{color:'#993C1D',fontSize:18}}>{fmtNum(totalNoTrabajados)}</div>
          <div className="stat-sub" style={{fontSize:10}}>
            {habilesFaltantes} hábil{habilesFaltantes===1?'':'es'}
            {habilesMedioDia>0 && ` + ${habilesMedioDia} medio día hábil${habilesMedioDia===1?'':'s'}`}
            {' '}+ {sabadosFaltantes} sábado{sabadosFaltantes===1?'':'s'} = {fmtNum(totalNoTrabajados)}
          </div>
        </div>
        <div className="stat-card" style={{padding:'10px 12px'}}>
          <div className="stat-label" style={{fontSize:10}}>Domingos/feriados trabajados</div>
          <div className="stat-value" style={{color:'#993C1D',fontSize:18}}>{fmtNum(domFerTrabajado*2)}</div>
          <div className="stat-sub" style={{fontSize:10}}>{fmtNum(domFerTrabajado)} día{domFerTrabajado===1?'':'s'} trabajado{domFerTrabajado===1?'':'s'} (vale doble) = {fmtNum(domFerTrabajado*2)}</div>
        </div>
        <div className="stat-card" style={{padding:'10px 12px'}}>
          <div className="stat-label" style={{fontSize:10}}>Días aún no registrados</div>
          <div className="stat-value" style={{color:'#6B3E22',fontSize:18}}>{noRegistrados}</div>
          <div className="stat-sub" style={{fontSize:10}}>hábiles/sábados sin cargar, antes de hoy</div>
        </div>
      </div>
    </div>
  )
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
function FormRegistro({ tareas, registros, quienRegistra, onSave, onCancel }) {
  const [modo, setModo] = useState('trabajado') // 'trabajado' | 'no_trabajado'
  const [fechas, setFechas] = useState([])
  const [form, setForm] = useState({
    cantidad: 1,
    descripcion: '',
    tarea_id: '',
    campanha: '25-26',
    observaciones: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const f = (k,v) => setForm(p=>({...p,[k]:v}))

  function toggleFecha(fecha) {
    setFechas(prev => prev.includes(fecha) ? prev.filter(x=>x!==fecha) : [...prev, fecha].sort())
  }

  const hayRojo = fechas.some(fc=>tipoDia(fc)==='rojo')
  const haySabado = fechas.some(fc=>tipoDia(fc)==='amarillo')
  const hayHabilMedioDia = modo==='trabajado' && form.cantidad===0.5 && fechas.some(fc=>tipoDia(fc)==='gris')

  async function save(e) {
    e.preventDefault()
    setError('')
    if (fechas.length === 0) { setError('Elegí al menos un día en el calendario'); return }
    if (modo === 'no_trabajado' && !form.observaciones.trim()) { setError('Contá el motivo en observaciones'); return }
    setSaving(true)
    // reemplaza cualquier registro previo de esos días (evita duplicados si se corrige)
    await supabase.from('trabajos_registros').delete().in('fecha', fechas)
    const filas = fechas.map(fecha => ({
      fecha,
      tipo: modo,
      cantidad: modo === 'trabajado' ? form.cantidad : 0,
      descripcion: modo === 'trabajado' ? (form.descripcion || null) : null,
      observaciones: modo === 'no_trabajado' ? form.observaciones.trim() : null,
      tarea_id: modo === 'trabajado' ? (form.tarea_id || null) : null,
      campanha: form.campanha,
      quien_registro: quienRegistra,
    }))
    const { error: err } = await supabase.from('trabajos_registros').insert(filas)
    setSaving(false)
    if (err) { setError(err.message); return }
    onSave()
  }

  const si = {padding:'7px 10px',border:'1px solid #D8C9A8',borderRadius:7,fontSize:13,fontFamily:'inherit',width:'100%',background:'#FDFAF4'}

  return (
    <div className="card mb-3" style={{background:'#F5F9F0',borderColor:'var(--brote)'}}>
      <h3 style={{marginBottom:14}}>Registrar jornada — Walter</h3>
      <form onSubmit={save} style={{display:'flex',flexDirection:'column',gap:12}}>
        <div className="field">
          <label className="label">Tipo de registro</label>
          <div style={{display:'flex',gap:6}}>
            <button type="button" onClick={()=>setModo('trabajado')}
              style={{flex:1,padding:'8px 6px',borderRadius:7,fontSize:13,cursor:'pointer',border:'1px solid',fontFamily:'inherit',
                background:modo==='trabajado'?VERDE.bg:'transparent',color:modo==='trabajado'?VERDE.text:'var(--arcilla)',
                borderColor:modo==='trabajado'?VERDE.border:'var(--border)',fontWeight:modo==='trabajado'?600:400}}>
              ✓ Trabajado
            </button>
            <button type="button" onClick={()=>setModo('no_trabajado')}
              style={{flex:1,padding:'8px 6px',borderRadius:7,fontSize:13,cursor:'pointer',border:'1px solid',fontFamily:'inherit',
                background:modo==='no_trabajado'?AUSENTE.bg:'transparent',color:modo==='no_trabajado'?AUSENTE.text:'var(--arcilla)',
                borderColor:modo==='no_trabajado'?AUSENTE.border:'var(--border)',fontWeight:modo==='no_trabajado'?600:400}}>
              ✕ No trabajado
            </button>
          </div>
        </div>

        <div className="field">
          <label className="label">Días (podés elegir varios en el calendario)</label>
          <MiniCalendario seleccion={fechas} onToggle={toggleFecha} registros={registros} modo={modo}/>
        </div>

        {fechas.length > 0 && (hayRojo || haySabado || hayHabilMedioDia) && (
          <div style={{fontSize:10,color:'#6B3E22',background:'#F5EDD8',border:'1px solid #C8A96E',borderRadius:6,padding:'6px 10px'}}>
            {hayRojo && modo==='trabajado' && <div>⚠ Hay domingos/feriados en la selección — cuentan doble.</div>}
            {haySabado && modo==='trabajado' && <div>Sábado — se espera solo medio día; día completo paga 1 día entero.</div>}
            {hayHabilMedioDia && <div>⚠ Medio día un día hábil (lunes a viernes) cuenta como medio día no trabajado.</div>}
          </div>
        )}

        {modo === 'trabajado' ? (
          <>
            <div className="grid-2">
              <div className="field"><label className="label">Cantidad trabajada (por día)</label>
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
              <div className="field"><label className="label">Tarea asociada (opcional)</label>
                <select style={si} value={form.tarea_id} onChange={e=>f('tarea_id',e.target.value)}>
                  <option value="">— Sin tarea específica —</option>
                  {tareas.filter(t=>t.estado!=='hecho').map(t=>(
                    <option key={t.id} value={t.id}>{t.titulo}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="field"><label className="label">Descripción del trabajo</label>
              <textarea style={{...si,minHeight:60}} value={form.descripcion} onChange={e=>f('descripcion',e.target.value)}
                placeholder="Qué se hizo, dónde, con qué materiales..."/>
            </div>
          </>
        ) : (
          <div className="field"><label className="label">Observaciones (motivo)</label>
            <textarea style={{...si,minHeight:60}} value={form.observaciones} onChange={e=>f('observaciones',e.target.value)}
              placeholder="Por qué no se trabajó: enfermedad, lluvia, franco, etc."/>
          </div>
        )}

        <div className="field"><label className="label">Campaña</label>
          <select style={si} value={form.campanha} onChange={e=>f('campanha',e.target.value)}>
            {CAMPANHAS.map(c=><option key={c}>{c}</option>)}
          </select>
        </div>

        {error && <div style={{fontSize:11,color:'#993C1D'}}>⚠ {error}</div>}
        {quienRegistra && (
          <div style={{fontSize:11,color:'var(--text-muted)'}}>Registrado como: <strong>{quienRegistra}</strong></div>
        )}
        <div style={{display:'flex',gap:8}}>
          <button className="btn btn-primary" type="submit" disabled={saving}>
            {saving?'Guardando...':`Guardar ${fechas.length||''} ${fechas.length===1?'día':'día(s)'}`}
          </button>
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
              registros={registros}
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
                    <th style={{padding:'8px 12px',textAlign:'left',fontSize:10,fontWeight:600,color:'#A08060',textTransform:'uppercase'}}>Campaña</th>
                    {canEdit && <th></th>}
                  </tr>
                </thead>
                <tbody>
                  {registrosFiltrados.map(r=>{
                    const tarea = tareas.find(t=>t.id===r.tarea_id)
                    const tipo = tipoDia(r.fecha)
                    const ausente = esNoTrabajado(r)
                    return (
                      <tr key={r.id} style={{borderBottom:'1px solid #EDE0C8'}}>
                        <td style={{padding:'10px 12px',whiteSpace:'nowrap',color:'var(--text-muted)'}}>
                          {fmtFecha(r.fecha)}
                          {tipo==='rojo' && !ausente && <span title="Domingo/feriado trabajado" style={{marginLeft:5,color:'#993C1D'}}>⚠</span>}
                        </td>
                        <td style={{padding:'10px 12px',textAlign:'center'}}>
                          {ausente ? (
                            <span style={{background:AUSENTE.bg,color:AUSENTE.text,borderRadius:20,padding:'3px 10px',fontSize:11,fontWeight:600,whiteSpace:'nowrap'}}>
                              No trabajado
                            </span>
                          ) : (
                            <span style={{background:r.cantidad===1?'#EBF4E8':'#F5EDD8',color:r.cantidad===1?'#2E4F26':'#6B3E22',borderRadius:20,padding:'3px 10px',fontSize:11,fontWeight:600,whiteSpace:'nowrap'}}>
                              {fmtCantidad(r.cantidad)}
                            </span>
                          )}
                        </td>
                        <td style={{padding:'10px 12px',maxWidth:200}}>
                          {ausente ? (
                            <div style={{fontSize:11,color:AUSENTE.text,lineHeight:1.3}}>{r.observaciones || '—'}</div>
                          ) : (
                            <>
                              {tarea && <div style={{fontSize:11,fontWeight:600,color:'var(--tierra)',marginBottom:2}}>{tarea.titulo}</div>}
                              {r.descripcion && <div style={{fontSize:11,color:'var(--text-muted)',lineHeight:1.3}}>{r.descripcion}</div>}
                              {!tarea && !r.descripcion && <span style={{color:'var(--text-muted)'}}>—</span>}
                            </>
                          )}
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
                    <td colSpan={3}></td>
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
