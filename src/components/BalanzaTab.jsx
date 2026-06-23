import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

// Destinatarios del ticket por WhatsApp.
// Formato wa.me: solo dígitos, con 549 (celular Argentina). Editables acá.
const DESTINATARIOS = [
  { nombre: 'Fer', tel: '5493525628768' },
  { nombre: 'Leo', tel: '5493525621234' },
]

const fmtKg = n => (n || n === 0) ? Math.round(n).toLocaleString('es-AR') + ' kg' : '—'
const nowHHMM = () => new Date().toTimeString().slice(0, 5)
const today   = () => new Date().toISOString().split('T')[0]

function netoDe(p) {
  const t = parseFloat(p.tara), b = parseFloat(p.kilos_bruto)
  return (!isNaN(t) && !isNaN(b)) ? b - t : null
}

function fmtFechaHora(fecha, hora) {
  let s = ''
  if (fecha) s += new Date(fecha + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })
  if (hora)  s += ' ' + String(hora).slice(0, 5)
  return s.trim()
}

function ticketTexto(p) {
  const neto = netoDe(p)
  const L = []
  L.push(`TICKET DE SALIDA  N° ${p.ticket_numero ?? '—'}`)
  L.push(`Salida del campo — ${fmtFechaHora(p.fecha, p.hora_salida)}`)
  L.push('------------------------------')
  if (p.cliente)    L.push(`Cliente: ${p.cliente}`)
  if (p.grano)      L.push(`Grano: ${p.grano}${p.campanha ? ` (camp. ${p.campanha})` : ''}`)
  if (p.patente)    L.push(`Patente: ${p.patente}`)
  if (p.transporte) L.push(`Transporte: ${p.transporte}`)
  if (p.chofer)     L.push(`Chofer: ${p.chofer}`)
  L.push('------------------------------')
  L.push(`Bruto: ${fmtKg(p.kilos_bruto)}`)
  L.push(`Tara:  ${fmtKg(p.tara)}`)
  L.push(`NETO:  ${fmtKg(neto)}`)
  L.push('------------------------------')
  if (p.titular)    L.push(`Titular: ${p.titular}`)
  if (p.quien_peso) L.push(`Pesó: ${p.quien_peso}`)
  return L.join('\n')
}

const waLink = (tel, texto) => `https://wa.me/${tel}?text=${encodeURIComponent(texto)}`

