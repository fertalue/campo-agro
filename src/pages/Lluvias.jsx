import { useState, useEffect } from 'react'
import { db } from '../lib/supabase'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

const MESES     = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
const CAMPOS    = ['ambos','casco','tres esquinas']
const FUENTES   = ['pluviómetro','Eli','Braida','Otro']
const CAMPANHAS_LL = ['25-26','24-25','23-24','22-23']

// Campaña = 1 julio -> 30 junio
function campanhaDeAnho(anho) { return `${String(anho).slice(2)}-${String(anho+1).slice(2)}` }
function fechaEnCampanha(fecha, campanha) {
  if (!fecha || !campanha) return false
  const [a1, a2] = campanha.split('-').map(s => parseInt('20'+s))
  const d = new Date(fecha + 'T12:00:00')
  const ini = new Date(a1, 6, 1)   // 1 julio año1
  const fin = new Date(a2, 5, 30)  // 30 junio año2
  return d >= ini && d <= fin
}
function mmDeCampo(row, campo) {
  // Si el registro es "ambos", cuenta para casco y tres esquinas igual
  if (campo === 'promedio' || campo === 'ambos') return row.mm || 0
  if (row.campo === 'ambos') return row.mm || 0
  if (row.campo === campo) return row.mm || 0
  return 0
}

