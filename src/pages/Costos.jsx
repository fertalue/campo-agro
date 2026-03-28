import { useState, useEffect, useRef } from 'react'
import { db, exportCSV, getMaestros } from '../lib/supabase'
import SearchableSelect from '../components/SearchableSelect'

const CENTROS = ['Producción','Costos únicos','Comercializacion','Alquiler','Administrativo','Mantenimiento de infraestructura','Inversiones / infraestructura','Servicios']
const TIPOS_PAGO = ['Canje','Cta Cte','Contado','Redagro360','Redagro270','Cheque','Transferencia']
const IVA_OPTS = [{ label: '0%', val: 0 },{ label: '10.5%', val: 0.105 },{ label: '21%', val: 0.21 }]
const CAMPANHAS = ['25-26','24-25','23-24','22-23']
const MESES_CANJE = ['Ene 26','Feb 26','Mar 26','Abr 26','May 26','Jun 26','Jul 26','Ago 26','Sep 26','Oct 26','Nov 26','Dic 26','Ene 27','Feb 27','Mar 27','Abr 27']
const CHIP = { 'Fer':'chip-green','Leo':'chip-amber','ambos':'chip-sky','Gise':'chip-muted','Sin factura':'chip-muted' }
const BAR_COLORS = ['#4A7C3F','#7A9EAD','#C8A96E','#A0714F','#8B6B4A','#B8D0D8','#9DC87A','#6B4E33']

const CSS = `
.c-tabs{display:flex;gap:4px;margin-bottom:16px;border-bottom:1px solid #D8C9A8;}
.c-tab{padding:8px 16px;font-size:12px;cursor:pointer;border-radius:8px 8px 0 0;color:#A08060;border:1px solid transparent;border-bottom:none;transition:all .15s;margin-bottom:-1px;background:transparent;font-family:inherit;}
.c-tab.on{background:#FDFAF4;border-color:#D8C9A8;color:#3B2E1E;font-weight:500;}
.c-filters{display:flex;flex-wrap:wrap;gap:8px;padding:12px 14px;background:#FDFAF4;border:1px solid #D8C9A8;border-radius:10px;margin-bottom:16px;align-items:flex-end;}
.c-fg{display:flex;flex-direction:column;gap:3px;position:relative;}
.c-fl{font-size:10px;font-weight:500;color:#A08060;letter-spacing:.05em;text-transform:uppercase;margin-bottom:1px;}
.c-sel{padding:6px 8px;border:1px solid #D8C9A8;border-radius:6px;font-size:12px;background:#F5F0E4;color:#3B2E1E;font-family:inherit;}
.ms-trigger{display:flex;align-items:center;justify-content:space-between;gap:6px;padding:6px 10px;border:1px solid #D8C9A8;border-radius:6px;font-size:12px;background:#F5F0E4;color:#3B2E1E;cursor:pointer;min-width:140px;white-space:nowrap;user-select:none;font-family:inherit;}
.ms-trigger.active{border-color:#4A7C3F;background:#EBF4E8;color:#2E4F26;font-weight:500;}
.ms-count{background:#4A7C3F;color:#F5F0E4;border-radius:10px;padding:1px 6px;font-size:10px;font-weight:600;margin-left:2px;}
.ms-dropdown{position:absolute;top:calc(100% + 3px);left:0;z-index:200;background:#FDFAF4;border:1px solid #D8C9A8;border-radius:8px;padding:4px;min-width:190px;box-shadow:0 4px 16px rgba(59,46,30,0.13);}
.ms-item{display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:5px;cursor:pointer;font-size:12px;color:#3B2E1E;transition:background .1s;}
.ms-item:hover{background:#EDE0C8;}
.ms-item.sel{background:#EBF4E8;color:#2E4F26;}
.ms-check{width:14px;height:14px;border:1px solid #C8B89A;border-radius:3px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:9px;transition:all .1s;}
.ms-item.sel .ms-check{background:#4A7C3F;border-color:#4A7C3F;color:#fff;}
.ms-sep{height:1px;background:#EDE0C8;margin:3px 0;}
.ms-clear{padding:6px 10px;font-size:11px;color:#A0714F;cursor:pointer;text-align:center;border-radius:5px;}
.ms-clear:hover{background:#F5EDD8;color:#6B3E22;}
.iva-tog{display:flex;gap:4px;}
.iva-b{padding:5px 10px;border-radius:6px;font-size:11px;cursor:pointer;border:1px solid #D8C9A8;background:transparent;color:#A0714F;font-family:inherit;transition:all .15s;}
.iva-b.on{background:#4A7C3F;color:#F5F0E4;border-color:#4A7C3F;}
.c-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:16px;}
.c-stat{background:#FDFAF4;border:1px solid #D8C9A8;border-radius:10px;padding:12px 14px;}
.c-sl{font-size:10px;color:#A08060;font-weight:500;letter-spacing:.06em;text-transform:uppercase;margin-bottom:5px;}
.c-sv{font-size:18px;font-weight:600;color:#3B2E1E;line-height:1;}
.c-ss{font-size:11px;color:#A08060;margin-top:4px;}
.c-sbar{height:3px;background:#E8D5A3;border-radius:2px;margin-top:8px;}
.c-sfill{height:3px;border-radius:2px;}
.c-grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px;}
.c-panel{background:#FDFAF4;border:1px solid #D8C9A8;border-radius:10px;padding:14px 16px;margin-bottom:14px;}
.c-pt{font-size:13px;font-weight:500;color:#3B2E1E;margin-bottom:12px;}
.c-br{display:flex;align-items:center;gap:8px;margin-bottom:7px;}
.c-bl{font-size:11px;color:#6B4E33;width:140px;flex-shrink:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.c-bw{flex:1;height:8px;background:#E8D5A3;border-radius:4px;overflow:hidden;}
.c-bf{height:8px;border-radius:4px;transition:width .4s;}
.c-bv{font-size:11px;color:#3B2E1E;font-weight:500;width:72px;text-align:right;flex-shrink:0;}
.c-tbl{width:100%;border-collapse:collapse;font-size:12px;}
.c-tbl th{text-align:left;padding:7px 10px;font-size:10px;font-weight:600;color:#A08060;letter-spacing:.05em;text-transform:uppercase;border-bottom:1px solid #D8C9A8;}
.c-tbl td{padding:9px 10px;border-bottom:1px solid #EDE0C8;color:#3B2E1E;vertical-align:middle;}
.c-tbl tr:last-child td{border-bottom:none;}
.c-tbl tr:hover td{background:#FDFAF0;}
.cc{display:inline-flex;align-items:center;padding:2px 7px;border-radius:20px;font-size:10px;font-weight:500;}
.chip-green{background:#EBF4E8;color:#2E4F26;}
.chip-amber{background:#F5EDD8;color:#6B3E22;}
.chip-sky{background:#E4F0F4;color:#2C5A6A;}
.chip-muted{background:#EFECE4;color:#7A6040;}
.canje-b{background:#F5EDD8;border:1px solid #C8A96E;border-radius:6px;padding:2px 8px;font-size:10px;color:#6B3E22;font-weight:500;}
.pr-row{display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #EDE0C8;}
.pr-row:last-child{border-bottom:none;}
.pr-date{font-size:11px;color:#A08060;width:56px;flex-shrink:0;}
.pr-bw{flex:1;height:22px;background:#E8D5A3;border-radius:4px;overflow:hidden;}
.pr-bf{height:22px;border-radius:4px;display:flex;align-items:center;padding-left:8px;font-size:11px;font-weight:500;color:#F5F0E4;transition:width .4s;}
.pr-diff{font-size:10px;width:40px;text-align:right;flex-shrink:0;}
`

