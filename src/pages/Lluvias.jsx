import { useState, useEffect } from 'react'
import { db, exportCSV } from '../lib/supabase'

export default function Lluvias() {
  const [data, setData]       = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving]   = useState(false)
  const [form, setForm]       = useState({
    fecha: new Date().toISOString().split('T')[0],
    mm: '',
    observaciones: ''
  })

  useEffect(() => { fetch() }, [])

  async function fetch() {
    setLoading(true)
    const { data: rows } = await db.precipitaciones.list()
    setData(rows || [])
    setLoading(false)
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    await db.precipitaciones.insert({ ...form, mm: parseFloat(form.mm) })
    setShowForm(false)
    setForm({ fecha: new Date().toISOString().split('T')[0], mm: '', observaciones: '' })
    await fetch()
    setSaving(false)
  }

  const total    = data.reduce((a, b) => a + (b.mm || 0), 0)
  const maxEvento = Math.max(...data.map(d => d.mm || 0), 1)
  const diasLluvia = data.filter(d => d.mm > 0).length

  // Agrupar por mes
  const porMes = {}
  data.forEach(d => {
    const mes = d.fecha?.slice(0, 7)
    if (!mes) return
    porMes[mes] = (porMes[mes] || 0) + (d.mm || 0)
  })
  const meses = Object.entries(porMes).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 8)
  const maxMes = Math.max(...meses.map(m => m[1]), 1)

  const fmtMes = (ym) => {
    const [y, m] = ym.split('-')
    const nombres = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
    return `${nombres[parseInt(m)-1]} ${y}`
  }

  return (
    <div>
      <div className="flex-between mb-2">
        <div>
          <h2>Precipitaciones</h2>
          <p style={{ fontSize: 12, color: 'var(--arcilla)', marginTop: 2 }}>
            {total.toFixed(0)} mm acumulados · {diasLluvia} eventos
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => exportCSV(data, 'precipitaciones')}>Exportar CSV</button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancelar' : '+ Registrar'}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid-4 mb-3" style={{ gridTemplateColumns: 'repeat(3, minmax(0,1fr))' }}>
        <div className="stat-card">
          <div className="stat-label">Total acumulado</div>
          <div className="stat-value">{total.toFixed(0)} mm</div>
          <div className="stat-sub">{data.length} registros</div>
          <div className="stat-bar"><div className="stat-fill" style={{ width: '80%', background: 'var(--cielo)' }} /></div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Máximo evento</div>
          <div className="stat-value">{maxEvento.toFixed(0)} mm</div>
          <div className="stat-sub">{data.find(d => d.mm === maxEvento)?.fecha?.slice(0,10) || '—'}</div>
          <div className="stat-bar"><div className="stat-fill" style={{ width: '60%', background: 'var(--lluvia)' }} /></div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Días con lluvia</div>
          <div className="stat-value">{diasLluvia}</div>
          <div className="stat-sub">de {data.length} registros</div>
          <div className="stat-bar"><div className="stat-fill" style={{ width: `${data.length ? diasLluvia/data.length*100 : 0}%`, background: 'var(--niebla)' }} /></div>
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <div className="card mb-3" style={{ background: '#F0F6FA', borderColor: 'var(--niebla)' }}>
          <h3 style={{ marginBottom: 14 }}>Nuevo registro</h3>
          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="grid-2">
              <div className="field">
                <label className="label">Fecha</label>
                <input className="input" type="date" value={form.fecha}
                  onChange={e => setForm({ ...form, fecha: e.target.value })} required />
              </div>
              <div className="field">
                <label className="label">Milímetros</label>
                <input className="input" type="number" step="0.1" min="0" value={form.mm}
                  onChange={e => setForm({ ...form, mm: e.target.value })} placeholder="0.0" required />
              </div>
            </div>
            <div className="field">
              <label className="label">Observaciones</label>
              <input className="input" value={form.observaciones}
                onChange={e => setForm({ ...form, observaciones: e.target.value })}
                placeholder="Granizo, lluvia de madrugada, etc." />
            </div>
            <button className="btn btn-primary" type="submit" disabled={saving} style={{ alignSelf: 'flex-start' }}>
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </form>
        </div>
      )}

      <div className="grid-2">
        {/* Por mes */}
        <div className="card">
          <div className="flex-between mb-2">
            <h3>Por mes</h3>
          </div>
          {meses.map(([mes, mm]) => (
            <div key={mes} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: '1px solid var(--border-light)' }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', width: 64, flexShrink: 0 }}>{fmtMes(mes)}</div>
              <div style={{ flex: 1, height: 8, background: '#E4EFF3', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: 8, background: 'var(--cielo)', borderRadius: 4, width: `${mm/maxMes*100}%` }} />
              </div>
              <div style={{ fontSize: 12, color: 'var(--lluvia)', fontWeight: 500, width: 48, textAlign: 'right' }}>
                {mm.toFixed(0)} mm
              </div>
            </div>
          ))}
        </div>

        {/* Eventos recientes */}
        <div className="card">
          <div className="flex-between mb-2">
            <h3>Eventos recientes</h3>
          </div>
          {loading ? (
            <div style={{ color: 'var(--arcilla)', fontSize: 13 }}>Cargando...</div>
          ) : data.slice(0, 12).map(d => (
            <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: '1px solid var(--border-light)' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', width: 56, flexShrink: 0 }}>
                {new Date(d.fecha + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}
              </div>
              <div style={{ flex: 1, height: 8, background: '#E4EFF3', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: 8, background: d.mm > 0 ? 'var(--cielo)' : 'var(--niebla)', borderRadius: 4, width: `${d.mm/maxEvento*100}%` }} />
              </div>
              <div style={{ fontSize: 12, color: 'var(--lluvia)', fontWeight: 500, width: 40, textAlign: 'right' }}>
                {d.mm} mm
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
