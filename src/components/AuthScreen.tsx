import { useState } from 'react'
import { supabase } from '../services/supabase'

export function AuthScreen() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setDone(true)
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div style={overlay}>
        <div style={card}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📬</div>
          <h2 style={{ color: 'white', fontWeight: 800, fontSize: 22, margin: '0 0 8px' }}>Check your email</h2>
          <p style={{ color: '#6b7280', fontSize: 15, margin: 0 }}>
            Confirmation link sent to <strong style={{ color: '#d1d5db' }}>{email}</strong>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div style={overlay}>
      <div style={card}>
        <div style={{ marginBottom: 28, textAlign: 'center' }}>
          <span style={{ color: 'white', fontWeight: 900, fontSize: 26, letterSpacing: -0.5 }}>DB Viewer</span>
          <p style={{ color: '#6b7280', fontSize: 14, marginTop: 6, marginBottom: 0 }}>
            {mode === 'login' ? 'Sign in to your account' : 'Create a new account'}
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            style={input}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            minLength={6}
            style={input}
          />

          {error && (
            <div style={{ color: '#f87171', fontSize: 13, padding: '8px 12px', background: 'rgba(239,68,68,0.08)', borderRadius: 8, border: '1px solid rgba(239,68,68,0.2)' }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} style={submitBtn(loading)}>
            {loading ? '...' : mode === 'login' ? 'Sign in' : 'Sign up'}
          </button>
        </form>

        <button
          onClick={() => { setMode(m => m === 'login' ? 'signup' : 'login'); setError('') }}
          style={{ marginTop: 16, background: 'none', border: 'none', color: '#6366f1', cursor: 'pointer', fontSize: 14, width: '100%', textAlign: 'center' }}
        >
          {mode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
        </button>
      </div>
    </div>
  )
}

const overlay: React.CSSProperties = {
  minHeight: '100vh', background: '#0f1117',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
}

const card: React.CSSProperties = {
  width: 380, background: '#1a1d27',
  borderRadius: 20, padding: '36px 32px',
  border: '1px solid rgba(255,255,255,0.08)',
  boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
}

const input: React.CSSProperties = {
  width: '100%', padding: '12px 14px',
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 10, color: '#e5e7eb',
  fontSize: 15, outline: 'none', boxSizing: 'border-box',
}

const submitBtn = (loading: boolean): React.CSSProperties => ({
  width: '100%', padding: '13px',
  background: loading ? 'rgba(99,102,241,0.5)' : '#6366f1',
  border: 'none', borderRadius: 10,
  color: 'white', fontWeight: 700, fontSize: 15,
  cursor: loading ? 'default' : 'pointer', marginTop: 4,
})
