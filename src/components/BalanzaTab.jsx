import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

// Destinatarios del ticket por WhatsApp (formato wa.me: solo dígitos, 549 para celular AR).
const DESTINATARIOS = [
  { nombre: 'Fer', tel: '5493525628768' },
  { nombre: 'Leo', tel: '5493525621234' },
]

const LS_KEY  = 'balanza_pesajes_v1'
const LS_SEQ  = 'balanza_local_seq'

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
  const nro  = p.ticket_numero ? `N° ${p.ticket_numero}` : `Borrador ${p.local_num || ''}`
  const L = []
  L.push(`TICKET DE SALIDA  ${nro}`)
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

// localStorage
const loadLocal = () => { try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]') } catch { return [] } }
const persist   = (arr) => { try { localStorage.setItem(LS_KEY, JSON.stringify(arr.slice(0, 300))) } catch { /* lleno */ } }
const nextSeq   = () => { const n = (parseInt(localStorage.getItem(LS_SEQ) || '0', 10) || 0) + 1; try { localStorage.setItem(LS_SEQ, String(n)) } catch {} ; return n }

// columnas que se mandan a la base (no estado/viaje_id/ncp: los maneja la oficina)
function dbPayload(rec) {
  return {
    client_uuid: rec.client_uuid,
    fecha: rec.fecha, hora_salida: rec.hora_salida || null,
    campanha: rec.campanha || null, grano: rec.grano || null, titular: rec.titular || null,
    cliente: rec.cliente || null, patente: rec.patente || null,
    transporte: rec.transporte || null, chofer: rec.chofer || null,
    tara: rec.tara ?? null, kilos_bruto: rec.kilos_bruto ?? null, kilos_neto: rec.kilos_neto ?? null,
    observaciones: rec.observaciones || null, quien_peso: rec.quien_peso || null, created_by: rec.created_by || null,
  }
}

