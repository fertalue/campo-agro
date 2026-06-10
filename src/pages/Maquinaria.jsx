import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

const TIPOS_MAQ = ['Tractor','Pulverizadora','Cosechadora','Sembradora','Mixer','Acoplado','Camioneta','Otro']
const TIPOS_MANT = ['Aceite y filtros','Filtros','Frenos','Neumáticos','Revisión general','Reparación','Calibración','Otro']
const TIPO_ICON = { 'Tractor':'🚜','Pulverizadora':'💧','Cosechadora':'🌾','Sembradora':'🌱','Mixer':'⚙️','Acoplado':'🚛','Camioneta':'🚗','Otro':'🔧' }
const MANT_COLOR = { 'Aceite y filtros':'#C8A96E','Filtros':'#A08060','Frenos':'#993C1D','Neumáticos':'#4A7C3F','Revisión general':'#2C5A6A','Reparación':'#7A4030','Calibración':'#6B3E22','Otro':'#888' }
// Tipos que usan km en lugar de horas
const USA_KM = ['Camioneta','Auto','Vehículo']
const getMedidor = (tipo) => USA_KM.includes(tipo) ? 'km' : 'hs'

function fmtFecha(f) {
  if (!f) return '—'
  return new Date(f+'T12:00:00').toLocaleDateString('es-AR',{day:'2-digit',month:'short',year:'2-digit'})
}
function fmtNum(v,dec=0) {
  if (v==null) return '—'
  return Number(v).toLocaleString('es-AR',{minimumFractionDigits:dec,maximumFractionDigits:dec})
}
function diasDesde(fecha) {
  if (!fecha) return null
  return Math.floor((new Date() - new Date(fecha+'T12:00:00')) / 86400000)
}

