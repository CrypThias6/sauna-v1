import { afterEach, describe, expect, it, vi } from 'vitest'
import { PIQO_TIMEOUT_MS, runPiqoAction } from './piqo.js'

const LINK = 'https://links.example.test/secret-action-glow'

function receipt(state = 'pending') {
  return new Response(JSON.stringify({ receipt_id: 'rcpt-1', scene_name: 'Glow', state, v: 1 }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  delete process.env.PIQO_LINK_GLOW_ON
  delete process.env.PIQO_LINK_GLOW_OFF
  delete process.env.PIQO_LINK_OUTDOOR_ON
  delete process.env.PIQO_LINK_OUTDOOR_OFF
  delete process.env.PIQO_LINK_GENTLE_FLASH
  delete process.env.PIQO_LINK_WARNING_FLASH
})

describe('runPiqoAction', () => {
  it('returns not configured and does not fetch when the link is missing', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const result = await runPiqoAction('Glow on')
    expect(result).toMatchObject({ ok: false, receiptId: null, state: null, sent: false, reason: 'not configured', error: 'not configured' })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(warn).toHaveBeenCalledWith('Piqo action not configured: Glow on')
    expect(JSON.stringify(warn.mock.calls)).not.toContain('secret-action')
  })

  it('POSTs a fresh request id and returns the receipt', async () => {
    process.env.PIQO_LINK_GLOW_ON = LINK
    const fetchMock = vi.fn(async () => receipt())
    vi.stubGlobal('fetch', fetchMock)
    const result = await runPiqoAction('Glow on')
    expect(result).toEqual({ ok: true, receiptId: 'rcpt-1', state: 'pending', sent: true, reason: 'pending' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe(LINK)
    expect(init.method).toBe('POST')
    expect(init.headers).toMatchObject({ 'content-type': 'application/json' })
    expect(init.signal).toBeInstanceOf(AbortSignal)
    const body = JSON.parse(String(init.body)) as { request_id: string }
    expect(body.request_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
    expect(PIQO_TIMEOUT_MS).toBe(10_000)
  })

  it('retries once on a 5xx and then accepts the receipt', async () => {
    process.env.PIQO_LINK_GENTLE_FLASH = LINK
    const ids: string[] = []
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      ids.push((JSON.parse(String(init.body)) as { request_id: string }).request_id)
      if (ids.length === 1) return new Response('no', { status: 503 })
      return receipt('pending')
    })
    vi.stubGlobal('fetch', fetchMock)
    const result = await runPiqoAction('Gentle flash')
    expect(result.ok).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(ids[0]).not.toBe(ids[1])
  })

  it('retries once on a network error', async () => {
    process.env.PIQO_LINK_OUTDOOR_ON = LINK
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error(`connect failed ${LINK}`))
      .mockResolvedValueOnce(receipt())
    vi.stubGlobal('fetch', fetchMock)
    const result = await runPiqoAction('Outdoor on')
    expect(result.ok).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(JSON.stringify(result)).not.toContain('links.example')
  })

  it('does not retry a 4xx, including a revoked link', async () => {
    process.env.PIQO_LINK_GLOW_OFF = LINK
    const gone = vi.fn(async () => new Response('gone', { status: 410 }))
    vi.stubGlobal('fetch', gone)
    const revoked = await runPiqoAction('Glow off')
    expect(revoked).toMatchObject({ ok: false, reason: 'revoked' })
    expect(gone).toHaveBeenCalledTimes(1)
    expect(JSON.stringify(revoked)).not.toContain('secret-action')

    const bad = vi.fn(async () => new Response('no', { status: 400 }))
    vi.stubGlobal('fetch', bad)
    const rejected = await runPiqoAction('Glow off')
    expect(rejected).toMatchObject({ ok: false, reason: 'rejected', error: 'Piqo returned 400' })
    expect(bad).toHaveBeenCalledTimes(1)
  })

  it('returns a clear error after two network failures and logs only the action name', async () => {
    process.env.PIQO_LINK_WARNING_FLASH = LINK
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const fetchMock = vi.fn(async () => {
      throw new Error(`timeout talking to ${LINK}`)
    })
    vi.stubGlobal('fetch', fetchMock)
    const result = await runPiqoAction('Warning flash')
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(result).toMatchObject({ ok: false, sent: false, reason: 'unavailable', error: 'Piqo could not be reached' })
    expect(JSON.stringify(result)).not.toContain('links.example')
    expect(warn).toHaveBeenCalledWith('Piqo action failed: Warning flash')
    expect(JSON.stringify(warn.mock.calls)).not.toContain('links.example')
  })

  it('does not call Piqo for an unknown action or a toggle inside the gap', async () => {
    process.env.PIQO_LINK_OUTDOOR_OFF = LINK
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    expect(await runPiqoAction('Explode')).toMatchObject({ ok: false, reason: 'unknown action' })
    expect(await runPiqoAction('Outdoor off', { checkGap: true, now: 1_000, lastToggleAt: 500 })).toMatchObject({ ok: false, reason: 'too soon' })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
