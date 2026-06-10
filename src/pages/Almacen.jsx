import { useState, useEffect, useRef } from 'react'
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

function getPrecioPromedio(movs) {
  const entradas = movs.filter(m =>
    (m.tipo==='compra'||m.tipo==='stock_inicial') && m.precio_unitario && parseFloat(m.cantidad)>0
  )
  const totalCant  = entradas.reduce((a,m) => a + parseFloat(m.cantidad),  0)
  const totalValor = entradas.reduce((a,m) => a + parseFloat(m.precio_unitario) * parseFloat(m.cantidad), 0)
  return totalCant>0 ? totalValor/totalCant : null
}

async function buscarEiqIA(producto, marca) {
  try {
    const res = await fetch('/api/buscar-eiq', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({producto, marca})
    })
    return await res.json()
  } catch(e) {}
  return null
}

// ── BuscadorFactura — búsqueda en tiempo real contra Supabase ────────────────
function BuscadorFactura({ onSelect, onClose }) {
  const [busq, setBusq] = useState('')
  const [resultados, setResultados] = useState([])
  const [buscando, setBuscando] = useState(false)
  const inputRef = useRef()
  const timerRef = useRef()
  useEffect(() => { inputRef.current?.focus() }, [])

  useEffect(() => {
    clearTimeout(timerRef.current)
    if (!busq.trim()) { setResultados([]); return }
    timerRef.current = setTimeout(async () => {
      setBuscando(true)
      const q = busq.trim()
      const { data } = await supabase
        .from('costos')
        .select('id,fecha,proveedor,producto_servicio,precio_unitario_sin_iva_usd,precio_total_sin_iva,cantidad,unidad')
        .or(`producto_servicio.ilike.%${q}%,proveedor.ilike.%${q}%`)
        .order('fecha', { ascending: false })
        .limit(40)
      setResultados(data || [])
      setBuscando(false)
    }, 300)
    return () => clearTimeout(timerRef.current)
  }, [busq])

  return (
    <div style={{
      position:'absolute', zIndex:200, top:'calc(100% + 4px)', left:0, right:0,
      background:'white', border:'1px solid #D8C9A8', borderRadius:10,
      boxShadow:'0 6px 24px rgba(59,46,30,0.15)', padding:10, minWidth:360
    }}>
      <div style={{display:'flex',gap:6,marginBottom:8}}>
        <input ref={inputRef} value={busq} onChange={e=>setBusq(e.target.value)}
          placeholder="Buscar por producto, proveedor o fecha..."
          style={{flex:1,padding:'6px 10px',border:'1px solid #D8C9A8',borderRadius:6,fontSize:12,fontFamily:'inherit'}}/>
        <button onClick={onClose}
          style={{padding:'4px 8px',background:'#FAECE7',border:'1px solid #F0997B',borderRadius:6,fontSize:11,cursor:'pointer',color:'#993C1D',fontFamily:'inherit'}}>
          ✕
        </button>
      </div>
      {buscando && <div style={{padding:12,textAlign:'center',fontSize:12,color:'var(--text-muted)'}}>Buscando...</div>}
      {!buscando && busq && resultados.length === 0 && (
        <div style={{padding:12,textAlign:'center',fontSize:12,color:'var(--text-muted)'}}>Sin resultados para "{busq}"</div>
      )}
      {!buscando && !busq && (
        <div style={{padding:12,textAlign:'center',fontSize:12,color:'var(--text-muted)'}}>Escribi producto, proveedor o fecha para buscar</div>
      )}
      <div style={{maxHeight:260,overflowY:'auto',display:'flex',flexDirection:'column',gap:3}}>
        {resultados.map(c=>(
          <button key={c.id} onClick={()=>onSelect(c)}
            style={{display:'flex',alignItems:'center',gap:8,padding:'7px 8px',background:'#FDFAF4',
              border:'1px solid #E8D5A3',borderRadius:7,cursor:'pointer',textAlign:'left',fontFamily:'inherit',
              transition:'background .1s'}}
            onMouseEnter={e=>e.currentTarget.style.background='#F0F7EE'}
            onMouseLeave={e=>e.currentTarget.style.background='#FDFAF4'}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:12,fontWeight:500,color:'var(--tierra)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                {c.producto_servicio}
              </div>
              <div style={{fontSize:10,color:'var(--text-muted)'}}>
                {c.fecha} · {c.proveedor||'—'}
              </div>
            </div>
            <div style={{textAlign:'right',flexShrink:0}}>
              {c.precio_unitario_sin_iva_usd
                ? <div style={{fontSize:12,fontWeight:700,color:'#2E4F26'}}>
                    U$S {fmtNum(c.precio_unitario_sin_iva_usd,3)}
                    <span style={{fontSize:10,fontWeight:400,color:'var(--text-muted)'}}>/u</span>
                  </div>
                : c.precio_total_sin_iva
                  ? <div style={{fontSize:12,fontWeight:600,color:'#4A7C3F'}}>U$S {fmtNum(c.precio_total_sin_iva,2)} <span style={{fontSize:10,fontWeight:400}}>total</span></div>
                  : null
              }
              {c.cantidad && (
                <div style={{fontSize:10,color:'var(--text-muted)'}}>{fmtNum(c.cantidad,0)} {c.unidad}</div>
              )}
            </div>
          </button>
        ))}
      </div>
      <div style={{marginTop:6,fontSize:10,color:'var(--text-muted)',textAlign:'center'}}>
        {resultados.length > 0 ? `${resultados.length} resultados${resultados.length===40?' (mostrá más términos para acotar)':''}` : ''}
      </div>
    </div>
  )
}

