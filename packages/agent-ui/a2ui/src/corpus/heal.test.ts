import { describe, it, expect } from 'vitest'
import { heal } from './heal.ts'
import { validateA2ui } from '../renderer/validate.ts'
import { demoCatalog } from '../fixtures.ts'
import type { A2uiOutput } from '../protocol.ts'

// heal.test.ts — the ADR-0061 contract (corpus LLD-C7): the closed, form-only repair list; the
// no-laundering negative control (semantic defects pass through unhealed and still reject at
// tier-1); the pin-gated version-fill arm; and totality on non-JSON input.

describe('heal — the ONE shared healer (ADR-0061, LLD-C7)', () => {
  describe('closed repair list — each arm heals and names itself', () => {
    it('(a) strips a markdown fence around the JSON payload', () => {
      const text = '```json\n[{"version":"v1.0","createSurface":{"surfaceId":"s1","catalogId":"demo"}}]\n```'
      const result = heal(text)
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.changed).toBe(true)
      expect(result.repairs).toEqual(['fence-strip'])
      expect(result.messages).toEqual([{ version: 'v1.0', createSurface: { surfaceId: 's1', catalogId: 'demo' } }])
    })

    it('(a) strips surrounding prose even without a fence', () => {
      const text =
        'Sure, here is the UI:\n[{"version":"v1.0","createSurface":{"surfaceId":"s1","catalogId":"demo"}}]\nLet me know if you need changes.'
      const result = heal(text)
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.changed).toBe(true)
      expect(result.repairs).toEqual(['fence-strip'])
      expect(result.messages).toEqual([{ version: 'v1.0', createSurface: { surfaceId: 's1', catalogId: 'demo' } }])
    })

    it('already-clean text (no fence, no prose) is left alone — changed:false', () => {
      const text = '[{"version":"v1.0","createSurface":{"surfaceId":"s1","catalogId":"demo"}}]'
      const result = heal(text)
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.changed).toBe(false)
      expect(result.repairs).toEqual([])
    })

    it('(b) removes a trailing comma before a closing bracket/brace', () => {
      const text = '[{"version":"v1.0","createSurface":{"surfaceId":"s1","catalogId":"demo",},},]'
      const result = heal(text)
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.changed).toBe(true)
      expect(result.repairs).toEqual(['trailing-comma'])
      expect(result.messages).toEqual([{ version: 'v1.0', createSurface: { surfaceId: 's1', catalogId: 'demo' } }])
    })

    it('(b) leaves a comma that only appears inside a string value untouched (no content laundering)', () => {
      const text = '[{"version":"v1.0","createSurface":{"surfaceId":"s1","catalogId":"demo,]"}}]'
      const result = heal(text)
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.changed).toBe(false)
      expect(result.repairs).toEqual([])
      const [msg] = result.messages as unknown as Array<{ createSurface: { catalogId: string } }>
      expect(msg.createSurface.catalogId).toBe('demo,]')
    })

    it('(c) normalizes a single message object into a one-element array', () => {
      const text = '{"version":"v1.0","createSurface":{"surfaceId":"s1","catalogId":"demo"}}'
      const result = heal(text)
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.changed).toBe(true)
      expect(result.repairs).toEqual(['single-object-envelope'])
      expect(result.messages).toEqual([{ version: 'v1.0', createSurface: { surfaceId: 's1', catalogId: 'demo' } }])
    })

    it('(c) applies the envelope normalization to already-structured input too (text arms skipped)', () => {
      const single = { version: 'v1.0', createSurface: { surfaceId: 's1', catalogId: 'demo' } }
      const result = heal(single as unknown as A2uiOutput)
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.changed).toBe(true)
      expect(result.repairs).toEqual(['single-object-envelope'])
      expect(result.messages).toEqual([single])
    })

    it('(d) fills a missing per-message version from the pin', () => {
      const messages = [{ createSurface: { surfaceId: 's1', catalogId: 'demo' } }] as unknown as A2uiOutput
      const result = heal(messages, { protocolVersion: 'v1.0' })
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.changed).toBe(true)
      expect(result.repairs).toEqual(['version-fill'])
      expect(result.messages).toEqual([{ version: 'v1.0', createSurface: { surfaceId: 's1', catalogId: 'demo' } }])
    })

    it('(d) pin absent ⇒ the version arm is inert — a missing version stays missing', () => {
      const messages = [{ createSurface: { surfaceId: 's1', catalogId: 'demo' } }] as unknown as A2uiOutput
      const result = heal(messages)
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.changed).toBe(false)
      expect(result.repairs).toEqual([])
      expect(result.messages).toEqual([{ createSurface: { surfaceId: 's1', catalogId: 'demo' } }])
    })

    it('(d) a WRONG version is never corrected — only an absent one is filled', () => {
      const messages = [
        { version: 'v0.1', createSurface: { surfaceId: 's1', catalogId: 'demo' } },
      ] as unknown as A2uiOutput
      const result = heal(messages, { protocolVersion: 'v1.0' })
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.changed).toBe(false)
      expect(result.repairs).toEqual([])
      // the wrong version survives untouched and still rejects downstream at tier-1 (E_PIN territory)
      const verdict = validateA2ui(result.messages, demoCatalog)
      expect(verdict.valid).toBe(false)
      expect(verdict.failures.some((f) => f.code === 'VERSION_UNSUPPORTED')).toBe(true)
    })
  })

  describe('no-laundering negative control — semantic defects pass through unhealed and still reject at tier-1', () => {
    it('an unknown component is not healed and still fails validateA2ui (CATALOG)', () => {
      const out: A2uiOutput = [
        { version: 'v1.0', createSurface: { surfaceId: 's1', catalogId: 'demo' } },
        {
          version: 'v1.0',
          updateComponents: { surfaceId: 's1', components: [{ id: 'root', component: 'NotARealComponent' }] },
        },
      ]
      const result = heal(out)
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.changed).toBe(false)
      expect(result.repairs).toEqual([])
      expect(result.messages).toEqual(out)

      const verdict = validateA2ui(result.messages, demoCatalog)
      expect(verdict.valid).toBe(false)
      expect(verdict.failures.some((f) => f.code === 'CATALOG')).toBe(true)
    })

    it('two roots are not healed and still fail validateA2ui (IDGRAPH)', () => {
      const out: A2uiOutput = [
        { version: 'v1.0', createSurface: { surfaceId: 's1', catalogId: 'demo' } },
        {
          version: 'v1.0',
          updateComponents: {
            surfaceId: 's1',
            components: [
              { id: 'root', component: 'Text', text: 'a' },
              { id: 'root', component: 'Text', text: 'b' },
            ],
          },
        },
      ]
      const result = heal(out)
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.changed).toBe(false)
      expect(result.repairs).toEqual([])
      expect(result.messages).toEqual(out)

      const verdict = validateA2ui(result.messages, demoCatalog)
      expect(verdict.valid).toBe(false)
      expect(verdict.failures.some((f) => f.code === 'IDGRAPH')).toBe(true)
    })

    it('a malformed JSON pointer is not healed and still fails validateA2ui (POINTER)', () => {
      const out: A2uiOutput = [
        { version: 'v1.0', createSurface: { surfaceId: 's1', catalogId: 'demo' } },
        {
          version: 'v1.0',
          updateComponents: {
            surfaceId: 's1',
            components: [{ id: 'root', component: 'Text', text: { path: '~badescape' } }],
          },
        },
      ]
      const result = heal(out)
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.changed).toBe(false)
      expect(result.repairs).toEqual([])
      expect(result.messages).toEqual(out)

      const verdict = validateA2ui(result.messages, demoCatalog)
      expect(verdict.valid).toBe(false)
      expect(verdict.failures.some((f) => f.code === 'POINTER')).toBe(true)
    })

    it('a missing root is not healed and still fails validateA2ui (IDGRAPH)', () => {
      const out: A2uiOutput = [
        { version: 'v1.0', createSurface: { surfaceId: 's1', catalogId: 'demo' } },
        {
          version: 'v1.0',
          updateComponents: { surfaceId: 's1', components: [{ id: 'notroot', component: 'Text', text: 'a' }] },
        },
      ]
      const result = heal(out)
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.changed).toBe(false)

      const verdict = validateA2ui(result.messages, demoCatalog)
      expect(verdict.valid).toBe(false)
      expect(verdict.failures.some((f) => f.code === 'IDGRAPH')).toBe(true)
    })
  })

  it('non-JSON after fence-stripping returns ok:false, reason:"unparseable"', () => {
    const text = '```json\nthis is not json {{{\n```'
    const result = heal(text)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toBe('unparseable')
  })

  it('plain non-JSON prose with no bracketed payload at all returns ok:false', () => {
    const result = heal('sorry, I cannot help with that request.')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toBe('unparseable')
  })

  it('a structured, already-versioned ADR-0055-style seed heals to changed:false (admits status:"valid")', () => {
    const seed: A2uiOutput = [
      { version: 'v1.0', createSurface: { surfaceId: 's1', catalogId: 'demo' } },
      {
        version: 'v1.0',
        updateComponents: { surfaceId: 's1', components: [{ id: 'root', component: 'Text', text: 'hi' }] },
      },
    ]
    const result = heal(seed)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.changed).toBe(false)
    expect(result.repairs).toEqual([])
    expect(result.messages).toEqual(seed)

    // and it is in fact tier-1 valid, unlike the negative-control fixtures above
    const verdict = validateA2ui(result.messages, demoCatalog)
    expect(verdict.valid).toBe(true)
  })

  it('composes multiple arms in one pass: a fenced, trailing-commaed single object with a missing pinned version', () => {
    const text = '```json\n{"createSurface":{"surfaceId":"s1","catalogId":"demo",},}\n```'
    const result = heal(text, { protocolVersion: 'v1.0' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.changed).toBe(true)
    expect(new Set(result.repairs)).toEqual(
      new Set(['fence-strip', 'trailing-comma', 'single-object-envelope', 'version-fill']),
    )
    expect(result.messages).toEqual([{ version: 'v1.0', createSurface: { surfaceId: 's1', catalogId: 'demo' } }])
  })
})