export default function BalanzaTab({ canEdit, GRANOS = [], TITULARES = [], COMPRADORES = [], CAMPANHAS = [] }) {
  const { user, displayName } = useAuth()
  const [pesajes, setPesajes] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [ticket, setTicket]   = useState(null)
  const [editId, setEditId]   = useState(null)   // null = alta nueva; id = editando ese pesaje

  const empty = {
    fecha:        today(),
    hora_salida:  nowHHMM(),
    campanha:     CAMPANHAS[0] || '25-26',
    grano:        GRANOS[0] || '',
    titular:      'Fer',
    cliente:      '',
    patente:      '',
    transporte:   '',
    chofer:       '',
    tara:         '',
    kilos_bruto:  '',
    observaciones:'',
  }
  const [form, setForm] = useState(empty)
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const taraN  = parseFloat(form.tara)
  const brutoN = parseFloat(form.kilos_bruto)
  const neto   = (!isNaN(taraN) && !isNaN(brutoN)) ? brutoN - taraN : null
  const valido = form.patente.trim() && !isNaN(taraN) && taraN > 0

  useEffect(() => { fetchPesajes() }, [])

  async function fetchPesajes() {
    setLoading(true)
    const { data } = await supabase
      .from('granos_pesajes')
      .select('*')
      .order('ticket_numero', { ascending: false })
      .limit(80)
    setPesajes(data || [])
    setLoading(false)
  }

  function nuevo() { setEditId(null); setForm({ ...empty, fecha: today(), hora_salida: nowHHMM() }) }

  function editar(p) {
    setEditId(p.id)
    setForm({
      fecha:        p.fecha || today(),
      hora_salida:  p.hora_salida ? String(p.hora_salida).slice(0, 5) : nowHHMM(),
      campanha:     p.campanha || CAMPANHAS[0] || '25-26',
      grano:        p.grano || GRANOS[0] || '',
      titular:      p.titular || 'Fer',
      cliente:      p.cliente || '',
      patente:      p.patente || '',
      transporte:   p.transporte || '',
      chofer:       p.chofer || '',
      tara:         p.tara ?? '',
      kilos_bruto:  p.kilos_bruto ?? '',
      observaciones:p.observaciones || '',
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function guardar() {
    if (!valido) return
    setSaving(true)
    const payload = {
      fecha:        form.fecha,
      hora_salida:  form.hora_salida || null,
      campanha:     form.campanha || null,
      grano:        form.grano || null,
      titular:      form.titular || null,
      cliente:      form.cliente.trim() || null,
      patente:      form.patente.trim().toUpperCase(),
      transporte:   form.transporte.trim() || null,
      chofer:       form.chofer.trim() || null,
      tara:         isNaN(taraN) ? null : taraN,
      kilos_bruto:  isNaN(brutoN) ? null : brutoN,
      kilos_neto:   neto,
      observaciones:form.observaciones.trim() || null,
    }
    let result
    if (editId) {
      result = await supabase.from('granos_pesajes').update(payload).eq('id', editId).select().single()
    } else {
      result = await supabase.from('granos_pesajes')
        .insert({ ...payload, estado: 'pendiente_cp', quien_peso: displayName || null, created_by: user?.id || null })
        .select().single()
    }
    setSaving(false)
    if (result.error) { alert('Error al guardar: ' + result.error.message); return }
    const saved = result.data
    nuevo()
    fetchPesajes()
    // Abrir el ticket sólo si la pesada está completa (tiene neto)
    if (saved && saved.kilos_neto != null && saved.kilos_neto > 0) setTicket(saved)
  }

  async function compartir(texto) {
    if (navigator.share) { try { await navigator.share({ text: texto }) } catch { /* cancelado */ } }
    else { copiar(texto) }
  }
  function copiar(texto) {
    if (navigator.clipboard) { navigator.clipboard.writeText(texto); alert('Ticket copiado') }
  }

  const si = { width: '100%' }
  const enProceso = pesajes.filter(p => netoDe(p) == null).length

  return (
    <div>
      {/* ── Formulario de pesaje (alta / edición) ── */}
      {canEdit ? (
        <div className="card mb-3" style={{ background: editId ? '#FFF9EE' : '#F0F6FA', borderColor: editId ? '#C8A96E' : '#B8D0D8' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h3 style={{ margin: 0 }}>{editId ? `Editar pesaje N° ${pesajes.find(p => p.id === editId)?.ticket_numero ?? ''}` : 'Registrar salida (balanza)'}</h3>
            {editId && <button onClick={nuevo} className="btn btn-secondary btn-sm">Cancelar edición</button>}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="grid-2">
              <div className="field"><label className="label">Fecha</label>
                <input className="input" type="date" value={form.fecha} onChange={e => f('fecha', e.target.value)} style={si} /></div>
              <div className="field"><label className="label">Hora salida</label>
                <input className="input" type="time" value={form.hora_salida} onChange={e => f('hora_salida', e.target.value)} style={si} /></div>
            </div>

            <div className="grid-2">
              <div className="field"><label className="label">Patente / Dominio *</label>
                <input className="input" value={form.patente} onChange={e => f('patente', e.target.value)} placeholder="AA123BB" style={{ ...si, textTransform: 'uppercase' }} /></div>
              <div className="field"><label className="label">Cliente</label>
                <input className="input" value={form.cliente} onChange={e => f('cliente', e.target.value)} list="bz-clientes" placeholder="Comprador" style={si} />
                <datalist id="bz-clientes">{COMPRADORES.map(c => <option key={c} value={c} />)}</datalist>
              </div>
            </div>

            <div className="grid-2">
              <div className="field"><label className="label">Titular</label>
                <input className="input" value={form.titular} onChange={e => f('titular', e.target.value)} list="bz-titulares" style={si} />
                <datalist id="bz-titulares">{TITULARES.map(t => <option key={t} value={t} />)}</datalist>
              </div>
              <div className="field"><label className="label">Grano</label>
                <select className="select" value={form.grano} onChange={e => f('grano', e.target.value)} style={si}>
                  {GRANOS.map(g => <option key={g}>{g}</option>)}
                </select>
              </div>
            </div>

            <div className="grid-2">
              <div className="field"><label className="label">Campaña</label>
                <select className="select" value={form.campanha} onChange={e => f('campanha', e.target.value)} style={si}>
                  {CAMPANHAS.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="field"><label className="label">Transporte</label>
                <input className="input" value={form.transporte} onChange={e => f('transporte', e.target.value)} placeholder="(opcional)" style={si} /></div>
            </div>

            <div className="field"><label className="label">Chofer</label>
              <input className="input" value={form.chofer} onChange={e => f('chofer', e.target.value)} placeholder="(opcional)" style={si} /></div>

            {/* Pesada */}
            <div style={{ background: '#FFFFFF', border: '1px solid #B8D0D8', borderRadius: 8, padding: '12px 14px' }}>
              <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--lluvia)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 4 }}>Pesada</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>Podés cargar solo la <strong>tara</strong> ahora y completar el <strong>bruto</strong> después (botón Editar en la lista).</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                <div className="field"><label className="label">Tara (kg) *</label>
                  <input className="input" type="number" value={form.tara} onChange={e => f('tara', e.target.value)} style={si} /></div>
                <div className="field"><label className="label">Bruto (kg)</label>
                  <input className="input" type="number" value={form.kilos_bruto} onChange={e => f('kilos_bruto', e.target.value)} placeholder="(después)" style={si} /></div>
                <div className="field"><label className="label">Neto (kg)</label>
                  <input className="input" type="number" value={neto ?? ''} readOnly placeholder="—"
                    style={{ ...si, background: '#E8EFF3', color: 'var(--lluvia)', fontWeight: 600 }} /></div>
              </div>
            </div>

            <div className="field"><label className="label">Observaciones</label>
              <input className="input" value={form.observaciones} onChange={e => f('observaciones', e.target.value)} placeholder="(opcional)" style={si} /></div>

            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <button className="btn btn-primary" onClick={guardar} disabled={saving || !valido}>
                {saving ? 'Guardando...' : editId ? 'Guardar cambios' : (neto != null ? 'Guardar y generar ticket' : 'Guardar (falta bruto)')}
              </button>
              {!valido && <span style={{ fontSize: 11, color: 'var(--arcilla)' }}>Cargá al menos patente y tara.</span>}
            </div>
          </div>
        </div>
      ) : (
        <div style={{ padding: '10px 14px', background: '#F5EDD8', border: '1px solid #C8A96E', borderRadius: 8, marginBottom: 14, fontSize: 12, color: '#6B3E22' }}>
          No tenés permiso de edición en Ventas, así que solo podés ver los pesajes.
        </div>
      )}

      {/* ── Lista de pesajes ── */}
      {enProceso > 0 && (
        <div style={{ fontSize: 12, color: '#6B3E22', marginBottom: 8 }}>
          <strong>{enProceso}</strong> en proceso (falta bruto)
        </div>
      )}
      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        {loading
          ? <div style={{ padding: 32, textAlign: 'center', fontSize: 13, color: 'var(--arcilla)' }}>Cargando...</div>
          : pesajes.length === 0
          ? <div style={{ padding: 32, textAlign: 'center', fontSize: 13, color: 'var(--arcilla)' }}>Todavía no hay pesajes cargados.</div>
          : <table className="vt-tbl">
              <thead><tr>
                <th>Ticket</th><th>Fecha / hora</th><th>Patente</th><th>Cliente</th><th>Grano</th><th>Titular</th>
                <th style={{ textAlign: 'right' }}>Tara</th><th style={{ textAlign: 'right' }}>Bruto</th><th style={{ textAlign: 'right' }}>Neto</th>
                <th>Estado</th>{canEdit && <th></th>}
              </tr></thead>
              <tbody>
                {pesajes.map(p => {
                  const n = netoDe(p)
                  const faltaBruto = n == null
                  return (
                    <tr key={p.id} style={faltaBruto ? { background: '#FFF9EE' } : undefined}>
                      <td style={{ fontWeight: 600, color: 'var(--tierra)' }}>N° {p.ticket_numero}</td>
                      <td style={{ color: 'var(--text-muted)' }}>{fmtFechaHora(p.fecha, p.hora_salida)}</td>
                      <td style={{ fontFamily: 'monospace' }}>{p.patente || '—'}</td>
                      <td>{p.cliente || '—'}</td>
                      <td style={{ color: 'var(--text-muted)' }}>{p.grano || '—'}</td>
                      <td>{p.titular || '—'}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmtKg(p.tara)}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmtKg(p.kilos_bruto)}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>{fmtKg(n)}</td>
                      <td>
                        <span className={`cc ${faltaBruto ? 'chip-amber' : 'chip-sky'}`}>
                          {faltaBruto ? '⏳ Falta bruto' : 'Pendiente CP'}
                        </span>
                      </td>
                      {canEdit && (
                        <td>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button onClick={() => editar(p)}
                              style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 5, padding: '3px 8px', fontSize: 11, cursor: 'pointer', color: 'var(--arcilla)', whiteSpace: 'nowrap' }}>
                              {faltaBruto ? '+ Bruto' : 'Editar'}
                            </button>
                            {!faltaBruto && (
                              <button onClick={() => setTicket(p)}
                                style={{ background: 'var(--pasto)', border: '1px solid var(--pasto)', borderRadius: 5, padding: '3px 8px', fontSize: 11, cursor: 'pointer', color: 'white', whiteSpace: 'nowrap' }}>
                                Ticket
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>}
      </div>

      {/* ── Modal ticket ── */}
      {ticket && (() => {
        const texto = ticketTexto(ticket)
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
            onClick={e => e.target === e.currentTarget && setTicket(null)}>
            <div style={{ background: 'white', borderRadius: 14, padding: 20, width: 'min(96vw, 460px)', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 12px 48px rgba(0,0,0,0.25)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--tierra)' }}>Ticket N° {ticket.ticket_numero}</div>
                <button onClick={() => setTicket(null)} style={{ padding: '4px 10px', background: '#FAECE7', border: '1px solid #F0997B', borderRadius: 6, fontSize: 12, cursor: 'pointer', color: '#993C1D' }}>Cerrar</button>
              </div>

              <pre style={{ background: '#F9F6EE', border: '1px solid #E8D5A3', borderRadius: 8, padding: '12px 14px', fontSize: 12, fontFamily: 'monospace', whiteSpace: 'pre-wrap', color: '#3B2E1E', margin: 0 }}>{texto}</pre>

              <div style={{ fontSize: 11, color: 'var(--text-muted)', margin: '12px 0 6px' }}>Enviar por WhatsApp:</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                {DESTINATARIOS.map(d => (
                  <a key={d.nombre} href={waLink(d.tel, texto)} target="_blank" rel="noopener noreferrer"
                    style={{ flex: 1, minWidth: 120, textAlign: 'center', textDecoration: 'none', padding: '9px 12px', background: '#25D366', color: 'white', borderRadius: 8, fontSize: 13, fontWeight: 600 }}>
                    Enviar a {d.nombre}
                  </a>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => compartir(texto)} className="btn btn-secondary" style={{ flex: 1 }}>Compartir…</button>
                <button onClick={() => copiar(texto)} className="btn btn-secondary" style={{ flex: 1 }}>Copiar</button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
