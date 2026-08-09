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
import { produce, ProduceHalt, SOURCE_ATTACHMENT_CAP } from '../agent/produce.ts'
import type { ProduceDeps } from '../agent/produce.ts'
import type { AgentProvider, TurnInput } from '../agent/agent-transport.ts'
import { readMetaLine } from '../agent/meta-line.ts'
import type { TurnProgress } from '../agent/meta-line.ts'
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

// ── ADR-0146 F1/F3 helpers: a provider that DRIVES onEvent, + progress/content extractors ──────────────
/** A stub provider that drives the ADR-0146 onEvent lifecycle (message_start/block_start before the yield,
 *  an optional thinking delta, block_stop/done after) around each recorded output — proving produce()
 *  composes real provider events into its stage stream, not just its own loop stages. */
function progressStub(outputs: string[], opts?: { thinking?: string }): { provider: AgentProvider; calls: () => number } {
  let n = 0
  const provider: AgentProvider = {
    async *stream(req) {
      req.onEvent?.({ kind: 'message_start' })
      req.onEvent?.({ kind: 'block_start' })
      if (opts?.thinking !== undefined) req.onEvent?.({ kind: 'thinking', text: opts.thinking })
      const out = outputs[Math.min(n, outputs.length - 1)]!
      n += 1
      yield out
      req.onEvent?.({ kind: 'block_stop' })
      req.onEvent?.({ kind: 'done' })
    },
  }
  return { provider, calls: () => n }
}
const isProgress = (l: string): boolean => readMetaLine(l)?.a2uiMeta.progress !== undefined
const progressOf = (lines: string[]): TurnProgress[] =>
  lines.map((l) => readMetaLine(l)?.a2uiMeta.progress).filter((p): p is TurnProgress => p !== undefined)
const isPureContent = (l: string): boolean => readMetaLine(l) === undefined // an A2UI line (no meta wrapper)

describe('produce() interleaved live-turn progress (ADR-0146 F1/F3)', () => {
  it('a stub driving onEvent yields progress meta-lines AS THEY HAPPEN, strictly BEFORE any content line (SPEC-R5 validate-then-stream preserved)', async () => {
    const { provider } = progressStub([VALID])
    const deps: ProduceDeps = { provider, retrieve: () => [], catalog: defaultCatalog }
    const lines: string[] = []
    for await (const line of produce(intent, deps, { maxRounds: 3, progress: true })) lines.push(line)

    // every A2UI content line comes AFTER every progress line (no content precedes validation)
    const firstContent = lines.findIndex(isPureContent)
    const lastProgress = lines.map(isProgress).lastIndexOf(true)
    expect(firstContent).toBeGreaterThan(-1)
    expect(lastProgress).toBeLessThan(firstContent)
    // the content is exactly the validated payload (byte-identical to the no-progress case)
    const content = lines.filter(isPureContent)
    expect(content).toHaveLength(2)
    expect(validateA2ui(content.map((l) => JSON.parse(l)), defaultCatalog).valid).toBe(true)
    // the stage sequence: sent (produce), started (provider), content (produce's pinned first-fragment), validating, done
    expect(progressOf(lines).map((p) => p.stage)).toEqual(['sent', 'started', 'content', 'validating', 'done'])
  })

  it('OFF by default: NO progress lines appear (byte-identical to before) — the note-only/halt guarantee generalized', async () => {
    const { provider } = progressStub([VALID])
    const deps: ProduceDeps = { provider, retrieve: () => [], catalog: defaultCatalog }
    const lines: string[] = []
    for await (const line of produce(intent, deps, { maxRounds: 3 })) lines.push(line) // no progress flag
    expect(lines.some(isProgress)).toBe(false)
    expect(lines).toHaveLength(2)
  })

  it('a self-correct round yields {stage:"retry", round} with the attempt ordinal', async () => {
    const { provider } = progressStub([INVALID, VALID])
    const deps: ProduceDeps = { provider, retrieve: () => [], catalog: defaultCatalog }
    const lines: string[] = []
    for await (const line of produce(intent, deps, { maxRounds: 3, progress: true })) lines.push(line)
    const retry = progressOf(lines).find((p) => p.stage === 'retry')
    expect(retry, 'the self-correct round must announce a retry stage').toBeDefined()
    expect(retry!.round, 'retry carries the attempt ordinal (round 2 = the first self-correct)').toBe(2)
    // content still validate-then-stream: only the corrected payload, nothing from the invalid round
    expect(lines.filter(isPureContent).join('\n')).not.toContain('NotARealComponent')
  })

  it('progressDetail absent ⇒ a reasoning event carries NO detail text (the F3 default, a negative control)', async () => {
    const { provider } = progressStub([VALID], { thinking: 'weighing the layout options' })
    const deps: ProduceDeps = { provider, retrieve: () => [], catalog: defaultCatalog }
    const lines: string[] = []
    for await (const line of produce(intent, deps, { maxRounds: 3, progress: true })) lines.push(line)
    const reasoning = progressOf(lines).find((p) => p.stage === 'reasoning')
    expect(reasoning, 'a thinking delta surfaces a reasoning stage').toBeDefined()
    expect(reasoning!.detail, 'no raw thinking text on the wire by default').toBeUndefined()
  })

  it("progressDetail:'full' forwards a BOUNDED reasoning excerpt (the explicit opt-in)", async () => {
    const longThought = 'x'.repeat(500)
    const { provider } = progressStub([VALID], { thinking: longThought })
    const deps: ProduceDeps = { provider, retrieve: () => [], catalog: defaultCatalog }
    const lines: string[] = []
    for await (const line of produce(intent, deps, { maxRounds: 3, progress: true, progressDetail: 'full' })) lines.push(line)
    const reasoning = progressOf(lines).find((p) => p.stage === 'reasoning')
    expect(reasoning!.detail, 'full forwards the excerpt').toBeDefined()
    expect(reasoning!.detail!.length, 'the excerpt is BOUNDED, never the full 500 chars').toBeLessThanOrEqual(200)
  })

  it('a note-only turn with progress on stays a CLEAN success (semantics byte-unchanged), and OFF is byte-identical', async () => {
    // ON: the note still ships correctly (progress lines surround it, the note itself unchanged)
    const { provider: p1 } = progressStub(['{"a2uiMeta":{"note":"nothing to change"}}'])
    const deps1: ProduceDeps = { provider: p1, retrieve: () => [], catalog: defaultCatalog }
    const on: string[] = []
    for await (const line of produce(intent, deps1, { maxRounds: 3, progress: true })) on.push(line)
    const noteOn = on.filter((l) => readMetaLine(l)?.a2uiMeta.note !== undefined)
    expect(noteOn).toHaveLength(1)
    expect(readMetaLine(noteOn[0]!)!.a2uiMeta.note).toBe('nothing to change')

    // OFF: byte-identical to before progress existed (exactly one line — the note)
    const { provider: p2 } = progressStub(['{"a2uiMeta":{"note":"nothing to change"}}'])
    const deps2: ProduceDeps = { provider: p2, retrieve: () => [], catalog: defaultCatalog }
    const off: string[] = []
    for await (const line of produce(intent, deps2, { maxRounds: 3 })) off.push(line)
    expect(off).toHaveLength(1)
    expect(off.some(isProgress)).toBe(false)
  })

  it('ProduceHalt behaviour is unchanged with progress on (throws, emits no content) — progress lines are not content', async () => {
    const { provider } = progressStub([INVALID])
    const deps: ProduceDeps = { provider, retrieve: () => [], catalog: defaultCatalog }
    const lines: string[] = []
    let halted: unknown
    try {
      for await (const line of produce(intent, deps, { maxRounds: 3, progress: true })) lines.push(line)
    } catch (e) {
      halted = e
    }
    expect(halted).toBeInstanceOf(ProduceHalt)
    expect(lines.filter(isPureContent), 'NOTHING invalid (no content) was emitted').toHaveLength(0)
  })
})

