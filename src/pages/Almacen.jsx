import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

const UNIDADES = ['L','cc','kg','g','unidad']
const TIPO_MOV = { stock_inicial:'Stock inicial', compra:'Compra', salida_aplicacion:'Salida aplicación', ajuste:'Ajuste' }
const COL_MOV  = { stock_inicial:'#7A9EAD', compra:'#4A7C3F', salida_aplicacion:'#C8A96E', ajuste:'#A08060' }

function fmtFecha(f) {
  if (!f) return '—'
  return new Date(f+'T12:00:00').toLocaleDateString('es-AR',{day:'2-digit',month:'short',year:'2-digit'})
}
function fmtNum(v, dec=0) {
  if (v == null || v === '') return '—'
  return Number(v).toLocaleString('es-AR',{minimumFractionDigits:dec,maximumFractionDigits:dec})
}

// ── Buscar EIQ via IA + web search ───────────────────────────────────────────
async function buscarEiqIA(producto, marca) {
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{
          role: 'user',
          content: `Search the Cornell University EIQ database or pesticide safety databases for the EIQ (Environmental Impact Quotient) value of the active ingredient "${producto}"${marca ? ' (brand: ' + marca + ')' : ''}. Respond ONLY with JSON: {"eiq": number_or_null, "fuente": "source reference"}. Use null if not found.`
        }]
      })
    })
    const data = await res.json()
    const txt = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('')
    const match = txt.match(/\{"eiq"[^}]+\}/)
    if (match) return JSON.parse(match[0])
  } catch(e) {}
  return null
}

// ── Buscar precio en costos ───────────────────────────────────────────────────
async function buscarPrecioEnCostos(producto) {
  const palabras = producto.toLowerCase().split(/[\s,+]+/).filter(p => p.length > 3)
  const { data } = await supabase
    .from('costos')
    .select('id,fecha,precio_total_sin_iva,precio_total_usd,proveedor,producto_servicio')
    .ilike('producto_servicio', `%${palabras[0]}%`)
    .not('precio_total_sin_iva', 'is', null)
    .order('fecha', { ascending: false })
    .limit(6)
  return data || []
}

