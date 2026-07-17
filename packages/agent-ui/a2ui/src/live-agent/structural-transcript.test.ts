// structural-transcript.test.ts — ADR-0090 §3/LLD-C2: the standing validity gate for the SECOND worked
// transcript (`tools/agent/structural-transcript.ts`), naming Structural Gen UI as a first-class pattern
// (see that file's header) DISTINCT from the round-trip gate's canvas-button transcript
// (`round-trip.test.ts` / `transcript.ts`). Same precedent, no parallel check invented: (a) the shared
// validator (`validateA2ui`, SPEC-N3/N6 parity — the `examples.test.ts` shape) verdicts 0-failure on each
// turn, and (b) a real-host render through the ACTUAL `createRecordedTransport` seam (the
// `round-trip.test.ts` shape) — zero live model, zero API key, zero network call.

import { describe, it, expect } from 'vitest'
import '@agent-ui/components/components' // self-defines the ui-* controls so the renderer's nodes upgrade
import { createRenderer } from '../renderer/renderer.ts'
import type { A2uiClientMessage } from '../renderer/renderer.ts'
import { validateA2ui } from '../renderer/validate.ts'
import { defaultCatalog } from '../catalog/default/index.ts'
import { structuralDashboardTranscript } from '../../tools/agent/structural-transcript.ts'
import { createRecordedTransport } from '../agent/recorded-transport.ts'
import { readMetaLine } from '../agent/meta-line.ts'
import type { Session } from '../agent/agent-transport.ts'

const isError = (m: A2uiClientMessage): m is Extract<A2uiClientMessage, { error: unknown }> => 'error' in m

describe('Structural Gen UI worked example — validity (ADR-0090 §3, SPEC-N3/N6 parity)', () => {
  it('has exactly 2 turns, each carrying a note (a distinct example from the round-trip canvas-button transcript)', () => {
    expect(structuralDashboardTranscript.turns).toHaveLength(2)
    for (const turn of structuralDashboardTranscript.turns) expect(turn.note).not.toBeUndefined()
  })

  it('every turn validates 0-failure via the shared validator', () => {
    for (const turn of structuralDashboardTranscript.turns) {
      const messages = turn.lines.map((l) => JSON.parse(l))
      expect(validateA2ui(messages, defaultCatalog)).toEqual({ valid: true, failures: [] })
    }
  })

  it('uses ONLY real default-catalog component types (Grid/Card/CardContent/Column/Text/Row/Button)', () => {
    const seen = new Set<string>()
    for (const turn of structuralDashboardTranscript.turns) {
      for (const line of turn.lines) {
        const msg = JSON.parse(line)
        if ('updateComponents' in msg) {
          for (const c of msg.updateComponents.components) seen.add(c.component)
        }
      }
    }
    expect(seen).toEqual(new Set(['Grid', 'Card', 'CardContent', 'Column', 'Text', 'Row', 'Button']))
    for (const name of seen) expect(defaultCatalog.components[name], name).not.toBeUndefined()
  })
})

describe('Structural Gen UI worked example — renders with zero live model (ADR-0090 §3)', () => {
  it('renders turn 1 (the dashboard) through the real host with an empty error channel', () => {
    const sent: A2uiClientMessage[] = []
    const r = createRenderer()
    r.onClientMessage((m) => void sent.push(m))
    const mount = document.createElement('div')
    document.body.appendChild(mount)
    r.mount(mount)

    const [turn1] = structuralDashboardTranscript.turns
    for (const line of turn1!.lines) r.ingest(line)
    r.finalize('dashboard-summary')

    expect(sent.filter(isError)).toEqual([])
    expect(mount.querySelector('ui-grid')).not.toBeNull()
    expect(mount.querySelectorAll('ui-card')).toHaveLength(3)
    expect(mount.querySelectorAll('ui-text')).toHaveLength(6) // 3 cards × (caption label + h2 value)

    r.dispose()
    mount.remove()
  })

  it('renders turn 2 (the follow-up refresh surface) as a SECOND surface, empty error channel', () => {
    const sent: A2uiClientMessage[] = []
    const r = createRenderer()
    r.onClientMessage((m) => void sent.push(m))
    const mount = document.createElement('div')
    document.body.appendChild(mount)
    r.mount(mount)

    for (const turn of structuralDashboardTranscript.turns) for (const line of turn.lines) r.ingest(line)
    r.finalize('dashboard-summary')
    r.finalize('dashboard-actions')

    expect(sent.filter(isError)).toEqual([])
    expect(mount.querySelector('ui-row')).not.toBeNull()
    expect(mount.querySelector('ui-button')).not.toBeNull()

    r.dispose()
    mount.remove()
  })

  it('replays through the ACTUAL createRecordedTransport seam — no network, no key, no live model', async () => {
    const transport = createRecordedTransport(structuralDashboardTranscript)
    const session: Session = { turns: [] }

    const turn1Lines: string[] = []
    for await (const line of transport.turn({ kind: 'intent', text: structuralDashboardTranscript.intent, session }))
      turn1Lines.push(line)

    // Each turn's `note` rides FIRST as a leading meta-line (the SAME shape `transcript.ts`'s turns prove),
    // and the A2UI JSONL after it is byte-identical to the transcript's own authored `lines`.
    const [turn1, turn2] = structuralDashboardTranscript.turns
    const meta1 = readMetaLine(turn1Lines[0]!)
    expect(meta1?.a2uiMeta.note).toBe(turn1!.note)
    expect(turn1Lines.slice(1)).toEqual(turn1!.lines)

    const turn2Lines: string[] = []
    for await (const line of transport.turn({ kind: 'intent', text: 'anything', session }))
      turn2Lines.push(line)
    const meta2 = readMetaLine(turn2Lines[0]!)
    expect(meta2?.a2uiMeta.note).toBe(turn2!.note)
    expect(turn2Lines.slice(1)).toEqual(turn2!.lines)

    // A THIRD call yields nothing further — the transcript is exhausted (recorded-transport.ts's
    // documented behavior), never an error, never a repeat.
    const turn3Lines: string[] = []
    for await (const line of transport.turn({ kind: 'intent', text: 'anything', session }))
      turn3Lines.push(line)
    expect(turn3Lines).toEqual([])
  })
})