// ── FilaMov — fila editable de movimiento ─────────────────────────────────────
function FilaMov({ m, canEdit, onSave, onDelete, isLast }) {
  const [editando, setEditando] = useState(false)
  const [form, setForm]         = useState({ ...m })
  const [saving, setSaving]     = useState(false)
  const [showBuscador, setShowBuscador] = useState(false)
  const [facturaVinculada, setFacturaVinculada] = useState(null)
  const buscadorRef = useRef()

  // Cargar datos de la factura vinculada si existe
  useEffect(() => {
    if (!form.costo_id) { setFacturaVinculada(null); return }
    supabase.from('costos')
      .select('id,fecha,proveedor,producto_servicio,precio_unitario_sin_iva_usd,cantidad,unidad')
      .eq('id', form.costo_id).single()
      .then(({ data }) => setFacturaVinculada(data))
  }, [form.costo_id])
  const f = (k,v) => setForm(p => {
    const next = {...p,[k]:v}
    if (k==='cantidad'||k==='precio_unitario') {
      const c  = parseFloat(k==='cantidad'?v:next.cantidad)||0
      const pu = parseFloat(k==='precio_unitario'?v:next.precio_unitario)||0
      if (c>0&&pu>0) next.precio_total = (c*pu).toFixed(2)
    }
    if (k==='precio_total') {
      const c = parseFloat(next.cantidad)||0
      if (c>0) next.precio_unitario = (parseFloat(v)/c).toFixed(4)
    }
    return next
  })
  function seleccionarFactura(costo) {
    setShowBuscador(false)
    setForm(p => {
      const next  = {...p, costo_id: costo.id, proveedor: costo.proveedor||p.proveedor}
      const pUnit = parseFloat(costo.precio_unitario_sin_iva_usd) || 0
      const pTot  = parseFloat(costo.precio_total_sin_iva)  || 0
      const cant  = parseFloat(next.cantidad) || 0
      if (pUnit > 0) {
        next.precio_unitario = pUnit.toFixed(4)
        if (cant > 0) next.precio_total = (cant * pUnit).toFixed(2)
      } else if (pTot > 0 && cant > 0) {
        // Sin precio/u en factura -> calculamos total_factura / cantidad_movimiento
        next.precio_unitario = (pTot / cant).toFixed(4)
        next.precio_total    = pTot.toFixed(2)
      } else if (pTot > 0) {
        next.precio_total = pTot.toFixed(2)
      }
      return next
    })
  }

  async function handleSave() {
    setSaving(true)
    await supabase.from('almacen_movimientos').update({
      fecha:         form.fecha,
      producto:      form.producto,
      marca:         form.marca||null,
      cantidad:      parseFloat(form.cantidad),
      unidad:        form.unidad,
      precio_unitario: form.precio_unitario ? parseFloat(form.precio_unitario) : null,
      precio_total:  form.precio_total ? parseFloat(form.precio_total) : null,
      proveedor:     form.proveedor||null,
      costo_id:      form.costo_id||null,
      observaciones: form.observaciones||null,
    }).eq('id', m.id)
    setSaving(false); setEditando(false); onSave()
  }

  const border = isLast ? 'none' : '1px solid #EDE0C8'
  const si = {padding:'5px 7px',border:'1px solid #D8C9A8',borderRadius:5,fontSize:11,fontFamily:'inherit',background:'#FDFAF4'}

  if (editando) return (
    <tr style={{background:'#FFF9EE',borderBottom:border}}>
      <td colSpan={9} style={{padding:'10px 12px'}}>
        <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'flex-end',marginBottom:8}}>
          <div>
            <div style={{fontSize:9,fontWeight:600,color:'#A08060',textTransform:'uppercase',marginBottom:2}}>Fecha</div>
            <input type="date" value={form.fecha} onChange={e=>f('fecha',e.target.value)} style={{...si,width:130}}/>
          </div>
          <div style={{flex:2,minWidth:120}}>
            <div style={{fontSize:9,fontWeight:600,color:'#A08060',textTransform:'uppercase',marginBottom:2}}>Producto</div>
            <input value={form.producto||''} onChange={e=>f('producto',e.target.value)} style={{...si,width:'100%'}}/>
          </div>
          <div style={{flex:1,minWidth:90}}>
            <div style={{fontSize:9,fontWeight:600,color:'#A08060',textTransform:'uppercase',marginBottom:2}}>Marca</div>
            <input value={form.marca||''} onChange={e=>f('marca',e.target.value)} style={{...si,width:'100%'}}/>
          </div>
          <div>
            <div style={{fontSize:9,fontWeight:600,color:'#A08060',textTransform:'uppercase',marginBottom:2}}>Cantidad</div>
            <div style={{display:'flex',gap:3}}>
              <input type="number" step="0.01" value={form.cantidad} onChange={e=>f('cantidad',e.target.value)} style={{...si,width:70}}/>
              <select value={form.unidad} onChange={e=>f('unidad',e.target.value)} style={{...si,width:60}}>
                {UNIDADES.map(u=><option key={u}>{u}</option>)}
              </select>
            </div>
          </div>
          <div>
            <div style={{fontSize:9,fontWeight:600,color:'#A08060',textTransform:'uppercase',marginBottom:2}}>P. unitario</div>
            <input type="number" step="0.001" value={form.precio_unitario||''} onChange={e=>f('precio_unitario',e.target.value)} style={{...si,width:90}} placeholder="0.000"/>
          </div>
          <div>
            <div style={{fontSize:9,fontWeight:600,color:'#A08060',textTransform:'uppercase',marginBottom:2}}>Total USD</div>
            <input type="number" step="0.01" value={form.precio_total||''} onChange={e=>f('precio_total',e.target.value)} style={{...si,width:90}} placeholder="0.00"/>
          </div>
          <div style={{flex:1,minWidth:100}}>
            <div style={{fontSize:9,fontWeight:600,color:'#A08060',textTransform:'uppercase',marginBottom:2}}>Proveedor</div>
            <input value={form.proveedor||''} onChange={e=>f('proveedor',e.target.value)} style={{...si,width:'100%'}}/>
          </div>
        </div>

        {/* Factura vinculada */}
        {(m.tipo==='compra'||m.tipo==='stock_inicial') && (
          <div style={{position:'relative',marginBottom:8}} ref={buscadorRef}>
            <div style={{fontSize:9,fontWeight:600,color:'#A08060',textTransform:'uppercase',marginBottom:4}}>
              Factura vinculada
            </div>
            <div style={{display:'flex',gap:6,alignItems:'center'}}>
              {facturaVinculada ? (
                <div style={{flex:1,display:'flex',alignItems:'center',gap:8,padding:'6px 10px',background:'#EBF4E8',border:'1px solid #9DC87A',borderRadius:6}}>
                  <span style={{fontSize:11,fontWeight:500,color:'var(--tierra)',flex:1}}>{facturaVinculada.producto_servicio}</span>
                  <span style={{fontSize:10,color:'var(--text-muted)'}}>{facturaVinculada.fecha} · {facturaVinculada.proveedor}</span>
                  <span style={{fontSize:11,fontWeight:700,color:'#2E4F26'}}>U$S {fmtNum(facturaVinculada.precio_unitario_sin_iva_usd,3)}/u</span>
                </div>
              ) : (
                <div style={{flex:1,padding:'6px 10px',background:'#F5F0E8',border:'1px dashed #D8C9A8',borderRadius:6,fontSize:11,color:'var(--text-muted)'}}>
                  Sin factura vinculada
                </div>
              )}
              <button onClick={()=>setShowBuscador(v=>!v)}
                style={{padding:'6px 10px',background:'#E4F0F4',border:'1px solid #7A9EAD',borderRadius:6,fontSize:11,cursor:'pointer',color:'#2C5A6A',fontFamily:'inherit',whiteSpace:'nowrap'}}>
                🔍 Buscar factura
              </button>
              {facturaVinculada && (
                <button onClick={()=>setForm(p=>({...p,costo_id:null}))}
                  style={{padding:'6px 8px',background:'#FAECE7',border:'1px solid #F0997B',borderRadius:6,fontSize:11,cursor:'pointer',color:'#993C1D',fontFamily:'inherit'}}>
                  ✕
                </button>
              )}
            </div>
            {showBuscador && (
              <BuscadorFactura onSelect={seleccionarFactura} onClose={()=>setShowBuscador(false)}/>
            )}
          </div>
        )}

        <div style={{display:'flex',gap:6}}>
          <button onClick={handleSave} disabled={saving}
            style={{padding:'5px 12px',background:'var(--pasto)',color:'#F5F0E4',border:'none',borderRadius:6,fontSize:11,cursor:'pointer',fontFamily:'inherit'}}>
            {saving?'Guardando...':'✓ Guardar'}
          </button>
          <button onClick={()=>setEditando(false)}
            style={{padding:'5px 12px',background:'transparent',border:'1px solid var(--border)',borderRadius:6,fontSize:11,cursor:'pointer',fontFamily:'inherit'}}>
            Cancelar
          </button>
          <button onClick={()=>onDelete(m.id)}
            style={{marginLeft:'auto',padding:'5px 10px',background:'#FAECE7',border:'1px solid #F0997B',borderRadius:6,fontSize:11,cursor:'pointer',color:'#993C1D',fontFamily:'inherit'}}>
            🗑 Eliminar
          </button>
        </div>
      </td>
    </tr>
  )

  return (
    <tr style={{borderBottom:border,background:'white'}}>
      <td style={{padding:'8px 10px',color:'var(--text-muted)',whiteSpace:'nowrap',fontSize:11}}>{fmtFecha(m.fecha)}</td>
      <td style={{padding:'8px 10px'}}>
        <span style={{fontSize:10,background:(COL_MOV[m.tipo]||'#888')+'22',color:COL_MOV[m.tipo]||'#888',borderRadius:20,padding:'2px 7px',fontWeight:600}}>
          {TIPO_MOV[m.tipo]||m.tipo}
        </span>
      </td>
      <td style={{padding:'8px 10px'}}>
        <div style={{fontWeight:500,color:'var(--tierra)',fontSize:12}}>{m.producto}</div>
        {m.marca && <div style={{fontSize:10,color:'var(--arcilla)'}}>{m.marca}</div>}
      </td>
      <td style={{padding:'8px 10px',textAlign:'right',fontFamily:'monospace',fontWeight:600,fontSize:11,
        color:m.tipo==='salida_aplicacion'||m.cantidad<0?'#993C1D':'#2E4F26'}}>
        {m.cantidad<0?'':m.tipo==='salida_aplicacion'?'−':'+'}
        {fmtNum(Math.abs(m.cantidad),1)} {m.unidad}
      </td>
      <td style={{padding:'8px 10px',textAlign:'right',fontFamily:'monospace',fontSize:11,color:'var(--text-muted)'}}>
        {m.precio_unitario?'U$S '+fmtNum(m.precio_unitario,3):'—'}
      </td>
      <td style={{padding:'8px 10px',textAlign:'right',fontFamily:'monospace',fontWeight:500,fontSize:11,color:'var(--musgo)'}}>
        {m.precio_total?'U$S '+fmtNum(m.precio_total,0):'—'}
      </td>
      <td style={{padding:'8px 10px',fontSize:11,color:'var(--suelo)'}}>{m.proveedor||'—'}</td>
      <td style={{padding:'8px 10px'}}>
        {m.costo_id
          ? <span style={{fontSize:10,background:'#EBF4E8',color:'#2E4F26',borderRadius:20,padding:'2px 7px'}}>✓ Factura</span>
          : m.aplicacion_id
            ? <span style={{fontSize:10,background:'#FAF5EC',color:'#6B3E22',borderRadius:20,padding:'2px 7px'}}>⬇ Aplicación</span>
            : <span style={{fontSize:10,color:'var(--text-muted)'}}>—</span>
        }
      </td>
      {canEdit && (
        <td style={{padding:'8px 10px'}}>
          <button onClick={()=>setEditando(true)}
            style={{background:'transparent',border:'1px solid var(--border)',borderRadius:5,padding:'3px 8px',fontSize:10,cursor:'pointer',color:'var(--arcilla)',fontFamily:'inherit'}}>
            Editar
          </button>
        </td>
      )}
    </tr>
  )
}