// ── FilaCatalogo — edición inline ─────────────────────────────────────────────
function FilaCatalogo({ prod, onSave, onDelete }) {
  const [editando, setEditando] = useState(false)
  const [form, setForm] = useState({ producto: prod.producto, marca: prod.marca||'', unidad: prod.unidad||'L', eiq: prod.eiq||'', eiq_fuente: prod.eiq_fuente||'' })
  const [saving, setSaving] = useState(false)
  const [buscandoEiq, setBuscandoEiq] = useState(false)
  const [preciosSug, setPreciosSug] = useState([])
  const [buscandoPrecio, setBuscandoPrecio] = useState(false)
  const [showPrecios, setShowPrecios] = useState(false)
  const f = (k,v) => setForm(p=>({...p,[k]:v}))

  async function handleBuscarEiq() {
    setBuscandoEiq(true)
    const result = await buscarEiqIA(form.producto, form.marca)
    if (result?.eiq) { f('eiq', result.eiq); f('eiq_fuente', result.fuente || 'web') }
    else f('eiq_fuente', 'No encontrado')
    setBuscandoEiq(false)
  }

  async function handleBuscarPrecio() {
    setBuscandoPrecio(true)
    const data = await buscarPrecioEnCostos(form.producto)
    setPreciosSug(data)
    setShowPrecios(true)
    setBuscandoPrecio(false)
  }

  async function handleSave() {
    setSaving(true)
    await supabase.from('almacen_productos').update({
      producto: form.producto, marca: form.marca||null, unidad: form.unidad,
      eiq: form.eiq ? parseFloat(form.eiq) : null, eiq_fuente: form.eiq_fuente||null,
    }).eq('id', prod.id)
    setSaving(false); setEditando(false); onSave()
  }

  const si = { padding:'5px 8px', border:'1px solid #D8C9A8', borderRadius:6, fontSize:12, fontFamily:'inherit', background:'#FDFAF4' }

  if (!editando) return (
    <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', marginBottom:6, background:'#FDFAF4', border:'1px solid #D8C9A8', borderRadius:10 }}>
      <div style={{ flex:1 }}>
        <div style={{ fontWeight:600, color:'var(--tierra)', fontSize:13 }}>
          {prod.producto}
          {prod.marca && <span style={{ fontWeight:400, color:'var(--arcilla)', fontSize:12 }}> · {prod.marca}</span>}
          <span style={{ fontSize:10, background:'#EDE0C8', borderRadius:20, padding:'1px 7px', marginLeft:8, color:'#7A6040' }}>{prod.unidad}</span>
        </div>
        <div style={{ display:'flex', gap:12, marginTop:3, flexWrap:'wrap' }}>
          {prod.eiq
            ? <span style={{ fontSize:11, color:'#2C5A6A', background:'#E4F0F4', borderRadius:20, padding:'1px 7px' }}>EIQ: {prod.eiq}{prod.eiq_fuente && <span style={{color:'#4E7A8A'}}> ({prod.eiq_fuente})</span>}</span>
            : <span style={{ fontSize:11, color:'var(--text-muted)' }}>Sin EIQ</span>
          }
        </div>
      </div>
      <button onClick={() => setEditando(true)}
        style={{ background:'transparent', border:'1px solid var(--border)', borderRadius:6, padding:'4px 10px', fontSize:11, cursor:'pointer', color:'var(--arcilla)', fontFamily:'inherit' }}>
        Editar
      </button>
      <button onClick={() => { if(confirm('¿Desactivar este producto?')) onDelete(prod.id) }}
        style={{ background:'#FAECE7', border:'1px solid #F0997B', borderRadius:6, padding:'4px 10px', fontSize:11, cursor:'pointer', color:'#993C1D', fontFamily:'inherit' }}>
        ✕
      </button>
    </div>
  )

  // Modo edición inline
  return (
    <div style={{ padding:'12px 14px', marginBottom:6, background:'#FFF9EE', border:'1px solid #C8A96E', borderRadius:10 }}>
      <div style={{ display:'flex', gap:8, marginBottom:8, flexWrap:'wrap' }}>
        <input value={form.producto} onChange={e=>f('producto',e.target.value)}
          style={{ ...si, flex:2, minWidth:140 }} placeholder="Principio activo"/>
        <input value={form.marca} onChange={e=>f('marca',e.target.value)}
          style={{ ...si, flex:1, minWidth:100 }} placeholder="Marca"/>
        <select value={form.unidad} onChange={e=>f('unidad',e.target.value)} style={{ ...si, width:70 }}>
          {UNIDADES.map(u=><option key={u}>{u}</option>)}
        </select>
      </div>

      {/* EIQ */}
      <div style={{ display:'flex', gap:6, alignItems:'center', marginBottom:8, flexWrap:'wrap' }}>
        <span style={{ fontSize:11, color:'#2C5A6A', flexShrink:0 }}>EIQ:</span>
        <input type="number" step="0.1" value={form.eiq} onChange={e=>f('eiq',e.target.value)}
          style={{ ...si, width:80 }} placeholder="—"/>
        <input value={form.eiq_fuente} onChange={e=>f('eiq_fuente',e.target.value)}
          style={{ ...si, flex:1, minWidth:100, fontSize:11 }} placeholder="Fuente del EIQ"/>
        <button type="button" onClick={handleBuscarEiq} disabled={buscandoEiq}
          style={{ padding:'5px 9px', background:'#E4F0F4', border:'1px solid #7A9EAD', borderRadius:6, fontSize:11, cursor:'pointer', color:'#2C5A6A', fontFamily:'inherit', whiteSpace:'nowrap' }}>
          {buscandoEiq ? '⏳' : '🌐 Buscar EIQ'}
        </button>
      </div>

      {/* Precio en costos */}
      <div style={{ marginBottom:8 }}>
        <button type="button" onClick={handleBuscarPrecio} disabled={buscandoPrecio}
          style={{ padding:'5px 9px', background:'#F5F0E8', border:'1px solid #D8C9A8', borderRadius:6, fontSize:11, cursor:'pointer', color:'var(--arcilla)', fontFamily:'inherit' }}>
          {buscandoPrecio ? '⏳ Buscando...' : '💰 Ver precio en costos'}
        </button>
        {showPrecios && preciosSug.length > 0 && (
          <div style={{ marginTop:6, display:'flex', flexDirection:'column', gap:3 }}>
            {preciosSug.map((c,i)=>(
              <div key={i} style={{ display:'flex', alignItems:'center', gap:8, background:'white', borderRadius:5, padding:'5px 8px', border:'1px solid #E8D5A3', fontSize:11 }}>
                <span style={{ color:'var(--text-muted)', flexShrink:0 }}>{c.fecha}</span>
                <span style={{ flex:1, color:'var(--tierra)', fontWeight:500 }}>{c.producto_servicio}</span>
                <span style={{ color:'var(--arcilla)', flexShrink:0 }}>{c.proveedor}</span>
                <span style={{ fontWeight:600, color:'#2E4F26', flexShrink:0 }}>U$S {fmtNum(c.precio_total_sin_iva,2)}</span>
              </div>
            ))}
            <div style={{ fontSize:10, color:'var(--text-muted)' }}>Dividí el total por la cantidad para obtener precio/unidad</div>
          </div>
        )}
        {showPrecios && preciosSug.length === 0 && (
          <span style={{ fontSize:11, color:'var(--text-muted)', marginLeft:8 }}>Sin facturas encontradas</span>
        )}
      </div>

      <div style={{ display:'flex', gap:6 }}>
        <button onClick={handleSave} disabled={saving}
          style={{ padding:'5px 12px', background:'var(--pasto)', color:'#F5F0E4', border:'none', borderRadius:6, fontSize:11, cursor:'pointer', fontFamily:'inherit' }}>
          {saving ? 'Guardando...' : '✓ Guardar'}
        </button>
        <button onClick={() => setEditando(false)}
          style={{ padding:'5px 12px', background:'transparent', border:'1px solid var(--border)', borderRadius:6, fontSize:11, cursor:'pointer', fontFamily:'inherit' }}>
          Cancelar
        </button>
      </div>
    </div>
  )
}

