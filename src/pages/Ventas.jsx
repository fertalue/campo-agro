import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

const CAMPANHAS   = ['25-26','24-25','23-24','22-23']
const GRANOS      = ['Maíz','Soja','Soja semilla','Trigo','Girasol']
const TIPOS       = ['Venta','Alquiler','Prestamo']
const TITULARES   = ['Fer','Leo','Giaguaro','Ketopy S.A','Dari','Dario']
const COMPRADORES = ['FYO Acopio S.A.','Tecnocampo','Oro verde','conci srl','Monsanto','MAS AGRO','DARIO ROSSI','6 hermanos','Eslava Gustavo']

const ALQUILER_PCT = 0.27
const GRANO_COLOR = { 'Maíz':'#C8A96E', 'Soja':'#4A7C3F', 'Soja semilla':'#9DC87A', 'Trigo':'#A0714F', 'Girasol':'#EF9F27' }
const TIPO_CHIP   = { 'Venta':'chip-green', 'Alquiler':'chip-amber', 'Prestamo':'chip-sky', 'Cosecha':'chip-muted' }

function fmtTn(n) { if (!n) return '—'; return (n/1000).toLocaleString('es-AR',{minimumFractionDigits:1,maximumFractionDigits:1}) + ' tn' }
function fmtKg(n) { if (!n) return '—'; return Math.round(n).toLocaleString('es-AR') + ' kg' }
function fmtPct(n) { if (!n && n!==0) return '—'; return parseFloat(n).toFixed(1) + '%' }
function fmtFecha(f) { if (!f) return '—'; return new Date(f+'T12:00:00').toLocaleDateString('es-AR',{day:'2-digit',month:'short',year:'2-digit'}) }

const CSS = `
.vt-tabs{display:flex;gap:4px;margin-bottom:16px;border-bottom:1px solid #D8C9A8;}
.vt-tab{padding:8px 16px;font-size:12px;cursor:pointer;border-radius:8px 8px 0 0;color:#A08060;border:1px solid transparent;border-bottom:none;transition:all .15s;margin-bottom:-1px;background:transparent;font-family:inherit;}
.vt-tab.on{background:#FDFAF4;border-color:#D8C9A8;color:#3B2E1E;font-weight:500;}
.vt-stat{background:#FDFAF4;border:1px solid #D8C9A8;border-radius:10px;padding:12px 14px;}
.vt-sl{font-size:10px;color:#A08060;font-weight:500;letter-spacing:.06em;text-transform:uppercase;margin-bottom:5px;}
.vt-sv{font-size:18px;font-weight:600;color:#3B2E1E;line-height:1;}
.vt-ss{font-size:11px;color:#A08060;margin-top:4px;}
.vt-bar{height:3px;background:#E8D5A3;border-radius:2px;margin-top:8px;}
.vt-fill{height:3px;border-radius:2px;}
.vt-tbl{width:100%;border-collapse:collapse;font-size:12px;}
.vt-tbl th{text-align:left;padding:7px 10px;font-size:10px;font-weight:600;color:#A08060;letter-spacing:.05em;text-transform:uppercase;border-bottom:1px solid #D8C9A8;white-space:nowrap;}
.vt-tbl td{padding:8px 10px;border-bottom:1px solid #EDE0C8;color:#3B2E1E;vertical-align:middle;white-space:nowrap;}
.vt-tbl tr:last-child td{border-bottom:none;}
.vt-tbl tr:hover td{background:#FDFAF0;}
.cc{display:inline-flex;align-items:center;padding:2px 7px;border-radius:20px;font-size:10px;font-weight:500;}
.chip-green{background:#EBF4E8;color:#2E4F26;}
.chip-amber{background:#F5EDD8;color:#6B3E22;}
.chip-sky{background:#E4F0F4;color:#2C5A6A;}
.chip-muted{background:#EFECE4;color:#7A6040;}
.chip-red{background:#FCEBEB;color:#993C1D;}
.vt-prog-wrap{background:#E8D5A3;border-radius:6px;height:12px;overflow:hidden;flex:1;}
.vt-prog-fill{height:12px;border-radius:6px;transition:width .5s;}
`

function StatCard({ label, value, sub, color, pct }) {
  return (
    <div className="vt-stat">
      <div className="vt-sl">{label}</div>
      <div className="vt-sv">{value}</div>
      <div className="vt-ss">{sub}</div>
      <div className="vt-bar"><div className="vt-fill" style={{ width: `${Math.min(pct||70,100)}%`, background: color }} /></div>
    </div>
  )
}

