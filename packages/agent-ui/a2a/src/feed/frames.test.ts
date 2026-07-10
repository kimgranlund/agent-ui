// frames.test.ts — LLD-C6 (SPEC-R18 AC1): the part-frame round-trip gate. Lives under `src/` (the vitest
// `packages` project include is `src/**/*.test.ts` — the bridge's `a2ui/src/bridge/*.test.ts`-over-`tools/`
// precedent), testing the tools/-homed `frames.ts` module directly (relative import, not the package
// barrel — `tools/` is never barrel-exported, SPEC-N1/N2).
//
// Invariants asserted (LLD §3): `createFrameAssembler`-over-`framesOf(m)` reassembles deep-equal `m` for
// prose-only / artifact-only / mixed / zero-part turns. Negative controls, each a TYPED fault (never a
// throw): a part before the header; a foreign frame kind; `complete()` before any header; and — the
// completion invariant's whole reason for existing — `complete()` with FEWER or MORE parts than the
// header declared (the truncation/overrun cases a stream-end-alone signal could never distinguish).
import { describe, expect, it } from 'vitest'
import type { A2aMessage } from '@agent-ui/a2a'
import { framesOf, createFrameAssembler } from '../../tools/feed/frames.ts'

function reassemble(lines: string[]): ReturnType<ReturnType<typeof createFrameAssembler>['complete']> {
  const assembler = createFrameAssembler()
  for (const line of lines) {
    const result = assembler.push(line)
    if (!result.ok) return result
  }
  return assembler.complete()
}

const proseOnly: A2aMessage = {
  kind: 'message',
  role: 'agent',
  messageId: 'live-a1',
  contextId: 'ctx-1',
  parts: [{ kind: 'text', text: 'Here is the report.' }],
}

const artifactOnly: A2aMessage = {
  kind: 'message',
  role: 'agent',
  messageId: 'live-a2',
  contextId: 'ctx-1',
  taskId: 'task-1',
  parts: [
    { kind: 'data', data: { version: 'v1.0', createSurface: { surfaceId: 's1', catalogId: 'agent-ui' } }, metadata: { mimeType: 'application/a2ui+json' } },
  ],
}

const mixed: A2aMessage = {
  kind: 'message',
  role: 'agent',
  messageId: 'live-a3',
  contextId: 'ctx-1',
  parts: [
    { kind: 'text', text: 'Here is the regional breakdown.' },
    { kind: 'data', data: { version: 'v1.0', createSurface: { surfaceId: 's2', catalogId: 'agent-ui' } }, metadata: { mimeType: 'application/a2ui+json' } },
    { kind: 'data', data: { version: 'v1.0', updateDataModel: { surfaceId: 's2', value: { a: 1 } } }, metadata: { mimeType: 'application/a2ui+json' } },
  ],
}

const zeroPart: A2aMessage = {
  kind: 'message',
  role: 'agent',
  messageId: 'live-a4',
  contextId: 'ctx-1',
  parts: [],
}

describe('frames — round-trip (SPEC-R18 AC1)', () => {
  it.each([
    ['prose-only', proseOnly],
    ['artifact-only', artifactOnly],
    ['mixed', mixed],
    ['zero-part', zeroPart],
  ])('%s turn reassembles deep-equal the original wrapServerTurn-shaped message', (_label, msg) => {
    const lines = framesOf(msg)
    const result = reassemble(lines)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.message).toEqual(msg)
  })

  it('the header line declares the part count up front — decidable before any part frame arrives', () => {
    const lines = framesOf(mixed)
    const header = JSON.parse(lines[0]!) as { turn: { parts: number } }
    expect(header.turn.parts).toBe(mixed.parts.length)
  })

  it('progressive push() surfaces each part as it lands (for progressive paint)', () => {
    const lines = framesOf(mixed)
    const assembler = createFrameAssembler()
    const headerResult = assembler.push(lines[0]!)
    expect(headerResult).toEqual({ ok: true })
    const parts = lines.slice(1).map((l) => assembler.push(l))
    expect(parts.every((p) => p.ok)).toBe(true)
    expect(parts.map((p) => (p.ok ? p.part : undefined))).toEqual(mixed.parts)
  })

  it('a zero-part header with no part frames is a valid EMPTY turn, not a fault', () => {
    const lines = framesOf(zeroPart)
    expect(lines).toHaveLength(1) // header only
    const result = reassemble(lines)
    expect(result).toEqual({ ok: true, message: zeroPart })
  })
})

