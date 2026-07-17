// produce-loop.test.ts — LLD-C8 / SPEC-R4 AC1, SPEC-R5, SPEC-R12. The runtime loop's mechanics, gate-covered
// with a STUB AgentProvider (no live model): a first-invalid-then-valid provider proves self-correction (the
// validator's failures are fed back — the stub RECORDS each round's request so we assert the feedback
// reaches the model, not just that a second call happened) and validate-then-stream (only the validated
// payload's lines are ever emitted); an always-invalid provider proves halt-and-report emits NOTHING
// invalid; and a crafted `input.model` proves the trust boundary (opts.model WINS — SPEC-R12).
//
// ADR-0088 §1/§2/§4: a leading `{"a2uiMeta":{"note":…}}` line is peeled BEFORE heal/validate, streamed
// FIRST (composed with a runtime-assembled `TurnTrace`) — never reaching `validateA2ui` — and a note-only
// round (no A2UI lines at all) is a CLEAN success, not a `ProduceHalt`. A provider that never opts into
// the convention (every pre-existing stub above) streams byte-identically to before — zero blast radius.
//
// ADR-0090 §1/§4: `opts.mode` threads straight to `buildSystemPrompt` — proven below by capturing the
// `req.system` string the stub provider actually receives, exactly the way `reqs()[i].model` already
// proves the SPEC-R12 model trust boundary above.

import { describe, it, expect } from 'vitest'
import { produce, ProduceHalt } from '../agent/produce.ts'
import type { ProduceDeps } from '../agent/produce.ts'
import type { AgentProvider, TurnInput } from '../agent/agent-transport.ts'
import { readMetaLine } from '../agent/meta-line.ts'
import { buildSystemPrompt } from '../agent/system-prompt.ts'
import { validateA2ui } from '../renderer/validate.ts'
import { defaultCatalog } from '../catalog/default/index.ts'
import { MINI_SKILLS, DEFAULT_MINI_SKILL_CAP, selectMiniSkills } from '../agent/mini-skills.ts'

// An UNKNOWN component ⇒ CATALOG-invalid (unambiguous, independent of root/surface semantics).
const INVALID =
  '{"version":"v1.0","createSurface":{"surfaceId":"main","catalogId":"agent-ui"}}\n' +
  '{"version":"v1.0","updateComponents":{"surfaceId":"main","components":[{"id":"root","component":"NotARealComponent"}]}}'
// A valid surface: a Button root whose click round-trips a submit action (the canvas-button shape).
const VALID =
  '{"version":"v1.0","createSurface":{"surfaceId":"main","catalogId":"agent-ui"}}\n' +
  '{"version":"v1.0","updateComponents":{"surfaceId":"main","components":[{"id":"root","component":"Button","label":"Hi","action":{"action":"submit"}}]}}'

interface CapturedReq {
  model: string
  messages: { role: string; content: string }[]
}

function stubProvider(outputs: string[]): { provider: AgentProvider; calls: () => number; reqs: () => CapturedReq[] } {
  let n = 0
  const captured: CapturedReq[] = []
  const provider: AgentProvider = {
    async *stream(req) {
      captured.push({ model: req.model, messages: req.messages.map((m) => ({ role: m.role, content: m.content })) })
      const out = outputs[Math.min(n, outputs.length - 1)]!
      n += 1
      yield out
    },
  }
  return { provider, calls: () => n, reqs: () => captured }
}

const intent: TurnInput = { kind: 'intent', text: 'a submit button', session: { turns: [] } }