// ── FilaCatalogo ──────────────────────────────────────────────────────────────
function FilaCatalogo({ prod, onSave, onDelete }) {
  const [editando, setEditando] = useState(!prod.id)
  const [form, setForm] = useState({ producto:prod.producto, marca:prod.marca||'', unidad:prod.unidad||'L', eiq:prod.eiq||'', eiq_fuente:prod.eiq_fuente||'' })
  const [saving, setSaving] = useState(false)
  const [buscandoEiq, setBuscandoEiq] = useState(false)
  const f = (k,v) => setForm(p=>({...p,[k]:v}))

  async function handleBuscarEiq() {
    setBuscandoEiq(true)
    const result = await buscarEiqIA(form.producto, form.marca)
    if (result?.eiq) { f('eiq', result.eiq); f('eiq_fuente', result.fuente||'IA') }
    else f('eiq_fuente', 'No encontrado')
    setBuscandoEiq(false)
  }

  async function handleSave() {
    setSaving(true)
    if (prod.id) {
      await supabase.from('almacen_productos').update({
        producto:form.producto, marca:form.marca||null, unidad:form.unidad,
        eiq:form.eiq?parseFloat(form.eiq):null, eiq_fuente:form.eiq_fuente||null,
      }).eq('id', prod.id)
    } else {
      await supabase.from('almacen_productos').insert({
        producto:form.producto, marca:form.marca||null, unidad:form.unidad,
        eiq:form.eiq?parseFloat(form.eiq):null, eiq_fuente:form.eiq_fuente||null,
        activo:true,
      })
    }
    setSaving(false); setEditando(false); onSave()
  }

  const si = {padding:'5px 8px',border:'1px solid #D8C9A8',borderRadius:6,fontSize:12,fontFamily:'inherit',background:'#FDFAF4'}

  if (!editando) return (
    <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',marginBottom:6,background:'#FDFAF4',border:'1px solid #D8C9A8',borderRadius:10}}>
      <div style={{flex:1}}>
        <div style={{fontWeight:600,color:'var(--tierra)',fontSize:13}}>
          {prod.producto}
          {prod.marca && <span style={{fontWeight:400,color:'var(--arcilla)',fontSize:12}}> · {prod.marca}</span>}
          <span style={{fontSize:10,background:'#EDE0C8',borderRadius:20,padding:'1px 7px',marginLeft:8,color:'#7A6040'}}>{prod.unidad}</span>
        </div>
        <div style={{display:'flex',gap:12,marginTop:3}}>
          {prod.eiq
            ? <span style={{fontSize:11,color:'#2C5A6A',background:'#E4F0F4',borderRadius:20,padding:'1px 7px'}}>EIQ: {prod.eiq}{prod.eiq_fuente&&` (${prod.eiq_fuente})`}</span>
            : <span style={{fontSize:11,color:'var(--text-muted)'}}>Sin EIQ</span>}
        </div>
      </div>
      <button onClick={()=>setEditando(true)} style={{background:'transparent',border:'1px solid var(--border)',borderRadius:6,padding:'4px 10px',fontSize:11,cursor:'pointer',color:'var(--arcilla)',fontFamily:'inherit'}}>Editar</button>
      <button onClick={()=>{if(confirm('¿Desactivar este producto?'))onDelete(prod.id)}} style={{background:'#FAECE7',border:'1px solid #F0997B',borderRadius:6,padding:'4px 10px',fontSize:11,cursor:'pointer',color:'#993C1D',fontFamily:'inherit'}}>✕</button>
    </div>
  )

  return (
    <div style={{padding:'12px 14px',marginBottom:6,background:'#FFF9EE',border:'1px solid #C8A96E',borderRadius:10}}>
      <div style={{display:'flex',gap:8,marginBottom:8,flexWrap:'wrap'}}>
        <input value={form.producto} onChange={e=>f('producto',e.target.value)} style={{...si,flex:2,minWidth:140}} placeholder="Principio activo"/>
        <input value={form.marca} onChange={e=>f('marca',e.target.value)} style={{...si,flex:1,minWidth:100}} placeholder="Marca"/>
        <select value={form.unidad} onChange={e=>f('unidad',e.target.value)} style={{...si,width:70}}>
          {UNIDADES.map(u=><option key={u}>{u}</option>)}
        </select>
      </div>
      <div style={{display:'flex',gap:6,alignItems:'center',marginBottom:8,flexWrap:'wrap'}}>
        <span style={{fontSize:11,color:'#2C5A6A'}}>EIQ:</span>
        <input type="number" step="0.1" value={form.eiq} onChange={e=>f('eiq',e.target.value)} style={{...si,width:80}} placeholder="—"/>
        <input value={form.eiq_fuente} onChange={e=>f('eiq_fuente',e.target.value)} style={{...si,flex:1,minWidth:100,fontSize:11}} placeholder="Fuente"/>
        <button type="button" onClick={handleBuscarEiq} disabled={buscandoEiq}
          style={{padding:'5px 9px',background:'#E4F0F4',border:'1px solid #7A9EAD',borderRadius:6,fontSize:11,cursor:'pointer',color:'#2C5A6A',fontFamily:'inherit'}}>
          {buscandoEiq?'⏳':'🤖 Buscar EIQ'}
        </button>
      </div>
      <div style={{display:'flex',gap:6}}>
        <button onClick={handleSave} disabled={saving} style={{padding:'5px 12px',background:'var(--pasto)',color:'#F5F0E4',border:'none',borderRadius:6,fontSize:11,cursor:'pointer',fontFamily:'inherit'}}>
          {saving?'Guardando...':'✓ Guardar'}
        </button>
        <button onClick={()=>setEditando(false)} style={{padding:'5px 12px',background:'transparent',border:'1px solid var(--border)',borderRadius:6,fontSize:11,cursor:'pointer',fontFamily:'inherit'}}>Cancelar</button>
      </div>
    </div>
  )
}

