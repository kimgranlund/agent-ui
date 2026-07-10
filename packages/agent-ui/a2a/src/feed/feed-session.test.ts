// feed-session.test.ts — LLD-C7: the feed-session derivation's determinism + golden-fixture legs. Lives
// under `src/` (the bridge's `a2ui/src/bridge/*.test.ts`-over-`tools/` precedent), testing the
// tools/-homed `feed-session.ts` module directly.
//
// The committed artifact-feed fixture (`a2ui/tools/pipeline/fixtures/artifact-feed.a2a.jsonl`) is the
// golden input (LLD-C7) — sliced to a PREFIX ending on a user turn (a live turn is always dispatched with
// the client's own turn as the log's tail, HV-8's "every client→server message" carrying caps; the
// fixture's own final line is an AGENT reply, so the golden prefix stops one line short of it).
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { sessionFromFeed } from '../../tools/feed/feed-session.ts'

declare const process: { cwd(): string }

const PROTOCOL_VERSION = '0.3.0'
const FIXTURE_PATH = `${process.cwd()}/packages/agent-ui/a2ui/tools/pipeline/fixtures/artifact-feed.a2a.jsonl`

function fixtureLines(): string[] {
  return readFileSync(FIXTURE_PATH, 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
}

/** header · u1 · a1 · u2 · a2 · u3 — the log a live client would hold right after typing "Thanks — that's
 *  helpful." (line index 5, 0-based) — the fixture's OWN tail (a3) is an agent reply, so a golden prefix
 *  for a dispatch-ready log always stops ONE line short of it. */
function goldenPrefix(): string[] {
  return fixtureLines().slice(0, 6)
}

describe('sessionFromFeed — golden fixture (LLD-C7)', () => {
  it('derives a 4-turn session (u1,a1,u2,a2) + a TurnInput intent for the trailing u3', () => {
    const result = sessionFromFeed(goldenPrefix(), { protocolVersion: PROTOCOL_VERSION })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.session.turns).toHaveLength(4)
    expect(result.session.turns[0]).toEqual({ role: 'user', content: 'Show me the Q2 revenue report.' })
    expect(result.session.turns[1]!.role).toBe('assistant')
    expect(result.session.turns[1]!.content).toContain('"createSurface"')
    expect(result.session.turns[2]).toEqual({ role: 'user', content: 'Break revenue down by region.' })
    expect(result.session.turns[3]!.role).toBe('assistant')
    expect(result.input).toEqual({ kind: 'intent', text: "Thanks — that's helpful.", session: result.session })
    expect(result.contextId).toBe('ctx-artifact-feed')
  })

  it('is deterministic: the SAME log run twice yields a deep-equal result', () => {
    const lines = goldenPrefix()
    const first = sessionFromFeed(lines, { protocolVersion: PROTOCOL_VERSION })
    const second = sessionFromFeed(lines, { protocolVersion: PROTOCOL_VERSION })
    expect(second).toEqual(first)
  })

  it('the header line is stripped — a header-less slice of the SAME messages yields the same session', () => {
    const withHeader = sessionFromFeed(goldenPrefix(), { protocolVersion: PROTOCOL_VERSION })
    const withoutHeader = sessionFromFeed(goldenPrefix().slice(1), { protocolVersion: PROTOCOL_VERSION })
    expect(withoutHeader).toEqual(withHeader)
  })

  it('turn 1 (log = header + u1 only): empty session, intent TurnInput carries u1\'s own text', () => {
    const result = sessionFromFeed(fixtureLines().slice(0, 2), { protocolVersion: PROTOCOL_VERSION })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.session.turns).toEqual([])
    expect(result.input).toEqual({ kind: 'intent', text: 'Show me the Q2 revenue report.', session: { turns: [] } })
  })
})

describe('sessionFromFeed — negative controls (coded 400, never a throw; SPEC-R18 AC3)', () => {
  it('a log whose tail is an AGENT message (not user) is rejected', () => {
    const result = sessionFromFeed(fixtureLines(), { protocolVersion: PROTOCOL_VERSION }) // full fixture ends on a3 (agent)
    expect(result).toEqual({ ok: false, status: 400, error: expect.stringContaining('not a user turn') })
  })

  it('a caps-less user tail (metadata.a2uiClientCapabilities stripped) is rejected', () => {
    const lines = goldenPrefix()
    const lastMsg = JSON.parse(lines[lines.length - 1]!) as { metadata?: unknown }
    delete lastMsg.metadata
    const tampered = [...lines.slice(0, -1), JSON.stringify(lastMsg)]
    const result = sessionFromFeed(tampered, { protocolVersion: PROTOCOL_VERSION })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/a2uiClientCapabilities/)
  })

  it('a schema-invalid line (unknown part kind) is rejected before any dispatch-relevant work', () => {
    const lines = goldenPrefix()
    const tampered = [...lines.slice(0, -1), '{"kind":"message","role":"user","messageId":"bad","parts":[{"kind":"bogus"}]}']
    const result = sessionFromFeed(tampered, { protocolVersion: PROTOCOL_VERSION })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/A2A_SCHEMA/)
  })

  it('a wrong-pin line is rejected', () => {
    const lines = goldenPrefix()
    const tampered = [...lines.slice(0, -1), '{"kind":"message","role":"user","protocolVersion":"9.9.9","messageId":"bad","parts":[]}']
    const result = sessionFromFeed(tampered, { protocolVersion: PROTOCOL_VERSION })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/A2A_PIN/)
  })

  it('malformed JSON on a line is rejected, never throws', () => {
    const lines = goldenPrefix()
    const tampered = [...lines.slice(0, -1), '{not json']
    expect(() => sessionFromFeed(tampered, { protocolVersion: PROTOCOL_VERSION })).not.toThrow()
    const result = sessionFromFeed(tampered, { protocolVersion: PROTOCOL_VERSION })
    expect(result.ok).toBe(false)
  })

  it('an empty feed is rejected', () => {
    expect(sessionFromFeed([], { protocolVersion: PROTOCOL_VERSION })).toEqual({
      ok: false,
      status: 400,
      error: 'feed carries no A2A messages',
    })
  })
})
