// structural-transcript.ts — ADR-0090 §3/LLD-C2: the worked example for **Structural Gen UI**.
//
// Structural Gen UI is NOT a live-grammar `GenUiMode` (that axis reaches `buildSystemPrompt` — the LIVE
// path, `gen-ui-mode.ts`); it is a TRANSPORT choice at a different layer: "load a pre-generated,
// pre-validated JSONL transcript, render it through the existing `AgentTransport`/`createRenderer` seam,
// with zero live model, zero API key, zero network call." The SHIPPED `createRecordedTransport`
// (`recorded-transport.ts:25-36`) already IS this pattern — it replays ANY committed `RecordedTranscript`
// through the SAME `AgentTransport` seam the live path implements, with no live model in the loop. This
// module is the SECOND worked example proving the pattern generalizes beyond the original canvas-button
// transcript (`transcript.ts`), which itself doubles as the round-trip/interaction gate's fixture.
//
// Where the ORIGINAL `transcript.ts` demonstrates the round-trip state machine (a click → an `action`
// client message → the agent's continuation), THIS transcript demonstrates the OTHER half of the
// pattern's value: a small, real, multi-component surface — a dashboard of stats, then a follow-up
// surface with an affordance — composed ENTIRELY from real default-catalog types (`Grid`, `Card`,
// `CardContent`, `Column`, `Text`, `Row`, `Button` — verified against `catalog/default/catalog.json`),
// with no click-driven `expectClientMessage` of its own. Both are "pre-generated, commit-time-validated
// JSONL, replayed with zero live model" — the reference implementation for anyone building a Structural
// deployment: mint a `RecordedTranscript` like this one, gate it with `validateA2ui` (as
// `structural-transcript.test.ts` does), and hand it to `createRecordedTransport(transcript)`.
//
// Gated by the SAME precedent `transcript.ts`'s turn-2 uses: no shelf-seed reuse here (unlike
// `transcript.ts`'s turn 1, which reuses `canvasButtonSeed` and rides `examples.test.ts` for free), so
// this transcript's validity is proven DIRECTLY — `structural-transcript.test.ts` runs `validateA2ui`
// over each turn's messages (SPEC-N3/N6 parity, the `examples.test.ts` shape) and drives the whole
// transcript through `createRecordedTransport` + a real `createRenderer()` host (the `round-trip.test.ts`
// shape), never inventing a parallel check.

import type { A2uiServerMessage } from '../../src/protocol.ts'
import type { RecordedTranscript } from '../../src/agent/recorded-transport.ts'

const jsonl = (m: A2uiServerMessage): string => JSON.stringify(m)

// Turn 1 — a dashboard of three KPI stats, fully hosted by the catalog (the ADR-0090 §"Calibration
// examples" dashboard case, minus the unhosted-chart wall — this worked example is deliberately the
// clean, fully-hostable half): a Grid of Cards, each a Column of a caption label + an h2 value.
const TURN1: A2uiServerMessage[] = [
  { version: 'v1.0', createSurface: { surfaceId: 'dashboard-summary', catalogId: 'agent-ui' } },
  {
    version: 'v1.0',
    updateComponents: {
      surfaceId: 'dashboard-summary',
      components: [
        { id: 'root', component: 'Grid', gap: 'md', min: '160px', children: ['stat-users', 'stat-sessions', 'stat-errors'] },

        { id: 'stat-users', component: 'Card', children: ['stat-users-content'] },
        { id: 'stat-users-content', component: 'CardContent', children: ['stat-users-col'] },
        { id: 'stat-users-col', component: 'Column', gap: 'xs', children: ['stat-users-label', 'stat-users-value'] },
        { id: 'stat-users-label', component: 'Text', variant: 'caption', text: 'Active users' },
        { id: 'stat-users-value', component: 'Text', variant: 'h2', text: '1,204' },

        { id: 'stat-sessions', component: 'Card', children: ['stat-sessions-content'] },
        { id: 'stat-sessions-content', component: 'CardContent', children: ['stat-sessions-col'] },
        { id: 'stat-sessions-col', component: 'Column', gap: 'xs', children: ['stat-sessions-label', 'stat-sessions-value'] },
        { id: 'stat-sessions-label', component: 'Text', variant: 'caption', text: 'Sessions today' },
        { id: 'stat-sessions-value', component: 'Text', variant: 'h2', text: '8,532' },

        { id: 'stat-errors', component: 'Card', children: ['stat-errors-content'] },
        { id: 'stat-errors-content', component: 'CardContent', children: ['stat-errors-col'] },
        { id: 'stat-errors-col', component: 'Column', gap: 'xs', children: ['stat-errors-label', 'stat-errors-value'] },
        { id: 'stat-errors-label', component: 'Text', variant: 'caption', text: 'Error rate' },
        { id: 'stat-errors-value', component: 'Text', variant: 'h2', text: '0.4%' },
      ],
    },
  },
]

// Turn 2 — a SECOND surface (the `transcript.ts` precedent: a follow-up rides a new surface id, never an
// in-place root-type change) adding a refresh affordance: a Row holding one solid Button. No
// `expectClientMessage` — this worked example demonstrates STRUCTURAL composition, not the click round-trip
// (that is `transcript.ts`'s job); clicking it in a live deployment would carry an `action`, exactly like
// the canvas-button seed's Button, but that wiring is out of scope for this example.
const TURN2: A2uiServerMessage[] = [
  { version: 'v1.0', createSurface: { surfaceId: 'dashboard-actions', catalogId: 'agent-ui' } },
  {
    version: 'v1.0',
    updateComponents: {
      surfaceId: 'dashboard-actions',
      components: [
        { id: 'root', component: 'Row', gap: 'sm', children: ['refresh-btn'] },
        {
          id: 'refresh-btn', component: 'Button', label: 'Refresh stats', variant: 'solid',
          action: { action: 'refresh_dashboard' },
        },
      ],
    },
  },
]

/**
 * The Structural Gen UI worked example (ADR-0090 §3): two turns of pre-generated, committed JSONL — a
 * dashboard surface, then a follow-up surface adding a refresh affordance — composed entirely from real
 * default-catalog types, with zero live model involved in producing OR replaying it. Hand this (or any
 * transcript shaped like it) to `createRecordedTransport(transcript)` to render it through the SAME
 * `AgentTransport`/`createRenderer` seam the live path uses.
 */
export const structuralDashboardTranscript: RecordedTranscript = {
  intent: 'Show me a dashboard with a few key stats, and a way to refresh them.',
  turns: [
    {
      lines: TURN1.map(jsonl),
      note: 'Here is a summary dashboard with three KPI cards: active users, sessions today, and the error rate.',
    },
    {
      lines: TURN2.map(jsonl),
      note: 'Added a second surface with a "Refresh stats" button.',
    },
  ],
}
