// artifact-feed.test.ts — LLD-C6 derivation + drift gate for the A2A artifact-feed demo page. Mirrors
// arena-replay.test.ts's split: exercises the PURE derivation module directly (no DOM, no page mount)
// against the actual committed fixture — the same bytes `a2ui/src/bridge/feed-fixture.test.ts` gates on.
// Reading via `fs` here is a faithful proxy for what the page loads via a Vite `?raw` static import.
import { describe, it, expect } from 'vitest'
// @ts-expect-error - node:fs is typed via @types/node; vitest/node resolves it at runtime (fleet precedent)
import { readFileSync } from 'node:fs'
import { loadFeed } from './artifact-feed.ts'

declare const process: { cwd(): string }
const FIXTURE_PATH = `${process.cwd()}/packages/agent-ui/a2ui/tools/pipeline/fixtures/artifact-feed.a2a.jsonl`
const raw = readFileSync(FIXTURE_PATH, 'utf8') as string

describe('loadFeed — the committed artifact-feed fixture parses clean', () => {
  it('loads ok:true with the verdict clean over every check', () => {
    const loaded = loadFeed(raw)
    expect(loaded.ok).toBe(true)
    if (loaded.ok) {
      expect(loaded.verdict.clean).toBe(true)
      for (const check of loaded.verdict.checks) expect(check.failures, check.name).toEqual([])
    }
  })

  it('has 6 entries (3 user + 3 agent turns) in order', () => {
    const loaded = loadFeed(raw)
    if (!loaded.ok) throw new Error('expected ok:true')
    expect(loaded.entries.map((e) => e.role)).toEqual(['user', 'agent', 'user', 'agent', 'user', 'agent'])
  })

  it('the two artifact-bearing agent messages carry distinct surfaceIds, one per artifact class', () => {
    const loaded = loadFeed(raw)
    if (!loaded.ok) throw new Error('expected ok:true')
    const artifactEntries = loaded.entries.filter((e) => e.artifact !== undefined)
    expect(artifactEntries.length).toBe(2)
    const surfaceIds = artifactEntries.map((e) => e.artifact!.surfaceId)
    expect(new Set(surfaceIds).size).toBe(2) // unique per artifact message
  })

  it('the third exchange is prose-only (no DataPart) — proves the feed renders MIXED messages', () => {
    const loaded = loadFeed(raw)
    if (!loaded.ok) throw new Error('expected ok:true')
    const last = loaded.entries.at(-1)!
    expect(last.artifact).toBeUndefined()
    expect(last.prose.length).toBeGreaterThan(0)
  })

  it('every user entry carries a handshake (metadata.a2uiClientCapabilities) — visible on EVERY client→server message', () => {
    const loaded = loadFeed(raw)
    if (!loaded.ok) throw new Error('expected ok:true')
    const userEntries = loaded.entries.filter((e) => e.role === 'user')
    expect(userEntries.length).toBeGreaterThan(0)
    for (const entry of userEntries) expect(entry.handshake).toBeDefined()
  })

  it('agent entries carry no handshake (the field is user-turn only)', () => {
    const loaded = loadFeed(raw)
    if (!loaded.ok) throw new Error('expected ok:true')
    for (const entry of loaded.entries.filter((e) => e.role === 'agent')) expect(entry.handshake).toBeUndefined()
  })

  it('artifact.lines re-serialize the unwrapped envelopes one per line (ingest-ready)', () => {
    const loaded = loadFeed(raw)
    if (!loaded.ok) throw new Error('expected ok:true')
    const artifactEntry = loaded.entries.find((e) => e.artifact !== undefined)!
    for (const line of artifactEntry.artifact!.lines) expect(() => JSON.parse(line)).not.toThrow()
  })

  it('each entry carries the raw wire line verbatim', () => {
    const loaded = loadFeed(raw)
    if (!loaded.ok) throw new Error('expected ok:true')
    for (const entry of loaded.entries) expect(() => JSON.parse(entry.wire)).not.toThrow()
  })
})