describe('produce() runtime loop (LLD-C3 / SPEC-R4/R5)', () => {
  it('self-corrects: feeds the validator failure back, then streams ONLY the validated payload', async () => {
    const { provider, calls, reqs } = stubProvider([INVALID, VALID])
    const deps: ProduceDeps = { provider, retrieve: () => [], catalog: defaultCatalog }
    const lines: string[] = []
    for await (const line of produce(intent, deps, { maxRounds: 3 })) lines.push(line)

    expect(calls()).toBe(2) // one invalid round, then the corrected one
    expect(lines).toHaveLength(2) // only the VALID payload's two messages streamed
    expect(lines.join('\n')).not.toContain('NotARealComponent') // no invalid partial ever painted (SPEC-R5)
    expect(validateA2ui(lines.map((l) => JSON.parse(l)), defaultCatalog).valid).toBe(true)

    // The self-correct round MUST carry the feedback (SPEC-R4): the prior INVALID raw as an assistant
    // turn, then a user turn telling the model it was invalid. A regression that dropped the feedback loop
    // (re-sent the bare intent) would still produce 2 calls — so assert the round-2 messages, not just the count.
    const round2 = reqs()[1]!.messages
    expect(round2.some((m) => m.role === 'assistant' && m.content.includes('NotARealComponent'))).toBe(true)
    expect(round2.some((m) => m.role === 'user' && /INVALID/i.test(m.content))).toBe(true)
    expect(round2.length).toBeGreaterThan(reqs()[0]!.messages.length) // round 2 has strictly more turns than round 1
  })

  it('the authoritative opts.model WINS over a client-supplied input.model (SPEC-R12 trust boundary)', async () => {
    // A crafted request sets input.model to something OFF the allowlist; the proxy passes the VALIDATED
    // model as opts.model. The provider must receive the validated model, never the crafted one.
    const crafted: TurnInput = { kind: 'intent', text: 'a submit button', session: { turns: [] }, model: 'ATTACKER-off-allowlist' }
    const { provider, reqs } = stubProvider([VALID])
    const deps: ProduceDeps = { provider, retrieve: () => [], catalog: defaultCatalog }
    const lines: string[] = []
    for await (const line of produce(crafted, deps, { maxRounds: 3, model: 'claude-sonnet-5' })) lines.push(line)

    expect(reqs()[0]!.model).toBe('claude-sonnet-5') // validated model reached the API
    expect(reqs().every((r) => r.model !== 'ATTACKER-off-allowlist')).toBe(true) // crafted value never did
  })

  // ADR-0098: enum-membership is now a VALIDATOR-level CATALOG failure, not just a render-time drop
  // (ADR-0076). `Calendar.mode` is the ADR's own named instance (single/range fork the whole form
  // contract) — a non-member literal must fail validateA2ui and enter the same self-correct loop as
  // any other CATALOG violation, then stream cleanly once corrected.
  it('ADR-0098: a non-member Calendar.mode literal self-corrects through the validator (CATALOG fed back)', async () => {
    const INVALID_ENUM =
      '{"version":"v1.0","createSurface":{"surfaceId":"main","catalogId":"agent-ui"}}\n' +
      '{"version":"v1.0","updateComponents":{"surfaceId":"main","components":[{"id":"root","component":"Calendar","mode":"weekly"}]}}'
    const VALID_ENUM =
      '{"version":"v1.0","createSurface":{"surfaceId":"main","catalogId":"agent-ui"}}\n' +
      '{"version":"v1.0","updateComponents":{"surfaceId":"main","components":[{"id":"root","component":"Calendar","mode":"single"}]}}'
    const { provider, calls, reqs } = stubProvider([INVALID_ENUM, VALID_ENUM])
    const deps: ProduceDeps = { provider, retrieve: () => [], catalog: defaultCatalog }
    const lines: string[] = []
    for await (const line of produce(intent, deps, { maxRounds: 3 })) lines.push(line)

    expect(calls()).toBe(2) // round 1 rejected at the validator, round 2 (corrected) streams
    expect(lines).toHaveLength(2) // only the corrected VALID_ENUM payload's two messages
    expect(lines.join('\n')).not.toContain('weekly') // the non-member literal was never painted (SPEC-R5)
    expect(validateA2ui(lines.map((l) => JSON.parse(l)), defaultCatalog).valid).toBe(true)

    // Round 2 carries the CATALOG failure feedback (path pinpoints the enum-violating prop) — proving
    // enum membership rides the SAME self-correct plumbing as the sibling unknown-type/type-mismatch classes.
    const round2 = reqs()[1]!.messages
    expect(round2.some((m) => m.role === 'assistant' && m.content.includes('weekly'))).toBe(true)
    expect(round2.some((m) => m.role === 'user' && /CATALOG/.test(m.content) && /root\.mode/.test(m.content))).toBe(true)
  })

  it('halts-and-reports at the bound when generation never validates (emits nothing invalid)', async () => {
    const { provider, calls } = stubProvider([INVALID])
    const deps: ProduceDeps = { provider, retrieve: () => [], catalog: defaultCatalog }
    const lines: string[] = []
    let halted: unknown
    try {
      for await (const line of produce(intent, deps, { maxRounds: 3 })) lines.push(line)
    } catch (e) {
      halted = e
    }
    expect(halted).toBeInstanceOf(ProduceHalt)
    expect((halted as ProduceHalt).failures.length).toBeGreaterThan(0)
    expect(lines).toHaveLength(0) // NOTHING invalid was emitted
    expect(calls()).toBe(3) // exhausted the round bound
  })
})

