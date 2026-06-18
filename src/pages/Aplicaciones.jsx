import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import MapaLote from '../components/MapaLote'
import { useAuth } from '../hooks/useAuth'

const CULTIVOS    = ['Soja','Maíz','Trigo','Girasol','Sorgo']
const TIPOS_APLIC = [
  { id:'barbecho',   label:'Barbecho' },
  { id:'presiembra', label:'Presiembra' },
  { id:'cultivo',    label:'Cultivo' },
]
const UNIDADES = ['L','cc','kg','g','unidad']

function fmtFecha(f) {
  if (!f) return '—'
  return new Date(f+'T12:00:00').toLocaleDateString('es-AR',{day:'2-digit',month:'short',year:'2-digit'})
}

// Precio unitario vigente de un producto en almacén (último movimiento con precio)
function getPrecioUnitario(productoNombre, marca, movimientos) {
  const movs = movimientos
    .filter(m => m.producto === productoNombre &&
                 (m.tipo === 'compra' || m.tipo === 'stock_inicial') &&
                 m.precio_unitario)
    .sort((a,b) => new Date(b.fecha) - new Date(a.fecha))
  return movs[0]?.precio_unitario || null
}

// ── FormAplicacion ────────────────────────────────────────────────────────────
function FormAplicacion({ aplic, productosAlmacen, movimientosAlm, stockActual, quienRegistra, onSave, onCancel }) {
  const isEdit = !!aplic

  const [form, setForm] = useState(aplic ? {
    fecha: aplic.fecha, lote: aplic.lote||'', superficie_ha: aplic.superficie_ha||'',
    tipo_aplicacion: aplic.tipo_aplicacion, cultivo_anterior: aplic.cultivo_anterior||'',
    cultivo_actual: aplic.cultivo_actual||'', costo_ha_usd: aplic.costo_ha_usd||'',
    observaciones: aplic.observaciones||'',
  } : {
    fecha: new Date().toISOString().split('T')[0], lote:'', superficie_ha:'',
    tipo_aplicacion:'barbecho', cultivo_anterior:'', cultivo_actual:'',
    costo_ha_usd:'', observaciones:'',
  })

  // Productos: incluyen orden_carga editable manualmente
  const [prods, setProds] = useState([
    { producto_id:'', producto:'', marca:'', cantidad_ha:'', unidad:'L', orden_carga:1, eiq:'' }
  ])
  const [saving, setSaving] = useState(false)

  const f = (k,v) => setForm(p=>({...p,[k]:v}))
  const superficieN = parseFloat(form.superficie_ha)||0

  function updateProd(i, k, v) {
    setProds(prev => prev.map((p,idx) => {
      if (idx !== i) return p
      const next = {...p,[k]:v}
      if (k === 'producto_id') {
        const prod = productosAlmacen.find(x => x.id === v)
        if (prod) {
          next.producto   = prod.producto
          next.marca      = prod.marca || ''
          next.unidad     = prod.unidad || 'L'
          next.eiq        = prod.eiq || ''
        }
      }
      return next
    }))
  }
  function addProd() {
    const nextOrden = prods.length > 0 ? Math.max(...prods.map(p=>p.orden_carga||1)) + 1 : 1
    setProds(prev => [...prev, { producto_id:'', producto:'', marca:'', cantidad_ha:'', unidad:'L', orden_carga:nextOrden, eiq:'' }])
  }
  function removeProd(i) { setProds(prev => prev.filter((_,idx) => idx !== i)) }
  function moverOrden(i, dir) {
    // Intercambiar orden_carga con el vecino
    setProds(prev => {
      const sorted = [...prev].sort((a,b) => a.orden_carga - b.orden_carga)
      const sortedIdx = sorted.findIndex((_, si) => prev.indexOf(sorted[si]) === i)
      // Simplemente ajustar el orden_carga del item
      const items = [...prev]
      const current = items[i].orden_carga
      const target = current + dir
      // Intercambiar con quien tenga ese orden
      const swapIdx = items.findIndex(p => p.orden_carga === target)
      if (swapIdx >= 0) {
        items[swapIdx] = {...items[swapIdx], orden_carga: current}
        items[i] = {...items[i], orden_carga: target}
      } else {
        items[i] = {...items[i], orden_carga: target}
      }
      return items
    })
  }

  // Calcular costo/ha por producto desde almacén
  const prodsSorted = [...prods].sort((a,b) => (a.orden_carga||99) - (b.orden_carga||99))

  const costoProductosHa = prods.reduce((sum, p) => {
    if (!p.producto || !p.cantidad_ha) return sum
    const precio = getPrecioUnitario(p.producto, p.marca, movimientosAlm)
    return sum + (precio ? parseFloat(p.cantidad_ha) * precio : 0)
  }, 0)

  // EIQ total de la orden = Σ (dosis/ha × EIQ × superficie)
  const eiqTotal = prods.reduce((sum, p) => {
    if (!p.eiq || !p.cantidad_ha) return sum
    return sum + parseFloat(p.cantidad_ha) * parseFloat(p.eiq) * (superficieN || 1)
  }, 0)

  const costoHaProductos = costoProductosHa  // ya está en /ha
  const costoAplicacion  = parseFloat(form.costo_ha_usd) || 0
  const costoTotalHa     = costoHaProductos + costoAplicacion

  async function save(e) {
    e.preventDefault(); setSaving(true)
    const payload = {
      ...form,
      superficie_ha:   superficieN || null,
      costo_ha_usd:    costoAplicacion || null,
      quien_registro:  quienRegistra,
      estado:          'confirmada',
    }
    let ordenId
    if (isEdit) {
      await supabase.from('ordenes_agroquimicos').update(payload).eq('id', aplic.id)
      ordenId = aplic.id
      await supabase.from('ordenes_agroquimicos_productos').delete().eq('orden_id', ordenId)
    } else {
      const { data } = await supabase.from('ordenes_agroquimicos').insert(payload).select()
      ordenId = data[0].id
    }
    const prodsPayload = prods.filter(p => p.producto).map(p => ({
      orden_id:       ordenId,
      producto_id:    p.producto_id || null,
      producto:       p.producto,
      marca:          p.marca || null,
      cantidad_ha:    parseFloat(p.cantidad_ha) || null,
      cantidad_total: superficieN && p.cantidad_ha ? superficieN * parseFloat(p.cantidad_ha) : null,
      unidad:         p.unidad,
      orden_carga:    p.orden_carga,
      eiq_unitario:   p.eiq ? parseFloat(p.eiq) : null,
    }))
    if (prodsPayload.length) await supabase.from('ordenes_agroquimicos_productos').insert(prodsPayload)
    setSaving(false); onSave()
  }

  const si = {padding:'7px 10px',border:'1px solid #D8C9A8',borderRadius:7,fontSize:13,fontFamily:'inherit',width:'100%',background:'#FDFAF4'}

  return (
    <div className="card mb-3" style={{background:'#F9F6EE',borderColor:'var(--paja)'}}>
      <h3 style={{marginBottom:14}}>{isEdit ? 'Editar orden' : 'Nueva orden de aplicación'}</h3>
      <form onSubmit={save} style={{display:'flex',flexDirection:'column',gap:14}}>
        {/* Datos generales */}
        <div className="grid-2">
          <div className="field"><label className="label">Fecha</label>
            <input style={si} type="date" value={form.fecha} onChange={e=>f('fecha',e.target.value)} required/>
          </div>
          <div className="field"><label className="label">Lote</label>
            <input style={si} value={form.lote} onChange={e=>f('lote',e.target.value)} placeholder="Ej: Lote 1, Norte..."/>
          </div>
        </div>
        <div className="grid-2">
          <div className="field"><label className="label">Superficie (ha)</label>
            <input style={si} type="number" step="0.01" value={form.superficie_ha} onChange={e=>f('superficie_ha',e.target.value)} placeholder="0.00"/>
          </div>
          <div className="field">
            <label className="label">Costo de aplicación (U$S/ha) <span style={{fontWeight:400,color:'var(--text-muted)'}}>— labor, no incluye productos</span></label>
            <input style={si} type="number" step="0.01" value={form.costo_ha_usd} onChange={e=>f('costo_ha_usd',e.target.value)} placeholder="0.00"/>
          </div>
        </div>

        {/* Tipo de aplicación */}
        <div className="field"><label className="label">Tipo de aplicación</label>
          <div style={{display:'flex',gap:8}}>
            {TIPOS_APLIC.map(t=>(
              <button key={t.id} type="button" onClick={()=>f('tipo_aplicacion',t.id)}
                style={{flex:1,padding:'8px',borderRadius:8,fontSize:13,cursor:'pointer',border:'1px solid',fontFamily:'inherit',
                  background:form.tipo_aplicacion===t.id?'var(--tierra)':'transparent',
                  color:form.tipo_aplicacion===t.id?'#F5F0E4':'var(--arcilla)',
                  borderColor:form.tipo_aplicacion===t.id?'var(--tierra)':'var(--border)'}}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {(form.tipo_aplicacion==='barbecho'||form.tipo_aplicacion==='presiembra') && (
          <div className="grid-2">
            <div className="field"><label className="label">Cultivo anterior</label>
              <select style={si} value={form.cultivo_anterior} onChange={e=>f('cultivo_anterior',e.target.value)}>
                <option value="">— Seleccionar —</option>
                {CULTIVOS.map(c=><option key={c}>{c}</option>)}
                <option value="Campo natural">Campo natural</option>
                <option value="Barbecho">Barbecho</option>
              </select>
            </div>
            <div className="field"><label className="label">Cultivo a sembrar</label>
              <select style={si} value={form.cultivo_actual} onChange={e=>f('cultivo_actual',e.target.value)}>
                <option value="">— Seleccionar —</option>
                {CULTIVOS.map(c=><option key={c}>{c}</option>)}
              </select>
            </div>
          <div className="field"><label className="label">Cultivo en pie</label>
            <div style={{display:'flex',gap:8}}>
              {CULTIVOS.map(c=>(
                <button key={c} type="button" onClick={()=>f('cultivo_actual',c)}
                  style={{flex:1,padding:'7px',borderRadius:7,fontSize:12,cursor:'pointer',border:'1px solid',fontFamily:'inherit',
                    background:form.cultivo_actual===c?'#4A7C3F':'transparent',
                    color:form.cultivo_actual===c?'#F5F0E4':'var(--arcilla)',
                    borderColor:form.cultivo_actual===c?'#4A7C3F':'var(--border)'}}>
                  {c}
                </button>
              ))}
            </div>
          </div>
          </div>
        )}

        {/* Productos */}
        <div style={{background:'#F0F6FA',border:'1px solid #7A9EAD',borderRadius:10,padding:'14px 16px'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
            <div style={{fontSize:12,fontWeight:600,color:'#2C5A6A',textTransform:'uppercase',letterSpacing:'0.05em'}}>Productos — orden de aplicación</div>
            <button type="button" onClick={addProd}
              style={{padding:'4px 12px',background:'white',border:'1px solid #7A9EAD',borderRadius:6,fontSize:12,cursor:'pointer',color:'#2C5A6A',fontFamily:'inherit'}}>
              + Agregar producto
            </button>
          </div>

          {prodsSorted.map((p, sortedIdx) => {
            const origIdx = prods.indexOf(p)
            const precio = getPrecioUnitario(p.producto, p.marca, movimientosAlm)
            const costoProdHa = precio && p.cantidad_ha ? precio * parseFloat(p.cantidad_ha) : null
            const eiqProdHa   = p.eiq && p.cantidad_ha ? parseFloat(p.eiq) * parseFloat(p.cantidad_ha) : null
            const stockDisp   = stockActual[p.producto_id] || null

            return (
              <div key={origIdx} style={{background:'white',borderRadius:8,padding:'10px 12px',marginBottom:8,border:'1px solid #B8D0D8'}}>
                {/* Controles de orden */}
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
                  <div style={{display:'flex',flexDirection:'column',gap:1,flexShrink:0}}>
                    <button type="button" onClick={()=>moverOrden(origIdx,-1)} disabled={sortedIdx===0}
                      style={{width:20,height:14,border:'1px solid #B8D0D8',borderRadius:3,background:'#F5F5F5',cursor:'pointer',fontSize:9,lineHeight:1,padding:0}}>▲</button>
                    <button type="button" onClick={()=>moverOrden(origIdx,1)} disabled={sortedIdx===prodsSorted.length-1}
                      style={{width:20,height:14,border:'1px solid #B8D0D8',borderRadius:3,background:'#F5F5F5',cursor:'pointer',fontSize:9,lineHeight:1,padding:0}}>▼</button>
                  </div>
                  <div style={{width:24,height:24,borderRadius:'50%',background:'#2C5A6A',color:'white',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,flexShrink:0}}>
                    {sortedIdx+1}
                  </div>
                  <select value={p.producto_id} onChange={e=>updateProd(origIdx,'producto_id',e.target.value)}
                    style={{flex:1,padding:'5px',border:'1px solid #B8D0D8',borderRadius:6,fontSize:12,fontFamily:'inherit',background:'#FDFAF4'}}>
                    <option value="">— Del catálogo —</option>
                    {productosAlmacen.map(prod=>(
                      <option key={prod.id} value={prod.id}>
                        {prod.producto}{prod.marca?' · '+prod.marca:''}
                        {stockActual[prod.id] != null ? ' ['+Number(stockActual[prod.id]).toFixed(1)+' '+prod.unidad+']' : ''}
                      </option>
                    ))}
                  </select>
                  <button type="button" onClick={()=>removeProd(origIdx)} disabled={prods.length===1}
                    style={{padding:'5px 8px',background:'#FAECE7',border:'1px solid #F0997B',borderRadius:6,fontSize:11,cursor:'pointer',color:'#993C1D',fontFamily:'inherit',flexShrink:0}}>✕</button>
                </div>

                <div style={{display:'flex',gap:6,marginBottom:4}}>
                  <input value={p.producto} onChange={e=>updateProd(origIdx,'producto',e.target.value)}
                    placeholder="Principio activo" required
                    style={{flex:2,padding:'5px 7px',border:'1px solid #B8D0D8',borderRadius:5,fontSize:12,fontFamily:'inherit'}}/>
                  <input value={p.marca} onChange={e=>updateProd(origIdx,'marca',e.target.value)}
                    placeholder="Marca"
                    style={{flex:1,padding:'5px 7px',border:'1px solid #B8D0D8',borderRadius:5,fontSize:12,fontFamily:'inherit'}}/>
                  <input type="number" step="0.001" value={p.cantidad_ha} onChange={e=>updateProd(origIdx,'cantidad_ha',e.target.value)}
                    placeholder="Dosis/ha"
                    style={{width:80,padding:'5px 7px',border:'1px solid #B8D0D8',borderRadius:5,fontSize:12,fontFamily:'inherit'}}/>
                  <select value={p.unidad} onChange={e=>updateProd(origIdx,'unidad',e.target.value)}
                    style={{width:64,padding:'5px',border:'1px solid #B8D0D8',borderRadius:5,fontSize:12,fontFamily:'inherit'}}>
                    {UNIDADES.map(u=><option key={u}>{u}</option>)}
                  </select>
                  <div style={{display:'flex',alignItems:'center',gap:3,flexShrink:0}}>
                    <span style={{fontSize:10,color:'#7A9EAD',whiteSpace:'nowrap'}}>EIQ:</span>
                    <input type="number" step="0.1" value={p.eiq} onChange={e=>updateProd(origIdx,'eiq',e.target.value)}
                      placeholder="—"
                      style={{width:52,padding:'5px 6px',border:'1px solid #B8D0D8',borderRadius:5,fontSize:12,fontFamily:'inherit',background:'#E4F0F4'}}/>
                  </div>
                </div>

                {/* Info calculada */}
                <div style={{display:'flex',gap:12,marginTop:4,flexWrap:'wrap'}}>
                  {superficieN > 0 && p.cantidad_ha && (
                    <span style={{fontSize:11,color:'#2C5A6A'}}>
                      Total: <strong>{(superficieN*parseFloat(p.cantidad_ha)).toFixed(1)} {p.unidad}</strong>
                    </span>
                  )}
                  {precio ? (
                    <span style={{fontSize:11,color:'#2E4F26'}}>
                      Precio almacén: U$S {precio.toFixed(3)}/{p.unidad}
                      {costoProdHa && <> · <strong>U$S {costoProdHa.toFixed(2)}/ha</strong></>}
                    </span>
                  ) : p.producto ? (
                    <span style={{fontSize:11,color:'#993C1D'}}>Sin precio en almacén</span>
                  ) : null}
                  {eiqProdHa && (
                    <span style={{fontSize:11,color:'#2C5A6A'}}>EIQ/ha: {eiqProdHa.toFixed(2)}</span>
                  )}
                </div>
              </div>
            )
          })}

          {/* Resumen costos y EIQ */}
          {prods.some(p=>p.producto) && (
            <div style={{marginTop:12,display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}}>
              <div style={{background:'#EBF4E8',borderRadius:8,padding:'8px 12px'}}>
                <div style={{fontSize:10,color:'#2E4F26',textTransform:'uppercase',fontWeight:600,marginBottom:2}}>Costo productos/ha</div>
                <div style={{fontSize:15,fontWeight:700,color:'#2E4F26'}}>
                  {costoHaProductos > 0 ? 'U$S '+costoHaProductos.toFixed(2) : '—'}
                </div>
              </div>
              <div style={{background:'#EFECE4',borderRadius:8,padding:'8px 12px'}}>
                <div style={{fontSize:10,color:'#6B3E22',textTransform:'uppercase',fontWeight:600,marginBottom:2}}>Costo labor/ha</div>
                <div style={{fontSize:15,fontWeight:700,color:'#6B3E22'}}>
                  {costoAplicacion > 0 ? 'U$S '+costoAplicacion.toFixed(2) : '—'}
                </div>
              </div>
              <div style={{background:'#E4F0F4',borderRadius:8,padding:'8px 12px'}}>
                <div style={{fontSize:10,color:'#2C5A6A',textTransform:'uppercase',fontWeight:600,marginBottom:2}}>EIQ total lote</div>
                <div style={{fontSize:15,fontWeight:700,color:'#2C5A6A'}}>
                  {eiqTotal > 0 ? eiqTotal.toFixed(0) : '—'}
                </div>
                {eiqTotal > 0 && superficieN > 0 && (
                  <div style={{fontSize:10,color:'var(--text-muted)'}}>({(eiqTotal/superficieN).toFixed(1)}/ha)</div>
                )}
              </div>
              {costoTotalHa > 0 && superficieN > 0 && (
                <div style={{gridColumn:'1/-1',background:'#F5EDD8',borderRadius:8,padding:'8px 12px',display:'flex',justifyContent:'space-between'}}>
                  <span style={{fontSize:11,color:'#6B3E22',fontWeight:600}}>COSTO TOTAL/HA (productos + labor)</span>
                  <span style={{fontSize:15,fontWeight:700,color:'#6B3E22'}}>U$S {costoTotalHa.toFixed(2)}/ha · Total: U$S {(costoTotalHa*superficieN).toFixed(0)}</span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="field"><label className="label">Observaciones</label>
          <textarea style={{...si,minHeight:52}} value={form.observaciones} onChange={e=>f('observaciones',e.target.value)} placeholder="Condiciones climáticas, notas..."/>
        </div>

        <div style={{display:'flex',gap:8}}>
          <button className="btn btn-primary" type="submit" disabled={saving}>{saving?'Guardando...':isEdit?'Guardar cambios':'Crear orden'}</button>
          <button className="btn btn-secondary" type="button" onClick={onCancel}>Cancelar</button>
        </div>
      </form>
    </div>
  )
}

// ── PDF ───────────────────────────────────────────────────────────────────────
function generarPDF(aplic, prods, movimientosAlm, mapImg) {
  const sup = parseFloat(aplic.superficie_ha)||0
  const costoLabor = parseFloat(aplic.costo_ha_usd)||0
  const costoProds = prods.reduce((s,p) => {
    const precio = getPrecioUnitario(p.producto, p.marca, movimientosAlm)
    return s + (precio && p.cantidad_ha ? precio * parseFloat(p.cantidad_ha) : 0)
  },0)
  const costoTotal = costoLabor + costoProds
  const eiqTotal = prods.reduce((s,p) => {
    if (!p.eiq_unitario && !p.eiq) return s
    const eiq = parseFloat(p.eiq_unitario || p.eiq)
    return s + (p.cantidad_ha ? parseFloat(p.cantidad_ha)*eiq : 0) * (sup||1)
  },0)

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>Orden de aplicación — ${aplic.lote||'Sin lote'}</title>
<style>
  *{box-sizing:border-box} body{font-family:Arial,sans-serif;margin:0;padding:20px;color:#2C1A0E;font-size:12px}
  h1{font-size:16px;margin:0 0 2px;color:#2E4F26} .logo{font-size:18px;font-weight:800;color:#4A7C3F}
  .header{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:10px;border-bottom:2px solid #4A7C3F;margin-bottom:14px}
  .grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:12px}
  .card{background:#F5F0E8;border:1px solid #D8C9A8;border-radius:5px;padding:8px 10px}
  .lbl{font-size:9px;text-transform:uppercase;letter-spacing:.05em;color:#8B6A4A;font-weight:600;margin-bottom:1px}
  .val{font-size:13px;font-weight:600}
  table{width:100%;border-collapse:collapse;margin-top:6px}
  th{background:#2E4F26;color:white;padding:6px 8px;text-align:left;font-size:10px}
  td{padding:6px 8px;border-bottom:1px solid #E8D5A3;font-size:11px}
  .tot{display:flex;gap:10px;margin-top:12px}
  .tot-card{flex:1;border-radius:6px;padding:7px 10px}
  .footer{margin-top:16px;font-size:9px;color:#999;border-top:1px solid #E8D5A3;padding-top:8px}
  @media print{body{padding:12px}}
</style></head><body>
<div class="header">
  <div><div class="logo">🌾 Campo</div>
    <h1>Orden de Aplicación</h1>
    <div style="color:#888;font-size:11px">${fmtFecha(aplic.fecha)}</div>
  </div>
  <div style="text-align:right">
    <div style="font-size:20px;font-weight:700;color:#4A7C3F">${aplic.lote||'—'}</div>
    <div style="font-size:12px;color:#888">${sup ? sup.toLocaleString('es-AR')+' ha' : '—'}</div>
  </div>
</div>
${mapImg?`<div style="text-align:center;margin-bottom:14px"><img src="${mapImg}" style="max-width:100%;max-height:220px;border:1px solid #D8C9A8;border-radius:6px"/></div>`:''}
<div class="grid">
  <div class="card"><div class="lbl">Tipo</div><div class="val">${aplic.tipo_aplicacion==='barbecho'?'Barbecho':aplic.tipo_aplicacion==='presiembra'?'Presiembra':'Cultivo en pie'}</div></div>
  <div class="card"><div class="lbl">${aplic.tipo_aplicacion==='cultivo'?'Cultivo':'A sembrar'}</div><div class="val">${aplic.cultivo_actual||'—'}</div></div>
  ${aplic.cultivo_anterior?`<div class="card"><div class="lbl">Cultivo anterior</div><div class="val">${aplic.cultivo_anterior}</div></div>`:'<div></div>'}
</div>
<div style="font-size:11px;font-weight:700;color:#2E4F26;margin-bottom:6px;text-transform:uppercase;letter-spacing:.05em">Productos — orden de carga</div>
<table>
<thead><tr><th>#</th><th>Principio activo</th><th>Marca</th><th>Dosis/ha</th><th>Total</th><th>Precio/u</th><th>Costo/ha</th><th>EIQ</th></tr></thead>
<tbody>
${[...prods].sort((a,b)=>(a.orden_carga||99)-(b.orden_carga||99)).map((p,i)=>{
  const precio = getPrecioUnitario(p.producto, p.marca, movimientosAlm)
  const cpha = precio && p.cantidad_ha ? (precio*parseFloat(p.cantidad_ha)).toFixed(2) : '—'
  const eiq  = p.eiq_unitario || p.eiq || null
  return `<tr>
    <td><strong>${i+1}</strong></td>
    <td>${p.producto}</td>
    <td>${p.marca||'—'}</td>
    <td>${p.cantidad_ha ? parseFloat(p.cantidad_ha).toFixed(3)+' '+p.unidad+'/ha' : '—'}</td>
    <td><strong>${p.cantidad_total ? parseFloat(p.cantidad_total).toFixed(1)+' '+p.unidad : '—'}</strong></td>
    <td>${precio ? 'U$S '+parseFloat(precio).toFixed(3) : '—'}</td>
    <td>${cpha !== '—' ? 'U$S '+cpha : '—'}</td>
    <td>${eiq || '—'}</td>
  </tr>`}).join('')}
</tbody></table>
<div class="tot">
  ${costoProds>0?`<div class="tot-card" style="background:#EBF4E8;border:1px solid #9DC87A">
    <div class="lbl">Costo productos/ha</div>
    <div class="val" style="color:#2E4F26">U$S ${costoProds.toFixed(2)}</div>
    ${sup>0?`<div style="font-size:10px;color:#4A7C3F">Total: U$S ${(costoProds*sup).toFixed(0)}</div>`:''}
  </div>`:''}
  ${costoLabor>0?`<div class="tot-card" style="background:#EFECE4;border:1px solid #C8A96E">
    <div class="lbl">Costo labor/ha</div>
    <div class="val" style="color:#6B3E22">U$S ${costoLabor.toFixed(2)}</div>
    ${sup>0?`<div style="font-size:10px;color:#8B6A4A">Total: U$S ${(costoLabor*sup).toFixed(0)}</div>`:''}
  </div>`:''}
  ${costoTotal>0?`<div class="tot-card" style="background:#F5EDD8;border:1px solid #C8A96E">
    <div class="lbl">Costo total/ha</div>
    <div class="val" style="color:#6B3E22">U$S ${costoTotal.toFixed(2)}</div>
    ${sup>0?`<div style="font-size:10px;color:#8B6A4A">Total lote: U$S ${(costoTotal*sup).toFixed(0)}</div>`:''}
  </div>`:''}
  ${eiqTotal>0?`<div class="tot-card" style="background:#E4F0F4;border:1px solid #7A9EAD">
    <div class="lbl">EIQ total lote</div>
    <div class="val" style="color:#2C5A6A">${eiqTotal.toFixed(0)}</div>
    ${sup>0?`<div style="font-size:10px;color:#4E7A8A">${(eiqTotal/sup).toFixed(1)}/ha</div>`:''}
  </div>`:''}
</div>
${aplic.observaciones?`<div style="margin-top:12px;padding:8px 10px;background:#F5F0E8;border-radius:5px;font-size:11px"><strong>Obs:</strong> ${aplic.observaciones}</div>`:''}
<div class="footer">Generado el ${new Date().toLocaleDateString('es-AR')} · ${aplic.quien_registro||''}</div>
<script>window.onload=()=>window.print()</script>
</body></html>`

  const w = window.open('','_blank'); w.document.write(html); w.document.close()
}

// ── PDF Maquinista ─────────────────────────────────────────────────────────────
function generarPDFMaquinista(aplic, prods, tancadas, mapImg) {
  const sup = parseFloat(aplic.superficie_ha)||0
  const prodsSorted = [...prods].sort((a,b)=>(a.orden_carga||99)-(b.orden_carga||99))

  const tanRows = tancadas.filter(t => parseFloat(t.ha)>0)
  const tablaHtml = tanRows.length > 0 ? `
    <table style="width:100%;border-collapse:collapse;margin-top:10px;font-size:11px">
      <thead>
        <tr style="background:#2E4F26;color:white">
          <th style="padding:6px 8px;text-align:left">Producto / Marca</th>
          <th style="padding:6px 8px;text-align:center">Dosis/ha</th>
          ${tanRows.map((t,i)=>`<th style="padding:6px 8px;text-align:right">Tancada ${i+1}<br><span style="font-weight:400;font-size:9px">${parseFloat(t.ha).toFixed(1)} ha</span></th>`).join('')}
          <th style="padding:6px 8px;text-align:right">TOTAL</th>
        </tr>
      </thead>
      <tbody>
        ${prodsSorted.map(p => {
          const dosis = parseFloat(p.cantidad_ha)||0
          const totals = tanRows.map(t => dosis * parseFloat(t.ha))
          const total  = totals.reduce((a,b)=>a+b,0)
          return `<tr style="border-bottom:1px solid #E8D5A3">
            <td style="padding:6px 8px;font-weight:500">${p.producto}${p.marca?' <span style="color:#8B6A4A;font-size:10px">'+p.marca+'</span>':''}</td>
            <td style="padding:6px 8px;text-align:center;color:#555">${dosis.toFixed(3)} ${p.unidad}/ha</td>
            ${totals.map(v=>`<td style="padding:6px 8px;text-align:right;font-weight:600">${v.toFixed(1)} ${p.unidad}</td>`).join('')}
            <td style="padding:6px 8px;text-align:right;font-weight:700;color:#2E4F26">${total.toFixed(1)} ${p.unidad}</td>
          </tr>`
        }).join('')}
        <tr style="background:#F5F0E8;font-weight:700">
          <td colspan="2" style="padding:6px 8px">Superficie / tancada</td>
          ${tanRows.map(t=>`<td style="padding:6px 8px;text-align:right">${parseFloat(t.ha).toFixed(1)} ha</td>`).join('')}
          <td style="padding:6px 8px;text-align:right">${tanRows.reduce((s,t)=>s+parseFloat(t.ha),0).toFixed(1)} ha</td>
        </tr>
      </tbody>
    </table>` : `
    <table style="width:100%;border-collapse:collapse;margin-top:10px;font-size:11px">
      <thead><tr style="background:#2E4F26;color:white">
        <th style="padding:6px 8px;text-align:left">#</th>
        <th style="padding:6px 8px">Producto</th>
        <th style="padding:6px 8px">Marca</th>
        <th style="padding:6px 8px;text-align:right">Dosis/ha</th>
        <th style="padding:6px 8px;text-align:right">Total (${sup} ha)</th>
      </tr></thead>
      <tbody>
        ${prodsSorted.map((p,i)=>{
          const dosis = parseFloat(p.cantidad_ha)||0
          return `<tr style="border-bottom:1px solid #E8D5A3">
            <td style="padding:6px 8px"><strong>${i+1}</strong></td>
            <td style="padding:6px 8px;font-weight:500">${p.producto}</td>
            <td style="padding:6px 8px;color:#8B6A4A">${p.marca||'—'}</td>
            <td style="padding:6px 8px;text-align:right">${dosis.toFixed(3)} ${p.unidad}/ha</td>
            <td style="padding:6px 8px;text-align:right;font-weight:700">${(dosis*sup).toFixed(1)} ${p.unidad}</td>
          </tr>`
        }).join('')}
      </tbody>
    </table>`

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>Orden de trabajo — ${aplic.lote||'Sin lote'}</title>
<style>*{box-sizing:border-box}body{font-family:Arial,sans-serif;margin:0;padding:20px;color:#2C1A0E;font-size:12px}
.header{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:10px;border-bottom:2px solid #4A7C3F;margin-bottom:14px}
.grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:12px}
.card{background:#F5F0E8;border:1px solid #D8C9A8;border-radius:5px;padding:8px 10px}
.lbl{font-size:9px;text-transform:uppercase;letter-spacing:.05em;color:#8B6A4A;font-weight:600;margin-bottom:1px}
.val{font-size:13px;font-weight:600}
.footer{margin-top:16px;font-size:9px;color:#999;border-top:1px solid #E8D5A3;padding-top:8px}
@media print{body{padding:12px}}</style></head><body>
<div class="header">
  <div>
    <div style="font-size:18px;font-weight:800;color:#4A7C3F">🌾 ORDEN DE TRABAJO</div>
    <div style="font-size:11px;color:#888;margin-top:2px">${fmtFecha(aplic.fecha)} &mdash; Para el maquinista</div>
  </div>
  <div style="text-align:right">
    <div style="font-size:20px;font-weight:700;color:#4A7C3F">${aplic.lote||'—'}</div>
    <div style="font-size:12px;color:#888">${sup?sup.toLocaleString('es-AR')+' ha':'—'}</div>
  </div>
</div>
${mapImg?`<div style="text-align:center;margin-bottom:14px"><img src="${mapImg}" style="max-width:100%;max-height:200px;border:1px solid #D8C9A8;border-radius:6px"/></div>`:''}
<div class="grid">
  <div class="card"><div class="lbl">Tipo de aplicación</div><div class="val">${aplic.tipo_aplicacion==='barbecho'?'Barbecho':aplic.tipo_aplicacion==='presiembra'?'Presiembra':'Cultivo en pie'}</div></div>
  <div class="card"><div class="lbl">Cultivo</div><div class="val">${aplic.cultivo_actual||'—'}</div></div>
  <div class="card"><div class="lbl">Superficie</div><div class="val">${sup?sup+' ha':'—'}</div></div>
</div>
<div style="font-size:11px;font-weight:700;color:#2E4F26;margin-bottom:4px;text-transform:uppercase;letter-spacing:.05em">
  ${tanRows.length>0?'Calculadora de tancadas':'Productos — dosis y cantidades totales'}
</div>
${tablaHtml}
${aplic.observaciones?`<div style="margin-top:12px;padding:8px 10px;background:#F5F0E8;border-radius:5px;font-size:11px"><strong>Obs:</strong> ${aplic.observaciones}</div>`:''}
<div class="footer">Generado el ${new Date().toLocaleDateString('es-AR')} &mdash; Sin costos (uso interno maquinista)</div>
<script>window.onload=()=>window.print()</script>
</body></html>`

  const w = window.open('','_blank'); w.document.write(html); w.document.close()
}

// ── DividirProducto ─────────────────────────────────────────────────────────
function DividirProducto({ prod, sup, ordenId, ordenFecha, descontado, quien, onSave, onCancel }) {
  const total = parseFloat(prod.cantidad_total) || 0
  const [marca1, setMarca1] = useState(prod.marca || '')
  const [cant1,  setCant1]  = useState(total)
  const [marca2, setMarca2] = useState('')
  const [cant2,  setCant2]  = useState(0)
  const [saving, setSaving] = useState(false)
  const si = {padding:'5px 8px',border:'1px solid #7A9EAD',borderRadius:5,fontSize:12,fontFamily:'inherit',background:'white'}
  const suma = parseFloat(cant1||0) + parseFloat(cant2||0)
  const ok   = Math.abs(suma - total) < 0.01

  async function save() {
    if (!ok) { alert(`La suma (${suma.toFixed(1)}) debe ser ${total} ${prod.unidad}`); return }
    setSaving(true)
    const dosis1 = sup > 0 ? parseFloat(cant1)/sup : 0
    const dosis2 = sup > 0 ? parseFloat(cant2)/sup : 0
    await supabase.from('ordenes_agroquimicos_productos').update({
      marca: marca1, cantidad_ha: parseFloat(dosis1.toFixed(4)), cantidad_total: parseFloat(cant1)
    }).eq('id', prod.id)
    if (parseFloat(cant2) > 0 && marca2) {
      await supabase.from('ordenes_agroquimicos_productos').insert({
        orden_id: ordenId, producto: prod.producto, marca: marca2,
        cantidad_ha: parseFloat(dosis2.toFixed(4)), cantidad_total: parseFloat(cant2),
        unidad: prod.unidad, orden_carga: prod.orden_carga, eiq_unitario: prod.eiq_unitario || null,
      })
    }
    if (descontado) {
      const hoy = ordenFecha || new Date().toISOString().split('T')[0]
      // Borrar TODOS los movimientos de este producto en esta orden (cualquier marca)
      await supabase.from('almacen_movimientos')
        .delete()
        .eq('aplicacion_id', ordenId)
        .ilike('producto', prod.producto)
      if (parseFloat(cant1) > 0) await supabase.from('almacen_movimientos').insert({
        fecha: hoy, tipo: 'salida_aplicacion', producto: prod.producto, marca: marca1,
        cantidad: parseFloat(cant1), unidad: prod.unidad, aplicacion_id: ordenId, quien_registro: quien, observaciones: 'División de marcas'
      })
      if (parseFloat(cant2) > 0 && marca2) await supabase.from('almacen_movimientos').insert({
        fecha: hoy, tipo: 'salida_aplicacion', producto: prod.producto, marca: marca2,
        cantidad: parseFloat(cant2), unidad: prod.unidad, aplicacion_id: ordenId, quien_registro: quien, observaciones: 'División de marcas'
      })
    }
    setSaving(false); onSave()
  }

  return (
    <div style={{marginTop:8,padding:'10px 12px',background:'#E4F0F4',borderRadius:8,border:'1px solid #7A9EAD'}}>
      <div style={{fontSize:10,fontWeight:600,color:'#2C5A6A',textTransform:'uppercase',marginBottom:8}}>
        ✂ Dividir {prod.producto} — Total: {total} {prod.unidad}
        {descontado && <span style={{marginLeft:8,color:'#993C1D',fontSize:9}}>⚠ actualiza almacén automáticamente</span>}
      </div>
      <div style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'flex-end',marginBottom:6}}>
        <div>
          <div style={{fontSize:9,color:'#2C5A6A',marginBottom:2}}>Marca 1</div>
          <input value={marca1} onChange={e=>setMarca1(e.target.value)} style={{...si,width:110}} placeholder='Ej: TRASPECT'/>
        </div>
        <div>
          <div style={{fontSize:9,color:'#2C5A6A',marginBottom:2}}>Cant. 1 ({prod.unidad})</div>
          <input type='number' step='0.1' value={cant1} onChange={e=>setCant1(e.target.value)} style={{...si,width:80}}/>
        </div>
        <div style={{alignSelf:'center',fontSize:13,color:'var(--text-muted)',paddingBottom:2}}>+</div>
        <div>
          <div style={{fontSize:9,color:'#2C5A6A',marginBottom:2}}>Marca 2</div>
          <input value={marca2} onChange={e=>setMarca2(e.target.value)} style={{...si,width:110}} placeholder='Ej: SELECT'/>
        </div>
        <div>
          <div style={{fontSize:9,color:'#2C5A6A',marginBottom:2}}>Cant. 2 ({prod.unidad})</div>
          <input type='number' step='0.1' value={cant2} onChange={e=>setCant2(e.target.value)} style={{...si,width:80}}/>
        </div>
        <div style={{alignSelf:'center',paddingBottom:2}}>
          <div style={{fontSize:11,fontWeight:700,color:ok?'#2E4F26':'#993C1D'}}>{suma.toFixed(1)} / {total} {prod.unidad}</div>
          {!ok&&<div style={{fontSize:9,color:'#993C1D'}}>deben sumar {total}</div>}
        </div>
      </div>
      {sup>0&&<div style={{fontSize:10,color:'var(--text-muted)',marginBottom:8}}>
        Dosis: {cant1&&sup?(parseFloat(cant1)/sup).toFixed(4):0} / {cant2&&sup?(parseFloat(cant2)/sup).toFixed(4):0} {prod.unidad}/ha
      </div>}
      <div style={{display:'flex',gap:6}}>
        <button onClick={save} disabled={saving||!ok} style={{padding:'5px 12px',background:'var(--pasto)',color:'white',border:'none',borderRadius:5,fontSize:11,cursor:'pointer',fontFamily:'inherit'}}>
          {saving?'Guardando...':'✂ Confirmar división'}
        </button>
        <button onClick={onCancel} style={{padding:'5px 10px',background:'transparent',border:'1px solid var(--border)',borderRadius:5,fontSize:11,cursor:'pointer',fontFamily:'inherit'}}>
          Cancelar
        </button>
      </div>
    </div>
  )
}

// ── OrdenCard — tarjeta con edición inline campo por campo ────────────────────
function OrdenCard({ a, prods, movsAlm, productosAlm, canEdit, quien, onRefresh, onDelete, onDescontar, onRevertir, onPDF }) {
  const [editando, setEditando] = useState(null)
  const [val, setVal]           = useState('')
  const [saving, setSaving]     = useState(false)
  const [pdfModal, setPdfModal] = useState(false)
  const [tancadas, setTancadas] = useState([{ha:''},{ha:''}])
  const [tipoPDF, setTipoPDF]   = useState('completo')  // 'completo' | 'maquinista'
  const mapaRef = useRef()
  const [nuevoProd, setNuevoProd] = useState({ producto_id:'', producto:'', marca:'', cantidad_ha:'', unidad:'L', eiq:'', orden_carga:'' })

  function setNP(k,v) {
    setNuevoProd(prev => {
      const next = {...prev,[k]:v}
      if (k==='producto_id') {
        const pr = (productosAlm||[]).find(x=>x.id===v)
        if (pr) { next.producto=pr.producto; next.marca=pr.marca||''; next.unidad=pr.unidad||'L'; next.eiq=pr.eiq||'' }
      }
      return next
    })
  }

  async function agregarProducto() {
    if (!nuevoProd.producto || !nuevoProd.cantidad_ha) { alert('Completá al menos el producto y la dosis por hectárea.'); return }
    setSaving(true)
    const sup2  = parseFloat(a.superficie_ha)||0
    const dosis = parseFloat(nuevoProd.cantidad_ha)||0
    const total = sup2 && dosis ? parseFloat((dosis*sup2).toFixed(2)) : null
    const ordenCarga = nuevoProd.orden_carga
      ? parseInt(nuevoProd.orden_carga)
      : (prods.length ? Math.max(...prods.map(p=>p.orden_carga||0))+1 : 1)

    const { error } = await supabase.from('ordenes_agroquimicos_productos').insert({
      orden_id:       a.id,
      producto_id:    nuevoProd.producto_id || null,
      producto:       nuevoProd.producto,
      marca:          nuevoProd.marca || null,
      cantidad_ha:    dosis || null,
      cantidad_total: total,
      unidad:         nuevoProd.unidad,
      orden_carga:    ordenCarga,
      eiq_unitario:   nuevoProd.eiq ? parseFloat(nuevoProd.eiq) : null,
    })
    if (error) { setSaving(false); alert('Error al agregar el producto: '+error.message); return }

    // Si la orden ya fue descontada del almacén, regenerar los movimientos
    await resincronizarMovimientos(a)

    setSaving(false)
    setNuevoProd({ producto_id:'', producto:'', marca:'', cantidad_ha:'', unidad:'L', eiq:'', orden_carga:'' })
    setEditando(null)
    onRefresh()
  }

  async function eliminarProducto(p) {
    if (!confirm(`¿Eliminar "${p.producto}${p.marca?' · '+p.marca:''}" de esta orden?`)) return
    setSaving(true)
    await supabase.from('ordenes_agroquimicos_productos').delete().eq('id', p.id)
    // Si la orden ya fue descontada, regenerar los movimientos del almacén
    await resincronizarMovimientos(a)
    setSaving(false); setEditando(null); onRefresh()
  }

  // Regenera los movimientos de salida del almacén a partir de los productos
  // actuales de la orden. Es la única fuente de verdad: borra los movimientos
  // previos de esta aplicación y los vuelve a crear con los datos vigentes.
  async function resincronizarMovimientos(orden) {
    if (!orden.descontado_almacen) return
    const { data: pp } = await supabase.from('ordenes_agroquimicos_productos').select('*').eq('orden_id', orden.id)
    await supabase.from('almacen_movimientos').delete().eq('aplicacion_id', orden.id)
    const inserts = (pp||[])
      .filter(p => p.cantidad_total && parseFloat(p.cantidad_total) > 0)
      .map(p => {
        const key = (p.producto||'').toLowerCase()
        const movsProd = movsAlm.filter(m => (m.producto||'').toLowerCase()===key && (m.tipo==='compra'||m.tipo==='stock_inicial'))
        const ppu = movsProd.length
          ? movsProd.reduce((s,m)=>s+(m.precio_unitario||0)*m.cantidad,0) / movsProd.reduce((s,m)=>s+m.cantidad,0)
          : null
        const cant = parseFloat(p.cantidad_total)
        return {
          fecha:           orden.fecha,
          tipo:            'salida_aplicacion',
          producto_id:     p.producto_id || null,
          producto:        p.producto,
          marca:           p.marca || null,
          cantidad:        cant,
          unidad:          p.unidad,
          precio_unitario: ppu || null,
          precio_total:    ppu ? ppu*cant : null,
          aplicacion_id:   orden.id,
          quien_registro:  quien,
          observaciones:   `Aplicación: ${orden.lote||''} ${orden.fecha}`,
        }
      })
    if (inserts.length) await supabase.from('almacen_movimientos').insert(inserts)
  }

  const sup        = parseFloat(a.superficie_ha)||0
  const costoLabor = parseFloat(a.costo_ha_usd)||0
  const costoProds = prods.reduce((s,p) => {
    const precio = getPrecioUnitario(p.producto, p.marca, movsAlm)
    return s + (precio && p.cantidad_ha ? precio*parseFloat(p.cantidad_ha) : 0)
  },0)
  const costoTotalHa = costoLabor + costoProds
  const eiqTotal = prods.reduce((s,p) => {
    const eiq = parseFloat(p.eiq || p.eiq_unitario)||0
    return s + (p.cantidad_ha ? parseFloat(p.cantidad_ha)*eiq*(sup||1) : 0)
  },0)

  function abrirEditor(campo, valorActual) { setEditando(campo); setVal(valorActual ?? '') }
  function cancelar() { setEditando(null); setVal('') }

  async function guardarCampo(campo, valor) {
    setSaving(true)
    await supabase.from('ordenes_agroquimicos').update({ [campo]: valor ?? null }).eq('id', a.id)
    // Si cambia la superficie, recalcular el total de cada producto (dosis × sup)
    if (campo === 'superficie_ha') {
      const supN = parseFloat(valor)||0
      const { data: pp } = await supabase.from('ordenes_agroquimicos_productos').select('id,cantidad_ha').eq('orden_id', a.id)
      for (const pr of (pp||[])) {
        const d = parseFloat(pr.cantidad_ha)||0
        await supabase.from('ordenes_agroquimicos_productos')
          .update({ cantidad_total: supN&&d ? parseFloat((d*supN).toFixed(2)) : null })
          .eq('id', pr.id)
      }
    }
    // Regenerar los movimientos del almacén con los datos nuevos de la orden
    await resincronizarMovimientos({ ...a, [campo]: valor })
    setSaving(false); setEditando(null); onRefresh()
  }

  const CULTIVOS_OPT = ['Soja','Maíz','Trigo','Girasol','Sorgo','Campo natural','Barbecho']
  const TIPOS_OPT    = [['barbecho','Barbecho'],['presiembra','Presiembra'],['cultivo','Cultivo']]
  const tipoLabel = a.tipo_aplicacion==='barbecho'?'Barbecho':a.tipo_aplicacion==='presiembra'?'Presiembra':'Cultivo'
  const tipoBg    = a.tipo_aplicacion==='barbecho'?'#FAF5EC':a.tipo_aplicacion==='presiembra'?'#EBF4E8':'#E4F0F4'
  const tipoColor = a.tipo_aplicacion==='barbecho'?'#6B3E22':a.tipo_aplicacion==='presiembra'?'#2E4F26':'#2C5A6A'
  const si = {padding:'4px 7px',border:'1px solid #7A9EAD',borderRadius:5,fontSize:11,fontFamily:'inherit',background:'white'}

  // Botones de guardado
  const BtnOk  = ({ onClick }) => <button onClick={onClick} disabled={saving} style={{padding:'3px 7px',background:'var(--pasto)',color:'white',border:'none',borderRadius:4,fontSize:10,cursor:'pointer'}}>{saving?'...':'✓'}</button>
  const BtnX   = () => <button onClick={cancelar} style={{padding:'3px 6px',background:'#F5F0E8',border:'1px solid #D8C9A8',borderRadius:4,fontSize:10,cursor:'pointer'}}>✕</button>
  const EditBtn = ({ campo, label, valor }) => (
    <button onClick={()=>abrirEditor(campo, valor)}
      style={{padding:'2px 7px',border:'1px solid #D8C9A8',borderRadius:20,fontSize:10,cursor:'pointer',background:'#F5F0E8',color:'var(--arcilla)',fontFamily:'inherit'}}>
      ✏ {label}
    </button>
  )

  return (
    <div style={{background:'#FDFAF4',border:'1px solid #D8C9A8',borderRadius:12,padding:'14px 16px'}}>

      {/* Header */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8}}>
        <div style={{flex:1,minWidth:0}}>

          {/* Lote + Tipo */}
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4,flexWrap:'wrap'}}>
            {editando==='lote' ? (
              <span style={{display:'inline-flex',alignItems:'center',gap:4}}>
                <input autoFocus value={val} onChange={e=>setVal(e.target.value)}
                  style={{...si,width:180}} placeholder="Nombre del lote"
                  onKeyDown={e=>{if(e.key==='Enter')guardarCampo('lote',val);if(e.key==='Escape')cancelar()}}/>
                <BtnOk onClick={()=>guardarCampo('lote',val)}/><BtnX/>
              </span>
            ) : (
              <span onClick={canEdit?()=>abrirEditor('lote',a.lote):undefined}
                style={{fontSize:14,fontWeight:700,color:'var(--tierra)',cursor:canEdit?'pointer':undefined,borderBottom:canEdit?'1px dashed #C8A96E':undefined}}>
                {a.lote||'Sin lote'}
              </span>
            )}
            {editando==='tipo' ? (
              <span style={{display:'inline-flex',gap:4,flexWrap:'wrap'}}>
                {TIPOS_OPT.map(([v,l])=>(
                  <button key={v} onClick={()=>guardarCampo('tipo_aplicacion',v)}
                    style={{padding:'2px 8px',borderRadius:20,fontSize:10,cursor:'pointer',border:'1px solid',fontFamily:'inherit',
                      background:a.tipo_aplicacion===v?tipoColor:'transparent',
                      color:a.tipo_aplicacion===v?'white':tipoColor,borderColor:tipoColor}}>
                    {l}
                  </button>
                ))}
                <BtnX/>
              </span>
            ) : (
              <span onClick={canEdit?()=>abrirEditor('tipo',a.tipo_aplicacion):undefined}
                style={{fontSize:10,background:tipoBg,color:tipoColor,borderRadius:20,padding:'2px 7px',fontWeight:600,
                  cursor:canEdit?'pointer':undefined,borderBottom:canEdit?'1px dashed '+tipoColor:undefined}}>
                {tipoLabel}
              </span>
            )}
          </div>

          {/* Fecha + Superficie + Cultivos */}
          <div style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'center',fontSize:11,color:'var(--text-muted)'}}>
            {editando==='fecha' ? (
              <span style={{display:'inline-flex',alignItems:'center',gap:4}}>
                <input autoFocus type="date" value={val} onChange={e=>setVal(e.target.value)} style={{...si,width:130}}
                  onKeyDown={e=>{if(e.key==='Enter')guardarCampo('fecha',val);if(e.key==='Escape')cancelar()}}/>
                <BtnOk onClick={()=>guardarCampo('fecha',val)}/><BtnX/>
              </span>
            ) : (
              <span onClick={canEdit?()=>abrirEditor('fecha',a.fecha):undefined}
                style={{fontWeight:500,cursor:canEdit?'pointer':undefined,borderBottom:canEdit?'1px dashed #C8A96E':undefined}}>
                {fmtFecha(a.fecha)}
              </span>
            )}
            ·
            {editando==='superficie' ? (
              <span style={{display:'inline-flex',alignItems:'center',gap:4}}>
                <input autoFocus type="number" step="0.01" value={val} onChange={e=>setVal(e.target.value)} style={{...si,width:70}}
                  onKeyDown={e=>{if(e.key==='Enter')guardarCampo('superficie_ha',parseFloat(val)||null);if(e.key==='Escape')cancelar()}}/>
                <span style={{fontSize:10}}>ha</span>
                <BtnOk onClick={()=>guardarCampo('superficie_ha',parseFloat(val)||null)}/><BtnX/>
              </span>
            ) : (
              <span onClick={canEdit?()=>abrirEditor('superficie',a.superficie_ha):undefined}
                style={{cursor:canEdit?'pointer':undefined,borderBottom:canEdit?'1px dashed #C8A96E':undefined}}>
                {a.superficie_ha ? a.superficie_ha+' ha' : '— ha'}
              </span>
            )}
            {a.cultivo_actual && <><span>·</span><span>{a.cultivo_actual}</span></>}
            {a.cultivo_anterior && <span>(sobre {a.cultivo_anterior})</span>}
          </div>

          {/* Editor cultivos */}
          {editando==='cultivos' && (
            <div style={{marginTop:8,padding:'8px 10px',background:'#E4F0F4',borderRadius:8,display:'flex',gap:10,flexWrap:'wrap',alignItems:'flex-end'}}>
              <div>
                <div style={{fontSize:9,color:'#2C5A6A',textTransform:'uppercase',marginBottom:3}}>Cultivo anterior</div>
                <select value={a.cultivo_anterior||''} style={si}
                  onChange={e=>supabase.from('ordenes_agroquimicos').update({cultivo_anterior:e.target.value||null}).eq('id',a.id).then(()=>onRefresh())}>
                  <option value="">—</option>
                  {CULTIVOS_OPT.map(c=><option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <div style={{fontSize:9,color:'#2C5A6A',textTransform:'uppercase',marginBottom:3}}>Cultivo actual/a sembrar</div>
                <select value={a.cultivo_actual||''} style={si}
                  onChange={e=>supabase.from('ordenes_agroquimicos').update({cultivo_actual:e.target.value||null}).eq('id',a.id).then(()=>onRefresh())}>
                  <option value="">—</option>
                  {CULTIVOS_OPT.map(c=><option key={c}>{c}</option>)}
                </select>
              </div>
              <button onClick={cancelar} style={{padding:'4px 10px',background:'var(--pasto)',color:'white',border:'none',borderRadius:5,fontSize:11,cursor:'pointer',fontFamily:'inherit'}}>✓ Listo</button>
            </div>
          )}
        </div>

        {/* Botones acción */}
        <div style={{display:'flex',gap:4,flexShrink:0,flexWrap:'wrap',justifyContent:'flex-end',marginLeft:8}}>
          <button onClick={()=>setPdfModal(true)}
            style={{padding:'4px 8px',background:'#4A7C3F',color:'white',border:'none',borderRadius:6,fontSize:11,cursor:'pointer',fontFamily:'inherit'}}>
            📄
          </button>
          {canEdit && <>
            {!a.descontado_almacen ? (
              <button onClick={()=>onDescontar(a)} title="Descontar del almacén"
                style={{padding:'4px 8px',background:'#7A9EAD',color:'white',border:'none',borderRadius:6,fontSize:11,cursor:'pointer',fontFamily:'inherit'}}>
                ↓
              </button>
            ) : (
              <button onClick={()=>onRevertir(a)} title="Revertir descuento"
                style={{padding:'4px 8px',background:'#EBF4E8',color:'#2E4F26',border:'1px solid #9DC87A',borderRadius:6,fontSize:11,cursor:'pointer',fontFamily:'inherit'}}>
                ✓
              </button>
            )}
            <button onClick={()=>onDelete(a.id)}
              style={{padding:'4px 8px',background:'#FAECE7',border:'1px solid #F0997B',borderRadius:6,fontSize:11,cursor:'pointer',color:'#993C1D',fontFamily:'inherit'}}>
              🗑
            </button>
          </>}
        </div>
      </div>

      {/* Botones edición rápida */}
      {canEdit && editando===null && (
        <div style={{display:'flex',gap:4,marginBottom:10,flexWrap:'wrap'}}>
          <EditBtn campo="fecha"      label="Fecha"      valor={a.fecha}/>
          <EditBtn campo="lote"       label="Lote"       valor={a.lote}/>
          <EditBtn campo="superficie" label="Sup."       valor={a.superficie_ha}/>
          <EditBtn campo="tipo"       label="Tipo"       valor={a.tipo_aplicacion}/>
          <EditBtn campo="cultivos"   label="Cultivos"   valor={''}/>
          <EditBtn campo="costo"      label="Costo/ha"   valor={a.costo_ha_usd}/>
          <EditBtn campo="obs"        label="Obs."       valor={a.observaciones}/>
        </div>
      )}

      {/* Editor costo labor */}
      {editando==='costo' && (
        <div style={{marginBottom:8,display:'inline-flex',alignItems:'center',gap:6,padding:'5px 10px',background:'#FFF9EE',borderRadius:7,border:'1px solid #C8A96E'}}>
          <span style={{fontSize:11}}>Costo labor U$S/ha:</span>
          <input autoFocus type="number" step="0.01" value={val} onChange={e=>setVal(e.target.value)}
            style={{...si,width:80}} placeholder="0.00"
            onKeyDown={e=>{if(e.key==='Enter')guardarCampo('costo_ha_usd',parseFloat(val)||null);if(e.key==='Escape')cancelar()}}/>
          <BtnOk onClick={()=>guardarCampo('costo_ha_usd',parseFloat(val)||null)}/><BtnX/>
        </div>
      )}

      {/* Editor observaciones */}
      {editando==='obs' && (
        <div style={{marginBottom:8,display:'flex',alignItems:'center',gap:6,padding:'5px 10px',background:'#FFF9EE',borderRadius:7,border:'1px solid #C8A96E'}}>
          <input autoFocus value={val} onChange={e=>setVal(e.target.value)}
            style={{...si,flex:1}} placeholder="Observaciones..."
            onKeyDown={e=>{if(e.key==='Enter')guardarCampo('observaciones',val);if(e.key==='Escape')cancelar()}}/>
          <BtnOk onClick={()=>guardarCampo('observaciones',val)}/><BtnX/>
        </div>
      )}

      {/* Productos */}
      {(prods.length > 0 || canEdit) && (
        <div style={{background:'#F0F6FA',borderRadius:8,padding:'8px 12px',marginBottom:8}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
            <div style={{fontSize:9,fontWeight:600,color:'#2C5A6A',textTransform:'uppercase',letterSpacing:'0.05em'}}>Productos — orden de carga</div>
            {canEdit&&editando===null&&(
              <button onClick={()=>{setEditando('nuevo_producto');setNuevoProd({ producto_id:'', producto:'', marca:'', cantidad_ha:'', unidad:'L', eiq:'', orden_carga:'' })}}
                style={{padding:'3px 10px',background:'white',border:'1px solid #7A9EAD',borderRadius:6,fontSize:11,cursor:'pointer',color:'#2C5A6A',fontFamily:'inherit'}}>
                + Agregar producto
              </button>
            )}
          </div>
          {prods.length===0&&editando!=='nuevo_producto'&&(
            <div style={{fontSize:11,color:'var(--text-muted)',padding:'2px 0 6px'}}>Sin productos cargados todavía.</div>
          )}
          {prods.map((p,i)=>{
            const precio = getPrecioUnitario(p.producto, p.marca, movsAlm)
            const eiq = parseFloat(p.eiq || p.eiq_unitario)||0
            const editandoProd = editando === p.id
            const dividiendo   = editando === 'dividir_'+p.id
            return (
              <div key={p.id||i} style={{padding:'5px 0',borderBottom:i<prods.length-1?'1px solid #B8D0D8':'none'}}>
                {!editandoProd ? (
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <span style={{width:20,height:20,borderRadius:'50%',background:'#2C5A6A',color:'white',display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700,flexShrink:0}}>{i+1}</span>
                    <div style={{flex:1,minWidth:0}}>
                      <span style={{fontWeight:500,color:'var(--tierra)',fontSize:12}}>{p.producto}</span>
                      {p.marca&&<span style={{color:'var(--arcilla)',fontSize:11}}> · {p.marca}</span>}
                    </div>
                    <div style={{display:'flex',alignItems:'center',gap:5,flexWrap:'wrap'}}>
                      <span style={{fontSize:11,fontWeight:600}}>{p.cantidad_ha} {p.unidad}/ha</span>
                      {p.cantidad_total&&<span style={{fontSize:10,color:'var(--text-muted)'}}>· {parseFloat(p.cantidad_total).toFixed(1)} total</span>}
                      {precio&&<span style={{fontSize:10,background:'#EBF4E8',color:'#2E4F26',borderRadius:20,padding:'1px 6px',whiteSpace:'nowrap'}}>U$S {(precio*parseFloat(p.cantidad_ha||0)).toFixed(2)}/ha</span>}
                      {eiq>0&&<span style={{fontSize:10,background:'#E4F0F4',color:'#2C5A6A',borderRadius:20,padding:'1px 6px'}}>EIQ {eiq}</span>}
                      {canEdit&&editando===null&&(
                        <button onClick={()=>abrirEditor(p.id, p.cantidad_ha)}
                          style={{padding:'1px 6px',border:'1px solid #B8D0D8',borderRadius:4,fontSize:9,cursor:'pointer',background:'white',color:'#2C5A6A',fontFamily:'inherit'}}>
                          ✏
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div style={{background:'white',borderRadius:7,padding:'8px 10px',border:'1px solid #7A9EAD'}}>
                    <div style={{fontSize:10,fontWeight:600,color:'#2C5A6A',marginBottom:6}}>{p.producto}</div>
                    <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'flex-end'}}>
                      <div>
                        <div style={{fontSize:9,color:'#2C5A6A',marginBottom:2}}>Marca</div>
                        <input defaultValue={p.marca||''}
                          style={{...si,width:100}} id={`marca_${p.id}`} placeholder="marca"/>
                      </div>
                      <div>
                        <div style={{fontSize:9,color:'#2C5A6A',marginBottom:2}}>Dosis/ha</div>
                        <input autoFocus type="number" step="0.001" value={val} onChange={e=>setVal(e.target.value)}
                          style={{...si,width:75}} placeholder="0.000"
                          onKeyDown={e=>{if(e.key==='Escape')cancelar()}}/>
                      </div>
                      <div>
                        <div style={{fontSize:9,color:'#2C5A6A',marginBottom:2}}>EIQ</div>
                        <input type="number" step="0.1" defaultValue={p.eiq_unitario||p.eiq||''}
                          style={{...si,width:58}} id={`eiq_${p.id}`} placeholder="—"/>
                      </div>
                      <div>
                        <div style={{fontSize:9,color:'#2C5A6A',marginBottom:2}}>Orden carga</div>
                        <input type="number" defaultValue={p.orden_carga||''}
                          style={{...si,width:48}} id={`ord_${p.id}`} placeholder={i+1}/>
                      </div>
                      {sup > 0 && val && (
                        <div style={{fontSize:10,color:'var(--text-muted)',alignSelf:'flex-end',paddingBottom:4}}>
                          → {(parseFloat(val)*sup).toFixed(1)} {p.unidad} total
                        </div>
                      )}
                      <div style={{display:'flex',gap:4,alignSelf:'flex-end'}}>
                        <button onClick={async()=>{
                          setSaving(true)
                          const dosis   = parseFloat(val)||null
                          const marcaEl = document.getElementById(`marca_${p.id}`)
                          const eiqEl   = document.getElementById(`eiq_${p.id}`)
                          const ordEl   = document.getElementById(`ord_${p.id}`)
                          await supabase.from('ordenes_agroquimicos_productos').update({
                            marca:         marcaEl?.value || p.marca,
                            cantidad_ha:   dosis,
                            cantidad_total: dosis&&sup ? parseFloat((dosis*sup).toFixed(2)) : p.cantidad_total,
                            eiq_unitario:  eiqEl?.value ? parseFloat(eiqEl.value) : null,
                            orden_carga:   ordEl?.value ? parseInt(ordEl.value)   : null,
                          }).eq('id', p.id)
                          // Si la orden ya fue descontada, regenerar los movimientos del almacén
                          await resincronizarMovimientos(a)
                          setSaving(false); setEditando(null); onRefresh()
                        }} disabled={saving}
                          style={{padding:'4px 10px',background:'var(--pasto)',color:'white',border:'none',borderRadius:5,fontSize:11,cursor:'pointer',fontFamily:'inherit'}}>
                          {saving?'...':'✓ Guardar'}
                        </button>
                        <button onClick={cancelar}
                          style={{padding:'4px 8px',background:'#F5F0E8',border:'1px solid #D8C9A8',borderRadius:5,fontSize:11,cursor:'pointer',fontFamily:'inherit'}}>
                          Cancelar
                        </button>
                        <button onClick={async()=>{
                          // Dividir en dos marcas: muestra sub-editor
                          setEditando('dividir_'+p.id)
                        }}
                          style={{padding:'4px 8px',background:'#E4F0F4',border:'1px solid #7A9EAD',borderRadius:5,fontSize:11,cursor:'pointer',color:'#2C5A6A',fontFamily:'inherit'}}>
                          ✂ Dividir
                        </button>
                        <button onClick={()=>eliminarProducto(p)} disabled={saving}
                          style={{padding:'4px 8px',background:'#FAECE7',border:'1px solid #F0997B',borderRadius:5,fontSize:11,cursor:'pointer',color:'#993C1D',fontFamily:'inherit'}}>
                          🗑 Eliminar
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                {dividiendo && (
                  <DividirProducto prod={p} sup={sup} ordenId={a.id} ordenFecha={a.fecha} descontado={a.descontado_almacen} quien={quien}
                    onSave={async()=>{ setEditando(null); onRefresh() }}
                    onCancel={cancelar}
                  />
                )}
              </div>
            )
          })}
          {editando==='nuevo_producto' && (
            <div style={{background:'white',borderRadius:7,padding:'10px 12px',marginTop:6,border:'1px solid #7A9EAD'}}>
              <div style={{fontSize:10,fontWeight:600,color:'#2C5A6A',marginBottom:8}}>Agregar producto a esta orden</div>
              <div style={{display:'flex',gap:6,flexWrap:'wrap',alignItems:'flex-end'}}>
                <div style={{flex:'1 1 220px',minWidth:180}}>
                  <div style={{fontSize:9,color:'#2C5A6A',marginBottom:2}}>Del catálogo</div>
                  <select value={nuevoProd.producto_id} onChange={e=>setNP('producto_id',e.target.value)}
                    style={{width:'100%',padding:'5px',border:'1px solid #B8D0D8',borderRadius:5,fontSize:12,fontFamily:'inherit',background:'#FDFAF4'}}>
                    <option value="">— Seleccionar o escribir abajo —</option>
                    {(productosAlm||[]).map(pr=>(
                      <option key={pr.id} value={pr.id}>{pr.producto}{pr.marca?' · '+pr.marca:''}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div style={{display:'flex',gap:6,flexWrap:'wrap',alignItems:'flex-end',marginTop:6}}>
                <div style={{flex:2,minWidth:120}}>
                  <div style={{fontSize:9,color:'#2C5A6A',marginBottom:2}}>Principio activo</div>
                  <input value={nuevoProd.producto} onChange={e=>setNP('producto',e.target.value)} placeholder="Ej: Glifosato"
                    style={{width:'100%',padding:'5px 7px',border:'1px solid #B8D0D8',borderRadius:5,fontSize:12,fontFamily:'inherit'}}/>
                </div>
                <div style={{flex:1,minWidth:90}}>
                  <div style={{fontSize:9,color:'#2C5A6A',marginBottom:2}}>Marca</div>
                  <input value={nuevoProd.marca} onChange={e=>setNP('marca',e.target.value)} placeholder="Marca"
                    style={{width:'100%',padding:'5px 7px',border:'1px solid #B8D0D8',borderRadius:5,fontSize:12,fontFamily:'inherit'}}/>
                </div>
                <div>
                  <div style={{fontSize:9,color:'#2C5A6A',marginBottom:2}}>Dosis/ha</div>
                  <input type="number" step="0.001" value={nuevoProd.cantidad_ha} onChange={e=>setNP('cantidad_ha',e.target.value)} placeholder="0.000"
                    style={{width:80,padding:'5px 7px',border:'1px solid #B8D0D8',borderRadius:5,fontSize:12,fontFamily:'inherit'}}/>
                </div>
                <div>
                  <div style={{fontSize:9,color:'#2C5A6A',marginBottom:2}}>Unidad</div>
                  <select value={nuevoProd.unidad} onChange={e=>setNP('unidad',e.target.value)}
                    style={{width:64,padding:'5px',border:'1px solid #B8D0D8',borderRadius:5,fontSize:12,fontFamily:'inherit'}}>
                    {UNIDADES.map(u=><option key={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{fontSize:9,color:'#2C5A6A',marginBottom:2}}>EIQ</div>
                  <input type="number" step="0.1" value={nuevoProd.eiq} onChange={e=>setNP('eiq',e.target.value)} placeholder="—"
                    style={{width:58,padding:'5px 6px',border:'1px solid #B8D0D8',borderRadius:5,fontSize:12,fontFamily:'inherit',background:'#E4F0F4'}}/>
                </div>
                <div>
                  <div style={{fontSize:9,color:'#2C5A6A',marginBottom:2}}>Orden</div>
                  <input type="number" value={nuevoProd.orden_carga} onChange={e=>setNP('orden_carga',e.target.value)} placeholder={String(prods.length?Math.max(...prods.map(p=>p.orden_carga||0))+1:1)}
                    style={{width:48,padding:'5px 6px',border:'1px solid #B8D0D8',borderRadius:5,fontSize:12,fontFamily:'inherit'}}/>
                </div>
                {sup>0&&nuevoProd.cantidad_ha&&(
                  <div style={{fontSize:10,color:'var(--text-muted)',alignSelf:'flex-end',paddingBottom:4}}>
                    → {(parseFloat(nuevoProd.cantidad_ha)*sup).toFixed(1)} {nuevoProd.unidad} total
                  </div>
                )}
              </div>
              {a.descontado_almacen&&(
                <div style={{fontSize:10,color:'#993C1D',marginTop:6}}>⚠ Esta orden ya fue descontada del almacén — al agregar el producto también se descuenta del stock.</div>
              )}
              <div style={{display:'flex',gap:6,marginTop:8}}>
                <button onClick={agregarProducto} disabled={saving}
                  style={{padding:'5px 12px',background:'var(--pasto)',color:'white',border:'none',borderRadius:5,fontSize:11,cursor:'pointer',fontFamily:'inherit'}}>
                  {saving?'Guardando...':'✓ Agregar'}
                </button>
                <button onClick={cancelar}
                  style={{padding:'5px 10px',background:'#F5F0E8',border:'1px solid #D8C9A8',borderRadius:5,fontSize:11,cursor:'pointer',fontFamily:'inherit'}}>
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Totales */}
      <div style={{display:'flex',gap:6,flexWrap:'wrap',alignItems:'center'}}>
        {costoProds>0&&<div style={{background:'#EBF4E8',borderRadius:7,padding:'4px 9px',fontSize:11}}><span style={{color:'#2E4F26'}}>Prod: <strong>U$S {costoProds.toFixed(2)}/ha</strong></span></div>}
        {costoLabor>0 ? (
          <div onClick={canEdit&&editando===null?()=>abrirEditor('costo',a.costo_ha_usd):undefined}
            title={canEdit?"Click para editar":undefined}
            style={{background:'#EFECE4',borderRadius:7,padding:'4px 9px',fontSize:11,cursor:canEdit&&editando===null?'pointer':undefined}}>
            <span style={{color:'#6B3E22'}}>Labor: <strong>U$S {costoLabor.toFixed(2)}/ha</strong></span>
          </div>
        ) : canEdit&&editando===null ? (
          <button onClick={()=>abrirEditor('costo','')}
            style={{background:'#EFECE4',borderRadius:7,padding:'4px 9px',fontSize:11,border:'1px dashed #D8C9A8',cursor:'pointer',fontFamily:'inherit',color:'var(--arcilla)'}}>
            + Costo labor
          </button>
        ) : null}
        {costoTotalHa>0&&sup>0&&<div style={{background:'#F5EDD8',borderRadius:7,padding:'4px 9px',fontSize:11}}><span style={{color:'#6B3E22'}}>Total: <strong>U$S {costoTotalHa.toFixed(2)}/ha</strong>{sup>0&&<span style={{fontWeight:400}}> · U$S {(costoTotalHa*sup).toFixed(0)}</span>}</span></div>}
        {eiqTotal>0&&<div style={{background:'#E4F0F4',borderRadius:7,padding:'4px 9px',fontSize:11}}><span style={{color:'#2C5A6A'}}>EIQ: <strong>{eiqTotal.toFixed(0)}</strong>{sup>0&&<span style={{fontWeight:400}}> ({(eiqTotal/sup).toFixed(1)}/ha)</span>}</span></div>}
        {a.observaciones&&editando===null&&<div style={{fontSize:11,color:'var(--text-muted)',alignSelf:'center'}}>{a.observaciones}</div>}
      </div>

      {/* ── MODAL PDF ── */}
      {pdfModal&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.55)',zIndex:500,display:'flex',alignItems:'center',justifyContent:'center'}}
          onClick={e=>e.target===e.currentTarget&&setPdfModal(false)}>
          <div style={{background:'white',borderRadius:14,padding:20,width:'min(96vw,720px)',maxHeight:'90vh',overflowY:'auto',boxShadow:'0 12px 48px rgba(0,0,0,0.25)'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
              <div style={{fontWeight:700,fontSize:15,color:'var(--tierra)'}}>📄 Exportar PDF — {a.lote}</div>
              <button onClick={()=>setPdfModal(false)} style={{padding:'4px 10px',background:'#FAECE7',border:'1px solid #F0997B',borderRadius:6,fontSize:12,cursor:'pointer',color:'#993C1D'}}>Cerrar</button>
            </div>

            {/* Tipo de PDF */}
            <div style={{display:'flex',gap:8,marginBottom:14}}>
              {[['completo','📋 Completo (con costos)'],['maquinista','🚜 Maquinista (sin costos)']].map(([v,l])=>(
                <button key={v} onClick={()=>setTipoPDF(v)}
                  style={{flex:1,padding:'8px 12px',borderRadius:8,border:'2px solid',fontSize:12,cursor:'pointer',fontFamily:'inherit',
                    background:tipoPDF===v?'#EBF4E8':'white',
                    borderColor:tipoPDF===v?'var(--pasto)':'#D8C9A8',
                    color:tipoPDF===v?'#2E4F26':'var(--arcilla)',fontWeight:tipoPDF===v?600:400}}>
                  {l}
                </button>
              ))}
            </div>

            {/* Mapa */}
            <div style={{marginBottom:14}}>
              <div style={{fontSize:11,fontWeight:600,color:'var(--tierra)',marginBottom:6,textTransform:'uppercase',letterSpacing:'0.05em'}}>Mapa del lote</div>
              <MapaLote
                ref={mapaRef}
                lotesResaltados={a.lote?.toLowerCase().includes('3')||(a.lote?.toLowerCase().includes('casco')&&!a.lote?.toLowerCase().includes('grande'))?[1,2]:a.lote?.toLowerCase().includes('grande')||a.lote?.toLowerCase().includes('lote 3')?[3]:[1,2,3]}
                editable={true}
                width={Math.min(660, typeof window!=='undefined'?window.innerWidth-80:660)}
                height={300}
              />
              <div style={{fontSize:10,color:'var(--text-muted)',marginTop:4}}>Tip: usá "✏ Dibujar zona parcial" para marcar solo parte del lote en el PDF.</div>
            </div>

            {/* Calculadora tancadas (solo modo maquinista) */}
            {tipoPDF==='maquinista'&&(
              <div style={{marginBottom:14,padding:'10px 14px',background:'#F5F0E8',borderRadius:8,border:'1px solid #D8C9A8'}}>
                <div style={{fontSize:11,fontWeight:600,color:'var(--tierra)',marginBottom:8,textTransform:'uppercase',letterSpacing:'0.05em'}}>Calculadora de tancadas</div>
                <div style={{fontSize:11,color:'var(--text-muted)',marginBottom:8}}>Superficie total: <strong>{a.superficie_ha} ha</strong></div>
                {tancadas.map((t,i)=>(
                  <div key={i} style={{display:'flex',gap:8,alignItems:'center',marginBottom:6}}>
                    <span style={{fontSize:11,minWidth:70,color:'var(--arcilla)'}}>Tancada {i+1}</span>
                    <input type="number" step="0.5" min="0" value={t.ha} placeholder="ha"
                      onChange={e=>setTancadas(ts=>ts.map((x,j)=>j===i?{...x,ha:e.target.value}:x))}
                      style={{width:80,padding:'4px 8px',border:'1px solid #D8C9A8',borderRadius:5,fontSize:12,fontFamily:'inherit'}}/>
                    <span style={{fontSize:11,color:'var(--text-muted)'}}>ha</span>
                    {tancadas.length>1&&<button onClick={()=>setTancadas(ts=>ts.filter((_,j)=>j!==i))} style={{padding:'2px 6px',background:'#FAECE7',border:'1px solid #F0997B',borderRadius:4,fontSize:10,cursor:'pointer',color:'#993C1D'}}>✕</button>}
                  </div>
                ))}
                <button onClick={()=>setTancadas(ts=>[...ts,{ha:''}])}
                  style={{padding:'4px 10px',background:'transparent',border:'1px dashed #D8C9A8',borderRadius:5,fontSize:11,cursor:'pointer',color:'var(--arcilla)',fontFamily:'inherit'}}>
                  + Agregar tancada
                </button>
                {tancadas.some(t=>parseFloat(t.ha)>0)&&(
                  <div style={{marginTop:8,padding:'6px 10px',background:'white',borderRadius:5,fontSize:11}}>
                    <strong>Vista previa:</strong> {prods.sort((a,b)=>(a.orden_carga||99)-(b.orden_carga||99)).map(p=>(
                      <span key={p.id} style={{marginRight:12}}>{p.producto}: {tancadas.filter(t=>parseFloat(t.ha)>0).map((t,i)=>(
                        <span key={i}><em>T{i+1}</em>={(parseFloat(p.cantidad_ha)||0)*parseFloat(t.ha)).toFixed(1)} {p.unidad} </span>
                      ))}</span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Botón generar */}
            <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
              <button onClick={async()=>{
                const mapImg = await mapaRef.current?.capturar()
                if (tipoPDF==='maquinista') {
                  generarPDFMaquinista(a, prods, tancadas, mapImg)
                } else {
                  onPDF(a, prods, mapImg)
                }
                setPdfModal(false)
              }} style={{padding:'8px 20px',background:'var(--pasto)',color:'white',border:'none',borderRadius:8,fontSize:13,cursor:'pointer',fontFamily:'inherit',fontWeight:600}}>
                📄 Generar PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Aplicaciones principal ────────────────────────────────────────────────────
export default function Aplicaciones() {
  const { user, puedeEditar, isAdmin } = useAuth()
  const canEdit = isAdmin || puedeEditar('aplicaciones')
  const quien = user?.user_metadata?.nombre || user?.email || ''

  const [ordenes, setOrdenes]         = useState([])
  const [prodsPorOrden, setProdsPorOrden] = useState({})
  const [productosAlm, setProductosAlm]   = useState([])
  const [movsAlm, setMovsAlm]             = useState([])
  const [loading, setLoading]             = useState(true)
  const [showForm, setShowForm]           = useState(false)
  const [editOrden, setEditOrden]         = useState(null)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [{ data: ords }, { data: pp }, { data: pAlm }, { data: mAlm }] = await Promise.all([
      supabase.from('ordenes_agroquimicos').select('*').order('fecha', { ascending: false }),
      supabase.from('ordenes_agroquimicos_productos').select('*, almacen_productos(eiq, unidad)'),
      supabase.from('almacen_productos').select('*').eq('activo', true).order('producto'),
      supabase.from('almacen_movimientos').select('producto,marca,tipo,precio_unitario,fecha,cantidad,unidad,producto_id,aplicacion_id').order('fecha', {ascending:false}),
    ])
    setOrdenes(ords || [])
    const byOrden = {}
    ;(pp||[]).forEach(p => {
      if (!byOrden[p.orden_id]) byOrden[p.orden_id] = []
      byOrden[p.orden_id].push({
        ...p,
        eiq: p.almacen_productos?.eiq || p.eiq_unitario || null,
        unidad: p.unidad || p.almacen_productos?.unidad || 'L'
      })
    })
    setProdsPorOrden(byOrden)
    setProductosAlm(pAlm || [])
    setMovsAlm(mAlm || [])
    setLoading(false)
  }

  // Stock actual
  const stockActual = {}
  movsAlm.forEach(m => {
    if (!m.producto_id) return
    if (!stockActual[m.producto_id]) stockActual[m.producto_id] = 0
    stockActual[m.producto_id] += m.tipo === 'salida_aplicacion' ? -Math.abs(m.cantidad) : m.cantidad
  })

  async function descontarAlmacen(orden) {
    const prods = prodsPorOrden[orden.id] || []
    if (prods.length === 0) { alert('Esta orden no tiene productos cargados'); return }
    if (!confirm(`¿Descontar del almacén los productos de esta aplicación (${orden.lote}, ${orden.fecha})?`)) return

    // Calcular precio promedio ponderado de cada producto desde almacén
    const movsPorProducto = {}
    movsAlm.forEach(m => {
      if (!m.producto) return
      const key = m.producto.toLowerCase()
      if (!movsPorProducto[key]) movsPorProducto[key] = []
      movsPorProducto[key].push(m)
    })

    const inserts = prods
      .filter(p => p.cantidad_total && p.cantidad_total > 0)
      .map(p => {
        const key = p.producto?.toLowerCase()
        const movsProd = (movsPorProducto[key] || []).filter(m => m.tipo === 'compra' || m.tipo === 'stock_inicial')
        const ppu = movsProd.length > 0
          ? movsProd.reduce((a,m) => a + (m.precio_unitario||0)*m.cantidad, 0) /
            movsProd.reduce((a,m) => a + m.cantidad, 0)
          : null
        return {
          fecha: orden.fecha,
          tipo: 'salida_aplicacion',
          producto_id: p.producto_id || null,
          producto: p.producto,
          marca: p.marca || null,
          cantidad: parseFloat(p.cantidad_total),
          unidad: p.unidad,
          precio_unitario: ppu || null,
          precio_total: ppu ? ppu * parseFloat(p.cantidad_total) : null,
          aplicacion_id: orden.id,
          quien_registro: quien,
          observaciones: `Aplicación: ${orden.lote} ${orden.fecha}`,
        }
      })

    // Insertar movimientos de salida
    const { error } = await supabase.from('almacen_movimientos').insert(inserts)
    if (error) { alert('Error: ' + error.message); return }

    // Marcar orden como descontada
    await supabase.from('ordenes_agroquimicos').update({
      descontado_almacen: true,
      fecha_descuento: new Date().toISOString().split('T')[0]
    }).eq('id', orden.id)

    await fetchAll()
  }

  async function revertirDescuento(orden) {
    if (!confirm('¿Revertir el descuento del almacén? Se eliminarán los movimientos de salida de esta aplicación.')) return
    await supabase.from('almacen_movimientos').delete().eq('aplicacion_id', orden.id)
    await supabase.from('ordenes_agroquimicos').update({ descontado_almacen: false, fecha_descuento: null }).eq('id', orden.id)
    await fetchAll()
  }

  async function deleteOrden(id) {
    if (!confirm('¿Eliminar esta orden?')) return
    await supabase.from('ordenes_agroquimicos').delete().eq('id', id)
    await fetchAll()
  }

  return (
    <div>
      <div className="flex-between mb-2">
        <div>
          <h2>Aplicaciones</h2>
          <p style={{fontSize:12,color:'var(--arcilla)',marginTop:2}}>{ordenes.length} órdenes de aplicación</p>
        </div>
        {canEdit && (
          <button className="btn btn-primary btn-sm" onClick={()=>{setShowForm(v=>!v);setEditOrden(null)}}>
            {showForm&&!editOrden?'Cancelar':'+ Nueva orden'}
          </button>
        )}
      </div>

      {(showForm||editOrden) && canEdit && (
        <FormAplicacion
          key={editOrden?.id||'new'}
          aplic={editOrden}
          productosAlmacen={productosAlm}
          movimientosAlm={movsAlm}
          stockActual={stockActual}
          quienRegistra={quien}
          onSave={async()=>{ setShowForm(false); setEditOrden(null); await fetchAll() }}
          onCancel={()=>{ setShowForm(false); setEditOrden(null) }}
        />
      )}

      {loading ? <div style={{padding:32,textAlign:'center',color:'var(--arcilla)'}}>Cargando...</div>
      : ordenes.length === 0 ? <div style={{padding:32,textAlign:'center',color:'var(--arcilla)'}}>Sin órdenes de aplicación</div>
      : (
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          {ordenes.map(a => {
            const prods = (prodsPorOrden[a.id]||[]).sort((x,y)=>(x.orden_carga||99)-(y.orden_carga||99))
            return (
              <OrdenCard key={a.id} a={a} prods={prods} movsAlm={movsAlm} productosAlm={productosAlm} canEdit={canEdit} quien={quien}
                onRefresh={fetchAll}
                onDelete={deleteOrden}
                onDescontar={descontarAlmacen}
                onRevertir={revertirDescuento}
                onPDF={(orden,ps,mapImg)=>generarPDF(orden, ps, movsAlm, mapImg)}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
