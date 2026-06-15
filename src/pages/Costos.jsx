import { useState, useEffect, useRef } from 'react'
import { db, exportCSV, getMaestros, clearMaestrosCache } from '../lib/supabase'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import SearchableSelect from '../components/SearchableSelect'

const CENTROS = ['Producción','Costos únicos','Comercialización','Alquiler','Administrativo','Mantenimiento de infraestructura','Inversiones / infraestructura','Servicios']
const CONCEPTOS = ['Compra','NC','ND','Otro']
const TIPOS_PAGO = ['Canje','Cta Cte','Contado','Redagro360','Redagro270','Cheque','Transferencia']
const IVA_OPTS = [{ label: '0%', val: 0 },{ label: '10.5%', val: 0.105 },{ label: '21%', val: 0.21 }]
const CAMPANHAS_DEFAULT = ['26-27','25-26','24-25','23-24']
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
          <div className="ms-item" onClick={() => {
            if (selected.length === options.length) onChange([])
            else onChange([...options])
          }}>
            <div className="ms-check" style={{ background: selected.length === options.length ? '#4A7C3F' : 'transparent', borderColor: selected.length === options.length ? '#4A7C3F' : '#C8B89A', color: '#fff' }}>
              {selected.length === options.length ? '✓' : selected.length > 0 ? '–' : ''}
            </div>
            <span style={{ fontWeight: 500, color: '#4A7C3F', fontSize: 11 }}>
              {selected.length === options.length ? 'Deseleccionar todos' : 'Seleccionar todos'}
            </span>
          </div>
          <div className="ms-sep" />
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
  return 'USD ' + parseFloat(n).toLocaleString('es-AR', { minimumFractionDigits: dec, maximumFractionDigits: dec })
}
function fmtk(n) { return fmtUSD(n, 2) }
function monthKey(f) { if (!f) return ''; const d = new Date(f + 'T12:00:00'); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }
function monthLabel(ym) { const [y, m] = ym.split('-'); const n = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']; return `${n[parseInt(m) - 1]} ${y.slice(2)}` }

// ── Fila de edición rápida ───────────────────────────────────────────────────
function EditRow({ costo, onSave, onCancel, onDelete, puedeEliminar, usuario }) {
  const [form, setForm] = useState({
    fecha:             costo.fecha || '',
    campanha:          costo.campanha || '',
    concepto:          costo.concepto || 'Compra',
    proveedor:         costo.proveedor || '',
    producto_servicio: costo.producto_servicio || '',
    centro_costos:     costo.centro_costos || '',
    factura_numero:    costo.factura_numero || '',
    factura_nombre:    costo.factura_nombre || '',
    precio_unitario:       costo.precio_unitario ?? '',
    unidad:                costo.unidad || '',
    cantidad:              costo.cantidad ?? '',
    precio_por_unidad_base: costo.precio_por_unidad_base ?? '',
    unidad_base:           costo.unidad_base || '',
    iva_pct:               costo.iva_pct ?? 0.21,
    moneda:            costo.moneda || '',
    cotizacion_usd:    costo.cotizacion_usd ?? '',
    tipo_pago:         costo.tipo_pago || '',
    mes_canje:         costo.mes_canje || '',
    dia_pago:          costo.dia_pago || '',
    check_pago:        costo.check_pago || false,
    quien_carga:       costo.quien_carga || '',
    comentarios:       costo.comentarios || '',
  })
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))
  const [saving, setSaving] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function save() {
    setSaving(true)
    await onSave(form)
    setSaving(false)
  }

  async function doDelete() {
    setDeleting(true)
    await onDelete(costo.id, usuario)
    setDeleting(false)
  }

  const cell = { padding: '5px 4px', verticalAlign: 'middle' }
  const si = { padding: '4px 6px', border: '1px solid #D8C9A8', borderRadius: 5, fontSize: 11, fontFamily: 'inherit', width: '100%' }
  const inp = (k, type = 'text', style = {}) => (
    <input type={type} value={form[k]} onChange={e => f(k, e.target.value)}
      style={{ ...si, ...style }} />
  )

  return (
    <tr style={{ background: '#FFF9EE' }}>
      {/* 1 Fecha */}
      <td style={cell}><input type="date" value={form.fecha} onChange={e => f('fecha', e.target.value)} style={si} /></td>
      {/* 2 Campaña */}
      <td style={cell}><input value={form.campanha} onChange={e => f('campanha', e.target.value)} style={si} /></td>
      {/* 2b Concepto */}
      <td style={cell}>
        <select value={form.concepto} onChange={e => f('concepto', e.target.value)} style={{...si, width: 90}}>
          {CONCEPTOS.map(o => <option key={o}>{o}</option>)}
        </select>
      </td>
      {/* 3 Proveedor */}
      <td style={cell}><input value={form.proveedor} onChange={e => f('proveedor', e.target.value)} style={{ ...si, fontWeight: 500 }} /></td>
      {/* 4 Producto */}
      <td style={cell}><input value={form.producto_servicio} onChange={e => f('producto_servicio', e.target.value)} style={si} /></td>
      {/* 4b P. unitario */}
      <td style={cell}>
        <input type="number" step="0.01" value={form.precio_unitario} onChange={e => f('precio_unitario', e.target.value)} style={{...si, width:70}} placeholder="0.00"/>
      </td>
      {/* 4c Unidad */}
      <td style={cell}><input value={form.unidad} onChange={e => f('unidad', e.target.value)} style={{...si, width:60}} placeholder="L"/></td>
      {/* 4d Cantidad */}
      <td style={cell}><input type="number" step="0.01" value={form.cantidad} onChange={e => f('cantidad', e.target.value)} style={{...si, width:70}} placeholder="0"/></td>
      {/* 5 Centro */}
      <td style={cell}>
        <select value={form.centro_costos} onChange={e => f('centro_costos', e.target.value)} style={si}>
          {CENTROS.map(o => <option key={o}>{o}</option>)}
        </select>
      </td>
      {/* 6 N° Factura */}
      <td style={cell}><input value={form.factura_numero} onChange={e => f('factura_numero', e.target.value)} style={si} placeholder="N° factura" /></td>
      {/* 7 Factura a nombre de */}
      <td style={cell}>
        <select value={form.factura_nombre} onChange={e => f('factura_nombre', e.target.value)} style={si}>
          {(['Fer','Leo','ambos','Sin factura','Consumidor final'].includes(form.factura_nombre)
            ? ['Fer','Leo','ambos','Sin factura','Consumidor final']
            : ['Fer','Leo','ambos','Sin factura',form.factura_nombre].filter(Boolean)
          ).map(o => <option key={o}>{o}</option>)}
        </select>
      </td>
      {/* 8 Sin IVA (USD) — solo lectura */}
      <td style={{ ...cell, color: 'var(--text-muted)', fontSize: 11, whiteSpace: 'nowrap' }}>{fmtUSD(costo.precio_total_sin_iva || costo.monto_usd)}</td>
      {/* 9 IVA (USD) — editable como % */}
      <td style={cell}>
        <select value={form.iva_pct} onChange={e => f('iva_pct', parseFloat(e.target.value))} style={{ ...si, width: 70 }}>
          <option value={0}>0%</option>
          <option value={0.105}>10.5%</option>
          <option value={0.21}>21%</option>
        </select>
      </td>
      {/* 10 Con IVA (USD) — solo lectura */}
      <td style={{ ...cell, color: 'var(--arcilla)', fontSize: 11, whiteSpace: 'nowrap' }}>{fmtUSD(costo.precio_total_con_iva || costo.monto_usd)}</td>
      {/* 11 Otros imp. (USD) — solo lectura */}
      <td style={{ ...cell, color: 'var(--text-muted)', fontSize: 11 }}>{costo.otros_impuestos ? fmtUSD(costo.otros_impuestos) : '—'}</td>
      {/* 12 Total (USD) — solo lectura */}
      <td style={{ ...cell, fontSize: 11, fontWeight: 600 }}>{fmtUSD(costo.precio_total_usd || costo.precio_total_con_iva || costo.monto_usd)}</td>
      {/* 13 Sin IVA (ARS) — solo lectura */}
      <td style={{ ...cell, color: 'var(--text-muted)', fontSize: 11 }}>{costo.precio_total_sin_iva_ars ? costo.precio_total_sin_iva_ars.toLocaleString('es-AR', {minimumFractionDigits:0,maximumFractionDigits:0}) : '—'}</td>
      {/* 14 Con IVA (ARS) — solo lectura */}
      <td style={{ ...cell, color: 'var(--text-muted)', fontSize: 11 }}>{costo.precio_total_con_iva_ars ? costo.precio_total_con_iva_ars.toLocaleString('es-AR', {minimumFractionDigits:0,maximumFractionDigits:0}) : '—'}</td>
      {/* 15 Otros imp. (ARS) — solo lectura */}
      <td style={{ ...cell, color: 'var(--text-muted)', fontSize: 11 }}>{costo.valor_total_otros_imp_ars ? costo.valor_total_otros_imp_ars.toLocaleString('es-AR', {minimumFractionDigits:0,maximumFractionDigits:0}) : '—'}</td>
      {/* 16 Total (ARS) — solo lectura */}
      <td style={{ ...cell, color: 'var(--text-muted)', fontSize: 11 }}>{costo.precio_total_ars ? costo.precio_total_ars.toLocaleString('es-AR', {minimumFractionDigits:0,maximumFractionDigits:0}) : '—'}</td>
      {/* 17 Cotiz. — solo lectura */}
      <td style={{ ...cell, color: 'var(--text-muted)', fontSize: 11 }}>{costo.cotizacion_usd ? Math.round(costo.cotizacion_usd).toLocaleString('es-AR') : '—'}</td>
      {/* 18 Moneda */}
      <td style={cell}><input value={form.moneda} onChange={e => f('moneda', e.target.value)} style={{ ...si, width: 70 }} /></td>
      {/* 19 Tipo pago */}
      <td style={cell}>
        <select value={form.tipo_pago} onChange={e => f('tipo_pago', e.target.value)} style={si}>
          {TIPOS_PAGO.map(o => <option key={o}>{o}</option>)}
        </select>
      </td>
      {/* 20 Mes canje */}
      <td style={cell}>
        <input value={form.mes_canje} onChange={e => f('mes_canje', e.target.value)}
          placeholder="ej: May 26" style={si} list="meses-canje-list" />
        <datalist id="meses-canje-list">{MESES_CANJE.map(m => <option key={m} value={m} />)}</datalist>
      </td>
      {/* 21 Fecha pago */}
      <td style={cell}><input type="date" value={form.dia_pago} onChange={e => f('dia_pago', e.target.value)} style={si} /></td>
      {/* 22 Pagado */}
      <td style={cell}>
        <div onClick={() => f('check_pago', !form.check_pago)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 18, height: 18, borderRadius: 4, border: '1.5px solid', borderColor: form.check_pago ? 'var(--pasto)' : '#C8B89A', background: form.check_pago ? 'var(--pasto)' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {form.check_pago && <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><polyline points="2,6 5,9 10,3" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
          </div>
        </div>
      </td>
      {/* 23 Quién */}
      <td style={cell}>
        <select value={form.quien_carga} onChange={e => f('quien_carga', e.target.value)} style={si}>
          {['Fer','Leo','Gise'].map(o => <option key={o}>{o}</option>)}
        </select>
      </td>
      {/* 24 Comentarios */}
      <td style={cell}><input value={form.comentarios} onChange={e => f('comentarios', e.target.value)} style={si} placeholder="comentarios" /></td>
      {/* 24b Precio/unidad base — clave para almacen */}
      <td style={{...cell, background:'#EBF4E8'}}>
        <div style={{fontSize:9,color:'#2E4F26',marginBottom:2,fontWeight:600,textTransform:'uppercase'}}>P/unidad base</div>
        <input type="number" step="0.0001" value={form.precio_por_unidad_base} onChange={e => f('precio_por_unidad_base', e.target.value)}
          style={{...si, width:75, border:'1px solid #9DC87A'}} placeholder="0.0000"/>
      </td>
      <td style={{...cell, background:'#EBF4E8'}}>
        <div style={{fontSize:9,color:'#2E4F26',marginBottom:2,fontWeight:600,textTransform:'uppercase'}}>Unid. base</div>
        <input value={form.unidad_base} onChange={e => f('unidad_base', e.target.value)}
          style={{...si, width:55, border:'1px solid #9DC87A'}} placeholder="L"/>
      </td>
      {/* 25 Acciones */}
      <td style={cell}>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          <button onClick={save} disabled={saving}
            style={{ background: 'var(--pasto)', color: 'white', border: 'none', borderRadius: 5, padding: '4px 8px', fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            {saving ? '...' : '✓ OK'}
          </button>
          <button onClick={onCancel}
            style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 5, padding: '4px 8px', fontSize: 11, cursor: 'pointer' }}>✕</button>
          {puedeEliminar && !confirmDel && (
            <button onClick={() => setConfirmDel(true)}
              style={{ background: '#FAECE7', border: '1px solid #F0997B', borderRadius: 5, padding: '4px 8px', fontSize: 11, cursor: 'pointer', color: '#993C1D' }}>🗑</button>
          )}
          {puedeEliminar && confirmDel && (
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <span style={{ fontSize: 10, color: '#993C1D', whiteSpace: 'nowrap' }}>¿Eliminar?</span>
              <button onClick={doDelete} disabled={deleting}
                style={{ background: '#993C1D', color: 'white', border: 'none', borderRadius: 5, padding: '4px 8px', fontSize: 11, cursor: 'pointer' }}>
                {deleting ? '...' : 'Sí'}
              </button>
              <button onClick={() => setConfirmDel(false)}
                style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 5, padding: '4px 6px', fontSize: 11, cursor: 'pointer' }}>No</button>
            </div>
          )}
        </div>
      </td>
    </tr>
  )
}