// mkExemplar — a minimal valid CorpusRecord literal (the store.test.ts fixture shape), so `deps.retrieve`
// can return something real and prove the trace's `exemplarIds` are the record's `name`, not invented.
// Deliberately NOT typed against `CorpusRecord` by name (`as const` narrows the literal fields instead):
// this file lives under `src/` and `src/corpus/*` is import-barred from everywhere outside itself
// (ADR-0062's root-barrel purity gate, `corpus/index.test.ts`) — `produce.ts` is `tools/`-scoped so it
// can import the type directly, but this test, under `src/live-agent/`, must not.
function mkExemplar(name: string) {
  return {
    name,
    description: `a sample exemplar named ${name}`,
    promptText: 'build me a button',
    a2uiOutput: [{ version: 'v1.0', createSurface: { surfaceId: 's1', catalogId: 'agent-ui' } }],
    meta: {
      facet: 'exemplar' as const,
      protocolVersion: 'v1.0',
      catalogId: 'agent-ui',
      provenance: { source: 'authored' as const, origin: 'test-fixture' },
      status: 'valid' as const,
    },
  }
}

describe('produce() meta-line + TurnTrace (ADR-0088 §1/§2/§4)', () => {
  it('a note + valid A2UI stub yields the meta-line FIRST, then the validated lines (Acceptance)', async () => {
    const { provider } = stubProvider(['{"a2uiMeta":{"note":"hi"}}\n' + VALID])
    const exemplar = mkExemplar('ex-1')
    const deps: ProduceDeps = { provider, retrieve: () => [exemplar], catalog: defaultCatalog }
    const lines: string[] = []
    for await (const line of produce(intent, deps, { maxRounds: 3, model: 'claude-sonnet-5' })) lines.push(line)

    expect(lines).toHaveLength(3) // meta-line + the two VALID A2UI messages
    const meta = readMetaLine(lines[0]!)
    expect(meta).toBeDefined()
    expect(meta!.a2uiMeta.note).toBe('hi')
    expect(meta!.a2uiMeta.trace).toEqual({
      turnIndex: 0,
      query: { intent: 'a submit button', k: 3 },
      exemplarIds: ['ex-1'],
      rounds: 1,
      healed: 0,
      failureCodes: [],
      model: 'claude-sonnet-5',
    })
    // The two A2UI lines that follow are the SAME validated payload as the no-meta case (byte-identical).
    const a2uiLines = lines.slice(1)
    expect(validateA2ui(a2uiLines.map((l) => JSON.parse(l)), defaultCatalog).valid).toBe(true)
    // Every remaining line is provably NOT a meta-line (never a second wrapper, the wire stays clean).
    for (const l of a2uiLines) expect(readMetaLine(l)).toBeUndefined()
  })

  it('a note-only stub (no A2UI at all) returns cleanly WITHOUT ProduceHalt (Acceptance)', async () => {
    const { provider, calls } = stubProvider(['{"a2uiMeta":{"note":"nothing to change"}}'])
    const deps: ProduceDeps = { provider, retrieve: () => [], catalog: defaultCatalog }
    const lines: string[] = []
    let halted: unknown
    try {
      for await (const line of produce(intent, deps, { maxRounds: 3 })) lines.push(line)
    } catch (e) {
      halted = e
    }
    expect(halted).toBeUndefined() // NOT a ProduceHalt — empty A2UI ≠ invalid (ADR-0088 Consequences)
    expect(calls()).toBe(1) // one round only — no wasted self-correct retries on a clean note-only reply
    expect(lines).toHaveLength(1) // the meta-line ONLY
    const meta = readMetaLine(lines[0]!)
    expect(meta!.a2uiMeta.note).toBe('nothing to change')
    expect(meta!.a2uiMeta.trace!.rounds).toBe(1)
    expect(meta!.a2uiMeta.trace!.healed).toBe(0)
  })

  it('the meta-line never reaches validateA2ui even across a self-correct round (SPEC-N3 wire purity)', async () => {
    // Round 1: note + INVALID A2UI. Round 2 (self-correct): note + VALID A2UI.
    const { provider, calls } = stubProvider([
      '{"a2uiMeta":{"note":"first try"}}\n' + INVALID,
      '{"a2uiMeta":{"note":"fixed it"}}\n' + VALID,
    ])
    const deps: ProduceDeps = { provider, retrieve: () => [], catalog: defaultCatalog }
    const lines: string[] = []
    for await (const line of produce(intent, deps, { maxRounds: 3 })) lines.push(line)

    expect(calls()).toBe(2) // one invalid round, then the corrected one
    const meta = readMetaLine(lines[0]!)
    expect(meta!.a2uiMeta.note).toBe('fixed it') // the round-2 note is the one that ships
    expect(meta!.a2uiMeta.trace!.rounds).toBe(2) // 2 rounds taken
    expect(meta!.a2uiMeta.trace!.failureCodes.length).toBeGreaterThan(0) // round 1's failures were fed back
    // The remaining lines are exactly the validated payload — nothing from the invalid round leaked.
    const a2uiLines = lines.slice(1)
    expect(a2uiLines.join('\n')).not.toContain('NotARealComponent')
    expect(validateA2ui(a2uiLines.map((l) => JSON.parse(l)), defaultCatalog).valid).toBe(true)
  })

  it('a stub that never opts into the note convention streams byte-identically to before (zero blast radius)', async () => {
    const { provider } = stubProvider([VALID])
    const deps: ProduceDeps = { provider, retrieve: () => [], catalog: defaultCatalog }
    const lines: string[] = []
    for await (const line of produce(intent, deps, { maxRounds: 3 })) lines.push(line)
    expect(lines).toHaveLength(2) // no synthesized meta-line when the model never emitted one
    expect(readMetaLine(lines[0]!)).toBeUndefined()
  })

  it('trace.healed counts a REAL form repair, not the always-fires per-line array-wrap', async () => {
    // A trailing comma the healer trims (a genuine repair) vs. the mechanical single-object-envelope
    // wrap every per-line heal() call applies regardless (see assembleFromRaw's doc comment).
    const VALID_WITH_TRAILING_COMMA =
      '{"version":"v1.0","createSurface":{"surfaceId":"main","catalogId":"agent-ui"},}\n' +
      '{"version":"v1.0","updateComponents":{"surfaceId":"main","components":[{"id":"root","component":"Button","label":"Hi","action":{"action":"submit"}}]}}'
    const { provider } = stubProvider(['{"a2uiMeta":{"note":"hi"}}\n' + VALID_WITH_TRAILING_COMMA])
    const deps: ProduceDeps = { provider, retrieve: () => [], catalog: defaultCatalog }
    const lines: string[] = []
    for await (const line of produce(intent, deps, { maxRounds: 3 })) lines.push(line)
    const meta = readMetaLine(lines[0]!)
    expect(meta!.a2uiMeta.trace!.healed).toBe(1) // exactly the one line with the real repair
  })

  it('a leading blank line before the meta-line is still peeled (fix: findIndex over strict first-line)', async () => {
    // A stray leading "\n" (a common model artifact) precedes the meta-line. The OLD peel keyed off
    // `raw.indexOf('\n')` and treated the resulting EMPTY first line as "not a meta-line", so the wrapper
    // fell through to heal/validateA2ui unrecognized — a spurious PARSE/SCHEMA failure even though the
    // A2UI content that follows is perfectly valid. The fix must still peel it as the meta-line.
    const { provider, calls } = stubProvider(['\n{"a2uiMeta":{"note":"hi"}}\n' + VALID])
    const deps: ProduceDeps = { provider, retrieve: () => [], catalog: defaultCatalog }
    const lines: string[] = []
    for await (const line of produce(intent, deps, { maxRounds: 3, model: 'claude-sonnet-5' })) lines.push(line)

    expect(calls()).toBe(1) // no wasted self-correct round — the leading blank line must not defeat the peel
    expect(lines).toHaveLength(3) // meta-line + the two VALID A2UI messages
    const meta = readMetaLine(lines[0]!)
    expect(meta!.a2uiMeta.note).toBe('hi')
    const a2uiLines = lines.slice(1)
    expect(validateA2ui(a2uiLines.map((l) => JSON.parse(l)), defaultCatalog).valid).toBe(true)
  })
})

