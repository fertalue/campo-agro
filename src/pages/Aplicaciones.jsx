import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

const CULTIVOS     = ['Soja','Maíz','Trigo','Girasol','Sorgo']
const TIPOS_APLIC  = [
  { id:'barbecho',   label:'Barbecho' },
  { id:'presiembra', label:'Presiembra' },
  { id:'cultivo',    label:'Cultivo' },
]
const ORDEN_CARGA_REGLAS = [
  { patron:/mojante|adherente|sil[iy]/i, orden:1, label:'Mojantes/siliconas' },
  { patron:/sulfato|fosfato|nitrato/i, orden:2, label:'Fertilizantes/sales' },
  { patron:/WG|WP|polvo/i, orden:3, label:'Polvos (WG/WP)' },
  { patron:/SC|SL|flowable|suspens/i, orden:4, label:'Suspensiones (SC)' },
  { patron:/EC|emuls/i, orden:5, label:'Emulsionables (EC)' },
  { patron:/./, orden:6, label:'Otros' },
]

function fmtFecha(f) {
  if (!f) return '—'
  return new Date(f+'T12:00:00').toLocaleDateString('es-AR',{day:'2-digit',month:'short',year:'2-digit'})
}

function calcOrdenCarga(producto, marca) {
  const texto = (producto||'') + ' ' + (marca||'')
  for (const r of ORDEN_CARGA_REGLAS) {
    if (r.patron.test(texto)) return r.orden
  }
  return 6
}