// ── GH #290 fix: progress delivery decoupled from a WITHHELD-TEXT tool round ──────────────────────────
// anthropic.ts's GH #49 tool loop withholds ALL text until a round completes without requesting more
// tools — but its onEvent('tool') pushes fire in real time. Before the fix, produce()'s `for await` only
// drained its pending-progress queue between TEXT fragments, so a whole tool round's progress sat buffered
// until the round's text finally arrived (Kim's live repro: one chunk at t=0, 20s of silence, one 2.7KB
// burst at t=20.3s). This stub reproduces the withholding shape directly (onEvent, THEN a real delay,
// THEN — only after BOTH delays — the round's text), proving the fix without needing anthropic.ts's own
// internal tool-loop plumbing.
describe('produce() interleaves progress across a text-withholding round (GH #290 fix)', () => {
  it('tool events surface AS THEY HAPPEN, separated by real time — not bursted together right before the round text', async () => {
    const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))
    const ROUND_DELAY_MS = 60
    const provider: AgentProvider = {
      async *stream(req) {
        req.onEvent?.({ kind: 'message_start' })
        req.onEvent?.({ kind: 'tool', text: 'checkInHours' })
        await delay(ROUND_DELAY_MS) // simulates the withheld round's OWN network/tool-exec latency
        req.onEvent?.({ kind: 'tool', text: 'roomAvailability' })
        await delay(ROUND_DELAY_MS) // a SECOND withheld round — proves it's not just "first vs last"
        yield VALID // the adapter's text only arrives once every round is done (GH #49's intentional buffer)
      },
    }
    const deps: ProduceDeps = { provider, retrieve: () => [], catalog: defaultCatalog }
    const t0 = Date.now()
    const stamped: { stage: string; t: number }[] = []
    for await (const line of produce(intent, deps, { maxRounds: 3, progress: true })) {
      const p = readMetaLine(line)?.a2uiMeta.progress
      if (p !== undefined) stamped.push({ stage: p.stage, t: Date.now() - t0 })
    }
    const [tool1, tool2] = stamped.filter((s) => s.stage === 'tool')
    const content = stamped.find((s) => s.stage === 'content')!

    expect(tool1, 'the first tool event must surface').toBeDefined()
    expect(tool2, 'the second tool event must surface').toBeDefined()
    // the FIRST tool event arrives essentially immediately (pushed before either delay starts) — the
    // pre-fix bug would instead hold it until `content`, ~2×ROUND_DELAY_MS later.
    expect(tool1!.t).toBeLessThan(ROUND_DELAY_MS / 2)
    // the SECOND tool event arrives after the first delay has elapsed but well before the second one has —
    // i.e. it is delivered mid-flight, not bunched with tool1 or with content.
    expect(tool2!.t).toBeGreaterThanOrEqual(ROUND_DELAY_MS * 0.7)
    expect(tool2!.t).toBeLessThan(ROUND_DELAY_MS * 1.5)
    // content (the round's text) only arrives after BOTH delays — and materially later than tool2, proving
    // the two tool events were NOT bursted together right before it (the bug's exact signature).
    expect(content.t).toBeGreaterThanOrEqual(ROUND_DELAY_MS * 1.7)
    expect(content.t - tool2!.t).toBeGreaterThanOrEqual(ROUND_DELAY_MS * 0.7)
  })
})

