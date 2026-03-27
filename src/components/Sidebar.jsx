import { useAuth } from '../hooks/useAuth'

const NAV_ITEMS = [
  { section: 'Principal', items: [
    { id: 'inicio',   label: 'Inicio' },
    { id: 'costos',   label: 'Costos' },
    { id: 'ventas',   label: 'Ventas / Granos' },
    { id: 'viajes',   label: 'Viajes al campo' },
  ]},
  { section: 'Producción', items: [
    { id: 'lluvias',      label: 'Precipitaciones' },
    { id: 'almacen',      label: 'Almacén' },
    { id: 'aplicaciones', label: 'Aplicaciones' },
  ]},
  { section: 'Sistema', items: [
    { id: 'admin', label: 'Administración' },
  ]},
]

const ICONS = {
  inicio: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M2 6L8 2L14 6V14H10V10H6V14H2V6Z"/></svg>,
  costos: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="12" height="11" rx="2"/><path d="M5 3V2M11 3V2M2 7H14M5 10H8M5 12.5H10"/></svg>,
  ventas: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12L6 8L9 11L14 5"/><path d="M11 5H14V8"/></svg>,
  viajes: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="7" r="2.5"/><path d="M8 2C5.2 2 3 4.2 3 7C3 10.5 8 14 8 14C8 14 13 10.5 13 7C13 4.2 10.8 2 8 2Z"/></svg>,
  lluvias: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M4 9C4 9 3 8 3 6.5C3 4.6 4.6 3 6.5 3C7.2 3 7.8 3.2 8.3 3.6C8.9 2.6 10 2 11.2 2C13.3 2 15 3.7 15 5.8C15 7 14.4 8 13.5 8.6"/><path d="M6 11L5 13M9 11L8 13M12 11L11 13"/></svg>,
  almacen: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M2 7L8 3L14 7V14H2V7Z"/><path d="M6 14V9H10V14"/></svg>,
  aplicaciones: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3C8 3 5 6 5 8.5C5 10.4 6.3 12 8 12C9.7 12 11 10.4 11 8.5C11 6 8 3 8 3Z"/><path d="M4 13H12"/></svg>,
  admin: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="8" r="2"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.1 3.1l1.4 1.4M11.5 11.5l1.4 1.4M3.1 12.9l1.4-1.4M11.5 4.5l1.4-1.4"/></svg>,
}

export default function Sidebar({ current, onChange, collapsed }) {
  const { displayName, role, logout, puedeVer } = useAuth()
  const initials = displayName.slice(0, 3)

  return (
    <aside style={{ width: collapsed ? 56 : 200, background: 'var(--musgo)', display: 'flex', flexDirection: 'column', flexShrink: 0, transition: 'width 0.2s', height: '100%' }}>
      {/* Logo */}
      <div style={{ padding: collapsed ? '18px 0' : '18px 16px 14px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start', gap: 10 }}>
        <div style={{ width: 28, height: 28, background: 'var(--pasto)', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 2C8 2 5 5 5 8C5 9.7 6.3 11 8 11C9.7 11 11 9.7 11 8C11 5 8 2 8 2Z" fill="#9DC87A"/>
            <path d="M8 11V13.5M6.5 13.5H9.5" stroke="#9DC87A" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
        </div>
        {!collapsed && <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#E8D5A3', letterSpacing: '0.02em' }}>Campo</div>
          <div style={{ fontSize: 10, color: 'rgba(232,213,163,0.45)', letterSpacing: '0.04em' }}>gestión agropecuaria</div>
        </div>}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '10px 8px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {NAV_ITEMS.map(group => {
          const visible = group.items.filter(i => puedeVer(i.id))
          if (!visible.length) return null
          return (
            <div key={group.section}>
              {!collapsed && <div style={{ fontSize: 9, fontWeight: 600, color: 'rgba(200,169,110,0.4)', letterSpacing: '0.08em', textTransform: 'uppercase', padding: '8px 10px 4px' }}>{group.section}</div>}
              {visible.map(item => (
                <button key={item.id} onClick={() => onChange(item.id)} title={collapsed ? item.label : ''}
                  style={{ display: 'flex', alignItems: 'center', gap: collapsed ? 0 : 10, justifyContent: collapsed ? 'center' : 'flex-start', padding: collapsed ? '9px 0' : '8px 10px', width: '100%', borderRadius: 8, background: current === item.id ? 'var(--pasto)' : 'transparent', color: current === item.id ? '#F5F0E4' : 'rgba(232,213,163,0.6)', border: 'none', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', transition: 'all 0.15s' }}>
                  <span style={{ flexShrink: 0 }}>{ICONS[item.id]}</span>
                  {!collapsed && item.label}
                </button>
              ))}
              {!collapsed && <div style={{ height: 4 }} />}
            </div>
          )
        })}
      </nav>

      {/* User */}
      <div style={{ padding: '10px 8px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: collapsed ? 0 : 8, justifyContent: collapsed ? 'center' : 'flex-start', padding: '7px 8px', borderRadius: 8 }}>
          <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--pasto)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 600, color: '#F5F0E4', flexShrink: 0 }}>{initials}</div>
          {!collapsed && <>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, color: 'rgba(232,213,163,0.7)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</div>
              {role === 'admin' && <div style={{ fontSize: 9, color: 'rgba(122,158,173,0.8)', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>admin</div>}
            </div>
            <button onClick={logout} title="Salir" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(232,213,163,0.4)', padding: 2 }}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><path d="M10 8H3M6 5L3 8L6 11"/><path d="M7 3H13V13H7"/></svg>
            </button>
          </>}
        </div>
      </div>
    </aside>
  )
}