// ── FormAplicacion ─────────────────────────────────────────────────────────
function FormAplicacion({ aplic, productosAlmacen, stockActual, quienRegistra, onSave, onCancel }) {
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
  const [prods, setProds] = useState(aplic ? [] : [
    { producto_id:'', producto:'', marca:'', cantidad_ha:'', unidad:'L', orden_carga:6 }
  ])
  const [saving, setSaving] = useState(false)
  const f = (k,v) => setForm(p=>({...p,[k]:v}))

  function updateProd(i,k,v) {
    setProds(prev => prev.map((p,idx) => {
      if (idx !== i) return p
      const next = {...p,[k]:v}
      if (k==='producto_id') {
        const prod = productosAlmacen.find(x=>x.id===v)
        if (prod) { next.producto=prod.producto; next.marca=prod.marca||''; next.unidad=prod.unidad||'L' }
      }
      if (k==='producto'||k==='marca') next.orden_carga = calcOrdenCarga(next.producto,next.marca)
      return next
    }))
  }
  function addProd() {
    setProds(prev=>[...prev,{producto_id:'',producto:'',marca:'',cantidad_ha:'',unidad:'L',orden_carga:6}])
  }
  function removeProd(i) { setProds(prev=>prev.filter((_,idx)=>idx!==i)) }

  const prodsSorted = [...prods].sort((a,b)=>a.orden_carga-b.orden_carga)
  const superficieN = parseFloat(form.superficie_ha)||0
  const costoHaN    = parseFloat(form.costo_ha_usd)||0

  async function save(e) {
    e.preventDefault(); setSaving(true)
    const payload = {
      ...form,
      superficie_ha: superficieN||null,
      costo_ha_usd: costoHaN||null,
      quien_registro: quienRegistra,
      estado: 'borrador',
    }
    let aplicId
    if (isEdit) {
      await supabase.from('aplicaciones').update(payload).eq('id', aplic.id)
      aplicId = aplic.id
      await supabase.from('aplicaciones_productos').delete().eq('aplicacion_id', aplicId)
    } else {
      const { data } = await supabase.from('aplicaciones').insert(payload).select()
      aplicId = data[0].id
    }
    // Insertar productos
    const prodsPayload = prods.filter(p=>p.producto).map((p,i)=>({
      aplicacion_id: aplicId,
      producto_id: p.producto_id||null,
      producto: p.producto,
      marca: p.marca||null,
      cantidad_ha: parseFloat(p.cantidad_ha)||null,
      cantidad_total: superficieN && p.cantidad_ha ? superficieN * parseFloat(p.cantidad_ha) : null,
      unidad: p.unidad,
      orden_carga: p.orden_carga,
    }))
    if (prodsPayload.length) await supabase.from('aplicaciones_productos').insert(prodsPayload)
    setSaving(false); onSave()
  }

  const si = {padding:'7px 10px',border:'1px solid #D8C9A8',borderRadius:7,fontSize:13,fontFamily:'inherit',width:'100%',background:'#FDFAF4'}

  return (
    <div className="card mb-3" style={{background:'#F9F6EE',borderColor:'var(--paja)'}}>
      <h3 style={{marginBottom:14}}>{isEdit?'Editar orden':'Nueva orden de aplicación'}</h3>
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
          <div className="field"><label className="label">Costo de aplicación (U$S/ha)</label>
            <input style={si} type="number" step="0.01" value={form.costo_ha_usd} onChange={e=>f('costo_ha_usd',e.target.value)} placeholder="0.00"/>
            {costoHaN>0 && superficieN>0 && (
              <div style={{fontSize:11,color:'var(--musgo)',marginTop:3}}>Total: U$S {(costoHaN*superficieN).toLocaleString('es-AR',{minimumFractionDigits:0})}</div>
            )}
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
            <div className="field"><label className="label">Cultivo anterior (del que sale)</label>
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
            <div style={{fontSize:12,fontWeight:600,color:'#2C5A6A',textTransform:'uppercase',letterSpacing:'0.05em'}}>Productos a aplicar</div>
            <button type="button" onClick={addProd}
              style={{padding:'4px 12px',background:'white',border:'1px solid #7A9EAD',borderRadius:6,fontSize:12,cursor:'pointer',color:'#2C5A6A',fontFamily:'inherit'}}>
              + Agregar producto
            </button>
          </div>
          {prods.map((p,i)=>(
            <div key={i} style={{background:'white',borderRadius:8,padding:'10px 12px',marginBottom:8,border:'1px solid #B8D0D8'}}>
              <div style={{display:'flex',gap:8,marginBottom:6}}>
                <select value={p.producto_id} onChange={e=>updateProd(i,'producto_id',e.target.value)}
                  style={{flex:2,padding:'6px',border:'1px solid #B8D0D8',borderRadius:6,fontSize:12,fontFamily:'inherit',background:'#FDFAF4'}}>
                  <option value="">— Del catálogo (opcional) —</option>
                  {productosAlmacen.map(prod=>(
                    <option key={prod.id} value={prod.id}>
                      {prod.producto}{prod.marca?' · '+prod.marca:''}
                      {stockActual[prod.id] ? ' [Stock: '+stockActual[prod.id].toFixed(1)+' '+prod.unidad+']' : ' [Sin stock]'}
                    </option>
                  ))}
                </select>
                <button type="button" onClick={()=>removeProd(i)} disabled={prods.length===1}
                  style={{padding:'6px 10px',background:'#FAECE7',border:'1px solid #F0997B',borderRadius:6,fontSize:12,cursor:'pointer',color:'#993C1D',fontFamily:'inherit'}}>
                  ✕
                </button>
              </div>
              <div style={{display:'flex',gap:6}}>
                <input value={p.producto} onChange={e=>updateProd(i,'producto',e.target.value)}
                  placeholder="Principio activo" required
                  style={{flex:2,padding:'6px',border:'1px solid #B8D0D8',borderRadius:6,fontSize:12,fontFamily:'inherit'}}/>
                <input value={p.marca} onChange={e=>updateProd(i,'marca',e.target.value)}
                  placeholder="Marca"
                  style={{flex:1,padding:'6px',border:'1px solid #B8D0D8',borderRadius:6,fontSize:12,fontFamily:'inherit'}}/>
                <input type="number" step="0.001" value={p.cantidad_ha} onChange={e=>updateProd(i,'cantidad_ha',e.target.value)}
                  placeholder="Dosis/ha"
                  style={{width:80,padding:'6px',border:'1px solid #B8D0D8',borderRadius:6,fontSize:12,fontFamily:'inherit'}}/>
                <select value={p.unidad} onChange={e=>updateProd(i,'unidad',e.target.value)}
                  style={{width:70,padding:'6px',border:'1px solid #B8D0D8',borderRadius:6,fontSize:12,fontFamily:'inherit'}}>
                  {['L','cc','kg','g','unidad'].map(u=><option key={u}>{u}</option>)}
                </select>
              </div>
              {superficieN>0 && p.cantidad_ha && (
                <div style={{fontSize:11,color:'#2C5A6A',marginTop:5}}>
                  Total: <strong>{(superficieN*parseFloat(p.cantidad_ha)).toFixed(1)} {p.unidad}</strong>
                  <span style={{marginLeft:8,color:'var(--text-muted)'}}>· Orden de carga: {p.orden_carga}</span>
                </div>
              )}
            </div>
          ))}
          {/* Orden de carga recomendado */}
          {prods.filter(p=>p.producto).length > 1 && (
            <div style={{marginTop:10,padding:'8px 12px',background:'#E4F0F4',borderRadius:8}}>
              <div style={{fontSize:11,fontWeight:600,color:'#2C5A6A',marginBottom:6}}>Orden de carga recomendado:</div>
              {[...prods].filter(p=>p.producto).sort((a,b)=>a.orden_carga-b.orden_carga).map((p,i)=>(
                <div key={i} style={{fontSize:12,color:'#2C5A6A'}}>
                  {i+1}. {p.producto}{p.marca?' ('+p.marca+')':''}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="field"><label className="label">Observaciones</label>
          <textarea style={{...si,minHeight:56}} value={form.observaciones} onChange={e=>f('observaciones',e.target.value)} placeholder="Notas, condiciones climáticas, etc."/>
        </div>

        <div style={{display:'flex',gap:8}}>
          <button className="btn btn-primary" type="submit" disabled={saving}>{saving?'Guardando...':isEdit?'Guardar cambios':'Crear orden'}</button>
          <button className="btn btn-secondary" type="button" onClick={onCancel}>Cancelar</button>
        </div>
      </form>
    </div>
  )
}

// ── PDF de orden de aplicación ───────────────────────────────────────────────
function generarPDF(aplic, prods) {
  const superficieN = parseFloat(aplic.superficie_ha)||0
  const costoTotal  = superficieN && aplic.costo_ha_usd ? (superficieN * aplic.costo_ha_usd).toFixed(0) : '—'
  const eiqTotal    = prods.reduce((a,p)=>{
    const dosis = parseFloat(p.cantidad_ha)||0
    const eiq   = p.eiq || 0
    return a + dosis * eiq * superficieN
  },0)

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>Orden de aplicación</title>
<style>
  body{font-family:Arial,sans-serif;margin:0;padding:24px;color:#2C1A0E;font-size:13px}
  h1{font-size:18px;margin:0 0 4px 0;color:#2E4F26}
  .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;padding-bottom:12px;border-bottom:2px solid #4A7C3F}
  .logo{font-size:20px;font-weight:800;color:#4A7C3F;letter-spacing:-0.5px}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px}
  .card{background:#F5F0E8;border:1px solid #D8C9A8;border-radius:6px;padding:10px 12px}
  .label{font-size:10px;text-transform:uppercase;letter-spacing:0.05em;color:#8B6A4A;font-weight:600;margin-bottom:2px}
  .val{font-size:14px;font-weight:600;color:#2C1A0E}
  table{width:100%;border-collapse:collapse;margin-top:4px}
  th{background:#4A7C3F;color:white;padding:7px 10px;text-align:left;font-size:11px}
  td{padding:7px 10px;border-bottom:1px solid #E8D5A3;font-size:12px}
  tr:last-child td{border-bottom:none}
  .totales{margin-top:16px;display:flex;gap:12px}
  .tot{background:#EBF4E8;border:1px solid #9DC87A;border-radius:6px;padding:8px 12px;flex:1}
  .footer{margin-top:24px;font-size:10px;color:#888;border-top:1px solid #E8D5A3;padding-top:10px}
  @media print{body{padding:16px}.no-print{display:none}}
</style>
</head><body>
<div class="header">
  <div>
    <div class="logo">🌾 Campo</div>
    <h1>Orden de Aplicación</h1>
    <div style="color:#888;font-size:12px">${fmtFecha(aplic.fecha)}</div>
  </div>
  <div style="text-align:right">
    <div style="font-size:22px;font-weight:700;color:#4A7C3F">${aplic.lote||'—'}</div>
    <div style="font-size:13px;color:#888">${superficieN ? superficieN.toLocaleString('es-AR') + ' ha' : '—'}</div>
  </div>
</div>

<div class="grid">
  <div class="card"><div class="label">Tipo de aplicación</div><div class="val">${aplic.tipo_aplicacion==='barbecho'?'Barbecho':aplic.tipo_aplicacion==='presiembra'?'Presiembra':'Cultivo en pie'}</div></div>
  <div class="card"><div class="label">${aplic.tipo_aplicacion==='cultivo'?'Cultivo':'Cultivo a sembrar'}</div><div class="val">${aplic.cultivo_actual||'—'}</div></div>
  ${aplic.cultivo_anterior?`<div class="card"><div class="label">Cultivo anterior</div><div class="val">${aplic.cultivo_anterior}</div></div>`:''}
  <div class="card"><div class="label">Superficie</div><div class="val">${superficieN ? superficieN.toLocaleString('es-AR') + ' ha' : '—'}</div></div>
</div>

<div style="font-size:13px;font-weight:700;color:#2E4F26;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.05em">Productos — Orden de carga recomendado</div>
<table>
<thead><tr><th>#</th><th>Principio activo</th><th>Marca</th><th>Dosis/ha</th><th>Cantidad total</th><th>EIQ unitario</th></tr></thead>
<tbody>
${[...prods].sort((a,b)=>a.orden_carga-b.orden_carga).map((p,i)=>`
<tr>
  <td><strong>${i+1}</strong></td>
  <td>${p.producto}</td>
  <td>${p.marca||'—'}</td>
  <td>${p.cantidad_ha ? parseFloat(p.cantidad_ha).toFixed(2) + ' ' + p.unidad + '/ha' : '—'}</td>
  <td><strong>${p.cantidad_total ? parseFloat(p.cantidad_total).toFixed(1) + ' ' + p.unidad : '—'}</strong></td>
  <td>${p.eiq || '—'}</td>
</tr>`).join('')}
</tbody>
</table>

<div class="totales">
  ${aplic.costo_ha_usd ? `<div class="tot"><div class="label">Costo aplicación</div><div class="val">U$S ${parseFloat(aplic.costo_ha_usd).toLocaleString('es-AR',{minimumFractionDigits:2})}/ha</div><div style="font-size:11px;color:#4A7C3F">Total: U$S ${parseFloat(costoTotal).toLocaleString('es-AR')}</div></div>` : ''}
  ${eiqTotal > 0 ? `<div class="tot" style="background:#E4F0F4;border-color:#7A9EAD"><div class="label">EIQ total del lote</div><div class="val" style="color:#2C5A6A">${eiqTotal.toFixed(0)}</div><div style="font-size:11px;color:#2C5A6A">campo EIQ = dosis × EIQ × ha</div></div>` : ''}
</div>

${aplic.observaciones?`<div style="margin-top:16px;padding:10px 12px;background:#F5F0E8;border-radius:6px;font-size:12px"><strong>Observaciones:</strong> ${aplic.observaciones}</div>`:''}

<div class="footer">
  Generado el ${new Date().toLocaleDateString('es-AR')} · ${aplic.quien_registro||''}
</div>
<script>window.onload = () => window.print()</script>
</body></html>`

  const w = window.open('','_blank')
  w.document.write(html)
  w.document.close()
}

// ── Aplicaciones principal ───────────────────────────────────────────────────
export default function Aplicaciones() {
  const { user, puedeEditar, isAdmin } = useAuth()
  const canEdit = isAdmin || puedeEditar('aplicaciones')
  const quien = user?.user_metadata?.nombre || user?.email || ''

  const [aplicaciones, setAplicaciones] = useState([])
  const [prodsPorAplic, setProdsPorAplic] = useState({})
  const [productosAlm, setProductosAlm]   = useState([])
  const [movsAlm, setMovsAlm]             = useState([])
  const [loading, setLoading]             = useState(true)
  const [showForm, setShowForm]           = useState(false)
  const [editAplic, setEditAplic]         = useState(null)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [{ data: ap }, { data: pp }, { data: pAlm }, { data: mAlm }] = await Promise.all([
      supabase.from('aplicaciones').select('*').order('fecha', { ascending: false }),
      supabase.from('aplicaciones_productos').select('*, almacen_productos(eiq)'),
      supabase.from('almacen_productos').select('*').eq('activo', true).order('producto'),
      supabase.from('almacen_movimientos').select('producto_id,cantidad,tipo'),
    ])
    setAplicaciones(ap || [])
    const byAplic = {}
    ;(pp||[]).forEach(p => {
      if (!byAplic[p.aplicacion_id]) byAplic[p.aplicacion_id] = []
      byAplic[p.aplicacion_id].push({ ...p, eiq: p.almacen_productos?.eiq })
    })
    setProdsPorAplic(byAplic)
    setProductosAlm(pAlm || [])
    setMovsAlm(mAlm || [])
    setLoading(false)
  }

  // Stock actual por producto_id
  const stockActual = {}
  movsAlm.forEach(m => {
    if (!m.producto_id) return
    if (!stockActual[m.producto_id]) stockActual[m.producto_id] = 0
    stockActual[m.producto_id] += m.tipo === 'salida_aplicacion' ? -Math.abs(m.cantidad) : m.cantidad
  })

  async function deleteAplic(id) {
    if (!confirm('¿Eliminar esta orden?')) return
    await supabase.from('aplicaciones').delete().eq('id', id)
    await fetchAll()
  }

  return (
    <div>
      {/* Header */}
      <div className="flex-between mb-2">
        <div>
          <h2>Aplicaciones</h2>
          <p style={{fontSize:12,color:'var(--arcilla)',marginTop:2}}>
            {aplicaciones.length} órdenes de aplicación
          </p>
        </div>
        {canEdit && (
          <button className="btn btn-primary btn-sm" onClick={()=>{setShowForm(v=>!v);setEditAplic(null)}}>
            {showForm&&!editAplic?'Cancelar':'+ Nueva orden'}
          </button>
        )}
      </div>

      {/* Form */}
      {(showForm||editAplic) && canEdit && (
        <FormAplicacion
          key={editAplic?.id||'new'}
          aplic={editAplic}
          productosAlmacen={productosAlm}
          stockActual={stockActual}
          quienRegistra={quien}
          onSave={async()=>{ setShowForm(false); setEditAplic(null); await fetchAll() }}
          onCancel={()=>{ setShowForm(false); setEditAplic(null) }}
        />
      )}

      {/* Lista de órdenes */}
      {loading ? <div style={{padding:32,textAlign:'center',color:'var(--arcilla)'}}>Cargando...</div>
      : aplicaciones.length === 0 ? <div style={{padding:32,textAlign:'center',color:'var(--arcilla)'}}>Sin órdenes de aplicación</div>
      : (
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          {aplicaciones.map(a => {
            const prods = prodsPorAplic[a.id] || []
            const superficieN = parseFloat(a.superficie_ha)||0
            const eiqTotal = prods.reduce((sum,p)=>{
              const dosis = parseFloat(p.cantidad_ha)||0
              return sum + dosis*(p.eiq||0)*superficieN
            },0)
            return (
              <div key={a.id} style={{background:'#FDFAF4',border:'1px solid #D8C9A8',borderRadius:12,padding:'16px 18px'}}>
                {/* Header */}
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:12}}>
                  <div>
                    <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:4}}>
                      <span style={{fontSize:15,fontWeight:700,color:'var(--tierra)'}}>{a.lote||'Sin lote'}</span>
                      <span style={{fontSize:11,background:a.tipo_aplicacion==='barbecho'?'#FAF5EC':a.tipo_aplicacion==='presiembra'?'#EBF4E8':'#E4F0F4',
                        color:a.tipo_aplicacion==='barbecho'?'#6B3E22':a.tipo_aplicacion==='presiembra'?'#2E4F26':'#2C5A6A',
                        borderRadius:20,padding:'2px 8px',fontWeight:600}}>
                        {a.tipo_aplicacion==='barbecho'?'Barbecho':a.tipo_aplicacion==='presiembra'?'Presiembra':'Cultivo'}
                      </span>
                    </div>
                    <div style={{fontSize:12,color:'var(--text-muted)'}}>
                      {fmtFecha(a.fecha)}
                      {a.superficie_ha && <> · {a.superficie_ha} ha</>}
                      {a.cultivo_actual && <> · {a.cultivo_actual}</>}
                      {a.cultivo_anterior && <> (sobre {a.cultivo_anterior})</>}
                    </div>
                  </div>
                  <div style={{display:'flex',gap:6,flexShrink:0}}>
                    <button onClick={()=>generarPDF(a, prods)}
                      style={{padding:'5px 10px',background:'#4A7C3F',color:'white',border:'none',borderRadius:7,fontSize:11,cursor:'pointer',fontFamily:'inherit'}}>
                      📄 PDF
                    </button>
                    {canEdit && <>
                      <button onClick={()=>{setEditAplic(a);setShowForm(false)}}
                        style={{padding:'5px 10px',background:'transparent',border:'1px solid var(--border)',borderRadius:7,fontSize:11,cursor:'pointer',color:'var(--arcilla)',fontFamily:'inherit'}}>
                        Editar
                      </button>
                      <button onClick={()=>deleteAplic(a.id)}
                        style={{padding:'5px 10px',background:'#FAECE7',border:'1px solid #F0997B',borderRadius:7,fontSize:11,cursor:'pointer',color:'#993C1D',fontFamily:'inherit'}}>
                        🗑
                      </button>
                    </>}
                  </div>
                </div>

                {/* Productos */}
                {prods.length > 0 && (
                  <div style={{background:'#F0F6FA',borderRadius:8,padding:'10px 12px',marginBottom:10}}>
                    <div style={{fontSize:10,fontWeight:600,color:'#2C5A6A',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:8}}>Productos — orden de carga</div>
                    {[...prods].sort((a,b)=>a.orden_carga-b.orden_carga).map((p,i)=>(
                      <div key={i} style={{display:'flex',alignItems:'center',gap:10,padding:'4px 0',borderBottom:i<prods.length-1?'1px solid #B8D0D8':'none'}}>
                        <span style={{width:20,height:20,borderRadius:'50%',background:'#2C5A6A',color:'white',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,flexShrink:0}}>{i+1}</span>
                        <div style={{flex:1}}>
                          <span style={{fontWeight:500,color:'var(--tierra)'}}>{p.producto}</span>
                          {p.marca && <span style={{color:'var(--arcilla)',fontSize:11}}> · {p.marca}</span>}
                        </div>
                        <div style={{textAlign:'right',fontSize:12}}>
                          <span style={{fontWeight:600}}>{p.cantidad_ha} {p.unidad}/ha</span>
                          {p.cantidad_total && <span style={{color:'var(--text-muted)'}}> · {parseFloat(p.cantidad_total).toFixed(1)} {p.unidad} total</span>}
                        </div>
                        {p.eiq && <span style={{background:'#E4F0F4',color:'#2C5A6A',borderRadius:20,padding:'2px 7px',fontSize:10,fontWeight:600}}>EIQ {p.eiq}</span>}
                      </div>
                    ))}
                  </div>
                )}

                {/* Costos y EIQ */}
                <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
                  {a.costo_ha_usd && (
                    <div style={{background:'#EBF4E8',borderRadius:8,padding:'6px 10px',fontSize:11}}>
                      <span style={{color:'#2E4F26'}}>Costo: <strong>U$S {parseFloat(a.costo_ha_usd).toFixed(2)}/ha</strong></span>
                      {superficieN > 0 && <span style={{color:'#4A7C3F'}}> · Total: U$S {(a.costo_ha_usd*superficieN).toFixed(0)}</span>}
                    </div>
                  )}
                  {eiqTotal > 0 && (
                    <div style={{background:'#E4F0F4',borderRadius:8,padding:'6px 10px',fontSize:11}}>
                      <span style={{color:'#2C5A6A'}}>EIQ total: <strong>{eiqTotal.toFixed(0)}</strong></span>
                    </div>
                  )}
                  {a.observaciones && (
                    <div style={{fontSize:11,color:'var(--text-muted)',alignSelf:'center'}}>{a.observaciones}</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