export default function Lluvias() {
  const { user } = useAuth()
  const quienIngreso = user?.user_metadata?.nombre || user?.email || ''

  const [data, setData]       = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving]   = useState(false)

  // Filtros
  const [fCampo, setFCampo]       = useState('promedio')  // promedio | casco | tres esquinas
  const [fAnho, setFAnho]         = useState(new Date().getFullYear())
  const [fCampanha, setFCampanha] = useState('todas')
  const [fModo, setFModo]         = useState('anho')      // anho | campanha

  // Form nuevo registro
  const [form, setForm] = useState({
    fecha: new Date().toISOString().split('T')[0],
    mm: '', campo: 'ambos', fuente: 'pluviómetro', observaciones: ''
  })
  const ff = (k, v) => setForm(p => ({ ...p, [k]: v }))

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    const { data: rows } = await supabase
      .from('precipitaciones')
      .select('*')
      .order('fecha', { ascending: false })
    setData(rows || [])
    setLoading(false)
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    await supabase.from('precipitaciones').insert({
      fecha: form.fecha,
      mm: parseFloat(form.mm),
      campo: form.campo,
      fuente: form.fuente,
      observaciones: form.observaciones || null,
      quien_ingreso: quienIngreso,
    })
    setShowForm(false)
    setForm({ fecha: new Date().toISOString().split('T')[0], mm: '', campo: 'ambos', fuente: 'pluviómetro', observaciones: '' })
    await fetchData()
    setSaving(false)
  }

  // ── Filtrado de datos ──────────────────────────────────────────────────────
  // Para campo: incluir registros que apliquen al campo seleccionado
  function aplicaAlCampo(row) {
    if (fCampo === 'promedio') return true
    if (row.campo === 'ambos') return true
    return row.campo === fCampo
  }

  const dataFiltradaCampo = data.filter(aplicaAlCampo)

  // Filtro por periodo
  const dataFiltrada = dataFiltradaCampo.filter(d => {
    if (fModo === 'campanha' && fCampanha !== 'todas') return fechaEnCampanha(d.fecha, fCampanha)
    if (fModo === 'anho') return d.fecha?.startsWith(String(fAnho))
    return true
  })

  // mm efectivos (cuando campo="ambos" y filtro es un campo específico, se usa el mismo valor)
  function mmEfectivo(row) {
    return row.mm || 0
  }

  // ── Años disponibles ───────────────────────────────────────────────────────
  const anhos = [...new Set(data.map(d => d.fecha?.slice(0,4)).filter(Boolean))].sort().reverse().map(Number)

  // ── Acumulado mensual del periodo seleccionado ─────────────────────────────
  const acumMensual = Array.from({ length: 12 }, (_, i) => {
    const mes = String(i + 1).padStart(2, '0')
    const key = `${fAnho}-${mes}`
    const filas = dataFiltrada.filter(d => d.fecha?.startsWith(key))
    const mmMes = filas.reduce((a, b) => a + mmEfectivo(b), 0)
    return { mes: i, label: MESES[i], key, mm: mmMes, n: filas.length }
  })

  const mesActual = fModo === 'anho' && fAnho === new Date().getFullYear()
    ? new Date().getMonth()
    : 11

  const acumVisible = fModo === 'anho'
    ? acumMensual.slice(0, mesActual + 1)
    : acumMensual

  let acumAcumulado = 0
  const acumConSuma = acumVisible.map(m => {
    acumAcumulado += m.mm
    return { ...m, acumTotal: acumAcumulado }
  })

  const maxMmMes   = Math.max(...acumConSuma.map(m => m.mm), 1)
  const maxAcum    = Math.max(...acumConSuma.map(m => m.acumTotal), 1)

  // ── Stats ──────────────────────────────────────────────────────────────────
  const totalPeriodo   = dataFiltrada.reduce((a, b) => a + mmEfectivo(b), 0)
  const eventosCount   = dataFiltrada.filter(d => d.mm > 0).length
  const maxEventoVal   = Math.max(...dataFiltrada.map(d => d.mm || 0), 0)
  const maxEventoFecha = dataFiltrada.find(d => d.mm === maxEventoVal)?.fecha
  const maxEventoGlobal = Math.max(...data.map(d => d.mm || 0), 1)

  // Campaña label
  const periodoLabel = fModo === 'campanha' && fCampanha !== 'todas'
    ? `Campaña ${fCampanha}`
    : `Año ${fAnho}`

  const campoLabel = fCampo === 'promedio' ? 'Promedio ambos campos'
    : fCampo === 'casco' ? 'Casco'
    : 'Tres Esquinas'

  // ── Comparación anual ──────────────────────────────────────────────────────
  const comparAnhos = anhos.slice(0, 4).map(a => {
    const filas = dataFiltradaCampo.filter(d => d.fecha?.startsWith(String(a)))
    const total = filas.reduce((a, b) => a + mmEfectivo(b), 0)
    return { anho: a, total }
  })
  const maxAnho = Math.max(...comparAnhos.map(c => c.total), 1)

  return (
    <div>
      {/* ── Header ── */}
      <div className="flex-between mb-2">
        <div>
          <h2>Precipitaciones</h2>
          <p style={{ fontSize:12, color:'var(--arcilla)', marginTop:2 }}>
            {totalPeriodo.toFixed(0)} mm · {eventosCount} eventos · {campoLabel}
          </p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn btn-primary btn-sm" onClick={() => setShowForm(v => !v)}>
            {showForm ? 'Cancelar' : '+ Registrar'}
          </button>
        </div>
      </div>

      {/* ── Formulario ── */}
      {showForm && (
        <div className="card mb-3" style={{ background:'#F0F6FA', borderColor:'var(--niebla)' }}>
          <h3 style={{ marginBottom:14 }}>Nuevo registro de lluvia</h3>
          <form onSubmit={handleSave} style={{ display:'flex', flexDirection:'column', gap:12 }}>
            <div className="grid-2">
              <div className="field">
                <label className="label">Fecha del evento</label>
                <input className="input" type="date" value={form.fecha} onChange={e => ff('fecha', e.target.value)} required />
              </div>
              <div className="field">
                <label className="label">Milímetros</label>
                <input className="input" type="number" step="0.1" min="0" value={form.mm}
                  onChange={e => ff('mm', e.target.value)} placeholder="0.0" required />
              </div>
            </div>
            <div className="grid-2">
              <div className="field">
                <label className="label">Campo</label>
                <div style={{ display:'flex', gap:6 }}>
                  {CAMPOS.map(c => (
                    <button key={c} type="button" onClick={() => ff('campo', c)}
                      style={{ flex:1, padding:'7px 4px', borderRadius:6, fontSize:12, cursor:'pointer', border:'1px solid', fontFamily:'inherit',
                        background: form.campo === c ? 'var(--cielo)' : 'transparent',
                        color: form.campo === c ? '#fff' : 'var(--arcilla)',
                        borderColor: form.campo === c ? 'var(--cielo)' : 'var(--border)' }}>
                      {c === 'ambos' ? 'Ambos' : c === 'casco' ? 'Casco' : 'Tres Esquinas'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="field">
                <label className="label">Fuente</label>
                <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                  {FUENTES.map(f => (
                    <button key={f} type="button" onClick={() => ff('fuente', f)}
                      style={{ padding:'6px 12px', borderRadius:6, fontSize:12, cursor:'pointer', border:'1px solid', fontFamily:'inherit',
                        background: form.fuente === f ? '#4A7C3F' : 'transparent',
                        color: form.fuente === f ? '#F5F0E4' : 'var(--arcilla)',
                        borderColor: form.fuente === f ? '#4A7C3F' : 'var(--border)' }}>
                      {f}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="field">
              <label className="label">Observaciones</label>
              <input className="input" value={form.observaciones} onChange={e => ff('observaciones', e.target.value)}
                placeholder="Granizo, lluvia de madrugada, etc." />
            </div>
            {quienIngreso && (
              <div style={{ fontSize:11, color:'var(--text-muted)' }}>
                Se registrará como ingresado por: <strong>{quienIngreso}</strong>
              </div>
            )}
            <div style={{ display:'flex', gap:8 }}>
              <button className="btn btn-primary" type="submit" disabled={saving} style={{ alignSelf:'flex-start' }}>
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
              <button className="btn btn-secondary" type="button" onClick={() => setShowForm(false)}>Cancelar</button>
            </div>
          </form>
        </div>
      )}

      {/* ── Filtros ── */}
      <div style={{ display:'flex', flexWrap:'wrap', gap:10, marginBottom:16, padding:'12px 14px', background:'#FDFAF4', border:'1px solid #D8C9A8', borderRadius:10, alignItems:'flex-end' }}>

        {/* Campo */}
        <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
          <div style={{ fontSize:10, fontWeight:600, color:'#A08060', textTransform:'uppercase', letterSpacing:'0.05em' }}>Campo</div>
          <div style={{ display:'flex', gap:4 }}>
            {[['promedio','Promedio'],['casco','Casco'],['tres esquinas','Tres Esquinas']].map(([val, lbl]) => (
              <button key={val} onClick={() => setFCampo(val)}
                style={{ padding:'5px 10px', borderRadius:6, fontSize:11, cursor:'pointer', border:'1px solid', fontFamily:'inherit', whiteSpace:'nowrap',
                  background: fCampo === val ? 'var(--cielo)' : 'transparent',
                  color: fCampo === val ? '#fff' : 'var(--arcilla)',
                  borderColor: fCampo === val ? 'var(--cielo)' : '#D8C9A8' }}>
                {lbl}
              </button>
            ))}
          </div>
        </div>

        <div style={{ width:1, height:32, background:'#D8C9A8' }}/>

        {/* Modo: año o campaña */}
        <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
          <div style={{ fontSize:10, fontWeight:600, color:'#A08060', textTransform:'uppercase', letterSpacing:'0.05em' }}>Periodo</div>
          <div style={{ display:'flex', gap:4 }}>
            <button onClick={() => setFModo('anho')} style={{ padding:'5px 10px', borderRadius:6, fontSize:11, cursor:'pointer', border:'1px solid', fontFamily:'inherit',
              background: fModo==='anho' ? '#4A7C3F' : 'transparent', color: fModo==='anho' ? '#F5F0E4' : 'var(--arcilla)', borderColor: fModo==='anho' ? '#4A7C3F' : '#D8C9A8' }}>
              Año
            </button>
            <button onClick={() => setFModo('campanha')} style={{ padding:'5px 10px', borderRadius:6, fontSize:11, cursor:'pointer', border:'1px solid', fontFamily:'inherit',
              background: fModo==='campanha' ? '#4A7C3F' : 'transparent', color: fModo==='campanha' ? '#F5F0E4' : 'var(--arcilla)', borderColor: fModo==='campanha' ? '#4A7C3F' : '#D8C9A8' }}>
              Campaña
            </button>
          </div>
        </div>

        {/* Selector año */}
        {fModo === 'anho' && (
          <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
            <div style={{ fontSize:10, fontWeight:600, color:'#A08060', textTransform:'uppercase', letterSpacing:'0.05em' }}>Año</div>
            <div style={{ display:'flex', gap:4 }}>
              {anhos.map(a => (
                <button key={a} onClick={() => setFAnho(a)}
                  style={{ padding:'5px 10px', borderRadius:6, fontSize:11, cursor:'pointer', border:'1px solid', fontFamily:'inherit',
                    background: fAnho===a ? 'var(--lluvia,#7A9EAD)' : 'transparent',
                    color: fAnho===a ? '#fff' : 'var(--arcilla)', borderColor: fAnho===a ? 'var(--lluvia,#7A9EAD)' : '#D8C9A8' }}>
                  {a}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Selector campaña */}
        {fModo === 'campanha' && (
          <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
            <div style={{ fontSize:10, fontWeight:600, color:'#A08060', textTransform:'uppercase', letterSpacing:'0.05em' }}>Campaña</div>
            <div style={{ display:'flex', gap:4 }}>
              {['todas', ...CAMPANHAS_LL].map(c => (
                <button key={c} onClick={() => setFCampanha(c)}
                  style={{ padding:'5px 10px', borderRadius:6, fontSize:11, cursor:'pointer', border:'1px solid', fontFamily:'inherit',
                    background: fCampanha===c ? 'var(--lluvia,#7A9EAD)' : 'transparent',
                    color: fCampanha===c ? '#fff' : 'var(--arcilla)', borderColor: fCampanha===c ? 'var(--lluvia,#7A9EAD)' : '#D8C9A8' }}>
                  {c === 'todas' ? 'Todas' : c}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Stats ── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,minmax(0,1fr))', gap:10, marginBottom:16 }}>
        {[
          ['Acumulado', `${totalPeriodo.toFixed(0)} mm`, `${eventosCount} eventos`, '#7A9EAD', Math.min(totalPeriodo/1200*100, 100)],
          ['Prom. mensual', `${acumConSuma.length ? (totalPeriodo/acumConSuma.length).toFixed(0) : 0} mm`, 'por mes', '#4E7A8A', 60],
          ['Máx. evento', `${maxEventoVal} mm`, maxEventoFecha ? new Date(maxEventoFecha+'T12:00:00').toLocaleDateString('es-AR',{day:'2-digit',month:'short',year:'2-digit'}) : '—', '#2C5A6A', maxEventoVal/maxEventoGlobal*100],
          ['Año anterior', `${(() => { const pa = dataFiltradaCampo.filter(d=>d.fecha?.startsWith(String(fAnho-1))).reduce((a,b)=>a+mmEfectivo(b),0); return pa.toFixed(0) })()} mm`, String(fAnho-1), '#A08060', 70],
        ].map(([lbl,v,s,col,w]) => (
          <div key={lbl} className="stat-card">
            <div className="stat-label">{lbl}</div>
            <div className="stat-value">{v}</div>
            <div className="stat-sub">{s}</div>
            <div className="stat-bar"><div className="stat-fill" style={{ width:`${w}%`, background:col }}/></div>
          </div>
        ))}
      </div>

      {/* ── Gráfico acumulado mensual ── */}
      <div className="card mb-3">
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <div>
            <h3>Acumulado mensual — {periodoLabel}</h3>
            <p style={{ fontSize:11, color:'var(--arcilla)', marginTop:2 }}>{campoLabel}</p>
          </div>
          <div style={{ fontSize:14, fontWeight:600, color:'var(--lluvia,#7A9EAD)' }}>
            {totalPeriodo.toFixed(0)} mm total
          </div>
        </div>

        {acumConSuma.length === 0 ? (
          <div style={{ textAlign:'center', padding:24, fontSize:13, color:'var(--arcilla)' }}>Sin datos para este período</div>
        ) : (() => {
          const W = 600, H = 160, pad = 14
          const n = acumConSuma.length
          const colW = (W - pad * 2) / n
          const barW = colW * 0.55
          return (
            <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="auto" style={{ display:'block' }}>
              {/* Línea de referencia */}
              {[0.25, 0.5, 0.75, 1].map(pct => {
                const y = H - 22 - pct * (H - 42)
                return <line key={pct} x1={pad} x2={W-pad} y1={y} y2={y} stroke="#E8D5A3" strokeWidth="0.8" strokeDasharray="3 3"/>
              })}
              {acumConSuma.map((m, i) => {
                const cx = pad + colW * i + colW / 2
                const alturaBarra = m.mm > 0 ? Math.max((m.mm / maxMmMes) * (H-62), 3) : 2
                const cyAcum = H - 22 - (m.acumTotal / maxAcum) * (H - 42)
                const esMesActual = fModo === 'anho' && fAnho === new Date().getFullYear() && m.mes === new Date().getMonth()
                return (
                  <g key={m.mes}>
                    {/* Barra mm del mes */}
                    <rect x={cx - barW/2} y={H - 22 - alturaBarra} width={barW} height={alturaBarra}
                      fill={esMesActual ? '#4E7A8A' : m.mm > 0 ? '#7A9EAD' : '#E4EFF3'} rx="2" opacity="0.85"/>
                    {/* Valor mm sobre la barra si > 0 */}
                    {m.mm > 0 && (
                      <text x={cx} y={H - 26 - alturaBarra} textAnchor="middle" fontSize="7.5" fill="#4E7A8A" fontWeight="500">
                        {m.mm.toFixed(0)}
                      </text>
                    )}
                    {/* Punto acumulado */}
                    <circle cx={cx} cy={cyAcum} r="3" fill="#2C5A6A" stroke="#fff" strokeWidth="1.2"/>
                    {/* Acumulado total encima del punto */}
                    <text x={cx} y={cyAcum - 6} textAnchor="middle" fontSize="8" fill="#2C5A6A" fontWeight="600">
                      {m.acumTotal.toFixed(0)}
                    </text>
                    {/* Etiqueta mes */}
                    <text x={cx} y={H - 5} textAnchor="middle" fontSize="8.5" fill="#A08060">{m.label}</text>
                  </g>
                )
              })}
              {/* Línea acumulado */}
              {acumConSuma.length > 1 && (
                <polyline fill="none" stroke="#2C5A6A" strokeWidth="1.5" strokeDasharray="5 3" opacity="0.7"
                  points={acumConSuma.map((m, i) => {
                    const cx = pad + colW * i + colW / 2
                    const cy = H - 22 - (m.acumTotal / maxAcum) * (H - 42)
                    return `${cx},${cy}`
                  }).join(' ')}/>
              )}
            </svg>
          )
        })()}

        <div style={{ display:'flex', gap:16, marginTop:8, paddingTop:10, borderTop:'1px solid #EDE0C8' }}>
          <div style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, color:'var(--arcilla)' }}>
            <div style={{ width:12, height:8, background:'#7A9EAD', borderRadius:2 }}/> mm por mes
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, color:'var(--arcilla)' }}>
            <div style={{ width:16, height:2, borderTop:'2px dashed #2C5A6A' }}/> acumulado
          </div>
        </div>
      </div>

      <div className="grid-2">
        {/* Comparación anual */}
        <div className="card">
          <h3 style={{ marginBottom:14 }}>Comparación anual</h3>
          {comparAnhos.map(({ anho, total }) => (
            <div key={anho} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 0', borderBottom:'1px solid #EDE0C8' }}>
              <div style={{ fontSize:12, color: anho===fAnho ? 'var(--lluvia,#7A9EAD)' : 'var(--text-muted)', width:44, flexShrink:0, fontWeight: anho===fAnho ? 600 : 400 }}>{anho}</div>
              <div style={{ flex:1, height:10, background:'#E4EFF3', borderRadius:5, overflow:'hidden' }}>
                <div style={{ height:10, background: anho===fAnho ? '#4E7A8A' : '#7A9EAD', borderRadius:5, width:`${total/maxAnho*100}%`, opacity: anho===fAnho ? 1 : 0.6 }}/>
              </div>
              <div style={{ fontSize:12, color:'var(--lluvia,#7A9EAD)', fontWeight:500, width:58, textAlign:'right' }}>{total.toFixed(0)} mm</div>
            </div>
          ))}
        </div>

        {/* Eventos recientes */}
        <div className="card">
          <h3 style={{ marginBottom:14 }}>Eventos recientes</h3>
          {loading ? (
            <div style={{ fontSize:13, color:'var(--arcilla)' }}>Cargando...</div>
          ) : dataFiltrada.slice().reverse().slice(0, 12).map(d => (
            <div key={d.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 0', borderBottom:'1px solid #EDE0C8' }}>
              <div style={{ fontSize:11, color:'var(--text-muted)', width:60, flexShrink:0 }}>
                {new Date(d.fecha+'T12:00:00').toLocaleDateString('es-AR',{day:'2-digit',month:'short',year:'2-digit'})}
              </div>
              <div style={{ flex:1, height:8, background:'#E4EFF3', borderRadius:4, overflow:'hidden' }}>
                <div style={{ height:8, background: d.mm > 30 ? '#2C5A6A' : '#7A9EAD', borderRadius:4, width:`${(d.mm||0)/maxEventoGlobal*100}%` }}/>
              </div>
              <div style={{ fontSize:12, color:'var(--lluvia,#7A9EAD)', fontWeight:500, width:42, textAlign:'right' }}>{d.mm} mm</div>
              <div style={{ width:52, flexShrink:0 }}>
                <span style={{ fontSize:9, background:'#E4EFF3', borderRadius:4, padding:'1px 5px', color:'#4E7A8A' }}>
                  {d.campo === 'ambos' ? 'ambos' : d.campo === 'casco' ? 'casco' : '3esq'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
