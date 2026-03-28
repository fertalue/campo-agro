import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const CAMPANHAS   = ['25-26','24-25','23-24','22-23']
const GRANOS      = ['Maíz','Soja','Soja semilla','Trigo','Girasol']
const TIPOS       = ['Venta','Alquiler','Prestamo']
const TITULARES   = ['Fer','Leo','Fer y Leo','Giaguaro','Ketopy S.A','Dari','Dario']
const COMPRADORES = ['FYO Acopio S.A.','Tecnocampo','Oro verde','conci srl','Monsanto','MAS AGRO','DARIO ROSSI','6 hermanos','Eslava Gustavo']

const GRANO_COLOR = { 'Maíz':'#C8A96E', 'Soja':'#4A7C3F', 'Soja semilla':'#9DC87A', 'Trigo':'#A0714F', 'Girasol':'#EF9F27' }
const TIPO_CHIP   = { 'Venta':'chip-green', 'Alquiler':'chip-amber', 'Prestamo':'chip-sky', 'Cosecha':'chip-muted' }

function fmtTn(n) { if (!n) return '—'; return (n/1000).toLocaleString('es-AR',{minimumFractionDigits:1,maximumFractionDigits:1}) + ' tn' }
function fmtKg(n) { if (!n) return '—'; return Math.round(n).toLocaleString('es-AR') + ' kg' }
function fmtPct(n) { if (!n && n!==0) return '—'; return parseFloat(n).toFixed(1) + '%' }
function fmtFecha(f) { if (!f) return '—'; return new Date(f+'T12:00:00').toLocaleDateString('es-AR',{day:'2-digit',month:'short',year:'2-digit'}) }

const CSS = `
.vt-tabs{display:flex;gap:4px;margin-bottom:16px;border-bottom:1px solid #D8C9A8;}
.vt-tab{padding:8px 16px;font-size:12px;cursor:pointer;border-radius:8px 8px 0 0;color:#A08060;border:1px solid transparent;border-bottom:none;transition:all .15s;margin-bottom:-1px;background:transparent;font-family:inherit;}
.vt-tab.on{background:#FDFAF4;border-color:#D8C9A8;color:#3B2E1E;font-weight:500;}
.vt-stat{background:#FDFAF4;border:1px solid #D8C9A8;border-radius:10px;padding:12px 14px;}
.vt-sl{font-size:10px;color:#A08060;font-weight:500;letter-spacing:.06em;text-transform:uppercase;margin-bottom:5px;}
.vt-sv{font-size:18px;font-weight:600;color:#3B2E1E;line-height:1;}
.vt-ss{font-size:11px;color:#A08060;margin-top:4px;}
.vt-bar{height:3px;background:#E8D5A3;border-radius:2px;margin-top:8px;}
.vt-fill{height:3px;border-radius:2px;}
.vt-tbl{width:100%;border-collapse:collapse;font-size:12px;}
.vt-tbl th{text-align:left;padding:7px 10px;font-size:10px;font-weight:600;color:#A08060;letter-spacing:.05em;text-transform:uppercase;border-bottom:1px solid #D8C9A8;white-space:nowrap;}
.vt-tbl td{padding:8px 10px;border-bottom:1px solid #EDE0C8;color:#3B2E1E;vertical-align:middle;white-space:nowrap;}
.vt-tbl tr:last-child td{border-bottom:none;}
.vt-tbl tr:hover td{background:#FDFAF0;}
.cc{display:inline-flex;align-items:center;padding:2px 7px;border-radius:20px;font-size:10px;font-weight:500;}
.chip-green{background:#EBF4E8;color:#2E4F26;}
.chip-amber{background:#F5EDD8;color:#6B3E22;}
.chip-sky{background:#E4F0F4;color:#2C5A6A;}
.chip-muted{background:#EFECE4;color:#7A6040;}
.chip-red{background:#FCEBEB;color:#993C1D;}
.vt-prog-wrap{background:#E8D5A3;border-radius:6px;height:12px;overflow:hidden;flex:1;}
.vt-prog-fill{height:12px;border-radius:6px;transition:width .5s;}
`