describe('loadFeed — fail-closed edge cases (LLD §8)', () => {
  it('empty input: ok:true with zero entries (the empty-state line, not a crash)', () => {
    const loaded = loadFeed('')
    expect(loaded).toEqual({ ok: true, entries: [], verdict: { clean: true, checks: [] } })
  })

  it('header-only fixture: ok:true with zero entries', () => {
    const loaded = loadFeed('{"a2aFeed":{"protocolVersion":"0.3.0","a2ui":"v1.0","provenance":{"source":"authored","date":"2026-07-08"}}}')
    expect(loaded.ok).toBe(true)
    if (loaded.ok) {
      expect(loaded.entries).toEqual([])
      expect(loaded.verdict.clean).toBe(true)
    }
  })

  it('garbage first line: ok:false naming the header defect (never a crash)', () => {
    const loaded = loadFeed('not json at all')
    expect(loaded.ok).toBe(false)
  })

  it('unsupported protocolVersion pin: ok:false (SPEC-R2 never-silently-proceed)', () => {
    const loaded = loadFeed('{"a2aFeed":{"protocolVersion":"9.9.9","a2ui":"v1.0","provenance":{"source":"authored","date":"2026-07-08"}}}')
    expect(loaded.ok).toBe(false)
    if (!loaded.ok) expect(loaded.reasons.join(' ')).toMatch(/9\.9\.9/)
  })

  it('unsupported a2ui pin: ok:false', () => {
    const loaded = loadFeed('{"a2aFeed":{"protocolVersion":"0.3.0","a2ui":"v0.1","provenance":{"source":"authored","date":"2026-07-08"}}}')
    expect(loaded.ok).toBe(false)
  })

  it('a caps-less user message FAILS the whole feed (fail-closed, not a partial render)', () => {
    const header = '{"a2aFeed":{"protocolVersion":"0.3.0","a2ui":"v1.0","provenance":{"source":"authored","date":"2026-07-08"}}}'
    const badUser = JSON.stringify({ kind: 'message', role: 'user', messageId: 'u1', parts: [{ kind: 'text', text: 'hi' }] })
    const loaded = loadFeed(`${header}\n${badUser}`)
    expect(loaded.ok).toBe(false)
    if (!loaded.ok) expect(loaded.reasons.join(' ')).toMatch(/a2uiClientCapabilities/)
  })

  it('an untagged a2ui-shaped DataPart FAILS the whole feed (the mime check)', () => {
    const header = '{"a2aFeed":{"protocolVersion":"0.3.0","a2ui":"v1.0","provenance":{"source":"authored","date":"2026-07-08"}}}'
    const untagged = JSON.stringify({
      kind: 'message',
      role: 'agent',
      messageId: 'a1',
      parts: [{ kind: 'data', data: { version: 'v1.0', createSurface: { surfaceId: 's1', catalogId: 'agent-ui' } } }],
    })
    const loaded = loadFeed(`${header}\n${untagged}`)
    expect(loaded.ok).toBe(false)
    if (!loaded.ok) expect(loaded.reasons.join(' ')).toMatch(/mimeType/)
  })

  it('an invalid a2ui payload (unknown component type) FAILS the whole feed', () => {
    const header = '{"a2aFeed":{"protocolVersion":"0.3.0","a2ui":"v1.0","provenance":{"source":"authored","date":"2026-07-08"}}}'
    const poisoned = JSON.stringify({
      kind: 'message',
      role: 'agent',
      messageId: 'a1',
      parts: [
        {
          kind: 'data',
          data: { version: 'v1.0', updateComponents: { surfaceId: 's1', components: [{ id: 'root', component: 'Chart' }] } },
          metadata: { mimeType: 'application/a2ui+json' },
        },
      ],
    })
    const loaded = loadFeed(`${header}\n${poisoned}`)
    expect(loaded.ok).toBe(false)
  })

  it('a foreign part (untagged, non-a2ui-shaped data) does NOT fail the feed — tolerated, never thrown', () => {
    const header = '{"a2aFeed":{"protocolVersion":"0.3.0","a2ui":"v1.0","provenance":{"source":"authored","date":"2026-07-08"}}}'
    const user = JSON.stringify({
      kind: 'message',
      role: 'user',
      messageId: 'u1',
      parts: [
        { kind: 'text', text: 'hi' },
        { kind: 'data', data: { unrelated: true } },
      ],
      extensions: ['https://a2ui.org/a2a-extension/a2ui/v1.0'],
      metadata: { a2uiClientCapabilities: { 'v1.0': { supportedCatalogIds: ['agent-ui'] } } },
    })
    const loaded = loadFeed(`${header}\n${user}`)
    expect(loaded.ok).toBe(true)
  })
})