// ── FormMaquina ───────────────────────────────────────────────────────────────
function FormMaquina({ maq, onSave, onCancel }) {
  const isEdit = !!maq
  const [form, setForm] = useState(maq ? {
    nombre: maq.nombre, tipo: maq.tipo||'Tractor', marca: maq.marca||'', modelo: maq.modelo||'',
    anio: maq.anio||'', horas_actuales: maq.horas_actuales||0, tipo_medidor: maq.tipo_medidor||getMedidor(maq.tipo||'Tractor'),
    numero_serie: maq.numero_serie||'', patente: maq.patente||'', notas: maq.notas||''
  } : { nombre:'', tipo:'Tractor', marca:'', modelo:'', anio:'', horas_actuales:0, tipo_medidor:'hs', numero_serie:'', patente:'', notas:'' })
  const [saving, setSaving] = useState(false)
  const f = (k,v) => setForm(p=>({...p,[k]:v}))

  async function save(e) {
    e.preventDefault(); setSaving(true)
    const payload = { ...form, anio: form.anio ? parseInt(form.anio) : null, horas_actuales: parseFloat(form.horas_actuales)||0, tipo_medidor: form.tipo_medidor||'hs' }
    if (isEdit) await supabase.from('maquinas').update(payload).eq('id', maq.id)
    else await supabase.from('maquinas').insert(payload)
    setSaving(false); onSave()
  }

  const si = {padding:'7px 10px',border:'1px solid #D8C9A8',borderRadius:7,fontSize:13,fontFamily:'inherit',width:'100%',background:'#FDFAF4'}

  return (
    <div className="card mb-3" style={{background:'#F5F9F0',borderColor:'#9DC87A'}}>
      <h3 style={{marginBottom:14}}>{isEdit?'Editar máquina':'Nueva máquina'}</h3>
      <form onSubmit={save} style={{display:'flex',flexDirection:'column',gap:12}}>
        <div className="grid-2">
          <div className="field"><label className="label">Nombre / Identificador</label>
            <input style={si} value={form.nombre} onChange={e=>f('nombre',e.target.value)} required placeholder="Ej: Tractor John Deere grande"/>
          </div>
          <div className="field"><label className="label">Tipo</label>
            <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
              {TIPOS_MAQ.map(t=>(
                <button key={t} type="button" onClick={()=>f('tipo',t)}
                  style={{padding:'5px 8px',borderRadius:6,fontSize:11,cursor:'pointer',border:'1px solid',fontFamily:'inherit',
                    background:form.tipo===t?'var(--tierra)':'transparent',
                    color:form.tipo===t?'#F5F0E4':'var(--arcilla)',
                    borderColor:form.tipo===t?'var(--tierra)':'var(--border)'}}>
                  {TIPO_ICON[t]} {t}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr',gap:8}}>
          <div className="field"><label className="label">Marca</label>
            <input style={si} value={form.marca} onChange={e=>f('marca',e.target.value)} placeholder="John Deere..."/>
          </div>
          <div className="field"><label className="label">Modelo</label>
            <input style={si} value={form.modelo} onChange={e=>f('modelo',e.target.value)} placeholder="5065E..."/>
          </div>
          <div className="field"><label className="label">Año</label>
            <input style={si} type="number" min="1980" max="2030" value={form.anio} onChange={e=>f('anio',e.target.value)} placeholder="2020"/>
          </div>
          <div className="field"><label className="label">Medidor</label>
            <div style={{display:'flex',gap:5}}>
              {[['hs','Horas'],['km','Kilómetros']].map(([val,lbl])=>(
                <button key={val} type="button" onClick={()=>f('tipo_medidor',val)}
                  style={{flex:1,padding:'7px',borderRadius:6,fontSize:12,cursor:'pointer',border:'1px solid',fontFamily:'inherit',
                    background:form.tipo_medidor===val?'#2C5A6A':'transparent',
                    color:form.tipo_medidor===val?'#F5F0E4':'var(--arcilla)',
                    borderColor:form.tipo_medidor===val?'#2C5A6A':'var(--border)'}}>
                  {lbl}
                </button>
              ))}
            </div>
          </div>
          <div className="field"><label className="label">{form.tipo_medidor==='km'?'Kilómetros actuales':'Horas actuales'}</label>
            <input style={si} type="number" step="0.1" value={form.horas_actuales} onChange={e=>f('horas_actuales',e.target.value)} placeholder="0"/>
          </div>
        </div>
        <div className="grid-2">
          <div className="field"><label className="label">N° de serie</label>
            <input style={si} value={form.numero_serie} onChange={e=>f('numero_serie',e.target.value)} placeholder="Opcional"/>
          </div>
          <div className="field"><label className="label">Patente / dominio</label>
            <input style={si} value={form.patente} onChange={e=>f('patente',e.target.value)} placeholder="Opcional"/>
          </div>
        </div>
        <div className="field"><label className="label">Notas</label>
          <textarea style={{...si,minHeight:52}} value={form.notas} onChange={e=>f('notas',e.target.value)} placeholder="Estado general, historial previo..."/>
        </div>
        <div style={{display:'flex',gap:8}}>
          <button className="btn btn-primary" type="submit" disabled={saving}>{saving?'Guardando...':isEdit?'Guardar cambios':'Agregar máquina'}</button>
          <button className="btn btn-secondary" type="button" onClick={onCancel}>Cancelar</button>
        </div>
      </form>
    </div>
  )
}

// ── FormMantenimiento ─────────────────────────────────────────────────────────
function FormMantenimiento({ maquinaId, horasActuales, medidor, quienRegistra, onSave, onCancel }) {
  const unidad = medidor === 'km' ? 'km' : 'hs'
  const [form, setForm] = useState({
    fecha: new Date().toISOString().split('T')[0],
    tipo: 'Aceite y filtros', descripcion:'', horas_maquina: horasActuales||'',
    costo_usd:'', proveedor:'', proximo_km_hs:''
  })
  const [saving, setSaving] = useState(false)
  const f = (k,v) => setForm(p=>({...p,[k]:v}))

  async function save(e) {
    e.preventDefault(); setSaving(true)
    await supabase.from('mantenimientos').insert({
      maquina_id: maquinaId,
      fecha: form.fecha, tipo: form.tipo,
      descripcion: form.descripcion||null,
      horas_maquina: form.horas_maquina ? parseFloat(form.horas_maquina) : null,
      costo_usd: form.costo_usd ? parseFloat(form.costo_usd) : null,
      proveedor: form.proveedor||null,
      proximo_km_hs: form.proximo_km_hs ? parseFloat(form.proximo_km_hs) : null,
      quien_registro: quienRegistra,
    })
    // Actualizar horas de la máquina si se ingresaron
    if (form.horas_maquina) {
      await supabase.from('maquinas').update({ horas_actuales: parseFloat(form.horas_maquina) }).eq('id', maquinaId)
    }
    setSaving(false); onSave()
  }

  const si = {padding:'7px 10px',border:'1px solid #D8C9A8',borderRadius:7,fontSize:13,fontFamily:'inherit',width:'100%',background:'#FDFAF4'}

  return (
    <div style={{padding:'12px 14px',background:'#F0F6FA',border:'1px solid #7A9EAD',borderRadius:10,marginBottom:12}}>
      <h4 style={{marginBottom:12,color:'#2C5A6A',fontSize:13}}>Registrar mantenimiento</h4>
      <form onSubmit={save} style={{display:'flex',flexDirection:'column',gap:10}}>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
          <div className="field"><label className="label">Fecha</label>
            <input style={si} type="date" value={form.fecha} onChange={e=>f('fecha',e.target.value)} required/>
          </div>
          <div className="field"><label className="label">{unidad==='km'?'Km al momento':'Horas máquina al momento'}</label>
            <input style={si} type="number" step="0.1" value={form.horas_maquina} onChange={e=>f('horas_maquina',e.target.value)} placeholder={horasActuales||'0'}/>
          </div>
        </div>
        <div className="field"><label className="label">Tipo de mantenimiento</label>
          <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
            {TIPOS_MANT.map(t=>(
              <button key={t} type="button" onClick={()=>f('tipo',t)}
                style={{padding:'4px 8px',borderRadius:6,fontSize:11,cursor:'pointer',border:'1px solid',fontFamily:'inherit',
                  background:form.tipo===t?(MANT_COLOR[t]||'#888'):'transparent',
                  color:form.tipo===t?'#fff':'var(--arcilla)',
                  borderColor:form.tipo===t?(MANT_COLOR[t]||'#888'):'var(--border)'}}>
                {t}
              </button>
            ))}
          </div>
        </div>
        <div className="field"><label className="label">Descripción / detalle</label>
          <textarea style={{...si,minHeight:52}} value={form.descripcion} onChange={e=>f('descripcion',e.target.value)} placeholder="Qué se hizo, qué partes se cambiaron..."/>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}}>
          <div className="field"><label className="label">Costo (USD)</label>
            <input style={si} type="number" step="0.01" value={form.costo_usd} onChange={e=>f('costo_usd',e.target.value)} placeholder="0"/>
          </div>
          <div className="field"><label className="label">Taller / Proveedor</label>
            <input style={si} value={form.proveedor} onChange={e=>f('proveedor',e.target.value)} placeholder="Ej: Taller García"/>
          </div>
          <div className="field"><label className="label">Próximo servicio ({unidad})</label>
            <input style={si} type="number" step="1" value={form.proximo_km_hs} onChange={e=>f('proximo_km_hs',e.target.value)} placeholder={unidad==='km'?'km para el próximo':'hs para el próximo'}/>
          </div>
        </div>
        <div style={{display:'flex',gap:8}}>
          <button className="btn btn-primary" type="submit" disabled={saving}>{saving?'Guardando...':'Guardar'}</button>
          <button className="btn btn-secondary" type="button" onClick={onCancel}>Cancelar</button>
        </div>
      </form>
    </div>
  )
}

// ── FichaMaquina ──────────────────────────────────────────────────────────────
function FichaMaquina({ maq, mantenimientos, canEdit, quien, onEdit, onDelete, onRefresh }) {
  const [expanded, setExpanded]   = useState(false)
  const [showForm, setShowForm]   = useState(false)
  const medidor = maq.tipo_medidor || getMedidor(maq.tipo)
  const unidad  = medidor === 'km' ? 'km' : 'hs'

  const mants = mantenimientos.filter(m=>m.maquina_id===maq.id).sort((a,b)=>new Date(b.fecha)-new Date(a.fecha))
  const ultimo = mants[0]
  const diasUltimo = ultimo ? diasDesde(ultimo.fecha) : null
  const costoTotal = mants.reduce((a,m)=>a+(m.costo_usd||0),0)

  // Próximos servicios pendientes
  const proximos = mants.reduce((acc,m) => {
    if (!m.proximo_km_hs || acc[m.tipo]) return acc
    const diff = maq.horas_actuales - m.horas_maquina - m.proximo_km_hs
    acc[m.tipo] = { tipo: m.tipo, hsRestantes: -diff, vence: m.horas_maquina + m.proximo_km_hs }
    return acc
  }, {})
  const alertas = Object.values(proximos).filter(p => p.hsRestantes < 50).sort((a,b)=>a.hsRestantes-b.hsRestantes)

  return (
    <div style={{background:'#FDFAF4',border:'1px solid #D8C9A8',borderRadius:12,marginBottom:12,overflow:'hidden'}}>
      {/* Header máquina */}
      <div style={{display:'flex',alignItems:'center',gap:14,padding:'14px 16px',cursor:'pointer'}} onClick={()=>setExpanded(v=>!v)}>
        <div style={{fontSize:28,flexShrink:0}}>{TIPO_ICON[maq.tipo]||'🔧'}</div>
        <div style={{flex:1}}>
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:3}}>
            <span style={{fontSize:15,fontWeight:700,color:'var(--tierra)'}}>{maq.nombre}</span>
            <span style={{fontSize:10,background:'#EFECE4',color:'#7A6040',borderRadius:20,padding:'1px 7px'}}>{maq.tipo}</span>
            {maq.marca && <span style={{fontSize:11,color:'var(--arcilla)'}}>{maq.marca} {maq.modelo}</span>}
            {maq.anio && <span style={{fontSize:11,color:'var(--text-muted)'}}>({maq.anio})</span>}
          </div>
          <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
            <span style={{fontSize:12,color:'#2C5A6A',fontWeight:500}}>{fmtNum(maq.horas_actuales,1)} {unidad}</span>
            {ultimo && <span style={{fontSize:11,color:'var(--text-muted)'}}>Último mant.: {fmtFecha(ultimo.fecha)} ({diasUltimo}d)</span>}
            {mants.length > 0 && <span style={{fontSize:11,color:'var(--text-muted)'}}>{mants.length} registros · U$S {fmtNum(costoTotal,0)}</span>}
          </div>
        </div>
        {/* Alertas */}
        <div style={{display:'flex',flexDirection:'column',gap:4,flexShrink:0}}>
          {alertas.slice(0,2).map(a=>(
            <div key={a.tipo} style={{fontSize:10,background:a.hsRestantes<0?'#FAECE7':'#FAF5EC',
              border:`1px solid ${a.hsRestantes<0?'#F0997B':'#C8A96E'}`,borderRadius:6,padding:'2px 8px',
              color:a.hsRestantes<0?'#993C1D':'#6B3E22',fontWeight:600}}>
              {a.hsRestantes<0?'⚠':' ⏰'} {a.tipo}: {a.hsRestantes<0?'vencido':'en '+Math.round(a.hsRestantes)+' hs'}
            </div>
          ))}
        </div>
        {canEdit && (
          <div style={{display:'flex',gap:5,flexShrink:0}} onClick={e=>e.stopPropagation()}>
            <button onClick={()=>onEdit(maq)}
              style={{padding:'4px 9px',background:'transparent',border:'1px solid var(--border)',borderRadius:6,fontSize:11,cursor:'pointer',color:'var(--arcilla)',fontFamily:'inherit'}}>
              Editar
            </button>
            <button onClick={()=>onDelete(maq.id)}
              style={{padding:'4px 8px',background:'#FAECE7',border:'1px solid #F0997B',borderRadius:6,fontSize:11,cursor:'pointer',color:'#993C1D'}}>
              🗑
            </button>
          </div>
        )}
        <div style={{fontSize:16,color:'var(--text-muted)',flexShrink:0,marginLeft:4}}>{expanded?'▲':'▼'}</div>
      </div>

      {/* Detalle expandido */}
      {expanded && (
        <div style={{borderTop:'1px solid #E8D5A3',padding:'14px 16px'}}>
          {/* Info adicional */}
          {(maq.numero_serie||maq.patente||maq.notas) && (
            <div style={{display:'flex',gap:16,marginBottom:14,flexWrap:'wrap'}}>
              {maq.numero_serie && <span style={{fontSize:11,color:'var(--text-muted)'}}>N° serie: {maq.numero_serie}</span>}
              {maq.patente && <span style={{fontSize:11,color:'var(--text-muted)'}}>Patente: {maq.patente}</span>}
              {maq.notas && <span style={{fontSize:11,color:'var(--arcilla)',fontStyle:'italic'}}>{maq.notas}</span>}
            </div>
          )}

          {/* Form nuevo mantenimiento */}
          {showForm && canEdit ? (
            <FormMantenimiento
              maquinaId={maq.id} horasActuales={maq.horas_actuales} medidor={medidor} quienRegistra={quien}
              onSave={async()=>{ setShowForm(false); await onRefresh() }}
              onCancel={()=>setShowForm(false)}
            />
          ) : canEdit && (
            <button onClick={()=>setShowForm(true)}
              style={{display:'block',marginBottom:14,padding:'6px 14px',background:'#2C5A6A',color:'white',border:'none',borderRadius:7,fontSize:12,cursor:'pointer',fontFamily:'inherit'}}>
              + Registrar mantenimiento
            </button>
          )}

          {/* Historial */}
          {mants.length === 0 ? (
            <div style={{padding:16,textAlign:'center',fontSize:12,color:'var(--arcilla)'}}>Sin mantenimientos registrados</div>
          ) : (
            <div style={{display:'flex',flexDirection:'column',gap:6}}>
              <div style={{fontSize:10,fontWeight:600,color:'#A08060',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:4}}>Historial de mantenimiento</div>
              {mants.map(m=>(
                <div key={m.id} style={{display:'flex',alignItems:'flex-start',gap:10,padding:'8px 12px',
                  background:'white',border:'1px solid #E8D5A3',borderRadius:8,borderLeft:`3px solid ${MANT_COLOR[m.tipo]||'#888'}`}}>
                  <div style={{flexShrink:0,textAlign:'center',minWidth:40}}>
                    <div style={{fontSize:11,fontWeight:600,color:'var(--tierra)'}}>{fmtFecha(m.fecha)}</div>
                    <span style={{fontSize:10,color:'var(--text-muted)'}}>{m.horas_maquina&&<>{fmtNum(m.horas_maquina,0)} {unidad}</>}</span>
                  </div>
                  <div style={{flex:1}}>
                    <div style={{display:'flex',alignItems:'center',gap:7,marginBottom:2}}>
                      <span style={{fontSize:11,fontWeight:600,color:MANT_COLOR[m.tipo]||'#888'}}>{m.tipo}</span>
                      {m.proveedor && <span style={{fontSize:10,color:'var(--text-muted)'}}>· {m.proveedor}</span>}
              {m.proximo_km_hs && <span style={{fontSize:10,background:'#E4F0F4',color:'#2C5A6A',borderRadius:20,padding:'1px 6px'}}>Próx. {fmtNum(m.horas_maquina+m.proximo_km_hs,0)} {unidad}</span>}
                    </div>
                    {m.descripcion && <div style={{fontSize:11,color:'var(--arcilla)'}}>{m.descripcion}</div>}
                  </div>
                  {m.costo_usd && (
                    <div style={{flexShrink:0,textAlign:'right'}}>
                      <div style={{fontSize:12,fontWeight:600,color:'#2E4F26'}}>U$S {fmtNum(m.costo_usd,0)}</div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Maquinaria principal ──────────────────────────────────────────────────────
export default function Maquinaria() {
  const { user, puedeEditar, isAdmin } = useAuth()
  const canEdit = isAdmin || puedeEditar('maquinaria')
  const quien = user?.user_metadata?.nombre || user?.email || ''

  const [maquinas, setMaquinas]           = useState([])
  const [mantenimientos, setMantenimientos] = useState([])
  const [loading, setLoading]             = useState(true)
  const [showFormMaq, setShowFormMaq]     = useState(false)
  const [editMaq, setEditMaq]             = useState(null)
  const [fTipo, setFTipo]                 = useState('todos')

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [{ data: mqs }, { data: mnts }] = await Promise.all([
      supabase.from('maquinas').select('*').eq('activa', true).order('tipo').order('nombre'),
      supabase.from('mantenimientos').select('*').order('fecha', { ascending: false }),
    ])
    setMaquinas(mqs||[])
    setMantenimientos(mnts||[])
    setLoading(false)
  }

  async function deleteMaq(id) {
    if (!confirm('¿Desactivar esta máquina?')) return
    await supabase.from('maquinas').update({ activa: false }).eq('id', id)
    await fetchAll()
  }

  const maqFiltradas = maquinas.filter(m => fTipo === 'todos' || m.tipo === fTipo)
  const tiposDisp = [...new Set(maquinas.map(m=>m.tipo).filter(Boolean))]

  // Stats globales
  const costoTotal = mantenimientos.reduce((a,m)=>a+(m.costo_usd||0),0)
  const alertasTotal = maquinas.filter(maq => {
    const mants = mantenimientos.filter(m=>m.maquina_id===maq.id)
    return mants.some(m => m.proximo_km_hs && (maq.horas_actuales - m.horas_maquina) >= m.proximo_km_hs * 0.9)
  }).length

  return (
    <div>
      {/* Header */}
      <div className="flex-between mb-2">
        <div>
          <h2>Maquinaria</h2>
          <p style={{fontSize:12,color:'var(--arcilla)',marginTop:2}}>
            {maquinas.length} máquinas · {mantenimientos.length} mantenimientos registrados
            {alertasTotal > 0 && <span style={{color:'#993C1D',fontWeight:600}}> · ⚠ {alertasTotal} servicio{alertasTotal>1?'s':''} próximo{alertasTotal>1?'s':''}</span>}
          </p>
        </div>
        {canEdit && (
          <button className="btn btn-primary btn-sm" onClick={()=>{setShowFormMaq(v=>!v);setEditMaq(null)}}>
            {showFormMaq&&!editMaq?'Cancelar':'+ Nueva máquina'}
          </button>
        )}
      </div>

      {/* Stats */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,minmax(0,1fr))',gap:10,marginBottom:16}}>
        <div className="stat-card">
          <div className="stat-label">Máquinas activas</div>
          <div className="stat-value">{maquinas.length}</div>
          <div className="stat-sub">{tiposDisp.join(', ')||'—'}</div>
          <div className="stat-bar"><div className="stat-fill" style={{width:'100%',background:'var(--pasto)'}}/></div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Costo mantenimiento</div>
          <div className="stat-value" style={{fontSize:16}}>U$S {fmtNum(costoTotal,0)}</div>
          <div className="stat-sub">{mantenimientos.length} servicios</div>
          <div className="stat-bar"><div className="stat-fill" style={{width:'70%',background:'#C8A96E'}}/></div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Alertas próximas</div>
          <div className="stat-value" style={{color:alertasTotal>0?'#993C1D':'#4A7C3F'}}>{alertasTotal}</div>
          <div className="stat-sub">{alertasTotal>0?'servicios por vencer':'al día'}</div>
          <div className="stat-bar"><div className="stat-fill" style={{width:alertasTotal>0?'80%':'10%',background:alertasTotal>0?'#F0997B':'#4A7C3F'}}/></div>
        </div>
      </div>

      {/* Form máquina */}
      {(showFormMaq||editMaq) && canEdit && (
        <FormMaquina
          key={editMaq?.id||'new'}
          maq={editMaq}
          onSave={async()=>{ setShowFormMaq(false); setEditMaq(null); await fetchAll() }}
          onCancel={()=>{ setShowFormMaq(false); setEditMaq(null) }}
        />
      )}

      {/* Filtro por tipo */}
      {tiposDisp.length > 1 && (
        <div style={{display:'flex',gap:5,marginBottom:14,flexWrap:'wrap'}}>
          {['todos',...tiposDisp].map(t=>(
            <button key={t} onClick={()=>setFTipo(t)}
              style={{padding:'5px 10px',borderRadius:6,fontSize:11,cursor:'pointer',border:'1px solid',fontFamily:'inherit',
                background:fTipo===t?'var(--tierra)':'transparent',
                color:fTipo===t?'#F5F0E4':'var(--arcilla)',
                borderColor:fTipo===t?'var(--tierra)':'var(--border)'}}>
              {t === 'todos' ? 'Todas' : TIPO_ICON[t]+' '+t}
            </button>
          ))}
        </div>
      )}

      {/* Lista */}
      {loading ? <div style={{padding:32,textAlign:'center',color:'var(--arcilla)'}}>Cargando...</div>
      : maqFiltradas.length === 0 ? (
        <div style={{padding:40,textAlign:'center',color:'var(--arcilla)',fontSize:13}}>
          {maquinas.length === 0 ? 'Sin máquinas registradas. Agregá la primera con el botón +.' : 'Sin máquinas con estos filtros.'}
        </div>
      ) : (
        maqFiltradas.map(maq=>(
          <FichaMaquina
            key={maq.id} maq={maq} mantenimientos={mantenimientos}
            canEdit={canEdit} quien={quien}
            onEdit={m=>{ setEditMaq(m); setShowFormMaq(false) }}
            onDelete={deleteMaq}
            onRefresh={fetchAll}
          />
        ))
      )}
    </div>
  )
}
