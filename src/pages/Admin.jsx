import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const TODOS_MODULOS = [
  { id: 'inicio',        label: 'Inicio' },
  { id: 'costos',        label: 'Costos' },
  { id: 'ventas',        label: 'Ventas / Granos' },
  { id: 'viajes',        label: 'Viajes al campo' },
  { id: 'lluvias',       label: 'Precipitaciones' },
  { id: 'almacen',       label: 'Almacén' },
  { id: 'aplicaciones',  label: 'Aplicaciones' },
  { id: 'admin',         label: 'Administración' },
  { id: 'maestros',      label: 'Datos maestros' },
]

// Niveles: null = sin acceso, 'lectura' = solo ver, 'edicion' = ver + editar
const NIVELES = ['lectura', 'edicion']

const CSS = `
.adm-card{background:#FDFAF4;border:1px solid #D8C9A8;border-radius:12px;padding:0;margin-bottom:14px;overflow:hidden;}
.adm-header{padding:14px 18px;border-bottom:1px solid #EDE0C8;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;}
.adm-name{font-size:14px;font-weight:500;color:#3B2E1E;}
.adm-email{font-size:12px;color:#A08060;margin-top:1px;}
.adm-body{padding:14px 18px;}
.adm-saving{font-size:11px;color:#4A7C3F;font-style:italic;}
.adm-inactive{opacity:0.5;}
.adm-toggle{width:28px;height:16px;border-radius:8px;border:1px solid #D8C9A8;background:#D8C9A8;position:relative;transition:all .2s;flex-shrink:0;cursor:pointer;}
.adm-toggle.on{background:#4A7C3F;border-color:#4A7C3F;}
.adm-toggle-dot{width:12px;height:12px;border-radius:50%;background:#fff;position:absolute;top:1px;left:1px;transition:left .2s;}
.adm-toggle.on .adm-toggle-dot{left:13px;}

.mod-row{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:8px;border:1px solid #EDE0C8;margin-bottom:6px;background:#FAF7F0;transition:background .1s;}
.mod-row.has-access{background:#FDFAF4;border-color:#D8C9A8;}
.mod-row.has-edit{background:#F5F9F0;border-color:#9DC87A;}
.mod-label{flex:1;font-size:13px;color:#3B2E1E;}
.mod-label.disabled{color:#C8B89A;}
.nivel-btns{display:flex;gap:4px;}
.nivel-btn{padding:4px 10px;border-radius:6px;font-size:11px;cursor:pointer;border:1px solid;font-family:inherit;transition:all .15s;background:transparent;}
.nivel-btn.lectura{color:#185FA5;border-color:#B5D4F4;}
.nivel-btn.lectura.active{background:#E6F1FB;border-color:#378ADD;font-weight:600;}
.nivel-btn.edicion{color:#2E4F26;border-color:#9DC87A;}
.nivel-btn.edicion.active{background:#EBF4E8;border-color:#4A7C3F;font-weight:600;}
.nivel-btn.sin-acceso{color:#A08060;border-color:#D8C9A8;}
`

// Helper: obtener nivel de acceso para un módulo
function getNivel(usuario, modId) {
  // Primero mirar modulos_permisos (nuevo formato)
  const mp = usuario.modulos_permisos
  if (mp && mp[modId]) return mp[modId]
  // Fallback: si está en modulos[] asumir 'edicion'
  if ((usuario.modulos || []).includes(modId)) return 'edicion'
  return null
}