export default function BalanzaTab({ canEdit, GRANOS = [], TITULARES = [], COMPRADORES = [], CAMPANHAS = [] }) {
  const { user, displayName } = useAuth()
  const [online, setOnline]   = useState(navigator.onLine)
  const [list, setList]       = useState(loadLocal())   // fuente única: cache servidor + pendientes locales
  const [syncing, setSyncing] = useState(false)
  const [ticket, setTicket]   = useState(null)
  const [editId, setEditId]   = useState(null)          // client_uuid en edición
  const [linkP, setLinkP]     = useState(null)          // pesaje a vincular con una CP
  const [viajes, setViajes]   = useState([])
  const [viajeQ, setViajeQ]   = useState('')
  const [linking, setLinking] = useState(false)
  const [delP, setDelP]       = useState(null)          // pesaje a eliminar
  const [delPwd, setDelPwd]   = useState('')
  const [delErr, setDelErr]   = useState('')
  const [deleting, setDeleting] = useState(false)

  const listRef = useRef(list)
  useEffect(() => { listRef.current = list }, [list])

  function setAndPersist(updater) {
    setList(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      persist(next); listRef.current = next; return next
    })
  }

  const empty = {
    fecha: today(), hora_salida: nowHHMM(), campanha: CAMPANHAS[0] || '25-26',
    grano: GRANOS[0] || '', titular: 'Fer', cliente: '', patente: '',
    transporte: '', chofer: '', tara: '', kilos_bruto: '', observaciones: '',
  }
  const [form, setForm] = useState(empty)
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))
  const taraN  = parseFloat(form.tara)
  const brutoN = parseFloat(form.kilos_bruto)
  const neto   = (!isNaN(taraN) && !isNaN(brutoN)) ? brutoN - taraN : null
  const valido = form.patente.trim() && !isNaN(taraN) && taraN > 0

  const pendientes = list.filter(r => r._sync === 'pending').length

  // ── Servidor: traer y cachear ──
  async function fetchServer() {
    if (!navigator.onLine) return
    const { data, error } = await supabase.from('granos_pesajes').select('*').order('ticket_numero', { ascending: false }).limit(200)
    if (error || !data) return
    setAndPersist(prev => {
      const map = {}
      prev.forEach(l => { if (l.client_uuid) map[l.client_uuid] = l })
      data.forEach(s => {
        if (!s.client_uuid) return
        const ex = map[s.client_uuid]
        if (ex && ex._sync === 'pending') return           // conservar edición local sin sincronizar
        map[s.client_uuid] = { ...s, _sync: 'synced', _ts: ex?._ts || Date.parse(s.created_at) || Date.now(), local_num: ex?.local_num }
      })
      return Object.values(map)
    })
  }

  // ── Sincronizar pendientes ──
  async function syncPendientes() {
    if (!navigator.onLine) return
    const pend = listRef.current.filter(l => l._sync === 'pending')
    if (pend.length === 0) { fetchServer(); return }
    setSyncing(true)
    for (const rec of pend) {
      const { data: saved, error } = await supabase.from('granos_pesajes')
        .upsert(dbPayload(rec), { onConflict: 'client_uuid' }).select().single()
      if (!error && saved) {
        setAndPersist(prev => prev.map(l => l.client_uuid === rec.client_uuid
          ? { ...l, id: saved.id, ticket_numero: saved.ticket_numero, estado: saved.estado, _sync: 'synced' } : l))
      }
    }
    setSyncing(false)
    fetchServer()
  }

  useEffect(() => {
    if (navigator.onLine) { syncPendientes() }   // al montar: sincroniza + refresca
    const on  = () => { setOnline(true);  syncPendientes() }
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, []) // eslint-disable-line

  function nuevo() { setEditId(null); setForm({ ...empty, fecha: today(), hora_salida: nowHHMM() }) }

  function editar(r) {
    setEditId(r.client_uuid)
    setForm({
      fecha: r.fecha || today(), hora_salida: r.hora_salida ? String(r.hora_salida).slice(0, 5) : nowHHMM(),
      campanha: r.campanha || CAMPANHAS[0] || '25-26', grano: r.grano || GRANOS[0] || '', titular: r.titular || 'Fer',
      cliente: r.cliente || '', patente: r.patente || '', transporte: r.transporte || '', chofer: r.chofer || '',
      tara: r.tara ?? '', kilos_bruto: r.kilos_bruto ?? '', observaciones: r.observaciones || '',
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function abrirVincular(p) {
    if (!navigator.onLine) { alert('Necesitás conexión para vincular la CP.'); return }
    if (!p.id) { alert('Sincronizá el pesaje primero (todavía es borrador).'); return }
    setViajeQ(''); setLinkP(p)
    const { data } = await supabase.from('granos_viajes')
      .select('id,fecha,ncp,patente,comprador,grano,titular,neto_romaneo')
      .order('fecha', { ascending: false }).limit(100)
    setViajes(data || [])
  }
  async function confirmarVinculo(v) {
    if (!linkP) return
    setLinking(true)
    await supabase.from('granos_pesajes').update({ viaje_id: v.id, estado: 'con_cp', ncp: v.ncp || null }).eq('id', linkP.id)
    setLinking(false); setLinkP(null)
    fetchServer()
  }

  function pedirEliminar(p) { setDelPwd(''); setDelErr(''); setDelP(p) }
  async function confirmarEliminar() {
    if (delPwd !== '0000') { setDelErr('Contraseña incorrecta.'); return }
    const p = delP
    if (p.id) {
      if (!navigator.onLine) { setDelErr('Necesitás conexión para eliminar un pesaje ya sincronizado.'); return }
      setDeleting(true)
      const { error } = await supabase.from('granos_pesajes').delete().eq('id', p.id)
      setDeleting(false)
      if (error) { setDelErr('Error al eliminar: ' + error.message); return }
    }
    setAndPersist(prev => prev.filter(r => r.client_uuid !== p.client_uuid))
    setDelP(null)
  }

  function guardar() {
    if (!valido) return
    const prev = editId ? list.find(r => r.client_uuid === editId) : null
    const rec = {
      client_uuid: prev?.client_uuid || (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`),
      local_num:   prev?.local_num   || nextSeq(),
      id:          prev?.id,
      ticket_numero: prev?.ticket_numero,
      _ts:         prev?._ts || Date.now(),
      _sync:       'pending',
      fecha: form.fecha, hora_salida: form.hora_salida || null,
      campanha: form.campanha || null, grano: form.grano || null, titular: form.titular || null,
      cliente: form.cliente.trim() || null, patente: form.patente.trim().toUpperCase() || null,
      transporte: form.transporte.trim() || null, chofer: form.chofer.trim() || null,
      tara: isNaN(taraN) ? null : taraN, kilos_bruto: isNaN(brutoN) ? null : brutoN, kilos_neto: neto,
      observaciones: form.observaciones.trim() || null,
      quien_peso: prev?.quien_peso || displayName || null,
      created_by: prev?.created_by || user?.id || null,
      estado: prev?.estado || 'pendiente_cp',
    }
    setAndPersist(p => {
      const without = p.filter(r => r.client_uuid !== rec.client_uuid)
      return [rec, ...without]
    })
    nuevo()
    if (rec.kilos_neto != null && rec.kilos_neto > 0) setTicket(rec)
    if (navigator.onLine) setTimeout(syncPendientes, 50)
  }

  async function compartir(texto) {
    if (navigator.share) { try { await navigator.share({ text: texto }) } catch { /* cancelado */ } }
    else { copiar(texto) }
  }
  function copiar(texto) { if (navigator.clipboard) { navigator.clipboard.writeText(texto); alert('Ticket copiado') } }

  const ordenada = [...list].sort((a, b) => (b._ts || 0) - (a._ts || 0))
  const enProceso = list.filter(r => netoDe(r) == null).length
  const si = { width: '100%' }

  return (
    <div>
      {/* ── Barra de estado offline / sync ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12, padding: '8px 12px', borderRadius: 8,
        background: online ? '#EBF4E8' : '#F5EDD8', border: `1px solid ${online ? '#9DC87A' : '#C8A96E'}` }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: online ? '#2E4F26' : '#6B3E22' }}>
          {online ? '🟢 En línea' : '🔴 Sin conexión — se guarda en la tablet'}
        </span>
        {pendientes > 0 && (
          <span style={{ fontSize: 12, color: '#6B3E22' }}>· {pendientes} sin sincronizar</span>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button onClick={syncPendientes} disabled={!online || syncing}
            className="btn btn-secondary btn-sm" style={{ opacity: (!online || syncing) ? 0.5 : 1 }}>
            {syncing ? 'Sincronizando...' : pendientes > 0 ? `Sincronizar (${pendientes})` : 'Actualizar'}
          </button>
        </div>
      </div>

      {/* ── Formulario ── */}
      {canEdit ? (
        <div className="card mb-3" style={{ background: editId ? '#FFF9EE' : '#F0F6FA', borderColor: editId ? '#C8A96E' : '#B8D0D8' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h3 style={{ margin: 0 }}>{editId ? 'Editar pesaje' : 'Registrar salida (balanza)'}</h3>
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

            <div style={{ background: '#FFFFFF', border: '1px solid #B8D0D8', borderRadius: 8, padding: '12px 14px' }}>
              <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--lluvia)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 4 }}>Pesada</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>Podés cargar solo la <strong>tara</strong> ahora y completar el <strong>bruto</strong> después.</div>
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
              <button className="btn btn-primary" onClick={guardar} disabled={!valido}>
                {editId ? 'Guardar cambios' : (neto != null ? 'Guardar y generar ticket' : 'Guardar (falta bruto)')}
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

      {/* ── Lista ── */}
      {enProceso > 0 && <div style={{ fontSize: 12, color: '#6B3E22', marginBottom: 8 }}><strong>{enProceso}</strong> en proceso (falta bruto)</div>}
      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        {ordenada.length === 0
          ? <div style={{ padding: 32, textAlign: 'center', fontSize: 13, color: 'var(--arcilla)' }}>Todavía no hay pesajes cargados.</div>
          : <table className="vt-tbl">
              <thead><tr>
                <th>Ticket</th><th>Fecha / hora</th><th>Patente</th><th>Cliente</th><th>Grano</th>
                <th style={{ textAlign: 'right' }}>Tara</th><th style={{ textAlign: 'right' }}>Bruto</th><th style={{ textAlign: 'right' }}>Neto</th>
                <th>Estado</th>{canEdit && <th></th>}
              </tr></thead>
              <tbody>
                {ordenada.map(r => {
                  const n = netoDe(r)
                  const faltaBruto = n == null
                  const pend = r._sync === 'pending'
                  return (
                    <tr key={r.client_uuid} style={faltaBruto || pend ? { background: '#FFF9EE' } : undefined}>
                      <td style={{ fontWeight: 600, color: 'var(--tierra)' }}>{r.ticket_numero ? `N° ${r.ticket_numero}` : <span style={{ color: 'var(--arcilla)' }}>Borrador {r.local_num}</span>}</td>
                      <td style={{ color: 'var(--text-muted)' }}>{fmtFechaHora(r.fecha, r.hora_salida)}</td>
                      <td style={{ fontFamily: 'monospace' }}>{r.patente || '—'}</td>
                      <td>{r.cliente || '—'}</td>
                      <td style={{ color: 'var(--text-muted)' }}>{r.grano || '—'}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmtKg(r.tara)}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmtKg(r.kilos_bruto)}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>{fmtKg(n)}</td>
                      <td>
                        {pend
                          ? <span className="cc chip-amber">⏱ Sin sincronizar</span>
                          : faltaBruto
                          ? <span className="cc chip-amber">⏳ Falta bruto</span>
                          : r.estado === 'con_cp'
                          ? <span className="cc chip-green">✓ Con CP</span>
                          : <span className="cc chip-sky">Pendiente CP</span>}
                      </td>
                      {canEdit && (
                        <td>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button onClick={() => editar(r)}
                              style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 5, padding: '3px 8px', fontSize: 11, cursor: 'pointer', color: 'var(--arcilla)', whiteSpace: 'nowrap' }}>
                              {faltaBruto ? '+ Bruto' : 'Editar'}
                            </button>
                            {!faltaBruto && (
                              <button onClick={() => setTicket(r)}
                                style={{ background: 'var(--pasto)', border: '1px solid var(--pasto)', borderRadius: 5, padding: '3px 8px', fontSize: 11, cursor: 'pointer', color: 'white', whiteSpace: 'nowrap' }}>
                                Ticket
                              </button>
                            )}
                            {!faltaBruto && r._sync !== 'pending' && r.estado !== 'con_cp' && (
                              <button onClick={() => abrirVincular(r)}
                                style={{ background: '#E4F0F4', border: '1px solid #7A9EAD', borderRadius: 5, padding: '3px 8px', fontSize: 11, cursor: 'pointer', color: '#2C5A6A', whiteSpace: 'nowrap' }}>
                                Vincular CP
                              </button>
                            )}
                            <button onClick={() => pedirEliminar(r)} title="Eliminar"
                              style={{ background: '#FAECE7', border: '1px solid #F0997B', borderRadius: 5, padding: '3px 8px', fontSize: 11, cursor: 'pointer', color: '#993C1D', whiteSpace: 'nowrap' }}>
                              🗑
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>}
      </div>

      {/* ── Modal eliminar ── */}
      {delP && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', zIndex:600, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}
          onClick={e => e.target === e.currentTarget && setDelP(null)}>
          <div style={{ background:'white', borderRadius:14, padding:20, width:'min(94vw, 360px)', boxShadow:'0 12px 48px rgba(0,0,0,0.25)' }}>
            <div style={{ fontWeight:700, fontSize:15, color:'#993C1D', marginBottom:6 }}>Eliminar pesaje {delP.ticket_numero ? `N° ${delP.ticket_numero}` : `(borrador ${delP.local_num})`}</div>
            <div style={{ fontSize:12, color:'var(--text-muted)', marginBottom:12 }}>Esta acción no se puede deshacer. Ingresá la contraseña para confirmar.</div>
            <input type="password" inputMode="numeric" value={delPwd} autoFocus
              onChange={e => { setDelPwd(e.target.value); setDelErr('') }}
              onKeyDown={e => e.key === 'Enter' && confirmarEliminar()}
              placeholder="Contraseña" className="input" style={{ width:'100%', marginBottom:8 }} />
            {delErr && <div style={{ fontSize:11, color:'#993C1D', marginBottom:8 }}>{delErr}</div>}
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
              <button onClick={() => setDelP(null)} className="btn btn-secondary btn-sm">Cancelar</button>
              <button onClick={confirmarEliminar} disabled={deleting}
                style={{ padding:'6px 14px', background:'#993C1D', color:'white', border:'none', borderRadius:6, fontSize:13, cursor:'pointer', fontFamily:'inherit', fontWeight:600 }}>
                {deleting ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal vincular CP ── */}
      {linkP && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', zIndex:500, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}
          onClick={e => e.target === e.currentTarget && setLinkP(null)}>
          <div style={{ background:'white', borderRadius:14, padding:20, width:'min(96vw, 560px)', maxHeight:'90vh', overflowY:'auto', boxShadow:'0 12px 48px rgba(0,0,0,0.25)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
              <div style={{ fontWeight:700, fontSize:15, color:'var(--tierra)' }}>Vincular CP — Pesaje N° {linkP.ticket_numero}</div>
              <button onClick={() => setLinkP(null)} style={{ padding:'4px 10px', background:'#FAECE7', border:'1px solid #F0997B', borderRadius:6, fontSize:12, cursor:'pointer', color:'#993C1D' }}>Cerrar</button>
            </div>
            <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:10 }}>Elegí el viaje (CP) al que corresponde {linkP.patente ? `la patente ${linkP.patente}` : 'este pesaje'}.</div>
            <input className="input" value={viajeQ} onChange={e => setViajeQ(e.target.value)} placeholder="Buscar por CP, patente, comprador..." style={{ width:'100%', marginBottom:10 }} />
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {(() => {
                const norm = s => (s||'').toString().toUpperCase().replace(/\s+/g,'')
                const q = viajeQ.trim().toLowerCase()
                const lista = viajes
                  .filter(v => !q || [v.ncp, v.patente, v.comprador, v.grano, v.titular].some(x => x && String(x).toLowerCase().includes(q)))
                  .sort((a,b) => ((norm(b.patente) === norm(linkP.patente) && linkP.patente) ? 1 : 0) - ((norm(a.patente) === norm(linkP.patente) && linkP.patente) ? 1 : 0))
                if (lista.length === 0) return <div style={{ fontSize:12, color:'var(--arcilla)', padding:'10px 0' }}>No hay viajes que coincidan. Cargá la CP en "+ Viaje".</div>
                return lista.slice(0, 40).map(v => {
                  const match = linkP.patente && norm(v.patente) === norm(linkP.patente)
                  return (
                    <button key={v.id} onClick={() => confirmarVinculo(v)} disabled={linking}
                      style={{ textAlign:'left', display:'flex', justifyContent:'space-between', alignItems:'center', gap:8, padding:'8px 10px', borderRadius:8, cursor:'pointer', fontFamily:'inherit',
                        background: match ? '#EBF4E8' : '#FDFAF4', border:`1px solid ${match ? '#9DC87A' : 'var(--border)'}` }}>
                      <span style={{ fontSize:12 }}>
                        <strong>{v.ncp || 'CP s/n°'}</strong> · {v.patente || 's/patente'} · {v.comprador || ''} {match && <span style={{ color:'#2E4F26', fontWeight:600 }}>· coincide patente</span>}
                        <br /><span style={{ color:'var(--text-muted)', fontSize:11 }}>{fmtFechaHora(v.fecha)} · {v.grano || ''} · {v.titular || ''}</span>
                      </span>
                      <span style={{ fontSize:11, color:'var(--musgo)', whiteSpace:'nowrap' }}>{v.neto_romaneo ? Math.round(v.neto_romaneo).toLocaleString('es-AR')+' kg' : ''}</span>
                    </button>
                  )
                })
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal ticket ── */}
      {ticket && (() => {
        const texto = ticketTexto(ticket)
        const sinSync = ticket._sync === 'pending'
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
            onClick={e => e.target === e.currentTarget && setTicket(null)}>
            <div style={{ background: 'white', borderRadius: 14, padding: 20, width: 'min(96vw, 460px)', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 12px 48px rgba(0,0,0,0.25)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--tierra)' }}>{ticket.ticket_numero ? `Ticket N° ${ticket.ticket_numero}` : `Borrador ${ticket.local_num}`}</div>
                <button onClick={() => setTicket(null)} style={{ padding: '4px 10px', background: '#FAECE7', border: '1px solid #F0997B', borderRadius: 6, fontSize: 12, cursor: 'pointer', color: '#993C1D' }}>Cerrar</button>
              </div>

              {sinSync && (
                <div style={{ fontSize: 11, color: '#6B3E22', background: '#F5EDD8', border: '1px solid #C8A96E', borderRadius: 6, padding: '6px 10px', marginBottom: 10 }}>
                  Sin sincronizar todavía. El número definitivo se asigna al conectarse. {online ? 'Tocá "Sincronizar" arriba.' : 'Se sincroniza solo cuando vuelva internet.'}
                </div>
              )}

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