// ── Multi-select dropdown component ─────────────────────────────────────────
function MultiSelect({ label, options, selected, onChange, placeholder = 'Todos' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef()

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const toggle = (opt) => {
    if (selected.includes(opt)) onChange(selected.filter(s => s !== opt))
    else onChange([...selected, opt])
  }

  const triggerLabel = selected.length === 0
    ? placeholder
    : selected.length === 1
    ? selected[0]
    : `${selected.length} seleccionados`

  return (
    <div className="c-fg" ref={ref}>
      <div className="c-fl">{label}</div>
      <div className={`ms-trigger${selected.length > 0 ? ' active' : ''}`} onClick={() => setOpen(o => !o)}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 130 }}>{triggerLabel}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          {selected.length > 1 && <span className="ms-count">{selected.length}</span>}
          <span style={{ fontSize: 9, color: '#A08060' }}>▾</span>
        </span>
      </div>
      {open && (
        <div className="ms-dropdown">
          {options.map(opt => (
            <div key={opt} className={`ms-item${selected.includes(opt) ? ' sel' : ''}`} onClick={() => toggle(opt)}>
              <div className="ms-check">{selected.includes(opt) ? '✓' : ''}</div>
              {opt}
            </div>
          ))}
          {selected.length > 0 && (
            <>
              <div className="ms-sep" />
              <div className="ms-clear" onClick={() => { onChange([]); setOpen(false) }}>Limpiar filtro</div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function fmtUSD(n, dec = 2) {
  if (n == null || isNaN(n)) return '—'
  return 'U$S ' + parseFloat(n).toLocaleString('es-AR', { minimumFractionDigits: dec, maximumFractionDigits: dec })
}
function fmtk(n) { return fmtUSD(n, 2) }
function monthKey(f) { if (!f) return ''; const d = new Date(f + 'T12:00:00'); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }
function monthLabel(ym) { const [y, m] = ym.split('-'); const n = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']; return `${n[parseInt(m) - 1]} ${y.slice(2)}` }

// ── Fila de edición rápida ───────────────────────────────────────────────────
function EditRow({ costo, onSave, onCancel }) {
  const [form, setForm] = useState({
    proveedor:        costo.proveedor || '',
    producto_servicio: costo.producto_servicio || '',
    centro_costos:    costo.centro_costos || '',
    tipo_pago:        costo.tipo_pago || '',
    mes_canje:        costo.mes_canje || '',
    dia_pago:         costo.dia_pago || '',
    check_pago:       costo.check_pago || false,
    factura_nombre:   costo.factura_nombre || '',
    comentarios:      costo.comentarios || '',
  })
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    await onSave(form)
    setSaving(false)
  }

  const cell = { padding: '6px 4px', verticalAlign: 'middle' }
  const inp = (k, style={}) => (
    <input value={form[k]} onChange={e => f(k, e.target.value)}
      style={{ width: '100%', padding: '4px 6px', border: '1px solid #D8C9A8', borderRadius: 5, fontSize: 12, fontFamily: 'inherit', ...style }} />
  )

  return (
    <tr style={{ background: '#F9F6EE' }}>
      <td style={cell} colSpan={2}>
        <input value={form.proveedor} onChange={e => f('proveedor', e.target.value)}
          style={{ width: '100%', padding: '4px 6px', border: '1px solid #D8C9A8', borderRadius: 5, fontSize: 12, fontFamily: 'inherit' }} />
      </td>
      <td style={cell}>
        <input value={form.producto_servicio} onChange={e => f('producto_servicio', e.target.value)}
          style={{ width: '100%', padding: '4px 6px', border: '1px solid #D8C9A8', borderRadius: 5, fontSize: 12, fontFamily: 'inherit' }} />
      </td>
      <td style={cell}>
        <select value={form.centro_costos} onChange={e => f('centro_costos', e.target.value)}
          style={{ width: '100%', padding: '4px 6px', border: '1px solid #D8C9A8', borderRadius: 5, fontSize: 11, fontFamily: 'inherit' }}>
          {CENTROS.map(o => <option key={o}>{o}</option>)}
        </select>
      </td>
      <td style={cell} colSpan={3} style={{ color: 'var(--text-muted)', fontSize: 11, textAlign: 'center' }}>
        {fmtUSD(costo.precio_total_sin_iva || costo.monto_usd)}
      </td>
      <td style={cell}>
        <select value={form.factura_nombre} onChange={e => f('factura_nombre', e.target.value)}
          style={{ width: '100%', padding: '4px 6px', border: '1px solid #D8C9A8', borderRadius: 5, fontSize: 11, fontFamily: 'inherit' }}>
          {['Fer','Leo','ambos','Sin factura'].map(o => <option key={o}>{o}</option>)}
        </select>
      </td>
      <td style={cell}>
        <select value={form.tipo_pago} onChange={e => f('tipo_pago', e.target.value)}
          style={{ width: '100%', padding: '4px 6px', border: '1px solid #D8C9A8', borderRadius: 5, fontSize: 11, fontFamily: 'inherit' }}>
          {TIPOS_PAGO.map(o => <option key={o}>{o}</option>)}
        </select>
        {form.tipo_pago === 'Canje' && (
          <input value={form.mes_canje} onChange={e => f('mes_canje', e.target.value)}
            placeholder="mes canje" style={{ marginTop: 3, width: '100%', padding: '3px 6px', border: '1px solid #D8C9A8', borderRadius: 5, fontSize: 11, fontFamily: 'inherit' }} />
        )}
      </td>
      <td style={cell}>
        {form.tipo_pago === 'Cta Cte' && (
          <input type="date" value={form.dia_pago} onChange={e => f('dia_pago', e.target.value)}
            style={{ width: '100%', padding: '4px 6px', border: '1px solid #D8C9A8', borderRadius: 5, fontSize: 11, fontFamily: 'inherit' }} />
        )}
      </td>
      <td style={cell}>
        <div onClick={() => f('check_pago', !form.check_pago)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 18, height: 18, borderRadius: 4, border: '1.5px solid', borderColor: form.check_pago ? 'var(--pasto)' : '#C8B89A', background: form.check_pago ? 'var(--pasto)' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {form.check_pago && <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><polyline points="2,6 5,9 10,3" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
          </div>
        </div>
      </td>
      <td style={cell}>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={save} disabled={saving} style={{ background: 'var(--pasto)', color: 'white', border: 'none', borderRadius: 5, padding: '4px 8px', fontSize: 11, cursor: 'pointer' }}>
            {saving ? '...' : 'OK'}
          </button>
          <button onClick={onCancel} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 5, padding: '4px 8px', fontSize: 11, cursor: 'pointer' }}>
            ✕
          </button>
        </div>
      </td>
    </tr>
  )
}

// ── Formulario ───────────────────────────────────────────────────────────────
function FormCosto({ onSave, onCancel, dolar }) {
  const fileRef = useRef()
  const [foto, setFoto] = useState(null)
  const [saving, setSaving] = useState(false)
  const [opts, setOpts] = useState({
    proveedor: [], producto: [], quien_carga: ['Fer','Leo','Gise'],
    centro_costos: [], concepto: [], unidad: [], moneda: [],
    factura_nombre: [], tipo_pago: [], mes_canje: []
  })

  useEffect(() => {
    const tipos = ['proveedor','producto','centro_costos','concepto','unidad','moneda','factura_nombre','tipo_pago','mes_canje']
    Promise.all(tipos.map(t => getMaestros(t))).then(results => {
      const newOpts = {}
      tipos.forEach((t, i) => { newOpts[t] = results[i] })
      newOpts.quien_carga = ['Fer','Leo','Gise']
      setOpts(prev => ({ ...prev, ...newOpts }))
    })
  }, [])

  const [form, setForm] = useState({
    fecha: new Date().toISOString().split('T')[0],
    quien_carga: 'Gise', concepto: 'Compra', campanha: '25-26',
    centro_costos: 'Producción', producto_servicio: '', proveedor: '',
    precio_unitario: '', unidad: 'USD/ha', cantidad: '',
    moneda: 'ARS', cotizacion_usd: dolar || '',
    iva_incluido: false, iva_pct: 0.21,
    factura_nombre: 'ambos', con_sin_factura: 'Con Factura',
    tipo_pago: 'Canje', mes_canje: '', dia_pago: '', check_pago: false, comentarios: '',
  })
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))
  const monto = parseFloat(form.precio_unitario) * (parseFloat(form.cantidad) || 1) || 0
  const usdBase = form.moneda === 'ARS' ? monto / (parseFloat(form.cotizacion_usd) || 1) : monto
  const usdSin = form.iva_incluido ? usdBase / (1 + form.iva_pct) : usdBase
  const usdCon = form.iva_incluido ? usdBase : usdBase * (1 + form.iva_pct)

  async function submit(e) {
    e.preventDefault(); setSaving(true)
    const payload = {
      ...form,
      precio_unitario: parseFloat(form.precio_unitario) || null,
      cantidad: parseFloat(form.cantidad) || null,
      cotizacion_usd: parseFloat(form.cotizacion_usd) || null,
      monto_usd: usdSin, precio_total_sin_iva: usdSin,
      precio_total_con_iva: usdCon, monto_iva: usdCon - usdSin,
    }
    const { data, error } = await db.costos.insert(payload)
    console.log('INSERT ERROR:', JSON.stringify(error))
    console.log('PAYLOAD:', JSON.stringify(payload))
    if (!error && foto && data?.[0]?.id) {
      const url = await db.uploadFoto(foto, data[0].id)
      await db.costos.update(data[0].id, { foto_url: url })
    }
    setSaving(false); onSave()
  }

  const inp = (k, type, ph) => <input className="input" type={type} value={form[k]} placeholder={ph} onChange={e => f(k, e.target.value)} style={{ width: '100%' }} />
  const sel = (k, fallbackOpts) => (
    <SearchableSelect value={form[k]} onChange={v => f(k, v)}
      options={opts[k]?.length ? opts[k] : fallbackOpts}
      placeholder="Seleccioná..." />
  )

  return (
    <div className="card mb-3" style={{ background: '#F9F6EE', borderColor: 'var(--paja)' }}>
      <h3 style={{ marginBottom: 16 }}>Nueva factura</h3>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div onClick={() => fileRef.current.click()} style={{ border: `1.5px dashed ${foto ? 'var(--pasto)' : 'var(--border)'}`, borderRadius: 8, padding: '12px 16px', textAlign: 'center', cursor: 'pointer', background: foto ? 'var(--verde-light)' : 'transparent', fontSize: 12, color: foto ? 'var(--musgo)' : 'var(--text-muted)' }}>
          {foto ? `✓ ${foto.name}` : 'Foto de factura (opcional)'}
        </div>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => setFoto(e.target.files[0])} />
        <div className="grid-2">
          <div className="field"><label className="label">Fecha</label>{inp('fecha', 'date')}</div>
          <div className="field"><label className="label">Quién carga</label>{sel('quien_carga', ['Fer','Leo','Gise'])}</div>
        </div>
        <div className="grid-2">
          <div className="field"><label className="label">Campaña</label>
            <SearchableSelect value={form.campanha} onChange={v => f('campanha', v)} options={CAMPANHAS} />
          </div>
          <div className="field"><label className="label">Centro de costo</label>{sel('centro_costos', CENTROS)}</div>
        </div>
        <div className="grid-2">
          <div className="field"><label className="label">Proveedor</label>{sel('proveedor', [])}</div>
          <div className="field"><label className="label">Concepto</label>{sel('concepto', ['Compra','Servicio','NC','ND','Otro'])}</div>
        </div>
        <div className="field"><label className="label">Producto / Servicio</label>
          <SearchableSelect value={form.producto_servicio} onChange={v => f('producto_servicio', v)}
            options={opts.producto?.length ? opts.producto : []}
            placeholder="Seleccioná o escribí..." />
        </div>
        <div className="grid-2">
          <div className="field"><label className="label">Precio unitario</label>{inp('precio_unitario', 'number', '0.00')}</div>
          <div className="field"><label className="label">Unidad</label>{sel('unidad', ['USD/ha','USD/l','USD/Kg','USD/tn'])}</div>
        </div>
        <div className="grid-2">
          <div className="field"><label className="label">Cantidad</label>{inp('cantidad', 'number', '0')}</div>
          <div className="field"><label className="label">Moneda</label>{sel('moneda', ['ARS','USD oficial','USD billete'])}</div>
        </div>
        {form.moneda === 'ARS' && (
          <div className="field">
            <label className="label">Cotización USD {dolar ? `(oficial hoy: $${dolar?.toLocaleString('es-AR')})` : ''}</label>
            {inp('cotizacion_usd', 'number', '1478')}
          </div>
        )}
        {(form.precio_unitario && form.cantidad) && (
          <div style={{ background: 'var(--verde-light)', border: '1px solid var(--brote)', borderRadius: 8, padding: '10px 14px', display: 'flex', justifyContent: 'space-between' }}>
            <div><div style={{ fontSize: 11, color: 'var(--musgo)', marginBottom: 2 }}>Sin IVA</div><div style={{ fontSize: 16, fontWeight: 600, color: 'var(--musgo)' }}>{fmtUSD(usdSin)}</div></div>
            <div style={{ textAlign: 'right' }}><div style={{ fontSize: 11, color: 'var(--musgo)', marginBottom: 2 }}>Con IVA ({(form.iva_pct * 100).toFixed(1)}%)</div><div style={{ fontSize: 16, fontWeight: 600, color: 'var(--arcilla)' }}>{fmtUSD(usdCon)}</div></div>
          </div>
        )}
        <div className="grid-2">
          <div className="field">
            <label className="label">IVA</label>
            <div style={{ display: 'flex', gap: 6 }}>
              {IVA_OPTS.map(o => <button key={o.val} type="button" onClick={() => f('iva_pct', o.val)} style={{ flex: 1, padding: '7px 4px', borderRadius: 6, fontSize: 12, cursor: 'pointer', border: '1px solid', fontFamily: 'inherit', background: form.iva_pct === o.val ? 'var(--pasto)' : 'transparent', color: form.iva_pct === o.val ? '#F5F0E4' : 'var(--arcilla)', borderColor: form.iva_pct === o.val ? 'var(--pasto)' : 'var(--border)' }}>{o.label}</button>)}
            </div>
          </div>
          <div className="field">
            <label className="label">IVA incluido</label>
            <div style={{ display: 'flex', gap: 6 }}>
              {['No', 'Sí'].map(o => <button key={o} type="button" onClick={() => f('iva_incluido', o === 'Sí')} style={{ flex: 1, padding: '7px 4px', borderRadius: 6, fontSize: 12, cursor: 'pointer', border: '1px solid', fontFamily: 'inherit', background: (form.iva_incluido ? 'Sí' : 'No') === o ? 'var(--pasto)' : 'transparent', color: (form.iva_incluido ? 'Sí' : 'No') === o ? '#F5F0E4' : 'var(--arcilla)', borderColor: (form.iva_incluido ? 'Sí' : 'No') === o ? 'var(--pasto)' : 'var(--border)' }}>{o}</button>)}
            </div>
          </div>
        </div>
        <div className="grid-2">
          <div className="field"><label className="label">Factura a nombre de</label>{sel('factura_nombre', ['Fer','Leo','ambos','Sin factura'])}</div>
          <div className="field"><label className="label">Tipo de pago</label>{sel('tipo_pago', TIPOS_PAGO)}</div>
        </div>
        {form.tipo_pago === 'Canje' && (
          <div className="field">
            <label className="label">Mes del canje</label>
            <SearchableSelect value={form.mes_canje} onChange={v => f('mes_canje', v)}
              options={opts.mes_canje?.length ? opts.mes_canje : MESES_CANJE}
              placeholder="Seleccioná el mes" allowClear />
          </div>
        )}
        {form.tipo_pago === 'Cta Cte' && (
          <div className="field">
            <label className="label">Fecha a pagar</label>
            <input className="input" type="date" value={form.dia_pago}
              onChange={e => f('dia_pago', e.target.value)} style={{ width: '100%' }} />
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: form.check_pago ? 'var(--verde-light)' : '#F5F0E4', border: '1px solid', borderColor: form.check_pago ? 'var(--brote)' : 'var(--border)', borderRadius: 8, cursor: 'pointer' }}
          onClick={() => f('check_pago', !form.check_pago)}>
          <div style={{ width: 20, height: 20, borderRadius: 5, border: '1.5px solid', borderColor: form.check_pago ? 'var(--pasto)' : '#C8B89A', background: form.check_pago ? 'var(--pasto)' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s' }}>
            {form.check_pago && <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><polyline points="2,6 5,9 10,3" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: form.check_pago ? 'var(--musgo)' : 'var(--tierra)' }}>
              {form.check_pago ? 'Pagado ✓' : 'Marcar como pagado'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {form.check_pago ? 'Esta factura está pagada' : 'Tocá para registrar el pago'}
            </div>
          </div>
        </div>
        <div className="field">
          <label className="label">Comentarios</label>
          <textarea className="textarea" value={form.comentarios} onChange={e => f('comentarios', e.target.value)} placeholder="Cheque, liquidaciones, etc." style={{ minHeight: 60 }} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Guardando...' : 'Guardar factura'}</button>
          <button className="btn btn-secondary" type="button" onClick={onCancel}>Cancelar</button>
        </div>
      </form>
    </div>
  )
}

// ── Componente principal ─────────────────────────────────────────────────────
export default function Costos() {
  const [costos, setCostos] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [dolar, setDolar] = useState(null)
  const [tab, setTab] = useState('resumen')
  const [ivaMode, setIvaMode] = useState('sin')
  const [ivaMode2, setIvaMode2] = useState('sin')
  const [producto, setProducto] = useState('')

  // Multi-select filters — arrays vacíos = "todos"
  const [fCampanha, setFCampanha] = useState([])
  const [fMes, setFMes] = useState([])
  const [fNombre, setFNombre] = useState([])
  const [fCentro, setFCentro] = useState([])
  const [fProv, setFProv] = useState([])
  const [fTipoPago, setFTipoPago] = useState([])
  const [editando, setEditando] = useState(null)  // id del registro en edición

  useEffect(() => { fetchAll() }, [])
  async function fetchAll() {
    setLoading(true)
    const { data } = await db.costos.list()
    setCostos(data || [])
    setLoading(false)
  }
  useEffect(() => { db.cotizacion.hoy().then(v => v && setDolar(v)) }, [])

  const match = (arr, val) => arr.length === 0 || arr.includes(val)

  const filtered = costos.filter(c =>
    match(fCampanha, c.campanha) &&
    match(fMes, monthKey(c.fecha)) &&
    match(fNombre, c.factura_nombre) &&
    match(fCentro, c.centro_costos) &&
    match(fProv, c.proveedor) &&
    match(fTipoPago, c.tipo_pago)
  )

  const gm = c => ivaMode === 'sin'
    ? (c.precio_total_sin_iva || c.monto_usd || 0)
    : (c.precio_total_con_iva || c.monto_usd || 0)

  const total = filtered.reduce((a, b) => a + gm(b), 0)
  const totFer = filtered.filter(c => c.factura_nombre === 'Fer' || c.factura_nombre === 'ambos').reduce((a, b) => a + gm(b) / (b.factura_nombre === 'ambos' ? 2 : 1), 0)
  const totLeo = filtered.filter(c => c.factura_nombre === 'Leo' || c.factura_nombre === 'ambos').reduce((a, b) => a + gm(b) / (b.factura_nombre === 'ambos' ? 2 : 1), 0)
  const totPend = filtered.filter(c => !c.check_pago).reduce((a, b) => a + gm(b), 0)

  const byCentro = {}; filtered.forEach(c => { byCentro[c.centro_costos] = (byCentro[c.centro_costos] || 0) + gm(c) })
  const centros = Object.entries(byCentro).sort((a, b) => b[1] - a[1])
  const maxC = centros[0]?.[1] || 1

  const byProv = {}; filtered.forEach(c => { byProv[c.proveedor] = (byProv[c.proveedor] || 0) + gm(c) })
  const provs = Object.entries(byProv).sort((a, b) => b[1] - a[1]).slice(0, 8)
  const maxP = provs[0]?.[1] || 1

  const mesesU = [...new Set(costos.map(c => monthKey(c.fecha)).filter(Boolean))].sort().reverse()
  const provsU = [...new Set(costos.map(c => c.proveedor).filter(Boolean))].sort()
  const prodsU = [...new Set(costos.map(c => c.producto_servicio).filter(Boolean))].sort()
  const nombresU = [...new Set(costos.map(c => c.factura_nombre).filter(Boolean))].sort()
  const tiposU = [...new Set(costos.map(c => c.tipo_pago).filter(Boolean))].sort()

  const preciosProd = costos
    .filter(c => c.producto_servicio === producto && c.precio_unitario)
    .sort((a, b) => a.fecha?.localeCompare(b.fecha))
    .map(c => ({ fecha: monthLabel(monthKey(c.fecha)), sin: parseFloat(c.precio_unitario) || 0, con: (parseFloat(c.precio_unitario) || 0) * (1 + (c.iva_pct || 0)), unidad: c.unidad }))
  const maxPr = Math.max(...preciosProd.map(p => ivaMode2 === 'sin' ? p.sin : p.con), 1)

  const canjes = filtered.filter(c => c.tipo_pago === 'Canje')
  const canjesMes = {}
  canjes.forEach(c => { const m = c.mes_canje || 'Sin fecha'; if (!canjesMes[m]) canjesMes[m] = { total: 0, items: [] }; canjesMes[m].total += gm(c); canjesMes[m].items.push(c) })

  const activeFilters = fCampanha.length + fMes.length + fNombre.length + fCentro.length + fProv.length + fTipoPago.length

  return (
    <div>
      <style>{CSS}</style>
      <div className="flex-between mb-2">
        <div>
          <h2>Costos</h2>
          <p style={{ fontSize: 12, color: 'var(--arcilla)', marginTop: 2 }}>
            {fmtUSD(total)} · {filtered.length} de {costos.length} registros {ivaMode === 'sin' ? '(sin IVA)' : '(con IVA)'}
            {activeFilters > 0 && <span style={{ marginLeft: 6, background: '#F5EDD8', color: '#6B3E22', borderRadius: 10, padding: '1px 7px', fontSize: 11 }}>{activeFilters} filtro{activeFilters !== 1 ? 's' : ''} activo{activeFilters !== 1 ? 's' : ''}</span>}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {dolar && <div style={{ background: 'var(--verde-light)', border: '1px solid var(--brote)', borderRadius: 20, padding: '4px 10px', fontSize: 11, color: 'var(--musgo)', fontWeight: 500 }}>USD oficial · ${dolar?.toLocaleString('es-AR')}</div>}
          {activeFilters > 0 && <button className="btn btn-secondary btn-sm" onClick={() => { setFCampanha([]); setFMes([]); setFNombre([]); setFCentro([]); setFProv([]); setFTipoPago([]) }}>Limpiar filtros</button>}
          <button className="btn btn-secondary btn-sm" onClick={() => exportCSV(filtered, 'costos')}>CSV</button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowForm(v => !v)}>{showForm ? 'Cancelar' : '+ Nueva factura'}</button>
        </div>
      </div>

      {showForm && <FormCosto dolar={dolar} onCancel={() => setShowForm(false)} onSave={async () => { setShowForm(false); await fetchAll() }} />}

      <div className="c-tabs">
        {[['resumen', 'Resumen'], ['detalle', 'Detalle'], ['precios', 'Precios unitarios'], ['canjes', 'Canjes']].map(([id, lbl]) => (
          <button key={id} className={`c-tab${tab === id ? ' on' : ''}`} onClick={() => setTab(id)}>{lbl}</button>
        ))}
      </div>

      {/* Filtros multi-select */}
      <div className="c-filters">
        <MultiSelect label="Campaña" options={CAMPANHAS} selected={fCampanha} onChange={setFCampanha} />
        <MultiSelect label="Año / Mes" options={mesesU.map(m => ({ value: m, label: monthLabel(m) })).map(o => o.value)} selected={fMes} onChange={setFMes} placeholder="Todos los meses" />
        <MultiSelect label="Factura a nombre de" options={nombresU} selected={fNombre} onChange={setFNombre} />
        <MultiSelect label="Centro de costo" options={CENTROS} selected={fCentro} onChange={setFCentro} />
        <MultiSelect label="Proveedor" options={provsU} selected={fProv} onChange={setFProv} />
        <MultiSelect label="Tipo de pago" options={tiposU} selected={fTipoPago} onChange={setFTipoPago} />
        <div className="c-fg">
          <div className="c-fl">Monto USD</div>
          <div className="iva-tog">
            <button className={`iva-b${ivaMode === 'sin' ? ' on' : ''}`} onClick={() => setIvaMode('sin')}>Sin IVA</button>
            <button className={`iva-b${ivaMode === 'con' ? ' on' : ''}`} onClick={() => setIvaMode('con')}>Con IVA</button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="c-stats">
        {[
          ['Total costos', fmtk(total), `${filtered.length} facturas`, 100, '#A0714F'],
          ['A nombre Fer', fmtk(totFer), `${total ? Math.round(totFer / total * 100) : 0}% del total`, total ? totFer / total * 100 : 0, '#6A9E58'],
          ['A nombre Leo', fmtk(totLeo), `${total ? Math.round(totLeo / total * 100) : 0}% del total`, total ? totLeo / total * 100 : 0, '#C8A96E'],
          ['Sin pagar', fmtk(totPend), `${filtered.filter(c => !c.check_pago).length} pendientes`, total ? totPend / total * 100 : 0, '#7A9EAD'],
        ].map(([l, v, s, w, col]) => (
          <div className="c-stat" key={l}>
            <div className="c-sl">{l}</div>
            <div className="c-sv">{v}</div>
            <div className="c-ss">{s}</div>
            <div className="c-sbar"><div className="c-sfill" style={{ width: `${Math.min(w, 100)}%`, background: col }} /></div>
          </div>
        ))}
      </div>

      {/* RESUMEN */}
      {tab === 'resumen' && (
        <div>
          <div className="c-grid2">
            <div className="c-panel">
              <div className="c-pt">Por centro de costo</div>
              {loading ? <div style={{ fontSize: 12, color: 'var(--arcilla)' }}>Cargando...</div>
                : centros.length === 0 ? <div style={{ fontSize: 12, color: 'var(--arcilla)' }}>Sin datos</div>
                  : centros.map(([lbl, val], i) => (
                    <div className="c-br" key={lbl}>
                      <div className="c-bl" title={lbl}>{lbl}</div>
                      <div className="c-bw"><div className="c-bf" style={{ width: `${val / maxC * 100}%`, background: BAR_COLORS[i % BAR_COLORS.length] }} /></div>
                      <div className="c-bv">{fmtk(val)}</div>
                    </div>
                  ))}
            </div>
            <div className="c-panel">
              <div className="c-pt">Fer vs Leo</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                <svg width="100" height="100" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="36" fill="none" stroke="#E8D5A3" strokeWidth="16" />
                  {total > 0 && <>
                    <circle cx="50" cy="50" r="36" fill="none" stroke="#6A9E58" strokeWidth="16" strokeDasharray={`${totFer / total * 226} 226`} strokeDashoffset="0" transform="rotate(-90 50 50)" />
                    <circle cx="50" cy="50" r="36" fill="none" stroke="#C8A96E" strokeWidth="16" strokeDasharray={`${totLeo / total * 226} 226`} strokeDashoffset={`${-totFer / total * 226}`} transform="rotate(-90 50 50)" />
                  </>}
                  <text x="50" y="47" textAnchor="middle" fontSize="12" fontWeight="600" fill="#3B2E1E">{total ? Math.round(totFer / total * 100) : 0}%</text>
                  <text x="50" y="58" textAnchor="middle" fontSize="9" fill="#A08060">Fer</text>
                </svg>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[['#6A9E58', 'Fer', totFer], ['#C8A96E', 'Leo', totLeo]].map(([c, n, v]) => (
                    <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: c, flexShrink: 0 }} />
                      <span style={{ color: 'var(--suelo)' }}>{n} — {fmtk(v)}</span>
                    </div>
                  ))}
                  <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #EDE0C8' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tipo de pago</div>
                    {['Canje', 'Cta Cte', 'Contado'].map((tp, i) => {
                      const t = filtered.filter(c => c.tipo_pago === tp).reduce((a, b) => a + gm(b), 0)
                      return t > 0 ? <div key={tp} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, marginBottom: 3 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: BAR_COLORS[i], flexShrink: 0 }} />
                        <span style={{ color: 'var(--suelo)' }}>{tp} — {fmtk(t)}</span>
                      </div> : null
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="c-panel">
            <div className="c-pt">Top proveedores</div>
            {provs.map(([lbl, val], i) => (
              <div className="c-br" key={lbl}>
                <div className="c-bl" title={lbl}>{lbl}</div>
                <div className="c-bw"><div className="c-bf" style={{ width: `${val / maxP * 100}%`, background: BAR_COLORS[i % BAR_COLORS.length] }} /></div>
                <div className="c-bv">{fmtk(val)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* DETALLE */}
      {tab === 'detalle' && (
        <div className="c-panel" style={{ padding: 0, overflowX: 'auto' }}>
          {loading ? <div style={{ padding: 24, textAlign: 'center', fontSize: 13, color: 'var(--arcilla)' }}>Cargando...</div>
            : filtered.length === 0 ? <div style={{ padding: 24, textAlign: 'center', fontSize: 13, color: 'var(--arcilla)' }}>Sin registros con estos filtros</div>
              : <table className="c-tbl">
                <thead><tr>
                  <th>Fecha</th><th>Proveedor</th><th>Descripción</th><th>Centro</th>
                  <th>Sin IVA</th><th>IVA</th><th>Con IVA</th><th>Factura</th><th>Pago</th><th>Fecha pago</th><th>Pagado</th><th></th>
                </tr></thead>
                <tbody>
                  {filtered.map(c => {
                    const isEdit = editando === c.id
                    return isEdit ? (
                      <EditRow key={c.id} costo={c} onSave={async (updated) => {
                        await db.costos.update(c.id, updated)
                        setEditando(null)
                        await fetchAll()
                      }} onCancel={() => setEditando(null)} />
                    ) : (
                    <tr key={c.id}>
                      <td style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{c.fecha ? new Date(c.fecha + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'}</td>
                      <td style={{ fontWeight: 500 }}>{c.proveedor}</td>
                      <td style={{ color: 'var(--suelo)', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.producto_servicio}</td>
                      <td><span className="cc chip-muted">{c.centro_costos}</span></td>
                      <td style={{ fontFamily: 'monospace' }}>{fmtUSD(c.precio_total_sin_iva || c.monto_usd)}</td>
                      <td style={{ color: 'var(--text-muted)' }}>{c.iva_pct ? `${(c.iva_pct * 100).toFixed(1)}%` : '0%'}</td>
                      <td style={{ color: 'var(--arcilla)', fontFamily: 'monospace' }}>{fmtUSD(c.precio_total_con_iva || c.monto_usd)}</td>
                      <td><span className={`cc ${CHIP[c.factura_nombre] || 'chip-muted'}`}>{c.factura_nombre}</span></td>
                      <td style={{ color: 'var(--cielo)' }}>{c.tipo_pago}</td>
                      <td style={{ color: 'var(--text-muted)', fontSize: 11, whiteSpace: 'nowrap' }}>{c.dia_pago ? new Date(c.dia_pago + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'}</td>
                      <td>
                        <div onClick={async () => {
                          await db.costos.update(c.id, { check_pago: !c.check_pago })
                          await fetchAll()
                        }} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <div style={{ width: 18, height: 18, borderRadius: 4, border: '1.5px solid', borderColor: c.check_pago ? 'var(--pasto)' : '#C8B89A', background: c.check_pago ? 'var(--pasto)' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {c.check_pago && <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><polyline points="2,6 5,9 10,3" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                          </div>
                        </div>
                      </td>
                      <td>
                        <button onClick={() => setEditando(c.id)} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 5, padding: '3px 8px', fontSize: 11, cursor: 'pointer', color: 'var(--arcilla)' }}>
                          Editar
                        </button>
                      </td>
                    </tr>
                  )})}
                </tbody>
              </table>}
        </div>
      )}

      {/* PRECIOS UNITARIOS */}
      {tab === 'precios' && (
        <div>
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="c-fg">
              <div className="c-fl">Producto</div>
              <select className="c-sel" value={producto} onChange={e => setProducto(e.target.value)} style={{ minWidth: 220 }}>
                <option value="">— Seleccioná un producto —</option>
                {prodsU.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="c-fg">
              <div className="c-fl">Precio</div>
              <div className="iva-tog">
                <button className={`iva-b${ivaMode2 === 'sin' ? ' on' : ''}`} onClick={() => setIvaMode2('sin')}>Sin IVA</button>
                <button className={`iva-b${ivaMode2 === 'con' ? ' on' : ''}`} onClick={() => setIvaMode2('con')}>Con IVA</button>
              </div>
            </div>
          </div>
          <div className="c-panel">
            {!producto ? <div style={{ textAlign: 'center', padding: 32, fontSize: 13, color: 'var(--arcilla)' }}>Seleccioná un producto para ver la evolución de precios</div>
              : preciosProd.length === 0 ? <div style={{ textAlign: 'center', padding: 32, fontSize: 13, color: 'var(--arcilla)' }}>No hay registros con precio unitario para "{producto}"</div>
                : <>
                  <div className="c-pt">{producto} {preciosProd[0]?.unidad ? `(${preciosProd[0].unidad})` : ''} — {ivaMode2 === 'sin' ? 'sin IVA' : 'con IVA'}</div>
                  {preciosProd.map((p, i) => {
                    const val = ivaMode2 === 'sin' ? p.sin : p.con
                    const prev = i > 0 ? (ivaMode2 === 'sin' ? preciosProd[i - 1].sin : preciosProd[i - 1].con) : null
                    const diff = prev ? ((val - prev) / prev * 100) : null
                    const col = diff === null ? '#4A7C3F' : diff > 0 ? '#A0714F' : '#4A7C3F'
                    return <div className="pr-row" key={i}>
                      <div className="pr-date">{p.fecha}</div>
                      <div className="pr-bw"><div className="pr-bf" style={{ width: `${val / maxPr * 100}%`, background: col }}>U$S {val.toFixed(2)}</div></div>
                      <div className="pr-diff" style={{ color: diff === null ? 'var(--text-muted)' : diff > 0 ? '#A0714F' : '#4A7C3F' }}>
                        {diff !== null ? `${diff > 0 ? '+' : ''}${diff.toFixed(1)}%` : ''}
                      </div>
                    </div>
                  })}
                </>}
          </div>
        </div>
      )}

      {/* CANJES */}
      {tab === 'canjes' && (
        <div>
          <div className="c-panel" style={{ marginBottom: 14 }}>
            <div className="c-pt">Resumen por mes de vencimiento</div>
            {Object.keys(canjesMes).length === 0
              ? <div style={{ fontSize: 13, color: 'var(--arcilla)' }}>No hay canjes con los filtros actuales</div>
              : Object.entries(canjesMes)
                .sort((a, b) => (MESES_CANJE.indexOf(a[0]) || 99) - (MESES_CANJE.indexOf(b[0]) || 99))
                .map(([mes, { total: t, items }]) => (
                  <div key={mes} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #EDE0C8' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span className="canje-b">{mes}</span>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{items.length} factura{items.length !== 1 ? 's' : ''}</span>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{[...new Set(items.map(i => i.proveedor))].filter(Boolean).join(' · ')}</div>
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--tierra)' }}>{fmtUSD(t, 0)}</div>
                  </div>
                ))}
          </div>
          <div className="c-panel" style={{ padding: 0, overflowX: 'auto' }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid #D8C9A8' }}><div className="c-pt" style={{ marginBottom: 0 }}>Detalle canjes</div></div>
            <table className="c-tbl">
              <thead><tr><th>Fecha</th><th>Proveedor</th><th>Producto</th><th>Mes canje</th><th>Sin IVA</th><th>Con IVA</th><th>Factura</th></tr></thead>
              <tbody>
                {canjes.map(c => (
                  <tr key={c.id}>
                    <td style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{c.fecha ? new Date(c.fecha + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'}</td>
                    <td style={{ fontWeight: 500 }}>{c.proveedor}</td>
                    <td style={{ color: 'var(--suelo)' }}>{c.producto_servicio}</td>
                    <td>{c.mes_canje ? <span className="canje-b">{c.mes_canje}</span> : <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>Sin fecha</span>}</td>
                    <td style={{ fontFamily: 'monospace' }}>{fmtUSD(c.precio_total_sin_iva || c.monto_usd)}</td>
                    <td style={{ color: 'var(--arcilla)', fontFamily: 'monospace' }}>{fmtUSD(c.precio_total_con_iva || c.monto_usd)}</td>
                    <td><span className={`cc ${CHIP[c.factura_nombre] || 'chip-muted'}`}>{c.factura_nombre}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
