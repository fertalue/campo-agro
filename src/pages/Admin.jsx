import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

const TODOS_MODULOS = [
  { id: 'inicio',        label: 'Inicio',           icon: '⌂' },
  { id: 'costos',        label: 'Costos',            icon: '◈' },
  { id: 'ventas',        label: 'Ventas / Granos',   icon: '◆' },
  { id: 'viajes',        label: 'Viajes al campo',   icon: '◉' },
  { id: 'lluvias',       label: 'Precipitaciones',   icon: '◎' },
  { id: 'almacen',       label: 'Almacén',           icon: '◫' },
  { id: 'aplicaciones',  label: 'Aplicaciones',      icon: '◑' },
  { id: 'admin',         label: 'Administración',    icon: '⚙' },
]

const CSS = `
.adm-card{background:#FDFAF4;border:1px solid #D8C9A8;border-radius:12px;padding:0;margin-bottom:14px;overflow:hidden;}
.adm-header{padding:14px 18px;border-bottom:1px solid #EDE0C8;display:flex;align-items:center;justify-content:space-between;gap:12px;}
.adm-name{font-size:14px;font-weight:500;color:#3B2E1E;}
.adm-email{font-size:12px;color:#A08060;margin-top:1px;}
.adm-body{padding:14px 18px;}
.adm-mods{display:flex;flex-wrap:wrap;gap:8px;}
.adm-mod{display:flex;align-items:center;gap:6px;padding:6px 12px;border-radius:20px;border:1px solid #D8C9A8;font-size:12px;cursor:pointer;transition:all .15s;user-select:none;background:#F5F0E4;color:#A08060;}
.adm-mod.on{background:#EBF4E8;border-color:#9DC87A;color:#2E4F26;font-weight:500;}
.adm-mod.admin-mod.on{background:#E4F0F4;border-color:#7A9EAD;color:#2C5A6A;}
.adm-toggle{width:28px;height:16px;border-radius:8px;border:1px solid #D8C9A8;background:#D8C9A8;position:relative;transition:all .2s;flex-shrink:0;}
.adm-toggle.on{background:#4A7C3F;border-color:#4A7C3F;}
.adm-toggle-dot{width:12px;height:12px;border-radius:50%;background:#fff;position:absolute;top:1px;left:1px;transition:left .2s;}
.adm-toggle.on .adm-toggle-dot{left:13px;}
.adm-rol{display:inline-flex;align-items:center;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:600;}
.rol-admin{background:#E4F0F4;color:#2C5A6A;}
.rol-usuario{background:#EFECE4;color:#7A6040;}
.adm-saving{font-size:11px;color:#4A7C3F;font-style:italic;}
.adm-inactive{opacity:0.5;}
`

export default function Admin() {
  const { user } = useAuth()
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

  async function toggleModulo(usuario, modId) {
    const modulos = usuario.modulos || []
    const nuevos = modulos.includes(modId)
      ? modulos.filter(m => m !== modId)
      : [...modulos, modId]
    setSaving(usuario.id)
    await supabase.from('user_permisos')
      .update({ modulos: nuevos, updated_at: new Date().toISOString() })
      .eq('id', usuario.id)
    setUsuarios(prev => prev.map(u => u.id === usuario.id ? { ...u, modulos: nuevos } : u))
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
    const modulos = rol === 'admin'
      ? TODOS_MODULOS.map(m => m.id)
      : usuario.modulos.filter(m => m !== 'admin')
    await supabase.from('user_permisos')
      .update({ rol, modulos, updated_at: new Date().toISOString() })
      .eq('id', usuario.id)
    setUsuarios(prev => prev.map(u => u.id === usuario.id ? { ...u, rol, modulos } : u))
    setSaving(null)
  }

  async function agregarUsuario(e) {
    e.preventDefault()
    const modulos = newUser.rol === 'admin'
      ? TODOS_MODULOS.map(m => m.id)
      : ['inicio', 'costos', 'lluvias']
    await supabase.from('user_permisos').insert({
      ...newUser, modulos, activo: true
    })
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
            Gestioná permisos y acceso a módulos
          </p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(v => !v)}>
          {showAdd ? 'Cancelar' : '+ Nuevo usuario'}
        </button>
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
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: u.rol === 'admin' ? '#E4F0F4' : 'var(--verde-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, color: u.rol === 'admin' ? '#2C5A6A' : 'var(--musgo)', flexShrink: 0 }}>
                  {(u.nombre || u.email).slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="adm-name">{u.nombre || u.email}</div>
                  <div className="adm-email">{u.email}</div>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
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
              {/* Activo toggle */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{u.activo ? 'Activo' : 'Inactivo'}</span>
                <div className={`adm-toggle${u.activo ? ' on' : ''}`} onClick={() => toggleActivo(u)} style={{ cursor: 'pointer' }}>
                  <div className="adm-toggle-dot" />
                </div>
              </div>
            </div>
          </div>
          <div className="adm-body">
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Acceso a módulos
            </div>
            <div className="adm-mods">
              {TODOS_MODULOS.map(mod => {
                const tiene = (u.modulos || []).includes(mod.id)
                const esAdmin = mod.id === 'admin'
                return (
                  <div key={mod.id}
                    className={`adm-mod${tiene ? ' on' : ''}${esAdmin ? ' admin-mod' : ''}`}
                    onClick={() => toggleModulo(u, mod.id)}>
                    <div className={`adm-toggle${tiene ? ' on' : ''}`} style={{ width: 22, height: 12, cursor: 'pointer' }}>
                      <div className="adm-toggle-dot" style={{ width: 8, height: 8, top: 1, left: tiene ? 11 : 1 }} />
                    </div>
                    {mod.label}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