// ── FormMovimiento ────────────────────────────────────────────────────────────
function FormMovimiento({ tipo, productos, quienRegistra, onSave, onCancel }) {
  const isCompra = tipo==='compra'
  const [form, setForm] = useState({
    fecha:new Date().toISOString().split('T')[0],
    producto_id:'', producto:'', marca:'', cantidad:'',
    unidad:'L', precio_unitario:'', precio_total:'',
    proveedor:'', costo_id:'', observaciones:'',
  })
  const [saving, setSaving] = useState(false)
  const [showBuscador, setShowBuscador] = useState(false)
  const [facturaVinculada, setFacturaVinculada] = useState(null)

  const f = (k,v) => setForm(p=>{
    const next = {...p,[k]:v}
    if (k==='cantidad'||k==='precio_unitario') {
      const c=parseFloat(k==='cantidad'?v:next.cantidad)||0
      const pu=parseFloat(k==='precio_unitario'?v:next.precio_unitario)||0
      if (c>0&&pu>0) next.precio_total=(c*pu).toFixed(2)
    }
    if (k==='precio_total'&&next.cantidad) {
      const c=parseFloat(next.cantidad)||0
      if (c>0) next.precio_unitario=(parseFloat(v)/c).toFixed(4)
    }
    if (k==='producto_id') {
      const prod=productos.find(p=>p.id===v)
      if (prod){next.producto=prod.producto;next.marca=prod.marca||'';next.unidad=prod.unidad||'L'}
    }
    return next
  })

  function seleccionarFactura(costo) {
    setShowBuscador(false)
    setFacturaVinculada(costo)
    setForm(p => {
      const next  = {...p, costo_id: costo.id, proveedor: costo.proveedor||p.proveedor}
      const pUnit = parseFloat(costo.precio_unitario_sin_iva_usd) || 0
      const pTot  = parseFloat(costo.precio_total_sin_iva)  || 0
      const cant  = parseFloat(next.cantidad) || 0
      if (pUnit > 0) {
        next.precio_unitario = pUnit.toFixed(4)
        if (cant > 0) next.precio_total = (cant * pUnit).toFixed(2)
      } else if (pTot > 0 && cant > 0) {
        // Sin precio/u en factura -> calculamos total_factura / cantidad_movimiento
        next.precio_unitario = (pTot / cant).toFixed(4)
        next.precio_total    = pTot.toFixed(2)
      } else if (pTot > 0) {
        next.precio_total = pTot.toFixed(2)
      }
      return next
    })
  }

  async function save(e) {
    e.preventDefault(); setSaving(true)
    await supabase.from('almacen_movimientos').insert({
      fecha:form.fecha,tipo,
      producto_id:form.producto_id||null,
      producto:form.producto,marca:form.marca,
      cantidad:parseFloat(form.cantidad),unidad:form.unidad,
      precio_unitario:form.precio_unitario?parseFloat(form.precio_unitario):null,
      precio_total:form.precio_total?parseFloat(form.precio_total):null,
      proveedor:form.proveedor||null,costo_id:form.costo_id||null,
      observaciones:form.observaciones||null,quien_registro:quienRegistra,
    })
    setSaving(false); onSave()
  }

  const si={padding:'7px 10px',border:'1px solid #D8C9A8',borderRadius:7,fontSize:13,fontFamily:'inherit',width:'100%',background:'#FDFAF4'}

  return (
    <div className="card mb-3" style={{background:isCompra?'#F0F7EE':'#E4F0F4',borderColor:isCompra?'#9DC87A':'#7A9EAD'}}>
      <h3 style={{marginBottom:14}}>{isCompra?'Remito de compra':'Ingreso de stock inicial'}</h3>
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
          <div className="field"><label className="label">Precio unitario (USD sin IVA)</label>
            <input style={si} type="number" step="0.001" value={form.precio_unitario} onChange={e=>f('precio_unitario',e.target.value)} placeholder="0.000"/>
          </div>
        </div>
        <div className="grid-2">
          <div className="field"><label className="label">Precio total (USD sin IVA)</label>
            <input style={si} type="number" step="0.01" value={form.precio_total} onChange={e=>f('precio_total',e.target.value)} placeholder="0.00"/>
          </div>
          <div className="field"><label className="label">Proveedor</label>
            <input style={si} value={form.proveedor} onChange={e=>f('proveedor',e.target.value)} placeholder="Ej: Tecnocampo"/>
          </div>
        </div>

        {isCompra && (
          <div className="field">
            <label className="label">Factura relacionada <span style={{fontWeight:400,color:'var(--text-muted)'}}>— trae precio unitario automáticamente</span></label>
            <div style={{position:'relative'}}>
              <div style={{display:'flex',gap:6,alignItems:'center'}}>
                {facturaVinculada ? (
                  <div style={{flex:1,display:'flex',alignItems:'center',gap:8,padding:'7px 10px',background:'#EBF4E8',border:'1px solid #9DC87A',borderRadius:7,fontSize:12}}>
                    <span style={{flex:1,fontWeight:500,color:'var(--tierra)'}}>{facturaVinculada.producto_servicio}</span>
                    <span style={{color:'var(--text-muted)'}}>{facturaVinculada.fecha}</span>
                    <span style={{fontWeight:700,color:'#2E4F26'}}>U$S {fmtNum(facturaVinculada.precio_unitario_sin_iva_usd,3)}/u</span>
                  </div>
                ) : (
                  <div style={{flex:1,padding:'7px 10px',background:'#F5F0E8',border:'1px dashed #D8C9A8',borderRadius:7,fontSize:12,color:'var(--text-muted)'}}>
                    Sin factura vinculada
                  </div>
                )}
                <button type="button" onClick={()=>setShowBuscador(v=>!v)}
                  style={{padding:'7px 12px',background:'#E4F0F4',border:'1px solid #7A9EAD',borderRadius:7,fontSize:12,cursor:'pointer',color:'#2C5A6A',fontFamily:'inherit',whiteSpace:'nowrap'}}>
                  🔍 Buscar factura
                </button>
                {facturaVinculada && (
                  <button type="button" onClick={()=>setForm(p=>({...p,costo_id:''}))}
                    style={{padding:'7px 10px',background:'#FAECE7',border:'1px solid #F0997B',borderRadius:7,fontSize:12,cursor:'pointer',color:'#993C1D'}}>
                    ✕
                  </button>
                )}
              </div>
              {showBuscador && (
                <BuscadorFactura onSelect={seleccionarFactura} onClose={()=>setShowBuscador(false)}/>
              )}
            </div>
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
  // costos se cargan on-demand via BuscadorFactura
  const [loading, setLoading]     = useState(true)
  const [showFormProd, setShowFormProd] = useState(false)
  const [showFormMov, setShowFormMov]   = useState(null)
  const [fProd, setFProd] = useState('')

  useEffect(()=>{ fetchAll() },[])

  async function fetchAll() {
    setLoading(true)
    const [{ data:prods },{ data:ms }] = await Promise.all([
      supabase.from('almacen_productos').select('*').eq('activo',true).order('producto'),
      supabase.from('almacen_movimientos').select('*').order('fecha',{ascending:false}),
    ])
    setProductos(prods||[])
    setMovs(ms||[])
    setLoading(false)
  }

  async function desactivarProd(id) {
    await supabase.from('almacen_productos').update({activo:false}).eq('id',id)
    await fetchAll()
  }

  // Stock y valorización
  const stockPorProducto = {}
  movs.forEach(m => {
    // Agrupar siempre por nombre+marca para evitar splits cuando
    // algunos movimientos tienen producto_id y otros no
    const key = (m.producto + '|' + (m.marca||'')).toUpperCase()
    if (!stockPorProducto[key]) stockPorProducto[key] = {producto:m.producto,marca:m.marca,unidad:m.unidad,cantidad:0,movs:[],producto_id:m.producto_id}
    const s    = stockPorProducto[key]
    const cant = parseFloat(m.cantidad) || 0
    if (m.tipo === 'salida_aplicacion') { s.cantidad -= Math.abs(cant) }
    else { s.cantidad += cant }  // ajustes negativos ya traen su signo
    s.movs.push(m)
  })

  const stockRows = Object.entries(stockPorProducto)
    .map(([k,v])=>{
      const precioMedio=getPrecioPromedio(v.movs)
      const valorStock=precioMedio&&v.cantidad>0?precioMedio*v.cantidad:null
      return {key:k,...v,precioMedio,valorStock}
    })
    .sort((a,b)=>a.producto.localeCompare(b.producto))
    .filter(r=>!fProd||r.producto.toLowerCase().includes(fProd.toLowerCase())||r.marca?.toLowerCase().includes(fProd.toLowerCase()))

  const valorTotalStock=stockRows.reduce((a,r)=>a+(r.valorStock||0),0)

  const movsFiltrados=movs.filter(m=>!fProd||
    m.producto?.toLowerCase().includes(fProd.toLowerCase())||
    m.marca?.toLowerCase().includes(fProd.toLowerCase()))

  const TABS=[['stock','Stock actual'],['movimientos','Movimientos'],['catalogo','Catálogo']]

  return (
    <div>
      <div className="flex-between mb-2">
        <div>
          <h2>Almacén</h2>
          <p style={{fontSize:12,color:'var(--arcilla)',marginTop:2}}>
            {stockRows.length} productos · {movs.length} movimientos
            {valorTotalStock>0&&<> · Valor: <strong style={{color:'#2E4F26'}}>U$S {fmtNum(valorTotalStock,0)}</strong></>}
          </p>
        </div>
        {canEdit&&tab==='stock'&&(
          <div style={{display:'flex',gap:6}}>
            <button className="btn btn-secondary btn-sm" onClick={()=>setShowFormMov('stock_inicial')}>+ Stock inicial</button>
            <button className="btn btn-primary btn-sm" onClick={()=>setShowFormMov('compra')}>+ Remito compra</button>
          </div>
        )}
        {canEdit&&tab==='catalogo'&&(
          <button className="btn btn-primary btn-sm" onClick={()=>setShowFormProd(v=>!v)}>
            {showFormProd?'Cancelar':'+ Nuevo producto'}
          </button>
        )}
      </div>

      <div style={{display:'flex',gap:4,marginBottom:16,borderBottom:'1px solid #D8C9A8'}}>
        {TABS.map(([id,lbl])=>(
          <button key={id} onClick={()=>setTab(id)}
            style={{padding:'8px 16px',fontSize:12,cursor:'pointer',borderRadius:'8px 8px 0 0',border:'1px solid transparent',borderBottom:'none',
              fontFamily:'inherit',marginBottom:-1,background:tab===id?'#FDFAF4':'transparent',
              borderColor:tab===id?'#D8C9A8':'transparent',color:tab===id?'#3B2E1E':'#A08060',fontWeight:tab===id?500:400}}>
            {lbl}
          </button>
        ))}
      </div>

      <div style={{position:'relative',marginBottom:14}}>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="var(--arcilla)" strokeWidth="1.5" strokeLinecap="round"
          style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',pointerEvents:'none'}}>
          <circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5L14 14"/>
        </svg>
        <input value={fProd} onChange={e=>setFProd(e.target.value)} placeholder="Buscar por producto o marca..."
          style={{width:'100%',padding:'8px 12px 8px 32px',border:'1px solid #D8C9A8',borderRadius:8,fontSize:13,background:'#FDFAF4',fontFamily:'inherit'}}/>
        {fProd&&<button onClick={()=>setFProd('')} style={{position:'absolute',right:8,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',color:'var(--arcilla)',fontSize:16}}>✕</button>}
      </div>

      {showFormMov&&canEdit&&(
        <FormMovimiento tipo={showFormMov} productos={productos} quienRegistra={quien}
          onSave={async()=>{setShowFormMov(null);await fetchAll()}}
          onCancel={()=>setShowFormMov(null)}/>
      )}
      {showFormProd&&canEdit&&tab==='catalogo'&&(
        <FilaCatalogo prod={{producto:'',marca:'',unidad:'L',eiq:'',eiq_fuente:''}}
          onSave={async()=>{setShowFormProd(false);await fetchAll()}}
          onDelete={()=>setShowFormProd(false)} isNew/>
      )}

      {/* ── STOCK ── */}
      {tab==='stock'&&(
        <div>
          {valorTotalStock>0&&(
            <div style={{background:'#EBF4E8',border:'1px solid #9DC87A',borderRadius:10,padding:'12px 16px',marginBottom:14,display:'flex',gap:20,flexWrap:'wrap'}}>
              <div>
                <div style={{fontSize:10,color:'#2E4F26',textTransform:'uppercase',fontWeight:600,letterSpacing:'0.05em'}}>Valor total del stock</div>
                <div style={{fontSize:22,fontWeight:700,color:'#2E4F26'}}>U$S {fmtNum(valorTotalStock,0)}</div>
                <div style={{fontSize:11,color:'#4A7C3F'}}>Precio promedio ponderado</div>
              </div>
              <div style={{display:'flex',gap:12,alignItems:'center',flexWrap:'wrap'}}>
                {stockRows.filter(r=>r.valorStock>0).sort((a,b)=>b.valorStock-a.valorStock).slice(0,4).map(r=>(
                  <div key={r.key} style={{textAlign:'center'}}>
                    <div style={{fontSize:11,fontWeight:500,color:'var(--tierra)'}}>{r.producto}</div>
                    <div style={{fontSize:12,fontWeight:600,color:'#2E4F26'}}>U$S {fmtNum(r.valorStock,0)}</div>
                    <div style={{fontSize:10,color:'var(--text-muted)'}}>{fmtNum(r.cantidad,1)} {r.unidad}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {loading?<div style={{padding:32,textAlign:'center',color:'var(--arcilla)'}}>Cargando...</div>
          :stockRows.length===0?<div style={{padding:32,textAlign:'center',color:'var(--arcilla)'}}>Sin stock</div>
          :(
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))',gap:12}}>
              {stockRows.map(r=>{
                const prod=productos.find(p=>p.id===r.producto_id)
                return (
                  <div key={r.key} style={{background:r.cantidad<=0?'#FEF3EF':'#FDFAF4',border:`1px solid ${r.cantidad<=0?'#F0997B':'#D8C9A8'}`,borderLeft:`3px solid ${r.cantidad<=0?'#F0997B':'#4A7C3F'}`,borderRadius:10,padding:'14px 16px'}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8}}>
                      <div>
                        <div style={{fontSize:14,fontWeight:600,color:'var(--tierra)'}}>{r.producto}</div>
                        {r.marca&&<div style={{fontSize:11,color:'var(--arcilla)'}}>{r.marca}</div>}
                      </div>
                      {prod?.eiq&&(
                        <div style={{textAlign:'right',background:'#E4F0F4',borderRadius:8,padding:'4px 8px'}}>
                          <div style={{fontSize:9,color:'#2C5A6A',textTransform:'uppercase'}}>EIQ</div>
                          <div style={{fontSize:14,fontWeight:700,color:'#2C5A6A'}}>{prod.eiq}</div>
                        </div>
                      )}
                    </div>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-end'}}>
                      <div>
                        <div style={{fontSize:24,fontWeight:700,color:r.cantidad<=0?'#993C1D':'#2E4F26'}}>
                          {fmtNum(r.cantidad,1)} <span style={{fontSize:13,fontWeight:400,color:'var(--text-muted)'}}>{r.unidad}</span>
                        </div>
                        {r.cantidad<=0&&<div style={{fontSize:11,color:'#993C1D',fontWeight:600}}>⚠ Sin stock</div>}
                      </div>
                      <div style={{textAlign:'right'}}>
                        {r.precioMedio&&<div style={{fontSize:11,color:'var(--text-muted)'}}>U$S {fmtNum(r.precioMedio,3)}/{r.unidad}</div>}
                        {r.valorStock&&r.cantidad>0&&<div style={{fontSize:13,fontWeight:600,color:'#2E4F26'}}>U$S {fmtNum(r.valorStock,0)}</div>}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── MOVIMIENTOS ── */}
      {tab==='movimientos'&&(
        <div className="card" style={{padding:0,overflowX:'auto'}}>
          {loading?<div style={{padding:32,textAlign:'center'}}>Cargando...</div>
          :movsFiltrados.length===0?<div style={{padding:32,textAlign:'center',color:'var(--arcilla)'}}>Sin movimientos</div>
          :(
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
              <thead>
                <tr style={{background:'#EDE0C8'}}>
                  {['Fecha','Tipo','Producto · Marca','Cantidad','P. unitario','Total USD','Proveedor','Vínculo'].map(h=>(
                    <th key={h} style={{padding:'8px 10px',textAlign:h==='Cantidad'||h==='P. unitario'||h==='Total USD'?'right':'left',fontSize:10,fontWeight:600,color:'#A08060',textTransform:'uppercase'}}>{h}</th>
                  ))}
                  {canEdit&&<th style={{width:60}}></th>}
                </tr>
              </thead>
              <tbody>
                {movsFiltrados.map((m,i)=>(
                  <FilaMov key={m.id} m={m} canEdit={canEdit}
                    isLast={i===movsFiltrados.length-1}
                    onSave={fetchAll}
                    onDelete={async(id)=>{if(confirm('¿Eliminar?')){await supabase.from('almacen_movimientos').delete().eq('id',id);await fetchAll()}}}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── CATÁLOGO ── */}
      {tab==='catalogo'&&(
        <div>
          {productos.filter(p=>!fProd||p.producto.toLowerCase().includes(fProd.toLowerCase())||p.marca?.toLowerCase().includes(fProd.toLowerCase())).map(p=>(
            <FilaCatalogo key={p.id} prod={p} onSave={fetchAll} onDelete={desactivarProd}/>
          ))}
          {productos.length===0&&<div style={{padding:32,textAlign:'center',color:'var(--arcilla)'}}>Sin productos.</div>}
        </div>
      )}
    </div>
  )
}
