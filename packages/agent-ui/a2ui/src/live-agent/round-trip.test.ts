// round-trip.test.ts — LLD-C8a / SPEC-R2 AC1, SPEC-R8 AC1. The visible page's proof (like
// renderer.test.ts is a2ui-canvas's): the committed transcript driven through the REAL renderer host,
// deterministically, with no network/key — turn-1 renders + finalizes clean, the scripted click
// round-trips the expected action, the reducer frames it, and turn-2 continues the conversation.

import { describe, it, expect } from 'vitest'
import { whenFlushed } from '@agent-ui/components'
import '@agent-ui/components/components' // self-defines the ui-* controls so the renderer's nodes upgrade + wire clicks
import { createRenderer } from '../renderer/renderer.ts'
import type { A2uiClientMessage } from '../renderer/renderer.ts'
import type { A2uiActionMessage } from '../protocol.ts'
import { recordedTranscript } from '../../tools/agent/transcript.ts'
import type { RecordedTranscript } from '../agent/recorded-transport.ts'
import { nextTurn, frameClientMessage } from '../agent/session.ts'
import { createRecordedTransport } from '../agent/recorded-transport.ts'
import { readMetaLine } from '../agent/meta-line.ts'
import type { Session } from '../agent/agent-transport.ts'
import { validateA2ui } from '../renderer/validate.ts'
import { defaultCatalog } from '../catalog/default/index.ts'

const isAction = (m: A2uiClientMessage): m is A2uiActionMessage => 'action' in m