// mkSystemCapturingProvider — a stub that records the `req.system` string each round actually received,
// so `opts.mode` reaching `buildSystemPrompt` is proven the same way `reqs()[i].model` already proves the
// SPEC-R12 model trust boundary above (ADR-0090 §1/§4).
function mkSystemCapturingProvider(outputs: string[]): { provider: AgentProvider; systems: () => string[] } {
  let n = 0
  const systems: string[] = []
  const provider: AgentProvider = {
    async *stream(req) {
      systems.push(req.system)
      const out = outputs[Math.min(n, outputs.length - 1)]!
      n += 1
      yield out
    },
  }
  return { provider, systems: () => systems }
}

describe('produce() threads opts.mode to buildSystemPrompt (ADR-0090 §1/§4)', () => {
  // `intent` is "a submit button" — its "submit" token now ALSO matches login-form's triggers
  // (ADR-0091 §2 selects mini-skills for every produce() call, mode-independent), so the expected
  // comparison below must include that same selection to stay an exact `Object.is` match — proving
  // `mode` and `miniSkills` compose together correctly, not just that mode alone still threads through.
  const expectedMiniSkills = selectMiniSkills(intent.text, MINI_SKILLS, DEFAULT_MINI_SKILL_CAP)

  it("opts.mode='specific' feeds the specific grammar to the provider", async () => {
    const { provider, systems } = mkSystemCapturingProvider([VALID])
    const deps: ProduceDeps = { provider, retrieve: () => [], catalog: defaultCatalog }
    const lines: string[] = []
    for await (const line of produce(intent, deps, { maxRounds: 3, mode: 'specific' })) lines.push(line)

    expect(lines).toHaveLength(2) // the loop mechanics are unaffected by mode
    expect(systems()).toHaveLength(1)
    expect(systems()[0]).toBe(buildSystemPrompt(defaultCatalog, [], 'specific', expectedMiniSkills)) // exact system string reached the provider
    expect(systems()[0]).toMatch(/dialed DOWN \(specific mode\)/)
  })

  it('an ABSENT opts.mode reproduces the default grammar (zero regression)', async () => {
    const { provider, systems } = mkSystemCapturingProvider([VALID])
    const deps: ProduceDeps = { provider, retrieve: () => [], catalog: defaultCatalog }
    const lines: string[] = []
    for await (const line of produce(intent, deps, { maxRounds: 3 })) lines.push(line)

    expect(systems()[0]).toBe(buildSystemPrompt(defaultCatalog, [], undefined, expectedMiniSkills))
    expect(systems()[0]).not.toMatch(/dialed DOWN|dialed UP/) // no mode-scaled prose leaked in
  })
})