function StatCard({ label, value, sub, color, pct }) {
  return (
    <div className="vt-stat">
      <div className="vt-sl">{label}</div>
      <div className="vt-sv">{value}</div>
      <div className="vt-ss">{sub}</div>
      <div className="vt-bar"><div className="vt-fill" style={{ width: `${Math.min(pct||70,100)}%`, background: color }} /></div>
    </div>
  )
}

// ── Formulario nuevo viaje ──────────────────────────────────────────────────
function FormViaje({ onSave, onCancel }) {
  const empty = {
    fecha:'', campanha:'25-26', tipo:'Venta', ncp:'', grano:'Maíz',
    titular:'Fer', ctg:'', comprador:'FYO Acopio S.A.', transporte:'',
    patente:'', bruto:'', tara:'', neto:'', kg_descargados:'',
    merma_vol:'', merma_h:'', merma_s:'', neto_romaneo:'',
    h_pct:'', kg_sin_contrato:'', contrato_aplicado:'',
  }
  const [form, setForm] = useState({ ...empty, fecha: new Date().toISOString().split('T')[0] })
  const f = (k,v) => setForm(p => ({...p,[k]:v}))
  const [saving, setSaving] = useState(false)

  const neto = (parseFloat(form.bruto)||0) - (parseFloat(form.tara)||0)
  const dif  = (parseFloat(form.kg_descargados)||0) - neto
  const mermaTotal = (parseFloat(form.merma_vol)||0) + (parseFloat(form.merma_h)||0) + (parseFloat(form.merma_s)||0)
  const netoRomaneoCalc = (parseFloat(form.kg_descargados)||0) - mermaTotal

  async function submit(e) {
    e.preventDefault(); setSaving(true)
    await supabase.from('granos_viajes').insert({
      ...form,
      bruto: parseFloat(form.bruto)||null, tara: parseFloat(form.tara)||null,
      neto: neto||null, kg_descargados: parseFloat(form.kg_descargados)||null,
      dif_puerto: dif||null,
      merma_vol: parseFloat(form.merma_vol)||null,
      merma_h: parseFloat(form.merma_h)||null,
      merma_s: parseFloat(form.merma_s)||null,
      neto_romaneo: parseFloat(form.neto_romaneo)||netoRomaneoCalc||null,
      h_pct: parseFloat(form.h_pct)||null,
      kg_sin_contrato: parseFloat(form.kg_sin_contrato)||null,
    })
    setSaving(false); onSave()
  }

  const inp = (k, type='text', ph='') => (
    <input className="input" type={type} value={form[k]} placeholder={ph}
      onChange={e => f(k, e.target.value)} style={{ width:'100%' }} />
  )
  const sel = (k, opts) => (
    <select className="select" value={form[k]} onChange={e => f(k, e.target.value)} style={{ width:'100%' }}>
      {opts.map(o => <option key={o}>{o}</option>)}
    </select>
  )

  return (
    <div className="card mb-3" style={{ background:'#F9F6EE', borderColor:'var(--paja)' }}>
      <h3 style={{ marginBottom:16 }}>Nuevo viaje</h3>
      <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:12 }}>
        <div className="grid-2">
          <div className="field"><label className="label">Fecha</label>{inp('fecha','date')}</div>
          <div className="field"><label className="label">Campaña</label>{sel('campanha', CAMPANHAS)}</div>
        </div>
        <div className="grid-2">
          <div className="field"><label className="label">Tipo</label>{sel('tipo', TIPOS)}</div>
          <div className="field"><label className="label">N° CP</label>{inp('ncp','text','0-001')}</div>
        </div>
        <div className="grid-2">
          <div className="field"><label className="label">Grano</label>{sel('grano', GRANOS)}</div>
          <div className="field"><label className="label">Titular</label>
            <input className="input" value={form.titular} onChange={e=>f('titular',e.target.value)}
              list="titulares-list" style={{width:'100%'}} />
            <datalist id="titulares-list">{TITULARES.map(t=><option key={t} value={t}/>)}</datalist>
          </div>
        </div>
        <div className="grid-2">
          <div className="field"><label className="label">Comprador</label>
            <input className="input" value={form.comprador} onChange={e=>f('comprador',e.target.value)}
              list="compradores-list" style={{width:'100%'}} />
            <datalist id="compradores-list">{COMPRADORES.map(c=><option key={c} value={c}/>)}</datalist>
          </div>
          <div className="field"><label className="label">Patente</label>{inp('patente')}</div>
        </div>
        <div className="field"><label className="label">CTG</label>{inp('ctg')}</div>

        {/* Pesada campo */}
        <div style={{ background:'#F0F6FA', border:'1px solid #B8D0D8', borderRadius:8, padding:'12px 14px' }}>
          <div style={{ fontSize:11, fontWeight:500, color:'var(--lluvia)', letterSpacing:'0.05em', textTransform:'uppercase', marginBottom:10 }}>Pesada campo</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
            <div className="field"><label className="label">Bruto (kg)</label>{inp('bruto','number')}</div>
            <div className="field"><label className="label">Tara (kg)</label>{inp('tara','number')}</div>
            <div className="field"><label className="label">Neto (kg)</label>
              <input className="input" type="number" value={neto||''} readOnly
                style={{ width:'100%', background:'#E8EFF3', color:'var(--lluvia)', fontWeight:600 }} />
            </div>
          </div>
        </div>

        {/* Descarga puerto */}
        <div style={{ background:'#F5F0E8', border:'1px solid #D8C9A8', borderRadius:8, padding:'12px 14px' }}>
          <div style={{ fontSize:11, fontWeight:500, color:'var(--arcilla)', letterSpacing:'0.05em', textTransform:'uppercase', marginBottom:10 }}>Descarga puerto</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:8 }}>
            <div className="field"><label className="label">Kg descargados</label>{inp('kg_descargados','number')}</div>
            <div className="field"><label className="label">Diferencia campo/puerto</label>
              <input className="input" type="number" value={dif||''} readOnly
                style={{ width:'100%', background:'#F0EAE0', color: dif < 0 ? '#993C1D':'var(--arcilla)', fontWeight:600 }} />
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
            <div className="field"><label className="label">Merma vol.</label>{inp('merma_vol','number')}</div>
            <div className="field"><label className="label">Merma H.</label>{inp('merma_h','number')}</div>
            <div className="field"><label className="label">Merma S.</label>{inp('merma_s','number')}</div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginTop:8 }}>
            <div className="field"><label className="label">H%</label>{inp('h_pct','number')}</div>
            <div className="field"><label className="label">Neto Romaneo (kg)</label>
              <input className="input" type="number" value={form.neto_romaneo||netoRomaneoCalc||''}
                onChange={e=>f('neto_romaneo',e.target.value)}
                style={{ width:'100%', fontWeight:600, color:'var(--musgo)' }}
                placeholder={netoRomaneoCalc ? String(Math.round(netoRomaneoCalc)) : '0'} />
            </div>
          </div>
        </div>

        <div className="grid-2">
          <div className="field"><label className="label">Kg sin contrato</label>{inp('kg_sin_contrato','number')}</div>
          <div className="field"><label className="label">Contrato aplicado</label>{inp('contrato_aplicado')}</div>
        </div>

        <div style={{ display:'flex', gap:8 }}>
          <button className="btn btn-primary" type="submit" disabled={saving}>{saving?'Guardando...':'Guardar viaje'}</button>
          <button className="btn btn-secondary" type="button" onClick={onCancel}>Cancelar</button>
        </div>
      </form>
    </div>
  )
}

