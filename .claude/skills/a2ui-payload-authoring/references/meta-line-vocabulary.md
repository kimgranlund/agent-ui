# The meta-line reserved vocabulary — the envelope's MODEL-authored arms as a growth axis

> Source: ADR-0088 · ADR-0097 · ADR-0174 · ADR-0178 · ADR-0198 (+ its two ratified amendments) ·
> ADR-0204 · ADR-0206 (`.claude/docs/adr/`). Verified against those records 2026-08-18. This file
> tracks the AXIS — the reserved vocabulary and the laws every new arm inherits — the way
> component-patterns' patterns-table tracks the host-custom-state vocabulary. The per-arm SPEC rows
> (`a2ui-live-agent.spec.md`'s reserved-field table) stay the normative wire contract; this file is
> the pattern record a payload/stream author conditions on.

## What the meta-line is (and is not)

A `produce()` turn's FIRST line is a framing envelope: `{"a2uiMeta":{...}}` — a demo-transport
FRAMING convention, provably NOT an `A2uiServerMessage` (no `version` key, none of the fixed
envelope keys), peeled by `readMetaLine` BEFORE the validator, never entering the corpus path
(SPEC-N3 wire purity — restated by every arm's ADR). Adding a field here widens ZERO A2UI protocol
wire, touches no validator law, and needs no catalog change. The envelope also carries
runtime-composed fields (`note`, `trace`, `progress`, `error`); this file tracks only the
MODEL-authored arms — structural facts the model declares.

## The six ratified MODEL-authored arms

| # | Arm | ADR | What the model declares | Shape (as ratified) |
|---|---|---|---|---|
| — | (envelope minted) | 0088 | `note`/`trace` conversational side-channel — the arms below ride this seam | `{"a2uiMeta":{"note":"…"}}` |
| 1 | `ask` | 0097 | A structured, feed-embedded question (closed-set / typed-value answer) with a per-message frozen-history lifecycle; answers ride the existing `action` arm + `sendDataModel` | routing field on the envelope; exact shape per SPEC-R14 |
| 2 | `plan` | 0174 | An opt-in multi-step task decomposition the host loop executes sequentially; steps render live via the shipped status-stream grouping | `plan: { steps: [{ id, description }] }` (exact shape pinned at SPEC/LLD) |
| 3 | `personaPatch` | 0178 | Partial persona-state deltas during the Builder interview (the `PERSONA_STATE_KEYS` universe), merged incrementally per turn, applied HOST-side through the per-key-sanitizer gate | partial record; gate-keyed (`SURFACE_*_KEY`), off ⇒ never consumed |
| 4 | `flowEnd` | 0198 | "This turn closes the flow" — the closing turn after the flow-final confirm (and every other terminal path, per amendment A1) | bare `true`; anything else drops only the field. Additively widenable to `true \| {...}` later |
| 5 | `team` | 0204 | A name-only proposed roster the Builder one-shots: `label`/`tagline?` + `members: {name, role, routingDescription}[]`; GM is host-designated, never on the wire | whole-arm validated; consumed ONLY via `ui-agent-admin`'s `onTeamDeclared` seam (unregistered ⇒ silent drop) |
| 6 | `target` | 0206 | The `surfaceId` this turn is about to MUTATE — the one truthful early signal under validate-then-stream; omitted on fresh-surface or no-A2UI turns, never a placeholder | `target?: { surfaceId: string }` — object-wrapped deliberately (additive-widening door), never a bare string |

## The laws every arm inherits (the growth axis's invariants)

Each new arm has applied these point-for-point; a proposed seventh arm that breaks one needs its
own ADR-argued exception, not silence:

1. **Model-authored.** The model declares the fact (like `note`/`ask`), never runtime-composed
   (like `progress`/`trace`/`error`). The seam exists for facts ONLY the model holds — see the
   transferable lesson below.
2. **Additive-only vocabulary.** The envelope stays versionless; `AgentTransport.turn`'s signature
   stays byte-identical; existing fields are never touched. Unknown keys are dropped by
   `readMetaLine`, so old readers degrade silently.
3. **Shallow per-field validation, whole-arm granularity.** A malformed arm drops ONLY itself —
   never the envelope, never a sibling field on the same line. And the arm validates as a WHOLE:
   `plan` drops entirely on one malformed step, `personaPatch` on one malformed member, `team` on
   any member missing a string field, `target` on a missing/non-string `surfaceId` — "a half-parsed
   roster is the one shape a host mint loop must never be handed" (ADR-0204 cl.2); "a
   wrong-but-present target would breathe the WRONG card with full apparent authority" (ADR-0206
   cl.2).
4. **Gate-blind pass-through in `produce()`.** No integrity check, no re-validation, no semantic
   truthfulness check — `produce()` is a pure wire carrier in both the peel path and
   `formatMetaLine`'s writer. Whether an arm is CONSUMED is entirely the host's call; an arm with
   no registered consumer degrades to a silent no-op (the SPEC-R30 posture).
5. **The mechanics teaching lands in `GRAMMAR`** (host-owned, byte-pinned — the prompt-pin
   baseline re-captures in the same slice), never in a persona-editable entry or an optional
   mini-skill when the behavior must be unconditional (ADR-0174 cl.6 / ADR-0198 cl.2).

One structural corollary the lineage keeps proving: **a categorically different proposal earns its
own arm, never an overload** — `team` did not ride `personaPatch` (creation ≠ mutation, ADR-0204),
`flowEnd` did not ride `plan` or `ask.final` (the signal belongs on the turn it describes,
ADR-0198).

## ADR-0198's two ratified amendments — the answered-ask freeze and the closing turn

The `flowEnd` record carries two ratified amendments (2026-08-17 and 2026-08-18) a stream author
must compose correctly:

- **The answered-ask freeze begins at the flow-final confirm — not before (B1).** The freeze
  ("never update/delete/rebuild a surface once its ask is answered; declare a NEW ask with a fresh
  `ask-<n>` id") applies ONLY from the moment the flow-final confirm is committed. Every mid-flow
  Next/Back turn in a backable wizard is a **scene transition on ONE still-open ask**: the producer's
  `updateComponents` swaps the scene container's children (a stable child id under the root-once
  wrapper), the ask keeps its ONE `ask-<n>` id for the whole wizard, and draft state lives under a
  `/draft/*` data-model prefix that survives every scene swap — Back is free because nothing has
  been committed yet. This reconciled a head-on collision between the shipped surface-reuse law and
  the shipped answered-ask law; neither is optional, the scoping is the resolution.
- **The closing turn's ONE exception to "emits no A2UI" (B2).** The courtesy-close turn (prose
  `note` + `flowEnd: true`, no new ask) MAY carry exactly one settling `updateComponents` against
  the already-confirmed receipt's surface — strip its Back/Confirm buttons, add a settled-status
  Badge — in the SAME turn as the close. At most once per flow; never a fresh surface, never any
  other card; never on the escalation path (a pure safety-directive close has no receipt to
  settle); never a `deleteSurface` (the confirmed receipt stays a durable history anchor).
  Everything else about the closing turn stands: no new ask, and the done/start-over chrome
  renders after it.

