import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { exportCSV } from '../lib/supabase'

const CAMPANHAS = ['25-26','24-25','23-24','22-23']
const PRODUCTOS = ['Soja','Maíz','Trigo','Girasol','Sorgo','Soja semilla']
const COMPRADORES = ['FYO Acopio S.A.','Bunge','Cargill','Nidera','Tecnocampo','Gyssa','Otro']

function fmtUSD(n, dec=2) {
  if (!n && n !== 0) return '—'
  return 'U$S ' + parseFloat(n).toLocaleString('es-AR', { minimumFractionDigits: dec, maximumFractionDigits: dec })
}
function fmtNum(n, dec=0) {
  if (!n && n !== 0) return '—'
  return parseFloat(n).toLocaleString('es-AR', { minimumFractionDigits: dec, maximumFractionDigits: dec })
}
function fmtFecha(f) {
  if (!f) return '—'
  return new Date(f + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: '2-digit' })
}

const CHIP = { 'Fer':'chip-green', 'Leo':'chip-amber', 'ambos':'chip-sky' }
const PROD_COLORS = {
  'Soja':   '#4A7C3F', 'Maíz': '#C8A96E', 'Trigo': '#A0714F',
  'Girasol':'#EF9F27', 'Sorgo':'#7A9EAD', 'Soja semilla':'#6A9E58',
}

const CSS = `
.ct-chip{display:inline-flex;align-items:center;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:500;}
.chip-green{background:#EBF4E8;color:#2E4F26;}
.chip-amber{background:#F5EDD8;color:#6B3E22;}
.chip-sky{background:#E4F0F4;color:#2C5A6A;}
.chip-muted{background:#EFECE4;color:#7A6040;}
.ct-stat{background:#FDFAF4;border:1px solid #D8C9A8;border-radius:10px;padding:12px 14px;}
.ct-sl{font-size:10px;color:#A08060;font-weight:500;letter-spacing:.06em;text-transform:uppercase;margin-bottom:5px;}
.ct-sv{font-size:18px;font-weight:600;color:#3B2E1E;line-height:1;}
.ct-ss{font-size:11px;color:#A08060;margin-top:4px;}
.ct-bar{height:3px;background:#E8D5A3;border-radius:2px;margin-top:8px;}
.ct-fill{height:3px;border-radius:2px;}
.ct-tbl{width:100%;border-collapse:collapse;font-size:12px;}
.ct-tbl th{text-align:left;padding:7px 10px;font-size:10px;font-weight:600;color:#A08060;letter-spacing:.05em;text-transform:uppercase;border-bottom:1px solid #D8C9A8;}
.ct-tbl td{padding:10px 10px;border-bottom:1px solid #EDE0C8;color:#3B2E1E;vertical-align:middle;}
.ct-tbl tr:last-child td{border-bottom:none;}
.ct-tbl tr:hover td{background:#FDFAF0;}
.ct-prod-dot{width:10px;height:10px;border-radius:50%;display:inline-block;margin-right:6px;flex-shrink:0;}
`

