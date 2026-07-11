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
//
// ADR-0126 (TKT-0016, a2ui-message-lifecycle.lld.md LLD-C5): turns 3-5 complete the four-type lifecycle
// arc on TOP of the shipped turn 1/2 script — restructure (turn 3) / data-only react (turn 4) / close
// (turn 5). DEVIATION from the LLD's literal worked script (flagged to the team lead during build, needs
// a coordinated LLD repair): the LLD's turn 3 resends `id:"root"` itself (wrapping canvas's Button in a
// Column). That resend is NOT legal — runtime SPEC-R3 AC2 (`renderer/tree.ts`'s `#rootDelivered` guard)
// treats ANY second delivery of `id:"root"` as an id-graph error and drops it, keeping the ORIGINAL root;
// it would silently never show the wrapping Column at all. Also, `canvas`'s root is already a childless
// `Button` (the shared `canvas-button.ts` shelf seed, out of this LLD's file scope to reshape) — there is
// no way to add a sibling under it without first changing what `root` IS, which the renderer refuses.
//
// Fixed by retargeting the restructure/react/close arc onto "confirmation" instead of "canvas", and by
// widening turn 2's OWN tree (this module's, freely reshapable) with one stable extra level: `root` (a
// Column) is delivered once and never resent; `group`, one level down (a plain non-root id), is the
// MUTABLE container turn 3 resends whole to add the new "status" Text — the same SPEC-R2 whole-record-
// upsert teaching the LLD intended, just never touching the one id the renderer refuses to re-deliver.
// `canvas` (turn 1) is untouched by any of turns 2-5 — it is the demo's "durable, never-deleted" subject
// (SPEC-R1 rule 4's "otherwise" arm); `confirmation` runs its whole open→restructure→react→close arc and
// is the one turn 5 deletes once superseded (ADR-0126 F5).

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
// interaction. `root` (a Column, catalog-valid: Grid/Column/Row all declare a `ChildList` children model)
// is a STABLE wrapper delivered ONCE and never resent — runtime SPEC-R3 AC2 forbids a 2nd `id:"root"`
// delivery outright, so the actually-mutable container `group`, one level down (a plain non-root id), is
// what turn 3 resends whole to add the "status" Text (SPEC-R2 whole-record upsert). This is a NEW surface
// id, so the renderer attaches a second root under the mount (no in-place type change of turn-1's Button
// root either way).
const TURN2: A2uiServerMessage[] = [
  { version: 'v1.0', createSurface: { surfaceId: 'confirmation', catalogId: 'agent-ui' } },
  {
    version: 'v1.0',
    updateComponents: {
      surfaceId: 'confirmation',
      components: [
        { id: 'root', component: 'Column', gap: 'sm', children: ['group'] },
        { id: 'group', component: 'Column', gap: 'sm', children: ['msg'] },
        {
          id: 'msg',
          component: 'Text',
          text: 'Thanks — you clicked the button. The agent continues: this second surface is turn 2 of the conversation.',
        },
      ],
    },
  },
]

// Turn 3 — restructure the SAME "confirmation" surface (SPEC-R1 rule 2 / ADR-0126). `group` (NOT `root`)
// is resent WHOLE — its existing `gap` prop carried forward, its `children` list grown from `["msg"]` to
// `["msg","status"]` — alongside the new `status` Text node, in the same message (SPEC-R2's whole-record-
// upsert rule; the `Select`+`Option` "ship together" precedent, generalized to any container).
const TURN3: A2uiServerMessage[] = [
  {
    version: 'v1.0',
    updateComponents: {
      surfaceId: 'confirmation',
      components: [
        { id: 'group', component: 'Column', gap: 'sm', children: ['msg', 'status'] },
        { id: 'status', component: 'Text', text: { path: '/status' } },
      ],
    },
  },
  { version: 'v1.0', updateDataModel: { surfaceId: 'confirmation', path: '/status', value: 'Ready' } },
]

// Turn 4 — data-ONLY change (SPEC-R1 rule 1 / SPEC-R5 AC2): no updateComponents in this turn's lines.
const TURN4: A2uiServerMessage[] = [
  { version: 'v1.0', updateDataModel: { surfaceId: 'confirmation', path: '/status', value: 'Clicked again' } },
]

// Turn 5 — "confirmation"'s whole job (acknowledging turn 1's click, then narrating a status update) is
// now complete; leaving it visible would sit stale next to whatever the dialog does next (SPEC-R1 rule 4 /
// ADR-0126 F5). `canvas` — the durable subject of the dialog — is never deleted in this script.
const TURN5: A2uiServerMessage[] = [{ version: 'v1.0', deleteSurface: { surfaceId: 'confirmation' } }]

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
    {
      lines: TURN3.map(jsonl),
      // Honest per-turn rationale (ADR-0126): a structural change on the SAME confirmation surface, so
      // updateComponents — resending its "group" container's full record, not a diff.
      note: 'I added a status line to the confirmation surface — a structural change, so I used updateComponents (resending its container\'s full record), not a new surface.',
    },
    {
      lines: TURN4.map(jsonl),
      // Honest per-turn rationale: only the bound value changed — updateDataModel alone, no re-render.
      note: 'Just the status text changed — I updated the data model only; confirmation\'s layout is untouched.',
    },
    {
      lines: TURN5.map(jsonl),
      // Honest per-turn rationale (ADR-0126 F5): confirmation's job is done and would sit stale, so it's
      // explicitly closed; canvas — the durable subject of the conversation — stays.
      note: 'The confirmation surface\'s job is done — I closed it. I left canvas open; it\'s still the point of the conversation.',
    },
  ],
}
