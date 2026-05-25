import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

const UNIDADES = ['L','cc','kg','g','unidad']
const CULTIVOS = ['Soja','Maíz','Trigo','Girasol','Sorgo','Barbecho']
const TIPO_MOV = { stock_inicial:'Stock inicial', compra:'Compra', salida_aplicacion:'Salida aplicación' }
const COL_MOV  = { stock_inicial:'#7A9EAD', compra:'#4A7C3F', salida_aplicacion:'#C8A96E' }

function fmtFecha(f) {
  if (!f) return '—'
  return new Date(f+'T12:00:00').toLocaleDateString('es-AR',{day:'2-digit',month:'short',year:'2-digit'})
}
function fmtNum(v, dec=0) {
  if (v == null || v === '') return '—'
  return Number(v).toLocaleString('es-AR',{minimumFractionDigits:dec,maximumFractionDigits:dec})
}

// ── FormProducto ─────────────────────────────────────────────────────────────
function FormProducto({ prod, onSave, onCancel }) {
  const isEdit = !!prod
  const [form, setForm] = useState(prod ? {
    producto: prod.producto, marca: prod.marca||'', unidad: prod.unidad||'L',
    eiq: prod.eiq||'', eiq_fuente: prod.eiq_fuente||''
  } : { producto:'', marca:'', unidad:'L', eiq:'', eiq_fuente:'' })
  const [saving, setSaving] = useState(false)
  const [buscandoEiq, setBuscandoEiq] = useState(false)
  const f = (k,v) => setForm(p=>({...p,[k]:v}))

  async function buscarEiq() {
    if (!form.producto) return
    setBuscandoEiq(true)
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          model:'claude-sonnet-4-20250514', max_tokens:300,
          messages:[{ role:'user', content:`¿Cuál es el EIQ (Environmental Impact Quotient) del principio activo "${form.producto}"${form.marca?' (marca: '+form.marca+')':''}? Responde SOLO con un JSON: {"eiq": número, "fuente": "texto breve de referencia"}. Si no lo conocés con certeza responde {"eiq": null, "fuente": "no encontrado"}.` }]
        })
      })
      const data = await res.json()
      const txt = data.content?.[0]?.text || ''
      const match = txt.match(/\{[^}]+\}/)
      if (match) {
        const obj = JSON.parse(match[0])
        if (obj.eiq) { f('eiq', obj.eiq); f('eiq_fuente', obj.fuente || 'IA') }
        else f('eiq_fuente', 'No encontrado')
      }
    } catch(e) { f('eiq_fuente','Error al buscar') }
    setBuscandoEiq(false)
  }

  async function save(e) {
    e.preventDefault(); setSaving(true)
    const payload = { ...form, eiq: form.eiq ? parseFloat(form.eiq) : null }
    if (isEdit) await supabase.from('almacen_productos').update(payload).eq('id', prod.id)
    else await supabase.from('almacen_productos').insert(payload)
    setSaving(false); onSave()
  }

  const si = { padding:'7px 10px', border:'1px solid #D8C9A8', borderRadius:7, fontSize:13, fontFamily:'inherit', width:'100%', background:'#FDFAF4' }

  return (
    <div className="card mb-3" style={{background:'#F5F9F0',borderColor:'#9DC87A'}}>
      <h3 style={{marginBottom:14}}>{isEdit?'Editar producto':'Nuevo producto'}</h3>
      <form onSubmit={save} style={{display:'flex',flexDirection:'column',gap:12}}>
        <div className="grid-2">
          <div className="field"><label className="label">Principio activo / Producto</label>
            <input style={si} value={form.producto} onChange={e=>f('producto',e.target.value)} required placeholder="Ej: Glifosato, 2-4D..."/>
          </div>
          <div className="field"><label className="label">Marca comercial</label>
            <input style={si} value={form.marca} onChange={e=>f('marca',e.target.value)} placeholder="Ej: Roundup, Banvel..."/>
          </div>
        </div>
        <div className="grid-2">
          <div className="field"><label className="label">Unidad de medida</label>
            <div style={{display:'flex',gap:5}}>
              {UNIDADES.map(u=>(
                <button key={u} type="button" onClick={()=>f('unidad',u)}
                  style={{flex:1,padding:'7px 0',borderRadius:6,fontSize:12,cursor:'pointer',border:'1px solid',fontFamily:'inherit',
                    background:form.unidad===u?'var(--pasto)':'transparent',
                    color:form.unidad===u?'#F5F0E4':'var(--arcilla)',
                    borderColor:form.unidad===u?'var(--pasto)':'var(--border)'}}>
                  {u}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <label className="label">EIQ <span style={{fontWeight:400,color:'var(--text-muted)'}}>— coeficiente de impacto ambiental</span></label>
            <div style={{display:'flex',gap:6}}>
              <input style={{...si,flex:1}} type="number" step="0.1" value={form.eiq} onChange={e=>f('eiq',e.target.value)} placeholder="Ej: 15.3"/>
              <button type="button" onClick={buscarEiq} disabled={buscandoEiq||!form.producto}
                style={{padding:'7px 12px',background:'#E4F0F4',border:'1px solid #7A9EAD',borderRadius:7,fontSize:12,cursor:'pointer',color:'#2C5A6A',fontFamily:'inherit',whiteSpace:'nowrap'}}>
                {buscandoEiq?'Buscando...':'🔍 Buscar EIQ'}
              </button>
            </div>
            {form.eiq_fuente && <div style={{fontSize:10,color:'var(--text-muted)',marginTop:3}}>{form.eiq_fuente}</div>}
          </div>
        </div>
        <div style={{display:'flex',gap:8}}>
          <button className="btn btn-primary" type="submit" disabled={saving}>{saving?'Guardando...':isEdit?'Guardar cambios':'Agregar producto'}</button>
          <button className="btn btn-secondary" type="button" onClick={onCancel}>Cancelar</button>
        </div>
      </form>
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
    // Calcular precio total automáticamente
    if (k === 'cantidad' || k === 'precio_unitario') {
      const c = parseFloat(k==='cantidad'?v:next.cantidad)||0
      const pu = parseFloat(k==='precio_unitario'?v:next.precio_unitario)||0
      next.precio_total = c > 0 && pu > 0 ? (c*pu).toFixed(2) : next.precio_total
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
    const { error } = await supabase.from('almacen_movimientos').insert({
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
    if (error) { alert('Error: ' + error.message); setSaving(false); return }
    setSaving(false); onSave()
  }

  const si = {padding:'7px 10px',border:'1px solid #D8C9A8',borderRadius:7,fontSize:13,fontFamily:'inherit',width:'100%',background:'#FDFAF4'}
  const titulos = { stock_inicial:'Ingreso de stock inicial', compra:'Remito de compra', salida_aplicacion:'Salida' }
  const colors  = { stock_inicial:'#E4F0F4', compra:'#F0F7EE', salida_aplicacion:'#FAF5EC' }
  const borders = { stock_inicial:'#7A9EAD', compra:'#9DC87A', salida_aplicacion:'#C8A96E' }

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
          <div className="field"><label className="label">Factura relacionada <span style={{fontWeight:400,color:'var(--text-muted)'}}>— opcional, se puede agregar luego</span></label>
            <select style={si} value={form.costo_id} onChange={e=>f('costo_id',e.target.value)}>
              <option value="">— Sin factura por ahora —</option>
              {costos.slice(0,50).map(c=>(
                <option key={c.id} value={c.id}>{c.fecha} · {c.proveedor} · {c.producto_servicio} · U$S {c.precio_total_usd}</option>
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

// ── Almacen principal ────────────────────────────────────────────────────────
export default function Almacen() {
  const { user, puedeEditar, isAdmin } = useAuth()
  const canEdit = isAdmin || puedeEditar('almacen')
  const quien = user?.user_metadata?.nombre || user?.email || ''

  const [tab, setTab]             = useState('stock')
  const [productos, setProductos] = useState([])
  const [movs, setMovs]           = useState([])
  const [costos, setCostos]       = useState([])
  const [loading, setLoading]     = useState(true)

  const [showFormProd, setShowFormProd]       = useState(false)
  const [editProd, setEditProd]               = useState(null)
  const [showFormMov, setShowFormMov]         = useState(null) // tipo de movimiento a agregar
  const [editMov, setEditMov]                 = useState(null)

  const [fProd, setFProd] = useState('')

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [{ data: prods }, { data: ms }, { data: cs }] = await Promise.all([
      supabase.from('almacen_productos').select('*').eq('activo', true).order('producto'),
      supabase.from('almacen_movimientos').select('*').order('fecha', { ascending: false }),
      supabase.from('costos').select('id,fecha,proveedor,producto_servicio,precio_total_usd').order('fecha', { ascending: false }).limit(200),
    ])
    setProductos(prods || [])
    setMovs(ms || [])
    setCostos(cs || [])
    setLoading(false)
  }

  async function toggleActivoProd(id, activo) {
    await supabase.from('almacen_productos').update({ activo: !activo }).eq('id', id)
    await fetchAll()
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

  // ── Calcular stock actual por producto ────────────────────────────────────
  const stockPorProducto = {}
  movs.forEach(m => {
    const key = m.producto_id || m.producto + '|' + (m.marca||'')
    if (!stockPorProducto[key]) stockPorProducto[key] = {
      producto: m.producto, marca: m.marca, unidad: m.unidad,
      cantidad: 0, valorTotal: 0, movs: [], producto_id: m.producto_id
    }
    const s = stockPorProducto[key]
    const es_salida = m.tipo === 'salida_aplicacion'
    s.cantidad   += es_salida ? -Math.abs(m.cantidad) : m.cantidad
    s.valorTotal += es_salida ? 0 : (m.precio_total || 0)
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
          <button className="btn btn-primary btn-sm" onClick={()=>{setShowFormProd(true);setEditProd(null)}}>+ Nuevo producto</button>
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

      {/* Forms */}
      {showFormMov && canEdit && (
        <FormMovimiento
          tipo={showFormMov} productos={productos} costos={costos}
          quienRegistra={quien}
          onSave={async()=>{ setShowFormMov(null); await fetchAll() }}
          onCancel={()=>setShowFormMov(null)}
        />
      )}
      {(showFormProd || editProd) && canEdit && (
        <FormProducto
          prod={editProd}
          onSave={async()=>{ setShowFormProd(false); setEditProd(null); await fetchAll() }}
          onCancel={()=>{ setShowFormProd(false); setEditProd(null) }}
        />
      )}

      {/* ── TAB STOCK ACTUAL ── */}
      {tab === 'stock' && (
        <div>
          {loading ? <div style={{padding:32,textAlign:'center',color:'var(--arcilla)'}}>Cargando...</div>
          : stockRows.length === 0 ? <div style={{padding:32,textAlign:'center',color:'var(--arcilla)'}}>Sin stock registrado</div>
          : (
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:12}}>
              {stockRows.map(r => {
                const prod = productos.find(p=>p.id===r.producto_id)
                const eiq  = prod?.eiq
                const precioMedio = r.cantidad > 0 ? r.valorTotal / r.movs.filter(m=>m.tipo!=='salida_aplicacion').reduce((a,m)=>a+m.cantidad,0) : null
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
                          <div style={{fontSize:12,fontWeight:500,color:'var(--tierra)'}}>U$S {fmtNum(precioMedio,2)}/{r.unidad}</div>
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
                      <span style={{fontSize:10,background:COL_MOV[m.tipo]+'22',color:COL_MOV[m.tipo],borderRadius:20,padding:'2px 7px',fontWeight:600}}>
                        {TIPO_MOV[m.tipo]||m.tipo}
                      </span>
                    </td>
                    <td style={{padding:'8px 10px'}}>
                      <div style={{fontWeight:500,color:'var(--tierra)'}}>{m.producto}</div>
                      {m.marca && <div style={{fontSize:11,color:'var(--arcilla)'}}>{m.marca}</div>}
                    </td>
                    <td style={{padding:'8px 10px',textAlign:'right',fontFamily:'monospace',fontWeight:600,
                      color:m.tipo==='salida_aplicacion'?'#993C1D':'#2E4F26'}}>
                      {m.tipo==='salida_aplicacion'?'-':'+'}
                      {fmtNum(m.cantidad,1)} {m.unidad}
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
          {productos.filter(p=>!fProd||p.producto.toLowerCase().includes(fProd.toLowerCase())||p.marca?.toLowerCase().includes(fProd.toLowerCase())).map(p=>(
            <div key={p.id} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 14px',marginBottom:8,
              background:'#FDFAF4',border:'1px solid #D8C9A8',borderRadius:10}}>
              <div style={{flex:1}}>
                <div style={{fontWeight:600,color:'var(--tierra)'}}>{p.producto} {p.marca&&<span style={{fontWeight:400,color:'var(--arcilla)'}}>· {p.marca}</span>}</div>
                <div style={{fontSize:11,color:'var(--text-muted)',marginTop:2}}>
                  Unidad: {p.unidad}
                  {p.eiq && <> · <span style={{color:'#2C5A6A',fontWeight:500}}>EIQ: {p.eiq}</span>{p.eiq_fuente&&<span> ({p.eiq_fuente})</span>}</>}
                </div>
              </div>
              {canEdit && (
                <div style={{display:'flex',gap:6}}>
                  <button onClick={()=>{setEditProd(p);setShowFormProd(false)}}
                    style={{background:'transparent',border:'1px solid var(--border)',borderRadius:6,padding:'4px 10px',fontSize:11,cursor:'pointer',color:'var(--arcilla)',fontFamily:'inherit'}}>
                    Editar
                  </button>
                  <button onClick={()=>toggleActivoProd(p.id,p.activo)}
                    style={{background:'#FAECE7',border:'1px solid #F0997B',borderRadius:6,padding:'4px 10px',fontSize:11,cursor:'pointer',color:'#993C1D',fontFamily:'inherit'}}>
                    Desactivar
                  </button>
                </div>
              )}
            </div>
          ))}
          {productos.length === 0 && <div style={{padding:32,textAlign:'center',color:'var(--arcilla)'}}>Sin productos en el catálogo. Agregá uno con el botón +.</div>}
        </div>
      )}
    </div>
  )
}
