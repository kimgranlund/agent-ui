// transcript.ts — LLD-C2 data (SPEC-R2): the committed recorded transcript the deterministic backbone
// replays. Turn 1 REUSES the committed `canvas-button` shelf seed (ADR-0055) so its validity is already
// covered by `examples.test.ts` (shown ≡ fed ≡ gated). Turn 2 is a hand-authored valid continuation — a
// second "confirmation" surface with a Text — whose validity is proven directly by the round-trip gate's
// finalize/render assertions (`round-trip.test.ts`). No live logic, no network, no key.

import type { A2uiServerMessage } from '../../src/protocol.ts'
import type { A2uiClientMessage } from '../../src/renderer/index.ts'
import { canvasButtonSeed } from '../../src/examples/index.ts'

/** One recorded turn: the A2UI JSONL the agent emitted, and (turn 1) the client message a scripted
 * interaction produces — asserted by the round-trip gate. */
export interface RecordedTurn {
  lines: string[]
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
    { lines: TURN2.map(jsonl) },
  ],
}
