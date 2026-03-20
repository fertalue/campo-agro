import { useState, useEffect, useRef } from 'react'
import { db, exportCSV } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

const CENTROS = ['Producción','Costos únicos','Comercializacion','Alquiler','Administrativo','Mantenimiento de infraestructura','Inversiones / infraestructura','Servicios']
const CONCEPTOS = ['Compra','Servicio','NC','ND','Otro']
const TIPOS_PAGO = ['Canje','Cta Cte','Contado','Redagro360','Redagro270','Cheque','Transferencia']
const IVA_OPTS = [{ label: '0%', val: 0 },{ label: '10.5%', val: 0.105 },{ label: '21%', val: 0.21 }]

const CHIP = { 'Fer':'chip-green','Leo':'chip-amber','ambos':'chip-sky','Gise':'chip-muted' }

function fmtUSD(n) {
  if (n == null) return '—'
  return 'U$S ' + parseFloat(n).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function Costos() {
  const { role } = useAuth()
  const [costos, setCostos]     = useState([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving]     = useState(false)
  const [dolar, setDolar]       = useState(null)
  const [fotoFile, setFotoFile] = useState(null)
  const [filtro, setFiltro]     = useState('Todas')
  const fileRef = useRef()

  const emptyForm = {
    fecha: new Date().toISOString().split('T')[0],
    quien_carga: 'Gise',
    concepto: 'Compra',
    campanha: '25-26',
    centro_costos: 'Producción',
    producto_servicio: '',
    proveedor: '',
    precio_unitario: '',
    unidad: 'USD/ha',
    cantidad: '',
    moneda: 'ARS',
    cotizacion_usd: '',
    iva_incluido: false,
    iva_pct: 0.21,
    factura_nombre: 'ambos',
    con_sin_factura: 'Con Factura',
    tipo_pago: 'Canje',
    comentarios: '',
  }
  const [form, setForm] = useState(emptyForm)

  useEffect(() => {
    fetchCostos()
    db.cotizacion.hoy().then(v => {
      if (v) {
        setDolar(v)
        setForm(f => ({ ...f, cotizacion_usd: v }))
      }
    })
  }, [])

  async function fetchCostos() {
    setLoading(true)
    const { data } = await db.costos.list()
    setCostos(data || [])
    setLoading(false)
  }

  const calcUSD = () => {
    const monto = parseFloat(form.precio_unitario) * (parseFloat(form.cantidad) || 1)
    if (!monto) return 0
    if (form.moneda === 'USD oficial' || form.moneda === 'USD billete') return monto
    const tc = parseFloat(form.cotizacion_usd) || 1
    return monto / tc
  }

  const calcIVA = () => {
    const base = calcUSD()
    return form.iva_incluido ? base / (1 + form.iva_pct) : base
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    const usd = calcUSD()
    const payload = {
      ...form,
      precio_unitario: parseFloat(form.precio_unitario) || null,
      cantidad: parseFloat(form.cantidad) || null,
      cotizacion_usd: parseFloat(form.cotizacion_usd) || null,
      monto_usd: usd,
      precio_total_con_iva: form.iva_incluido ? usd : usd * (1 + form.iva_pct),
      precio_total_sin_iva: calcIVA(),
      monto_iva: form.iva_incluido ? usd - calcIVA() : usd * form.iva_pct,
    }
    const { data, error } = await db.costos.insert(payload)
    if (!error && fotoFile && data?.[0]?.id) {
      const url = await db.uploadFoto(fotoFile, data[0].id)
      await db.costos.update(data[0].id, { foto_url: url })
    }
    setShowForm(false)
    setForm({ ...emptyForm, cotizacion_usd: dolar || '' })
    setFotoFile(null)
    await fetchCostos()
    setSaving(false)
  }

  const centros = ['Todas', ...CENTROS]
  const filtered = filtro === 'Todas' ? costos : costos.filter(c => c.centro_costos === filtro)
  const totalUSD = filtered.reduce((a, b) => a + (b.monto_usd || 0), 0)

  const f = (k, v) => setForm(prev => ({ ...prev, [k]: v }))

  return (
    <div>
      {/* Header */}
      <div className="flex-between mb-2">
        <div>
          <h2>Costos</h2>
          <p style={{ fontSize: 12, color: 'var(--arcilla)', marginTop: 2 }}>
            Total: <strong style={{ color: 'var(--tierra)' }}>{fmtUSD(totalUSD)}</strong> · {filtered.length} registros
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {dolar && (
            <div style={{
              background: 'var(--verde-light)', border: '1px solid var(--brote)',
              borderRadius: 20, padding: '4px 10px', fontSize: 11, color: 'var(--musgo)', fontWeight: 500
            }}>
              USD oficial · ${dolar?.toLocaleString('es-AR')}
            </div>
          )}
          <button className="btn btn-secondary btn-sm" onClick={() => exportCSV(filtered, 'costos')}>
            Exportar CSV
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancelar' : '+ Nueva factura'}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid-4 mb-3">
        {[
          ['Total campaña', fmtUSD(costos.reduce((a,b)=>a+(b.monto_usd||0),0)), `${costos.length} facturas`, 'var(--arcilla)'],
          ['Facturado Fer', fmtUSD(costos.filter(c=>c.factura_nombre==='Fer'||c.factura_nombre==='ambos').reduce((a,b)=>a+(b.monto_usd||0)/((b.factura_nombre==='ambos')?2:1),0)), 'a nombre de Fer', 'var(--hoja)'],
          ['Facturado Leo', fmtUSD(costos.filter(c=>c.factura_nombre==='Leo'||c.factura_nombre==='ambos').reduce((a,b)=>a+(b.monto_usd||0)/((b.factura_nombre==='ambos')?2:1),0)), 'a nombre de Leo', 'var(--paja)'],
          ['Sin pagar', fmtUSD(costos.filter(c=>!c.check_pago).reduce((a,b)=>a+(b.monto_usd||0),0)), `${costos.filter(c=>!c.check_pago).length} pendientes`, 'var(--cielo)'],
        ].map(([l,v,s,color]) => (
          <div className="stat-card" key={l}>
            <div className="stat-label">{l}</div>
            <div className="stat-value" style={{ fontSize: 16 }}>{v}</div>
            <div className="stat-sub">{s}</div>
            <div className="stat-bar"><div className="stat-fill" style={{ width: '70%', background: color }} /></div>
          </div>
        ))}
      </div>

      {/* Form */}
      {showForm && (
        <div className="card mb-3" style={{ background: '#F9F6EE', borderColor: 'var(--paja)' }}>
          <h3 style={{ marginBottom: 16 }}>Nueva factura</h3>
          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Foto */}
            <div>
              <div className="label" style={{ marginBottom: 6 }}>Foto de factura (opcional)</div>
              <div
                onClick={() => fileRef.current.click()}
                style={{
                  border: `1.5px dashed ${fotoFile ? 'var(--pasto)' : 'var(--border)'}`,
                  borderRadius: 8, padding: '14px 16px', textAlign: 'center',
                  cursor: 'pointer', background: fotoFile ? 'var(--verde-light)' : 'transparent',
                  fontSize: 12, color: fotoFile ? 'var(--musgo)' : 'var(--text-muted)'
                }}>
                {fotoFile ? `✓ ${fotoFile.name}` : 'Tocá para subir foto de la factura'}
              </div>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
                onChange={e => setFotoFile(e.target.files[0])} />
            </div>

            <div className="grid-2">
              <div className="field">
                <label className="label">Fecha</label>
                <input className="input" type="date" value={form.fecha} onChange={e => f('fecha',e.target.value)} required />
              </div>
              <div className="field">
                <label className="label">Quién carga</label>
                <select className="select" value={form.quien_carga} onChange={e => f('quien_carga',e.target.value)}>
                  {['Fer','Leo','Gise'].map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
            </div>
            <div className="grid-2">
              <div className="field">
                <label className="label">Concepto</label>
                <select className="select" value={form.concepto} onChange={e => f('concepto',e.target.value)}>
                  {CONCEPTOS.map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
              <div className="field">
                <label className="label">Campaña</label>
                <select className="select" value={form.campanha} onChange={e => f('campanha',e.target.value)}>
                  {['25-26','24-25','23-24'].map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
            </div>
            <div className="grid-2">
              <div className="field">
                <label className="label">Proveedor</label>
                <input className="input" value={form.proveedor} onChange={e => f('proveedor',e.target.value)} placeholder="Nombre del proveedor" required />
              </div>
              <div className="field">
                <label className="label">Centro de costo</label>
                <select className="select" value={form.centro_costos} onChange={e => f('centro_costos',e.target.value)}>
                  {CENTROS.map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
            </div>
            <div className="field">
              <label className="label">Producto / Servicio</label>
              <input className="input" value={form.producto_servicio} onChange={e => f('producto_servicio',e.target.value)} placeholder="Gas oil, semillas, fumigación..." />
            </div>
            <div className="grid-2">
              <div className="field">
                <label className="label">Precio unitario</label>
                <input className="input" type="number" step="0.01" value={form.precio_unitario}
                  onChange={e => f('precio_unitario',e.target.value)} placeholder="0.00" />
              </div>
              <div className="field">
                <label className="label">Unidad</label>
                <input className="input" value={form.unidad} onChange={e => f('unidad',e.target.value)} placeholder="USD/ha, USD/l, USD/Kg" />
              </div>
            </div>
            <div className="grid-2">
              <div className="field">
                <label className="label">Cantidad</label>
                <input className="input" type="number" step="0.01" value={form.cantidad}
                  onChange={e => f('cantidad',e.target.value)} placeholder="0" />
              </div>
              <div className="field">
                <label className="label">Moneda</label>
                <select className="select" value={form.moneda} onChange={e => f('moneda',e.target.value)}>
                  {['ARS','USD oficial','USD billete'].map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
            </div>
            {form.moneda === 'ARS' && (
              <div className="field">
                <label className="label">Cotización USD (automática · editable)</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input className="input" type="number" value={form.cotizacion_usd}
                    onChange={e => f('cotizacion_usd',e.target.value)} placeholder="1.478" style={{ flex: 1 }} />
                  {dolar && <span style={{ fontSize: 11, color: 'var(--pasto)', whiteSpace: 'nowrap' }}>oficial: ${dolar?.toLocaleString('es-AR')}</span>}
                </div>
              </div>
            )}

            {/* USD preview */}
            {(form.precio_unitario && form.cantidad) && (
              <div style={{
                background: 'var(--verde-light)', border: '1px solid var(--brote)',
                borderRadius: 8, padding: '10px 14px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
              }}>
                <span style={{ fontSize: 12, color: 'var(--musgo)', fontWeight: 500 }}>Equivalente USD</span>
                <span style={{ fontSize: 18, fontWeight: 600, color: 'var(--musgo)' }}>{fmtUSD(calcUSD())}</span>
              </div>
            )}

            <div className="grid-2">
              <div className="field">
                <label className="label">IVA</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {IVA_OPTS.map(opt => (
                    <button key={opt.val} type="button"
                      onClick={() => f('iva_pct', opt.val)}
                      style={{
                        flex: 1, padding: '7px 4px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
                        border: '1px solid', fontFamily: 'inherit',
                        background: form.iva_pct === opt.val ? 'var(--pasto)' : 'transparent',
                        color: form.iva_pct === opt.val ? '#F5F0E4' : 'var(--arcilla)',
                        borderColor: form.iva_pct === opt.val ? 'var(--pasto)' : 'var(--border)',
                      }}>{opt.label}</button>
                  ))}
                </div>
              </div>
              <div className="field">
                <label className="label">IVA incluido en precio</label>
                <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
                  {['No', 'Sí'].map(o => (
                    <button key={o} type="button"
                      onClick={() => f('iva_incluido', o === 'Sí')}
                      style={{
                        flex: 1, padding: '7px 4px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
                        border: '1px solid', fontFamily: 'inherit',
                        background: (form.iva_incluido ? 'Sí' : 'No') === o ? 'var(--pasto)' : 'transparent',
                        color: (form.iva_incluido ? 'Sí' : 'No') === o ? '#F5F0E4' : 'var(--arcilla)',
                        borderColor: (form.iva_incluido ? 'Sí' : 'No') === o ? 'var(--pasto)' : 'var(--border)',
                      }}>{o}</button>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid-2">
              <div className="field">
                <label className="label">Factura a nombre de</label>
                <select className="select" value={form.factura_nombre} onChange={e => f('factura_nombre',e.target.value)}>
                  {['Fer','Leo','ambos','Sin factura'].map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
              <div className="field">
                <label className="label">Tipo de pago</label>
                <select className="select" value={form.tipo_pago} onChange={e => f('tipo_pago',e.target.value)}>
                  {TIPOS_PAGO.map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
            </div>

            <div className="field">
              <label className="label">Comentarios</label>
              <textarea className="textarea" value={form.comentarios} onChange={e => f('comentarios',e.target.value)}
                placeholder="Número de cheque, liquidaciones relacionadas, etc." style={{ minHeight: 60 }} />
            </div>

            <button className="btn btn-primary" type="submit" disabled={saving} style={{ alignSelf: 'flex-start' }}>
              {saving ? 'Guardando...' : 'Guardar factura'}
            </button>
          </form>
        </div>
      )}

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
        {centros.map(c => (
          <button key={c} onClick={() => setFiltro(c)} style={{
            padding: '5px 12px', borderRadius: 20, fontSize: 11, cursor: 'pointer',
            border: '1px solid', fontFamily: 'inherit',
            background: filtro === c ? 'var(--pasto)' : 'transparent',
            color: filtro === c ? '#F5F0E4' : 'var(--arcilla)',
            borderColor: filtro === c ? 'var(--pasto)' : 'var(--border)',
          }}>{c}</button>
        ))}
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        {loading ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--arcilla)', fontSize: 13 }}>Cargando...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--arcilla)', fontSize: 13 }}>Sin registros</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                {['Fecha','Proveedor','Descripción','Centro','Moneda','USD','IVA','Factura','Pago','Quién'].map(h => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id}>
                  <td style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {new Date(c.fecha + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}
                  </td>
                  <td style={{ fontWeight: 500 }}>{c.proveedor}</td>
                  <td style={{ color: 'var(--arcilla)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.producto_servicio}
                  </td>
                  <td><span className="chip chip-muted">{c.centro_costos}</span></td>
                  <td style={{ color: 'var(--text-muted)' }}>{c.moneda}</td>
                  <td style={{ fontWeight: 500 }}>{fmtUSD(c.monto_usd)}</td>
                  <td style={{ color: 'var(--text-muted)' }}>{c.iva_pct ? `${(c.iva_pct*100).toFixed(1)}%` : '0%'}</td>
                  <td><span className={`chip ${CHIP[c.factura_nombre] || 'chip-muted'}`}>{c.factura_nombre}</span></td>
                  <td style={{ color: 'var(--cielo)' }}>{c.tipo_pago}</td>
                  <td><span className={`chip ${CHIP[c.quien_carga] || 'chip-muted'}`}>{c.quien_carga}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
