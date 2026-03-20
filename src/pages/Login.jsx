import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'

export default function Login() {
  const { login } = useAuth()
  const [email, setEmail]     = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(''); setLoading(true)
    const { error } = await login(email, password)
    if (error) setError('Email o contraseña incorrectos')
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: 'var(--papel)', padding: '20px'
    }}>
      <div style={{ width: '100%', maxWidth: 360 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 52, height: 52, background: 'var(--musgo)', borderRadius: 14,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 14px'
          }}>
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <path d="M14 4C14 4 8 9 8 15C8 18.3 10.7 21 14 21C17.3 21 20 18.3 20 15C20 9 14 4 14 4Z" fill="#9DC87A"/>
              <path d="M14 21V25M11 25H17" stroke="#9DC87A" stroke-width="1.8" stroke-linecap="round"/>
            </svg>
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--tierra)', marginBottom: 4 }}>
            Campo
          </h1>
          <p style={{ fontSize: 13, color: 'var(--arcilla)' }}>gestión agropecuaria</p>
        </div>

        {/* Form */}
        <div className="card">
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="field">
              <label className="label">Email</label>
              <input
                className="input"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="fer@campo.com"
                required
                autoComplete="email"
              />
            </div>
            <div className="field">
              <label className="label">Contraseña</label>
              <input
                className="input"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
            </div>
            {error && (
              <div style={{
                background: '#FCEBEB', border: '1px solid #F09595',
                borderRadius: 8, padding: '8px 12px',
                fontSize: 13, color: '#791F1F'
              }}>{error}</div>
            )}
            <button
              className="btn btn-primary"
              type="submit"
              disabled={loading}
              style={{ width: '100%', marginTop: 4, padding: '10px 16px' }}
            >
              {loading ? 'Ingresando...' : 'Ingresar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