// ── ADR-0091 §2/§5: `produce()` selects mini-skills ONCE per turn, beside `retrieve()` ────────────────

describe('produce() selects mini-skills once per turn (ADR-0091 §2, produce.ts:152-153)', () => {
  it('a query matching a registry entry composes its idiom block into the system prompt the provider receives', async () => {
    const settingsIntent: TurnInput = { kind: 'intent', text: 'build me a settings screen with toggles', session: { turns: [] } }
    const { provider, systems } = mkSystemCapturingProvider([VALID])
    const deps: ProduceDeps = { provider, retrieve: () => [], catalog: defaultCatalog }
    const lines: string[] = []
    for await (const line of produce(settingsIntent, deps, { maxRounds: 3 })) lines.push(line)

    expect(lines).toHaveLength(2) // the loop mechanics are unaffected by the mini-skill selection
    expect(systems()).toHaveLength(1)
    expect(systems()[0]).toContain('## Composition idioms (matched to your request)')
    const settingsSkill = MINI_SKILLS.find((m) => m.id === 'settings-screen')!
    expect(systems()[0]).toContain(settingsSkill.body)
    // Exact match against the same selection+compose path this test independently re-derives.
    const expectedSelection = selectMiniSkills(settingsIntent.text, MINI_SKILLS, DEFAULT_MINI_SKILL_CAP)
    expect(systems()[0]).toBe(buildSystemPrompt(defaultCatalog, [], undefined, expectedSelection))
  })

  it('a query matching no registry entry composes NO mini-skills block (absent/empty selection ⇒ no block)', async () => {
    // Deliberately NOT the shared `intent` fixture ("a submit button") — "submit"/"form" both appear in
    // login-form's triggers, so it would (correctly) select a mini-skill; this negative control needs a
    // turn sharing ZERO vocabulary with every MINI_SKILLS entry's triggers.
    const unrelatedIntent: TurnInput = { kind: 'intent', text: 'show me the weather forecast for tomorrow', session: { turns: [] } }
    expect(selectMiniSkills(unrelatedIntent.text, MINI_SKILLS, DEFAULT_MINI_SKILL_CAP)).toEqual([]) // sanity: genuinely zero overlap

    const { provider, systems } = mkSystemCapturingProvider([VALID])
    const deps: ProduceDeps = { provider, retrieve: () => [], catalog: defaultCatalog }
    const lines: string[] = []
    for await (const line of produce(unrelatedIntent, deps, { maxRounds: 3 })) lines.push(line)

    expect(systems()[0]).not.toContain('## Composition idioms')
    // Byte-identical to the pre-ADR-0091 prompt (slice 4's guarantee), exercised end-to-end here.
    expect(systems()[0]).toBe(buildSystemPrompt(defaultCatalog, []))
  })
})

// ── ADR-0097 §1/§3: feed-embedded ask — peel/compose, ask-integrity degrade, and the FEED_SCOPE self-
// correct gate. Clearly labeled and appended at the tail (concurrency-fenced file — ADR-0098 owns its own
// new describe block elsewhere in this file; this section is ADR-0097's alone). ─────────────────────────

