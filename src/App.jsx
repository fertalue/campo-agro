import { useState, useEffect } from 'react'
import { AuthProvider, useAuth } from './hooks/useAuth'
import Sidebar from './components/Sidebar'
import Login from './pages/Login'
import Viajes from './pages/Viajes'
import Costos from './pages/Costos'
import Lluvias from './pages/Lluvias'
import Admin from './pages/Admin'
import DatosMaestros from './pages/DatosMaestros'
import './styles/theme.css'

const Placeholder = ({ title }) => (
  <div>
    <h2 style={{ marginBottom: 8 }}>{title}</h2>
    <p style={{ color: 'var(--arcilla)', fontSize: 13 }}>Módulo en construcción.</p>
  </div>
)

const PAGES = {
  inicio:       () => <Placeholder title="Panel general" />,
  costos:       Costos,
  ventas:       () => <Placeholder title="Ventas / Granos" />,
  viajes:       Viajes,
  lluvias:      Lluvias,
  almacen:      () => <Placeholder title="Almacén" />,
  aplicaciones: () => <Placeholder title="Aplicaciones" />,
  admin:        Admin,
  maestros:     DatosMaestros,
}

const PAGE_TITLES = {
  inicio: 'Panel general', costos: 'Costos', ventas: 'Ventas / Granos',
  viajes: 'Viajes al campo', lluvias: 'Precipitaciones',
  almacen: 'Almacén', aplicaciones: 'Aplicaciones', admin: 'Administración', maestros: 'Datos maestros'
}

const MOBILE_NAV = [
  { id: 'viajes', label: 'Viajes' },
  { id: 'costos', label: 'Costos' },
  { id: 'lluvias', label: 'Lluvias' },
  { id: 'inicio', label: 'Inicio' },
]

function AppShell() {
  const { user, loading, puedeVer, displayName } = useAuth()
  const [page, setPage] = useState('inicio')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const isMobile = window.innerWidth <= 768

  // Si la página actual ya no está permitida, ir a inicio
  useEffect(() => {
    if (!loading && user && !puedeVer(page)) setPage('inicio')
  }, [loading, page])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--papel)' }}>
      <div style={{ fontSize: 13, color: 'var(--arcilla)' }}>Cargando...</div>
    </div>
  )

  if (!user) return <Login />

  const PageComponent = puedeVer(page) ? (PAGES[page] || PAGES.inicio) : PAGES.inicio

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {!isMobile && (
        <Sidebar current={page} onChange={setPage} collapsed={sidebarCollapsed} />
      )}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', height: 52, background: 'var(--blanco)', borderBottom: '1px solid var(--border)', flexShrink: 0, gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {!isMobile && (
              <button onClick={() => setSidebarCollapsed(c => !c)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--arcilla)', padding: 4 }}>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <line x1="2" y1="5" x2="16" y2="5"/><line x1="2" y1="9" x2="16" y2="9"/><line x1="2" y1="13" x2="16" y2="13"/>
                </svg>
              </button>
            )}
            <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--tierra)' }}>{PAGE_TITLES[page] || page}</span>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ background: 'var(--verde-light)', border: '1px solid var(--brote)', borderRadius: 20, padding: '3px 10px', fontSize: 11, color: 'var(--musgo)', fontWeight: 500 }}>
              Campaña 25/26
            </div>
          </div>
        </header>
        <main style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '16px' : '20px 24px' }}>
          <PageComponent />
        </main>
        {isMobile && (
          <nav style={{ display: 'flex', borderTop: '1px solid var(--border)', background: 'var(--blanco)', padding: '8px 0 12px' }}>
            {MOBILE_NAV.filter(item => puedeVer(item.id)).map(item => (
              <button key={item.id} onClick={() => setPage(item.id)} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, fontWeight: page === item.id ? 600 : 400, color: page === item.id ? 'var(--pasto)' : 'var(--arcilla)', padding: '4px 0' }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: page === item.id ? 'var(--verde-light)' : 'transparent' }}>
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke={page === item.id ? 'var(--pasto)' : 'var(--arcilla)'} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                    {item.id === 'viajes' && <><circle cx="9" cy="8" r="2.5"/><path d="M9 2C5.7 2 3 4.7 3 8C3 12 9 16 9 16C9 16 15 12 15 8C15 4.7 12.3 2 9 2Z"/></>}
                    {item.id === 'costos' && <><rect x="2" y="3" width="14" height="13" rx="2"/><path d="M6 3V2M12 3V2M2 8H16M6 12H9M6 14.5H12"/></>}
                    {item.id === 'lluvias' && <><path d="M5 10C5 10 4 9 4 7.5C4 5.6 5.6 4 7.5 4C8.2 4 8.8 4.2 9.3 4.6C9.9 3.6 11 3 12.2 3C14.3 3 16 4.7 16 6.8C16 8 15.4 9 14.5 9.6"/><path d="M7 12L6 14M10 12L9 14M13 12L12 14"/></>}
                    {item.id === 'inicio' && <path d="M2 7L9 2L16 7V16H12V11H6V16H2V7Z"/>}
                  </svg>
                </div>
                {item.label}
              </button>
            ))}
          </nav>
        )}
      </div>
    </div>
  )
}

export default function App() {
  return <AuthProvider><AppShell /></AuthProvider>
}