Also from the first amendment: `flowEnd: true` fires on ALL terminal paths — happy completion,
escalation/early stop, and model-visible abandonment — and the flow-final confirm itself is an
ORDINARY `ask` (the proposed-outcome turn carries the ask and NEVER `flowEnd`; the close follows
the user's commit).

## The transferable lesson (ADR-0206): a truthful stated signal beats a heuristic guess

GH #1134 patched the ~0ms `working`-breathe gap with an optimistic guess — sole open surface ⇒
breathe it at turn start — and GH #1259's live repro proved the wrong-guess branch fires in the
COMMON case (a one-card chat, an unrelated question). Kim's ruling retired the heuristic for the
`target` arm, and rejected even NARROWER heuristics explicitly: a heuristic, however refined, is
still a guess about a fact the model already knows and could simply state; refining it lowers the
wrong-guess RATE but never reaches zero, while the stated signal is truthful when present and
honestly absent when not (the consumer degrades to late-but-never-wrong, the pre-heuristic timing).
**Whenever the model already holds the fact, put the fact on the wire — the meta-line is the seam
built for exactly this class of early, model-known routing fact.** The same lesson in its earlier
form: ADR-0187 (only the party holding "is this final?" can assert it) and ADR-0198's rejection of
chrome-side completion inference.