// ── GH #240/ADR-0159 wave B: the per-step raw-source attachment (progressDetail:'source') ────────────────
describe("produce() raw-source attachments (GH #240/ADR-0159 wave B — progressDetail:'source')", () => {
  it("'source' attaches the EXACT candidate wire lines to the validating event (byte compare)", async () => {
    const { provider } = progressStub([VALID])
    const deps: ProduceDeps = { provider, retrieve: () => [], catalog: defaultCatalog }
    const lines: string[] = []
    for await (const line of produce(intent, deps, { maxRounds: 3, progress: true, progressDetail: 'source' })) lines.push(line)
    const validating = progressOf(lines).find((p) => p.stage === 'validating')
    expect(validating, 'the validating stage fires').toBeDefined()
    // byte-for-byte: the attachment IS the peeled, fence-stripped candidate — here the raw VALID JSONL itself
    expect(validating!.source).toBe(VALID)
  })

  it('the privacy gate is fail-closed END-TO-END: the default rung attaches NO source to ANY event', async () => {
    const { provider } = progressStub([INVALID, VALID], { thinking: 'raw chain of thought' })
    const deps: ProduceDeps = { provider, retrieve: () => [], catalog: defaultCatalog }
    const lines: string[] = []
    for await (const line of produce(intent, deps, { maxRounds: 3, progress: true })) lines.push(line) // no progressDetail
    const events = progressOf(lines)
    expect(events.length).toBeGreaterThan(0)
    expect(events.every((p) => p.source === undefined), 'no raw wire line rides any default-rung event').toBe(true)
  })

  it("'full' does NOT imply 'source' — the two disclosures are independent opt-ins (a negative control)", async () => {
    const { provider } = progressStub([VALID], { thinking: 'raw chain of thought' })
    const deps: ProduceDeps = { provider, retrieve: () => [], catalog: defaultCatalog }
    const lines: string[] = []
    for await (const line of produce(intent, deps, { maxRounds: 3, progress: true, progressDetail: 'full' })) lines.push(line)
    expect(progressOf(lines).every((p) => p.source === undefined), "'full' unlocks reasoning excerpts, never wire lines").toBe(true)
  })

  it("…and symmetrically, 'source' does NOT unlock reasoning excerpts (no CoT on the wire)", async () => {
    const { provider } = progressStub([VALID], { thinking: 'raw chain of thought' })
    const deps: ProduceDeps = { provider, retrieve: () => [], catalog: defaultCatalog }
    const lines: string[] = []
    for await (const line of produce(intent, deps, { maxRounds: 3, progress: true, progressDetail: 'source' })) lines.push(line)
    const reasoning = progressOf(lines).find((p) => p.stage === 'reasoning')
    expect(reasoning, 'the reasoning TRANSITION still fires (the stages posture)').toBeDefined()
    expect(reasoning!.detail, 'no thinking text crosses the wire under source').toBeUndefined()
    expect(lines.join('\n')).not.toContain('raw chain of thought')
  })

  it("a self-correct round's retry event carries the FAILED round's candidate (otherwise never on the wire)", async () => {
    const { provider } = progressStub([INVALID, VALID])
    const deps: ProduceDeps = { provider, retrieve: () => [], catalog: defaultCatalog }
    const lines: string[] = []
    for await (const line of produce(intent, deps, { maxRounds: 3, progress: true, progressDetail: 'source' })) lines.push(line)
    const retry = progressOf(lines).find((p) => p.stage === 'retry')
    expect(retry).toBeDefined()
    expect(retry!.source, "the invalid attempt IS the retry's source, byte-for-byte").toBe(INVALID)
    // validate-then-stream is untouched: the invalid text rides ONLY the meta channel, never a content line
    expect(lines.filter(isPureContent).join('\n')).not.toContain('NotARealComponent')
  })

  it('the note is NEVER part of an attachment (peeled before the candidate is taken)', async () => {
    const withNote = '{"a2uiMeta":{"note":"here is your button"}}\n' + VALID
    const { provider } = progressStub([withNote])
    const deps: ProduceDeps = { provider, retrieve: () => [], catalog: defaultCatalog }
    const lines: string[] = []
    for await (const line of produce(intent, deps, { maxRounds: 3, progress: true, progressDetail: 'source' })) lines.push(line)
    const validating = progressOf(lines).find((p) => p.stage === 'validating')
    expect(validating!.source).toBe(VALID)
    expect(validating!.source).not.toContain('here is your button')
  })

  it('a note-only turn attaches nothing (no candidate ⇒ no source key at all)', async () => {
    const { provider } = progressStub(['{"a2uiMeta":{"note":"nothing to change"}}'])
    const deps: ProduceDeps = { provider, retrieve: () => [], catalog: defaultCatalog }
    const lines: string[] = []
    for await (const line of produce(intent, deps, { maxRounds: 3, progress: true, progressDetail: 'source' })) lines.push(line)
    expect(progressOf(lines).every((p) => p.source === undefined)).toBe(true)
  })

  it('the size-cap boundary: ≤ SOURCE_ATTACHMENT_CAP passes untouched; over it is sliced + explicitly marked', async () => {
    // AT the cap: a candidate exactly SOURCE_ATTACHMENT_CAP chars long crosses byte-identically.
    // (An unknown component is fine — the attachment is taken BEFORE validation; the turn itself halts.)
    const pad = (n: number): string => {
      const shell = '{"version":"v1.0","createSurface":{"surfaceId":"main","catalogId":"'
      return `${shell}${'x'.repeat(n - shell.length - 3)}"}}`
    }
    const atCap = pad(SOURCE_ATTACHMENT_CAP)
    expect(atCap.length).toBe(SOURCE_ATTACHMENT_CAP)
    const { provider: pAt } = progressStub([atCap])
    const at: string[] = []
    try {
      for await (const line of produce(intent, { provider: pAt, retrieve: () => [], catalog: defaultCatalog }, { maxRounds: 1, progress: true, progressDetail: 'source' })) at.push(line)
    } catch { /* ProduceHalt — the attachment was already yielded */ }
    const atEvent = progressOf(at).find((p) => p.stage === 'validating')
    expect(atEvent!.source, 'at the cap: byte-identical, no marker').toBe(atCap)

    // OVER the cap: sliced to the cap + the explicit truncation marker (never a silent cut).
    const overCap = pad(SOURCE_ATTACHMENT_CAP + 100)
    const { provider: pOver } = progressStub([overCap])
    const over: string[] = []
    try {
      for await (const line of produce(intent, { provider: pOver, retrieve: () => [], catalog: defaultCatalog }, { maxRounds: 1, progress: true, progressDetail: 'source' })) over.push(line)
    } catch { /* ProduceHalt */ }
    const overEvent = progressOf(over).find((p) => p.stage === 'validating')
    expect(overEvent!.source!.startsWith(overCap.slice(0, SOURCE_ATTACHMENT_CAP))).toBe(true)
    expect(overEvent!.source!.endsWith('… [truncated]'), 'a capped attachment says so explicitly').toBe(true)
    expect(overEvent!.source!.length).toBe(SOURCE_ATTACHMENT_CAP + '\n… [truncated]'.length)
  })
})

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

    // GH #174: the feedback must ALSO pin the note's audience — the meta-line `note` (ADR-0088 §1) is the
    // user-visible chat reply, and without this instruction a compliant model narrates the correction IN
    // the note ("Re-emitting the corrected, validated JSONL…", observed live). The STRING content is what
    // is unit-testable here; model compliance is not.
    const feedback = round2.find((m) => m.role === 'user' && /INVALID/i.test(m.content))!
    expect(feedback.content).toMatch(/"note" must still address the USER in persona/)
    expect(feedback.content).toMatch(/never mention this correction/)
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
    // GH #288 (root-caused by #286) — the feedback now ALSO teaches the expected shape, not just
    // "CATALOG at root.mode": resolved from `Calendar.mode`'s declared enum via the round's own parsed
    // output, so a repeated identical wrong guess (the #286 live-repro symptom) has a constraint to act on.
    expect(round2.some((m) => m.role === 'user' && /root\.mode \(expected: single\|range\)/.test(m.content))).toBe(true)
  })

  // GH #288 — the SAME self-correct plumbing, isolated to just the feedback-shape lever: a resolvable
  // CATALOG failure (component + property both catalog-declared) appends "(expected: …)"; an
  // UNRESOLVABLE one (unknown component type — SPEC-R9, no PropDef to describe) degrades to the
  // pre-existing "CODE at path" wording, unchanged — the resolver's declared degrade path, not a guess.
  it('GH #288: messagesFor resolves "(expected: …)" for a resolvable CATALOG failure, and degrades cleanly when unresolvable', async () => {
    const INVALID_TEXT_EMPHASIS =
      '{"version":"v1.0","createSurface":{"surfaceId":"main","catalogId":"agent-ui"}}\n' +
      '{"version":"v1.0","updateComponents":{"surfaceId":"main","components":[{"id":"root","component":"Text","text":"hi","emphasis":"bold"}]}}'
    const VALID_TEXT_EMPHASIS =
      '{"version":"v1.0","createSurface":{"surfaceId":"main","catalogId":"agent-ui"}}\n' +
      '{"version":"v1.0","updateComponents":{"surfaceId":"main","components":[{"id":"root","component":"Text","text":"hi","emphasis":true}]}}'
    const { provider, calls, reqs } = stubProvider([INVALID_TEXT_EMPHASIS, VALID_TEXT_EMPHASIS])
    const deps: ProduceDeps = { provider, retrieve: () => [], catalog: defaultCatalog }
    const lines: string[] = []
    for await (const line of produce(intent, deps, { maxRounds: 3 })) lines.push(line)

    expect(calls()).toBe(2)
    expect(lines.join('\n')).not.toContain('"bold"') // the invalid string value never painted
    const round2 = reqs()[1]!.messages
    const feedback = round2.find((m) => m.role === 'user' && /INVALID/.test(m.content))!
    expect(feedback.content).toMatch(/CATALOG at root\.emphasis \(expected: boolean\)/)

    // Unresolvable case (unknown component — no PropDef exists to describe): the SAME "CODE at path"
    // wording as before this fix, with no dangling/garbled "(expected: …)" tacked on.
    const { provider: p2, reqs: reqs2 } = stubProvider([INVALID, VALID])
    const deps2: ProduceDeps = { provider: p2, retrieve: () => [], catalog: defaultCatalog }
    for await (const _line of produce(intent, deps2, { maxRounds: 3 })) void _line
    const round2b = reqs2()[1]!.messages
    const feedback2 = round2b.find((m) => m.role === 'user' && /INVALID/.test(m.content))!
    expect(feedback2.content).toContain('CATALOG at root')
    expect(feedback2.content).not.toContain('(expected:')
  })

  // GH #286/#288 follow-up (2): a numeric-spelled string enum (Card.elevation) rendered unquoted was
  // indistinguishable from a number type, so the model kept guessing the bare number `1` instead of the
  // required string `"1"` — the residual live miss behind #288's post-fix re-verification. The feedback
  // must now teach the QUOTED members so the constraint is unambiguous.
  it('GH #286/#288 follow-up: an elevation-style numeric-spelled enum miss teaches quoted members', async () => {
    const INVALID_ELEVATION =
      '{"version":"v1.0","createSurface":{"surfaceId":"main","catalogId":"agent-ui"}}\n' +
      '{"version":"v1.0","updateComponents":{"surfaceId":"main","components":[{"id":"root","component":"Card","elevation":1}]}}'
    const VALID_ELEVATION =
      '{"version":"v1.0","createSurface":{"surfaceId":"main","catalogId":"agent-ui"}}\n' +
      '{"version":"v1.0","updateComponents":{"surfaceId":"main","components":[{"id":"root","component":"Card","elevation":"1"}]}}'
    const { provider, calls, reqs } = stubProvider([INVALID_ELEVATION, VALID_ELEVATION])
    const deps: ProduceDeps = { provider, retrieve: () => [], catalog: defaultCatalog }
    const lines: string[] = []
    for await (const line of produce(intent, deps, { maxRounds: 3 })) lines.push(line)

    expect(calls()).toBe(2)
    const round2 = reqs()[1]!.messages
    const feedback = round2.find((m) => m.role === 'user' && /INVALID/.test(m.content))!
    expect(feedback.content).toMatch(/CATALOG at root\.elevation \(expected: "-3"\|"-2"\|"-1"\|"0"\|"1"\|"2"\|"3"\)/)
  })

  // GH #397 — a live CATALOG halt: the model emitted `gap` on `CardContent` (a property `Row`/`Column`
  // declare but `CardContent` does not — its interior child rhythm is a component-owned fixed default,
  // ADR-0102 Lane A, card.css's `--ui-card-content-gap`). Before this fix, an UNKNOWN-PROPERTY CATALOG
  // failure (component found, but `propName` has no PropDef) degraded to the bare "CATALOG at path"
  // wording — same "WHERE but not WHAT" gap #288 closed for type-mismatch misses, just the sibling
  // degrade branch. The feedback now names the component's actual valid property set, so a repeated
  // wrong guess (the #286/#288/#307 live-repro pattern) has a concrete alternative to act on.
  it('GH #397: an unknown-property CATALOG miss teaches the component\'s actual valid properties', async () => {
    const INVALID_CARDCONTENT_GAP =
      '{"version":"v1.0","createSurface":{"surfaceId":"main","catalogId":"agent-ui"}}\n' +
      '{"version":"v1.0","updateComponents":{"surfaceId":"main","components":[{"id":"root","component":"CardContent","gap":"sm"}]}}'
    const VALID_CARDCONTENT =
      '{"version":"v1.0","createSurface":{"surfaceId":"main","catalogId":"agent-ui"}}\n' +
      '{"version":"v1.0","updateComponents":{"surfaceId":"main","components":[{"id":"root","component":"CardContent","scrollable":true}]}}'
    const { provider, calls, reqs } = stubProvider([INVALID_CARDCONTENT_GAP, VALID_CARDCONTENT])
    const deps: ProduceDeps = { provider, retrieve: () => [], catalog: defaultCatalog }
    const lines: string[] = []
    for await (const line of produce(intent, deps, { maxRounds: 3 })) lines.push(line)

    expect(calls()).toBe(2)
    const round2 = reqs()[1]!.messages
    const feedback = round2.find((m) => m.role === 'user' && /INVALID/.test(m.content))!
    expect(feedback.content).toMatch(/CATALOG at root\.gap \(CardContent has no "gap" property; valid properties: scrollable\)/)
  })

  // GH #307 investigation — a PARSE failure (assembleFromRaw's per-line split handed an unparseable
  // fragment) carried NO diagnostic detail; live reproduction (the quiz persona's game loop) caught a
  // real model repeating the SAME mistake — a single JSON message pretty-printed across several physical
  // lines — round after round, because the feedback never named the constraint it violated. The
  // self-correct message must now restate the "one message, one line, nothing after the JSONL" rule
  // whenever a PARSE failure fires, and must NOT append it for a non-PARSE (e.g. CATALOG-only) failure.
  it('GH #307: a PARSE failure appends the single-line-JSON reminder; a CATALOG-only failure does not', async () => {
    // A message split across physical lines: assembleFromRaw's per-line split hands the healer an
    // unparseable fragment on line 2 (the array's own continuation), exactly the live-reproduced shape.
    const MULTILINE =
      '{"version":"v1.0","createSurface":{"surfaceId":"main","catalogId":"agent-ui"}}\n' +
      '{"version":"v1.0","updateComponents":{"surfaceId":"main","components":[\n' +
      '{"id":"root","component":"Button","label":"Hi","action":{"action":"submit"}}\n' +
      ']}}'
    const { provider, calls, reqs } = stubProvider([MULTILINE, VALID])
    const deps: ProduceDeps = { provider, retrieve: () => [], catalog: defaultCatalog }
    const lines: string[] = []
    for await (const line of produce(intent, deps, { maxRounds: 3 })) lines.push(line)

    expect(calls()).toBe(2) // round 1 (PARSE) → round 2 (corrected) streams
    const round2 = reqs()[1]!.messages
    const feedback = round2.find((m) => m.role === 'user' && /INVALID/.test(m.content))!
    expect(feedback.content).toMatch(/PARSE/)
    expect(feedback.content).toMatch(/SINGLE line/)
    expect(feedback.content).toMatch(/never add any text after/)

    // Negative control: a CATALOG-only failure (no PARSE among this round's failures) carries no hint.
    const { provider: p2, reqs: reqs2 } = stubProvider([INVALID, VALID])
    const deps2: ProduceDeps = { provider: p2, retrieve: () => [], catalog: defaultCatalog }
    for await (const _line of produce(intent, deps2, { maxRounds: 3 })) void _line
    const round2b = reqs2()[1]!.messages
    const feedback2 = round2b.find((m) => m.role === 'user' && /INVALID/.test(m.content))!
    expect(feedback2.content).not.toMatch(/SINGLE line/)
  })

  // GH #404 (live observation, `.claude/ops/mb-live-proof/box2-quizmaster-FAIL.json`) — a real quizmaster
  // session (haiku-4.5 @ 0.9) appended a literal trailing `</parameter>` line after an otherwise-valid
  // payload — tool-call/XML closing-tag bleed-through — and repeated the SAME mistake across all 3 retry
  // rounds, halting on PARSE. The fix stays in the hint lane (ADR-0102 lane 3): the PARSE retry now names
  // the concrete output-shape contract — NDJSON payload lines ONLY, no XML/tool closing tags, no prose,
  // no code fences — never touching the validator, the peel logic, or the round budget.
  it('GH #404: a PARSE failure from a trailing tool/XML closing tag carries the NDJSON-lines-only instruction', async () => {
    const TRAILING_CLOSING_TAG = `${VALID}\n</parameter>`
    const { provider, calls, reqs } = stubProvider([TRAILING_CLOSING_TAG, VALID])
    const deps: ProduceDeps = { provider, retrieve: () => [], catalog: defaultCatalog }
    const lines: string[] = []
    for await (const line of produce(intent, deps, { maxRounds: 3 })) lines.push(line)

    expect(calls()).toBe(2) // round 1 (PARSE) → round 2 (corrected) streams
    const round2 = reqs()[1]!.messages
    const feedback = round2.find((m) => m.role === 'user' && /INVALID/.test(m.content))!
    expect(feedback.content).toMatch(/PARSE/)
    expect(feedback.content).toMatch(/NDJSON payload lines/)
    expect(feedback.content).toMatch(/tool-call closing tag/)
    expect(feedback.content).toMatch(/code fence/)
  })

  // GH #307 (second pass — static root-cause of the IDGRAPH class the first pass could not reproduce
  // live). A RESUMED surface (the TKT-0079/ADR-0129 action-click path, and the quizmaster preset's
  // declared "one quiz = one surface, updated round by round") is seeded by `sessionSurfaceSeeds`
  // (TKT-0081) with the prior turn's graph, so re-delivering `id:"root"` fails HERE as `sid:root` —
  // exactly the renderer's own cross-turn guard (tree.ts's SPEC-R3 AC2, which keeps the OLD root and
  // silently drops the change). The seeding is correct; the FEEDBACK was not: `IDGRAPH at main:root`
  // names a location and nothing else, while the fixed instruction that follows it — "Re-emit the
  // COMPLETE corrected A2UI JSONL" — reads on a resumed surface as "send the whole tree again", which
  // re-delivers `root` and reproduces the very failure. These cases pin the mechanism (a real 3-round
  // IDGRAPH halt), the two-member SEQUENCE that makes the un-hinted feedback self-defeating rather than
  // merely uninformative, the per-member hints that now teach the way out, and (review F2) the seed reset
  // the escape hatch those hints recommend depends on.
  //
  // Only a node appended under `root` ITSELF forces the resend — a node under any other container patches
  // that container harmlessly. The preset prescribes components, never a tree shape, so this is a shape a
  // long-lived surface CAN force, not one it must (grammar.md:86-88 teaches the wrapper-child prophylaxis
  // that avoids it).
  const QUIZ_TURN1 =
    '{"version":"v1.0","createSurface":{"surfaceId":"main","catalogId":"agent-ui"}}\n' +
    '{"version":"v1.0","updateComponents":{"surfaceId":"main","components":[' +
    '{"id":"root","component":"Column","children":["q","go"]},' +
    '{"id":"q","component":"Text","text":"Q1: capital of France?"},' +
    '{"id":"go","component":"Button","label":"Answer","action":{"action":"answer"}}' +
    ']}}'
  // The turn a click produces: the SAME session the browser holds (admin-live-runner.ts appends the
  // validated JSONL verbatim as the assistant turn), resumed by `nextTurn` with the action message.
  const resumedClick: TurnInput = {
    kind: 'client',
    session: { turns: [{ role: 'user', content: 'start a quiz' }, { role: 'assistant', content: QUIZ_TURN1 }] },
    message: {
      version: 'v1.0',
      action: { surfaceId: 'main', actionId: 'a1', name: 'answer', sourceComponentId: 'go', timestamp: '0', context: {} },
    },
  }
  // Appending a node under `root` forces root's OWN children to change — the one shape that cannot be
  // patched, and the shape a "re-render the whole surface" habit produces every round.
  const ROOT_RESEND =
    '{"a2uiMeta":{"note":"Correct! Here is why."}}\n' +
    '{"version":"v1.0","updateComponents":{"surfaceId":"main","components":[' +
    '{"id":"root","component":"Column","children":["q","go","expl"]},' +
    '{"id":"expl","component":"Text","text":"Paris has been the capital since 987."}' +
    ']}}'
  // The OTHER member: re-creating the surface (which starts it EMPTY — validate.ts's `createdHere`) while
  // sending only a partial tree. This is the shape a model reaches for once it has been told not to resend
  // `root` — half-following the re-create advice without the "COMPLETE tree" half.
  const RECREATE_PARTIAL =
    '{"a2uiMeta":{"note":"Round two!"}}\n' +
    '{"version":"v1.0","createSurface":{"surfaceId":"main","catalogId":"agent-ui"}}\n' +
    '{"version":"v1.0","updateComponents":{"surfaceId":"main","components":[{"id":"q","component":"Text","text":"Q2?"}]}}'

  it('GH #307: re-delivering root on a RESUMED surface halts on IDGRAPH main:root (the game-loop failure)', async () => {
    const { provider, calls } = stubProvider([ROOT_RESEND])
    const deps: ProduceDeps = { provider, retrieve: () => [], catalog: defaultCatalog }
    const lines: string[] = []
    let halted: unknown
    try {
      for await (const line of produce(resumedClick, deps, { maxRounds: 3 })) lines.push(line)
    } catch (e) {
      halted = e
    }
    expect(halted).toBeInstanceOf(ProduceHalt)
    // The MEMBER, not just the code — `sid:root` (a duplicate root), never `root-missing`.
    expect((halted as ProduceHalt).failures).toEqual([{ code: 'IDGRAPH', path: 'main:root' }])
    // GH #307 (f.path surfacing): the halt text now names the MEMBER, not just the bare code — the
    // whole point being a future report can self-diagnose without re-instrumenting the loop.
    expect((halted as ProduceHalt).message).toContain('(IDGRAPH at main:root)')
    expect(calls()).toBe(3) // every round of the bound burned on the same id-graph defect
    expect(lines).toHaveLength(0)

    // The update-only counterpart of the SAME turn is valid — proof the seed covers this resume path and
    // that the halt above is the root-resend specifically, not a seeding gap.
    const UPDATE_ONLY =
      '{"a2uiMeta":{"note":"Correct!"}}\n' +
      '{"version":"v1.0","updateComponents":{"surfaceId":"main","components":[{"id":"q","component":"Text","text":"Q2?"}]}}'
    const { provider: p2, calls: calls2 } = stubProvider([UPDATE_ONLY])
    const deps2: ProduceDeps = { provider: p2, retrieve: () => [], catalog: defaultCatalog }
    const okLines: string[] = []
    for await (const line of produce(resumedClick, deps2, { maxRounds: 3 })) okLines.push(line)
    expect(calls2()).toBe(1) // first round validates — no self-correct needed
    expect(okLines).toHaveLength(2) // the meta-line + the one updateComponents message
  })

  // Review F3 — the SEQUENCE, not just each member alone. This is the load-bearing half of the story: it
  // is what makes the un-hinted feedback SELF-DEFEATING rather than merely uninformative. Round 1 resends
  // root (`main:root`); told only "IDGRAPH at main:root", the model re-creates the surface but sends a
  // partial tree (`main:root-missing`); told only "IDGRAPH at main:root-missing", it puts `root` back and
  // drops the `createSurface` — round 1 again. Three rounds, two members chasing each other, turn dead.
  // (`stubProvider` repeats its LAST output once exhausted, so this needs all three scripted explicitly.)
  it('GH #307: the two IDGRAPH members CHAIN across rounds — main:root → main:root-missing → main:root → halt', async () => {
    const { provider, calls, reqs } = stubProvider([ROOT_RESEND, RECREATE_PARTIAL, ROOT_RESEND])
    const deps: ProduceDeps = { provider, retrieve: () => [], catalog: defaultCatalog }
    let halted: unknown
    const lines: string[] = []
    try {
      for await (const line of produce(resumedClick, deps, { maxRounds: 3 })) lines.push(line)
    } catch (e) {
      halted = e
    }
    expect(calls()).toBe(3)
    expect(lines).toHaveLength(0)
    expect((halted as ProduceHalt).failures).toEqual([{ code: 'IDGRAPH', path: 'main:root' }])

    // Round 2 was fed round 1's DUPLICATE-root failure; round 3 was fed round 2's ROOT-MISSING failure.
    // `\)` pins the end of the summary — `main:root-missing` also starts with `main:root`.
    const fed = (i: number) => reqs()[i]!.messages.find((m) => m.role === 'user' && /INVALID/.test(m.content))!.content
    expect(fed(1)).toMatch(/INVALID \(IDGRAPH at main:root\)/)
    expect(fed(2)).toMatch(/INVALID \(IDGRAPH at main:root-missing\)/)
    // …and each round's feedback now carries the repair for the member THAT round actually hit — the
    // chain is still a chain, but no longer an unlit one.
    expect(fed(1)).toMatch(/re-create the surface/)
    expect(fed(2)).toMatch(/send only the changed components/)
  })

  it('GH #307: the IDGRAPH feedback names the REPAIR per member (duplicate root / root-missing), not just the path', async () => {
    const { provider, reqs } = stubProvider([ROOT_RESEND])
    const deps: ProduceDeps = { provider, retrieve: () => [], catalog: defaultCatalog }
    await expect(async () => {
      for await (const _l of produce(resumedClick, deps, { maxRounds: 2 })) void _l
    }).rejects.toBeInstanceOf(ProduceHalt)
    const feedback = reqs()[1]!.messages.find((m) => m.role === 'user' && /INVALID/.test(m.content))!
    expect(feedback.content).toMatch(/IDGRAPH at main:root/)
    expect(feedback.content).toMatch(/already received its ONE `id:"root"` in an EARLIER turn/)
    expect(feedback.content).toMatch(/re-create the surface/)
    expect(feedback.content).not.toMatch(/has NO `id:"root"`/) // the other member's hint must NOT ride along

    // Review F1 — the ORDER is load-bearing, not cosmetic. `sid:root` fires only because the payload
    // CONTAINED `id:"root"`, i.e. the model was trying to change root; leading with "send only what
    // changed, without root" invites a compliant round that ships the new node UNPARENTED, and
    // `checkIdGraph` has no orphan/reachability check — that round VALIDATES and streams, trading a loud
    // halt for a silent under-render. So the re-create branch must come FIRST, and the conditional
    // "send only what changed" arm must carry the reachability warning.
    const recreateAt = feedback.content.indexOf('re-create the surface')
    const partialAt = feedback.content.indexOf('send only the components that actually changed')
    expect(recreateAt).toBeGreaterThan(-1)
    expect(partialAt).toBeGreaterThan(-1)
    expect(recreateAt).toBeLessThan(partialAt)
    expect(feedback.content).toMatch(/must be reachable from `root`/)
    expect(feedback.content).toMatch(/silently never render/)

    // The root-missing member gets the OTHER repair instruction.
    const { provider: p2, reqs: reqs2 } = stubProvider([RECREATE_PARTIAL])
    const deps2: ProduceDeps = { provider: p2, retrieve: () => [], catalog: defaultCatalog }
    await expect(async () => {
      for await (const _l of produce(resumedClick, deps2, { maxRounds: 2 })) void _l
    }).rejects.toBeInstanceOf(ProduceHalt)
    const feedback2 = reqs2()[1]!.messages.find((m) => m.role === 'user' && /INVALID/.test(m.content))!
    expect(feedback2.content).toMatch(/IDGRAPH at main:root-missing/)
    expect(feedback2.content).toMatch(/has NO `id:"root"`/)
    expect(feedback2.content).toMatch(/drop the `createSurface` line/)
    expect(feedback2.content).not.toMatch(/already received its ONE/)

    // Negative control: a CATALOG-only failure carries no id-graph hint at all.
    const { provider: p3, reqs: reqs3 } = stubProvider([INVALID, VALID])
    const deps3: ProduceDeps = { provider: p3, retrieve: () => [], catalog: defaultCatalog }
    for await (const _l of produce(intent, deps3, { maxRounds: 3 })) void _l
    const feedback3 = reqs3()[1]!.messages.find((m) => m.role === 'user' && /INVALID/.test(m.content))!
    expect(feedback3.content).not.toMatch(/id-graph|EARLIER turn|has NO `id:"root"`/)
  })

  it('GH #307: a dangling child ref and a cycle each get their own repair sentence', async () => {
    const DANGLING =
      '{"a2uiMeta":{"note":"Round two!"}}\n' +
      '{"version":"v1.0","updateComponents":{"surfaceId":"main","components":[' +
      '{"id":"q","component":"Text","text":"Q2?"},' +
      '{"id":"go","component":"Button","label":"Answer","action":{"action":"answer"},"child":"never_sent"}' +
      ']}}'
    const { provider, reqs } = stubProvider([DANGLING])
    const deps: ProduceDeps = { provider, retrieve: () => [], catalog: defaultCatalog }
    await expect(async () => {
      for await (const _l of produce(resumedClick, deps, { maxRounds: 2 })) void _l
    }).rejects.toBeInstanceOf(ProduceHalt)
    const feedback = reqs()[1]!.messages.find((m) => m.role === 'user' && /INVALID/.test(m.content))!
    expect(feedback.content).toMatch(/IDGRAPH at go->never_sent/)
    expect(feedback.content).toMatch(/lists a child id that NO component defines/)

    const CYCLIC =
      '{"a2uiMeta":{"note":"Round two!"}}\n' +
      '{"version":"v1.0","updateComponents":{"surfaceId":"main","components":[' +
      '{"id":"a","component":"Column","children":["b"]},{"id":"b","component":"Column","children":["a"]}' +
      ']}}'
    const { provider: p2, reqs: reqs2 } = stubProvider([CYCLIC])
    const deps2: ProduceDeps = { provider: p2, retrieve: () => [], catalog: defaultCatalog }
    await expect(async () => {
      for await (const _l of produce(resumedClick, deps2, { maxRounds: 2 })) void _l
    }).rejects.toBeInstanceOf(ProduceHalt)
    const feedback2 = reqs2()[1]!.messages.find((m) => m.role === 'user' && /INVALID/.test(m.content))!
    expect(feedback2.content).toMatch(/IDGRAPH at main:cycle/)
    expect(feedback2.content).toMatch(/form a CYCLE/)
  })

  // Review F2 — the seed hole the escape hatch above walks onto. `sessionSurfaceSeeds` used to reset a
  // surface's seed on `deleteSurface` ONLY, so a prior-turn `createSurface` accumulated on top of the
  // components it actually TORE DOWN (renderer.ts re-creates the store surface and the SurfaceTree from
  // scratch). The seed then claimed a richer graph than the renderer holds: a later payload referencing a
  // pre-re-create GHOST id validated, streamed, and rendered nothing. Pre-existing, but `duplicateRoot`'s
  // "re-create the surface" advice turns this path from rare into routine, so it is closed here.
  it('GH #307 (F2): a prior-turn createSurface RESETS that surface\'s seed — ghost ids no longer resolve', async () => {
    // Turn 1 builds `old_q`; turn 2 RE-creates the same surface, so the live surface holds only `new_q`.
    const TURN1 =
      '{"version":"v1.0","createSurface":{"surfaceId":"main","catalogId":"agent-ui"}}\n' +
      '{"version":"v1.0","updateComponents":{"surfaceId":"main","components":[' +
      '{"id":"root","component":"Column","children":["old_q"]},{"id":"old_q","component":"Text","text":"Q1?"}]}}'
    const TURN2 =
      '{"version":"v1.0","createSurface":{"surfaceId":"main","catalogId":"agent-ui"}}\n' +
      '{"version":"v1.0","updateComponents":{"surfaceId":"main","components":[' +
      '{"id":"root","component":"Column","children":["new_q"]},{"id":"new_q","component":"Text","text":"Q2?"}]}}'
    const afterRecreate: TurnInput = {
      kind: 'client',
      session: {
        turns: [
          { role: 'user', content: 'start' },
          { role: 'assistant', content: TURN1 },
          { role: 'user', content: 'next' },
          { role: 'assistant', content: TURN2 },
        ],
      },
      message: {
        version: 'v1.0',
        action: { surfaceId: 'main', actionId: 'a2', name: 'next', sourceComponentId: 'new_q', timestamp: '0', context: {} },
      },
    }

    // Referencing a GHOST id (delivered before the re-create, gone from the live surface) must FAIL as
    // dangling — not validate on a stale seed and silently render nothing.
    const REFERENCES_GHOST =
      '{"a2uiMeta":{"note":"Round three!"}}\n' +
      '{"version":"v1.0","updateComponents":{"surfaceId":"main","components":[' +
      '{"id":"new_q","component":"Column","children":["old_q"]}]}}'
    const { provider, reqs } = stubProvider([REFERENCES_GHOST])
    const deps: ProduceDeps = { provider, retrieve: () => [], catalog: defaultCatalog }
    let halted: unknown
    try {
      for await (const _l of produce(afterRecreate, deps, { maxRounds: 2 })) void _l
    } catch (e) {
      halted = e
    }
    expect(halted).toBeInstanceOf(ProduceHalt)
    expect((halted as ProduceHalt).failures).toEqual([{ code: 'IDGRAPH', path: 'new_q->old_q' }])
    expect(reqs()[1]!.messages.at(-1)!.content).toMatch(/lists a child id that NO component defines/)

    // …and the reset is ORDER-sensitive WITHIN a turn: turn 2's own updateComponents rebuilt the seed on
    // top of the cleared surface, so a payload touching only POST-re-create ids still validates round 1.
    // (Without this arm, a reset that simply nuked the seed would pass the assertion above.)
    const TOUCHES_LIVE_ID =
      '{"a2uiMeta":{"note":"Round three!"}}\n' +
      '{"version":"v1.0","updateComponents":{"surfaceId":"main","components":[{"id":"new_q","component":"Text","text":"Q3?"}]}}'
    const { provider: p2, calls: calls2 } = stubProvider([TOUCHES_LIVE_ID])
    const deps2: ProduceDeps = { provider: p2, retrieve: () => [], catalog: defaultCatalog }
    const okLines: string[] = []
    for await (const line of produce(afterRecreate, deps2, { maxRounds: 2 })) okLines.push(line)
    expect(calls2()).toBe(1) // the seed still carries turn 2's root — no root-missing, no self-correct
    expect(okLines).toHaveLength(2)
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
  const expectedMiniSkills = selectMiniSkills(intent.text, MINI_SKILLS, DEFAULT_MINI_SKILL_CAP, defaultCatalog.catalogId)

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

// mkEffortCapturingProvider — a stub that records the `req.effort` value each round actually received, the
// SAME capture-and-compare technique `reqs()[i].model`/`systems()[i]` already prove above, applied to the
// reasoning-effort dial's own additive precedent on this seam.
function mkEffortCapturingProvider(outputs: string[]): { provider: AgentProvider; efforts: () => (string | undefined)[] } {
  let n = 0
  const efforts: (string | undefined)[] = []
  const provider: AgentProvider = {
    async *stream(req) {
      efforts.push(req.effort)
      const out = outputs[Math.min(n, outputs.length - 1)]!
      n += 1
      yield out
    },
  }
  return { provider, efforts: () => efforts }
}

describe('produce() threads opts.effort to deps.provider.stream (the AgentProvider.stream effort? seam)', () => {
  it("opts.effort='high' reaches the provider's stream request verbatim", async () => {
    const { provider, efforts } = mkEffortCapturingProvider([VALID])
    const deps: ProduceDeps = { provider, retrieve: () => [], catalog: defaultCatalog }
    const lines: string[] = []
    for await (const line of produce(intent, deps, { maxRounds: 3, effort: 'high' })) lines.push(line)

    expect(lines).toHaveLength(2) // the loop mechanics are unaffected by effort
    expect(efforts()).toEqual(['high'])
  })

  it('an ABSENT opts.effort reaches the provider as undefined (byte-identical to before this field existed)', async () => {
    const { provider, efforts } = mkEffortCapturingProvider([VALID])
    const deps: ProduceDeps = { provider, retrieve: () => [], catalog: defaultCatalog }
    const lines: string[] = []
    for await (const line of produce(intent, deps, { maxRounds: 3 })) lines.push(line)

    expect(efforts()).toEqual([undefined])
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
    const expectedSelection = selectMiniSkills(settingsIntent.text, MINI_SKILLS, DEFAULT_MINI_SKILL_CAP, defaultCatalog.catalogId)
    expect(systems()[0]).toBe(buildSystemPrompt(defaultCatalog, [], undefined, expectedSelection))
  })

  it('a query matching no registry entry composes NO mini-skills block (absent/empty selection ⇒ no block)', async () => {
    // Deliberately NOT the shared `intent` fixture ("a submit button") — "submit"/"form" both appear in
    // login-form's triggers, so it would (correctly) select a mini-skill; this negative control needs a
    // turn sharing ZERO vocabulary with every MINI_SKILLS entry's triggers.
    const unrelatedIntent: TurnInput = { kind: 'intent', text: 'show me the weather forecast for tomorrow', session: { turns: [] } }
    expect(selectMiniSkills(unrelatedIntent.text, MINI_SKILLS, DEFAULT_MINI_SKILL_CAP, defaultCatalog.catalogId)).toEqual([]) // sanity: genuinely zero overlap

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

// ── ADR-0174 cl.2 / SPEC-R20 AC3: the plan meta-line arm — pure passthrough, no integrity check ─────────
describe('produce() plan meta-line arm — passthrough (ADR-0174 cl.2 / SPEC-R20 AC3)', () => {
  const PLAN = { steps: [{ id: 'step-1', description: 'Gather requirements' }, { id: 'step-2', description: 'Build the surface' }] }

  it('meta{note,plan} + a payload with zero A2UI lines ships the outgoing meta-line with plan intact (unchanged)', async () => {
    const { provider } = stubProvider([JSON.stringify({ a2uiMeta: { note: 'Here is my plan.', plan: PLAN } })])
    const deps: ProduceDeps = { provider, retrieve: () => [], catalog: defaultCatalog }
    const lines: string[] = []
    let halted: unknown
    try {
      for await (const line of produce(intent, deps, { maxRounds: 3 })) lines.push(line)
    } catch (e) {
      halted = e
    }
    expect(halted).toBeUndefined() // empty A2UI ≠ invalid — no ProduceHalt
    expect(lines).toHaveLength(1) // the meta-line only, zero A2UI lines
    const meta = readMetaLine(lines[0]!)
    expect(meta).toBeDefined()
    expect(meta!.a2uiMeta.note).toBe('Here is my plan.')
    expect(meta!.a2uiMeta.plan).toEqual(PLAN) // passed through UNCHANGED from the model's own declaration
  })

  it('meta{note,plan} + an ordinary validated payload also ships the outgoing meta-line with plan intact', async () => {
    const { provider } = stubProvider([JSON.stringify({ a2uiMeta: { note: 'Building it.', plan: PLAN } }) + '\n' + VALID])
    const deps: ProduceDeps = { provider, retrieve: () => [], catalog: defaultCatalog }
    const lines: string[] = []
    for await (const line of produce(intent, deps, { maxRounds: 3 })) lines.push(line)

    expect(lines).toHaveLength(3) // meta-line + VALID's two messages
    const meta = readMetaLine(lines[0]!)
    expect(meta!.a2uiMeta.note).toBe('Building it.')
    expect(meta!.a2uiMeta.plan).toEqual(PLAN)
    const a2uiLines = lines.slice(1)
    expect(validateA2ui(a2uiLines.map((l) => JSON.parse(l)), defaultCatalog).valid).toBe(true)
  })

  it('a stub that never authors plan omits the key entirely — byte-identical to the pre-this-field wire shape', async () => {
    const { provider } = stubProvider(['{"a2uiMeta":{"note":"hi"}}\n' + VALID])
    const deps: ProduceDeps = { provider, retrieve: () => [], catalog: defaultCatalog }
    const lines: string[] = []
    for await (const line of produce(intent, deps, { maxRounds: 3 })) lines.push(line)

    expect(lines).toHaveLength(3)
    expect(lines[0]).not.toContain('"plan"') // JSON.stringify omits the key entirely — no bare `"plan":undefined`
    const meta = readMetaLine(lines[0]!)
    expect(meta!.a2uiMeta.plan).toBeUndefined()
  })

  it('plan carries NO integrity check — a plan naming steps with no corresponding payload still ships through, no self-correct round', async () => {
    const { provider, calls } = stubProvider([JSON.stringify({ a2uiMeta: { note: 'plan only', plan: PLAN } }) + '\n' + VALID])
    const deps: ProduceDeps = { provider, retrieve: () => [], catalog: defaultCatalog }
    const lines: string[] = []
    for await (const line of produce(intent, deps, { maxRounds: 3 })) lines.push(line)

    expect(calls()).toBe(1) // no FEED_SCOPE/integrity-style retry — plan is host-trusted, per Scope
    expect(readMetaLine(lines[0]!)!.a2uiMeta.plan).toEqual(PLAN)
  })

  it('plan and ask compose independently on the SAME meta-line — both survive passthrough', async () => {
    const { provider } = stubProvider([
      JSON.stringify({ a2uiMeta: { note: 'Ready?', ask: { surfaceId: 'ask-1' }, plan: PLAN } }) + '\n' + ASK_VALID,
    ])
    const deps: ProduceDeps = { provider, retrieve: () => [], catalog: defaultCatalog }
    const lines: string[] = []
    for await (const line of produce(intent, deps, { maxRounds: 3 })) lines.push(line)

    const meta = readMetaLine(lines[0]!)
    expect(meta!.a2uiMeta.ask).toEqual({ surfaceId: 'ask-1' })
    expect(meta!.a2uiMeta.plan).toEqual(PLAN)
  })
})

// ── ADR-0178 cl.1/cl.3, SPEC-R29 AC3 / SPEC-R30 AC3: the personaPatch arm — gate-blind passthrough ──────
describe('produce() personaPatch meta-line arm — passthrough (ADR-0178 cl.1 / SPEC-R29 AC3)', () => {
  const PATCH = { values: { name: 'Support Buddy', temperature: 0.4 } }

  it('meta{note,personaPatch} + a payload with zero A2UI lines ships the outgoing meta-line with the patch intact', async () => {
    const { provider } = stubProvider([JSON.stringify({ a2uiMeta: { note: 'Got it.', personaPatch: PATCH } })])
    const deps: ProduceDeps = { provider, retrieve: () => [], catalog: defaultCatalog }
    const lines: string[] = []
    let halted: unknown
    try {
      for await (const line of produce(intent, deps, { maxRounds: 3, authoringSurface: true })) lines.push(line)
    } catch (e) {
      halted = e
    }
    expect(halted).toBeUndefined()
    expect(lines).toHaveLength(1)
    const meta = readMetaLine(lines[0]!)
    expect(meta!.a2uiMeta.note).toBe('Got it.')
    expect(meta!.a2uiMeta.personaPatch).toEqual(PATCH) // passed through UNCHANGED from the model's declaration
  })

  it('meta{note,personaPatch} + an ordinary validated payload also ships the patch intact', async () => {
    const { provider } = stubProvider([JSON.stringify({ a2uiMeta: { note: 'Building it.', personaPatch: PATCH } }) + '\n' + VALID])
    const deps: ProduceDeps = { provider, retrieve: () => [], catalog: defaultCatalog }
    const lines: string[] = []
    for await (const line of produce(intent, deps, { maxRounds: 3, authoringSurface: true })) lines.push(line)

    expect(lines).toHaveLength(3)
    expect(readMetaLine(lines[0]!)!.a2uiMeta.personaPatch).toEqual(PATCH)
    expect(validateA2ui(lines.slice(1).map((l) => JSON.parse(l)), defaultCatalog).valid).toBe(true)
  })

  it('a stub that never authors a patch omits the key entirely — byte-identical to the pre-this-field wire shape', async () => {
    const { provider } = stubProvider(['{"a2uiMeta":{"note":"hi"}}\n' + VALID])
    const deps: ProduceDeps = { provider, retrieve: () => [], catalog: defaultCatalog }
    const lines: string[] = []
    for await (const line of produce(intent, deps, { maxRounds: 3 })) lines.push(line)

    expect(lines[0]).not.toContain('"personaPatch"') // no bare `"personaPatch":undefined`
    expect(readMetaLine(lines[0]!)!.a2uiMeta.personaPatch).toBeUndefined()
  })

  it('the passthrough is GATE-BLIND: a volunteered patch with the gate OFF yields a byte-identical stream to the gate-ON run (SPEC-R30 AC3)', async () => {
    const raw = JSON.stringify({ a2uiMeta: { note: 'Volunteered.', personaPatch: PATCH } }) + '\n' + VALID
    const run = async (authoringSurface: boolean | undefined): Promise<string[]> => {
      const { provider } = stubProvider([raw])
      const deps: ProduceDeps = { provider, retrieve: () => [], catalog: defaultCatalog }
      const lines: string[] = []
      for await (const line of produce(intent, deps, { maxRounds: 3, ...(authoringSurface === undefined ? {} : { authoringSurface }) })) {
        lines.push(line)
      }
      return lines
    }
    const on = await run(true)
    const off = await run(false)
    const absent = await run(undefined)
    // What the gate withholds is CONSUMPTION (host-side, ADR-0178 cl.2) and TEACHING (the composed
    // prompt) — never framing. One peel path, so there is no gate-conditional wire branch to drift.
    expect(off).toEqual(on)
    expect(absent).toEqual(on)
    expect(readMetaLine(off[0]!)!.a2uiMeta.personaPatch).toEqual(PATCH)
  })

  it('the patch carries NO integrity check — a patch naming anything at all ships through, no self-correct round', async () => {
    const { provider, calls } = stubProvider([
      JSON.stringify({ a2uiMeta: { note: 'hi', personaPatch: { values: { totallyUnknownKey: 1 } } } }) + '\n' + VALID,
    ])
    const deps: ProduceDeps = { provider, retrieve: () => [], catalog: defaultCatalog }
    const lines: string[] = []
    for await (const line of produce(intent, deps, { maxRounds: 3, authoringSurface: true })) lines.push(line)

    expect(calls()).toBe(1) // the host's three filters, not a producer-side check, are what make it safe
    expect(readMetaLine(lines[0]!)!.a2uiMeta.personaPatch).toEqual({ values: { totallyUnknownKey: 1 } })
  })

  it('personaPatch, plan and ask compose independently on the SAME meta-line — all three survive passthrough', async () => {
    const plan = { steps: [{ id: 'step-1', description: 'Ask about tone' }] }
    const { provider } = stubProvider([
      JSON.stringify({ a2uiMeta: { note: 'Ready?', ask: { surfaceId: 'ask-1' }, plan, personaPatch: PATCH } }) + '\n' + ASK_VALID,
    ])
    const deps: ProduceDeps = { provider, retrieve: () => [], catalog: defaultCatalog }
    const lines: string[] = []
    for await (const line of produce(intent, deps, { maxRounds: 3, authoringSurface: true })) lines.push(line)

    const meta = readMetaLine(lines[0]!)
    expect(meta!.a2uiMeta.ask).toEqual({ surfaceId: 'ask-1' })
    expect(meta!.a2uiMeta.plan).toEqual(plan)
    expect(meta!.a2uiMeta.personaPatch).toEqual(PATCH)
  })

  it('a MALFORMED patch drops at the peel and never reaches the wire — the note still ships', async () => {
    const { provider } = stubProvider(['{"a2uiMeta":{"note":"hi","personaPatch":"broken"}}\n' + VALID])
    const deps: ProduceDeps = { provider, retrieve: () => [], catalog: defaultCatalog }
    const lines: string[] = []
    for await (const line of produce(intent, deps, { maxRounds: 3, authoringSurface: true })) lines.push(line)

    expect(lines[0]).not.toContain('"personaPatch"')
    expect(readMetaLine(lines[0]!)!.a2uiMeta.note).toBe('hi')
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
