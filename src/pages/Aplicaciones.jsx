import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
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
          </div>
        )}
        {form.tipo_aplicacion==='cultivo' && (
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
function generarPDF(aplic, prods, movimientosAlm) {
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
      supabase.from('almacen_movimientos').select('producto,marca,tipo,precio_unitario,fecha,cantidad,unidad,producto_id').order('fecha', {ascending:false}),
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
            const sup   = parseFloat(a.superficie_ha)||0
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

            return (
              <div key={a.id} style={{background:'#FDFAF4',border:'1px solid #D8C9A8',borderRadius:12,padding:'14px 16px'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10}}>
                  <div>
                    <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:3}}>
                      <span style={{fontSize:14,fontWeight:700,color:'var(--tierra)'}}>{a.lote||'Sin lote'}</span>
                      <span style={{fontSize:10,background:a.tipo_aplicacion==='barbecho'?'#FAF5EC':a.tipo_aplicacion==='presiembra'?'#EBF4E8':'#E4F0F4',
                        color:a.tipo_aplicacion==='barbecho'?'#6B3E22':a.tipo_aplicacion==='presiembra'?'#2E4F26':'#2C5A6A',
                        borderRadius:20,padding:'2px 7px',fontWeight:600}}>
                        {a.tipo_aplicacion==='barbecho'?'Barbecho':a.tipo_aplicacion==='presiembra'?'Presiembra':'Cultivo'}
                      </span>
                    </div>
                    <div style={{fontSize:11,color:'var(--text-muted)'}}>
                      {fmtFecha(a.fecha)}{a.superficie_ha&&<> · {a.superficie_ha} ha</>}
                      {a.cultivo_actual&&<> · {a.cultivo_actual}</>}
                      {a.cultivo_anterior&&<> (sobre {a.cultivo_anterior})</>}
                    </div>
                  </div>
                  <div style={{display:'flex',gap:5,flexShrink:0}}>
                    <button onClick={()=>generarPDF(a, prods, movsAlm)}
                      style={{padding:'4px 9px',background:'#4A7C3F',color:'white',border:'none',borderRadius:6,fontSize:11,cursor:'pointer',fontFamily:'inherit'}}>
                      📄 PDF
                    </button>
                    {canEdit && <>
                      <button onClick={()=>{setEditOrden(a);setShowForm(false)}}
                        style={{padding:'4px 9px',background:'transparent',border:'1px solid var(--border)',borderRadius:6,fontSize:11,cursor:'pointer',color:'var(--arcilla)',fontFamily:'inherit'}}>
                        Editar
                      </button>
                      <button onClick={()=>deleteOrden(a.id)}
                        style={{padding:'4px 9px',background:'#FAECE7',border:'1px solid #F0997B',borderRadius:6,fontSize:11,cursor:'pointer',color:'#993C1D',fontFamily:'inherit'}}>
                        🗑
                      </button>
                    </>}
                  </div>
                </div>

                {/* Productos */}
                {prods.length > 0 && (
                  <div style={{background:'#F0F6FA',borderRadius:8,padding:'8px 12px',marginBottom:8}}>
                    <div style={{fontSize:9,fontWeight:600,color:'#2C5A6A',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:6}}>Productos — orden de carga</div>
                    {prods.map((p,i)=>{
                      const precio = getPrecioUnitario(p.producto, p.marca, movsAlm)
                      const eiq = parseFloat(p.eiq || p.eiq_unitario)||0
                      return (
                        <div key={i} style={{display:'flex',alignItems:'center',gap:8,padding:'4px 0',borderBottom:i<prods.length-1?'1px solid #B8D0D8':'none'}}>
                          <span style={{width:20,height:20,borderRadius:'50%',background:'#2C5A6A',color:'white',display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700,flexShrink:0}}>{i+1}</span>
                          <div style={{flex:1}}>
                            <span style={{fontWeight:500,color:'var(--tierra)',fontSize:12}}>{p.producto}</span>
                            {p.marca&&<span style={{color:'var(--arcilla)',fontSize:11}}> · {p.marca}</span>}
                          </div>
                          <div style={{textAlign:'right',fontSize:11}}>
                            <span style={{fontWeight:600}}>{p.cantidad_ha} {p.unidad}/ha</span>
                            {p.cantidad_total&&<span style={{color:'var(--text-muted)'}}> · {parseFloat(p.cantidad_total).toFixed(1)} total</span>}
                          </div>
                          {precio&&<span style={{fontSize:10,background:'#EBF4E8',color:'#2E4F26',borderRadius:20,padding:'1px 6px',whiteSpace:'nowrap'}}>U$S {(precio*parseFloat(p.cantidad_ha||0)).toFixed(2)}/ha</span>}
                          {eiq>0&&<span style={{fontSize:10,background:'#E4F0F4',color:'#2C5A6A',borderRadius:20,padding:'1px 6px'}}>EIQ {eiq}</span>}
                          {!precio&&p.producto&&<span style={{fontSize:10,color:'#F0997B'}}>sin precio</span>}
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Totales */}
                <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                  {costoProds>0&&<div style={{background:'#EBF4E8',borderRadius:7,padding:'5px 10px',fontSize:11}}><span style={{color:'#2E4F26'}}>Productos: <strong>U$S {costoProds.toFixed(2)}/ha</strong></span></div>}
                  {costoLabor>0&&<div style={{background:'#EFECE4',borderRadius:7,padding:'5px 10px',fontSize:11}}><span style={{color:'#6B3E22'}}>Labor: <strong>U$S {costoLabor.toFixed(2)}/ha</strong></span></div>}
                  {costoTotalHa>0&&sup>0&&<div style={{background:'#F5EDD8',borderRadius:7,padding:'5px 10px',fontSize:11}}><span style={{color:'#6B3E22'}}>Total: <strong>U$S {costoTotalHa.toFixed(2)}/ha · U$S {(costoTotalHa*sup).toFixed(0)} lote</strong></span></div>}
                  {eiqTotal>0&&<div style={{background:'#E4F0F4',borderRadius:7,padding:'5px 10px',fontSize:11}}><span style={{color:'#2C5A6A'}}>EIQ: <strong>{eiqTotal.toFixed(0)}</strong>{sup>0&&<> ({(eiqTotal/sup).toFixed(1)}/ha)</>}</span></div>}
                  {a.observaciones&&<div style={{fontSize:11,color:'var(--text-muted)',alignSelf:'center'}}>{a.observaciones}</div>}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