// ── Fila de edición de viaje ────────────────────────────────────────────────
function EditRowViaje({ viaje, onSave, onDelete, onCancel, puedeEliminar }) {
  const [form, setForm] = useState({
    fecha:             viaje.fecha || '',
    campanha:          viaje.campanha || '25-26',
    tipo:              viaje.tipo || 'Venta',
    ncp:               viaje.ncp || '',
    ctg:               viaje.ctg || '',
    grano:             viaje.grano || 'Maíz',
    titular:           viaje.titular || '',
    comprador:         viaje.comprador || '',
    flete_pagador:     viaje.flete_pagador || '',
    patente:           viaje.patente || '',
    transporte:        viaje.transporte || '',
    bruto:             viaje.bruto ?? '',
    tara:              viaje.tara ?? '',
    kg_descargados:    viaje.kg_descargados ?? '',
    merma_vol:         viaje.merma_vol ?? '',
    merma_h:           viaje.merma_h ?? '',
    merma_s:           viaje.merma_s ?? '',
    neto_romaneo:      viaje.neto_romaneo ?? '',
    h_pct:             viaje.h_pct ?? '',
    contrato_aplicado: viaje.contrato_aplicado || '',
  })
  const f = (k,v) => setForm(p => ({...p,[k]:v}))
  const [saving, setSaving]       = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const [deleting, setDeleting]   = useState(false)

  const netoCalc = (parseFloat(form.bruto)||0) - (parseFloat(form.tara)||0)
  const difCalc  = (parseFloat(form.kg_descargados)||0) - netoCalc

  async function save() {
    setSaving(true)
    await onSave(form)
    setSaving(false)
  }
  async function doDelete() {
    setDeleting(true)
    await onDelete(viaje.id)
    setDeleting(false)
  }

  const si  = { padding:'4px 6px', border:'1px solid #D8C9A8', borderRadius:5, fontSize:11, fontFamily:'inherit', width:'100%', background:'#FDFAF4' }
  const ro  = { ...si, background:'#EEF2F5', color:'var(--lluvia)', fontWeight:600, cursor:'default' }
  const num = (k) => <input type="number" value={form[k]} onChange={e=>f(k,e.target.value)} style={si} />
  const txt = (k, list) => <input value={form[k]} onChange={e=>f(k,e.target.value)} style={si} list={list} />

  return (
    <tr style={{ background:'#FFF9EE' }}>
      {/* Fecha */}
      <td><input type="date" value={form.fecha} onChange={e=>f('fecha',e.target.value)} style={si} /></td>
      {/* Campaña */}
      <td><select value={form.campanha} onChange={e=>f('campanha',e.target.value)} style={si}>{CAMPANHAS.map(o=><option key={o}>{o}</option>)}</select></td>
      {/* Tipo */}
      <td><select value={form.tipo} onChange={e=>f('tipo',e.target.value)} style={si}>{TIPOS.map(o=><option key={o}>{o}</option>)}</select></td>
      {/* N° CP */}
      <td>{txt('ncp')}</td>
      {/* CTG */}
      <td>{txt('ctg')}</td>
      {/* Grano */}
      <td><select value={form.grano} onChange={e=>f('grano',e.target.value)} style={si}>{GRANOS.map(o=><option key={o}>{o}</option>)}</select></td>
      {/* Titular */}
      <td>
        {txt('titular','er-titulares')}
        <datalist id="er-titulares">{TITULARES.map(t=><option key={t} value={t}/>)}</datalist>
      </td>
      {/* Comprador */}
      <td>
        {txt('comprador','er-compradores')}
        <datalist id="er-compradores">{COMPRADORES.map(c=><option key={c} value={c}/>)}</datalist>
      </td>
      {/* Flete pagador */}
      <td>{txt('flete_pagador')}</td>
      {/* Patente */}
      <td>{txt('patente')}</td>
      {/* Bruto */}
      <td>{num('bruto')}</td>
      {/* Tara */}
      <td>{num('tara')}</td>
      {/* Neto campo — calculado */}
      <td><input readOnly value={netoCalc ? Math.round(netoCalc).toLocaleString('es-AR')+' kg' : '—'} style={ro} /></td>
      {/* Kg desc. */}
      <td>{num('kg_descargados')}</td>
      {/* Dif. — calculada */}
      <td><input readOnly value={difCalc ? (difCalc>0?'+':'')+Math.round(difCalc).toLocaleString('es-AR') : '—'} style={{...ro, color: difCalc < 0 ? '#993C1D' : 'var(--musgo)'}} /></td>
      {/* Mermas */}
      <td>{num('merma_vol')}</td>
      <td>{num('merma_h')}</td>
      <td>{num('merma_s')}</td>
      {/* Neto Romaneo */}
      <td>{num('neto_romaneo')}</td>
      {/* H% */}
      <td><input type="number" value={form.h_pct} onChange={e=>f('h_pct',e.target.value)} style={{...si,width:55}} /></td>
      {/* Contrato */}
      <td>{txt('contrato_aplicado')}</td>
      {/* Acciones */}
      <td>
        <div style={{ display:'flex', gap:4, flexWrap:'wrap', minWidth:120 }}>
          <button onClick={save} disabled={saving}
            style={{ background:'var(--pasto)', color:'white', border:'none', borderRadius:5, padding:'4px 8px', fontSize:11, cursor:'pointer', whiteSpace:'nowrap' }}>
            {saving ? '...' : '✓ OK'}
          </button>
          <button onClick={onCancel}
            style={{ background:'transparent', border:'1px solid var(--border)', borderRadius:5, padding:'4px 8px', fontSize:11, cursor:'pointer' }}>✕</button>
          {puedeEliminar && !confirmDel && (
            <button onClick={() => setConfirmDel(true)}
              style={{ background:'#FAECE7', border:'1px solid #F0997B', borderRadius:5, padding:'4px 8px', fontSize:11, cursor:'pointer', color:'#993C1D' }}>🗑</button>
          )}
          {puedeEliminar && confirmDel && (
            <div style={{ display:'flex', gap:4, alignItems:'center' }}>
              <span style={{ fontSize:10, color:'#993C1D', whiteSpace:'nowrap' }}>¿Eliminar?</span>
              <button onClick={doDelete} disabled={deleting}
                style={{ background:'#993C1D', color:'white', border:'none', borderRadius:5, padding:'4px 8px', fontSize:11, cursor:'pointer' }}>
                {deleting ? '...' : 'Sí'}
              </button>
              <button onClick={() => setConfirmDel(false)}
                style={{ background:'transparent', border:'1px solid var(--border)', borderRadius:5, padding:'4px 6px', fontSize:11, cursor:'pointer' }}>No</button>
            </div>
          )}
        </div>
      </td>
    </tr>
  )
}

