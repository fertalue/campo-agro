import { useState, useEffect } from 'react'
import { db } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

const CATEGORIAS = ['Producción', 'Mantenimiento casco', 'Esparcimiento', 'Otro']

const chipClass = (cat) => ({
  'Producción': 'chip-green',
  'Mantenimiento casco': 'chip-amber',
  'Esparcimiento': 'chip-sky',
  'Otro': 'chip-muted',
}[cat] || 'chip-muted')

export default function Viajes() {
  const { role, displayName } = useAuth()
  const [viajes, setViajes]   = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving]   = useState(false)
  const [form, setForm]       = useState({
    fecha: new Date().toISOString().split('T')[0],
    quien: 'Fer',
    categoria: 'Producción',
    motivo: '',
    observaciones: '',
  })

  useEffect(() => { fetchViajes() }, [])

  async function fetchViajes() {
    setLoading(true)
    const { data } = await db.viajes.list()
    setViajes(data || [])
    setLoading(false)
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    console.log('Guardando:', form)
    const { data, error } = await db.viajes.insert(form)
    console.log('Resultado:', data, error)
    setShowForm(false)
    setForm({ fecha: new Date().toISOString().split('T')[0], quien: displayName || 'Fer', categoria: 'Producción', motivo: '', observaciones: '' })
    await fetchViajes()
    setSaving(false)
  }

  const totalFer = viajes.filter(v => v.quien === 'Fer').length
  const totalLeo = viajes.filter(v => v.quien === 'Leo').length

  return (
    <div>
      {/* Header */}
      <div className="flex-between mb-2">
        <div>
          <h2>Viajes al campo</h2>
          <p style={{ fontSize: 12, color: 'var(--arcilla)', marginTop: 2 }}>
            {viajes.length} visitas registradas
          </p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancelar' : '+ Registrar visita'}
        </button>
      </div>

      {/* Stats */}
      <div className="grid-4 mb-3" style={{ gridTemplateColumns: 'repeat(3, minmax(0,1fr))' }}>
        <div className="stat-card">
          <div className="stat-label">Total visitas</div>
          <div className="stat-value">{viajes.length}</div>
          <div className="stat-sub">campaña activa</div>
          <div className="stat-bar"><div className="stat-fill" style={{ width: '100%', background: 'var(--pasto)' }} /></div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Fer</div>
          <div className="stat-value">{totalFer}</div>
          <div className="stat-sub">{viajes.length ? Math.round(totalFer/viajes.length*100) : 0}% del total</div>
          <div className="stat-bar"><div className="stat-fill" style={{ width: `${viajes.length ? totalFer/viajes.length*100 : 0}%`, background: 'var(--hoja)' }} /></div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Leo</div>
          <div className="stat-value">{totalLeo}</div>
          <div className="stat-sub">{viajes.length ? Math.round(totalLeo/viajes.length*100) : 0}% del total</div>
          <div className="stat-bar"><div className="stat-fill" style={{ width: `${viajes.length ? totalLeo/viajes.length*100 : 0}%`, background: 'var(--paja)' }} /></div>
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <div className="card mb-3" style={{ background: '#F9F6EE', borderColor: 'var(--paja)' }}>
          <h3 style={{ marginBottom: 14 }}>Nueva visita</h3>
          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="grid-2">
              <div className="field">
                <label className="label">Fecha</label>
                <input className="input" type="date" value={form.fecha}
                  onChange={e => setForm({ ...form, fecha: e.target.value })} required />
              </div>
              <div className="field">
                <label className="label">¿Quién fue?</label>
                <select className="select" value={form.quien}
                  onChange={e => setForm({ ...form, quien: e.target.value })}>
                  <option>Fer</option>
                  <option>Leo</option>
                </select>
              </div>
            </div>
            <div className="field">
              <label className="label">Categoría</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {CATEGORIAS.map(c => (
                  <button key={c} type="button"
                    onClick={() => setForm({ ...form, categoria: c })}
                    style={{
                      padding: '6px 12px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
                      border: '1px solid',
                      background: form.categoria === c ? 'var(--pasto)' : 'transparent',
                      color: form.categoria === c ? '#F5F0E4' : 'var(--arcilla)',
                      borderColor: form.categoria === c ? 'var(--pasto)' : 'var(--border)',
                    }}>{c}</button>
                ))}
              </div>
            </div>
            <div className="field">
              <label className="label">Motivo / tarea del día</label>
              <input className="input" type="text" value={form.motivo}
                onChange={e => setForm({ ...form, motivo: e.target.value })}
                placeholder="Revisión lote norte, fumigación, etc." />
            </div>
            <div className="field">
              <label className="label">Observaciones</label>
              <textarea className="textarea" value={form.observaciones}
                onChange={e => setForm({ ...form, observaciones: e.target.value })}
                placeholder="Notas libres..." style={{ minHeight: 60 }} />
            </div>
            <button className="btn btn-primary" type="submit" disabled={saving} style={{ alignSelf: 'flex-start' }}>
              {saving ? 'Guardando...' : 'Guardar visita'}
            </button>
          </form>
        </div>
      )}

      {/* List */}
      <div className="card" style={{ padding: 0 }}>
        {loading ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--arcilla)', fontSize: 13 }}>
            Cargando...
          </div>
        ) : viajes.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--arcilla)', fontSize: 13 }}>
            Todavía no hay visitas registradas
          </div>
        ) : (
          <div>
            {viajes.map((v, i) => (
              <div key={v.id} style={{
                display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 16px',
                borderBottom: i < viajes.length - 1 ? '1px solid var(--border-light)' : 'none'
              }}>
                {/* Avatar */}
                <div style={{
                  width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                  background: v.quien === 'Fer' ? 'var(--verde-light)' : '#F5EDD8',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 600,
                  color: v.quien === 'Fer' ? 'var(--musgo)' : '#6B3E22'
                }}>{v.quien}</div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--tierra)' }}>
                      {v.motivo || 'Visita al campo'}
                    </span>
                    <span className={`chip ${chipClass(v.categoria)}`}>{v.categoria}</span>
                  </div>
                  {v.observaciones && (
                    <div style={{ fontSize: 12, color: 'var(--arcilla)', marginTop: 3 }}>{v.observaciones}</div>
                  )}
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
                    {new Date(v.fecha + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