// ── FormMovimiento ────────────────────────────────────────────────────────────
function FormMovimiento({ tipo, productos, costos, quienRegistra, onSave, onCancel }) {
  const isCompra = tipo === 'compra'
  const isStock  = tipo === 'stock_inicial'
  const [form, setForm] = useState({
    fecha: new Date().toISOString().split('T')[0],
    producto_id: '', producto: '', marca: '', cantidad: '',
    unidad: 'L', precio_unitario: '', precio_total: '',
    proveedor: '', costo_id: '', observaciones: '',
  })
  const [saving, setSaving] = useState(false)
  const f = (k,v) => setForm(p => {
    const next = {...p,[k]:v}
    if (k === 'cantidad' || k === 'precio_unitario') {
      const c = parseFloat(k==='cantidad'?v:next.cantidad)||0
      const pu = parseFloat(k==='precio_unitario'?v:next.precio_unitario)||0
      if (c > 0 && pu > 0) next.precio_total = (c*pu).toFixed(2)
    }
    if (k === 'precio_total' && next.cantidad) {
      const c = parseFloat(next.cantidad)||0
      if (c > 0) next.precio_unitario = (parseFloat(v)/c).toFixed(4)
    }
    if (k === 'producto_id') {
      const prod = productos.find(p=>p.id===v)
      if (prod) { next.producto = prod.producto; next.marca = prod.marca||''; next.unidad = prod.unidad||'L' }
    }
    return next
  })

  async function save(e) {
    e.preventDefault(); setSaving(true)
    await supabase.from('almacen_movimientos').insert({
      fecha: form.fecha, tipo,
      producto_id: form.producto_id || null,
      producto: form.producto, marca: form.marca,
      cantidad: parseFloat(form.cantidad),
      unidad: form.unidad,
      precio_unitario: form.precio_unitario ? parseFloat(form.precio_unitario) : null,
      precio_total: form.precio_total ? parseFloat(form.precio_total) : null,
      proveedor: form.proveedor || null,
      costo_id: form.costo_id || null,
      observaciones: form.observaciones || null,
      quien_registro: quienRegistra,
    })
    setSaving(false); onSave()
  }

  const si = {padding:'7px 10px',border:'1px solid #D8C9A8',borderRadius:7,fontSize:13,fontFamily:'inherit',width:'100%',background:'#FDFAF4'}
  const titulos = { stock_inicial:'Ingreso de stock inicial', compra:'Remito de compra' }
  const colors  = { stock_inicial:'#E4F0F4', compra:'#F0F7EE' }
  const borders = { stock_inicial:'#7A9EAD', compra:'#9DC87A' }

  return (
    <div className="card mb-3" style={{background:colors[tipo],borderColor:borders[tipo]}}>
      <h3 style={{marginBottom:14}}>{titulos[tipo]}</h3>
      <form onSubmit={save} style={{display:'flex',flexDirection:'column',gap:12}}>
        <div className="grid-2">
          <div className="field"><label className="label">Fecha</label>
            <input style={si} type="date" value={form.fecha} onChange={e=>f('fecha',e.target.value)} required/>
          </div>
          <div className="field"><label className="label">Producto (del catálogo)</label>
            <select style={si} value={form.producto_id} onChange={e=>f('producto_id',e.target.value)}>
              <option value="">— Seleccionar o escribir abajo —</option>
              {productos.map(p=><option key={p.id} value={p.id}>{p.producto}{p.marca?' · '+p.marca:''}</option>)}
            </select>
          </div>
        </div>
        <div className="grid-2">
          <div className="field"><label className="label">Principio activo</label>
            <input style={si} value={form.producto} onChange={e=>f('producto',e.target.value)} required placeholder="Ej: Glifosato"/>
          </div>
          <div className="field"><label className="label">Marca</label>
            <input style={si} value={form.marca} onChange={e=>f('marca',e.target.value)} placeholder="Ej: Roundup"/>
          </div>
        </div>
        <div className="grid-2">
          <div className="field"><label className="label">Cantidad</label>
            <div style={{display:'flex',gap:6}}>
              <input style={{...si,flex:1}} type="number" step="0.01" value={form.cantidad} onChange={e=>f('cantidad',e.target.value)} required placeholder="0"/>
              <select style={{...si,width:90,flexShrink:0}} value={form.unidad} onChange={e=>f('unidad',e.target.value)}>
                {UNIDADES.map(u=><option key={u}>{u}</option>)}
              </select>
            </div>
          </div>
          {(isCompra||isStock) && (
            <div className="field"><label className="label">Precio unitario (USD sin IVA)</label>
              <input style={si} type="number" step="0.001" value={form.precio_unitario} onChange={e=>f('precio_unitario',e.target.value)} placeholder="0.000"/>
            </div>
          )}
        </div>
        {(isCompra||isStock) && (
          <div className="grid-2">
            <div className="field"><label className="label">Precio total (USD sin IVA)</label>
              <input style={si} type="number" step="0.01" value={form.precio_total} onChange={e=>f('precio_total',e.target.value)} placeholder="0.00"/>
            </div>
            {isCompra && (
              <div className="field"><label className="label">Proveedor</label>
                <input style={si} value={form.proveedor} onChange={e=>f('proveedor',e.target.value)} placeholder="Ej: Tecnocampo"/>
              </div>
            )}
          </div>
        )}
        {isCompra && (
          <div className="field"><label className="label">Factura relacionada <span style={{fontWeight:400,color:'var(--text-muted)'}}>— opcional</span></label>
            <select style={si} value={form.costo_id} onChange={e=>f('costo_id',e.target.value)}>
              <option value="">— Sin factura por ahora —</option>
              {costos.slice(0,50).map(c=>(
                <option key={c.id} value={c.id}>{c.fecha} · {c.proveedor} · {c.producto_servicio}</option>
              ))}
            </select>
          </div>
        )}
        <div className="field"><label className="label">Observaciones</label>
          <input style={si} value={form.observaciones} onChange={e=>f('observaciones',e.target.value)} placeholder="Notas adicionales..."/>
        </div>
        <div style={{display:'flex',gap:8}}>
          <button className="btn btn-primary" type="submit" disabled={saving}>{saving?'Guardando...':'Guardar'}</button>
          <button className="btn btn-secondary" type="button" onClick={onCancel}>Cancelar</button>
        </div>
      </form>
    </div>
  )
}