const ASK_VALID =
  '{"version":"v1.0","createSurface":{"surfaceId":"ask-1","catalogId":"agent-ui","sendDataModel":true}}\n' +
  '{"version":"v1.0","updateComponents":{"surfaceId":"ask-1","components":[{"id":"root","component":"Button","label":"Go","action":{"action":"submit"}}]}}'

describe('produce() feed-embedded ask — peel/compose (ADR-0097 §1)', () => {
  it('meta{note,ask} + a payload that creates the ask surface yields the meta-line FIRST with ask intact, then the validated lines', async () => {
    const { provider } = stubProvider(['{"a2uiMeta":{"note":"Ready?","ask":{"surfaceId":"ask-1"}}}\n' + ASK_VALID])
    const deps: ProduceDeps = { provider, retrieve: () => [], catalog: defaultCatalog }
    const lines: string[] = []
    for await (const line of produce(intent, deps, { maxRounds: 3 })) lines.push(line)

    expect(lines).toHaveLength(3) // meta-line + the two ask-surface messages
    const meta = readMetaLine(lines[0]!)
    expect(meta).toBeDefined()
    expect(meta!.a2uiMeta.note).toBe('Ready?')
    expect(meta!.a2uiMeta.ask).toEqual({ surfaceId: 'ask-1' })
    const a2uiLines = lines.slice(1)
    expect(validateA2ui(a2uiLines.map((l) => JSON.parse(l)), defaultCatalog).valid).toBe(true)
  })

  it('an ask declaring a surface NO payload line creates is dropped from the outgoing meta-line — the note stands (never a halt)', async () => {
    // The ask names "ask-1" but the payload only ever creates "main" — ask-integrity fails (no createSurface
    // for "ask-1"), so the ask is silently dropped; the turn still ships cleanly (never a retry, never a halt).
    const { provider, calls } = stubProvider(['{"a2uiMeta":{"note":"hi","ask":{"surfaceId":"ask-1"}}}\n' + VALID])
    const deps: ProduceDeps = { provider, retrieve: () => [], catalog: defaultCatalog }
    const lines: string[] = []
    for await (const line of produce(intent, deps, { maxRounds: 3 })) lines.push(line)

    expect(calls()).toBe(1) // no self-correct round — a dropped ask is a silent degrade, not a retry
    const meta = readMetaLine(lines[0]!)
    expect(meta!.a2uiMeta.note).toBe('hi')
    expect(meta!.a2uiMeta.ask).toBeUndefined()
    expect(lines).toHaveLength(3) // meta-line + VALID's two messages — the payload still ships
  })

  it('an ask colliding with a surface the SESSION already knows about (a prior turn) is dropped — never a halt', async () => {
    const priorSession = {
      turns: [
        { role: 'user' as const, content: 'build something' },
        {
          role: 'assistant' as const,
          content: '{"version":"v1.0","createSurface":{"surfaceId":"ask-1","catalogId":"agent-ui"}}',
        },
      ],
    }
    const collidingIntent: TurnInput = { kind: 'intent', text: 'ask again', session: priorSession }
    const { provider } = stubProvider(['{"a2uiMeta":{"note":"hi","ask":{"surfaceId":"ask-1"}}}\n' + ASK_VALID])
    const deps: ProduceDeps = { provider, retrieve: () => [], catalog: defaultCatalog }
    const lines: string[] = []
    for await (const line of produce(collidingIntent, deps, { maxRounds: 3 })) lines.push(line)

    const meta = readMetaLine(lines[0]!)
    expect(meta!.a2uiMeta.ask).toBeUndefined() // dropped — "ask-1" was already used by an earlier turn
    // The payload itself is untouched — it still streams (the ask is a routing FACT, not the payload).
    expect(lines.length).toBeGreaterThan(1)
  })

  it('a note-only round declaring an ask drops it too — nothing exists yet for it to integrity-check against', async () => {
    const { provider } = stubProvider(['{"a2uiMeta":{"note":"just a question","ask":{"surfaceId":"ask-1"}}}'])
    const deps: ProduceDeps = { provider, retrieve: () => [], catalog: defaultCatalog }
    const lines: string[] = []
    let halted: unknown
    try {
      for await (const line of produce(intent, deps, { maxRounds: 3 })) lines.push(line)
    } catch (e) {
      halted = e
    }
    expect(halted).toBeUndefined() // empty A2UI ≠ invalid (ADR-0088, unaffected)
    expect(lines).toHaveLength(1)
    const meta = readMetaLine(lines[0]!)
    expect(meta!.a2uiMeta.ask).toBeUndefined()
  })

  it('a stub that never authors ask streams byte-identically to before (zero blast radius)', async () => {
    const { provider } = stubProvider(['{"a2uiMeta":{"note":"hi"}}\n' + VALID])
    const deps: ProduceDeps = { provider, retrieve: () => [], catalog: defaultCatalog }
    const lines: string[] = []
    for await (const line of produce(intent, deps, { maxRounds: 3 })) lines.push(line)
    const meta = readMetaLine(lines[0]!)
    expect(meta!.a2uiMeta.ask).toBeUndefined()
    expect(lines).toHaveLength(3)
  })
})

