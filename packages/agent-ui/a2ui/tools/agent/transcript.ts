// transcript.ts — LLD-C2 data (SPEC-R2): the committed recorded transcript the deterministic backbone
// replays. Turn 1 REUSES the committed `canvas-button` shelf seed (ADR-0055) so its validity is already
// covered by `examples.test.ts` (shown ≡ fed ≡ gated). Turn 2 is a hand-authored valid continuation — a
// second "confirmation" surface with a Text — whose validity is proven directly by the round-trip gate's
// finalize/render assertions (`round-trip.test.ts`). No live logic, no network, no key.
//
// ADR-0088 §1 (slice 6): each turn may carry an optional `note` — the recorded backbone's stand-in for
// the live model's contemporaneous prose. `createRecordedTransport` (`recorded-transport.ts`) streams it
// as the SAME reserved meta-line the live producer emits (`{"a2uiMeta":{"note":"…"}}`), ahead of the
// turn's A2UI JSONL — so the offline/keyless demo shows real prose instead of `summarize()`'s mechanical
// kind-tally fallback (`a2ui-live.ts`'s `note ?? summarize(turnLines)`). `lines` stays protocol-only
// (unchanged) so every existing direct-ingest consumer of this transcript (`round-trip.test.ts`) is
// undisturbed; the note only takes effect when a turn is driven through the `AgentTransport` seam.

import type { A2uiServerMessage } from '../../src/protocol.ts'
import type { A2uiClientMessage } from '../../src/renderer/index.ts'
import { canvasButtonSeed } from '../../src/examples/index.ts'
import type { AskDeclaration } from './meta-line.ts'

/** One recorded turn: the A2UI JSONL the agent emitted, and (turn 1) the client message a scripted
 * interaction produces — asserted by the round-trip gate. `note`, if present, is the agent's own
 * contemporaneous rationale for THIS turn's payload (ADR-0088 §1) — streamed as a leading meta-line by
 * `createRecordedTransport`, never mixed into `lines`. `ask`, if present (ADR-0097 §1), is the SAME
 * feed-embedded-ask routing declaration `produce()` composes — `createRecordedTransport` streams it on
 * the SAME meta-line shape, so the recorded backbone can carry an ask turn-for-turn parity with the live
 * path. The SHIPPED transcript below carries no `ask` (ADR-0089's scripted-turn fork stands, untouched);
 * `round-trip.test.ts` exercises the field via a LOCAL fixture transcript, never this one. */
export interface RecordedTurn {
  lines: string[]
  note?: string
  ask?: AskDeclaration
  expectClientMessage?: A2uiClientMessage
}

/** A committed transcript of real captured turns (SPEC-R2). */
export interface RecordedTranscript {
  intent: string
  turns: RecordedTurn[]
}

const jsonl = (m: A2uiServerMessage): string => JSON.stringify(m)

// Turn 2 — the agent's follow-up after the user clicks the button: a second surface confirming the
// interaction. A Text root (catalog-valid: Text carries a `text` prop) on a NEW surface id, so the
// renderer attaches a second root under the mount (no in-place type change of turn-1's Button root).
const TURN2: A2uiServerMessage[] = [
  { version: 'v1.0', createSurface: { surfaceId: 'confirmation', catalogId: 'agent-ui' } },
  {
    version: 'v1.0',
    updateComponents: {
      surfaceId: 'confirmation',
      components: [
        {
          id: 'root',
          component: 'Text',
          text: 'Thanks — you clicked the button. The agent continues: this second surface is turn 2 of the conversation.',
        },
      ],
    },
  },
]

/** The single committed transcript the demo's backbone replays (and the round-trip gate drives). */
export const recordedTranscript: RecordedTranscript = {
  intent: canvasButtonSeed.promptText,
  turns: [
    {
      lines: canvasButtonSeed.messages.map(jsonl),
      // Honest per-turn rationale (ADR-0088 §1): this turn's actual payload is a `canvas` surface with
      // one solid Button labelled "Click me" wired to a `submit` action — nothing else.
      note: 'I set up a single canvas surface with one button, labeled "Click me" — click it and I\'ll hear about it.',
      // The action a click on the seed's Button emits. Under the round-trip gate's injected deterministic
      // id/clock, actionId/timestamp are fixed; the gate matches the ESSENTIALS (name + surfaceId).
      expectClientMessage: {
        version: 'v1.0',
        action: {
          surfaceId: canvasButtonSeed.surfaceId,
          actionId: 'act-1',
          name: 'submit',
          sourceComponentId: 'root',
          timestamp: '2026-07-04T00:00:00.000Z',
          context: {},
        },
      },
    },
    {
      lines: TURN2.map(jsonl),
      // Honest per-turn rationale: this turn's actual payload is a NEW "confirmation" surface holding
      // one Text component that reports the click back — no other change to the canvas surface.
      note: 'Thanks for the click — I added a second surface with a Text confirming the button worked.',
    },
  ],
}