// ── Formulario nuevo viaje ──────────────────────────────────────────────────
function FormViaje({ onSave, onCancel }) {
  const empty = {
    fecha:'', campanha:'25-26', tipo:'Venta', ncp:'', grano:'Maíz',
    titular:'Fer', ctg:'', comprador:'FYO Acopio S.A.', transporte:'',
    patente:'', bruto:'', tara:'', neto:'', kg_descargados:'',
    merma_vol:'', merma_h:'', merma_s:'', neto_romaneo:'',
    h_pct:'', kg_sin_contrato:'', contrato_aplicado:'', flete_pagador:'',
  }
  const [form, setForm] = useState({ ...empty, fecha: new Date().toISOString().split('T')[0] })
  const f = (k,v) => setForm(p => ({...p,[k]:v}))
  const [saving, setSaving]       = useState(false)
  const [archivo, setArchivo]     = useState(null)
  const [leyendoIA, setLeyendoIA] = useState(false)
  const [iaMsg, setIaMsg]         = useState('')
  const fileRef = useRef()

  const neto = (parseFloat(form.bruto)||0) - (parseFloat(form.tara)||0)
  const dif  = (parseFloat(form.kg_descargados)||0) - neto
  const mermaTotal      = (parseFloat(form.merma_vol)||0) + (parseFloat(form.merma_h)||0) + (parseFloat(form.merma_s)||0)
  const netoRomaneoCalc = (parseFloat(form.kg_descargados)||0) - mermaTotal

  async function leerCartaDePorte() {
    if (!archivo) return
    setLeyendoIA(true); setIaMsg('Leyendo archivo...')
    try {
      const base64 = await new Promise((res, rej) => {
        const r = new FileReader()
        r.onload = () => res(r.result.split(',')[1])
        r.onerror = rej
        r.readAsDataURL(archivo)
      })
      const mediaType = archivo.type || (archivo.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg')
      setIaMsg('Analizando con IA...')
      const resp = await fetch('/api/analizar-carta-porte', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64, mediaType })
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(`API ${resp.status}: ${JSON.stringify(data?.error)}`)
      const text   = data.content?.[0]?.text || ''
      const parsed = JSON.parse(text.replace(/```json|```/g, '').trim())
      setIaMsg('✓ Datos cargados')
      if (parsed.titular)       f('titular',       parsed.titular)
      if (parsed.ncp)           f('ncp',           parsed.ncp)
      if (parsed.ctg)           f('ctg',           parsed.ctg)
      if (parsed.fecha) { const yr = parseInt(parsed.fecha.slice(0,4)); if (yr >= 2024 && yr <= 2030) f('fecha', parsed.fecha) }
      if (parsed.campanha)      f('campanha',      parsed.campanha)
      if (parsed.grano)         f('grano',         parsed.grano)
      if (parsed.comprador)     f('comprador',     parsed.comprador)
      if (parsed.flete_pagador) f('flete_pagador', parsed.flete_pagador)
      if (parsed.patente)       f('patente',       parsed.patente)
      if (parsed.transporte)    f('transporte',    parsed.transporte)
      if (parsed.bruto)         f('bruto',         String(parsed.bruto))
      if (parsed.tara)          f('tara',          String(parsed.tara))
      setTimeout(() => setIaMsg(''), 5000)
    } catch(err) {
      setIaMsg('Error: ' + (err?.message || String(err)))
      setTimeout(() => setIaMsg(''), 8000)
    }
    setLeyendoIA(false)
  }

  async function submit(e) {
    e.preventDefault(); setSaving(true)
    await supabase.from('granos_viajes').insert({
      ...form,
      bruto: parseFloat(form.bruto)||null, tara: parseFloat(form.tara)||null,
      neto: neto||null, kg_descargados: parseFloat(form.kg_descargados)||null,
      dif_puerto: dif||null,
      merma_vol: parseFloat(form.merma_vol)||null,
      merma_h: parseFloat(form.merma_h)||null,
      merma_s: parseFloat(form.merma_s)||null,
      neto_romaneo: parseFloat(form.neto_romaneo)||netoRomaneoCalc||null,
      h_pct: parseFloat(form.h_pct)||null,
      kg_sin_contrato: parseFloat(form.kg_sin_contrato)||null,
      flete_pagador: form.flete_pagador || null,
    })
    setSaving(false); onSave()
  }

  const inp = (k, type='text', ph='') => (
    <input className="input" type={type} value={form[k]} placeholder={ph}
      onChange={e => f(k, e.target.value)} style={{ width:'100%' }} />
  )
  const sel = (k, opts) => (
    <select className="select" value={form[k]} onChange={e => f(k, e.target.value)} style={{ width:'100%' }}>
      {opts.map(o => <option key={o}>{o}</option>)}
    </select>
  )

  return (
    <div className="card mb-3" style={{ background:'#F9F6EE', borderColor:'var(--paja)' }}>
      <h3 style={{ marginBottom:16 }}>Nuevo viaje</h3>

      {/* Upload carta de porte con IA */}
      <div style={{ marginBottom:14 }}>
        <div onClick={() => fileRef.current.click()}
          style={{ border:`1.5px dashed ${archivo ? 'var(--pasto)' : 'var(--border)'}`, borderRadius:8, padding:'12px 16px', textAlign:'center', cursor:'pointer', background: archivo ? 'var(--verde-light)' : 'transparent', fontSize:12, color: archivo ? 'var(--musgo)' : 'var(--text-muted)' }}>
          {archivo ? `✓ ${archivo.name}` : '📄 Subir Carta de Porte (PDF o imagen) — autocompletar con IA'}
        </div>
        <input ref={fileRef} type="file" accept="image/*,application/pdf" style={{ display:'none' }}
          onChange={e => { setArchivo(e.target.files[0]); setIaMsg('') }} />
        {archivo && (
          <div style={{ display:'flex', alignItems:'center', gap:10, marginTop:8 }}>
            <button type="button" onClick={leerCartaDePorte} disabled={leyendoIA}
              style={{ padding:'8px 16px', borderRadius:7, fontSize:13, cursor: leyendoIA ? 'wait' : 'pointer', border:'1px solid', fontFamily:'inherit', background: leyendoIA ? '#F5F0E4' : 'var(--pasto)', color: leyendoIA ? 'var(--arcilla)' : '#F5F0E4', borderColor: leyendoIA ? 'var(--border)' : 'var(--pasto)', fontWeight:500, transition:'all .2s' }}>
              {leyendoIA ? '⏳ Analizando...' : '✨ Analizar con IA'}
            </button>
            {iaMsg && <span style={{ fontSize:12, color: iaMsg.startsWith('✓') ? 'var(--musgo)' : iaMsg.startsWith('Error') ? '#993C1D' : 'var(--arcilla)' }}>{iaMsg}</span>}
          </div>
        )}
      </div>

      <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:12 }}>
        <div className="grid-2">
          <div className="field"><label className="label">Fecha</label>{inp('fecha','date')}</div>
          <div className="field"><label className="label">Campaña</label>{sel('campanha', CAMPANHAS)}</div>
        </div>
        <div className="grid-2">
          <div className="field"><label className="label">Tipo</label>{sel('tipo', TIPOS)}</div>
          <div className="field"><label className="label">N° CP</label>{inp('ncp','text','07878-00000001')}</div>
        </div>
        <div className="grid-2">
          <div className="field"><label className="label">Grano</label>{sel('grano', GRANOS)}</div>
          <div className="field"><label className="label">Titular</label>
            <input className="input" value={form.titular} onChange={e=>f('titular',e.target.value)}
              list="titulares-list" style={{width:'100%'}} />
            <datalist id="titulares-list">{TITULARES.map(t=><option key={t} value={t}/>)}</datalist>
          </div>
        </div>
        <div className="grid-2">
          <div className="field"><label className="label">Comprador</label>
            <input className="input" value={form.comprador} onChange={e=>f('comprador',e.target.value)}
              list="compradores-list" style={{width:'100%'}} />
            <datalist id="compradores-list">{COMPRADORES.map(c=><option key={c} value={c}/>)}</datalist>
          </div>
          <div className="field"><label className="label">Patente</label>{inp('patente')}</div>
        </div>
        <div className="grid-2">
          <div className="field"><label className="label">CTG</label>{inp('ctg')}</div>
          <div className="field"><label className="label">Flete pagador</label>{inp('flete_pagador','text','Tecnocampo S.A.')}</div>
        </div>
        <div className="field"><label className="label">Transporte / Chofer</label>{inp('transporte')}</div>

        {/* Pesada campo */}
        <div style={{ background:'#F0F6FA', border:'1px solid #B8D0D8', borderRadius:8, padding:'12px 14px' }}>
          <div style={{ fontSize:11, fontWeight:500, color:'var(--lluvia)', letterSpacing:'0.05em', textTransform:'uppercase', marginBottom:10 }}>Pesada campo</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
            <div className="field"><label className="label">Bruto (kg)</label>{inp('bruto','number')}</div>
            <div className="field"><label className="label">Tara (kg)</label>{inp('tara','number')}</div>
            <div className="field"><label className="label">Neto (kg)</label>
              <input className="input" type="number" value={neto||''} readOnly
                style={{ width:'100%', background:'#E8EFF3', color:'var(--lluvia)', fontWeight:600 }} />
            </div>
          </div>
        </div>

        {/* Descarga puerto */}
        <div style={{ background:'#F5F0E8', border:'1px solid #D8C9A8', borderRadius:8, padding:'12px 14px' }}>
          <div style={{ fontSize:11, fontWeight:500, color:'var(--arcilla)', letterSpacing:'0.05em', textTransform:'uppercase', marginBottom:10 }}>Descarga puerto</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:8 }}>
            <div className="field"><label className="label">Kg descargados</label>{inp('kg_descargados','number')}</div>
            <div className="field"><label className="label">Diferencia campo/puerto</label>
              <input className="input" type="number" value={dif||''} readOnly
                style={{ width:'100%', background:'#F0EAE0', color: dif < 0 ? '#993C1D':'var(--arcilla)', fontWeight:600 }} />
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
            <div className="field"><label className="label">Merma vol.</label>{inp('merma_vol','number')}</div>
            <div className="field"><label className="label">Merma H.</label>{inp('merma_h','number')}</div>
            <div className="field"><label className="label">Merma S.</label>{inp('merma_s','number')}</div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginTop:8 }}>
            <div className="field"><label className="label">H%</label>{inp('h_pct','number')}</div>
            <div className="field"><label className="label">Neto Romaneo (kg)</label>
              <input className="input" type="number" value={form.neto_romaneo||netoRomaneoCalc||''}
                onChange={e=>f('neto_romaneo',e.target.value)}
                style={{ width:'100%', fontWeight:600, color:'var(--musgo)' }}
                placeholder={netoRomaneoCalc ? String(Math.round(netoRomaneoCalc)) : '0'} />
            </div>
          </div>
        </div>

        <div className="grid-2">
          <div className="field"><label className="label">Kg sin contrato</label>{inp('kg_sin_contrato','number')}</div>
          <div className="field"><label className="label">Contrato aplicado</label>{inp('contrato_aplicado')}</div>
        </div>

        <div style={{ display:'flex', gap:8 }}>
          <button className="btn btn-primary" type="submit" disabled={saving}>{saving?'Guardando...':'Guardar viaje'}</button>
          <button className="btn btn-secondary" type="button" onClick={onCancel}>Cancelar</button>
        </div>
      </form>
    </div>
  )
}

