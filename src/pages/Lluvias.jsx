import { useState, useEffect } from 'react'
import { db, exportCSV } from '../lib/supabase'

const NOMBRES_MES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

function fmtMes(ym) {
  const [y, m] = ym.split('-')
  return `${NOMBRES_MES[parseInt(m)-1]} ${y}`
}

export default function Lluvias() {
  const [data, setData]         = useState([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving]     = useState(false)
  const [anhoVer, setAnhoVer]   = useState(new Date().getFullYear())
  const [form, setForm]         = useState({
    fecha: new Date().toISOString().split('T')[0],
    mm: '', observaciones: ''
  })

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
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
    await fetchData()
    setSaving(false)
  }

  const anhoActual = new Date().getFullYear()
  const anhos = [...new Set(data.map(d => d.fecha?.slice(0,4)).filter(Boolean))].sort().reverse()

  // Datos del año seleccionado
  const datosAnho = data.filter(d => d.fecha?.startsWith(String(anhoVer)))

  // Acumulado mensual del año seleccionado
  const acumMensual = Array.from({ length: 12 }, (_, i) => {
    const mes = String(i + 1).padStart(2, '0')
    const key = `${anhoVer}-${mes}`
    const mmMes = data.filter(d => d.fecha?.startsWith(key)).reduce((a, b) => a + (b.mm || 0), 0)
    return { mes: i, label: NOMBRES_MES[i], key, mm: mmMes }
  })

  // Solo hasta el mes actual si es el año corriente
  const mesActual = anhoVer === anhoActual ? new Date().getMonth() : 11
  const acumVisible = acumMensual.slice(0, mesActual + 1).filter(m => {
    // incluir meses con lluvia o meses ya pasados
    return m.mes <= mesActual
  })

  // Suma parcial acumulada
  let acum = 0
  const acumConSuma = acumVisible.map(m => {
    acum += m.mm
    return { ...m, acumTotal: acum }
  })

  const maxAcum = Math.max(...acumConSuma.map(m => m.acumTotal), 1)
  const maxMmMes = Math.max(...acumConSuma.map(m => m.mm), 1)

  // Stats del año
  const totalAnho = datosAnho.reduce((a, b) => a + (b.mm || 0), 0)
  const maxEventoAnho = Math.max(...datosAnho.map(d => d.mm || 0), 0)
  const diasLluviaAnho = datosAnho.filter(d => d.mm > 0).length

  // Stats globales
  const total = data.reduce((a, b) => a + (b.mm || 0), 0)
  const maxEvento = Math.max(...data.map(d => d.mm || 0), 1)

  // Por mes (todos los años)
  const porMes = {}
  data.forEach(d => {
    const mes = d.fecha?.slice(0, 7)
    if (!mes) return
    porMes[mes] = (porMes[mes] || 0) + (d.mm || 0)
  })
  const meses = Object.entries(porMes).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 10)
  const maxMes = Math.max(...meses.map(m => m[1]), 1)

  return (
    <div>
      <div className="flex-between mb-2">
        <div>
          <h2>Precipitaciones</h2>
          <p style={{ fontSize: 12, color: 'var(--arcilla)', marginTop: 2 }}>
            {total.toFixed(0)} mm histórico · {data.filter(d => d.mm > 0).length} eventos
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => exportCSV(data, 'precipitaciones')}>Exportar CSV</button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancelar' : '+ Registrar'}
          </button>
        </div>
      </div>

      {/* Stats año seleccionado */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 10, marginBottom: 16 }}>
        <div className="stat-card">
          <div className="stat-label">Acumulado {anhoVer}</div>
          <div className="stat-value">{totalAnho.toFixed(0)} mm</div>
          <div className="stat-sub">{diasLluviaAnho} eventos</div>
          <div className="stat-bar"><div className="stat-fill" style={{ width: `${Math.min(totalAnho/12,100)}%`, background: 'var(--cielo)' }} /></div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Promedio mensual {anhoVer}</div>
          <div className="stat-value">{mesActual >= 0 ? (totalAnho / (mesActual + 1)).toFixed(0) : 0} mm</div>
          <div className="stat-sub">por mes transcurrido</div>
          <div className="stat-bar"><div className="stat-fill" style={{ width: '55%', background: 'var(--niebla)' }} /></div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Máximo evento {anhoVer}</div>
          <div className="stat-value">{maxEventoAnho.toFixed(0)} mm</div>
          <div className="stat-sub">{datosAnho.find(d => d.mm === maxEventoAnho)?.fecha?.slice(0,10) || '—'}</div>
          <div className="stat-bar"><div className="stat-fill" style={{ width: `${maxEventoAnho/maxEvento*100}%`, background: 'var(--lluvia)' }} /></div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total histórico</div>
          <div className="stat-value">{total.toFixed(0)} mm</div>
          <div className="stat-sub">{anhos.length} año{anhos.length !== 1 ? 's' : ''} registrados</div>
          <div className="stat-bar"><div className="stat-fill" style={{ width: '80%', background: 'var(--lluvia)' }} /></div>
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

      {/* Acumulado año corriente */}
      <div className="card mb-3">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <h3>Acumulado mensual</h3>
            <p style={{ fontSize: 11, color: 'var(--arcilla)', marginTop: 2 }}>Suma parcial de lluvia por mes</p>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {anhos.map(a => (
              <button key={a} onClick={() => setAnhoVer(parseInt(a))} style={{
                padding: '5px 10px', borderRadius: 20, fontSize: 11, cursor: 'pointer',
                border: '1px solid', fontFamily: 'inherit',
                background: anhoVer === parseInt(a) ? 'var(--lluvia)' : 'transparent',
                color: anhoVer === parseInt(a) ? '#F5F0E4' : 'var(--arcilla)',
                borderColor: anhoVer === parseInt(a) ? 'var(--lluvia)' : 'var(--border)',
              }}>{a}</button>
            ))}
          </div>
        </div>

        {acumConSuma.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 24, fontSize: 13, color: 'var(--arcilla)' }}>
            Sin datos para {anhoVer}
          </div>
        ) : (
          <>
            {/* Gráfico con coordenadas en píxeles fijos, viewBox escala al ancho real */}
            <div style={{ width: '100%', marginBottom: 8 }}>
              {(() => {
                const W = 600, H = 140
                const pad = 10
                const n = acumConSuma.length
                const colW = (W - pad * 2) / n
                const barW = colW * 0.5
                return (
                  <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="auto" style={{ display: 'block' }}>
                    {acumConSuma.map((m, i) => {
                      const cx = pad + colW * i + colW / 2
                      const alturaBarra = m.mm > 0 ? Math.max((m.mm / maxMmMes) * 80, 4) : 2
                      const cy = H - 20 - (m.acumTotal / maxAcum) * (H - 40)
                      const esMesActual = anhoVer === anhoActual && m.mes === mesActual
                      return (
                        <g key={m.mes}>
                          <rect x={cx - barW / 2} y={H - 20 - alturaBarra} width={barW} height={alturaBarra}
                            fill={esMesActual ? '#4E7A8A' : m.mm > 0 ? '#7A9EAD' : '#E4EFF3'} rx="2" />
                          <circle cx={cx} cy={cy} r="3.5" fill="#4E7A8A" stroke="#fff" strokeWidth="1" />
                          <text x={cx} y={cy - 7} textAnchor="middle" fontSize="8" fill="#4E7A8A" fontWeight="600">
                            {m.acumTotal.toFixed(0)}
                          </text>
                        </g>
                      )
                    })}
                    {acumConSuma.length > 1 && (
                      <polyline
                        fill="none" stroke="#4E7A8A" strokeWidth="1.5" strokeDasharray="4 2" opacity="0.6"
                        points={acumConSuma.map((m, i) => {
                          const cx = pad + colW * i + colW / 2
                          const cy = H - 20 - (m.acumTotal / maxAcum) * (H - 40)
                          return `${cx},${cy}`
                        }).join(' ')}
                      />
                    )}
                    {/* Etiquetas de mes */}
                    {acumConSuma.map((m, i) => {
                      const cx = pad + colW * i + colW / 2
                      return (
                        <text key={`lbl-${m.mes}`} x={cx} y={H - 5} textAnchor="middle" fontSize="8" fill="#A08060">
                          {m.label}
                        </text>
                      )
                    })}
                  </svg>
                )
              })()}
            </div>

            {/* Leyenda */}
            <div style={{ display: 'flex', gap: 16, marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border-light)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--arcilla)' }}>
                <div style={{ width: 10, height: 10, background: 'var(--cielo)', borderRadius: 2 }} />
                mm por mes
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--arcilla)' }}>
                <div style={{ width: 14, height: 2, background: 'var(--lluvia)', borderTop: '2px dashed var(--lluvia)' }} />
                acumulado
              </div>
              <div style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 600, color: 'var(--lluvia)' }}>
                Total {anhoVer}: {totalAnho.toFixed(0)} mm
              </div>
            </div>
          </>
        )}
      </div>

      <div className="grid-2">
        {/* Por mes histórico */}
        <div className="card">
          <div className="flex-between mb-2"><h3>Por mes (histórico)</h3></div>
          {meses.map(([mes, mm]) => (
            <div key={mes} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: '1px solid var(--border-light)' }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', width: 68, flexShrink: 0 }}>{fmtMes(mes)}</div>
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
          <div className="flex-between mb-2"><h3>Eventos recientes</h3></div>
          {loading ? (
            <div style={{ color: 'var(--arcilla)', fontSize: 13 }}>Cargando...</div>
          ) : data.slice(0, 14).map(d => (
            <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: '1px solid var(--border-light)' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', width: 60, flexShrink: 0 }}>
                {new Date(d.fecha + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: '2-digit' })}
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