describe('recorded backbone round-trip (LLD-C2/C8 / SPEC-R2 AC1)', () => {
  it('renders turn-1, round-trips the click, and turn-2 continues — deterministic, no network', () => {
    const mount = document.createElement('div')
    document.body.append(mount)
    const sent: A2uiClientMessage[] = []
    // Deterministic id/clock (the renderer.test.ts pattern) so the action round-trip is exact.
    const host = createRenderer({ newId: () => 'act-1', now: () => '2026-07-04T00:00:00.000Z' })
    host.onClientMessage((m) => void sent.push(m))
    host.mount(mount)

    const [turn1, turn2] = recordedTranscript.turns

    // Turn 1 — the canvas-button seed renders a live ui-button; the complete set finalizes clean.
    for (const line of turn1!.lines) host.ingest(line)
    expect(mount.querySelector('ui-button')).not.toBeNull()
    host.finalize('canvas')

    // The scripted interaction: click the button → exactly one action client-message round-trips.
    ;(mount.querySelector('ui-button') as HTMLElement).click()
    expect(sent).toHaveLength(1)
    const msg = sent[0]!
    expect(isAction(msg)).toBe(true)
    const expected = turn1!.expectClientMessage
    if (isAction(msg) && expected && 'action' in expected) {
      expect(msg.action.name).toBe(expected.action.name) // 'submit'
      expect(msg.action.surfaceId).toBe(expected.action.surfaceId) // 'canvas'
    }

    // The reducer frames it into a distinct, non-empty next-turn user input (SPEC-R8).
    expect(frameClientMessage(msg)).toContain('submit')
    expect(nextTurn({ turns: [] }, msg).kind).toBe('client')

    // Turn 2 — the agent continues: a second surface (a Text confirmation) renders under the same mount.
    const before = mount.childElementCount
    for (const line of turn2!.lines) host.ingest(line)
    host.finalize('confirmation')
    expect(mount.querySelector('ui-text')).not.toBeNull()
    expect(mount.childElementCount).toBeGreaterThan(before)

    host.dispose()
    mount.remove()
  })

  it('streams each recorded turn\'s note as a leading meta-line through the REAL transport (ADR-0088 §1 slice 6)', async () => {
    // Drives the ACTUAL AgentTransport seam `a2ui-live.ts` consumes (not the source transcript object
    // directly, as the render leg above does) — proving the note is genuinely read back OUT of the
    // transport→page wire shape, not merely present in `transcript.ts`.
    const transport = createRecordedTransport(recordedTranscript)
    const session: Session = { turns: [] }
    const collect = async (): Promise<string[]> => {
      const lines: string[] = []
      for await (const line of transport.turn({ kind: 'intent', text: 'anything', session }))
        lines.push(line)
      return lines
    }

    const [turn1, turn2] = recordedTranscript.turns
    expect(turn1!.note, 'turn 1 must carry a real note for this assertion to be meaningful').not.toBeUndefined()
    expect(turn2!.note, 'turn 2 must carry a real note for this assertion to be meaningful').not.toBeUndefined()

    // ADR-0146 F1 — a turn may now carry authored `progress` stages, replayed as `{a2uiMeta:{progress}}`
    // meta-lines AHEAD of the note; the note still precedes the A2UI JSONL. Locate the note by scanning past
    // any leading progress lines, then assert the lines follow it byte-identically.
    const noteIndex = (wire: string[]): number => wire.findIndex((l) => readMetaLine(l)?.a2uiMeta.note !== undefined)

    // Turn 1 — the note meta-line carries EXACTLY the authored note; every line BEFORE it is a progress
    // meta-line; the A2UI JSONL after it is byte-identical to the transcript's own `lines` (SPEC-N4).
    const turn1Wire = await collect()
    const n1 = noteIndex(turn1Wire)
    expect(readMetaLine(turn1Wire[n1]!)?.a2uiMeta.note).toBe(turn1!.note)
    expect(turn1Wire.slice(n1 + 1)).toEqual(turn1!.lines)
    for (const l of turn1Wire.slice(0, n1)) expect(readMetaLine(l)?.a2uiMeta.progress, 'a pre-note line must be a progress meta-line').toBeDefined()
    expect(n1, 'turn 1 authored progress, so its note is not the first line').toBeGreaterThan(0)

    // Turn 2 — same proof, the follow-up note.
    const turn2Wire = await collect()
    const n2 = noteIndex(turn2Wire)
    expect(readMetaLine(turn2Wire[n2]!)?.a2uiMeta.note).toBe(turn2!.note)
    expect(turn2Wire.slice(n2 + 1)).toEqual(turn2!.lines)

    // Negative control: every line AFTER the note meta-line is provably NOT itself a meta-line — the
    // filter genuinely discriminates rather than passing (or swallowing) every line vacuously.
    for (const line of [...turn1Wire.slice(n1 + 1), ...turn2Wire.slice(n2 + 1)]) expect(readMetaLine(line)).toBeUndefined()
  })

  // ADR-0097 §1 (LLD-C2 repair) — a LOCAL fixture transcript (never the shipped one, per ADR-0089's
  // untouched scripted-turn fork) proving `createRecordedTransport` composes `{note, ask}` on the SAME
  // meta-line shape `produce()` emits, with `lines` streaming byte-identical right after it.
  it("a transcript turn carrying `ask` streams {a2uiMeta:{note,ask}} ahead of byte-identical lines (ADR-0097 §1); the shipped transcript is UNCHANGED", async () => {
    const askLines = [
      '{"version":"v1.0","createSurface":{"surfaceId":"ask-1","catalogId":"agent-ui","sendDataModel":true}}',
      '{"version":"v1.0","updateComponents":{"surfaceId":"ask-1","components":[{"id":"root","component":"Button","label":"Go","action":{"action":"submit"}}]}}',
    ]
    const fixture: RecordedTranscript = {
      intent: 'a fixture ask turn',
      turns: [{ lines: askLines, note: 'Pick one to continue.', ask: { surfaceId: 'ask-1' } }],
    }
    const transport = createRecordedTransport(fixture)
    const wire: string[] = []
    for await (const line of transport.turn({ kind: 'intent', text: 'anything', session: { turns: [] } })) wire.push(line)

    const meta = readMetaLine(wire[0]!)
    expect(meta?.a2uiMeta.note).toBe('Pick one to continue.')
    expect(meta?.a2uiMeta.ask).toEqual({ surfaceId: 'ask-1' })
    expect(wire.slice(1)).toEqual(askLines) // byte-identical to the fixture's own `lines`

    // The shipped transcript's own turns carry no `ask` — this fixture proves the mechanism, not a change
    // to the committed backbone (ADR-0089's scripted-turn fork stands, untouched).
    for (const t of recordedTranscript.turns) expect(t.ask).toBeUndefined()
  })

  // ADR-0146 F1 — authored `progress` stages replay as the SAME meta-line shape produce() interleaves live.
  it('a transcript turn carrying `progress` replays {a2uiMeta:{progress}} meta-lines AHEAD of the note/lines (SPEC-R5/N4 parity); a progress-less turn is byte-identical', async () => {
    const lines = ['{"version":"v1.0","createSurface":{"surfaceId":"s","catalogId":"agent-ui"}}']
    const fixture: RecordedTranscript = {
      intent: 'a progress fixture',
      turns: [
        { lines, note: 'Working…', progress: [{ stage: 'sent' }, { stage: 'started' }, { stage: 'content' }, { stage: 'validating' }, { stage: 'done' }] },
        { lines }, // a progress-less (and note-less) turn — must stream byte-identically to before
      ],
    }
    const transport = createRecordedTransport(fixture)
    const collect = async (): Promise<string[]> => {
      const w: string[] = []
      for await (const line of transport.turn({ kind: 'intent', text: 'x', session: { turns: [] } })) w.push(line)
      return w
    }

    // Turn 1 — the progress meta-lines come FIRST (in authored order), then the note, then the lines.
    const w1 = await collect()
    const progress = w1.map((l) => readMetaLine(l)?.a2uiMeta.progress).filter((p) => p !== undefined)
    expect(progress.map((p) => p!.stage)).toEqual(['sent', 'started', 'content', 'validating', 'done'])
    const noteIdx = w1.findIndex((l) => readMetaLine(l)?.a2uiMeta.note !== undefined)
    expect(noteIdx).toBeGreaterThan(0) // the note follows the progress lines
    expect(w1.slice(noteIdx + 1)).toEqual(lines)

    // Turn 2 — no progress, no note: byte-identical to a pre-ADR-0146 recorded turn (zero blast radius).
    const w2 = await collect()
    expect(w2).toEqual(lines)

    // The shipped demo transcript's FIRST turn authors progress (the keyless demo shows the feature).
    expect(recordedTranscript.turns[0]!.progress, 'the committed demo turn 1 carries authored progress').toBeDefined()
  })
})

