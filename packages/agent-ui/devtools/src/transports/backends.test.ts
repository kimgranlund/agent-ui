import { describe, it, expect } from 'vitest'
import { listBackends, probeProxyAvailable, BACKEND_IDS, DEFAULT_PROXY_MOUNT } from './backends.ts'
import type { StatusProbeFetch } from './backends.ts'

// n2d's accept row (SPEC-R2 AC2): replay/a2a report available unconditionally; proxy's available()
// probes the injected mount's GET /status and maps {available: boolean} through; a probe rejection
// reads as available:false — NEVER a throw.

const okProbe =
  (payload: unknown): StatusProbeFetch =>
  () =>
    Promise.resolve({ ok: true, json: () => Promise.resolve(payload) })

describe('listBackends (SPEC-R2)', () => {
  it('returns the three descriptor rows in the closed id order', () => {
    const rows = listBackends()
    expect(rows.map((r) => r.id)).toEqual([...BACKEND_IDS])
    expect(rows.every((r) => r.label.length > 0)).toBe(true)
  })

  it('replay and a2a report available() === true unconditionally (AC2)', async () => {
    const rows = listBackends()
    await expect(rows.find((r) => r.id === 'replay')!.available()).resolves.toBe(true)
    await expect(rows.find((r) => r.id === 'a2a')!.available()).resolves.toBe(true)
  })

  it('proxy.available() maps the mount\'s /status {available} through (AC2)', async () => {
    let probed = ''
    const fetchStub: StatusProbeFetch = (url) => {
      probed = url
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ available: true, providers: 2 }) })
    }
    const proxy = listBackends({ proxy: { fetch: fetchStub } }).find((r) => r.id === 'proxy')!
    await expect(proxy.available()).resolves.toBe(true)
    expect(probed).toBe(`${DEFAULT_PROXY_MOUNT}/status`)

    const off = listBackends({ proxy: { fetch: okProbe({ available: false, providers: 0 }) } }).find((r) => r.id === 'proxy')!
    await expect(off.available()).resolves.toBe(false)
  })

  it('a custom mount url is probed at <url>/status', async () => {
    let probed = ''
    const fetchStub: StatusProbeFetch = (url) => {
      probed = url
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ available: true }) })
    }
    await probeProxyAvailable({ url: 'http://localhost:8787/__a2ui/agent', fetch: fetchStub })
    expect(probed).toBe('http://localhost:8787/__a2ui/agent/status')
  })

  it('a probe rejection resolves false — never throws (AC2)', async () => {
    const rejecting: StatusProbeFetch = () => Promise.reject(new Error('ECONNREFUSED'))
    await expect(probeProxyAvailable({ fetch: rejecting })).resolves.toBe(false)
  })

  it('a non-2xx, malformed JSON, or non-boolean field all resolve false — fail-closed, never a throw', async () => {
    const non2xx: StatusProbeFetch = () => Promise.resolve({ ok: false, json: () => Promise.resolve({}) })
    await expect(probeProxyAvailable({ fetch: non2xx })).resolves.toBe(false)
    const badJson: StatusProbeFetch = () => Promise.resolve({ ok: true, json: () => Promise.reject(new SyntaxError('bad json')) })
    await expect(probeProxyAvailable({ fetch: badJson })).resolves.toBe(false)
    await expect(probeProxyAvailable({ fetch: okProbe({ available: 'yes' }) })).resolves.toBe(false)
    await expect(probeProxyAvailable({ fetch: okProbe(null) })).resolves.toBe(false)
  })
})
