import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

const MESES      = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
const CAMPOS     = ['ambos','casco','tres esquinas']
const FUENTES    = ['pluviómetro','Eli','Braida','Otro']
const CAMPANHAS_LL = ['25-26','24-25','23-24','22-23']
const TABS       = [['grafico','Gráfico'],['campanhas','Campañas'],['historico','Histórico'],['registros','Registros']]

function fechaEnCampanha(fecha, campanha) {
  if (!fecha || !campanha) return false
  const [a1, a2] = campanha.split('-').map(s => parseInt('20'+s))
  const d = new Date(fecha + 'T12:00:00')
  return d >= new Date(a1, 6, 1) && d <= new Date(a2, 5, 30)
}
function campanhaDeF(fecha) {
  if (!fecha) return null
  const d = new Date(fecha + 'T12:00:00')
  const y = d.getFullYear(), m = d.getMonth()
  const a1 = m >= 6 ? y : y - 1
  return `${String(a1).slice(2)}-${String(a1+1).slice(2)}`
}
function fmtFecha(f) {
  if (!f) return '—'
  return new Date(f+'T12:00:00').toLocaleDateString('es-AR',{day:'2-digit',month:'short',year:'2-digit'})
}

export default function Lluvias() {
  const { user, puedeEditar, isAdmin } = useAuth()
  const canEdit = isAdmin || puedeEditar('lluvias')
  const quienIngreso = user?.user_metadata?.nombre || user?.email || ''

  const [data, setData]         = useState([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving]     = useState(false)
  const [tab, setTab]           = useState('grafico')
  const [editando, setEditando] = useState(null)

  // Filtros
  const [fCampo, setFCampo]       = useState('promedio')
  const [fAnho, setFAnho]         = useState(new Date().getFullYear())
  const [fCampanha, setFCampanha] = useState('todas')
  const [fModo, setFModo]         = useState('anho')

  // Form
  const [form, setForm] = useState({
    fecha: new Date().toISOString().split('T')[0],
    mm: '', campo: 'ambos', fuente: 'pluviómetro', observaciones: ''
  })
  const ff = (k, v) => setForm(p => ({ ...p, [k]: v }))

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    const { data: rows } = await supabase
      .from('precipitaciones').select('*').order('fecha', { ascending: false })
    setData(rows || [])
    setLoading(false)
  }

  async function handleSave(e) {
    e.preventDefault(); setSaving(true)
    await supabase.from('precipitaciones').insert({
      fecha: form.fecha, mm: parseFloat(form.mm),
      campo: form.campo, fuente: form.fuente,
      observaciones: form.observaciones || null,
      quien_ingreso: quienIngreso,
    })
    setShowForm(false)
    setForm({ fecha: new Date().toISOString().split('T')[0], mm: '', campo: 'ambos', fuente: 'pluviómetro', observaciones: '' })
    await fetchData(); setSaving(false)
  }

  async function handleEdit(d) {
    const { error } = await supabase.from('precipitaciones').update({
      fecha: d.fecha, mm: parseFloat(d.mm),
      campo: d.campo, fuente: d.fuente,
      observaciones: d.observaciones || null,
    }).eq('id', d.id)
    if (!error) { setEditando(null); await fetchData() }
    else alert('Error: ' + error.message)
  }

  async function handleDelete(id) {
    if (!confirm('¿Eliminar este registro?')) return
    await supabase.from('precipitaciones').delete().eq('id', id)
    await fetchData()
  }

  // ── Filtrado ───────────────────────────────────────────────────────────────
  function aplicaAlCampo(row) {
    if (fCampo === 'promedio') return true
    return row.campo === 'ambos' || row.campo === fCampo
  }
  const dataFiltradaCampo = data.filter(aplicaAlCampo)
  const dataFiltrada = dataFiltradaCampo.filter(d => {
    if (fModo === 'campanha' && fCampanha !== 'todas') return fechaEnCampanha(d.fecha, fCampanha)
    if (fModo === 'anho') return d.fecha?.startsWith(String(fAnho))
    return true
  })
  const mmEfectivo = row => row.mm || 0

  // ── Acumulado mensual ──────────────────────────────────────────────────────
  const mmPorMes = {}
  dataFiltrada.forEach(d => {
    if (!d.fecha) return
    const ym = d.fecha.slice(0, 7)
    mmPorMes[ym] = (mmPorMes[ym] || 0) + mmEfectivo(d)
  })
  const [a1camp, a2camp] = (fModo === 'campanha' && fCampanha !== 'todas')
    ? fCampanha.split('-').map(s => parseInt('20'+s))
    : [fAnho, fAnho + 1]
  const mesesOrden = (fModo === 'campanha' && fCampanha !== 'todas')
    ? [6,7,8,9,10,11,0,1,2,3,4,5]
    : [0,1,2,3,4,5,6,7,8,9,10,11]
  const acumMensual = mesesOrden.map(mesIdx => {
    const anhoMes = (fModo === 'campanha' && fCampanha !== 'todas')
      ? (mesIdx >= 6 ? a1camp : a2camp) : fAnho
    const key = anhoMes + '-' + String(mesIdx + 1).padStart(2, '0')
    return { mes: mesIdx, label: MESES[mesIdx], key, mm: mmPorMes[key] || 0 }
  })
  const mesActual = fModo === 'anho' && fAnho === new Date().getFullYear()
    ? new Date().getMonth() : 11
  const acumVisible = fModo === 'anho' ? acumMensual.slice(0, mesActual + 1) : acumMensual
  let acumAcum = 0
  const acumConSuma = acumVisible.map(m => { acumAcum += m.mm; return { ...m, acumTotal: acumAcum } })
  const maxMmMes = Math.max(...acumConSuma.map(m => m.mm), 1)
  const maxAcum  = Math.max(...acumConSuma.map(m => m.acumTotal), 1)

  // ── Stats ──────────────────────────────────────────────────────────────────
  const totalPeriodo    = dataFiltrada.reduce((a, b) => a + mmEfectivo(b), 0)
  const eventosCount    = dataFiltrada.filter(d => d.mm > 0).length
  const maxEventoVal    = Math.max(...dataFiltrada.map(d => d.mm || 0), 0)
  const maxEventoFecha  = dataFiltrada.find(d => d.mm === maxEventoVal)?.fecha
  const maxEventoGlobal = Math.max(...data.map(d => d.mm || 0), 1)
  const anhos           = [...new Set(data.map(d => d.fecha?.slice(0,4)).filter(Boolean))].sort().reverse().map(Number)
  const totalAnhoAnt    = dataFiltradaCampo.filter(d => d.fecha?.startsWith(String(fAnho-1))).reduce((a,b) => a + mmEfectivo(b), 0)
  const periodoLabel    = fModo === 'campanha' && fCampanha !== 'todas' ? `Campaña ${fCampanha}` : `Año ${fAnho}`
  const campoLabel      = fCampo === 'promedio' ? 'Promedio ambos' : fCampo === 'casco' ? 'Casco' : 'Tres Esquinas'

  // ── Comparación anual ──────────────────────────────────────────────────────
  const comparAnhos = anhos.slice(0, 5).map(a => ({
    anho: a,
    total: dataFiltradaCampo.filter(d => d.fecha?.startsWith(String(a))).reduce((a,b) => a + mmEfectivo(b), 0)
  }))
  const maxAnho = Math.max(...comparAnhos.map(c => c.total), 1)

  // ── Campañas ───────────────────────────────────────────────────────────────
  const campanhasData = CAMPANHAS_LL.map(c => {
    const filas = dataFiltradaCampo.filter(d => fechaEnCampanha(d.fecha, c))
    const total = filas.reduce((a, b) => a + mmEfectivo(b), 0)
    const mmMes = [6,7,8,9,10,11,0,1,2,3,4,5].map(mi => {
      const [y1, y2] = c.split('-').map(s => parseInt('20'+s))
      const anhoMes = mi >= 6 ? y1 : y2
      const key = anhoMes + '-' + String(mi+1).padStart(2,'0')
      return { mes: mi, label: MESES[mi], mm: filas.filter(d => d.fecha?.startsWith(key)).reduce((a,b) => a+mmEfectivo(b),0) }
    })
    return { campanha: c, total, eventos: filas.length, mmMes, maxMes: Math.max(...mmMes.map(m=>m.mm),1) }
  })
  const maxCampanha = Math.max(...campanhasData.map(c => c.total), 1)

  // ── Curva histórica (media por mes) ───────────────────────────────────────
  // Desde jul 2023. Meses en orden jul->jun de campaña
  const mesesHistorico = [6,7,8,9,10,11,0,1,2,3,4,5]
  const historicoPorMes = mesesHistorico.map(mesIdx => {
    // Siempre incluir todas las campanas — 0 si no hubo lluvia ese mes
    const vals = CAMPANHAS_LL.map(c => {
      const [y1, y2] = c.split('-').map(s => parseInt('20'+s))
      const anhoMes = mesIdx >= 6 ? y1 : y2
      const key = anhoMes + '-' + String(mesIdx+1).padStart(2,'0')
      const filas = dataFiltradaCampo.filter(d => d.fecha && d.fecha.startsWith(key))
      return filas.reduce((a,b) => a + mmEfectivo(b), 0)
    })
    const media = vals.reduce((a,b)=>a+b,0) / CAMPANHAS_LL.length
    return { mes: mesIdx, label: MESES[mesIdx], media, vals }
  })
  const maxHistorico = Math.max(...historicoPorMes.map(m => m.media), 1)

  // ── Registros editables ────────────────────────────────────────────────────
  const [rBusq, setRBusq] = useState('')
  const registrosFiltrados = data.filter(d => {
    if (!rBusq) return true
    return d.fecha?.includes(rBusq) || String(d.mm).includes(rBusq) ||
      d.campo?.includes(rBusq) || d.fuente?.includes(rBusq) ||
      d.observaciones?.toLowerCase().includes(rBusq.toLowerCase())
  })

  return (
    <div>
      {/* Header */}
      <div className="flex-between mb-2">
        <div>
          <h2>Precipitaciones</h2>
          <p style={{ fontSize:12, color:'var(--arcilla)', marginTop:2 }}>
            {data.reduce((a,b)=>a+(b.mm||0),0).toFixed(0)} mm histórico · {data.length} eventos · {campoLabel}
          </p>
        </div>
        {canEdit && <button className="btn btn-primary btn-sm" onClick={() => setShowForm(v=>!v)}>
          {showForm ? 'Cancelar' : '+ Registrar'}</button>}
      </div>

      {/* Formulario */}
      {showForm && canEdit && (
        <div className="card mb-3" style={{ background:'#F0F6FA', borderColor:'var(--niebla)' }}>
          <h3 style={{ marginBottom:14 }}>Nuevo registro</h3>
          <form onSubmit={handleSave} style={{ display:'flex', flexDirection:'column', gap:12 }}>
            <div className="grid-2">
              <div className="field"><label className="label">Fecha</label>
                <input className="input" type="date" value={form.fecha} onChange={e=>ff('fecha',e.target.value)} required/>
              </div>
              <div className="field"><label className="label">Milímetros</label>
                <input className="input" type="number" step="0.1" min="0" value={form.mm} onChange={e=>ff('mm',e.target.value)} placeholder="0.0" required/>
              </div>
            </div>
            <div className="grid-2">
              <div className="field"><label className="label">Campo</label>
                <div style={{display:'flex',gap:6}}>
                  {CAMPOS.map(c=>(
                    <button key={c} type="button" onClick={()=>ff('campo',c)}
                      style={{flex:1,padding:'7px 4px',borderRadius:6,fontSize:12,cursor:'pointer',border:'1px solid',fontFamily:'inherit',
                        background:form.campo===c?'var(--cielo)':'transparent',color:form.campo===c?'#fff':'var(--arcilla)',borderColor:form.campo===c?'var(--cielo)':'var(--border)'}}>
                      {c==='ambos'?'Ambos':c==='casco'?'Casco':'Tres Esq.'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="field"><label className="label">Fuente</label>
                <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                  {FUENTES.map(f=>(
                    <button key={f} type="button" onClick={()=>ff('fuente',f)}
                      style={{padding:'6px 10px',borderRadius:6,fontSize:12,cursor:'pointer',border:'1px solid',fontFamily:'inherit',
                        background:form.fuente===f?'#4A7C3F':'transparent',color:form.fuente===f?'#F5F0E4':'var(--arcilla)',borderColor:form.fuente===f?'#4A7C3F':'var(--border)'}}>
                      {f}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="field"><label className="label">Observaciones</label>
              <input className="input" value={form.observaciones} onChange={e=>ff('observaciones',e.target.value)} placeholder="Granizo, madrugada, etc."/>
            </div>
            {quienIngreso && <div style={{fontSize:11,color:'var(--text-muted)'}}>Ingresado por: <strong>{quienIngreso}</strong></div>}
            <div style={{display:'flex',gap:8}}>
              <button className="btn btn-primary" type="submit" disabled={saving}>{saving?'Guardando...':'Guardar'}</button>
              <button className="btn btn-secondary" type="button" onClick={()=>setShowForm(false)}>Cancelar</button>
            </div>
          </form>
        </div>
      )}

      {/* Tabs */}
      <div style={{display:'flex',gap:4,marginBottom:16,borderBottom:'1px solid #D8C9A8'}}>
        {TABS.map(([id,lbl])=>(
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

      {/* ── TAB GRÁFICO ── */}
      {tab === 'grafico' && (
        <div>
          {/* Filtros */}
          <div style={{display:'flex',flexWrap:'wrap',gap:10,marginBottom:16,padding:'12px 14px',background:'#FDFAF4',border:'1px solid #D8C9A8',borderRadius:10,alignItems:'flex-end'}}>
            <div style={{display:'flex',flexDirection:'column',gap:3}}>
              <div style={{fontSize:10,fontWeight:600,color:'#A08060',textTransform:'uppercase',letterSpacing:'0.05em'}}>Campo</div>
              <div style={{display:'flex',gap:4}}>
                {[['promedio','Promedio'],['casco','Casco'],['tres esquinas','Tres Esq.']].map(([v,l])=>(
                  <button key={v} onClick={()=>setFCampo(v)}
                    style={{padding:'5px 10px',borderRadius:6,fontSize:11,cursor:'pointer',border:'1px solid',fontFamily:'inherit',whiteSpace:'nowrap',
                      background:fCampo===v?'var(--cielo)':'transparent',color:fCampo===v?'#fff':'var(--arcilla)',borderColor:fCampo===v?'var(--cielo)':'#D8C9A8'}}>{l}</button>
                ))}
              </div>
            </div>
            <div style={{width:1,height:32,background:'#D8C9A8'}}/>
            <div style={{display:'flex',flexDirection:'column',gap:3}}>
              <div style={{fontSize:10,fontWeight:600,color:'#A08060',textTransform:'uppercase',letterSpacing:'0.05em'}}>Periodo</div>
              <div style={{display:'flex',gap:4}}>
                {[['anho','Año'],['campanha','Campaña']].map(([v,l])=>(
                  <button key={v} onClick={()=>setFModo(v)}
                    style={{padding:'5px 10px',borderRadius:6,fontSize:11,cursor:'pointer',border:'1px solid',fontFamily:'inherit',
                      background:fModo===v?'#4A7C3F':'transparent',color:fModo===v?'#F5F0E4':'var(--arcilla)',borderColor:fModo===v?'#4A7C3F':'#D8C9A8'}}>{l}</button>
                ))}
              </div>
            </div>
            {fModo==='anho' && (
              <div style={{display:'flex',flexDirection:'column',gap:3}}>
                <div style={{fontSize:10,fontWeight:600,color:'#A08060',textTransform:'uppercase',letterSpacing:'0.05em'}}>Año</div>
                <div style={{display:'flex',gap:4}}>
                  {anhos.map(a=>(
                    <button key={a} onClick={()=>setFAnho(a)}
                      style={{padding:'5px 10px',borderRadius:6,fontSize:11,cursor:'pointer',border:'1px solid',fontFamily:'inherit',
                        background:fAnho===a?'#7A9EAD':'transparent',color:fAnho===a?'#fff':'var(--arcilla)',borderColor:fAnho===a?'#7A9EAD':'#D8C9A8'}}>{a}</button>
                  ))}
                </div>
              </div>
            )}
            {fModo==='campanha' && (
              <div style={{display:'flex',flexDirection:'column',gap:3}}>
                <div style={{fontSize:10,fontWeight:600,color:'#A08060',textTransform:'uppercase',letterSpacing:'0.05em'}}>Campaña</div>
                <div style={{display:'flex',gap:4}}>
                  {['todas',...CAMPANHAS_LL].map(c=>(
                    <button key={c} onClick={()=>setFCampanha(c)}
                      style={{padding:'5px 10px',borderRadius:6,fontSize:11,cursor:'pointer',border:'1px solid',fontFamily:'inherit',
                        background:fCampanha===c?'#7A9EAD':'transparent',color:fCampanha===c?'#fff':'var(--arcilla)',borderColor:fCampanha===c?'#7A9EAD':'#D8C9A8'}}>
                      {c==='todas'?'Todas':c}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Stats */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,minmax(0,1fr))',gap:10,marginBottom:16}}>
            {[
              ['Acumulado',`${totalPeriodo.toFixed(0)} mm`,`${eventosCount} eventos`,'#7A9EAD',Math.min(totalPeriodo/1200*100,100)],
              ['Prom. mensual',`${acumConSuma.length?(totalPeriodo/acumConSuma.length).toFixed(0):0} mm`,'por mes','#4E7A8A',60],
              ['Máx. evento',`${maxEventoVal} mm`,maxEventoFecha?fmtFecha(maxEventoFecha):'—','#2C5A6A',maxEventoVal/maxEventoGlobal*100],
              ['Año anterior',`${totalAnhoAnt.toFixed(0)} mm`,String(fAnho-1),'#A08060',70],
            ].map(([l,v,s,col,w])=>(
              <div key={l} className="stat-card">
                <div className="stat-label">{l}</div>
                <div className="stat-value">{v}</div>
                <div className="stat-sub">{s}</div>
                <div className="stat-bar"><div className="stat-fill" style={{width:`${w}%`,background:col}}/></div>
              </div>
            ))}
          </div>

          {/* Gráfico mensual */}
          <div className="card mb-3">
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
              <div>
                <h3>Acumulado mensual — {periodoLabel}</h3>
                <p style={{fontSize:11,color:'var(--arcilla)',marginTop:2}}>{campoLabel}</p>
              </div>
              <div style={{fontSize:14,fontWeight:600,color:'#7A9EAD'}}>{totalPeriodo.toFixed(0)} mm total</div>
            </div>
            {acumConSuma.length===0 ? (
              <div style={{textAlign:'center',padding:24,fontSize:13,color:'var(--arcilla)'}}>Sin datos para este período</div>
            ) : (() => {
              const W=600,H=160,pad=14,n=acumConSuma.length
              const colW=(W-pad*2)/n, barW=colW*0.55
              return (
                <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="auto" style={{display:'block'}}>
                  {[0.25,0.5,0.75,1].map(p=>{const y=H-22-p*(H-42);return <line key={p} x1={pad} x2={W-pad} y1={y} y2={y} stroke="#E8D5A3" strokeWidth="0.8" strokeDasharray="3 3"/>})}
                  {acumConSuma.map((m,i)=>{
                    const cx=pad+colW*i+colW/2
                    const h=m.mm>0?Math.max((m.mm/maxMmMes)*(H-62),3):2
                    const cy=H-22-(m.acumTotal/maxAcum)*(H-42)
                    const cur=fModo==='anho'&&fAnho===new Date().getFullYear()&&m.mes===new Date().getMonth()
                    return (
                      <g key={m.mes}>
                        <rect x={cx-barW/2} y={H-22-h} width={barW} height={h} fill={cur?'#4E7A8A':m.mm>0?'#7A9EAD':'#E4EFF3'} rx="2" opacity="0.85"/>
                        {m.mm>0&&<text x={cx} y={H-26-h} textAnchor="middle" fontSize="7.5" fill="#4E7A8A" fontWeight="500">{m.mm.toFixed(0)}</text>}
                        <circle cx={cx} cy={cy} r="3" fill="#2C5A6A" stroke="#fff" strokeWidth="1.2"/>
                        <text x={cx} y={cy-6} textAnchor="middle" fontSize="8" fill="#2C5A6A" fontWeight="600">{m.acumTotal.toFixed(0)}</text>
                        <text x={cx} y={H-5} textAnchor="middle" fontSize="8.5" fill="#A08060">{m.label}</text>
                      </g>
                    )
                  })}
                  {acumConSuma.length>1&&(
                    <polyline fill="none" stroke="#2C5A6A" strokeWidth="1.5" strokeDasharray="5 3" opacity="0.7"
                      points={acumConSuma.map((m,i)=>{const cx=pad+colW*i+colW/2;const cy=H-22-(m.acumTotal/maxAcum)*(H-42);return `${cx},${cy}`}).join(' ')}/>
                  )}
                </svg>
              )
            })()}
            <div style={{display:'flex',gap:16,marginTop:8,paddingTop:10,borderTop:'1px solid #EDE0C8'}}>
              <div style={{display:'flex',alignItems:'center',gap:5,fontSize:11,color:'var(--arcilla)'}}><div style={{width:12,height:8,background:'#7A9EAD',borderRadius:2}}/>mm por mes</div>
              <div style={{display:'flex',alignItems:'center',gap:5,fontSize:11,color:'var(--arcilla)'}}><div style={{width:16,height:2,borderTop:'2px dashed #2C5A6A'}}/>acumulado</div>
            </div>
          </div>

          {/* Comparación anual */}
          <div className="card">
            <h3 style={{marginBottom:14}}>Comparación anual</h3>
            {comparAnhos.map(({anho,total})=>(
              <div key={anho} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 0',borderBottom:'1px solid #EDE0C8'}}>
                <div style={{fontSize:12,color:anho===fAnho?'#7A9EAD':'var(--text-muted)',width:44,flexShrink:0,fontWeight:anho===fAnho?600:400}}>{anho}</div>
                <div style={{flex:1,height:10,background:'#E4EFF3',borderRadius:5,overflow:'hidden'}}>
                  <div style={{height:10,background:anho===fAnho?'#4E7A8A':'#7A9EAD',borderRadius:5,width:`${total/maxAnho*100}%`,opacity:anho===fAnho?1:0.65}}/>
                </div>
                <div style={{fontSize:12,color:'#7A9EAD',fontWeight:500,width:58,textAlign:'right'}}>{total.toFixed(0)} mm</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB CAMPAÑAS ── */}
      {tab === 'campanhas' && (
        <div>
          {/* Resumen por campaña */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,minmax(0,1fr))',gap:10,marginBottom:20}}>
            {campanhasData.map(({campanha,total,eventos})=>(
              <div key={campanha} className="stat-card">
                <div className="stat-label">Campaña {campanha}</div>
                <div className="stat-value">{total.toFixed(0)} mm</div>
                <div className="stat-sub">{eventos} eventos</div>
                <div className="stat-bar"><div className="stat-fill" style={{width:`${total/maxCampanha*100}%`,background:'#7A9EAD'}}/></div>
              </div>
            ))}
          </div>

          {/* Detalle mensual por campaña */}
          {campanhasData.map(({campanha,total,eventos,mmMes,maxMes})=>(
            <div key={campanha} className="card" style={{marginBottom:14}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
                <div>
                  <h3 style={{margin:0}}>Campaña {campanha}</h3>
                  <span style={{fontSize:11,color:'var(--text-muted)'}}>{eventos} eventos</span>
                </div>
                <div style={{fontSize:18,fontWeight:700,color:'#4E7A8A'}}>{total.toFixed(0)} mm</div>
              </div>
              {(() => {
                const W=500,H=120,pad=10,n=12,colW=(W-pad*2)/n,barW=colW*0.55
                const maxH = Math.max(...mmMes.map(m=>m.mm),1)
                return (
                  <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="auto" style={{display:'block',marginBottom:8}}>
                    {mmMes.map((m,i)=>{
                      const cx=pad+colW*i+colW/2
                      const h=m.mm>0?Math.max((m.mm/maxH)*(H-30),3):1
                      return (
                        <g key={m.mes}>
                          <rect x={cx-barW/2} y={H-18-h} width={barW} height={h} fill={m.mm>0?'#7A9EAD':'#E4EFF3'} rx="2"/>
                          {m.mm>0&&<text x={cx} y={H-22-h} textAnchor="middle" fontSize="7" fill="#4E7A8A">{m.mm.toFixed(0)}</text>}
                          <text x={cx} y={H-4} textAnchor="middle" fontSize="7.5" fill="#A08060">{m.label}</text>
                        </g>
                      )
                    })}
                  </svg>
                )
              })()}
              {/* Lista mensual */}
              <div style={{display:'grid',gridTemplateColumns:'repeat(6,1fr)',gap:4}}>
                {mmMes.map(m=>(
                  <div key={m.mes} style={{background:m.mm>0?'#EBF4F8':'#F5F5F5',borderRadius:6,padding:'6px 8px',textAlign:'center'}}>
                    <div style={{fontSize:9,color:'#A08060',marginBottom:2}}>{m.label}</div>
                    <div style={{fontSize:13,fontWeight:600,color:m.mm>0?'#2C5A6A':'#C8C8C8'}}>{m.mm>0?m.mm.toFixed(0):'—'}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── TAB HISTÓRICO (media por mes) ── */}
      {tab === 'historico' && (
        <div>
          <div className="card mb-3">
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
              <div>
                <h3>Media mensual histórica</h3>
                <p style={{fontSize:11,color:'var(--arcilla)',marginTop:2}}>
                  Promedio por mes desde jul 2023 · {CAMPANHAS_LL.length} campañas
                </p>
              </div>
              <div style={{fontSize:13,fontWeight:600,color:'#7A9EAD'}}>
                Media anual: {(historicoPorMes.reduce((a,m)=>a+m.media,0)).toFixed(0)} mm
              </div>
            </div>
            {(() => {
              const W=600,H=180,pad=14,n=12,colW=(W-pad*2)/n,barW=colW*0.6
              return (
                <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="auto" style={{display:'block'}}>
                  {[0.25,0.5,0.75,1].map(p=>{const y=H-22-p*(H-42);return<line key={p} x1={pad} x2={W-pad} y1={y} y2={y} stroke="#E8D5A3" strokeWidth="0.8" strokeDasharray="3 3"/>})}
                  {historicoPorMes.map((m,i)=>{
                    const cx=pad+colW*i+colW/2
                    const h=m.media>0?Math.max((m.media/maxHistorico)*(H-50),3):1
                    return (
                      <g key={m.mes}>
                        <rect x={cx-barW/2} y={H-22-h} width={barW} height={h} fill="#7A9EAD" rx="2" opacity="0.8"/>
                        {m.media>0&&<text x={cx} y={H-26-h} textAnchor="middle" fontSize="8" fill="#4E7A8A" fontWeight="600">{m.media.toFixed(0)}</text>}
                        <text x={cx} y={H-5} textAnchor="middle" fontSize="8.5" fill="#A08060">{m.label}</text>
                      </g>
                    )
                  })}
                </svg>
              )
            })()}
          </div>

          {/* Tabla detalle: media vs cada campaña */}
          <div className="card" style={{padding:0,overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
              <thead>
                <tr style={{background:'#EDE0C8'}}>
                  <th style={{padding:'8px 12px',textAlign:'left',fontSize:10,fontWeight:600,color:'#A08060',textTransform:'uppercase'}}>Mes</th>
                  {CAMPANHAS_LL.map(c=>(
                    <th key={c} style={{padding:'8px 12px',textAlign:'right',fontSize:10,fontWeight:600,color:'#A08060',textTransform:'uppercase'}}>{c}</th>
                  ))}
                  <th style={{padding:'8px 12px',textAlign:'right',fontSize:10,fontWeight:700,color:'#2C5A6A',textTransform:'uppercase'}}>Media</th>
                </tr>
              </thead>
              <tbody>
                {historicoPorMes.map((m,i)=>(
                  <tr key={m.mes} style={{borderBottom:'1px solid #EDE0C8',background:i%2===0?'#FDFAF4':'white'}}>
                    <td style={{padding:'8px 12px',fontWeight:500,color:'var(--tierra)'}}>{m.label}</td>
                    {CAMPANHAS_LL.map((c,ci)=>(
                      <td key={c} style={{padding:'8px 12px',textAlign:'right',fontFamily:'monospace',color:m.vals[ci]>0?'var(--tierra)':'var(--text-muted)'}}>
                        {m.vals[ci]>0?m.vals[ci].toFixed(0):'—'}
                      </td>
                    ))}
                    <td style={{padding:'8px 12px',textAlign:'right',fontFamily:'monospace',fontWeight:700,color:'#2C5A6A'}}>
                      {m.media>0?m.media.toFixed(1):'—'}
                    </td>
                  </tr>
                ))}
                <tr style={{background:'#EDE0C8',fontWeight:700}}>
                  <td style={{padding:'8px 12px',fontSize:11,color:'#7A6040',textTransform:'uppercase'}}>Total</td>
                  {campanhasData.map(c=>(
                    <td key={c.campanha} style={{padding:'8px 12px',textAlign:'right',fontFamily:'monospace',color:'var(--tierra)'}}>{c.total.toFixed(0)}</td>
                  ))}
                  <td style={{padding:'8px 12px',textAlign:'right',fontFamily:'monospace',color:'#2C5A6A'}}>
                    {(historicoPorMes.reduce((a,m)=>a+m.media,0)).toFixed(0)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB REGISTROS ── */}
      {tab === 'registros' && (
        <div>
          {/* Buscador */}
          <div style={{position:'relative',marginBottom:14}}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="var(--arcilla)" strokeWidth="1.5" strokeLinecap="round"
              style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',pointerEvents:'none'}}>
              <circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5L14 14"/>
            </svg>
            <input value={rBusq} onChange={e=>setRBusq(e.target.value)} placeholder="Buscar por fecha, mm, campo, fuente..."
              style={{width:'100%',padding:'9px 12px 9px 32px',border:'1px solid #D8C9A8',borderRadius:8,fontSize:13,background:'#FDFAF4',fontFamily:'inherit'}}/>
            {rBusq&&<button onClick={()=>setRBusq('')} style={{position:'absolute',right:8,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',color:'var(--arcilla)',fontSize:16}}>✕</button>}
          </div>
          <div style={{fontSize:11,color:'var(--arcilla)',marginBottom:10}}>{registrosFiltrados.length} registros</div>

          <div className="card" style={{padding:0,overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
              <thead>
                <tr style={{background:'#EDE0C8'}}>
                  <th style={{padding:'8px 10px',textAlign:'left',fontSize:10,fontWeight:600,color:'#A08060',textTransform:'uppercase'}}>Fecha</th>
                  <th style={{padding:'8px 10px',textAlign:'left',fontSize:10,fontWeight:600,color:'#A08060',textTransform:'uppercase'}}>Campaña</th>
                  <th style={{padding:'8px 10px',textAlign:'right',fontSize:10,fontWeight:600,color:'#A08060',textTransform:'uppercase'}}>mm</th>
                  <th style={{padding:'8px 10px',textAlign:'left',fontSize:10,fontWeight:600,color:'#A08060',textTransform:'uppercase'}}>Campo</th>
                  <th style={{padding:'8px 10px',textAlign:'left',fontSize:10,fontWeight:600,color:'#A08060',textTransform:'uppercase'}}>Fuente</th>
                  <th style={{padding:'8px 10px',textAlign:'left',fontSize:10,fontWeight:600,color:'#A08060',textTransform:'uppercase'}}>Observaciones</th>
                  <th style={{padding:'8px 10px',textAlign:'left',fontSize:10,fontWeight:600,color:'#A08060',textTransform:'uppercase'}}>Quién</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {registrosFiltrados.map(d=>{
                  const isEdit = editando?.id === d.id
                  if (isEdit) {
                    return (
                      <tr key={d.id} style={{background:'#FFF9EE'}}>
                        <td style={{padding:'6px 8px'}}>
                          <input type="date" value={editando.fecha} onChange={e=>setEditando(p=>({...p,fecha:e.target.value}))}
                            style={{padding:'4px 6px',border:'1px solid #D8C9A8',borderRadius:5,fontSize:11,fontFamily:'inherit'}}/>
                        </td>
                        <td style={{padding:'6px 8px',fontSize:11,color:'var(--text-muted)'}}>{campanhaDeF(editando.fecha)}</td>
                        <td style={{padding:'6px 8px'}}>
                          <input type="number" step="0.1" value={editando.mm} onChange={e=>setEditando(p=>({...p,mm:e.target.value}))}
                            style={{padding:'4px 6px',border:'1px solid #D8C9A8',borderRadius:5,fontSize:11,width:60,fontFamily:'inherit'}}/>
                        </td>
                        <td style={{padding:'6px 8px'}}>
                          <select value={editando.campo} onChange={e=>setEditando(p=>({...p,campo:e.target.value}))}
                            style={{padding:'4px 6px',border:'1px solid #D8C9A8',borderRadius:5,fontSize:11,fontFamily:'inherit'}}>
                            {CAMPOS.map(c=><option key={c} value={c}>{c}</option>)}
                          </select>
                        </td>
                        <td style={{padding:'6px 8px'}}>
                          <select value={editando.fuente} onChange={e=>setEditando(p=>({...p,fuente:e.target.value}))}
                            style={{padding:'4px 6px',border:'1px solid #D8C9A8',borderRadius:5,fontSize:11,fontFamily:'inherit'}}>
                            {FUENTES.map(f=><option key={f} value={f}>{f}</option>)}
                          </select>
                        </td>
                        <td style={{padding:'6px 8px'}}>
                          <input value={editando.observaciones||''} onChange={e=>setEditando(p=>({...p,observaciones:e.target.value}))}
                            style={{padding:'4px 6px',border:'1px solid #D8C9A8',borderRadius:5,fontSize:11,fontFamily:'inherit',width:'100%'}}/>
                        </td>
                        <td style={{padding:'6px 8px',fontSize:11,color:'var(--text-muted)'}}>{d.quien_ingreso||'—'}</td>
                        <td style={{padding:'6px 8px'}}>
                          <div style={{display:'flex',gap:4}}>
                            <button onClick={()=>handleEdit(editando)}
                              style={{background:'var(--pasto,#4A7C3F)',color:'white',border:'none',borderRadius:5,padding:'4px 8px',fontSize:11,cursor:'pointer'}}>✓</button>
                            <button onClick={()=>setEditando(null)}
                              style={{background:'transparent',border:'1px solid var(--border)',borderRadius:5,padding:'4px 8px',fontSize:11,cursor:'pointer'}}>✕</button>
                            <button onClick={()=>handleDelete(d.id)}
                              style={{background:'#FAECE7',border:'1px solid #F0997B',borderRadius:5,padding:'4px 8px',fontSize:11,cursor:'pointer',color:'#993C1D'}}>🗑</button>
                          </div>
                        </td>
                      </tr>
                    )
                  }
                  return (
                    <tr key={d.id} style={{borderBottom:'1px solid #EDE0C8'}} onMouseEnter={e=>e.currentTarget.style.background='#FDFAF0'} onMouseLeave={e=>e.currentTarget.style.background=''}>
                      <td style={{padding:'8px 10px',whiteSpace:'nowrap',color:'var(--text-muted)'}}>{fmtFecha(d.fecha)}</td>
                      <td style={{padding:'8px 10px'}}><span style={{background:'#EFECE4',borderRadius:20,padding:'2px 7px',fontSize:10,color:'#7A6040'}}>{campanhaDeF(d.fecha)||'—'}</span></td>
                      <td style={{padding:'8px 10px',textAlign:'right',fontFamily:'monospace',fontWeight:600,color:'#2C5A6A'}}>{d.mm}</td>
                      <td style={{padding:'8px 10px'}}>
                        <span style={{background:d.campo==='ambos'?'#E4F0F4':d.campo==='casco'?'#EBF4E8':'#F5EDD8',borderRadius:20,padding:'2px 7px',fontSize:10,
                          color:d.campo==='ambos'?'#2C5A6A':d.campo==='casco'?'#2E4F26':'#6B3E22'}}>
                          {d.campo}
                        </span>
                      </td>
                      <td style={{padding:'8px 10px',color:'var(--text-muted)',fontSize:11}}>{d.fuente||'—'}</td>
                      <td style={{padding:'8px 10px',color:'var(--text-muted)',fontSize:11,maxWidth:160,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{d.observaciones||'—'}</td>
                      <td style={{padding:'8px 10px',color:'var(--text-muted)',fontSize:11}}>{d.quien_ingreso||'—'}</td>
                      <td style={{padding:'8px 10px'}}>
                        {canEdit && <button onClick={()=>setEditando({...d})}
                          style={{background:'transparent',border:'1px solid var(--border)',borderRadius:5,padding:'3px 8px',fontSize:11,cursor:'pointer',color:'var(--arcilla)'}}>
                          Editar
                        </button>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