describe('produce() feed-embedded ask — the FEED_SCOPE self-correct gate (ADR-0097 §3 / SPEC-R15)', () => {
  const ASK_OUT_OF_SCOPE =
    '{"version":"v1.0","createSurface":{"surfaceId":"ask-1","catalogId":"agent-ui"}}\n' +
    '{"version":"v1.0","updateComponents":{"surfaceId":"ask-1","components":[{"id":"root","component":"Modal","open":true}]}}'

  it('an ask surface hosting an out-of-scope type (Modal) feeds back FEED_SCOPE + the type, then succeeds on the corrected retry', async () => {
    const { provider, calls, reqs } = stubProvider([
      '{"a2uiMeta":{"note":"pick one","ask":{"surfaceId":"ask-1"}}}\n' + ASK_OUT_OF_SCOPE,
      '{"a2uiMeta":{"note":"pick one","ask":{"surfaceId":"ask-1"}}}\n' + ASK_VALID,
    ])
    const deps: ProduceDeps = { provider, retrieve: () => [], catalog: defaultCatalog }
    const lines: string[] = []
    for await (const line of produce(intent, deps, { maxRounds: 3 })) lines.push(line)

    expect(calls()).toBe(2) // one out-of-scope round, then the corrected one
    const meta = readMetaLine(lines[0]!)
    expect(meta!.a2uiMeta.ask).toEqual({ surfaceId: 'ask-1' }) // the corrected retry's ask survives
    expect(lines.join('\n')).not.toContain('Modal') // the out-of-scope round never streamed

    // The self-correct round's feedback genuinely names FEED_SCOPE + the offending type (Modal) — not
    // just that a second call happened (mirrors the SPEC-R4 self-correct proof pattern above).
    const round2 = reqs()[1]!.messages
    expect(round2.some((m) => m.role === 'user' && /FEED_SCOPE/.test(m.content))).toBe(true)
    expect(round2.some((m) => m.role === 'user' && /Modal/.test(m.content))).toBe(true)
  })

  it('the shared validateA2ui call sites are unchanged — FEED_SCOPE runs strictly AFTER validation passes (SPEC-N3 parity)', async () => {
    // A payload the shared validator would ALREADY reject (an unknown component) must surface as the
    // ordinary CATALOG/SCHEMA failure, never as FEED_SCOPE — proving the gate never runs ahead of, or
    // instead of, the shared validator.
    const { provider, reqs } = stubProvider([
      '{"a2uiMeta":{"note":"x","ask":{"surfaceId":"ask-1"}}}\n' + INVALID,
      '{"a2uiMeta":{"note":"x","ask":{"surfaceId":"ask-1"}}}\n' + ASK_VALID,
    ])
    const deps: ProduceDeps = { provider, retrieve: () => [], catalog: defaultCatalog }
    const lines: string[] = []
    for await (const line of produce(intent, deps, { maxRounds: 3 })) lines.push(line)

    const round2 = reqs()[1]!.messages
    expect(round2.some((m) => m.role === 'user' && /INVALID/.test(m.content) && /CATALOG/.test(m.content))).toBe(true)
    expect(round2.some((m) => m.role === 'user' && /FEED_SCOPE/.test(m.content))).toBe(false)
    expect(lines.length).toBeGreaterThan(0)
  })

  it('an ask surface using ONLY in-scope types never triggers FEED_SCOPE (no spurious self-correct)', async () => {
    const { provider, calls } = stubProvider(['{"a2uiMeta":{"note":"ok","ask":{"surfaceId":"ask-1"}}}\n' + ASK_VALID])
    const deps: ProduceDeps = { provider, retrieve: () => [], catalog: defaultCatalog }
    const lines: string[] = []
    for await (const line of produce(intent, deps, { maxRounds: 3 })) lines.push(line)
    expect(calls()).toBe(1)
    expect(readMetaLine(lines[0]!)!.a2uiMeta.ask).toEqual({ surfaceId: 'ask-1' })
  })

  it('an out-of-scope type on a NON-ask surface (ordinary canvas) is untouched by FEED_SCOPE — the gate only inspects the ask-routed surface', async () => {
    // "main" hosts a Modal (perfectly legal for an ORDINARY canvas surface — SPEC-R9's full allowlist is
    // untouched); the SEPARATE "ask-1" surface hosts only in-scope types. FEED_SCOPE must not fire.
    const mixedPayload =
      '{"version":"v1.0","createSurface":{"surfaceId":"main","catalogId":"agent-ui"}}\n' +
      '{"version":"v1.0","updateComponents":{"surfaceId":"main","components":[{"id":"root","component":"Modal","open":true}]}}\n' +
      ASK_VALID
    const { provider, calls } = stubProvider(['{"a2uiMeta":{"note":"ok","ask":{"surfaceId":"ask-1"}}}\n' + mixedPayload])
    const deps: ProduceDeps = { provider, retrieve: () => [], catalog: defaultCatalog }
    const lines: string[] = []
    for await (const line of produce(intent, deps, { maxRounds: 3 })) lines.push(line)
    expect(calls()).toBe(1) // no FEED_SCOPE round — Modal lives on "main", not the ask surface
    expect(readMetaLine(lines[0]!)!.a2uiMeta.ask).toEqual({ surfaceId: 'ask-1' })
  })
})

