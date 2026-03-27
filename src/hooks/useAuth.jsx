import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]         = useState(null)
  const [permisos, setPermisos] = useState(null)
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user ?? null
      setUser(u)
      if (u) fetchPermisos(u.email)
      else setLoading(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) => {
      const u = session?.user ?? null
      setUser(u)
      if (u) fetchPermisos(u.email)
      else { setPermisos(null); setLoading(false) }
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  async function fetchPermisos(email) {
    try {
      const { data } = await supabase
        .from('user_permisos')
        .select('*')
        .eq('email', email)
        .single()
      setPermisos(data || null)
    } catch {
      setPermisos(null)
    } finally {
      setLoading(false)
    }
  }

  const login  = (email, password) => supabase.auth.signInWithPassword({ email, password })
  const logout = () => supabase.auth.signOut()

  const displayName = permisos?.nombre
    || (user ? user.email.split('@')[0].charAt(0).toUpperCase() + user.email.split('@')[0].slice(1) : '')

  const role    = permisos?.rol || 'usuario'
  const isAdmin = role === 'admin'
  const modulos = Array.isArray(permisos?.modulos) ? permisos.modulos : ['inicio','costos','lluvias','viajes']

  // Siempre es una función, nunca undefined
  const puedeVer = (moduloId) => isAdmin || modulos.includes(moduloId)

  return (
    <AuthContext.Provider value={{ user, permisos, loading, login, logout, displayName, role, isAdmin, modulos, puedeVer }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
