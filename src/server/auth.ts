import { createHash, createHmac, timingSafeEqual } from 'node:crypto'

export const SESSION_COOKIE = 'sauna_session'
const SESSION_MS = 12 * 60 * 60 * 1000
const LOCK_AFTER = 5
const LOCK_MS = 2_000
const FORGET_AFTER = 15 * 60 * 1000

let failures = 0
let lastFailure = 0

function digest(value: string) {
  return createHash('sha256').update(value, 'utf8').digest()
}

/** Compare two strings without leaking which one is longer. */
export function sameSecret(input: string, expected: string) {
  const match = timingSafeEqual(digest(input), digest(expected))
  return expected.length > 0 && match
}

export function signSession(secret: string, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({ exp: now + SESSION_MS }), 'utf8').toString('base64url')
  const sig = createHmac('sha256', secret).update(payload).digest('base64url')
  return `${payload}.${sig}`
}

export function sessionLive(token: string, secret: string, now = Date.now()) {
  if (!secret) return false
  const dot = token.indexOf('.')
  if (dot <= 0) return false
  const payload = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  const expected = createHmac('sha256', secret).update(payload).digest('base64url')
  const left = Buffer.from(sig)
  const right = Buffer.from(expected)
  if (left.length !== right.length || !timingSafeEqual(left, right)) return false
  try {
    const body = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { exp?: unknown }
    return typeof body.exp === 'number' && Number.isFinite(body.exp) && body.exp > now
  } catch {
    return false
  }
}

export function readCookie(header: string | null, name: string) {
  if (!header) return null
  for (const part of header.split(';')) {
    const eq = part.indexOf('=')
    if (eq < 0) continue
    if (part.slice(0, eq).trim() !== name) continue
    const value = part.slice(eq + 1).trim()
    try {
      return decodeURIComponent(value)
    } catch {
      return value
    }
  }
  return null
}

export function sessionCookie(token: string, maxAge: number) {
  return `${SESSION_COOKIE}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`
}

export function staffConfigured() {
  return Boolean(process.env.STAFF_PASSWORD?.trim() && process.env.SESSION_SECRET?.trim())
}

export async function delayIfLocked() {
  if (Date.now() - lastFailure > FORGET_AFTER) failures = 0
  if (failures >= LOCK_AFTER) await new Promise((resolve) => setTimeout(resolve, LOCK_MS))
}

export function noteLoginFailure() {
  failures += 1
  lastFailure = Date.now()
  return failures
}

export function noteLoginSuccess() {
  failures = 0
  lastFailure = 0
}

export const SESSION_MAX_AGE = Math.round(SESSION_MS / 1000)