// ── FormCosto — items unificados + total corriente ──────────────────────────
function FormCosto({ onSave, onCancel, dolar, campanhas = CAMPANHAS_DEFAULT }) {
  const fileRef = useRef()
  const [foto, setFoto] = useState(null)
  const [saving, setSaving] = useState(false)
  const [leyendoIA, setLeyendoIA] = useState(false)
  const [iaMsg, setIaMsg] = useState('')
  const [opts, setOpts] = useState({
    proveedor: [], producto: [], marca: [], quien_carga: ['Fer','Leo','Gise'],
    centro_costos: [], concepto: [], unidad: [], moneda: [], factura_nombre: [], tipo_pago: [], mes_canje: []
  })
  useEffect(() => {
    const tipos = ['proveedor','producto','marca','centro_costos','concepto','unidad','moneda','factura_nombre','tipo_pago','mes_canje']
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
    centro_costos: 'Producción', proveedor: '', factura_numero: '',
    moneda: 'ARS', cotizacion_usd: dolar || '',
    factura_nombre: 'ambos', tipo_pago: 'Canje', mes_canje: '', dia_pago: '',
    check_pago: false, comentarios: '',
    carga_especial: false, monto_total_factura: '', iva_total_factura: '', otros_imp_total_factura: '',
  })
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const emptyItem = (prev) => ({
    producto_servicio: '', precio_unitario: '', cantidad: '1',
    unidad: prev?.unidad || 'USD/ha', iva_pct: prev?.iva_pct ?? 0.21, iva_incluido: false,
    marca: '', presentacion: '', contenido_por_unidad: '', unidad_base: '', showNorm: false,
  })
  const [items, setItems] = useState([emptyItem()])
  const addItem    = () => setItems(prev => [...prev, emptyItem(prev[prev.length - 1])])
  const removeItem = (idx) => setItems(prev => prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev)
  const updateItem = (idx, k, v) => setItems(prev => prev.map((it, i) => i === idx ? { ...it, [k]: v } : it))
  const [cotizMsg, setCotizMsg] = useState('')

  async function addToMaestros(tipo, valor) {
    if (!valor?.trim()) return
    await supabase.from('maestros').insert({ tipo, valor: valor.trim(), activo: true, orden: 999 })
    clearMaestrosCache()
    setOpts(prev => ({ ...prev, [tipo]: [...new Set([...(prev[tipo] || []), valor.trim()])].sort() }))
  }

  async function fetchCotizFecha(fecha) {
    if (!fecha) return
    const { data } = await supabase.from('cotizaciones_usd').select('venta').eq('fecha', fecha).eq('tipo', 'oficial').maybeSingle()
    if (data?.venta) { setForm(p => ({ ...p, cotizacion_usd: data.venta })); setCotizMsg('') }
    else { setForm(p => ({ ...p, cotizacion_usd: '' })); setCotizMsg('No hay cotizacion para esta fecha. Ingresa el valor manualmente.') }
  }

  const cotiz = parseFloat(form.cotizacion_usd) || 1
  const esARS = form.moneda === 'ARS'
  const toUSD = v => esARS ? v / cotiz : v
  const toARS = v => esARS ? v : v * cotiz

  function calcItem(item) {
    const pu  = parseFloat(item.precio_unitario) || 0
    const iva = item.iva_pct || 0
    const cnt = parseFloat(item.cantidad) || 1
    const puSin = item.iva_incluido ? pu / (1 + iva) : pu
    const totSin = puSin * cnt
    const totIva = totSin * iva
    const totCon = totSin + totIva
    return {
      totSin, totIva, totCon,
      totSinUSD: toUSD(totSin), totConUSD: toUSD(totCon),
      totSinARS: toARS(totSin), totConARS: toARS(totCon),
      puBase: item.precio_unitario && item.contenido_por_unidad
        ? parseFloat(item.precio_unitario) / parseFloat(item.contenido_por_unidad) : null,
    }
  }

  const totFact = items.reduce((acc, it) => {
    const c = calcItem(it)
    return { sinUSD: acc.sinUSD + c.totSinUSD, conUSD: acc.conUSD + c.totConUSD, sinARS: acc.sinARS + c.totSinARS, conARS: acc.conARS + c.totConARS }
  }, { sinUSD: 0, conUSD: 0, sinARS: 0, conARS: 0 })

  const montoTotalFact    = parseFloat(form.monto_total_factura) || 0
  const ivaTotalFact      = parseFloat(form.iva_total_factura) || 0
  const otrosImpTotalFact = parseFloat(form.otros_imp_total_factura) || 0
  const montoRelacionado  = esARS ? totFact.sinARS : totFact.sinUSD
  const proporcion        = montoTotalFact !== 0 ? montoRelacionado / montoTotalFact : 0
  const otrosImpUSD       = toUSD(otrosImpTotalFact * proporcion)
  const otrosImpARS       = toARS(otrosImpTotalFact * proporcion)

  async function submit(e) {
    e.preventDefault()
    if (esARS && (!form.cotizacion_usd || parseFloat(form.cotizacion_usd) <= 0)) { alert('Falta la cotizacion USD.'); return }
    const itemsValidos = items.filter(it => parseFloat(it.precio_unitario) !== 0 && it.precio_unitario !== '' && it.precio_unitario != null)
    if (itemsValidos.length === 0) { alert('Agrega al menos un item con precio.'); return }
    setSaving(true)
    try {
      const clean = v => (v === '' || v === undefined) ? null : v
      let firstId = null
      for (let i = 0; i < itemsValidos.length; i++) {
        const item = itemsValidos[i]
        const c = calcItem(item)
        const isFirst = i === 0
        const otrosU = isFirst && form.carga_especial ? otrosImpUSD : null
        const otrosA = isFirst && form.carga_especial ? otrosImpARS : null
        const { data, error } = await db.costos.insert({
          fecha: form.fecha, quien_carga: form.quien_carga, campanha: form.campanha,
          centro_costos: form.centro_costos, proveedor: form.proveedor, concepto: form.concepto,
          moneda: form.moneda, cotizacion_usd: parseFloat(form.cotizacion_usd) || null,
          factura_nombre: clean(form.factura_nombre), factura_numero: clean(form.factura_numero),
          tipo_pago: form.tipo_pago, mes_canje: clean(form.mes_canje),
          dia_pago: clean(form.dia_pago), check_pago: form.check_pago || false,
          comentarios: clean(form.comentarios),
          carga_especial: isFirst ? form.carga_especial : false,
          producto_servicio: clean(item.producto_servicio),
          precio_unitario: parseFloat(item.precio_unitario) || null,
          cantidad: parseFloat(item.cantidad) || null,
          unidad: clean(item.unidad),
          iva_pct: item.iva_pct || 0, iva_incluido: item.iva_incluido,
          marca: clean(item.marca), presentacion: clean(item.presentacion),
          contenido_por_unidad: parseFloat(item.contenido_por_unidad) || null,
          unidad_base: clean(item.unidad_base),
          precio_por_unidad_base: c.puBase,
          precio_total_sin_iva: c.totSinUSD !== 0 ? c.totSinUSD : null,
          monto_usd: c.totSinUSD !== 0 ? c.totSinUSD : null,
          monto_iva: toUSD(c.totIva) || null, valor_total_iva_usd: toUSD(c.totIva) || null,
          precio_total_con_iva: c.totConUSD !== 0 ? c.totConUSD : null,
          valor_total_otros_imp_usd: otrosU, otros_impuestos: otrosU,
          precio_total_usd: (c.totConUSD + (otrosU || 0)) !== 0 ? (c.totConUSD + (otrosU || 0)) : null,
          precio_total_sin_iva_ars: c.totSinARS !== 0 ? c.totSinARS : null,
          valor_total_iva_ars: toARS(c.totIva) || null,
          precio_total_con_iva_ars: c.totConARS !== 0 ? c.totConARS : null,
          valor_total_otros_imp_ars: otrosA,
          precio_total_ars: (c.totConARS + (otrosA || 0)) !== 0 ? (c.totConARS + (otrosA || 0)) : null,
        })
        if (error) { alert('Error al guardar: ' + (error.message || JSON.stringify(error))); return }
        if (i === 0 && data?.[0]?.id) firstId = data[0].id
      }
      if (foto && firstId) { const url = await db.uploadFoto(foto, firstId); await db.costos.update(firstId, { foto_url: url }) }
      onSave()
    } catch(err) {
      console.error('Error en submit:', err)
      alert('Error inesperado: ' + (err?.message || String(err)))
    } finally {
      setSaving(false)
    }
  }

  async function leerFactura() {
    if (!foto) return
    setLeyendoIA(true); setIaMsg('Leyendo imagen...')
    try {
      const base64 = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result.split(',')[1]); r.onerror = rej; r.readAsDataURL(foto) })
      setIaMsg('Analizando con IA...')
      const resp = await fetch('/api/analizar-factura', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ base64, mediaType: foto.type || 'image/jpeg' }) })
      const data = await resp.json()
      if (!resp.ok) throw new Error('API ' + resp.status)
      const parsed = JSON.parse((data.content?.[0]?.text || '').replace(/```json|```/g, '').trim())
      setIaMsg('Datos cargados')
      if (parsed.proveedor) f('proveedor', parsed.proveedor)
      if (parsed.fecha) { const yr = parseInt(parsed.fecha.slice(0, 4)); if (yr >= 2024 && yr <= 2030) { f('fecha', parsed.fecha); fetchCotizFecha(parsed.fecha) } }
      if (parsed.factura_numero) f('factura_numero', parsed.factura_numero)
      if (parsed.moneda) f('moneda', parsed.moneda)
      if (parsed.monto_total_factura) f('monto_total_factura', String(parsed.monto_total_factura))
      if (parsed.iva_total) f('iva_total_factura', String(parsed.iva_total))
      if (parsed.otros_impuestos_total) f('otros_imp_total_factura', String(parsed.otros_impuestos_total))
      if (parsed.tiene_items_no_campo) f('carga_especial', true)
      if (parsed.producto_servicio) updateItem(0, 'producto_servicio', parsed.producto_servicio)
      if (parsed.precio_unitario != null) updateItem(0, 'precio_unitario', String(parsed.precio_unitario))
      if (parsed.cantidad != null) updateItem(0, 'cantidad', String(parsed.cantidad))
      if (parsed.iva_pct != null) updateItem(0, 'iva_pct', parsed.iva_pct)
      if (parsed.iva_incluido != null) updateItem(0, 'iva_incluido', parsed.iva_incluido)
      setTimeout(() => setIaMsg(''), 4000)
    } catch (err) { setIaMsg('Error: ' + String(err)); setTimeout(() => setIaMsg(''), 8000) }
    setLeyendoIA(false)
  }

  const inp = (k, type, ph) => <input className="input" type={type} value={form[k]} placeholder={ph} onChange={e => f(k, e.target.value)} style={{ width: '100%' }} />
  const sel = (k, fallbackOpts, addNew = false) => (
    <SearchableSelect value={form[k]} onChange={v => f(k, v)}
      options={opts[k]?.length ? opts[k] : fallbackOpts} placeholder="Selecciona..."
      onAddNew={addNew ? v => addToMaestros(k, v) : null} />
  )

  return (
    <div className="card mb-3" style={{ background: '#F9F6EE', borderColor: 'var(--paja)' }}>
      <h3 style={{ marginBottom: 16 }}>Nueva factura</h3>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

        <div onClick={() => fileRef.current.click()} style={{ border: `1.5px dashed ${foto ? 'var(--pasto)' : 'var(--border)'}`, borderRadius: 8, padding: '12px 16px', textAlign: 'center', cursor: 'pointer', background: foto ? 'var(--verde-light)' : 'transparent', fontSize: 12, color: foto ? 'var(--musgo)' : 'var(--text-muted)' }}>
          {foto ? foto.name : 'Foto de factura (opcional)'}
        </div>
        <input ref={fileRef} type="file" accept="image/*,application/pdf" style={{ display: 'none' }} onChange={e => setFoto(e.target.files[0])} />
        {foto && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button type="button" onClick={leerFactura} disabled={leyendoIA}
              style={{ padding: '8px 16px', borderRadius: 7, fontSize: 13, cursor: leyendoIA ? 'wait' : 'pointer', border: '1px solid', fontFamily: 'inherit', background: leyendoIA ? '#F5F0E4' : 'var(--pasto)', color: leyendoIA ? 'var(--arcilla)' : '#F5F0E4', borderColor: leyendoIA ? 'var(--border)' : 'var(--pasto)', fontWeight: 500 }}>
              {leyendoIA ? 'Analizando...' : 'Analizar con IA'}
            </button>
            {iaMsg && <span style={{ fontSize: 12, color: 'var(--arcilla)' }}>{iaMsg}</span>}
          </div>
        )}

        <div className="grid-2">
          <div className="field"><label className="label">Fecha</label><input className="input" type="date" value={form.fecha} onChange={e => { f('fecha', e.target.value); fetchCotizFecha(e.target.value) }} style={{ width: '100%' }} /></div>
          <div className="field"><label className="label">Quien carga</label>{sel('quien_carga', ['Fer','Leo','Gise'])}</div>
        </div>
        <div className="grid-2">
          <div className="field"><label className="label">Campana</label><SearchableSelect value={form.campanha} onChange={v => f('campanha', v)} options={campanhas} /></div>
          <div className="field"><label className="label">Centro de costo</label>{sel('centro_costos', CENTROS)}</div>
        </div>
        <div className="grid-2">
          <div className="field"><label className="label">Proveedor</label>{sel('proveedor', [], true)}</div>
          <div className="field"><label className="label">Concepto</label>{sel('concepto', CONCEPTOS)}</div>
        </div>
        <div className="grid-2">
          <div className="field">
            <label className="label">Cotizacion USD {dolar ? `(hoy: ${dolar?.toLocaleString('es-AR')})` : ''}</label>
            {inp('cotizacion_usd', 'number', '1478')}
            {cotizMsg && <div style={{ fontSize: 11, color: '#993C1D', marginTop: 4 }}>{cotizMsg}</div>}
          </div>
          <div className="field"><label className="label">Moneda</label>{sel('moneda', ['ARS','USD oficial','USD billete'])}</div>
        </div>
        <div className="grid-2">
          <div className="field"><label className="label">N comprobante</label>{inp('factura_numero', 'text', 'A-0001-00012345')}</div>
          <div className="field"><label className="label">Factura a nombre de</label>{sel('factura_nombre', ['Fer','Leo','ambos','Sin factura'])}</div>
        </div>

        {/* TABLA DE ITEMS */}
        <div style={{ border: '1px solid #E8D5A3', borderRadius: 8, overflow: 'visible' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2.2fr 0.9fr 0.5fr 0.8fr 0.9fr 0.5fr 0.9fr 26px', gap: 6, padding: '6px 10px', background: '#EDE0C8', borderRadius: '7px 7px 0 0', fontSize: 10, fontWeight: 600, color: '#7A6040', textTransform: 'uppercase', letterSpacing: '0.04em', alignItems: 'center' }}>
            <span>Producto / Servicio</span><span>Precio unit.</span><span>Cant.</span><span>Unidad</span><span>IVA %</span><span title="IVA incluido en precio">Inc.</span><span style={{ textAlign: 'right' }}>Subtotal USD</span><span></span>
          </div>

          {items.map((item, idx) => {
            const c = calcItem(item)
            const si = { padding: '5px 6px', border: '1px solid #D8C9A8', borderRadius: 5, fontSize: 12, fontFamily: 'inherit', width: '100%', background: '#FDFAF4' }
            return (
              <div key={idx} style={{ borderTop: idx > 0 ? '1px solid #E8D5A3' : 'none', padding: '8px 10px', background: idx === 0 ? '#FDFAF4' : '#FAF7F0' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '2.2fr 0.9fr 0.5fr 0.8fr 0.9fr 0.5fr 0.9fr 26px', gap: 6, alignItems: 'center' }}>
                  <SearchableSelect value={item.producto_servicio} onChange={v => updateItem(idx, 'producto_servicio', v)}
                    options={opts.producto?.length ? opts.producto : []} placeholder="Producto / Servicio..."
                    onAddNew={v => addToMaestros('producto', v)} />
                  <input type="number" value={item.precio_unitario} onChange={e => updateItem(idx, 'precio_unitario', e.target.value)} placeholder="0.00" style={si} />
                  <input type="number" value={item.cantidad} onChange={e => updateItem(idx, 'cantidad', e.target.value)} placeholder="1" style={si} />
                  <input list={`ul-${idx}`} value={item.unidad} onChange={e => updateItem(idx, 'unidad', e.target.value)} placeholder="Unidad" style={si} />
                  <datalist id={`ul-${idx}`}>{(opts.unidad?.length ? opts.unidad : ['USD/ha','USD/l','USD/Kg','USD/tn','USD/bidon','USD/bolsa']).map(u => <option key={u} value={u} />)}</datalist>
                  <select value={item.iva_pct} onChange={e => updateItem(idx, 'iva_pct', parseFloat(e.target.value))} style={{ ...si, background: '#F5F0E4' }}>
                    <option value={0}>0%</option><option value={0.105}>10.5%</option><option value={0.21}>21%</option>
                  </select>
                  <div onClick={() => updateItem(idx, 'iva_incluido', !item.iva_incluido)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                    <div style={{ width: 20, height: 20, borderRadius: 4, border: '1.5px solid', borderColor: item.iva_incluido ? 'var(--pasto)' : '#C8B89A', background: item.iva_incluido ? 'var(--pasto)' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {item.iva_incluido && <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><polyline points="2,6 5,9 10,3" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    </div>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: item.precio_unitario ? 'var(--musgo)' : 'var(--text-muted)', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {item.precio_unitario ? fmtUSD(c.totConUSD, 0) : '---'}
                  </div>
                  <button type="button" onClick={() => removeItem(idx)}
                    style={{ width: 22, height: 22, borderRadius: 4, border: '1px solid', borderColor: items.length > 1 ? '#F0997B' : '#D8C9A8', background: items.length > 1 ? '#FAECE7' : 'transparent', color: items.length > 1 ? '#993C1D' : '#C8B89A', cursor: items.length > 1 ? 'pointer' : 'default', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>x</button>
                </div>

                {parseFloat(item.precio_unitario) > 0 && (
                  <div style={{ display: 'flex', gap: 12, marginTop: 5, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 10, color: 'var(--arcilla)' }}>
                      Sin IVA: {fmtUSD(c.totSinUSD, 2)}
                      {esARS && <span style={{ opacity: 0.7 }}> ARS {c.totSinARS.toLocaleString('es-AR',{minimumFractionDigits:0,maximumFractionDigits:0})}</span>}
                    </span>
                    <button type="button" onClick={() => updateItem(idx, 'showNorm', !item.showNorm)}
                      style={{ marginLeft: 'auto', padding: '2px 8px', borderRadius: 4, fontSize: 10, cursor: 'pointer', border: '1px solid #D8C9A8', fontFamily: 'inherit', background: item.showNorm ? '#F5F0E8' : 'transparent', color: 'var(--barro)' }}>
                      {item.showNorm ? 'Ocultar normalizacion' : 'Normalizar precio'}
                    </button>
                  </div>
                )}

                {item.showNorm && (
                  <div style={{ marginTop: 6, background: '#FAF7F0', border: '1px solid #E8D5A3', borderRadius: 6, padding: '8px 10px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}>
                    {[['Marca','marca','Nufarm...','text'],['Presentacion','presentacion','bidon 20L...','text'],['Contenido/unidad','contenido_por_unidad','20','number'],['Unidad base','unidad_base','L, Kg, tn...','text']].map(([lbl,k,ph,tp]) => (
                      <div key={k}>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 3 }}>{lbl}</div>
                        <input type={tp} value={item[k]} onChange={e => updateItem(idx, k, e.target.value)} placeholder={ph}
                          style={{ padding: '4px 6px', border: '1px solid #D8C9A8', borderRadius: 5, fontSize: 11, fontFamily: 'inherit', width: '100%', background: '#FDFAF4' }} />
                      </div>
                    ))}
                    {item.precio_unitario && item.contenido_por_unidad && (
                      <div style={{ gridColumn: '1 / -1', marginTop: 4, padding: '5px 8px', background: 'white', borderRadius: 5, border: '1px solid #D8C9A8', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 11, color: 'var(--arcilla)' }}>Precio por {item.unidad_base || 'unidad base'}:</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--musgo)' }}>U$S {(parseFloat(item.precio_unitario) / parseFloat(item.contenido_por_unidad)).toFixed(4)} / {item.unidad_base || '?'}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}

          <div style={{ borderTop: '2px solid #D8C9A8', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F5F0E4', borderRadius: '0 0 7px 7px' }}>
            <button type="button" onClick={addItem}
              style={{ padding: '6px 14px', borderRadius: 6, fontSize: 12, cursor: 'pointer', border: '1px solid var(--pasto)', background: 'transparent', color: 'var(--musgo)', fontFamily: 'inherit', fontWeight: 500 }}>
              + Agregar item{items.length > 1 ? ` (${items.length} en total)` : ''}
            </button>
            <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 10, color: 'var(--arcilla)', marginBottom: 1, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sin IVA</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--arcilla)' }}>{fmtUSD(totFact.sinUSD)}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 10, color: 'var(--musgo)', marginBottom: 1, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total c/IVA</div>
                <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--musgo)' }}>{fmtUSD(totFact.conUSD)}</div>
                {esARS && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>ARS {totFact.conARS.toLocaleString('es-AR',{minimumFractionDigits:0,maximumFractionDigits:0})}</div>}
              </div>
            </div>
          </div>
        </div>

        <div>
          <button type="button" onClick={() => f('carga_especial', !form.carga_especial)}
            style={{ padding: '7px 14px', borderRadius: 6, fontSize: 12, cursor: 'pointer', border: '1px solid', fontFamily: 'inherit', background: form.carga_especial ? '#E4F0F4' : 'transparent', color: form.carga_especial ? '#2C5A6A' : 'var(--arcilla)', borderColor: form.carga_especial ? '#7A9EAD' : 'var(--border)', fontWeight: form.carga_especial ? 500 : 400 }}>
            {form.carga_especial ? 'Factura con items mixtos' : '+ Factura con items mixtos (combustible, etc.)'}
          </button>
        </div>

        {form.carga_especial && (
          <div style={{ background: '#EAF2F8', border: '1px solid #7A9EAD', borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#2C5A6A', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Desglose items campo vs no campo</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead><tr>
                <th style={{ padding: '6px 10px', textAlign: 'left', fontSize: 10, color: '#4E7A8A', fontWeight: 600, textTransform: 'uppercase', borderBottom: '1px solid #B8D0D8' }}></th>
                <th style={{ padding: '6px 10px', textAlign: 'right', fontSize: 10, color: '#993C1D', fontWeight: 600, textTransform: 'uppercase', borderBottom: '1px solid #B8D0D8' }}>Item campo</th>
                <th style={{ padding: '6px 10px', textAlign: 'right', fontSize: 10, color: '#4E7A8A', fontWeight: 600, textTransform: 'uppercase', borderBottom: '1px solid #B8D0D8' }}>Item NO campo</th>
                <th style={{ padding: '6px 10px', textAlign: 'right', fontSize: 10, color: '#3B2E1E', fontWeight: 600, textTransform: 'uppercase', borderBottom: '1px solid #B8D0D8' }}>Total factura</th>
              </tr></thead>
              <tbody>
                {[['Monto', montoRelacionado, montoTotalFact - montoRelacionado, 'monto_total_factura'],
                  ['IVA', ivaTotalFact * proporcion, ivaTotalFact * (1 - proporcion), 'iva_total_factura'],
                  ['Otros imp.', otrosImpTotalFact * proporcion, otrosImpTotalFact * (1 - proporcion), 'otros_imp_total_factura']].map(([lbl, campo, noCampo, k]) => (
                  <tr key={lbl}>
                    <td style={{ padding: '8px 10px', color: 'var(--tierra)', fontWeight: 500, borderBottom: '1px solid #D0E8F0' }}>{lbl}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', color: '#993C1D', fontWeight: 600, borderBottom: '1px solid #D0E8F0' }}>{campo > 0 ? campo.toLocaleString('es-AR',{minimumFractionDigits:2,maximumFractionDigits:2}) : '---'}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', color: '#4E7A8A', borderBottom: '1px solid #D0E8F0' }}>{noCampo > 0 ? noCampo.toLocaleString('es-AR',{minimumFractionDigits:2,maximumFractionDigits:2}) : '---'}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', borderBottom: '1px solid #D0E8F0' }}>
                      <div style={{ background: '#FFF9C4', border: '1px solid #E0C800', borderRadius: 5, padding: '3px 8px', display: 'inline-block' }}>
                        <input type="number" step="0.01" value={form[k]} onChange={e => f(k, e.target.value)} placeholder="Total"
                          style={{ width: 110, background: 'transparent', border: 'none', outline: 'none', fontSize: 12, fontWeight: 600, textAlign: 'right', fontFamily: 'inherit' }} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {proporcion > 0 && (
              <div style={{ marginTop: 10, padding: '7px 12px', background: 'white', borderRadius: 6, border: '1px solid #B8D0D8', fontSize: 12, color: '#2C5A6A' }}>
                Proporcion item campo: <strong>{(proporcion * 100).toFixed(1)}%</strong> del total.
              </div>
            )}
          </div>
        )}

        <div className="grid-2">
          <div className="field"><label className="label">Tipo de pago</label>{sel('tipo_pago', TIPOS_PAGO)}</div>
          {form.tipo_pago === 'Canje' && (
            <div className="field"><label className="label">Mes del canje</label>
              <SearchableSelect value={form.mes_canje} onChange={v => f('mes_canje', v)}
                options={opts.mes_canje?.length ? opts.mes_canje : MESES_CANJE}
                placeholder="Selecciona el mes" allowClear onAddNew={v => addToMaestros('mes_canje', v)} />
            </div>
          )}
          {form.tipo_pago === 'Cta Cte' && (
            <div className="field"><label className="label">Fecha a pagar</label>
              <input className="input" type="date" value={form.dia_pago} onChange={e => f('dia_pago', e.target.value)} style={{ width: '100%' }} />
            </div>
          )}
          {!['Canje','Cta Cte'].includes(form.tipo_pago) && <div />}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: form.check_pago ? 'var(--verde-light)' : '#F5F0E4', border: '1px solid', borderColor: form.check_pago ? 'var(--brote)' : 'var(--border)', borderRadius: 8, cursor: 'pointer' }}
          onClick={() => f('check_pago', !form.check_pago)}>
          <div style={{ width: 20, height: 20, borderRadius: 5, border: '1.5px solid', borderColor: form.check_pago ? 'var(--pasto)' : '#C8B89A', background: form.check_pago ? 'var(--pasto)' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {form.check_pago && <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><polyline points="2,6 5,9 10,3" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
          </div>
          <div style={{ fontSize: 13, fontWeight: 500, color: form.check_pago ? 'var(--musgo)' : 'var(--tierra)' }}>
            {form.check_pago ? 'Pagado' : 'Marcar como pagado'}
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
function AddGastoRec({ onAdd }) {
  const [nVal, setNVal] = useState('')
  const [nTipo, setNTipo] = useState('gasto_rec_producto')
  return (
    <div style={{ display: 'flex', gap: 4, marginTop: 4, borderTop: '1px solid #D8C9A8', paddingTop: 8 }}>
      <input value={nVal} onChange={e => setNVal(e.target.value)} placeholder="Ej: Nafta"
        style={{ flex: 1, padding: '4px 6px', border: '1px solid #D8C9A8', borderRadius: 5, fontSize: 11, fontFamily: 'inherit' }}/>
      <select value={nTipo} onChange={e => setNTipo(e.target.value)}
        style={{ padding: '4px 5px', border: '1px solid #D8C9A8', borderRadius: 5, fontSize: 11, fontFamily: 'inherit', background: '#FDFAF4' }}>
        <option value="gasto_rec_producto">producto</option>
        <option value="gasto_rec_proveedor">proveedor</option>
      </select>
      <button onClick={() => { if (!nVal.trim()) return; onAdd(nVal, nTipo); setNVal('') }}
        style={{ padding: '4px 8px', background: 'var(--pasto)', color: '#F5F0E4', border: 'none', borderRadius: 5, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>+</button>
    </div>
  )
}
export default function Costos({ dolares }) {
  const [costos, setCostos] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const dolar = dolares?.oficial?.venta ?? null
  const [tab, setTab] = useState('resumen')
  const [ivaMode, setIvaMode] = useState('sin')
  const [ivaMode2, setIvaMode2] = useState('sin')
  const [producto, setProducto] = useState('')

  const { user, puedeVer, puedeEditar, isAdmin } = useAuth()
  const usuario = user?.email || user?.user_metadata?.nombre || 'desconocido'
  // Puede eliminar: admin O cualquiera con acceso de edición a costos
  const puedeEliminar = isAdmin || puedeEditar('costos')

  const [fCampanha, setFCampanha] = useState([])
  const [fMes, setFMes] = useState([])
  const [campanhas, setCampanhas] = useState(CAMPANHAS_DEFAULT)
  const [fChCamp,   setFChCamp]   = useState([])
  const [fChCentro, setFChCentro] = useState([])
  const [gastosRec, setGastosRec] = useState([])
  const [fNombre, setFNombre] = useState([])
  const [fCentro, setFCentro] = useState([])
  const [fProv, setFProv] = useState([])
  const [fTipoPago, setFTipoPago] = useState([])
  const [editando, setEditando] = useState(null)
  const [busqueda, setBusqueda] = useState('')

  useEffect(() => { fetchAll() }, [])
  async function fetchAll() {
    supabase.from('maestros').select('valor').eq('tipo','campanha').eq('activo',true).order('orden').then(({data}) => { if(data?.length) setCampanhas(data.map(d=>d.valor)) })
    supabase.from('maestros').select('id,tipo,valor').in('tipo',['gasto_rec_producto','gasto_rec_proveedor']).eq('activo',true).order('orden').then(({data}) => setGastosRec(data||[]))
    setLoading(true)
    const { data } = await db.costos.list()
    setCostos(data || [])
    setLoading(false)
  }

  const match = (arr, val) => arr.length === 0 || arr.includes(val)

  const filtered = costos.filter(c => {
    if (!match(fCampanha, c.campanha)) return false
    if (!match(fMes, monthKey(c.fecha))) return false
    if (!match(fNombre, c.factura_nombre)) return false
    if (!match(fCentro, c.centro_costos)) return false
    if (!match(fProv, c.proveedor)) return false
    if (!match(fTipoPago, c.tipo_pago)) return false
    return true
  })

  const busquedaLower = busqueda.toLowerCase().trim()

  // Soporte para búsquedas por campo: "concepto:NC", "proveedor:fullagro", "tipo:canje", etc.
  const CAMPO_MAP = {
    concepto: c => c.concepto,
    proveedor: c => c.proveedor,
    producto: c => c.producto_servicio,
    centro: c => c.centro_costos,
    tipo: c => c.tipo_pago,
    factura: c => c.factura_nombre,
    campanha: c => c.campanha,
    mes: c => c.mes_canje,
    quien: c => c.quien_carga,
    moneda: c => c.moneda,
  }
  const campoMatch = busquedaLower.match(/^(\w+):(.+)$/)
  const filteredDetalle = !busquedaLower ? filtered : filtered.filter(c => {
    if (campoMatch) {
      const [, campo, valor] = campoMatch
      const getter = CAMPO_MAP[campo]
      if (getter) return String(getter(c) || '').toLowerCase().includes(valor.trim())
    }
    // Búsqueda libre en todos los campos
    return [
      c.proveedor, c.producto_servicio, c.centro_costos, c.factura_numero,
      c.tipo_pago, c.factura_nombre, c.campanha, c.mes_canje, c.comentarios,
      c.quien_carga, c.moneda, c.concepto
    ].some(v => v && String(v).toLowerCase().includes(busquedaLower)) ||
    (c.monto_usd && String(c.monto_usd).includes(busqueda)) ||
    (c.fecha && c.fecha.includes(busqueda))
  })

  const gm = c => ivaMode === 'sin'
    ? (c.precio_total_sin_iva || c.monto_usd || 0)
    : ivaMode === 'con'
    ? (c.precio_total_con_iva || c.monto_usd || 0)
    : (c.precio_total_usd || c.precio_total_con_iva || c.monto_usd || 0)

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
    .filter(c => c.producto_servicio === producto && (c.precio_por_unidad_base || c.precio_unitario))
    .sort((a, b) => a.fecha?.localeCompare(b.fecha))
    .map(c => {
      const base = c.precio_por_unidad_base || parseFloat(c.precio_unitario) || 0
      return {
        fecha: monthLabel(monthKey(c.fecha)),
        sin: base,
        con: base * (1 + (c.iva_pct || 0)),
        total: base * (1 + (c.iva_pct || 0)) + (c.otros_impuestos && c.cantidad ? c.otros_impuestos / c.cantidad : 0),
        unidad: c.unidad_base || c.unidad,
        marca: c.marca || '',
        presentacion: c.presentacion || '',
        proveedor: c.proveedor || '',
      }
    })
  const maxPr = Math.max(...preciosProd.map(p => ivaMode2 === 'sin' ? p.sin : ivaMode2 === 'con' ? p.con : p.total), 1)
  const marcasUnicas = [...new Set(preciosProd.map(p => p.marca).filter(Boolean))]
  const MARCA_COLORS = ['#4A7C3F','#7A9EAD','#C8A96E','#A0714F','#8B6B4A','#9DC87A','#B8D0D8']
  const marcaColor = (marca) => {
    const idx = marcasUnicas.indexOf(marca)
    return idx >= 0 ? MARCA_COLORS[idx % MARCA_COLORS.length] : '#4A7C3F'
  }

  const canjes = filtered.filter(c => c.tipo_pago === 'Canje')
  const canjesMes = {}
  canjes.forEach(c => { const m = c.mes_canje || 'Sin fecha'; if (!canjesMes[m]) canjesMes[m] = { total: 0, items: [] }; canjesMes[m].total += gm(c); canjesMes[m].items.push(c) })

  const ctacte = filtered.filter(c => c.tipo_pago === 'Cta Cte')
  const ctacteProv = {}
  ctacte.forEach(c => {
    const key = c.proveedor || 'Sin proveedor'
    if (!ctacteProv[key]) ctacteProv[key] = { total: 0, fer: 0, leo: 0, items: [] }
    const monto = gm(c)
    ctacteProv[key].total += monto
    if (c.factura_nombre === 'Fer') ctacteProv[key].fer += monto
    else if (c.factura_nombre === 'Leo') ctacteProv[key].leo += monto
    else if (c.factura_nombre === 'ambos') { ctacteProv[key].fer += monto/2; ctacteProv[key].leo += monto/2 }
    ctacteProv[key].items.push(c)
  })
  const ctacteProvList = Object.entries(ctacteProv).sort((a,b) => b[1].total - a[1].total)

  const activeFilters = fCampanha.length + fMes.length + fNombre.length + fCentro.length + fProv.length + fTipoPago.length

  return (
    <div>
      <style>{CSS}</style>
      <div className="flex-between mb-2">
        <div>
          <h2>Costos</h2>
          <p style={{ fontSize: 12, color: 'var(--arcilla)', marginTop: 2 }}>
            {fmtUSD(total)} · {filtered.length} de {costos.length} registros {ivaMode === 'sin' ? '(sin IVA)' : ivaMode === 'con' ? '(con IVA)' : '(con IVA + imp.)'}
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

      {showForm && <FormCosto dolar={dolar} campanhas={campanhas} onCancel={() => setShowForm(false)} onSave={async () => { setShowForm(false); await fetchAll() }} />}

      <div className="c-tabs">
        {[['resumen', 'Resumen'], ['detalle', 'Detalle'], ['precios', 'Precios unitarios'], ['canjes', 'Canjes'], ['ctacte', 'Cta Cte'], ['chequeos', 'Chequeos']].map(([id, lbl]) => (
          <button key={id} className={`c-tab${tab === id ? ' on' : ''}`} onClick={() => setTab(id)}>{lbl}</button>
        ))}
      </div>

      <div className="c-filters">
        <MultiSelect label="Campaña" options={campanhas} selected={fCampanha} onChange={setFCampanha} />
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
            <button className={`iva-b${ivaMode === 'total' ? ' on' : ''}`} onClick={() => setIvaMode('total')}>Total</button>
          </div>
        </div>
      </div>

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

      {tab === 'detalle' && (
        <div>
          <div style={{ marginBottom: 10, position: 'relative' }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="var(--arcilla)" strokeWidth="1.5" strokeLinecap="round" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
              <circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5L14 14"/>
            </svg>
            <input
              value={busqueda} onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar por proveedor, producto, N° factura... o usar concepto:NC, tipo:canje, proveedor:fullagro"
              style={{ width: '100%', padding: '9px 12px 9px 32px', border: '1px solid #D8C9A8', borderRadius: 8, fontSize: 13, background: '#FDFAF4', color: 'var(--tierra)', fontFamily: 'inherit' }}
            />
            {busqueda && (
              <button onClick={() => setBusqueda('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--arcilla)', fontSize: 16, lineHeight: 1 }}>✕</button>
            )}
          </div>
          {busqueda && <div style={{ fontSize: 11, color: 'var(--arcilla)', marginBottom: 8 }}>{filteredDetalle.length} resultado{filteredDetalle.length !== 1 ? 's' : ''} para "{busqueda}"</div>}
          <div className="c-panel" style={{ padding: 0, overflowX: 'auto' }}>
            {loading ? <div style={{ padding: 24, textAlign: 'center', fontSize: 13, color: 'var(--arcilla)' }}>Cargando...</div>
              : filteredDetalle.length === 0 ? <div style={{ padding: 24, textAlign: 'center', fontSize: 13, color: 'var(--arcilla)' }}>Sin registros con estos filtros</div>
                : <table className="c-tbl">
                  <thead><tr>
                    <th>Fecha</th><th>Campaña</th><th>Concepto</th><th>Proveedor</th><th>Producto / Servicio</th><th style={{textAlign:'right'}}>Cantidad</th><th style={{background:'#EBF4E8',color:'#2E4F26',whiteSpace:'nowrap'}}>P/unidad base</th><th style={{background:'#EBF4E8',color:'#2E4F26'}}>Unid. base</th>
                    <th>Centro</th><th>N° Factura</th><th>Factura</th>
                    <th>Sin IVA (USD)</th><th>IVA (USD)</th><th>Con IVA (USD)</th><th>Otros imp. (USD)</th><th>Total (USD)</th>
                    <th>Sin IVA (ARS)</th><th>Con IVA (ARS)</th><th>Otros imp. (ARS)</th><th>Total (ARS)</th>
                    <th>Cotiz.</th><th>Moneda</th><th>Tipo pago</th><th>Mes canje</th>
                    <th>Fecha pago</th><th>Pagado</th><th>Quién</th><th>Comentarios</th><th></th>
                  </tr></thead>
                  <tbody>
                    {filteredDetalle.map(c => {
                      const isEdit = editando === c.id
                      return isEdit ? (
                        <EditRow key={c.id} costo={c}
                          puedeEliminar={puedeEliminar}
                          usuario={usuario}
                          onSave={async (updated) => {
                            const cleanVal = v => (v === '' || v === undefined) ? null : v
                            const cleanNum = v => { const n = parseFloat(v); return isNaN(n) ? null : n }
                            const payload = {
                              ...updated,
                              precio_unitario:       cleanNum(updated.precio_unitario),
                              cantidad:              cleanNum(updated.cantidad),
                              precio_por_unidad_base: cleanNum(updated.precio_por_unidad_base),
                              unidad_base:           updated.unidad_base || null,
                              unidad:                updated.unidad || null,
                              cotizacion_usd:        cleanNum(updated.cotizacion_usd),
                              iva_pct:               updated.iva_pct ?? 0,
                              dia_pago:              cleanVal(updated.dia_pago),
                              mes_canje:             cleanVal(updated.mes_canje),
                              cheque_emitido:        cleanVal(updated.cheque_emitido),
                            }
                            const { error } = await db.costos.update(c.id, payload)
                            if (error) {
                              alert('❌ Error al guardar: ' + (error.message || JSON.stringify(error)))
                              return
                            }
                            // Propagar precio_por_unidad_base al almacen_movimientos vinculado
                            if (payload.precio_por_unidad_base && payload.precio_por_unidad_base > 0) {
                              const { data: movs } = await supabase
                                .from('almacen_movimientos')
                                .select('id,cantidad,unidad')
                                .eq('costo_id', c.id)
                              if (movs?.length) {
                                for (const mov of movs) {
                                  const cant = parseFloat(mov.cantidad) || 0
                                  await supabase.from('almacen_movimientos').update({
                                    precio_unitario: payload.precio_por_unidad_base,
                                    precio_total:    cant > 0 ? parseFloat((cant * payload.precio_por_unidad_base).toFixed(2)) : null,
                                  }).eq('id', mov.id)
                                }
                              }
                            }
                            setEditando(null)
                            await fetchAll()
                          }}
                          onDelete={async (id, quien) => {
                            const result = await db.costos.eliminar(id, quien)
                            if (result?.error) {
                              alert('❌ Error al eliminar: ' + (result.error?.message || JSON.stringify(result.error)))
                              return
                            }
                            setEditando(null)
                            await fetchAll()
                          }}
                          onCancel={() => setEditando(null)} />
                      ) : (
                        <tr key={c.id}>
                          <td style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{c.fecha ? new Date(c.fecha + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'}</td>
                          <td style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{c.campanha || '—'}</td>
                          <td><span className="cc chip-muted" style={{ whiteSpace:'nowrap', background: c.concepto==='NC'?'#E4F0F4':c.concepto==='ND'?'#F5EDD8':'#EFECE4', color: c.concepto==='NC'?'#2C5A6A':c.concepto==='ND'?'#6B3E22':'#7A6040' }}>{c.concepto||'Compra'}</span></td>
                          <td style={{ fontWeight: 500, whiteSpace: 'nowrap' }}>{c.proveedor}</td>
                          <td style={{ color: 'var(--suelo)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.producto_servicio}</td>
                          <td style={{ fontFamily:'monospace', whiteSpace:'nowrap', color:'var(--musgo)', fontSize:11 }}>{c.precio_unitario ? Number(c.precio_unitario).toLocaleString('es-AR',{minimumFractionDigits:2,maximumFractionDigits:2}) : '\u2014'}</td>
                          <td style={{ color:'var(--text-muted)', fontSize:11, whiteSpace:'nowrap' }}>{c.unidad||'\u2014'}</td>
                          <td style={{ fontFamily:'monospace', whiteSpace:'nowrap', fontSize:11, textAlign:'right', color:'var(--suelo)' }}>{c.cantidad ? Number(c.cantidad).toLocaleString('es-AR',{minimumFractionDigits:1,maximumFractionDigits:1}) : '\u2014'}</td>
                          <td style={{ background:'#F0F7EE', fontFamily:'monospace', fontSize:11, whiteSpace:'nowrap', color:'#2E4F26' }}>{c.precio_por_unidad_base ? Number(c.precio_por_unidad_base).toLocaleString('es-AR',{minimumFractionDigits:4,maximumFractionDigits:4}) : '\u2014'}</td>
                          <td style={{ background:'#F0F7EE', fontSize:11, color:'#2E4F26' }}>{c.unidad_base||'\u2014'}</td>
                          <td><span className="cc chip-muted" style={{ whiteSpace: 'nowrap' }}>{c.centro_costos}</span></td>
                          <td style={{ color: 'var(--text-muted)', fontSize: 11, whiteSpace: 'nowrap' }}>{c.factura_numero || '—'}</td>
                          <td><span className={`cc ${CHIP[c.factura_nombre] || 'chip-muted'}`}>{c.factura_nombre}</span></td>
                          <td style={{ fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{fmtUSD(c.precio_total_sin_iva || c.monto_usd)}</td>
                          <td style={{ fontFamily: 'monospace', whiteSpace: 'nowrap', color: 'var(--arcilla)' }}>{fmtUSD(c.monto_iva || c.valor_total_iva_usd)}</td>
                          <td style={{ fontFamily: 'monospace', whiteSpace: 'nowrap', color: 'var(--arcilla)' }}>{fmtUSD(c.precio_total_con_iva)}</td>
                          <td style={{ fontFamily: 'monospace', whiteSpace: 'nowrap', color: c.otros_impuestos > (c.precio_total_con_iva * 2) ? '#993C1D' : c.otros_impuestos ? 'var(--cielo)' : 'var(--text-muted)' }}>
                            {c.otros_impuestos ? <span title={c.otros_impuestos > (c.precio_total_con_iva * 2) ? '⚠ Valor sospechoso — puede estar en ARS' : ''}>{c.otros_impuestos > (c.precio_total_con_iva * 2) ? '⚠ ' : ''}{fmtUSD(c.otros_impuestos)}</span> : '—'}
                          </td>
                          <td style={{ fontFamily: 'monospace', whiteSpace: 'nowrap', fontWeight: 600, color: 'var(--tierra)' }}>
                            {fmtUSD(c.precio_total_usd || c.precio_total_con_iva || c.monto_usd)}
                          </td>
                          <td style={{ fontFamily: 'monospace', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>{c.precio_total_sin_iva_ars ? c.precio_total_sin_iva_ars.toLocaleString('es-AR', {minimumFractionDigits:2,maximumFractionDigits:2}) : '—'}</td>
                          <td style={{ fontFamily: 'monospace', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>{c.precio_total_con_iva_ars ? c.precio_total_con_iva_ars.toLocaleString('es-AR', {minimumFractionDigits:2,maximumFractionDigits:2}) : '—'}</td>
                          <td style={{ fontFamily: 'monospace', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>{c.valor_total_otros_imp_ars ? c.valor_total_otros_imp_ars.toLocaleString('es-AR', {minimumFractionDigits:2,maximumFractionDigits:2}) : '—'}</td>
                          <td style={{ fontFamily: 'monospace', whiteSpace: 'nowrap', color: 'var(--text-muted)', fontWeight: 500 }}>{c.precio_total_ars ? c.precio_total_ars.toLocaleString('es-AR', {minimumFractionDigits:2,maximumFractionDigits:2}) : '—'}</td>
                          <td style={{ color: 'var(--text-muted)', fontSize: 11, whiteSpace: 'nowrap' }}>{c.cotizacion_usd ? `${Math.round(c.cotizacion_usd).toLocaleString('es-AR')}` : '—'}</td>
                          <td style={{ color: 'var(--text-muted)', fontSize: 11 }}>{c.moneda}</td>
                          <td style={{ color: 'var(--cielo)', whiteSpace: 'nowrap' }}>{c.tipo_pago}</td>
                          <td>{c.mes_canje ? <span className="canje-b">{c.mes_canje}</span> : <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>—</span>}</td>
                          <td style={{ color: 'var(--text-muted)', fontSize: 11, whiteSpace: 'nowrap' }}>{c.dia_pago ? new Date(c.dia_pago + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'}</td>
                          <td>
                            <div onClick={async () => { await db.costos.update(c.id, { check_pago: !c.check_pago }); await fetchAll() }}
                              style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <div style={{ width: 18, height: 18, borderRadius: 4, border: '1.5px solid', borderColor: c.check_pago ? 'var(--pasto)' : '#C8B89A', background: c.check_pago ? 'var(--pasto)' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {c.check_pago && <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><polyline points="2,6 5,9 10,3" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                              </div>
                            </div>
                          </td>
                          <td style={{ color: 'var(--text-muted)', fontSize: 11 }}>{c.quien_carga}</td>
                          <td style={{ color: 'var(--text-muted)', fontSize: 11, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.comentarios}>{c.comentarios || '—'}</td>
                          <td>
                            <button onClick={() => setEditando(c.id)} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 5, padding: '3px 8px', fontSize: 11, cursor: 'pointer', color: 'var(--arcilla)', whiteSpace: 'nowrap' }}>
                              Editar
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>}
          </div>
        </div>
      )}

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
                <button className={`iva-b${ivaMode2 === 'total' ? ' on' : ''}`} onClick={() => setIvaMode2('total')}>Total</button>
              </div>
            </div>
          </div>
          <div className="c-panel">
            {!producto ? <div style={{ textAlign: 'center', padding: 32, fontSize: 13, color: 'var(--arcilla)' }}>Seleccioná un producto para ver la evolución de precios</div>
              : preciosProd.length === 0 ? <div style={{ textAlign: 'center', padding: 32, fontSize: 13, color: 'var(--arcilla)' }}>No hay registros con precio unitario para "{producto}"</div>
                : <>
                  <div className="c-pt">
                    {producto} {preciosProd[0]?.unidad ? `— precio por ${preciosProd[0].unidad}` : ''} {ivaMode2 === 'sin' ? '(sin IVA)' : ivaMode2 === 'con' ? '(con IVA)' : '(con IVA + otros imp.)'}
                  </div>
                  {marcasUnicas.length > 0 && (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                      {marcasUnicas.map(m => (
                        <div key={m} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--arcilla)' }}>
                          <div style={{ width: 10, height: 10, borderRadius: 3, background: marcaColor(m) }} />
                          {m}
                        </div>
                      ))}
                      {preciosProd.some(p => !p.marca) && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-muted)' }}>
                          <div style={{ width: 10, height: 10, borderRadius: 3, background: '#4A7C3F' }} />
                          Sin marca
                        </div>
                      )}
                    </div>
                  )}
                  {preciosProd.length > 1 && (() => {
                    const mejor = preciosProd.reduce((a, b) => (ivaMode2==='sin'?a.sin:ivaMode2==='con'?a.con:a.total) <= (ivaMode2==='sin'?b.sin:ivaMode2==='con'?b.con:b.total) ? a : b)
                    return (
                      <div style={{ marginBottom: 12, padding: '7px 12px', background: 'var(--verde-light)', border: '1px solid var(--brote)', borderRadius: 7, fontSize: 12, color: 'var(--musgo)', display: 'flex', gap: 6, alignItems: 'center' }}>
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><polyline points="2,6 5,9 10,3" stroke="#2E4F26" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        Mejor precio: <strong>{mejor.fecha}</strong>
                        {mejor.marca && <> · <strong>{mejor.marca}</strong></>}
                        {mejor.proveedor && <> · {mejor.proveedor}</>}
                        · <strong>U$S {(ivaMode2==='sin'?mejor.sin:ivaMode2==='con'?mejor.con:mejor.total).toFixed(4)}/{mejor.unidad}</strong>
                      </div>
                    )
                  })()}
                  {preciosProd.map((p, i) => {
                    const val = ivaMode2 === 'sin' ? p.sin : ivaMode2 === 'con' ? p.con : p.total
                    const prev = i > 0 ? (ivaMode2 === 'sin' ? preciosProd[i - 1].sin : ivaMode2 === 'con' ? preciosProd[i - 1].con : preciosProd[i - 1].total) : null
                    const diff = prev ? ((val - prev) / prev * 100) : null
                    const col = marcaColor(p.marca)
                    return <div className="pr-row" key={i}>
                      <div className="pr-date">{p.fecha}</div>
                      <div style={{ width: 80, flexShrink: 0, fontSize: 11 }}>
                        {p.marca ? (
                          <span style={{ background: col + '22', color: col, border: `1px solid ${col}66`, borderRadius: 20, padding: '1px 7px', fontSize: 10, fontWeight: 500 }}>{p.marca}</span>
                        ) : (
                          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{p.proveedor?.slice(0,10)}</span>
                        )}
                      </div>
                      <div className="pr-bw"><div className="pr-bf" style={{ width: `${val / maxPr * 100}%`, background: col }}>U$S {val.toFixed(4)}</div></div>
                      <div className="pr-diff" style={{ color: diff === null ? 'var(--text-muted)' : diff > 0 ? '#A0714F' : '#4A7C3F' }}>
                        {diff !== null ? `${diff > 0 ? '+' : ''}${diff.toFixed(1)}%` : ''}
                      </div>
                    </div>
                  })}
                </>}
          </div>
        </div>
      )}

      {tab === 'canjes' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 10, marginBottom: 16 }}>
            <div className="c-stat">
              <div className="c-sl">Total canjes</div>
              <div className="c-sv">{fmtUSD(canjes.reduce((a,b) => a+gm(b), 0), 0)}</div>
              <div className="c-ss">{canjes.length} facturas</div>
              <div className="c-sbar"><div className="c-sfill" style={{ width: '100%', background: '#C8A96E' }}/></div>
            </div>
            <div className="c-stat">
              <div className="c-sl">Fer</div>
              <div className="c-sv">{fmtUSD(canjes.filter(c=>c.factura_nombre==='Fer'||c.factura_nombre==='ambos').reduce((a,b)=>a+gm(b)/(b.factura_nombre==='ambos'?2:1),0), 0)}</div>
              <div className="c-ss">a nombre de Fer</div>
              <div className="c-sbar"><div className="c-sfill" style={{ width: '60%', background: '#6A9E58' }}/></div>
            </div>
            <div className="c-stat">
              <div className="c-sl">Leo</div>
              <div className="c-sv">{fmtUSD(canjes.filter(c=>c.factura_nombre==='Leo'||c.factura_nombre==='ambos').reduce((a,b)=>a+gm(b)/(b.factura_nombre==='ambos'?2:1),0), 0)}</div>
              <div className="c-ss">a nombre de Leo</div>
              <div className="c-sbar"><div className="c-sfill" style={{ width: '50%', background: '#C8A96E' }}/></div>
            </div>
          </div>

          {Object.keys(canjesMes).length === 0
            ? <div className="c-panel" style={{ textAlign: 'center', fontSize: 13, color: 'var(--arcilla)' }}>No hay canjes con los filtros actuales</div>
            : Object.entries(canjesMes)
              .sort((a, b) => {
                const ia = MESES_CANJE.indexOf(a[0]), ib = MESES_CANJE.indexOf(b[0])
                return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib)
              })
              .map(([mes, { total: t, items }]) => {
                const provs = {}
                items.forEach(c => {
                  const p = c.proveedor || 'Sin proveedor'
                  if (!provs[p]) provs[p] = { total: 0, fer: 0, leo: 0, ambos: 0 }
                  const m = gm(c)
                  provs[p].total += m
                  if (c.factura_nombre === 'Fer') provs[p].fer += m
                  else if (c.factura_nombre === 'Leo') provs[p].leo += m
                  else if (c.factura_nombre === 'ambos') { provs[p].fer += m/2; provs[p].leo += m/2; provs[p].ambos += m }
                })
                const totalFerMes = items.filter(c=>c.factura_nombre==='Fer'||c.factura_nombre==='ambos').reduce((a,b)=>a+gm(b)/(b.factura_nombre==='ambos'?2:1),0)
                const totalLeoMes = items.filter(c=>c.factura_nombre==='Leo'||c.factura_nombre==='ambos').reduce((a,b)=>a+gm(b)/(b.factura_nombre==='ambos'?2:1),0)

                return (
                  <div key={mes} className="c-panel" style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span className="canje-b" style={{ fontSize: 13, padding: '4px 12px' }}>{mes}</span>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{items.length} factura{items.length !== 1 ? 's' : ''}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                        {totalFerMes > 0 && <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 10, color: '#3B6D11', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Fer</div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: '#2E4F26' }}>{fmtUSD(totalFerMes, 0)}</div>
                        </div>}
                        {totalLeoMes > 0 && <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 10, color: '#854F0B', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Leo</div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: '#6B3E22' }}>{fmtUSD(totalLeoMes, 0)}</div>
                        </div>}
                        <div style={{ textAlign: 'right', paddingLeft: 12, borderLeft: '1px solid #EDE0C8' }}>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total</div>
                          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--tierra)' }}>{fmtUSD(t, 0)}</div>
                        </div>
                      </div>
                    </div>
                    {Object.entries(provs).sort((a,b) => b[1].total - a[1].total).map(([prov, data]) => (
                      <div key={prov} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: '#FAF7F0', borderRadius: 7, marginBottom: 6 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--tierra)' }}>{prov}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                            {items.filter(c => c.proveedor === prov).map(c => c.producto_servicio).filter(Boolean).join(' · ')}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexShrink: 0 }}>
                          {data.fer > 0 && <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 9, color: '#3B6D11', fontWeight: 600, textTransform: 'uppercase' }}>Fer</div>
                            <div style={{ fontSize: 12, fontWeight: 500, color: '#2E4F26' }}>{fmtUSD(data.fer, 0)}</div>
                          </div>}
                          {data.leo > 0 && <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 9, color: '#854F0B', fontWeight: 600, textTransform: 'uppercase' }}>Leo</div>
                            <div style={{ fontSize: 12, fontWeight: 500, color: '#6B3E22' }}>{fmtUSD(data.leo, 0)}</div>
                          </div>}
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--tierra)', minWidth: 80, textAlign: 'right' }}>{fmtUSD(data.total, 0)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              })}
        </div>
      )}

      {tab === 'ctacte' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 10, marginBottom: 16 }}>
            <div className="c-stat">
              <div className="c-sl">Total cta cte</div>
              <div className="c-sv">{fmtUSD(ctacte.reduce((a,b) => a+gm(b), 0), 0)}</div>
              <div className="c-ss">{ctacte.length} facturas</div>
              <div className="c-sbar"><div className="c-sfill" style={{ width: '100%', background: 'var(--cielo)' }}/></div>
            </div>
            <div className="c-stat">
              <div className="c-sl">Sin pagar</div>
              <div className="c-sv">{fmtUSD(ctacte.filter(c=>!c.check_pago).reduce((a,b)=>a+gm(b),0), 0)}</div>
              <div className="c-ss">{ctacte.filter(c=>!c.check_pago).length} pendientes</div>
              <div className="c-sbar"><div className="c-sfill" style={{ width: '70%', background: '#A0714F' }}/></div>
            </div>
            <div className="c-stat">
              <div className="c-sl">Pagado</div>
              <div className="c-sv">{fmtUSD(ctacte.filter(c=>c.check_pago).reduce((a,b)=>a+gm(b),0), 0)}</div>
              <div className="c-ss">{ctacte.filter(c=>c.check_pago).length} facturas</div>
              <div className="c-sbar"><div className="c-sfill" style={{ width: '30%', background: 'var(--pasto)' }}/></div>
            </div>
          </div>

          {ctacteProvList.length === 0
            ? <div className="c-panel" style={{ textAlign: 'center', fontSize: 13, color: 'var(--arcilla)' }}>No hay facturas en cuenta corriente</div>
            : ctacteProvList.map(([prov, data]) => {
              const pendiente = data.items.filter(c => !c.check_pago).reduce((a,b) => a+gm(b), 0)
              const pagado    = data.items.filter(c =>  c.check_pago).reduce((a,b) => a+gm(b), 0)
              return (
                <div key={prov} className="c-panel" style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--tierra)', marginBottom: 4 }}>{prov}</div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {pendiente > 0 && <span style={{ background: '#FAECE7', border: '1px solid #F0997B', borderRadius: 6, padding: '2px 8px', fontSize: 11, color: '#993C1D', fontWeight: 500 }}>
                          Pendiente: {fmtUSD(pendiente, 0)}
                        </span>}
                        {pagado > 0 && <span style={{ background: 'var(--verde-light)', border: '1px solid var(--brote)', borderRadius: 6, padding: '2px 8px', fontSize: 11, color: 'var(--musgo)', fontWeight: 500 }}>
                          Pagado: {fmtUSD(pagado, 0)}
                        </span>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexShrink: 0 }}>
                      {data.fer > 0 && <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 10, color: '#3B6D11', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Fer</div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#2E4F26' }}>{fmtUSD(data.fer, 0)}</div>
                      </div>}
                      {data.leo > 0 && <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 10, color: '#854F0B', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Leo</div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#6B3E22' }}>{fmtUSD(data.leo, 0)}</div>
                      </div>}
                      <div style={{ textAlign: 'right', paddingLeft: 12, borderLeft: '1px solid #EDE0C8' }}>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total</div>
                        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--tierra)' }}>{fmtUSD(data.total, 0)}</div>
                      </div>
                    </div>
                  </div>
                  {data.items.sort((a,b) => (a.dia_pago||'').localeCompare(b.dia_pago||'')).map(c => (
                    <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: c.check_pago ? '#F0F7EE' : '#FAF7F0', borderRadius: 7, marginBottom: 5, borderLeft: `3px solid ${c.check_pago ? 'var(--pasto)' : '#F0997B'}` }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{c.fecha ? new Date(c.fecha+'T12:00:00').toLocaleDateString('es-AR',{day:'2-digit',month:'short',year:'2-digit'}) : '—'}</span>
                          <span style={{ fontSize: 12, color: 'var(--suelo)' }}>{c.producto_servicio}</span>
                          {c.factura_numero && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.factura_numero}</span>}
                        </div>
                        <div style={{ display: 'flex', gap: 8, marginTop: 3, alignItems: 'center' }}>
                          <span className={`cc ${CHIP[c.factura_nombre]||'chip-muted'}`}>{c.factura_nombre}</span>
                          {c.dia_pago && <span style={{ fontSize: 11, color: c.check_pago ? 'var(--pasto)' : '#993C1D', fontWeight: 500 }}>
                            Vence: {new Date(c.dia_pago+'T12:00:00').toLocaleDateString('es-AR',{day:'2-digit',month:'short',year:'2-digit'})}
                          </span>}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--tierra)' }}>{fmtUSD(gm(c), 0)}</div>
                        </div>
                        <div onClick={async () => { await db.costos.update(c.id, { check_pago: !c.check_pago }); await fetchAll() }}
                          style={{ cursor: 'pointer' }}>
                          <div style={{ width: 20, height: 20, borderRadius: 5, border: '1.5px solid', borderColor: c.check_pago ? 'var(--pasto)' : '#C8B89A', background: c.check_pago ? 'var(--pasto)' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {c.check_pago && <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><polyline points="2,6 5,9 10,3" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            })}
        </div>
      )}

      {/* ─────────── CHEQUEOS ─────────── */}
      {tab === 'chequeos' && (() => {

        // ── A: Gastos recurrentes (lista editable desde maestros) ────────────
        const chequeoRec = gastosRec.map(({ id, valor, tipo }) => {
          const esProd = tipo === 'gasto_rec_producto'
          const registros = costos.filter(c =>
            esProd ? c.producto_servicio === valor : c.proveedor === valor
          )
          if (registros.length === 0) return { id, valor, tipo, esProd, rango: [], faltantes: [], presentes: new Set() }
          const primerMes = registros.map(c => c.fecha?.slice(0,7)).filter(Boolean).sort()[0]
          const mesHoy    = new Date().toISOString().slice(0,7)
          const rango = []
          let cur = new Date(primerMes + '-01T12:00:00')
          const fin = new Date(mesHoy   + '-01T12:00:00')
          while (cur <= fin) {
            rango.push(cur.toISOString().slice(0,7))
            cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1)
          }
          const presentes = new Set(registros.map(c => c.fecha?.slice(0,7)).filter(Boolean))
          const faltantes = rango.filter(m => !presentes.has(m))
          return { id, valor, tipo, esProd, rango, faltantes, presentes }
        })

        // ── B: Fer vs Leo ────────────────────────────────────────────────────
        const CAMPANHAS_OPT = [...new Set(costos.map(c => c.campanha).filter(Boolean))].sort().reverse()
        const CENTROS_OPT   = [...new Set(costos.map(c => c.centro_costos).filter(Boolean))].sort()

        const costosFiltB = costos.filter(c => {
          if (fChCamp.length   > 0 && !fChCamp.includes(c.campanha))      return false
          if (fChCentro.length > 0 && !fChCentro.includes(c.centro_costos)) return false
          return true
        })

        // Usar la misma funcion gm del resumen (respeta ivaMode y campo correcto)
        const gmB = c => ivaMode === 'sin'
          ? (c.precio_total_sin_iva || c.monto_usd || 0)
          : ivaMode === 'con'
          ? (c.precio_total_con_iva || c.monto_usd || 0)
          : (c.precio_total_usd || c.precio_total_con_iva || c.monto_usd || 0)

        const porProveedor = {}
        costosFiltB.forEach(c => {
          const prov  = c.proveedor || 'Sin proveedor'
          if (!porProveedor[prov]) porProveedor[prov] = { fer: 0, leo: 0, otro: 0, total: 0, n: 0 }
          const monto = gmB(c)
          const nom   = c.factura_nombre
          // 'ambos' se divide 50/50 igual que en el resumen
          if (nom === 'Fer' || nom === 'ambos') porProveedor[prov].fer  += monto / (nom === 'ambos' ? 2 : 1)
          if (nom === 'Leo' || nom === 'ambos') porProveedor[prov].leo  += monto / (nom === 'ambos' ? 2 : 1)
          if (nom !== 'Fer' && nom !== 'Leo' && nom !== 'ambos') porProveedor[prov].otro += monto
          porProveedor[prov].total += monto
          porProveedor[prov].n     += 1
        })
        const provRows  = Object.entries(porProveedor).map(([prov, d]) => ({ prov, ...d })).filter(d => d.total > 0).sort((a, b) => b.total - a.total)
        const totalFer  = provRows.reduce((a, r) => a + r.fer,  0)
        const totalLeo  = provRows.reduce((a, r) => a + r.leo,  0)
        const totalOtro = provRows.reduce((a, r) => a + r.otro, 0)
        const grandTotal = provRows.reduce((a, r) => a + r.total, 0)
        const maxTotal  = Math.max(...provRows.map(r => r.total), 1)
        const fmt = v => v > 0 ? 'U$S ' + v.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : '—'

        // ── helpers edicion recurrentes ─────────────────────────────────────
        async function addRec(valor, tipo) {
          if (!valor.trim()) return
          await supabase.from('maestros').insert({ tipo, valor: valor.trim(), activo: true, orden: 99 })
          await fetchAll()
        }
        async function removeRec(id) {
          if (!confirm('¿Quitar este gasto de la lista?')) return
          await supabase.from('maestros').delete().eq('id', id)
          await fetchAll()
        }

        return (
          <div>
            {/* ── Gastos recurrentes ── */}
            <div className="card mb-3">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                <div>
                  <h3 style={{ margin: 0 }}>Gastos recurrentes</h3>
                  <p style={{ fontSize: 11, color: 'var(--arcilla)', marginTop: 4 }}>Verificación mes a mes desde el primer registro</p>
                </div>
                {/* Panel edición lista */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 260, background: '#F5F0E8', border: '1px solid #D8C9A8', borderRadius: 10, padding: '10px 12px' }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: '#A08060', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Lista a controlar</div>
                  {gastosRec.map(g => (
                    <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ flex: 1, fontSize: 12, color: 'var(--tierra)' }}>{g.valor}</span>
                      <span style={{ fontSize: 10, background: g.tipo === 'gasto_rec_producto' ? '#EBF4E8' : '#E4F0F4', color: g.tipo === 'gasto_rec_producto' ? '#2E4F26' : '#2C5A6A', borderRadius: 20, padding: '1px 6px' }}>
                        {g.tipo === 'gasto_rec_producto' ? 'producto' : 'proveedor'}
                      </span>
                      <button onClick={() => removeRec(g.id)}
                        style={{ background: '#FAECE7', border: '1px solid #F0997B', borderRadius: 4, padding: '2px 6px', fontSize: 11, cursor: 'pointer', color: '#993C1D' }}>✕</button>
                    </div>
                  ))}
                  {/* Agregar nuevo */}
                  <AddGastoRec onAdd={addRec} />
                </div>
              </div>

              <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {chequeoRec.map(({ id, valor, esProd, rango, faltantes, presentes }) => {
                  const ok = faltantes.length === 0
                  return (
                    <div key={id} style={{ padding: '12px 14px', borderRadius: 10, border: '1px solid', borderColor: ok ? '#9DC87A' : '#F0997B', background: ok ? '#F4FAF0' : '#FEF3EF' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: 16 }}>{ok ? '✅' : '⚠️'}</span>
                          <span style={{ fontSize: 13, fontWeight: 600, color: ok ? '#2E4F26' : '#993C1D' }}>{valor}</span>
                          <span style={{ fontSize: 10, background: esProd ? '#EBF4E8' : '#E4F0F4', color: esProd ? '#2E4F26' : '#2C5A6A', borderRadius: 20, padding: '1px 6px' }}>
                            {esProd ? 'producto' : 'proveedor'}
                          </span>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{presentes.size} meses registrados</span>
                        </div>
                        {ok
                          ? <span style={{ fontSize: 11, fontWeight: 600, color: '#2E4F26', background: '#EBF4E8', borderRadius: 20, padding: '3px 10px' }}>Al día ✓</span>
                          : <span style={{ fontSize: 11, fontWeight: 600, color: '#993C1D', background: '#FAECE7', borderRadius: 20, padding: '3px 10px' }}>{faltantes.length} mes{faltantes.length > 1 ? 'es' : ''} faltante{faltantes.length > 1 ? 's' : ''}</span>
                        }
                      </div>
                      {!ok && (
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                          {faltantes.map(m => (
                            <span key={m} style={{ fontSize: 11, background: '#FAECE7', border: '1px solid #F0997B', borderRadius: 6, padding: '2px 8px', color: '#993C1D' }}>
                              {new Date(m + '-01T12:00:00').toLocaleDateString('es-AR', { month: 'short', year: '2-digit' })}
                            </span>
                          ))}
                        </div>
                      )}
                      {rango.length > 0 && (
                        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                          {rango.map(m => (
                            <div key={m} title={new Date(m + '-01T12:00:00').toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}
                              style={{ width: 22, height: 12, borderRadius: 2, background: presentes.has(m) ? '#4A7C3F' : '#F0997B', opacity: presentes.has(m) ? 0.85 : 1 }}/>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
                {chequeoRec.length === 0 && (
                  <div style={{ textAlign: 'center', padding: 24, fontSize: 13, color: 'var(--arcilla)' }}>
                    Agregá gastos a la lista para controlarlos
                  </div>
                )}
              </div>
            </div>

            {/* ── Fer vs Leo por proveedor ── */}
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <h3 style={{ marginBottom: 4 }}>Gastos por proveedor — Fer vs Leo</h3>
                  <p style={{ fontSize: 11, color: 'var(--arcilla)' }}>Comparación por factura a nombre</p>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: '#A08060', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Campaña</div>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {CAMPANHAS_OPT.map(c => (
                        <button key={c} onClick={() => setFChCamp(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])}
                          style={{ padding: '4px 9px', borderRadius: 6, fontSize: 11, cursor: 'pointer', border: '1px solid', fontFamily: 'inherit',
                            background: fChCamp.includes(c) ? '#4A7C3F' : 'transparent',
                            color: fChCamp.includes(c) ? '#F5F0E4' : 'var(--arcilla)',
                            borderColor: fChCamp.includes(c) ? '#4A7C3F' : '#D8C9A8' }}>
                          {c}
                        </button>
                      ))}
                      {fChCamp.length > 0 && (
                        <button onClick={() => setFChCamp([])}
                          style={{ padding: '4px 9px', borderRadius: 6, fontSize: 11, cursor: 'pointer', border: '1px solid #D8C9A8', background: 'transparent', color: 'var(--arcilla)', fontFamily: 'inherit' }}>✕</button>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: '#A08060', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Centro de costo</div>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', maxWidth: 500 }}>
                      {CENTROS_OPT.map(c => (
                        <button key={c} onClick={() => setFChCentro(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])}
                          style={{ padding: '4px 9px', borderRadius: 6, fontSize: 11, cursor: 'pointer', border: '1px solid', fontFamily: 'inherit', whiteSpace: 'nowrap',
                            background: fChCentro.includes(c) ? '#7A9EAD' : 'transparent',
                            color: fChCentro.includes(c) ? '#fff' : 'var(--arcilla)',
                            borderColor: fChCentro.includes(c) ? '#7A9EAD' : '#D8C9A8' }}>
                          {c}
                        </button>
                      ))}
                      {fChCentro.length > 0 && (
                        <button onClick={() => setFChCentro([])}
                          style={{ padding: '4px 9px', borderRadius: 6, fontSize: 11, cursor: 'pointer', border: '1px solid #D8C9A8', background: 'transparent', color: 'var(--arcilla)', fontFamily: 'inherit' }}>✕</button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Totales */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 10, marginBottom: 16 }}>
                {[
                  ['Fer',   fmt(totalFer),   (totalFer / (grandTotal || 1) * 100).toFixed(0) + '%', '#4A7C3F', '#EBF4E8'],
                  ['Leo',   fmt(totalLeo),   (totalLeo / (grandTotal || 1) * 100).toFixed(0) + '%', '#C8A96E', '#FAF5EC'],
                  ['Total', fmt(grandTotal), provRows.length + ' proveedores',                       '#2C5A6A', '#E4F0F4'],
                ].map(([lbl, val, sub, col, bg]) => (
                  <div key={lbl} style={{ background: bg, border: '1px solid ' + col + '44', borderRadius: 10, padding: '12px 14px' }}>
                    <div style={{ fontSize: 11, color: col, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{lbl}</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: col }}>{val}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>
                  </div>
                ))}
              </div>

              {/* Tabla */}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: '#EDE0C8' }}>
                      <th style={{ padding: '8px 10px', textAlign: 'left',  fontSize: 10, fontWeight: 600, color: '#A08060', textTransform: 'uppercase' }}>Proveedor</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right', fontSize: 10, fontWeight: 600, color: '#4A7C3F', textTransform: 'uppercase' }}>Fer</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right', fontSize: 10, fontWeight: 600, color: '#C8A96E', textTransform: 'uppercase' }}>Leo</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right', fontSize: 10, fontWeight: 600, color: '#A08060', textTransform: 'uppercase' }}>Otro</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right', fontSize: 10, fontWeight: 600, color: '#2C5A6A', textTransform: 'uppercase' }}>Total</th>
                      <th style={{ padding: '8px 10px', textAlign: 'left',  fontSize: 10, fontWeight: 600, color: '#A08060', textTransform: 'uppercase' }}>Distribución</th>
                    </tr>
                  </thead>
                  <tbody>
                    {provRows.map((r, i) => {
                      const pctFer = r.total > 0 ? r.fer / r.total * 100 : 0
                      const pctLeo = r.total > 0 ? r.leo / r.total * 100 : 0
                      return (
                        <tr key={r.prov} style={{ borderBottom: '1px solid #EDE0C8', background: i % 2 === 0 ? '#FDFAF4' : 'white' }}>
                          <td style={{ padding: '8px 10px', fontWeight: 500, color: 'var(--tierra)' }}>{r.prov}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace', color: r.fer > 0 ? '#2E4F26' : 'var(--text-muted)' }}>{fmt(r.fer)}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace', color: r.leo > 0 ? '#6B3E22' : 'var(--text-muted)' }}>{fmt(r.leo)}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-muted)' }}>{fmt(r.otro)}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: '#2C5A6A' }}>{fmt(r.total)}</td>
                          <td style={{ padding: '8px 10px', minWidth: 120 }}>
                            <div style={{ height: 8, background: '#E8D5A3', borderRadius: 4, overflow: 'hidden', display: 'flex' }}>
                              <div style={{ height: 8, background: '#4A7C3F', width: pctFer + '%', opacity: 0.85 }} title={'Fer: ' + Math.round(pctFer) + '%'} />
                              <div style={{ height: 8, background: '#C8A96E', width: pctLeo + '%', opacity: 0.85 }} title={'Leo: ' + Math.round(pctLeo) + '%'} />
                            </div>
                            <div style={{ display: 'flex', gap: 8, marginTop: 2, fontSize: 10, color: 'var(--text-muted)' }}>
                              {r.fer > 0 && <span style={{ color: '#2E4F26' }}>F:{Math.round(pctFer)}%</span>}
                              {r.leo > 0 && <span style={{ color: '#6B3E22' }}>L:{Math.round(pctLeo)}%</span>}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: '#EDE0C8', fontWeight: 700 }}>
                      <td style={{ padding: '10px', fontSize: 11 }}>{provRows.length} proveedores</td>
                      <td style={{ padding: '10px', textAlign: 'right', fontFamily: 'monospace', color: '#2E4F26' }}>{fmt(totalFer)}</td>
                      <td style={{ padding: '10px', textAlign: 'right', fontFamily: 'monospace', color: '#6B3E22' }}>{fmt(totalLeo)}</td>
                      <td style={{ padding: '10px', textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-muted)' }}>{fmt(totalOtro)}</td>
                      <td style={{ padding: '10px', textAlign: 'right', fontFamily: 'monospace', color: '#2C5A6A' }}>{fmt(grandTotal)}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}



