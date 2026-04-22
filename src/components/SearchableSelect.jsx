import { useState, useEffect, useRef } from 'react'

const CSS = `
.ss-wrap{position:relative;}
.ss-trigger{display:flex;align-items:center;justify-content:space-between;gap:6px;width:100%;padding:9px 12px;border:1px solid #D8C9A8;border-radius:8px;font-size:13px;background:#FDFAF4;color:#3B2E1E;cursor:pointer;text-align:left;font-family:inherit;transition:border-color .15s;}
.ss-trigger:focus,.ss-trigger.open{outline:none;border-color:#4A7C3F;box-shadow:0 0 0 3px rgba(74,124,63,0.12);}
.ss-trigger.empty{color:#A08060;}
.ss-arrow{font-size:9px;color:#A08060;flex-shrink:0;transition:transform .15s;}
.ss-trigger.open .ss-arrow{transform:rotate(180deg);}
.ss-dropdown{position:absolute;top:calc(100% + 3px);left:0;right:0;z-index:300;background:#FDFAF4;border:1px solid #D8C9A8;border-radius:10px;box-shadow:0 4px 20px rgba(59,46,30,0.14);overflow:hidden;}
.ss-search{padding:8px 10px;border-bottom:1px solid #EDE0C8;}
.ss-search input{width:100%;padding:6px 10px;border:1px solid #D8C9A8;border-radius:6px;font-size:12px;background:#F5F0E4;color:#3B2E1E;font-family:inherit;outline:none;}
.ss-search input:focus{border-color:#4A7C3F;}
.ss-list{max-height:200px;overflow-y:auto;}
.ss-item{padding:8px 14px;font-size:13px;color:#3B2E1E;cursor:pointer;transition:background .1s;}
.ss-item:hover{background:#EDE0C8;}
.ss-item.selected{background:#EBF4E8;color:#2E4F26;font-weight:500;}
.ss-empty{padding:10px 14px;font-size:12px;color:#A08060;text-align:center;}
.ss-add{padding:8px 14px;font-size:12px;color:#4A7C3F;cursor:pointer;border-top:1px solid #EDE0C8;font-weight:500;display:flex;align-items:center;gap:6px;}
.ss-add:hover{background:#EBF4E8;}
.ss-add-icon{width:18px;height:18px;border-radius:50%;background:#4A7C3F;color:white;display:flex;align-items:center;justify-content:center;font-size:13px;flex-shrink:0;line-height:1;}
.ss-clear{padding:7px 14px;font-size:11px;color:#A0714F;cursor:pointer;border-top:1px solid #EDE0C8;text-align:center;}
.ss-clear:hover{background:#F5EDD8;}
`

export default function SearchableSelect({
  value,
  onChange,
  options = [],
  placeholder = 'Seleccioná...',
  allowClear = false,
  onAddNew = null,   // fn(valor) → llamado cuando el usuario quiere agregar un valor nuevo
}) {
  const [open, setOpen]     = useState(false)
  const [search, setSearch] = useState('')
  const [adding, setAdding] = useState(false)
  const ref    = useRef()
  const inpRef = useRef()

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (open && inpRef.current) {
      setTimeout(() => inpRef.current?.focus(), 50)
    } else {
      setSearch('')
    }
  }, [open])

  const filtered = options.filter(o =>
    o.toLowerCase().includes(search.toLowerCase())
  )

  const trimmed = search.trim()
  const exactMatch = options.some(o => o.toLowerCase() === trimmed.toLowerCase())
  const showAddNew = onAddNew && trimmed && !exactMatch

  const select = (opt) => {
    onChange(opt)
    setOpen(false)
  }

  const handleAddNew = async () => {
    if (!trimmed || adding) return
    setAdding(true)
    await onAddNew(trimmed)
    onChange(trimmed)
    setAdding(false)
    setOpen(false)
  }

  return (
    <div className="ss-wrap" ref={ref}>
      <style>{CSS}</style>
      <button type="button" className={`ss-trigger${open ? ' open' : ''}${!value ? ' empty' : ''}`}
        onClick={() => setOpen(o => !o)}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {value || placeholder}
        </span>
        <span className="ss-arrow">▾</span>
      </button>
      {open && (
        <div className="ss-dropdown">
          <div className="ss-search">
            <input ref={inpRef} value={search} onChange={e => setSearch(e.target.value)}
              placeholder={onAddNew ? 'Buscar o escribir nuevo...' : 'Buscar...'}
              onClick={e => e.stopPropagation()}
              onKeyDown={e => { if (e.key === 'Enter' && showAddNew) handleAddNew() }} />
          </div>
          <div className="ss-list">
            {filtered.length === 0 && !showAddNew
              ? <div className="ss-empty">Sin resultados</div>
              : filtered.map(opt => (
                <div key={opt} className={`ss-item${value === opt ? ' selected' : ''}`}
                  onClick={() => select(opt)}>
                  {opt}
                </div>
              ))
            }
          </div>
          {showAddNew && (
            <div className="ss-add" onClick={handleAddNew}>
              <span className="ss-add-icon">{adding ? '…' : '+'}</span>
              {adding ? 'Guardando...' : `Agregar "${trimmed}"`}
            </div>
          )}
          {allowClear && value && (
            <div className="ss-clear" onClick={() => { onChange(''); setOpen(false) }}>Limpiar</div>
          )}
        </div>
      )}
    </div>
  )
}