// ── ADR-0126 (TKT-0016, LLD-C6): turns 3-5 complete the four-type lifecycle arc — restructure /
// data-only react / close. Proves SPEC-R5 AC1/AC2/AC4. ─────────────────────────────────────────────────

describe('the message-lifecycle arc — turns 3-5 (ADR-0126, LLD-C6)', () => {
  it('every prefix of the FULL 5-turn stream validates 0-failure (SPEC-R5 AC1)', () => {
    const allMessages = recordedTranscript.turns.flatMap((t) => t.lines.map((l) => JSON.parse(l) as unknown))
    expect(allMessages.length).toBeGreaterThan(0)
    for (let i = 1; i <= allMessages.length; i++) {
      const verdict = validateA2ui(allMessages.slice(0, i), defaultCatalog)
      expect(verdict, `prefix of length ${i}`).toEqual({ valid: true, failures: [] })
    }
  })

  it("turn 4 (the data-only react) carries EXACTLY one line, and it is updateDataModel — no updateComponents/createSurface (SPEC-R5 AC2)", () => {
    const turn4 = recordedTranscript.turns[3]!
    expect(turn4.lines).toHaveLength(1)
    const parsed = JSON.parse(turn4.lines[0]!) as Record<string, unknown>
    expect('updateDataModel' in parsed).toBe(true)
    expect('updateComponents' in parsed).toBe(false)
    expect('createSurface' in parsed).toBe(false)
  })

  it('turn 3 restructures confirmation (updateComponents), turn 5 closes it (deleteSurface) — the shape SPEC-R1 rules 2/4 require', () => {
    const [turn3, turn5] = [recordedTranscript.turns[2]!, recordedTranscript.turns[4]!]
    const turn3Kinds = turn3.lines.map((l) => Object.keys(JSON.parse(l) as object).find((k) => k !== 'version'))
    expect(turn3Kinds).toContain('updateComponents')
    const turn5Parsed = JSON.parse(turn5.lines[0]!) as { deleteSurface?: { surfaceId?: string } }
    expect(turn5Parsed.deleteSurface?.surfaceId).toBe('confirmation')
  })

  it('turn 3\'s restructure is genuinely VISIBLE after turn 3 ingests (before turn 5 deletes it) — turn 4\'s data-only react updates the SAME node in place (TKT-0024 / renderer-structural-resend.spec.md SPEC-R1 AC1, SPEC-R2 AC1). Closes the "rendered-then-removed vs never-rendered" blind spot this suite\'s own prior review flagged as INFO — the teardown-only assertion below cannot distinguish the two.', async () => {
    const mount = document.createElement('div')
    document.body.append(mount)
    const host = createRenderer({ newId: () => 'act-1', now: () => '2026-07-04T00:00:00.000Z' })
    host.mount(mount)

    const [turn1, turn2, turn3, turn4] = recordedTranscript.turns

    for (const line of turn1!.lines) host.ingest(line)
    for (const line of turn2!.lines) host.ingest(line)
    expect(mount.textContent).not.toContain('Ready') // not yet — turn 3 (the restructure) hasn't landed

    for (const line of turn3!.lines) host.ingest(line) // updateComponents (group grows "status") + updateDataModel
    await whenFlushed() // the status line's bound-prop effect re-run (scheduled by the updateDataModel write) is microtask-batched
    expect(mount.textContent).toContain('Ready') // the resent container's new child is REALLY rendered, not routed

    for (const line of turn4!.lines) host.ingest(line) // data-ONLY react — no updateComponents this turn
    await whenFlushed()
    expect(mount.textContent).toContain('Clicked again') // the SAME status node's bound text updated in place
    expect(mount.textContent).not.toContain('Ready') // the stale value is gone, not merely superseded in the buffer

    host.dispose()
    mount.remove()
  })

  it('after all 5 turns: confirmation is torn down (no DOM remnant), canvas remains (SPEC-R5 AC4 + AC1 "left undeleted")', () => {
    const mount = document.createElement('div')
    document.body.append(mount)
    const host = createRenderer({ newId: () => 'act-1', now: () => '2026-07-04T00:00:00.000Z' })
    host.mount(mount)

    for (const turn of recordedTranscript.turns) {
      for (const line of turn.lines) host.ingest(line)
    }
    host.finalize()

    // canvas's Button survives — it was never deleted (the "otherwise leave it in place" arm, SPEC-R1 rule 4).
    expect(mount.querySelector('ui-button')).not.toBeNull()
    // confirmation's rendered subtree (its Text nodes) is provably gone — real DOM teardown, not merely
    // asserted in prose (runtime SPEC-R2 AC2, SPEC-R5 AC4). Every ui-text in the mount, if any survive,
    // must belong to some OTHER surface — confirmation's own "msg"/"status" text content must not appear.
    expect(mount.innerHTML).not.toContain('Thanks — you clicked the button')
    expect(mount.innerHTML).not.toContain('Clicked again')

    host.dispose()
    mount.remove()
  })
})