// ── Formulario cosecha ──────────────────────────────────────────────────────
function FormCosecha({ onSave, onCancel }) {
  const [form, setForm] = useState({ fecha: new Date().toISOString().split('T')[0], campanha:'25-26', grano:'Maíz', neto_romaneo:'' })
  const [saving, setSaving] = useState(false)
  async function submit(e) {
    e.preventDefault(); setSaving(true)
    await supabase.from('granos_cosecha').insert({ ...form, neto_romaneo: parseFloat(form.neto_romaneo)||null })
    setSaving(false); onSave()
  }
  return (
    <div className="card mb-3" style={{ background:'#F5F9F0', borderColor:'var(--brote)' }}>
      <h3 style={{ marginBottom:14 }}>Registrar cosecha</h3>
      <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:12 }}>
        <div className="grid-2">
          <div className="field"><label className="label">Fecha</label>
            <input className="input" type="date" value={form.fecha} onChange={e=>setForm(p=>({...p,fecha:e.target.value}))} style={{width:'100%'}}/>
          </div>
          <div className="field"><label className="label">Campaña</label>
            <select className="select" value={form.campanha} onChange={e=>setForm(p=>({...p,campanha:e.target.value}))} style={{width:'100%'}}>
              {CAMPANHAS.map(c=><option key={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div className="grid-2">
          <div className="field"><label className="label">Grano</label>
            <select className="select" value={form.grano} onChange={e=>setForm(p=>({...p,grano:e.target.value}))} style={{width:'100%'}}>
              {GRANOS.map(g=><option key={g}>{g}</option>)}
            </select>
          </div>
          <div className="field"><label className="label">Total cosechado (kg Neto Romaneo)</label>
            <input className="input" type="number" value={form.neto_romaneo} onChange={e=>setForm(p=>({...p,neto_romaneo:e.target.value}))} style={{width:'100%'}} required/>
          </div>
        </div>
        <div style={{display:'flex',gap:8}}>
          <button className="btn btn-primary" type="submit" disabled={saving}>{saving?'Guardando...':'Guardar cosecha'}</button>
          <button className="btn btn-secondary" type="button" onClick={onCancel}>Cancelar</button>
        </div>
      </form>
    </div>
  )
}

// ── Multi-select para filtros ───────────────────────────────────────────────
function VtMultiSelect({ label, options, selected, onChange, placeholder }) {
  const [open, setOpen] = React.useState(false)
  const ref = useRef()

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const toggle = (opt) => onChange(selected.includes(opt) ? selected.filter(s=>s!==opt) : [...selected, opt])
  const label_ = selected.length === 0 ? placeholder : selected.length === 1 ? selected[0] : `${selected.length} selec.`

  return (
    <div style={{ position:'relative' }} ref={ref}>
      <button type="button" onClick={() => setOpen(o=>!o)}
        style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 10px', border:'1px solid', borderRadius:6, fontSize:12, cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap', background: selected.length > 0 ? '#EBF4E8' : '#F5F0E4', color: selected.length > 0 ? '#2E4F26' : '#3B2E1E', borderColor: selected.length > 0 ? '#9DC87A' : '#D8C9A8', fontWeight: selected.length > 0 ? 500 : 400 }}>
        <span style={{ fontSize:10, color: selected.length > 0 ? '#4A7C3F' : '#A08060', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em', marginRight:2 }}>{label}</span>
        {label_}
        {selected.length > 1 && <span style={{ background:'#4A7C3F', color:'#F5F0E4', borderRadius:10, padding:'1px 5px', fontSize:10, fontWeight:600 }}>{selected.length}</span>}
        <span style={{ fontSize:9, color:'#A08060', marginLeft:2 }}>▾</span>
      </button>
      {open && (
        <div style={{ position:'absolute', top:'calc(100% + 3px)', left:0, zIndex:200, background:'#FDFAF4', border:'1px solid #D8C9A8', borderRadius:8, padding:4, minWidth:170, boxShadow:'0 4px 16px rgba(59,46,30,.13)' }}>
          {options.map(opt => (
            <div key={opt} onClick={() => toggle(opt)}
              style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 10px', borderRadius:5, cursor:'pointer', fontSize:12, color:'#3B2E1E', background: selected.includes(opt) ? '#EBF4E8' : 'transparent' }}>
              <div style={{ width:14, height:14, border:'1px solid', borderColor: selected.includes(opt) ? '#4A7C3F' : '#C8B89A', borderRadius:3, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, background: selected.includes(opt) ? '#4A7C3F' : 'transparent', color:'#fff' }}>
                {selected.includes(opt) && '✓'}
              </div>
              {opt}
            </div>
          ))}
          {selected.length > 0 && (
            <div onClick={() => { onChange([]); setOpen(false) }}
              style={{ padding:'6px 10px', fontSize:11, color:'#A0714F', cursor:'pointer', textAlign:'center', borderTop:'1px solid #EDE0C8', marginTop:2 }}>
              Limpiar
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Componente principal ────────────────────────────────────────────────────
export default function Ventas() {
  const [viajes,  setViajes]  = useState([])
  const [cosecha, setCosecha] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab]         = useState('resumen')
  const [showForm,    setShowForm]    = useState(false)
  const [showCosecha, setShowCosecha] = useState(false)
  const [fCampanha, setFCampanha] = useState([])
  const [fGrano,    setFGrano]    = useState([])
  const [fTipo,     setFTipo]     = useState([])
  const [fTitular,  setFTitular]  = useState([])
  const [busqueda,  setBusqueda]  = useState('')
  const [editando,  setEditando]  = useState(null)

  const { puedeEditar, isAdmin } = useAuth()
  const puedeEditar_ = isAdmin || puedeEditar('ventas')

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [v, c] = await Promise.all([
      supabase.from('granos_viajes').select('*').order('fecha', { ascending: false }),
      supabase.from('granos_cosecha').select('*').order('fecha', { ascending: false }),
    ])
    setViajes(v.data || [])
    setCosecha(c.data || [])
    setLoading(false)
  }

  async function saveViaje(id, form) {
    const netoCalc = (parseFloat(form.bruto)||0) - (parseFloat(form.tara)||0)
    const difCalc  = (parseFloat(form.kg_descargados)||0) - netoCalc
    const clean    = v => (v === '' || v === undefined) ? null : v
    const num      = v => { const n = parseFloat(v); return isNaN(n) ? null : n }
    await supabase.from('granos_viajes').update({
      fecha:             clean(form.fecha),
      campanha:          clean(form.campanha),
      tipo:              clean(form.tipo),
      ncp:               clean(form.ncp),
      ctg:               clean(form.ctg),
      grano:             clean(form.grano),
      titular:           clean(form.titular),
      comprador:         clean(form.comprador),
      flete_pagador:     clean(form.flete_pagador),
      patente:           clean(form.patente),
      transporte:        clean(form.transporte),
      bruto:             num(form.bruto),
      tara:              num(form.tara),
      neto:              netoCalc || null,
      kg_descargados:    num(form.kg_descargados),
      dif_puerto:        difCalc || null,
      merma_vol:         num(form.merma_vol),
      merma_h:           num(form.merma_h),
      merma_s:           num(form.merma_s),
      neto_romaneo:      num(form.neto_romaneo),
      h_pct:             num(form.h_pct),
      contrato_aplicado: clean(form.contrato_aplicado),
    }).eq('id', id)
    setEditando(null)
    await fetchAll()
  }

  async function deleteViaje(id) {
    await supabase.from('granos_viajes').delete().eq('id', id)
    setEditando(null)
    await fetchAll()
  }

  // Filtros
  const matchArr = (arr, val) => arr.length === 0 || arr.includes(val)
  const filtered = viajes.filter(v => {
    if (!matchArr(fCampanha, v.campanha)) return false
    if (!matchArr(fGrano, v.grano))       return false
    if (!matchArr(fTipo, v.tipo))         return false
    if (!matchArr(fTitular, v.titular))   return false
    if (busqueda) {
      const b = busqueda.toLowerCase()
      return [v.titular, v.comprador, v.grano, v.ncp, v.ctg, v.contrato_aplicado, v.patente, v.flete_pagador]
        .some(x => x && x.toLowerCase().includes(b))
    }
    return true
  })

  const cosechaFiltrada = cosecha.filter(c => matchArr(fCampanha, c.campanha))

  // Totales
  const totalRomaneo = filtered.reduce((a,b) => a + (b.neto_romaneo||0), 0)
  const totalNeto    = filtered.reduce((a,b) => a + (b.neto||0), 0)
  const totalDif     = filtered.reduce((a,b) => a + (b.dif_puerto||0), 0)
  const totalViajes  = filtered.length

  // Por grano
  const byGrano = {}
  filtered.forEach(v => {
    if (!byGrano[v.grano]) byGrano[v.grano] = { vendido: 0, count: 0 }
    byGrano[v.grano].vendido += v.neto_romaneo || 0
    byGrano[v.grano].count   += 1
  })
  cosechaFiltrada.forEach(c => {
    if (!byGrano[c.grano]) byGrano[c.grano] = { vendido: 0, count: 0 }
    byGrano[c.grano].cosecha = (byGrano[c.grano].cosecha||0) + (c.neto_romaneo||0)
  })

  // Por titular
  const byTitular = {}
  filtered.forEach(v => {
    const t = v.titular || 'Sin titular'
    if (!byTitular[t]) byTitular[t] = 0
    byTitular[t] += v.neto_romaneo || 0
  })

  const granos = Object.keys(byGrano)

  // Distribución
  const categorias = { 'Maíz': 0, 'Soja': 0 }
  cosechaFiltrada.forEach(c => {
    if (c.grano === 'Maíz') categorias['Maíz'] += c.neto_romaneo || 0
    else categorias['Soja'] += c.neto_romaneo || 0
  })

  const distrib = Object.entries(categorias).map(([cat, cosechaTotal]) => {
    const alquiler   = cosechaTotal * ALQUILER_PCT
    const disponible = cosechaTotal * (1 - ALQUILER_PCT)
    const cuotaFer   = disponible / 2
    const cuotaLeo   = disponible / 2
    const esCategoria = (grano) => cat === 'Maíz' ? grano === 'Maíz' : (grano === 'Soja' || grano === 'Soja semilla')
    const viajesCat  = viajes.filter(v => matchArr(fCampanha, v.campanha) && esCategoria(v.grano) && v.tipo === 'Venta')
    const vendidoFer = viajesCat.filter(v => v.titular === 'Fer').reduce((a,b) => a + (b.neto_romaneo||0), 0)
    const vendidoLeo = viajesCat.filter(v => v.titular === 'Leo').reduce((a,b) => a + (b.neto_romaneo||0), 0)
    const viajesAlq  = viajes.filter(v => matchArr(fCampanha, v.campanha) && esCategoria(v.grano) && v.tipo === 'Alquiler')
    const entregadoAlquiler = viajesAlq.reduce((a,b) => a + (b.neto_romaneo||0), 0)
    return {
      cat, cosechaTotal, alquiler, disponible, cuotaFer, cuotaLeo,
      vendidoFer, vendidoLeo, entregadoAlquiler,
      restanteFer: cuotaFer - vendidoFer,
      restanteLeo: cuotaLeo - vendidoLeo,
      restanteAlquiler: alquiler - entregadoAlquiler,
    }
  }).filter(d => d.cosechaTotal > 0)

  return (
    <div>
      <style>{CSS}</style>

      <div className="flex-between mb-2">
        <div>
          <h2>Ventas / Granos</h2>
          <p style={{ fontSize:12, color:'var(--arcilla)', marginTop:2 }}>
            {totalViajes} viajes · {fmtTn(totalRomaneo)} neto romaneo
          </p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowCosecha(v=>!v)}>
            {showCosecha ? 'Cancelar' : '+ Cosecha'}
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowForm(v=>!v)}>
            {showForm ? 'Cancelar' : '+ Viaje'}
          </button>
        </div>
      </div>

      {showCosecha && <FormCosecha onSave={async()=>{setShowCosecha(false);await fetchAll()}} onCancel={()=>setShowCosecha(false)} />}
      {showForm    && <FormViaje  onSave={async()=>{setShowForm(false);  await fetchAll()}} onCancel={()=>setShowForm(false)} />}

      {/* Filtros */}
      <div style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap', alignItems:'center' }}>
        <VtMultiSelect label="Campaña"  options={CAMPANHAS}  selected={fCampanha}  onChange={setFCampanha}  placeholder="Todas" />
        <VtMultiSelect label="Grano"    options={[...new Set(viajes.map(v=>v.grano).filter(Boolean))].sort()} selected={fGrano} onChange={setFGrano} placeholder="Todos" />
        <VtMultiSelect label="Tipo"     options={TIPOS}      selected={fTipo}      onChange={setFTipo}      placeholder="Todos" />
        <VtMultiSelect label="Titular"  options={[...new Set(viajes.map(v=>v.titular).filter(Boolean))].sort()} selected={fTitular} onChange={setFTitular} placeholder="Todos" />
        {(fCampanha.length + fGrano.length + fTipo.length + fTitular.length) > 0 && (
          <button onClick={() => { setFCampanha([]); setFGrano([]); setFTipo([]); setFTitular([]) }}
            style={{ padding:'6px 10px', border:'1px solid #D8C9A8', borderRadius:6, fontSize:11, cursor:'pointer', background:'transparent', color:'var(--arcilla)', fontFamily:'inherit' }}>
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="vt-tabs">
        {[['resumen','Resumen'],['distribucion','Distribución'],['viajes','Viajes'],['mermas','Pesada vs Puerto']].map(([id,lbl]) => (
          <button key={id} className={`vt-tab${tab===id?' on':''}`} onClick={()=>setTab(id)}>{lbl}</button>
        ))}
      </div>

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,minmax(0,1fr))', gap:10, marginBottom:16 }}>
        <StatCard label="Neto Romaneo"      value={fmtTn(totalRomaneo)} sub={`${totalViajes} viajes`} color="#4A7C3F" pct={80} />
        <StatCard label="Pesada campo"      value={fmtTn(totalNeto)}    sub="neto campo"              color="#7A9EAD" pct={85} />
        <StatCard label="Dif. campo/puerto" value={fmtKg(Math.abs(totalDif))} sub={totalDif > 0 ? 'a favor' : 'en contra'} color={totalDif >= 0 ? '#4A7C3F' : '#A0714F'} pct={40} />
        <StatCard label="Camiones"          value={totalViajes.toString()} sub={`${filtered.length} viajes`} color="#C8A96E" pct={60} />
      </div>

      {/* ─────────── RESUMEN ─────────── */}
      {tab === 'resumen' && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
          <div className="card">
            <h3 style={{ fontSize:14, marginBottom:14 }}>Por grano — % cosecha vendida</h3>
            {granos.length === 0
              ? <div style={{ fontSize:13, color:'var(--arcilla)' }}>Sin datos</div>
              : granos.map(g => {
                const data = byGrano[g]
                const pct  = data.cosecha ? Math.min((data.vendido/data.cosecha)*100,100) : null
                const col  = GRANO_COLOR[g] || '#888'
                return (
                  <div key={g} style={{ marginBottom:14 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <div style={{ width:10, height:10, borderRadius:'50%', background:col, flexShrink:0 }}/>
                        <span style={{ fontSize:13, fontWeight:500 }}>{g}</span>
                        <span style={{ fontSize:11, color:'var(--text-muted)' }}>({data.count} viajes)</span>
                      </div>
                      <div style={{ textAlign:'right' }}>
                        <span style={{ fontSize:13, fontWeight:600 }}>{fmtTn(data.vendido)}</span>
                        {data.cosecha && <span style={{ fontSize:11, color:'var(--text-muted)', marginLeft:6 }}>de {fmtTn(data.cosecha)}</span>}
                      </div>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <div className="vt-prog-wrap">
                        <div className="vt-prog-fill" style={{ width: pct ? `${pct}%`:'100%', background: col, opacity: pct ? 1 : 0.3 }}/>
                      </div>
                      <span style={{ fontSize:12, fontWeight:600, color:col, width:40, textAlign:'right', flexShrink:0 }}>
                        {pct ? `${Math.round(pct)}%` : '—'}
                      </span>
                    </div>
                    {data.cosecha && (
                      <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:3 }}>
                        Queda: {fmtTn(data.cosecha - data.vendido)} · Cosecha total: {fmtTn(data.cosecha)}
                      </div>
                    )}
                  </div>
                )
              })}
          </div>
          <div className="card">
            <h3 style={{ fontSize:14, marginBottom:14 }}>Por titular</h3>
            {Object.entries(byTitular).sort((a,b)=>b[1]-a[1]).map(([tit, vol]) => (
              <div key={tit} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 0', borderBottom:'1px solid #EDE0C8' }}>
                <div style={{ width:32, height:32, borderRadius:'50%', background:'var(--verde-light)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:600, color:'var(--musgo)', flexShrink:0 }}>
                  {tit.slice(0,2).toUpperCase()}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:500 }}>{tit}</div>
                  <div style={{ height:6, background:'#E8D5A3', borderRadius:3, marginTop:4, overflow:'hidden' }}>
                    <div style={{ height:6, borderRadius:3, background:'var(--pasto)', width:`${vol/totalRomaneo*100}%` }}/>
                  </div>
                </div>
                <div style={{ textAlign:'right', flexShrink:0 }}>
                  <div style={{ fontSize:14, fontWeight:600 }}>{fmtTn(vol)}</div>
                  <div style={{ fontSize:11, color:'var(--text-muted)' }}>{totalRomaneo ? Math.round(vol/totalRomaneo*100) : 0}%</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─────────── VIAJES (con edición inline) ─────────── */}
      {tab === 'viajes' && (
        <div>
          <div style={{ marginBottom:10, position:'relative' }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="var(--arcilla)" strokeWidth="1.5" strokeLinecap="round" style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }}>
              <circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5L14 14"/>
            </svg>
            <input value={busqueda} onChange={e=>setBusqueda(e.target.value)}
              placeholder="Buscar por titular, comprador, CTG, contrato, patente, flete..."
              style={{ width:'100%', padding:'9px 12px 9px 32px', border:'1px solid #D8C9A8', borderRadius:8, fontSize:13, background:'#FDFAF4', fontFamily:'inherit' }} />
          </div>

          <div className="card" style={{ padding:0, overflowX:'auto' }}>
            {loading
              ? <div style={{ padding:32, textAlign:'center', fontSize:13, color:'var(--arcilla)' }}>Cargando...</div>
              : filtered.length === 0
              ? <div style={{ padding:32, textAlign:'center', fontSize:13, color:'var(--arcilla)' }}>Sin viajes</div>
              : <table className="vt-tbl">
                  <thead><tr>
                    <th>Fecha</th><th>Campaña</th><th>Tipo</th><th>N°CP</th><th>CTG</th><th>Grano</th>
                    <th>Titular</th><th>Comprador</th><th>Flete pag.</th><th>Patente</th>
                    <th>Bruto</th><th>Tara</th><th>Neto campo</th>
                    <th>Kg desc.</th><th>Dif.</th>
                    <th>M.vol</th><th>M.H</th><th>M.S</th>
                    <th>Neto Romaneo</th><th>H%</th><th>Contrato</th>
                    {puedeEditar_ && <th></th>}
                  </tr></thead>
                  <tbody>
                    {filtered.map(v => {
                      if (editando === v.id) {
                        return (
                          <EditRowViaje key={v.id} viaje={v}
                            puedeEliminar={puedeEditar_}
                            onSave={form => saveViaje(v.id, form)}
                            onDelete={deleteViaje}
                            onCancel={() => setEditando(null)} />
                        )
                      }
                      return (
                        <tr key={v.id}>
                          <td style={{ color:'var(--text-muted)' }}>{fmtFecha(v.fecha)}</td>
                          <td style={{ color:'var(--text-muted)' }}>{v.campanha}</td>
                          <td><span className={`cc ${TIPO_CHIP[v.tipo]||'chip-muted'}`}>{v.tipo}</span></td>
                          <td style={{ color:'var(--text-muted)', fontSize:11 }}>{v.ncp || '—'}</td>
                          <td style={{ color:'var(--text-muted)', fontSize:11 }}>{v.ctg || '—'}</td>
                          <td>
                            <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                              <div style={{ width:8, height:8, borderRadius:'50%', background:GRANO_COLOR[v.grano]||'#888', flexShrink:0 }}/>
                              {v.grano}
                            </div>
                          </td>
                          <td style={{ fontWeight:500 }}>{v.titular}</td>
                          <td style={{ color:'var(--suelo)' }}>{v.comprador}</td>
                          <td style={{ fontSize:11, color:'var(--text-muted)' }}>{v.flete_pagador || '—'}</td>
                          <td style={{ fontSize:11, color:'var(--text-muted)' }}>{v.patente || '—'}</td>
                          <td style={{ fontFamily:'monospace' }}>{fmtKg(v.bruto)}</td>
                          <td style={{ fontFamily:'monospace' }}>{fmtKg(v.tara)}</td>
                          <td style={{ fontFamily:'monospace', fontWeight:500 }}>{fmtKg(v.neto)}</td>
                          <td style={{ fontFamily:'monospace' }}>{fmtKg(v.kg_descargados)}</td>
                          <td style={{ fontFamily:'monospace', color: (v.dif_puerto||0) > 0 ? 'var(--musgo)' : '#993C1D' }}>
                            {v.dif_puerto ? `${v.dif_puerto > 0 ? '+':''}${Math.round(v.dif_puerto).toLocaleString('es-AR')}` : '—'}
                          </td>
                          <td style={{ fontFamily:'monospace', color:'var(--text-muted)' }}>{fmtKg(v.merma_vol)}</td>
                          <td style={{ fontFamily:'monospace', color:'var(--text-muted)' }}>{fmtKg(v.merma_h)}</td>
                          <td style={{ fontFamily:'monospace', color:'var(--text-muted)' }}>{fmtKg(v.merma_s)}</td>
                          <td style={{ fontFamily:'monospace', fontWeight:600, color:'var(--musgo)' }}>{fmtKg(v.neto_romaneo)}</td>
                          <td style={{ color:'var(--text-muted)' }}>{fmtPct(v.h_pct)}</td>
                          <td style={{ fontSize:11, color:'var(--text-muted)' }}>{v.contrato_aplicado || '—'}</td>
                          {puedeEditar_ && (
                            <td>
                              <button onClick={() => setEditando(v.id)}
                                style={{ background:'transparent', border:'1px solid var(--border)', borderRadius:5, padding:'3px 8px', fontSize:11, cursor:'pointer', color:'var(--arcilla)', whiteSpace:'nowrap' }}>
                                Editar
                              </button>
                            </td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ background:'#F5F0E4', fontWeight:600 }}>
                      <td colSpan={10} style={{ padding:'10px', fontSize:11, color:'var(--text-muted)' }}>{filtered.length} viajes</td>
                      <td colSpan={2}></td>
                      <td style={{ padding:'10px', fontFamily:'monospace' }}>{fmtKg(totalNeto)}</td>
                      <td></td>
                      <td style={{ padding:'10px', fontFamily:'monospace', color: totalDif >= 0 ? 'var(--musgo)' : '#993C1D' }}>
                        {totalDif ? `${totalDif>0?'+':''}${Math.round(totalDif).toLocaleString('es-AR')}` : '—'}
                      </td>
                      <td colSpan={3}></td>
                      <td style={{ padding:'10px', fontFamily:'monospace', color:'var(--musgo)' }}>{fmtKg(totalRomaneo)}</td>
                      <td colSpan={puedeEditar_ ? 3 : 2}></td>
                    </tr>
                  </tfoot>
                </table>}
          </div>
        </div>
      )}

      {/* ─────────── MERMAS ─────────── */}
      {tab === 'mermas' && (
        <div>
          {granos.map(g => {
            const gViajes = filtered.filter(v => v.grano === g && v.neto)
            if (!gViajes.length) return null
            const gNeto     = gViajes.reduce((a,b) => a+(b.neto||0), 0)
            const gDescarg  = gViajes.reduce((a,b) => a+(b.kg_descargados||0), 0)
            const gRomaneo  = gViajes.reduce((a,b) => a+(b.neto_romaneo||0), 0)
            const gMermaVol = gViajes.reduce((a,b) => a+(b.merma_vol||0), 0)
            const gMermaH   = gViajes.reduce((a,b) => a+(b.merma_h||0), 0)
            const gMermaS   = gViajes.reduce((a,b) => a+(b.merma_s||0), 0)
            const pctMerma  = gNeto > 0 ? ((gNeto - gRomaneo) / gNeto * 100) : 0
            const col       = GRANO_COLOR[g] || '#888'
            return (
              <div key={g} className="card" style={{ marginBottom:14 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <div style={{ width:12, height:12, borderRadius:'50%', background:col }}/>
                    <h3 style={{ fontSize:14 }}>{g}</h3>
                    <span style={{ fontSize:11, color:'var(--text-muted)' }}>{gViajes.length} viajes</span>
                  </div>
                  <span style={{ fontSize:12, color: pctMerma > 3 ? '#993C1D' : 'var(--musgo)', fontWeight:600 }}>
                    Pérdida total: {pctMerma.toFixed(2)}%
                  </span>
                </div>
                <div style={{ display:'flex', height:32, borderRadius:8, overflow:'hidden', marginBottom:12, fontSize:11, fontWeight:500 }}>
                  <div style={{ background:col, flex: gRomaneo, display:'flex', alignItems:'center', justifyContent:'center', color:'white', minWidth:60 }}>Romaneo</div>
                  {gMermaVol > 0 && <div style={{ background:'#A0714F', flex:gMermaVol, display:'flex', alignItems:'center', justifyContent:'center', color:'white', minWidth:30 }}>vol</div>}
                  {gMermaH > 0 && <div style={{ background:'#7A9EAD', flex:gMermaH, display:'flex', alignItems:'center', justifyContent:'center', color:'white', minWidth:30 }}>H</div>}
                  {gMermaS > 0 && <div style={{ background:'#C8A96E', flex:gMermaS, display:'flex', alignItems:'center', justifyContent:'center', color:'white', minWidth:30 }}>S</div>}
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:8 }}>
                  {[['Neto campo',fmtTn(gNeto),'#7A9EAD'],['Descargado',fmtTn(gDescarg),'#4E7A8A'],['Merma vol.',fmtTn(gMermaVol),'#A0714F'],['Merma H.',fmtTn(gMermaH),'#7A9EAD'],['Merma S.',fmtTn(gMermaS),'#C8A96E'],['Neto Romaneo',fmtTn(gRomaneo),col]].map(([lbl,val,c]) => (
                    <div key={lbl} style={{ background:'#FAF7F0', borderRadius:8, padding:'10px', textAlign:'center' }}>
                      <div style={{ fontSize:10, color:'var(--text-muted)', fontWeight:500, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:4 }}>{lbl}</div>
                      <div style={{ fontSize:13, fontWeight:600, color:c }}>{val}</div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ─────────── DISTRIBUCIÓN ─────────── */}
      {tab === 'distribucion' && (
        <div>
          {fCampanha.length !== 1 && (
            <div style={{ padding:'10px 14px', background:'#F5EDD8', border:'1px solid #C8A96E', borderRadius:8, marginBottom:14, fontSize:12, color:'#6B3E22' }}>
              Seleccioná una campaña específica para ver la distribución correcta.
            </div>
          )}
          {distrib.length === 0 ? (
            <div className="card" style={{ textAlign:'center', fontSize:13, color:'var(--arcilla)' }}>
              No hay datos de cosecha para {fCampanha.join(', ')||'la campaña'}. Registrá la cosecha primero con el botón "+ Cosecha".
            </div>
          ) : distrib.map(d => (
            <div key={d.cat} className="card" style={{ marginBottom:16 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
                <div style={{ width:14, height:14, borderRadius:'50%', background: d.cat === 'Maíz' ? '#C8A96E' : '#4A7C3F' }}/>
                <h3 style={{ fontSize:15 }}>{d.cat}</h3>
                <span style={{ fontSize:12, color:'var(--text-muted)' }}>Cosecha total: {fmtTn(d.cosechaTotal)}</span>
              </div>
              <div style={{ display:'flex', height:36, borderRadius:8, overflow:'hidden', marginBottom:16, fontSize:11, fontWeight:500 }}>
                <div style={{ flex: d.alquiler, background:'#A0714F', display:'flex', alignItems:'center', justifyContent:'center', color:'white', gap:4, minWidth:60 }}><span>Alquiler 27%</span></div>
                <div style={{ flex: d.cuotaFer, background:'#4A7C3F', display:'flex', alignItems:'center', justifyContent:'center', color:'white', gap:4, minWidth:50 }}><span>Fer</span></div>
                <div style={{ flex: d.cuotaLeo, background:'#C8A96E', display:'flex', alignItems:'center', justifyContent:'center', color:'white', gap:4, minWidth:50 }}><span>Leo</span></div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
                <div style={{ background:'#FAF3EC', border:'1px solid #D8C9A8', borderRadius:10, padding:'14px' }}>
                  <div style={{ fontSize:10, fontWeight:600, color:'#A0714F', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8 }}>Alquiler — Padre</div>
                  <div style={{ fontSize:10, color:'var(--text-muted)', marginBottom:10 }}>Ketopy · Giaguaro · Dario</div>
                  <div style={{ marginBottom:8 }}><div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:2 }}>Le corresponde</div><div style={{ fontSize:18, fontWeight:600, color:'#A0714F' }}>{fmtTn(d.alquiler)}</div></div>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                    <div><div style={{ fontSize:11, color:'var(--text-muted)' }}>Entregado</div><div style={{ fontSize:14, fontWeight:600, color:'#4A7C3F' }}>{fmtTn(d.entregadoAlquiler)}</div></div>
                    <div style={{ textAlign:'right' }}><div style={{ fontSize:11, color:'var(--text-muted)' }}>Pendiente</div><div style={{ fontSize:14, fontWeight:600, color: d.restanteAlquiler > 0 ? '#993C1D' : '#4A7C3F' }}>{d.restanteAlquiler > 0 ? fmtTn(d.restanteAlquiler) : '✓ Completo'}</div></div>
                  </div>
                  <div style={{ height:8, background:'#E8D5A3', borderRadius:4, overflow:'hidden' }}><div style={{ height:8, borderRadius:4, background:'#A0714F', width:`${Math.min(d.alquiler > 0 ? d.entregadoAlquiler/d.alquiler*100 : 0, 100)}%`, transition:'width .5s' }}/></div>
                  <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:4, textAlign:'right' }}>{d.alquiler > 0 ? Math.round(d.entregadoAlquiler/d.alquiler*100) : 0}% entregado</div>
                </div>
                {[
                  { nombre:'Fer', cuota: d.cuotaFer, vendido: d.vendidoFer, restante: d.restanteFer, col:'#4A7C3F', bg:'#F0F7EE', border:'#9DC87A' },
                  { nombre:'Leo', cuota: d.cuotaLeo, vendido: d.vendidoLeo, restante: d.restanteLeo, col:'#C8A96E', bg:'#FAF5EC', border:'#D8C9A8' },
                ].map(p => (
                  <div key={p.nombre} style={{ background: p.bg, border:`1px solid ${p.border}`, borderRadius:10, padding:'14px' }}>
                    <div style={{ fontSize:10, fontWeight:600, color: p.col, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8 }}>{p.nombre}</div>
                    <div style={{ fontSize:10, color:'var(--text-muted)', marginBottom:10 }}>50% del disponible</div>
                    <div style={{ marginBottom:8 }}><div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:2 }}>Le corresponde</div><div style={{ fontSize:18, fontWeight:600, color: p.col }}>{fmtTn(p.cuota)}</div></div>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                      <div><div style={{ fontSize:11, color:'var(--text-muted)' }}>Ya vendió</div><div style={{ fontSize:14, fontWeight:600, color:'#4A7C3F' }}>{fmtTn(p.vendido)}</div></div>
                      <div style={{ textAlign:'right' }}><div style={{ fontSize:11, color:'var(--text-muted)' }}>Le queda</div><div style={{ fontSize:14, fontWeight:600, color: p.restante > 0 ? '#993C1D' : '#4A7C3F' }}>{p.restante > 0 ? fmtTn(p.restante) : '✓ Todo vendido'}</div></div>
                    </div>
                    <div style={{ height:8, background:'#E8D5A3', borderRadius:4, overflow:'hidden' }}><div style={{ height:8, borderRadius:4, background: p.col, width:`${Math.min(p.cuota > 0 ? p.vendido/p.cuota*100 : 0, 100)}%`, transition:'width .5s' }}/></div>
                    <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:4, textAlign:'right' }}>{p.cuota > 0 ? Math.round(p.vendido/p.cuota*100) : 0}% vendido</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