describe('frames — negative controls (typed faults, never a throw)', () => {
  it('a part frame before the turn header faults', () => {
    const assembler = createFrameAssembler()
    const result = assembler.push(JSON.stringify({ part: { kind: 'text', text: 'stray' } }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toMatch(/before the turn header/)
  })

  it('a foreign frame kind faults (neither "turn" nor "part")', () => {
    const assembler = createFrameAssembler()
    const result = assembler.push(JSON.stringify({ bogus: true }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toMatch(/foreign frame kind/)
  })

  it('malformed JSON on a frame line faults, never throws', () => {
    const assembler = createFrameAssembler()
    expect(() => assembler.push('{not json')).not.toThrow()
    const result = assembler.push('{not json')
    expect(result.ok).toBe(false)
  })

  it('complete() before any turn header faults', () => {
    const assembler = createFrameAssembler()
    const result = assembler.complete()
    expect(result).toEqual({ ok: false, reason: 'complete() called before any turn header' })
  })

  it('TRUNCATION: complete() with FEWER parts than the header declares faults — the count invariant\'s whole point, proving the gate bites on a stream that would otherwise look like a short-but-complete turn', () => {
    const lines = framesOf(mixed) // header declares 3 parts
    const assembler = createFrameAssembler()
    for (const line of lines.slice(0, 2)) {
      // drop the LAST part frame — a clean-looking truncated prefix
      const r = assembler.push(line)
      expect(r.ok).toBe(true)
    }
    const result = assembler.complete()
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toMatch(/expected 3 part\(s\), received 1/)
  })

  it('OVERRUN: complete() with MORE parts than the header declares faults', () => {
    const lines = framesOf(proseOnly) // header declares 1 part
    const assembler = createFrameAssembler()
    for (const line of lines) expect(assembler.push(line).ok).toBe(true)
    // an extra, unforeseen part frame arrives beyond the declared count
    const extra = assembler.push(JSON.stringify({ part: { kind: 'text', text: 'unexpected extra' } }))
    expect(extra.ok).toBe(true) // push() stays permissive — the count check lives at complete()
    const result = assembler.complete()
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toMatch(/expected 1 part\(s\), received 2/)
  })

  it('fail-closed: after a fault, every subsequent push ALSO faults', () => {
    const assembler = createFrameAssembler()
    const first = assembler.push(JSON.stringify({ bogus: true }))
    expect(first.ok).toBe(false)
    const second = assembler.push(JSON.stringify({ turn: { messageId: 'x', role: 'agent', parts: 0 } }))
    expect(second.ok).toBe(false)
    if (!second.ok) expect(second.reason).toMatch(/already faulted/)
  })

  it('a duplicate turn header faults', () => {
    const assembler = createFrameAssembler()
    const header = JSON.stringify({ turn: { messageId: 'x', role: 'agent', parts: 0 } })
    expect(assembler.push(header).ok).toBe(true)
    const second = assembler.push(header)
    expect(second.ok).toBe(false)
    if (!second.ok) expect(second.reason).toMatch(/duplicate turn header/)
  })

  it('a malformed turn header (bad role) faults', () => {
    const assembler = createFrameAssembler()
    const result = assembler.push(JSON.stringify({ turn: { messageId: 'x', role: 'referee', parts: 0 } }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toMatch(/malformed turn header/)
  })
})