// ── Almacén principal ─────────────────────────────────────────────────────────
export default function Almacen() {
  const { user, puedeEditar, isAdmin } = useAuth()
  const canEdit = isAdmin || puedeEditar('almacen')
  const quien = user?.user_metadata?.nombre || user?.email || ''

  const [tab, setTab]             = useState('stock')
  const [productos, setProductos] = useState([])
  const [movs, setMovs]           = useState([])
  const [costos, setCostos]       = useState([])
  const [loading, setLoading]     = useState(true)

  const [showFormProd, setShowFormProd]   = useState(false)
  const [showFormMov, setShowFormMov]     = useState(null)

  const [fProd, setFProd] = useState('')

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [{ data: prods }, { data: ms }, { data: cs }] = await Promise.all([
      supabase.from('almacen_productos').select('*').eq('activo', true).order('producto'),
      supabase.from('almacen_movimientos').select('*').order('fecha', { ascending: false }),
      supabase.from('costos').select('id,fecha,proveedor,producto_servicio,precio_total_sin_iva,precio_total_usd').order('fecha', { ascending: false }).limit(200),
    ])
    setProductos(prods || [])
    setMovs(ms || [])
    setCostos(cs || [])
    setLoading(false)
  }

  async function deleteMov(id) {
    if (!confirm('¿Eliminar este movimiento?')) return
    await supabase.from('almacen_movimientos').delete().eq('id', id)
    await fetchAll()
  }

  async function vincularFactura(movId, costoId) {
    await supabase.from('almacen_movimientos').update({ costo_id: costoId || null }).eq('id', movId)
    await fetchAll()
  }

  async function desactivarProd(id) {
    await supabase.from('almacen_productos').update({ activo: false }).eq('id', id)
    await fetchAll()
  }

  // ── Stock actual por producto ─────────────────────────────────────────────
  const stockPorProducto = {}
  movs.forEach(m => {
    const key = m.producto_id || (m.producto + '|' + (m.marca||''))
    if (!stockPorProducto[key]) stockPorProducto[key] = {
      producto: m.producto, marca: m.marca, unidad: m.unidad,
      cantidad: 0, valorTotal: 0, movs: [], producto_id: m.producto_id
    }
    const s = stockPorProducto[key]
    const esSalida = m.tipo === 'salida_aplicacion'
    const esNegativo = m.tipo === 'ajuste' && m.cantidad < 0
    s.cantidad   += esSalida ? -Math.abs(m.cantidad) : m.cantidad
    s.valorTotal += (esSalida || esNegativo) ? 0 : (m.precio_total || 0)
    s.movs.push(m)
  })

  const stockRows = Object.entries(stockPorProducto)
    .map(([k,v]) => ({ key: k, ...v }))
    .sort((a,b) => a.producto.localeCompare(b.producto))
    .filter(r => !fProd || r.producto.toLowerCase().includes(fProd.toLowerCase()) || r.marca?.toLowerCase().includes(fProd.toLowerCase()))

  const movsFiltrados = movs.filter(m => !fProd ||
    m.producto?.toLowerCase().includes(fProd.toLowerCase()) ||
    m.marca?.toLowerCase().includes(fProd.toLowerCase())
  )

  const prodsFiltrados = productos.filter(p => !fProd ||
    p.producto.toLowerCase().includes(fProd.toLowerCase()) ||
    p.marca?.toLowerCase().includes(fProd.toLowerCase())
  )

  const TABS = [['stock','Stock actual'],['movimientos','Movimientos'],['catalogo','Catálogo']]

  return (
    <div>
      {/* Header */}
      <div className="flex-between mb-2">
        <div>
          <h2>Almacén</h2>
          <p style={{fontSize:12,color:'var(--arcilla)',marginTop:2}}>
            {stockRows.length} productos · {movs.length} movimientos
          </p>
        </div>
        {canEdit && tab === 'stock' && (
          <div style={{display:'flex',gap:6}}>
            <button className="btn btn-secondary btn-sm" onClick={()=>setShowFormMov('stock_inicial')}>+ Stock inicial</button>
            <button className="btn btn-primary btn-sm" onClick={()=>setShowFormMov('compra')}>+ Remito compra</button>
          </div>
        )}
        {canEdit && tab === 'catalogo' && (
          <button className="btn btn-primary btn-sm" onClick={()=>setShowFormProd(v=>!v)}>
            {showFormProd ? 'Cancelar' : '+ Nuevo producto'}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={{display:'flex',gap:4,marginBottom:16,borderBottom:'1px solid #D8C9A8'}}>
        {TABS.map(([id,lbl])=>(
          <button key={id} onClick={()=>setTab(id)}
            style={{padding:'8px 16px',fontSize:12,cursor:'pointer',borderRadius:'8px 8px 0 0',border:'1px solid transparent',borderBottom:'none',
              fontFamily:'inherit',marginBottom:-1,
              background:tab===id?'#FDFAF4':'transparent',
              borderColor:tab===id?'#D8C9A8':'transparent',
              color:tab===id?'#3B2E1E':'#A08060',fontWeight:tab===id?500:400}}>
            {lbl}
          </button>
        ))}
      </div>

      {/* Buscador */}
      <div style={{position:'relative',marginBottom:14}}>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="var(--arcilla)" strokeWidth="1.5" strokeLinecap="round"
          style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',pointerEvents:'none'}}>
          <circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5L14 14"/>
        </svg>
        <input value={fProd} onChange={e=>setFProd(e.target.value)} placeholder="Buscar por producto o marca..."
          style={{width:'100%',padding:'8px 12px 8px 32px',border:'1px solid #D8C9A8',borderRadius:8,fontSize:13,background:'#FDFAF4',fontFamily:'inherit'}}/>
        {fProd && <button onClick={()=>setFProd('')} style={{position:'absolute',right:8,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',color:'var(--arcilla)',fontSize:16}}>✕</button>}
      </div>

      {/* Form movimiento */}
      {showFormMov && canEdit && (
        <FormMovimiento
          tipo={showFormMov} productos={productos} costos={costos}
          quienRegistra={quien}
          onSave={async()=>{ setShowFormMov(null); await fetchAll() }}
          onCancel={()=>setShowFormMov(null)}
        />
      )}

      {/* Form nuevo producto */}
      {showFormProd && canEdit && tab === 'catalogo' && (
        <FilaCatalogo
          prod={{ producto:'', marca:'', unidad:'L', eiq:'', eiq_fuente:'' }}
          onSave={async()=>{ setShowFormProd(false); await fetchAll() }}
          onDelete={()=>setShowFormProd(false)}
          isNew
        />
      )}

      {/* ── TAB STOCK ── */}
      {tab === 'stock' && (
        <div>
          {loading ? <div style={{padding:32,textAlign:'center',color:'var(--arcilla)'}}>Cargando...</div>
          : stockRows.length === 0 ? <div style={{padding:32,textAlign:'center',color:'var(--arcilla)'}}>Sin stock registrado</div>
          : (
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))',gap:12}}>
              {stockRows.map(r => {
                const prod = productos.find(p=>p.id===r.producto_id)
                const eiq  = prod?.eiq
                const entradasMovs = r.movs.filter(m=>m.tipo!=='salida_aplicacion'&&m.tipo!=='ajuste')
                const totalEntradas = entradasMovs.reduce((a,m)=>a+m.cantidad,0)
                const precioMedio = totalEntradas > 0 && r.valorTotal > 0 ? r.valorTotal / totalEntradas : null
                return (
                  <div key={r.key} style={{
                    background: r.cantidad <= 0 ? '#FEF3EF' : '#FDFAF4',
                    border:`1px solid ${r.cantidad <= 0 ? '#F0997B' : '#D8C9A8'}`,
                    borderLeft:`3px solid ${r.cantidad <= 0 ? '#F0997B' : '#4A7C3F'}`,
                    borderRadius:10, padding:'14px 16px'
                  }}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8}}>
                      <div>
                        <div style={{fontSize:14,fontWeight:600,color:'var(--tierra)'}}>{r.producto}</div>
                        {r.marca && <div style={{fontSize:11,color:'var(--arcilla)'}}>{r.marca}</div>}
                      </div>
                      {eiq && (
                        <div style={{textAlign:'right',background:'#E4F0F4',borderRadius:8,padding:'4px 8px'}}>
                          <div style={{fontSize:9,color:'#2C5A6A',textTransform:'uppercase',letterSpacing:'0.05em'}}>EIQ</div>
                          <div style={{fontSize:14,fontWeight:700,color:'#2C5A6A'}}>{eiq}</div>
                        </div>
                      )}
                    </div>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-end'}}>
                      <div>
                        <div style={{fontSize:24,fontWeight:700,color:r.cantidad<=0?'#993C1D':'#2E4F26'}}>
                          {fmtNum(r.cantidad,1)} <span style={{fontSize:13,fontWeight:400,color:'var(--text-muted)'}}>{r.unidad}</span>
                        </div>
                        {r.cantidad <= 0 && <div style={{fontSize:11,color:'#993C1D',fontWeight:600}}>⚠ Sin stock</div>}
                      </div>
                      {precioMedio && (
                        <div style={{textAlign:'right'}}>
                          <div style={{fontSize:10,color:'var(--text-muted)'}}>Precio medio</div>
                          <div style={{fontSize:12,fontWeight:500,color:'var(--tierra)'}}>U$S {fmtNum(precioMedio,3)}/{r.unidad}</div>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── TAB MOVIMIENTOS ── */}
      {tab === 'movimientos' && (
        <div className="card" style={{padding:0,overflowX:'auto'}}>
          {loading ? <div style={{padding:32,textAlign:'center'}}>Cargando...</div>
          : movsFiltrados.length === 0 ? <div style={{padding:32,textAlign:'center',color:'var(--arcilla)'}}>Sin movimientos</div>
          : (
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
              <thead>
                <tr style={{background:'#EDE0C8'}}>
                  <th style={{padding:'8px 10px',textAlign:'left',fontSize:10,fontWeight:600,color:'#A08060',textTransform:'uppercase'}}>Fecha</th>
                  <th style={{padding:'8px 10px',textAlign:'left',fontSize:10,fontWeight:600,color:'#A08060',textTransform:'uppercase'}}>Tipo</th>
                  <th style={{padding:'8px 10px',textAlign:'left',fontSize:10,fontWeight:600,color:'#A08060',textTransform:'uppercase'}}>Producto · Marca</th>
                  <th style={{padding:'8px 10px',textAlign:'right',fontSize:10,fontWeight:600,color:'#A08060',textTransform:'uppercase'}}>Cantidad</th>
                  <th style={{padding:'8px 10px',textAlign:'right',fontSize:10,fontWeight:600,color:'#A08060',textTransform:'uppercase'}}>P. unitario</th>
                  <th style={{padding:'8px 10px',textAlign:'right',fontSize:10,fontWeight:600,color:'#A08060',textTransform:'uppercase'}}>Total USD</th>
                  <th style={{padding:'8px 10px',textAlign:'left',fontSize:10,fontWeight:600,color:'#A08060',textTransform:'uppercase'}}>Proveedor</th>
                  <th style={{padding:'8px 10px',textAlign:'left',fontSize:10,fontWeight:600,color:'#A08060',textTransform:'uppercase'}}>Factura</th>
                  {canEdit && <th></th>}
                </tr>
              </thead>
              <tbody>
                {movsFiltrados.map((m,i)=>(
                  <tr key={m.id} style={{borderBottom:'1px solid #EDE0C8',background:i%2===0?'#FDFAF4':'white'}}>
                    <td style={{padding:'8px 10px',color:'var(--text-muted)',whiteSpace:'nowrap'}}>{fmtFecha(m.fecha)}</td>
                    <td style={{padding:'8px 10px'}}>
                      <span style={{fontSize:10,background:(COL_MOV[m.tipo]||'#888')+'22',color:COL_MOV[m.tipo]||'#888',borderRadius:20,padding:'2px 7px',fontWeight:600}}>
                        {TIPO_MOV[m.tipo]||m.tipo}
                      </span>
                    </td>
                    <td style={{padding:'8px 10px'}}>
                      <div style={{fontWeight:500,color:'var(--tierra)'}}>{m.producto}</div>
                      {m.marca && <div style={{fontSize:11,color:'var(--arcilla)'}}>{m.marca}</div>}
                    </td>
                    <td style={{padding:'8px 10px',textAlign:'right',fontFamily:'monospace',fontWeight:600,
                      color:m.tipo==='salida_aplicacion'||m.cantidad<0?'#993C1D':'#2E4F26'}}>
                      {m.cantidad < 0 ? '' : m.tipo==='salida_aplicacion' ? '-' : '+'}
                      {fmtNum(Math.abs(m.cantidad),1)} {m.unidad}
                    </td>
                    <td style={{padding:'8px 10px',textAlign:'right',fontFamily:'monospace',color:'var(--text-muted)'}}>
                      {m.precio_unitario ? 'U$S '+fmtNum(m.precio_unitario,3) : '—'}
                    </td>
                    <td style={{padding:'8px 10px',textAlign:'right',fontFamily:'monospace',fontWeight:500,color:'var(--musgo)'}}>
                      {m.precio_total ? 'U$S '+fmtNum(m.precio_total,0) : '—'}
                    </td>
                    <td style={{padding:'8px 10px',color:'var(--suelo)'}}>{m.proveedor||'—'}</td>
                    <td style={{padding:'8px 10px'}}>
                      {m.costo_id
                        ? <span style={{fontSize:11,background:'#EBF4E8',color:'#2E4F26',borderRadius:20,padding:'2px 7px'}}>✓ Vinculada</span>
                        : m.tipo==='compra' && canEdit
                          ? <select onChange={e=>vincularFactura(m.id,e.target.value)}
                              style={{fontSize:11,padding:'2px 4px',border:'1px solid #D8C9A8',borderRadius:4,color:'var(--arcilla)',background:'#FDFAF4',fontFamily:'inherit'}}>
                              <option value="">Sin factura</option>
                              {costos.slice(0,30).map(c=><option key={c.id} value={c.id}>{c.fecha} · {c.proveedor}</option>)}
                            </select>
                          : <span style={{fontSize:11,color:'var(--text-muted)'}}>—</span>
                      }
                    </td>
                    {canEdit && (
                      <td style={{padding:'8px 10px'}}>
                        <button onClick={()=>deleteMov(m.id)}
                          style={{background:'#FAECE7',border:'1px solid #F0997B',borderRadius:5,padding:'3px 8px',fontSize:11,cursor:'pointer',color:'#993C1D'}}>
                          🗑
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── TAB CATÁLOGO ── */}
      {tab === 'catalogo' && (
        <div>
          {prodsFiltrados.length === 0 && (
            <div style={{padding:32,textAlign:'center',color:'var(--arcilla)'}}>
              Sin productos en el catálogo. Usá el botón + para agregar.
            </div>
          )}
          {prodsFiltrados.map(p => (
            <FilaCatalogo
              key={p.id}
              prod={p}
              onSave={fetchAll}
              onDelete={desactivarProd}
            />
          ))}
        </div>
      )}
    </div>
  )
}