// ── Formulario cosecha ──────────────────────────────────────────────────────
function FormCosecha({ onSave, onCancel }) {
  const [form, setForm] = useState({ fecha: new Date().toISOString().split('T')[0], campanha:'25-26', grano:'Maíz', neto_romaneo:'' })
  const [saving, setSaving] = useState(false)
  async function submit(e) {
    e.preventDefault(); setSaving(true)
    await supabase.from('granos_cosecha').insert({ ...form, neto_romaneo: parseFloat(form.neto_romaneo)||null })
    setSaving(false); onSave()
  }
  return (
    <div className="card mb-3" style={{ background:'#F5F9F0', borderColor:'var(--brote)' }}>
      <h3 style={{ marginBottom:14 }}>Registrar cosecha</h3>
      <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:12 }}>
        <div className="grid-2">
          <div className="field"><label className="label">Fecha</label>
            <input className="input" type="date" value={form.fecha} onChange={e=>setForm(p=>({...p,fecha:e.target.value}))} style={{width:'100%'}}/>
          </div>
          <div className="field"><label className="label">Campaña</label>
            <select className="select" value={form.campanha} onChange={e=>setForm(p=>({...p,campanha:e.target.value}))} style={{width:'100%'}}>
              {CAMPANHAS.map(c=><option key={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div className="grid-2">
          <div className="field"><label className="label">Grano</label>
            <select className="select" value={form.grano} onChange={e=>setForm(p=>({...p,grano:e.target.value}))} style={{width:'100%'}}>
              {GRANOS.map(g=><option key={g}>{g}</option>)}
            </select>
          </div>
          <div className="field"><label className="label">Total cosechado (kg Neto Romaneo)</label>
            <input className="input" type="number" value={form.neto_romaneo} onChange={e=>setForm(p=>({...p,neto_romaneo:e.target.value}))} style={{width:'100%'}} required/>
          </div>
        </div>
        <div style={{display:'flex',gap:8}}>
          <button className="btn btn-primary" type="submit" disabled={saving}>{saving?'Guardando...':'Guardar cosecha'}</button>
          <button className="btn btn-secondary" type="button" onClick={onCancel}>Cancelar</button>
        </div>
      </form>
    </div>
  )
}

// ── Componente principal ────────────────────────────────────────────────────
export default function Ventas() {
  const [viajes,  setViajes]  = useState([])
  const [cosecha, setCosecha] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab]         = useState('resumen')
  const [showForm, setShowForm]   = useState(false)
  const [showCosecha, setShowCosecha] = useState(false)
  const [fCampanha, setFCampanha] = useState('25-26')
  const [fGrano, setFGrano]   = useState('Todos')
  const [fTipo, setFTipo]     = useState('Todos')
  const [busqueda, setBusqueda] = useState('')

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [v, c] = await Promise.all([
      supabase.from('granos_viajes').select('*').order('fecha', { ascending: false }),
      supabase.from('granos_cosecha').select('*').order('fecha', { ascending: false }),
    ])
    setViajes(v.data || [])
    setCosecha(c.data || [])
    setLoading(false)
  }

  // Filtros
  const filtered = viajes.filter(v => {
    if (fCampanha !== 'Todas' && v.campanha !== fCampanha) return false
    if (fGrano !== 'Todos' && v.grano !== fGrano) return false
    if (fTipo !== 'Todos' && v.tipo !== fTipo) return false
    if (busqueda) {
      const b = busqueda.toLowerCase()
      return [v.titular, v.comprador, v.grano, v.ncp, v.contrato_aplicado, v.patente]
        .some(x => x && x.toLowerCase().includes(b))
    }
    return true
  })

  const cosechaFiltrada = cosecha.filter(c => fCampanha === 'Todas' || c.campanha === fCampanha)

  // Totales
  const totalRomaneo = filtered.reduce((a,b) => a + (b.neto_romaneo||0), 0)
  const totalNeto    = filtered.reduce((a,b) => a + (b.neto||0), 0)
  const totalDif     = filtered.reduce((a,b) => a + (b.dif_puerto||0), 0)
  const totalViajes  = filtered.length

  // Por grano — romaneo y cosecha
  const byGrano = {}
  filtered.forEach(v => {
    if (!byGrano[v.grano]) byGrano[v.grano] = { vendido: 0, count: 0 }
    byGrano[v.grano].vendido += v.neto_romaneo || 0
    byGrano[v.grano].count   += 1
  })
  cosechaFiltrada.forEach(c => {
    if (!byGrano[c.grano]) byGrano[c.grano] = { vendido: 0, count: 0 }
    byGrano[c.grano].cosecha = (byGrano[c.grano].cosecha||0) + (c.neto_romaneo||0)
  })

  // Por titular
  const byTitular = {}
  filtered.forEach(v => {
    const t = v.titular || 'Sin titular'
    if (!byTitular[t]) byTitular[t] = 0
    byTitular[t] += v.neto_romaneo || 0
  })

  const granos = Object.keys(byGrano)
  const campAnhos = ['Todas', ...CAMPANHAS]

  return (
    <div>
      <style>{CSS}</style>

      {/* Header */}
      <div className="flex-between mb-2">
        <div>
          <h2>Ventas / Granos</h2>
          <p style={{ fontSize:12, color:'var(--arcilla)', marginTop:2 }}>
            {totalViajes} viajes · {fmtTn(totalRomaneo)} neto romaneo
          </p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowCosecha(v=>!v)}>
            {showCosecha ? 'Cancelar' : '+ Cosecha'}
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowForm(v=>!v)}>
            {showForm ? 'Cancelar' : '+ Viaje'}
          </button>
        </div>
      </div>

      {showCosecha && <FormCosecha onSave={async()=>{setShowCosecha(false);await fetchAll()}} onCancel={()=>setShowCosecha(false)} />}
      {showForm    && <FormViaje  onSave={async()=>{setShowForm(false);  await fetchAll()}} onCancel={()=>setShowForm(false)} />}

      {/* Filtros */}
      <div style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap', alignItems:'center' }}>
        {[['campanha', setFCampanha, fCampanha, campAnhos],
          ['grano',    setFGrano,   fGrano,   ['Todos',...GRANOS]],
          ['tipo',     setFTipo,    fTipo,    ['Todos',...TIPOS]],
        ].map(([k, setter, val, opts]) => (
          <select key={k} value={val} onChange={e=>setter(e.target.value)}
            style={{ padding:'6px 8px', border:'1px solid #D8C9A8', borderRadius:6, fontSize:12, background:'#F5F0E4', fontFamily:'inherit', color:'#3B2E1E' }}>
            {opts.map(o => <option key={o}>{o}</option>)}
          </select>
        ))}
      </div>

      {/* Tabs */}
      <div className="vt-tabs">
        {[['resumen','Resumen'],['viajes','Viajes'],['mermas','Pesada vs Puerto']].map(([id,lbl]) => (
          <button key={id} className={`vt-tab${tab===id?' on':''}`} onClick={()=>setTab(id)}>{lbl}</button>
        ))}
      </div>

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,minmax(0,1fr))', gap:10, marginBottom:16 }}>
        <StatCard label="Neto Romaneo" value={fmtTn(totalRomaneo)} sub={`${totalViajes} viajes`} color="#4A7C3F" pct={80} />
        <StatCard label="Pesada campo" value={fmtTn(totalNeto)} sub="neto campo" color="#7A9EAD" pct={85} />
        <StatCard label="Dif. campo/puerto" value={fmtKg(Math.abs(totalDif))} sub={totalDif > 0 ? 'a favor' : 'en contra'} color={totalDif >= 0 ? '#4A7C3F' : '#A0714F'} pct={40} />
        <StatCard label="Camiones" value={totalViajes.toString()} sub={`campaña ${fCampanha}`} color="#C8A96E" pct={60} />
      </div>

      {/* RESUMEN */}
      {tab === 'resumen' && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
          {/* Por grano con progreso cosecha */}
          <div className="card">
            <h3 style={{ fontSize:14, marginBottom:14 }}>Por grano — % cosecha vendida</h3>
            {granos.length === 0
              ? <div style={{ fontSize:13, color:'var(--arcilla)' }}>Sin datos</div>
              : granos.map(g => {
                const data = byGrano[g]
                const pct  = data.cosecha ? Math.min((data.vendido/data.cosecha)*100,100) : null
                const col  = GRANO_COLOR[g] || '#888'
                return (
                  <div key={g} style={{ marginBottom:14 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <div style={{ width:10, height:10, borderRadius:'50%', background:col, flexShrink:0 }}/>
                        <span style={{ fontSize:13, fontWeight:500 }}>{g}</span>
                        <span style={{ fontSize:11, color:'var(--text-muted)' }}>({data.count} viajes)</span>
                      </div>
                      <div style={{ textAlign:'right' }}>
                        <span style={{ fontSize:13, fontWeight:600 }}>{fmtTn(data.vendido)}</span>
                        {data.cosecha && <span style={{ fontSize:11, color:'var(--text-muted)', marginLeft:6 }}>de {fmtTn(data.cosecha)}</span>}
                      </div>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <div className="vt-prog-wrap">
                        <div className="vt-prog-fill" style={{ width: pct ? `${pct}%`:'100%', background: col, opacity: pct ? 1 : 0.3 }}/>
                      </div>
                      <span style={{ fontSize:12, fontWeight:600, color:col, width:40, textAlign:'right', flexShrink:0 }}>
                        {pct ? `${Math.round(pct)}%` : '—'}
                      </span>
                    </div>
                    {data.cosecha && (
                      <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:3 }}>
                        Queda: {fmtTn(data.cosecha - data.vendido)} · Cosecha total: {fmtTn(data.cosecha)}
                      </div>
                    )}
                  </div>
                )
              })}
          </div>

          {/* Por titular */}
          <div className="card">
            <h3 style={{ fontSize:14, marginBottom:14 }}>Por titular</h3>
            {Object.entries(byTitular).sort((a,b)=>b[1]-a[1]).map(([tit, vol]) => (
              <div key={tit} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 0', borderBottom:'1px solid #EDE0C8' }}>
                <div style={{ width:32, height:32, borderRadius:'50%', background:'var(--verde-light)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:600, color:'var(--musgo)', flexShrink:0 }}>
                  {tit.slice(0,2).toUpperCase()}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:500 }}>{tit}</div>
                  <div style={{ height:6, background:'#E8D5A3', borderRadius:3, marginTop:4, overflow:'hidden' }}>
                    <div style={{ height:6, borderRadius:3, background:'var(--pasto)', width:`${vol/totalRomaneo*100}%` }}/>
                  </div>
                </div>
                <div style={{ textAlign:'right', flexShrink:0 }}>
                  <div style={{ fontSize:14, fontWeight:600 }}>{fmtTn(vol)}</div>
                  <div style={{ fontSize:11, color:'var(--text-muted)' }}>{totalRomaneo ? Math.round(vol/totalRomaneo*100) : 0}%</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* VIAJES */}
      {tab === 'viajes' && (
        <div>
          <div style={{ marginBottom:10, position:'relative' }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="var(--arcilla)" strokeWidth="1.5" strokeLinecap="round" style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }}>
              <circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5L14 14"/>
            </svg>
            <input value={busqueda} onChange={e=>setBusqueda(e.target.value)}
              placeholder="Buscar por titular, comprador, contrato, patente..."
              style={{ width:'100%', padding:'9px 12px 9px 32px', border:'1px solid #D8C9A8', borderRadius:8, fontSize:13, background:'#FDFAF4', fontFamily:'inherit' }} />
          </div>
          <div className="card" style={{ padding:0, overflowX:'auto' }}>
            {loading
              ? <div style={{ padding:32, textAlign:'center', fontSize:13, color:'var(--arcilla)' }}>Cargando...</div>
              : filtered.length === 0
              ? <div style={{ padding:32, textAlign:'center', fontSize:13, color:'var(--arcilla)' }}>Sin viajes</div>
              : <table className="vt-tbl">
                  <thead><tr>
                    <th>Fecha</th><th>Campaña</th><th>Tipo</th><th>N°CP</th><th>Grano</th>
                    <th>Titular</th><th>Comprador</th><th>Bruto</th><th>Tara</th>
                    <th>Neto campo</th><th>Kg descarg.</th><th>Dif.</th>
                    <th>Merma vol</th><th>Merma H</th><th>Merma S</th>
                    <th>Neto Romaneo</th><th>H%</th><th>Contrato</th>
                  </tr></thead>
                  <tbody>
                    {filtered.map(v => (
                      <tr key={v.id}>
                        <td style={{ color:'var(--text-muted)' }}>{fmtFecha(v.fecha)}</td>
                        <td style={{ color:'var(--text-muted)' }}>{v.campanha}</td>
                        <td><span className={`cc ${TIPO_CHIP[v.tipo]||'chip-muted'}`}>{v.tipo}</span></td>
                        <td style={{ color:'var(--text-muted)' }}>{v.ncp}</td>
                        <td>
                          <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                            <div style={{ width:8, height:8, borderRadius:'50%', background:GRANO_COLOR[v.grano]||'#888', flexShrink:0 }}/>
                            {v.grano}
                          </div>
                        </td>
                        <td style={{ fontWeight:500 }}>{v.titular}</td>
                        <td style={{ color:'var(--suelo)' }}>{v.comprador}</td>
                        <td style={{ fontFamily:'monospace' }}>{fmtKg(v.bruto)}</td>
                        <td style={{ fontFamily:'monospace' }}>{fmtKg(v.tara)}</td>
                        <td style={{ fontFamily:'monospace', fontWeight:500 }}>{fmtKg(v.neto)}</td>
                        <td style={{ fontFamily:'monospace' }}>{fmtKg(v.kg_descargados)}</td>
                        <td style={{ fontFamily:'monospace', color: (v.dif_puerto||0) > 0 ? 'var(--musgo)' : '#993C1D' }}>
                          {v.dif_puerto ? `${v.dif_puerto > 0 ? '+':''}${Math.round(v.dif_puerto).toLocaleString('es-AR')}` : '—'}
                        </td>
                        <td style={{ fontFamily:'monospace', color:'var(--text-muted)' }}>{fmtKg(v.merma_vol)}</td>
                        <td style={{ fontFamily:'monospace', color:'var(--text-muted)' }}>{fmtKg(v.merma_h)}</td>
                        <td style={{ fontFamily:'monospace', color:'var(--text-muted)' }}>{fmtKg(v.merma_s)}</td>
                        <td style={{ fontFamily:'monospace', fontWeight:600, color:'var(--musgo)' }}>{fmtKg(v.neto_romaneo)}</td>
                        <td style={{ color:'var(--text-muted)' }}>{fmtPct(v.h_pct)}</td>
                        <td style={{ fontSize:11, color:'var(--text-muted)' }}>{v.contrato_aplicado||'—'}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background:'#F5F0E4', fontWeight:600 }}>
                      <td colSpan={7} style={{ padding:'10px 10px', fontSize:11, color:'var(--text-muted)' }}>{filtered.length} viajes</td>
                      <td colSpan={2}></td>
                      <td style={{ padding:'10px 10px', fontFamily:'monospace' }}>{fmtKg(totalNeto)}</td>
                      <td colSpan={1}></td>
                      <td style={{ padding:'10px 10px', fontFamily:'monospace', color: totalDif >= 0 ? 'var(--musgo)' : '#993C1D' }}>
                        {totalDif ? `${totalDif>0?'+':''}${Math.round(totalDif).toLocaleString('es-AR')}` : '—'}
                      </td>
                      <td colSpan={3}></td>
                      <td style={{ padding:'10px 10px', fontFamily:'monospace', color:'var(--musgo)' }}>{fmtKg(totalRomaneo)}</td>
                      <td colSpan={2}></td>
                    </tr>
                  </tfoot>
                </table>}
          </div>
        </div>
      )}

      {/* MERMAS - Pesada vs Puerto */}
      {tab === 'mermas' && (
        <div>
          {/* Por grano */}
          {granos.map(g => {
            const gViajes = filtered.filter(v => v.grano === g && v.neto)
            if (!gViajes.length) return null
            const gNeto     = gViajes.reduce((a,b) => a+(b.neto||0), 0)
            const gDescarg  = gViajes.reduce((a,b) => a+(b.kg_descargados||0), 0)
            const gRomaneo  = gViajes.reduce((a,b) => a+(b.neto_romaneo||0), 0)
            const gMermaVol = gViajes.reduce((a,b) => a+(b.merma_vol||0), 0)
            const gMermaH   = gViajes.reduce((a,b) => a+(b.merma_h||0), 0)
            const gMermaS   = gViajes.reduce((a,b) => a+(b.merma_s||0), 0)
            const pctMerma  = gNeto > 0 ? ((gNeto - gRomaneo) / gNeto * 100) : 0
            const col       = GRANO_COLOR[g] || '#888'
            return (
              <div key={g} className="card" style={{ marginBottom:14 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <div style={{ width:12, height:12, borderRadius:'50%', background:col }}/>
                    <h3 style={{ fontSize:14 }}>{g}</h3>
                    <span style={{ fontSize:11, color:'var(--text-muted)' }}>{gViajes.length} viajes</span>
                  </div>
                  <span style={{ fontSize:12, color: pctMerma > 3 ? '#993C1D' : 'var(--musgo)', fontWeight:600 }}>
                    Pérdida total: {pctMerma.toFixed(2)}%
                  </span>
                </div>

                {/* Barra visual */}
                <div style={{ display:'flex', height:32, borderRadius:8, overflow:'hidden', marginBottom:12, fontSize:11, fontWeight:500 }}>
                  <div style={{ background:col, flex: gRomaneo, display:'flex', alignItems:'center', justifyContent:'center', color:'white', minWidth:60 }}>
                    Romaneo
                  </div>
                  {gMermaVol > 0 && <div style={{ background:'#A0714F', flex:gMermaVol, display:'flex', alignItems:'center', justifyContent:'center', color:'white', minWidth:30 }}>vol</div>}
                  {gMermaH > 0 && <div style={{ background:'#7A9EAD', flex:gMermaH, display:'flex', alignItems:'center', justifyContent:'center', color:'white', minWidth:30 }}>H</div>}
                  {gMermaS > 0 && <div style={{ background:'#C8A96E', flex:gMermaS, display:'flex', alignItems:'center', justifyContent:'center', color:'white', minWidth:30 }}>S</div>}
                </div>

                <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:8 }}>
                  {[
                    ['Neto campo', fmtTn(gNeto), '#7A9EAD'],
                    ['Descargado', fmtTn(gDescarg), '#4E7A8A'],
                    ['Merma vol.', fmtTn(gMermaVol), '#A0714F'],
                    ['Merma H.', fmtTn(gMermaH), '#7A9EAD'],
                    ['Merma S.', fmtTn(gMermaS), '#C8A96E'],
                    ['Neto Romaneo', fmtTn(gRomaneo), col],
                  ].map(([lbl,val,c]) => (
                    <div key={lbl} style={{ background:'#FAF7F0', borderRadius:8, padding:'10px', textAlign:'center' }}>
                      <div style={{ fontSize:10, color:'var(--text-muted)', fontWeight:500, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:4 }}>{lbl}</div>
                      <div style={{ fontSize:13, fontWeight:600, color:c }}>{val}</div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