// TKT-0081 — session-seeded validation: the per-round validator judges the MERGED cross-turn graph, so
// a follow-up turn's root-resend fails PRE-WIRE (a self-correct round with `sid:root` fed back — the
// renderer's ADR-0128 verdict, minus the shipped client-error round trip it used to cost), and the
// correct update-only follow-up (standalone-invalid before this ticket) streams clean.
describe('produce() — TKT-0081 cross-turn seeded validation', () => {
  const priorAssistant =
    '{"version":"v1.0","createSurface":{"surfaceId":"main","catalogId":"agent-ui"}}\n' +
    '{"version":"v1.0","updateComponents":{"surfaceId":"main","components":[' +
    '{"id":"root","component":"Column","children":["group"]},' +
    '{"id":"group","component":"Column","children":["msg"]},' +
    '{"id":"msg","component":"Text","text":"hello"}]}}'
  const followUp: TurnInput = {
    kind: 'intent',
    text: 'set the message to ready',
    session: {
      turns: [
        { role: 'user', content: 'say hello' },
        { role: 'assistant', content: priorAssistant },
      ],
    },
  }
  // The trap shape live models shipped before this ticket: the FULL tree again, root included.
  const RESEND_ROOT =
    '{"version":"v1.0","updateComponents":{"surfaceId":"main","components":[' +
    '{"id":"root","component":"Column","children":["group"]},' +
    '{"id":"group","component":"Column","children":["msg"]},' +
    '{"id":"msg","component":"Text","text":"ready"}]}}'
  // The correct follow-up: ONLY the changed component — standalone-invalid (root-missing + dangling ref
  // into the prior turn), valid ONLY under the session seed.
  const UPDATE_ONLY = '{"version":"v1.0","updateComponents":{"surfaceId":"main","components":[{"id":"msg","component":"Text","text":"ready"}]}}'

  it('a root-resend follow-up self-corrects PRE-WIRE (sid:root fed back), then the update-only round streams', async () => {
    const { provider, calls, reqs } = stubProvider([RESEND_ROOT, UPDATE_ONLY])
    const deps: ProduceDeps = { provider, retrieve: () => [], catalog: defaultCatalog }
    const lines: string[] = []
    for await (const line of produce(followUp, deps, { maxRounds: 3 })) lines.push(line)

    expect(calls()).toBe(2)
    expect(lines).toEqual([UPDATE_ONLY]) // only the corrected round streamed — the resend never shipped
    const round2 = reqs()[1]!.messages
    expect(round2.some((m) => m.role === 'user' && m.content.includes('main:root'))).toBe(true) // the renderer's verdict, fed back
  })

  it('a correct update-only follow-up streams CLEAN on round 1 (standalone-invalid before this ticket)', async () => {
    const { provider, calls } = stubProvider([UPDATE_ONLY])
    const deps: ProduceDeps = { provider, retrieve: () => [], catalog: defaultCatalog }
    const lines: string[] = []
    for await (const line of produce(followUp, deps, { maxRounds: 3 })) lines.push(line)

    expect(calls()).toBe(1) // zero wasted rounds
    expect(lines).toEqual([UPDATE_ONLY])
  })

  it('a FRESH first turn is unaffected (empty session ⇒ no seed ⇒ the standalone judgment, unchanged)', async () => {
    const { provider, calls } = stubProvider([VALID])
    const deps: ProduceDeps = { provider, retrieve: () => [], catalog: defaultCatalog }
    const lines: string[] = []
    for await (const line of produce(intent, deps, { maxRounds: 3 })) lines.push(line)
    expect(calls()).toBe(1)
    expect(lines).toHaveLength(2)
  })
})