export default function Admin() {
  const [usuarios, setUsuarios] = useState([])
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(null)
  const [showAdd, setShowAdd]   = useState(false)
  const [newUser, setNewUser]   = useState({ email: '', nombre: '', rol: 'usuario' })

  useEffect(() => { fetchUsuarios() }, [])

  async function fetchUsuarios() {
    setLoading(true)
    const { data } = await supabase.from('user_permisos').select('*').order('created_at')
    setUsuarios(data || [])
    setLoading(false)
  }

  async function setNivel(usuario, modId, nivel) {
    // nivel: 'lectura' | 'edicion' | null
    setSaving(usuario.id)
    const mp = { ...(usuario.modulos_permisos || {}) }
    if (!nivel) delete mp[modId]
    else mp[modId] = nivel

    // También mantener modulos[] en sync para compatibilidad
    const modulos = Object.keys(mp)

    await supabase.from('user_permisos')
      .update({ modulos_permisos: mp, modulos, updated_at: new Date().toISOString() })
      .eq('id', usuario.id)
    setUsuarios(prev => prev.map(u => u.id === usuario.id
      ? { ...u, modulos_permisos: mp, modulos }
      : u))
    setSaving(null)
  }

  async function toggleActivo(usuario) {
    setSaving(usuario.id)
    await supabase.from('user_permisos')
      .update({ activo: !usuario.activo, updated_at: new Date().toISOString() })
      .eq('id', usuario.id)
    setUsuarios(prev => prev.map(u => u.id === usuario.id ? { ...u, activo: !u.activo } : u))
    setSaving(null)
  }

  async function cambiarRol(usuario, rol) {
    setSaving(usuario.id)
    const mp = {}
    if (rol === 'admin') TODOS_MODULOS.forEach(m => { mp[m.id] = 'edicion' })
    else Object.entries(usuario.modulos_permisos || {}).forEach(([k, v]) => {
      if (k !== 'admin') mp[k] = v
    })
    const modulos = Object.keys(mp)
    await supabase.from('user_permisos')
      .update({ rol, modulos_permisos: mp, modulos, updated_at: new Date().toISOString() })
      .eq('id', usuario.id)
    setUsuarios(prev => prev.map(u => u.id === usuario.id ? { ...u, rol, modulos_permisos: mp, modulos } : u))
    setSaving(null)
  }

  async function agregarUsuario(e) {
    e.preventDefault()
    const mp = {}
    if (newUser.rol === 'admin') TODOS_MODULOS.forEach(m => { mp[m.id] = 'edicion' })
    else { mp['inicio'] = 'lectura'; mp['costos'] = 'edicion'; mp['lluvias'] = 'edicion' }
    const modulos = Object.keys(mp)
    await supabase.from('user_permisos').insert({ ...newUser, modulos_permisos: mp, modulos, activo: true })
    setNewUser({ email: '', nombre: '', rol: 'usuario' })
    setShowAdd(false)
    await fetchUsuarios()
  }

  return (
    <div>
      <style>{CSS}</style>
      <div className="flex-between mb-3">
        <div>
          <h2>Administración de usuarios</h2>
          <p style={{ fontSize: 12, color: 'var(--arcilla)', marginTop: 2 }}>
            Gestioná acceso y nivel de permisos por módulo
          </p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(v => !v)}>
          {showAdd ? 'Cancelar' : '+ Nuevo usuario'}
        </button>
      </div>

      {/* Leyenda */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { label: 'Sin acceso', color: '#A08060', bg: 'transparent', border: '#D8C9A8' },
          { label: 'Solo lectura — puede ver pero no cargar ni editar', color: '#185FA5', bg: '#E6F1FB', border: '#378ADD' },
          { label: 'Edición — acceso completo al módulo', color: '#2E4F26', bg: '#EBF4E8', border: '#4A7C3F' },
        ].map(({ label, color, bg, border }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: bg, border: `1.5px solid ${border}` }} />
            <span style={{ color }}>{label}</span>
          </div>
        ))}
      </div>

      {showAdd && (
        <div className="card mb-3" style={{ background: '#F9F6EE', borderColor: 'var(--paja)' }}>
          <h3 style={{ marginBottom: 14 }}>Agregar usuario</h3>
          <form onSubmit={agregarUsuario} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="grid-2">
              <div className="field">
                <label className="label">Email</label>
                <input className="input" type="email" value={newUser.email}
                  onChange={e => setNewUser(u => ({ ...u, email: e.target.value }))}
                  placeholder="nombre@mail.com" required />
              </div>
              <div className="field">
                <label className="label">Nombre</label>
                <input className="input" value={newUser.nombre}
                  onChange={e => setNewUser(u => ({ ...u, nombre: e.target.value }))}
                  placeholder="Nombre visible" />
              </div>
            </div>
            <div className="field">
              <label className="label">Rol inicial</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {['usuario', 'admin'].map(r => (
                  <button key={r} type="button" onClick={() => setNewUser(u => ({ ...u, rol: r }))}
                    style={{ padding: '7px 16px', borderRadius: 6, fontSize: 12, cursor: 'pointer', border: '1px solid', fontFamily: 'inherit', background: newUser.rol === r ? 'var(--pasto)' : 'transparent', color: newUser.rol === r ? '#F5F0E4' : 'var(--arcilla)', borderColor: newUser.rol === r ? 'var(--pasto)' : 'var(--border)' }}>
                    {r.charAt(0).toUpperCase() + r.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--arcilla)', background: 'var(--verde-light)', borderRadius: 8, padding: '8px 12px' }}>
              Después de agregar, creá el usuario en Supabase → Authentication → Invite user con el mismo email.
            </div>
            <button className="btn btn-primary" type="submit" style={{ alignSelf: 'flex-start' }}>Agregar</button>
          </form>
        </div>
      )}

      {loading ? (
        <div style={{ padding: 32, textAlign: 'center', fontSize: 13, color: 'var(--arcilla)' }}>Cargando...</div>
      ) : usuarios.map(u => (
        <div key={u.id} className={`adm-card${!u.activo ? ' adm-inactive' : ''}`}>
          <div className="adm-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: u.rol === 'admin' ? '#E4F0F4' : 'var(--verde-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, color: u.rol === 'admin' ? '#2C5A6A' : 'var(--musgo)', flexShrink: 0 }}>
                {(u.nombre || u.email).slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="adm-name">{u.nombre || u.email}</div>
                <div className="adm-email">{u.email}</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              {saving === u.id && <span className="adm-saving">Guardando...</span>}
              {/* Rol */}
              <div style={{ display: 'flex', gap: 4 }}>
                {['usuario', 'admin'].map(r => (
                  <button key={r} onClick={() => cambiarRol(u, r)}
                    style={{ padding: '4px 10px', borderRadius: 20, fontSize: 11, cursor: 'pointer', border: '1px solid', fontFamily: 'inherit', background: u.rol === r ? (r === 'admin' ? '#E4F0F4' : 'var(--verde-light)') : 'transparent', color: u.rol === r ? (r === 'admin' ? '#2C5A6A' : 'var(--musgo)') : 'var(--arcilla)', borderColor: u.rol === r ? (r === 'admin' ? '#7A9EAD' : 'var(--brote)') : 'var(--border)', fontWeight: u.rol === r ? 600 : 400 }}>
                    {r}
                  </button>
                ))}
              </div>
              {/* Activo */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{u.activo ? 'Activo' : 'Inactivo'}</span>
                <div className={`adm-toggle${u.activo ? ' on' : ''}`} onClick={() => toggleActivo(u)}>
                  <div className="adm-toggle-dot" />
                </div>
              </div>
            </div>
          </div>

          <div className="adm-body">
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Permisos por módulo
            </div>
            {TODOS_MODULOS.map(mod => {
              const nivel = getNivel(u, mod.id)
              const rowClass = nivel === 'edicion' ? 'has-edit' : nivel === 'lectura' ? 'has-access' : ''
              return (
                <div key={mod.id} className={`mod-row ${rowClass}`}>
                  <div className={`mod-label${!nivel ? ' disabled' : ''}`}>{mod.label}</div>
                  <div className="nivel-btns">
                    <button className={`nivel-btn sin-acceso${!nivel ? ' active' : ''}`}
                      onClick={() => setNivel(u, mod.id, null)}>
                      Sin acceso
                    </button>
                    <button className={`nivel-btn lectura${nivel === 'lectura' ? ' active' : ''}`}
                      onClick={() => setNivel(u, mod.id, 'lectura')}>
                      Solo lectura
                    </button>
                    <button className={`nivel-btn edicion${nivel === 'edicion' ? ' active' : ''}`}
                      onClick={() => setNivel(u, mod.id, 'edicion')}>
                      Edición
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