export default function Contratos() {
  const [contratos, setContratos] = useState([])
  const [loading, setLoading]     = useState(true)
  const [showForm, setShowForm]   = useState(false)
  const [saving, setSaving]       = useState(false)
  const [vista, setVista]         = useState('tabla')  // tabla | resumen
  const [fCampanha, setFCampanha] = useState('Todas')
  const [fProducto, setFProducto] = useState('Todos')
  const [fNombre, setFNombre]     = useState('Todos')

  const emptyForm = {
    fecha_cierre:  new Date().toISOString().split('T')[0],
    campanha:      '25-26',
    producto:      'Soja',
    volumen:       '',
    unidad:        'tn',
    precio:        '',
    moneda:        'USD',
    fecha_entrega: '',
    a_nombre:      'ambos',
    comprador:     '',
    observaciones: '',
  }
  const [form, setForm] = useState(emptyForm)
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const monto = (parseFloat(form.volumen) || 0) * (parseFloat(form.precio) || 0)

  useEffect(() => { fetchContratos() }, [])

  async function fetchContratos() {
    setLoading(true)
    const { data } = await supabase.from('contratos').select('*').order('fecha_cierre', { ascending: false })
    setContratos(data || [])
    setLoading(false)
  }

  async function handleSave(e) {
    e.preventDefault(); setSaving(true)
    await supabase.from('contratos').insert({
      ...form,
      volumen:     parseFloat(form.volumen) || null,
      precio:      parseFloat(form.precio) || null,
      monto_total: monto || null,
    })
    setForm(emptyForm)
    setShowForm(false)
    await fetchContratos()
    setSaving(false)
  }

  // Filtros
  const filtered = contratos.filter(c => {
    if (fCampanha !== 'Todas' && c.campanha !== fCampanha) return false
    if (fProducto !== 'Todos' && c.producto !== fProducto) return false
    if (fNombre !== 'Todos' && c.a_nombre !== fNombre) return false
    return true
  })

  const totalVol   = filtered.reduce((a,b) => a + (b.volumen||0), 0)
  const totalMonto = filtered.reduce((a,b) => a + (b.monto_total||0), 0)
  const precioMedio = totalVol > 0 ? totalMonto / totalVol : 0

  // Por producto
  const byProd = {}
  filtered.forEach(c => {
    if (!byProd[c.producto]) byProd[c.producto] = { vol: 0, monto: 0, count: 0 }
    byProd[c.producto].vol   += c.volumen || 0
    byProd[c.producto].monto += c.monto_total || 0
    byProd[c.producto].count += 1
  })
  const prodList = Object.entries(byProd).sort((a,b) => b[1].vol - a[1].vol)
  const maxVol = prodList[0]?.[1].vol || 1

  // Por nombre (Fer / Leo)
  const byNombre = {}
  filtered.forEach(c => {
    const n = c.a_nombre || 'Sin asignar'
    if (!byNombre[n]) byNombre[n] = { vol: 0, monto: 0 }
    byNombre[n].vol   += c.volumen || 0
    byNombre[n].monto += c.monto_total || 0
  })

  const inp = (k, type='text', ph='') => (
    <input className="input" type={type} value={form[k]} placeholder={ph}
      onChange={e => f(k, e.target.value)} style={{ width: '100%' }} />
  )
  const sel = (k, opts) => (
    <select className="select" value={form[k]} onChange={e => f(k, e.target.value)} style={{ width: '100%' }}>
      {opts.map(o => <option key={o}>{o}</option>)}
    </select>
  )

  return (
    <div>
      <style>{CSS}</style>

      {/* Header */}
      <div className="flex-between mb-2">
        <div>
          <h2>Contratos</h2>
          <p style={{ fontSize: 12, color: 'var(--arcilla)', marginTop: 2 }}>
            {filtered.length} contratos · {fmtNum(totalVol)} tn · {fmtUSD(totalMonto, 0)}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn btn-secondary btn-sm" onClick={() => exportCSV(filtered, 'contratos')}>CSV</button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowForm(v => !v)}>
            {showForm ? 'Cancelar' : '+ Nuevo contrato'}
          </button>
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <div className="card mb-3" style={{ background: '#F9F6EE', borderColor: 'var(--paja)' }}>
          <h3 style={{ marginBottom: 16 }}>Nuevo contrato</h3>
          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="grid-2">
              <div className="field"><label className="label">Fecha de cierre</label>{inp('fecha_cierre','date')}</div>
              <div className="field"><label className="label">Campaña</label>{sel('campanha', CAMPANHAS)}</div>
            </div>
            <div className="grid-2">
              <div className="field"><label className="label">Producto</label>{sel('producto', PRODUCTOS)}</div>
              <div className="field"><label className="label">Comprador</label>
                <input className="input" value={form.comprador} onChange={e => f('comprador', e.target.value)}
                  placeholder="FYO, Bunge, Cargill..." list="compradores-list" style={{ width: '100%' }} />
                <datalist id="compradores-list">{COMPRADORES.map(c => <option key={c} value={c}/>)}</datalist>
              </div>
            </div>
            <div className="grid-2">
              <div className="field"><label className="label">Volumen</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {inp('volumen','number','0')}
                  <select className="select" value={form.unidad} onChange={e => f('unidad', e.target.value)} style={{ width: 80, flexShrink: 0 }}>
                    {['tn','qq','kg'].map(o => <option key={o}>{o}</option>)}
                  </select>
                </div>
              </div>
              <div className="field"><label className="label">Precio</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {inp('precio','number','0.00')}
                  <select className="select" value={form.moneda} onChange={e => f('moneda', e.target.value)} style={{ width: 80, flexShrink: 0 }}>
                    {['USD','ARS'].map(o => <option key={o}>{o}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Monto calculado */}
            {monto > 0 && (
              <div style={{ background: 'var(--verde-light)', border: '1px solid var(--brote)', borderRadius: 8, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: 'var(--musgo)' }}>Monto total calculado</span>
                <span style={{ fontSize: 18, fontWeight: 600, color: 'var(--musgo)' }}>
                  {form.moneda === 'USD' ? 'U$S ' : '$ '}{fmtNum(monto, 0)}
                </span>
              </div>
            )}

            <div className="grid-2">
              <div className="field"><label className="label">Fecha de entrega</label>{inp('fecha_entrega','date')}</div>
              <div className="field">
                <label className="label">A nombre de</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {['Fer','Leo','ambos'].map(o => (
                    <button key={o} type="button" onClick={() => f('a_nombre', o)} style={{
                      flex: 1, padding: '8px 4px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
                      border: '1px solid', fontFamily: 'inherit',
                      background: form.a_nombre === o ? 'var(--pasto)' : 'transparent',
                      color: form.a_nombre === o ? '#F5F0E4' : 'var(--arcilla)',
                      borderColor: form.a_nombre === o ? 'var(--pasto)' : 'var(--border)',
                    }}>{o}</button>
                  ))}
                </div>
              </div>
            </div>

            <div className="field">
              <label className="label">Observaciones</label>
              <textarea className="textarea" value={form.observaciones}
                onChange={e => f('observaciones', e.target.value)}
                placeholder="Número de contrato, condiciones, etc." style={{ minHeight: 56 }} />
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary" type="submit" disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar contrato'}
              </button>
              <button className="btn btn-secondary" type="button" onClick={() => setShowForm(false)}>Cancelar</button>
            </div>
          </form>
        </div>
      )}

      {/* Filtros + vista toggle */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        {[['fCampanha', setFCampanha, fCampanha, ['Todas',...CAMPANHAS]],
          ['fProducto', setFProducto, fProducto, ['Todos',...PRODUCTOS]],
          ['fNombre',   setFNombre,   fNombre,   ['Todos','Fer','Leo','ambos']]
        ].map(([key, setter, val, opts]) => (
          <select key={key} value={val} onChange={e => setter(e.target.value)}
            style={{ padding: '6px 8px', border: '1px solid #D8C9A8', borderRadius: 6, fontSize: 12, background: '#F5F0E4', color: '#3B2E1E', fontFamily: 'inherit' }}>
            {opts.map(o => <option key={o}>{o}</option>)}
          </select>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          {[['tabla','Tabla'],['resumen','Resumen']].map(([id,lbl]) => (
            <button key={id} onClick={() => setVista(id)} style={{
              padding: '6px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
              border: '1px solid', fontFamily: 'inherit',
              background: vista === id ? 'var(--pasto)' : 'transparent',
              color: vista === id ? '#F5F0E4' : 'var(--arcilla)',
              borderColor: vista === id ? 'var(--pasto)' : 'var(--border)',
            }}>{lbl}</button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 10, marginBottom: 16 }}>
        {[
          ['Volumen total', `${fmtNum(totalVol)} tn`, `${filtered.length} contratos`, '#4A7C3F'],
          ['Precio medio', fmtUSD(precioMedio), 'por tonelada', '#7A9EAD'],
          ['Monto total', fmtUSD(totalMonto, 0), 'todos los contratos', '#A0714F'],
          ['Fer / Leo', `${fmtNum(byNombre['Fer']?.vol||0)} / ${fmtNum(byNombre['Leo']?.vol||0)} tn`, 'distribución', '#C8A96E'],
        ].map(([l,v,s,col]) => (
          <div className="ct-stat" key={l}>
            <div className="ct-sl">{l}</div>
            <div className="ct-sv" style={{ fontSize: v.length > 10 ? 14 : 18 }}>{v}</div>
            <div className="ct-ss">{s}</div>
            <div className="ct-bar"><div className="ct-fill" style={{ width: '70%', background: col }}/></div>
          </div>
        ))}
      </div>

      {/* VISTA RESUMEN */}
      {vista === 'resumen' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {/* Por producto */}
          <div className="card">
            <h3 style={{ marginBottom: 14, fontSize: 14 }}>Por producto</h3>
            {prodList.length === 0 ? <div style={{ fontSize: 13, color: 'var(--arcilla)' }}>Sin datos</div>
            : prodList.map(([prod, data]) => (
              <div key={prod} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div className="ct-prod-dot" style={{ background: PROD_COLORS[prod] || '#888' }} />
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{prod}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>({data.count} cont.)</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{fmtNum(data.vol)} tn</span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>{fmtUSD(data.monto, 0)}</span>
                  </div>
                </div>
                <div style={{ height: 8, background: '#E8D5A3', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: 8, borderRadius: 4, background: PROD_COLORS[prod] || '#888', width: `${data.vol/maxVol*100}%`, transition: 'width .4s' }} />
                </div>
              </div>
            ))}
          </div>

          {/* Por nombre */}
          <div className="card">
            <h3 style={{ marginBottom: 14, fontSize: 14 }}>Fer vs Leo</h3>
            {Object.entries(byNombre).map(([nombre, data]) => (
              <div key={nombre} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid #EDE0C8' }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: nombre === 'Fer' ? '#EBF4E8' : nombre === 'Leo' ? '#F5EDD8' : '#E4F0F4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, color: nombre === 'Fer' ? '#2E4F26' : nombre === 'Leo' ? '#6B3E22' : '#2C5A6A', flexShrink: 0 }}>
                  {nombre.slice(0,3)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{nombre}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{fmtUSD(data.monto, 0)}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 16, fontWeight: 600 }}>{fmtNum(data.vol)} tn</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {totalVol > 0 ? Math.round(data.vol/totalVol*100) : 0}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* VISTA TABLA */}
      {vista === 'tabla' && (
        <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
          {loading ? (
            <div style={{ padding: 32, textAlign: 'center', fontSize: 13, color: 'var(--arcilla)' }}>Cargando...</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', fontSize: 13, color: 'var(--arcilla)' }}>Sin contratos con estos filtros</div>
          ) : (
            <table className="ct-tbl">
              <thead>
                <tr>
                  <th>Cierre</th><th>Campaña</th><th>Producto</th><th>Comprador</th>
                  <th>Volumen</th><th>Precio</th><th>Monto total</th>
                  <th>Entrega</th><th>A nombre</th><th>Obs.</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c.id}>
                    <td style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{fmtFecha(c.fecha_cierre)}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{c.campanha}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <div className="ct-prod-dot" style={{ background: PROD_COLORS[c.producto] || '#888' }} />
                        <span style={{ fontWeight: 500 }}>{c.producto}</span>
                      </div>
                    </td>
                    <td style={{ color: 'var(--suelo)' }}>{c.comprador}</td>
                    <td style={{ fontFamily: 'monospace', fontWeight: 500 }}>
                      {fmtNum(c.volumen)} {c.unidad}
                    </td>
                    <td style={{ fontFamily: 'monospace' }}>
                      {c.moneda === 'USD' ? 'U$S ' : '$ '}{fmtNum(c.precio, 2)}/{c.unidad}
                    </td>
                    <td style={{ fontFamily: 'monospace', fontWeight: 500, color: 'var(--musgo)' }}>
                      {c.moneda === 'USD' ? 'U$S ' : '$ '}{fmtNum(c.monto_total, 0)}
                    </td>
                    <td style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{fmtFecha(c.fecha_entrega)}</td>
                    <td>
                      <span className={`ct-chip ${CHIP[c.a_nombre]||'chip-muted'}`}>{c.a_nombre}</span>
                    </td>
                    <td style={{ fontSize: 11, color: 'var(--text-muted)', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      title={c.observaciones}>{c.observaciones || '—'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: '#F5F0E4', fontWeight: 600 }}>
                  <td colSpan={4} style={{ padding: '10px 10px', fontSize: 11, color: 'var(--text-muted)' }}>
                    {filtered.length} contratos
                  </td>
                  <td style={{ padding: '10px 10px', fontFamily: 'monospace' }}>{fmtNum(totalVol)} tn</td>
                  <td style={{ padding: '10px 10px', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                    {fmtUSD(precioMedio)}/tn
                  </td>
                  <td style={{ padding: '10px 10px', fontFamily: 'monospace', color: 'var(--musgo)' }}>{fmtUSD(totalMonto, 0)}</td>
                  <td colSpan={3}></td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
