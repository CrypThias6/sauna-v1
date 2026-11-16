import { useState, type FormEvent } from 'react'
import { staffFetch } from '../lib/session'

export function Login() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setPending(true)
    try {
      const response = await staffFetch('/api/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (response.ok) {
        setError(null)
        return
      }
      const body = (await response.json().catch(() => null)) as { error?: unknown } | null
      setError(typeof body?.error === 'string' ? body.error : 'Wrong password.')
    } catch {
      setError('This site has no staff login.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="login-gate">
      <form className="login-card" onSubmit={submit}>
        <span className="k">Staff</span>
        <h1>Secret Sauna</h1>
        <label>
          <span>Password</span>
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>
        <button type="submit" disabled={pending}>
          {pending ? 'Checking…' : 'Enter'}
        </button>
        {error ? <p className="fault">{error}</p> : null}
      </form>
    </div>
  )
}
