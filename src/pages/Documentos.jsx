import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

const CATEGORIAS_DEFAULT = ['General','Contratos','Facturas','Seguros','Mapas y lotes','Análisis de suelo','Fitosanitarios','Maquinaria','Recursos humanos','Otro']

const ICONOS = {
  'application/pdf': '📄',
  'image/':          '🖼️',
  'application/vnd': '📊',
  'text/':           '📝',
  'video/':          '🎬',
  'audio/':          '🎵',
}

function getIcono(tipo) {
  if (!tipo) return '📎'
  for (const [k,v] of Object.entries(ICONOS)) {
    if (tipo.startsWith(k)) return v
  }
  return '📎'
}

function fmtBytes(b) {
  if (!b) return '—'
  if (b < 1024) return b + ' B'
  if (b < 1024*1024) return (b/1024).toFixed(0) + ' KB'
  return (b/1024/1024).toFixed(1) + ' MB'
}

function fmtFecha(f) {
  if (!f) return '—'
  return new Date(f).toLocaleDateString('es-AR',{day:'2-digit',month:'short',year:'numeric'})
}

export default function Documentos() {
  const { user, puedeEditar, isAdmin } = useAuth()
  const canEdit = isAdmin || puedeEditar('documentos')
  const quien = user?.user_metadata?.nombre || user?.email || ''

  const [docs, setDocs]             = useState([])
  const [loading, setLoading]       = useState(true)
  const [uploading, setUploading]   = useState(false)
  const [fCat, setFCat]             = useState('todas')
  const [busqueda, setBusqueda]     = useState('')
  const [showForm, setShowForm]     = useState(false)
  const [dragOver, setDragOver]     = useState(false)
  const [editDoc, setEditDoc]       = useState(null)   // { id, nombre, categoria, descripcion }
  const [savingEdit, setSavingEdit] = useState(false)
  const [categorias, setCategorias] = useState(CATEGORIAS_DEFAULT)
  const [preview, setPreview]       = useState(null)   // { doc, url, tipo }
  const fileRef                     = useRef()

  // Form upload
  const [fNombre, setFNombre]     = useState('')
  const [fDesc, setFDesc]         = useState('')
  const [fCatForm, setFCatForm]   = useState('General')
  const [fFile, setFFile]         = useState(null)

  useEffect(() => { fetchDocs(); fetchCategorias() }, [])

  async function fetchCategorias() {
    // Categorías desde datos maestros (tipo 'categoria_documento'); fallback a la lista local
    const { data } = await supabase.from('maestros').select('valor')
      .eq('tipo','categoria_documento').eq('activo',true).order('orden').order('valor')
    if (data?.length) setCategorias(data.map(d => d.valor))
  }

  async function fetchDocs() {
    setLoading(true)
    const { data } = await supabase.from('documentos').select('*').order('created_at', { ascending: false })
    setDocs(data || [])
    setLoading(false)
  }

  async function handleUpload(e) {
    e.preventDefault()
    if (!fFile) return
    setUploading(true)
    const ext    = fFile.name.split('.').pop()
    const path   = `${Date.now()}_${fFile.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`
    const nombre = fNombre || fFile.name

    const { error: upErr } = await supabase.storage.from('documentos').upload(path, fFile)
    if (upErr) { alert('Error al subir: ' + upErr.message); setUploading(false); return }

    await supabase.from('documentos').insert({
      nombre, descripcion: fDesc||null, categoria: fCatForm,
      bucket_path: path, tipo_archivo: fFile.type,
      tamano_bytes: fFile.size, quien_subio: quien,
    })
    setFNombre(''); setFDesc(''); setFCatForm('General'); setFFile(null)
    setShowForm(false); setUploading(false)
    await fetchDocs()
  }

  async function handleDownload(doc) {
    const { data } = await supabase.storage.from('documentos').createSignedUrl(doc.bucket_path, 60)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  function tipoPreview(doc) {
    const t = doc.tipo_archivo || ''
    if (t.startsWith('image/')) return 'imagen'
    if (t === 'application/pdf') return 'pdf'
    if (t.startsWith('video/')) return 'video'
    if (t.startsWith('audio/')) return 'audio'
    if (t.startsWith('text/')) return 'texto'
    return null
  }

  async function handlePreview(doc) {
    const tipo = tipoPreview(doc)
    if (!tipo) { handleDownload(doc); return }
    const { data, error } = await supabase.storage.from('documentos').createSignedUrl(doc.bucket_path, 600)
    if (error || !data?.signedUrl) { alert('No se pudo generar la vista previa.'); return }
    setPreview({ doc, url: data.signedUrl, tipo })
  }

  async function handleDelete(doc) {
    if (!confirm(`¿Eliminar "${doc.nombre}"?`)) return
    await supabase.storage.from('documentos').remove([doc.bucket_path])
    await supabase.from('documentos').delete().eq('id', doc.id)
    await fetchDocs()
  }

  async function handleSaveEdit() {
    if (!editDoc?.nombre?.trim()) { alert('El nombre no puede quedar vacío.'); return }
    setSavingEdit(true)
    const { error } = await supabase.from('documentos')
      .update({ nombre: editDoc.nombre.trim(), categoria: editDoc.categoria, descripcion: editDoc.descripcion?.trim() || null })
      .eq('id', editDoc.id)
    setSavingEdit(false)
    if (error) { alert('Error al guardar: ' + error.message); return }
    setEditDoc(null)
    await fetchDocs()
  }

  function onDrop(e) {
    e.preventDefault(); setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) { setFFile(file); setFNombre(f => f || file.name); setShowForm(true) }
  }

  // Barra lateral: categorías de maestros + las que existan en docs (huérfanas de renombres/bajas)
  const catsVisibles = [...new Set([...categorias, ...docs.map(d => d.categoria).filter(Boolean)])]

  const docsFiltrados = docs.filter(d => {
    if (fCat !== 'todas' && d.categoria !== fCat) return false
    if (busqueda && !d.nombre.toLowerCase().includes(busqueda.toLowerCase()) &&
        !d.descripcion?.toLowerCase().includes(busqueda.toLowerCase())) return false
    return true
  })

  const conteoPorCat = catsVisibles.reduce((acc,c) => {
    acc[c] = docs.filter(d => d.categoria === c).length
    return acc
  }, {})

  return (
    <div>
      {/* Header */}
      <div className="flex-between mb-2">
        <div>
          <h2>Documentos</h2>
          <p style={{fontSize:12,color:'var(--arcilla)',marginTop:2}}>
            {docs.length} archivos · {fmtBytes(docs.reduce((a,d)=>a+(d.tamano_bytes||0),0))} en total
          </p>
        </div>
        {canEdit && (
          <button className="btn btn-primary btn-sm" onClick={()=>setShowForm(v=>!v)}>
            {showForm ? 'Cancelar' : '↑ Subir archivo'}
          </button>
        )}
      </div>

      {/* Form subida */}
      {showForm && canEdit && (
        <div className="card mb-3" style={{background:'#F5F9F0',borderColor:'#9DC87A'}}>
          <h3 style={{marginBottom:14}}>Subir archivo</h3>
          <form onSubmit={handleUpload} style={{display:'flex',flexDirection:'column',gap:12}}>
            {/* Drop zone */}
            <div
              onDragOver={e=>{e.preventDefault();setDragOver(true)}}
              onDragLeave={()=>setDragOver(false)}
              onDrop={onDrop}
              onClick={()=>fileRef.current.click()}
              style={{border:`2px dashed ${dragOver?'#4A7C3F':'#9DC87A'}`,borderRadius:10,padding:'24px',textAlign:'center',
                background:dragOver?'#EBF4E8':'#F5F9F0',cursor:'pointer',transition:'all .15s'}}>
              <div style={{fontSize:28,marginBottom:6}}>📂</div>
              {fFile
                ? <div style={{fontSize:13,fontWeight:600,color:'#2E4F26'}}>{fFile.name} <span style={{fontWeight:400,color:'var(--text-muted)'}}>({fmtBytes(fFile.size)})</span></div>
                : <div style={{fontSize:13,color:'var(--arcilla)'}}>Arrastrá un archivo acá o <span style={{color:'#4A7C3F',textDecoration:'underline'}}>hacé clic para seleccionar</span></div>
              }
              <input ref={fileRef} type="file" style={{display:'none'}}
                onChange={e=>{ const f=e.target.files[0]; if(f){setFFile(f);setFNombre(n=>n||f.name)} }}/>
            </div>
            <div className="grid-2">
              <div className="field"><label className="label">Nombre del documento</label>
                <input style={{padding:'7px 10px',border:'1px solid #D8C9A8',borderRadius:7,fontSize:13,fontFamily:'inherit',width:'100%',background:'#FDFAF4'}}
                  value={fNombre} onChange={e=>setFNombre(e.target.value)} placeholder="Ej: Contrato de arrendamiento 2025"/>
              </div>
              <div className="field"><label className="label">Categoría</label>
                <select style={{padding:'7px 10px',border:'1px solid #D8C9A8',borderRadius:7,fontSize:13,fontFamily:'inherit',width:'100%',background:'#FDFAF4'}}
                  value={fCatForm} onChange={e=>setFCatForm(e.target.value)}>
                  {categorias.map(c=><option key={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div className="field"><label className="label">Descripción (opcional)</label>
              <input style={{padding:'7px 10px',border:'1px solid #D8C9A8',borderRadius:7,fontSize:13,fontFamily:'inherit',width:'100%',background:'#FDFAF4'}}
                value={fDesc} onChange={e=>setFDesc(e.target.value)} placeholder="Descripción breve..."/>
            </div>
            <div style={{display:'flex',gap:8}}>
              <button className="btn btn-primary" type="submit" disabled={uploading||!fFile}>
                {uploading ? '⏳ Subiendo...' : '↑ Subir'}
              </button>
              <button className="btn btn-secondary" type="button" onClick={()=>{setShowForm(false);setFFile(null);setFNombre('');setFDesc('')}}>Cancelar</button>
            </div>
          </form>
        </div>
      )}

      <div style={{display:'grid',gridTemplateColumns:'200px 1fr',gap:16,alignItems:'start'}}>

        {/* Sidebar categorías */}
        <div className="card" style={{padding:'10px 0'}}>
          <div style={{padding:'6px 14px',fontSize:10,fontWeight:600,color:'#A08060',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:4}}>Categorías</div>
          {[['todas','Todos',docs.length],...catsVisibles.map(c=>[c,c,conteoPorCat[c]||0])].map(([val,lbl,n])=>(
            n > 0 || val === 'todas' ? (
              <button key={val} onClick={()=>setFCat(val)}
                style={{display:'flex',justifyContent:'space-between',alignItems:'center',width:'100%',padding:'6px 14px',
                  background:fCat===val?'#EBF4E8':'transparent',border:'none',cursor:'pointer',fontFamily:'inherit',
                  borderLeft:fCat===val?'3px solid #4A7C3F':'3px solid transparent',textAlign:'left',transition:'all .1s'}}>
                <span style={{fontSize:12,color:fCat===val?'#2E4F26':'var(--tierra)'}}>{lbl}</span>
                <span style={{fontSize:11,color:'var(--text-muted)',background:'#EFECE4',borderRadius:20,padding:'1px 6px'}}>{n}</span>
              </button>
            ) : null
          ))}
        </div>

        {/* Lista documentos */}
        <div>
          {/* Buscador */}
          <div style={{position:'relative',marginBottom:12}}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="var(--arcilla)" strokeWidth="1.5" strokeLinecap="round"
              style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',pointerEvents:'none'}}>
              <circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5L14 14"/>
            </svg>
            <input value={busqueda} onChange={e=>setBusqueda(e.target.value)} placeholder="Buscar documentos..."
              style={{width:'100%',padding:'8px 12px 8px 32px',border:'1px solid #D8C9A8',borderRadius:8,fontSize:13,background:'#FDFAF4',fontFamily:'inherit'}}/>
          </div>

          {/* Drop zone global (cuando no hay form) */}
          {!showForm && canEdit && (
            <div onDragOver={e=>{e.preventDefault();setDragOver(true)}} onDragLeave={()=>setDragOver(false)} onDrop={e=>{onDrop(e)}}
              style={{border:`2px dashed ${dragOver?'#4A7C3F':'#D8C9A8'}`,borderRadius:8,padding:'10px',textAlign:'center',
                fontSize:11,color:'var(--text-muted)',marginBottom:12,background:dragOver?'#EBF4E8':'transparent',transition:'all .15s'}}>
              Arrastrá archivos acá para subir rápido
            </div>
          )}

          {loading ? <div style={{padding:32,textAlign:'center',color:'var(--arcilla)'}}>Cargando...</div>
          : docsFiltrados.length === 0 ? (
            <div style={{padding:32,textAlign:'center',color:'var(--arcilla)'}}>
              {docs.length === 0 ? 'Sin documentos. Subí el primero con el botón ↑' : 'Sin resultados con estos filtros'}
            </div>
          ) : (
            <div style={{display:'flex',flexDirection:'column',gap:6}}>
              {docsFiltrados.map(d=>(
                <div key={d.id} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 14px',
                  background: editDoc?.id===d.id ? '#FFF9EE' : '#FDFAF4',border:`1px solid ${editDoc?.id===d.id?'#C8A96E':'#D8C9A8'}`,borderRadius:10,transition:'box-shadow .1s'}}>
                  <div style={{fontSize:22,flexShrink:0}}>{getIcono(d.tipo_archivo)}</div>
                  {editDoc?.id === d.id ? (
                    <div style={{flex:1,minWidth:0,display:'flex',flexDirection:'column',gap:6}}>
                      <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                        <input autoFocus value={editDoc.nombre} onChange={e=>setEditDoc(p=>({...p,nombre:e.target.value}))}
                          onKeyDown={e=>{ if(e.key==='Enter') handleSaveEdit(); if(e.key==='Escape') setEditDoc(null) }}
                          placeholder="Nombre del documento"
                          style={{flex:'2 1 200px',padding:'6px 10px',border:'1px solid #C8A96E',borderRadius:7,fontSize:13,fontFamily:'inherit',background:'white',fontWeight:600}}/>
                        <select value={editDoc.categoria} onChange={e=>setEditDoc(p=>({...p,categoria:e.target.value}))}
                          style={{flex:'1 1 140px',padding:'6px 10px',border:'1px solid #C8A96E',borderRadius:7,fontSize:12,fontFamily:'inherit',background:'white'}}>
                          {[...new Set([editDoc.categoria, ...categorias])].filter(Boolean).map(c=><option key={c}>{c}</option>)}
                        </select>
                      </div>
                      <input value={editDoc.descripcion} onChange={e=>setEditDoc(p=>({...p,descripcion:e.target.value}))}
                        onKeyDown={e=>{ if(e.key==='Enter') handleSaveEdit(); if(e.key==='Escape') setEditDoc(null) }}
                        placeholder="Descripción (opcional)"
                        style={{padding:'5px 10px',border:'1px solid #D8C9A8',borderRadius:7,fontSize:12,fontFamily:'inherit',background:'white'}}/>
                    </div>
                  ) : (
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:600,color:'var(--tierra)',fontSize:13,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{d.nombre}</div>
                    <div style={{display:'flex',gap:8,marginTop:2,flexWrap:'wrap'}}>
                      {d.descripcion && <span style={{fontSize:11,color:'var(--text-muted)'}}>{d.descripcion}</span>}
                      <span style={{fontSize:10,background:'#EFECE4',color:'#7A6040',borderRadius:20,padding:'1px 7px'}}>{d.categoria}</span>
                      <span style={{fontSize:10,color:'var(--text-muted)'}}>{fmtBytes(d.tamano_bytes)}</span>
                      <span style={{fontSize:10,color:'var(--text-muted)'}}>{fmtFecha(d.created_at)}</span>
                      {d.quien_subio && <span style={{fontSize:10,color:'var(--text-muted)'}}>↑ {d.quien_subio}</span>}
                    </div>
                  </div>
                  )}
                  <div style={{display:'flex',gap:5,flexShrink:0}}>
                    {editDoc?.id === d.id ? (
                      <>
                        <button onClick={handleSaveEdit} disabled={savingEdit}
                          style={{padding:'5px 10px',background:'#4A7C3F',color:'white',border:'none',borderRadius:6,fontSize:11,cursor:'pointer',fontFamily:'inherit'}}>
                          {savingEdit ? '...' : '✓ Guardar'}
                        </button>
                        <button onClick={()=>setEditDoc(null)}
                          style={{padding:'5px 10px',background:'transparent',border:'1px solid #D8C9A8',borderRadius:6,fontSize:11,cursor:'pointer',color:'var(--arcilla)',fontFamily:'inherit'}}>
                          Cancelar
                        </button>
                      </>
                    ) : (
                      <>
                    <button onClick={()=>handlePreview(d)}
                      style={{padding:'5px 10px',background:'#4A7C3F',color:'white',border:'none',borderRadius:6,fontSize:11,cursor:'pointer',fontFamily:'inherit'}}>
                      {tipoPreview(d) ? '👁 Ver' : '↓ Abrir'}
                    </button>
                    <button onClick={()=>handleDownload(d)} title="Descargar / abrir en pestaña nueva"
                      style={{padding:'5px 8px',background:'#F5F0E4',border:'1px solid #D8C9A8',borderRadius:6,fontSize:11,cursor:'pointer',color:'var(--tierra)'}}>
                      ↓
                    </button>
                    {canEdit && (
                      <button onClick={()=>setEditDoc({ id:d.id, nombre:d.nombre||'', categoria:d.categoria||'General', descripcion:d.descripcion||'' })} title="Editar nombre / categoría"
                        style={{padding:'5px 8px',background:'#F5F0E4',border:'1px solid #D8C9A8',borderRadius:6,fontSize:11,cursor:'pointer',color:'var(--tierra)'}}>
                        ✎
                      </button>
                    )}
                    {canEdit && (
                      <button onClick={()=>handleDelete(d)}
                        style={{padding:'5px 8px',background:'#FAECE7',border:'1px solid #F0997B',borderRadius:6,fontSize:11,cursor:'pointer',color:'#993C1D'}}>
                        🗑
                      </button>
                    )}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal de vista previa */}
      {preview && (
        <div onClick={()=>setPreview(null)}
          style={{position:'fixed',inset:0,background:'rgba(30,25,15,0.75)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
          <div onClick={e=>e.stopPropagation()}
            style={{background:'#FDFAF4',borderRadius:12,width:'min(960px,96vw)',maxHeight:'92vh',display:'flex',flexDirection:'column',overflow:'hidden',boxShadow:'0 12px 40px rgba(0,0,0,0.35)'}}>
            <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',borderBottom:'1px solid #D8C9A8'}}>
              <span style={{fontSize:18}}>{getIcono(preview.doc.tipo_archivo)}</span>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:600,fontSize:13,color:'var(--tierra)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{preview.doc.nombre}</div>
                <div style={{fontSize:10,color:'var(--text-muted)'}}>{preview.doc.categoria} · {fmtBytes(preview.doc.tamano_bytes)}</div>
              </div>
              <button onClick={()=>handleDownload(preview.doc)}
                style={{padding:'5px 10px',background:'#F5F0E4',border:'1px solid #D8C9A8',borderRadius:6,fontSize:11,cursor:'pointer',color:'var(--tierra)',fontFamily:'inherit',whiteSpace:'nowrap'}}>
                ↓ Descargar
              </button>
              <button onClick={()=>setPreview(null)}
                style={{padding:'5px 10px',background:'transparent',border:'1px solid #D8C9A8',borderRadius:6,fontSize:13,cursor:'pointer',color:'var(--arcilla)',fontFamily:'inherit'}}>
                ✕
              </button>
            </div>
            <div style={{flex:1,minHeight:0,background:'#EFECE4',display:'flex',alignItems:'center',justifyContent:'center'}}>
              {preview.tipo === 'imagen' && (
                <img src={preview.url} alt={preview.doc.nombre} style={{maxWidth:'100%',maxHeight:'80vh',objectFit:'contain'}}/>
              )}
              {preview.tipo === 'pdf' && (
                <iframe src={preview.url} title={preview.doc.nombre} style={{width:'100%',height:'80vh',border:'none',background:'white'}}/>
              )}
              {preview.tipo === 'video' && (
                <video src={preview.url} controls style={{maxWidth:'100%',maxHeight:'80vh'}}/>
              )}
              {preview.tipo === 'audio' && (
                <audio src={preview.url} controls style={{width:'80%',margin:'40px 0'}}/>
              )}
              {preview.tipo === 'texto' && (
                <iframe src={preview.url} title={preview.doc.nombre} style={{width:'100%',height:'80vh',border:'none',background:'white'}}/>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
