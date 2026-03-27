import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const TIPOS = [
  { id: 'proveedor',      label: 'Proveedores' },
  { id: 'producto',       label: 'Productos / Servicios' },
  { id: 'quien_carga',    label: 'Quien carga' },
  { id: 'centro_costos',  label: 'Centros de costo' },
  { id: 'concepto',       label: 'Conceptos' },
  { id: 'unidad',         label: 'Unidades' },
  { id: 'moneda',         label: 'Monedas' },
  { id: 'iva_pct',        label: '% IVA' },
  { id: 'factura_nombre', label: 'Factura a nombre de' },
  { id: 'tipo_pago',      label: 'Tipos de pago' },
  { id: 'mes_canje',      label: 'Meses de canje' },
]

const CSS = `
.dm-layout{display:grid;grid-template-columns:220px 1fr;gap:16px;align-items:start;}
.dm-menu{background:#FDFAF4;border:1px solid #D8C9A8;border-radius:10px;overflow:hidden;}
.dm-menu-item{padding:10px 14px;font-size:13px;color:#6B4E33;cursor:pointer;border-left:3px solid transparent;transition:all .15s;}
.dm-menu-item:hover{background:#EDE0C8;}
.dm-menu-item.active{background:#EBF4E8;color:#2E4F26;font-weight:500;border-left-color:#4A7C3F;}
.dm-panel{background:#FDFAF4;border:1px solid #D8C9A8;border-radius:10px;padding:16px;}
.dm-item-row{display:flex;align-items:center;justify-content:space-between;padding:9px 12px;border-bottom:1px solid #EDE0C8;gap:8px;}
.dm-item-row:last-child{border-bottom:none;}
.dm-item-row:hover{background:#F5F0E4;border-radius:6px;}
.dm-item-name{font-size:13px;color:#3B2E1E;flex:1;}
.dm-item-name.inactive{color:#A08060;text-decoration:line-through;}
.dm-btn-sm{padding:4px 10px;border-radius:6px;font-size:11px;cursor:pointer;border:1px solid;font-family:inherit;transition:all .15s;background:transparent;}
.dm-btn-del{color:#A32D2D;border-color:#F09595;}
.dm-btn-del:hover{background:#FCEBEB;}
.dm-btn-tog{color:#A08060;border-color:#D8C9A8;}
.dm-btn-tog:hover{background:#EDE0C8;}
.dm-add-row{display:flex;gap:8px;margin-top:12px;padding-top:12px;border-top:1px solid #EDE0C8;}
.dm-search{width:100%;padding:7px 10px;border:1px solid #D8C9A8;border-radius:6px;font-size:13px;background:#F5F0E4;color:#3B2E1E;font-family:inherit;margin-bottom:10px;}
.dm-search:focus{outline:none;border-color:#4A7C3F;}
@media(max-width:600px){.dm-layout{grid-template-columns:1fr;}}
`

export default function DatosMaestros() {
  const [tipoActivo, setTipoActivo] = useState('proveedor')
  const [maestros, setMaestros]     = useState([])
  const [loading, setLoading]       = useState(true)
  const [nuevoValor, setNuevoValor] = useState('')
  const [search, setSearch]         = useState('')
  const [saving, setSaving]         = useState(false)

  useEffect(() => { fetchMaestros() }, [])

  async function fetchMaestros() {
    setLoading(true)
    const { data } = await supabase.from('maestros').select('*').order('orden').order('valor')
    setMaestros(data || [])
    setLoading(false)
  }

  const itemsActivos = maestros
    .filter(m => m.tipo === tipoActivo)
    .filter(m => !search || m.valor.toLowerCase().includes(search.toLowerCase()))

  async function agregar(e) {
    e.preventDefault()
    if (!nuevoValor.trim()) return
    setSaving(true)
    await supabase.from('maestros').insert({
      tipo: tipoActivo,
      valor: nuevoValor.trim(),
      orden: itemsActivos.length + 1,
      activo: true
    })
    setNuevoValor('')
    await fetchMaestros()
    setSaving(false)
  }

  async function toggleActivo(item) {
    await supabase.from('maestros').update({ activo: !item.activo }).eq('id', item.id)
    setMaestros(prev => prev.map(m => m.id === item.id ? { ...m, activo: !m.activo } : m))
  }

  async function eliminar(item) {
    if (!confirm(`¿Eliminar "${item.valor}"?`)) return
    await supabase.from('maestros').delete().eq('id', item.id)
    setMaestros(prev => prev.filter(m => m.id !== item.id))
  }

  const tipoLabel = TIPOS.find(t => t.id === tipoActivo)?.label || ''
  const totalTipo = maestros.filter(m => m.tipo === tipoActivo).length

  return (
    <div>
      <style>{CSS}</style>
      <div className="flex-between mb-3">
        <div>
          <h2>Datos maestros</h2>
          <p style={{ fontSize: 12, color: 'var(--arcilla)', marginTop: 2 }}>
            Listas de referencia para los formularios
          </p>
        </div>
      </div>

      <div className="dm-layout">
        {/* Menú lateral */}
        <div className="dm-menu">
          {TIPOS.map(t => {
            const count = maestros.filter(m => m.tipo === t.id && m.activo).length
            return (
              <div key={t.id} className={`dm-menu-item${tipoActivo === t.id ? ' active' : ''}`}
                onClick={() => { setTipoActivo(t.id); setSearch(''); setNuevoValor('') }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{t.label}</span>
                  <span style={{ fontSize: 11, background: tipoActivo === t.id ? '#9DC87A' : '#EDE0C8', color: tipoActivo === t.id ? '#2E4F26' : '#A08060', borderRadius: 10, padding: '1px 6px', fontWeight: 500 }}>{count}</span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Panel derecho */}
        <div className="dm-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ fontSize: 14 }}>{tipoLabel}</h3>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{totalTipo} registros</span>
          </div>

          {totalTipo > 5 && (
            <input className="dm-search" value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={`Buscar en ${tipoLabel.toLowerCase()}...`} />
          )}

          {loading ? (
            <div style={{ fontSize: 13, color: 'var(--arcilla)', padding: '12px 0' }}>Cargando...</div>
          ) : itemsActivos.length === 0 && !search ? (
            <div style={{ fontSize: 13, color: 'var(--arcilla)', padding: '12px 0' }}>Sin registros todavía</div>
          ) : itemsActivos.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--arcilla)', padding: '12px 0' }}>Sin resultados para "{search}"</div>
          ) : (
            <div style={{ border: '1px solid #EDE0C8', borderRadius: 8, overflow: 'hidden' }}>
              {itemsActivos.map(item => (
                <div key={item.id} className="dm-item-row">
                  <span className={`dm-item-name${!item.activo ? ' inactive' : ''}`}>{item.valor}</span>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button className="dm-btn-sm dm-btn-tog" onClick={() => toggleActivo(item)}>
                      {item.activo ? 'Desactivar' : 'Activar'}
                    </button>
                    <button className="dm-btn-sm dm-btn-del" onClick={() => eliminar(item)}>
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Agregar nuevo */}
          <form onSubmit={agregar} className="dm-add-row">
            <input className="input" value={nuevoValor}
              onChange={e => setNuevoValor(e.target.value)}
              placeholder={`Agregar ${tipoLabel.toLowerCase()}...`}
              style={{ flex: 1, fontSize: 13 }} />
            <button className="btn btn-primary btn-sm" type="submit" disabled={saving || !nuevoValor.trim()}>
              {saving ? '...' : '+ Agregar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
