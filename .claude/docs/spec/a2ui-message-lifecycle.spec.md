# SPEC — A2UI message-lifecycle decision layer

> Status: proposed · v0.1 · 2026-07-11 · Layer: SPEC (execution contract)
> Refines: TKT-0016 (`../tickets/tkt-0016-a2ui-message-lifecycle.md`) under the ratified scope + contract
> directions of [ADR-0126](../adr/0126-a2ui-message-lifecycle-decision-layer.md) (proposed; forks F1–F5 as
> recorded, F2/F5 awaiting Kim's ruling).
>
> **No owning PRD — a deliberate, acknowledged deviation, the `ui-toolbar`/`ui-theme-provider` precedent**: this
> is a scoped teaching+demo effort whose problem statement and acceptance already live in TKT-0016 (a TICKET
> carrying Summary/Acceptance/Links per its own type contract). Known, deliberate gap: the SPEC↔PRD uplink
> harness check fails on this file by construction; recorded as a reviewed deviation, not a silent miss.
>
> Cites [`../spec/a2ui-runtime.spec.md`](../spec/a2ui-runtime.spec.md) §3.2/§3.4 (SPEC-R2 surface
> create/delete, SPEC-R5 data upsert) and [`../spec/a2ui-catalog.spec.md`](../spec/a2ui-catalog.spec.md)
> §5.2 (component-type usage guidance, a *sibling*, orthogonal axis) — this SPEC restates neither; it owns the
> axis neither covers: **which message envelope a producer emits, when, and why.**
>
> Refined by: [`../lld/a2ui-message-lifecycle.lld.md`](../lld/a2ui-message-lifecycle.lld.md). Build plan:
> [`../decompositions/a2ui-message-lifecycle.decomp.json`](../decompositions/a2ui-message-lifecycle.decomp.json)
> (coverage-clean, plan mode).
>
> Altitude: owns **the producer-side decision rules** (when/how to choose `createSurface` /
> `updateComponents` / `updateDataModel` / `deleteSurface`), **the guidance-home ruling**, **the corpus-exemplar
> shape requirement**, and **the dialog demo's acceptance criteria**. Renderer/consumer mechanics stay the
> runtime SPEC's; component-type choice stays the catalog SPEC's; exact prompt wording / skill-file diffs /
> transcript script contents are the LLD's. Requirement IDs file-scoped (`SPEC-R1…`).

---

## 1. Purpose

A producer of A2UI messages — the live-agent system prompt, a human authoring via the `a2ui-compose` skill, or
a corpus exemplar — must choose, on every turn, which of the four server→client message types to emit. All four
are shipped, mechanically correct, end-to-end (`protocol.ts`, `renderer/dispatch.ts`, `renderer/renderer.ts`,
`renderer/tree.ts`). What is missing is the **decision layer**: the crystal-clear when/how rule for each type,
taught to every producer, and a dialog demo that exercises the full four-type lifecycle visibly so the rule is
provable, not merely asserted.

## 2. Definitions

- **Lifecycle event** — one of the four server→client message types considered as a *producer decision point*,
  as distinct from its renderer-side mechanics (owned by the runtime SPEC): `createSurface` (open),
  `updateComponents` (restructure), `updateDataModel` (react), `deleteSurface` (close).
- **Structural change** — a change to a surface's component *shape*: a node added, removed, or having any of its
  props/`child`/`children` altered. Requires `updateComponents`.
- **Data-only change** — a change to a value an already-rendered node's prop is *bound* to (`{path}`), with no
  change to the component tree's shape. Requires `updateDataModel` alone.
- **Task boundary** — the point in a dialog where the user's focus moves to a new, independent unit of work not
  meaningfully a continuation of the current surface's subject.
- **Whole-record upsert** — the `updateComponents` semantic (verified `renderer/tree.ts:85`,
  `this.#surface.components.set(comp.id, comp)`): resending an existing component `id` **replaces its entire
  prop/child record**, not a shallow merge of only the changed keys.

---

## 3. Requirements

### 3.1 The four-type decision rule

**SPEC-R1 — Message-type selection rule.** A producer choosing how to reflect a conversational change onto an
existing or new surface MUST apply, in this order:

1. **Data-only change on an existing surface → `updateDataModel`, same `surfaceId`, never a re-emit of
   `updateComponents`.** The per-path reactive binding exists for exactly this (runtime SPEC-R5 AC1 / SPEC-N2 —
   a bound value updates the widget with no message re-send of the component tree). Re-emitting
   `updateComponents` for a pure value change is wasted work and — per SPEC-R2 below — risks silently dropping
   unrelated props on the resent node.
2. **Structural change on an existing surface → `updateComponents`, same `surfaceId`.** A node added, removed,
   or whose props/children actually change shape needs a new/updated adjacency-list entry (runtime SPEC-R3/R4).
   See SPEC-R2 for the whole-record-upsert sub-rule this implies.
3. **A new task boundary in the dialog → `createSurface` with a FRESH `surfaceId`,** rather than mutating the
   current surface into an unrelated shape. Grounded by the corpus's own one-surface-per-record discipline
   (catalog-adjacent: `a2ui-training-corpus.spec.md` SPEC-R2/ADR-0064) — if a single exemplar record is
   disciplined to one surface per unit of work, the live equivalent is: one surface per unit of work in the
   dialog. The shipped `a2ui-live` recorded transcript already does this (turn 2 opens `confirmation` as a new
   surface rather than repurposing `canvas`).
4. **A surface's task is complete/superseded → `deleteSurface` when — and only when — leaving it visible would
   sit stale or confuse a later turn; otherwise leave it in place (no explicit lifecycle event) as a standing
   part of the dialog's visible history** (ADR-0126 F5). `deleteSurface` is a leak-free, explicit teardown
   (runtime SPEC-R2 AC2/SPEC-N3) — reach for it to actually remove a surface the user no longer needs to see,
   not as a default cleanup ritual applied to every finished turn.

- **AC1** *Given* a surface bound to `/count` and a turn that only changes the count's value, *when* the
  producer decides, *then* it emits `updateDataModel{surfaceId, path:"/count", value}` alone — no
  `updateComponents` message for that turn.
- **AC2** *Given* a surface with an existing node and a turn that adds a new sibling node, *when* the producer
  decides, *then* it emits `updateComponents` targeting the SAME `surfaceId`, including both the parent's
  updated `children` list and the new node's own record in one message (or an out-of-order-tolerant pair per
  runtime SPEC-R4).
- **AC3** *Given* a dialog turn whose subject is unrelated to any currently open surface, *when* the producer
  decides, *then* it emits `createSurface` with a `surfaceId` not previously used in the conversation, leaving
  prior surfaces untouched.
- **AC4** *Given* a surface whose task the dialog has explicitly closed out (e.g. an acknowledgement surface
  once superseded by later content) *when* the producer decides, *then* it emits `deleteSurface` for that
  `surfaceId`; *given* a surface that remains a valid part of the visible record (e.g. the durable subject of
  the dialog), *then* no lifecycle event fires for it — it is simply left in place.

**SPEC-R2 — Whole-record upsert sub-rule.** A producer resending an existing component `id` via
`updateComponents` MUST include that node's COMPLETE prop set (every prop that should still apply, not only the
changed ones) and its complete `child`/`children` reference, because the renderer replaces the stored record for
that `id` wholesale (verified `renderer/tree.ts:85`) — there is no partial-prop-patch semantic. Adding a child to
an existing container REQUIRES resending the parent's own record with its updated `children` list, in the same
or an out-of-order-tolerant later message (the `Select`+`Option` "ship together" precedent, `a2ui-compose`
`node-idioms.md`, generalizes to every container). *(→ TKT-0016 "updateComponents partial semantics" open item —
now settled: it is never partial.)* **Root carve-out (REV 2026-07-11, build-time repair):** the ONE id this
resend rule can never touch is `"root"` — the shipped runtime rejects any second `id:"root"` delivery as
`IDGRAPH` and keeps the original, no whole-record-resend exception (runtime SPEC-R3 AC2, `renderer/tree.ts`'s
`#rootDelivered` guard; proven empirically at build via `validate-payload`). A producer whose surface may grow
MUST deliver root as a stable, never-resent wrapper (e.g. a `Column`) and place the mutable container one level
down under its own non-root id.
- **AC1** *Given* a node `{id:"btn", component:"Button", label:"Go", action:{...}}` re-emitted as
  `{id:"btn", component:"Button", label:"Go!"}` (omitting `action`), *when* applied, *then* the node's `action`
  is gone — the omission is a silent drop, not a preserved prior value. A producer MUST NOT rely on partial
  resends.
- **AC2** *Given* a container `{id:"row", children:["a","b"]}` and a turn that adds child `"c"`, *when* the
  producer decides, *then* it re-emits `{id:"row", children:["a","b","c"]}` alongside the new `"c"` node record.

### 3.2 Guidance home

**SPEC-R3 — This document is the single normative owner of the decision layer.** No other document restates
these rules; `a2ui-catalog.spec.md` and `a2ui-runtime.spec.md` are cited, not edited, by this wave (ADR-0126 F1).
Three build-phase teaching surfaces conform to this SPEC without duplicating its prose verbatim:
1. The live-agent machine system prompt (`tools/agent/system-prompt.ts`'s `GRAMMAR`) — the LLD names the exact
   insertion point (ADR-0126 F2).
2. The `a2ui-compose` skill's mental model (`.claude/skills/a2ui-compose/SKILL.md`) — widened from three message
   kinds to four, plus one new "Common trap" entry for SPEC-R2.
3. A corpus exemplar record (§3.3) — a worked instance a retrieval-conditioned generation can imitate.
- **AC1** *Given* a future edit to any of the three teaching surfaces above, *when* reviewed, *then* it cites
  this SPEC's requirement IDs rather than re-deriving the rule from first principles (the ADR-0087 "one hand-
  authored source, never re-spelled" discipline, reapplied to producer-policy prose).

### 3.3 Corpus-exemplar requirement

**SPEC-R4 — A validator-clean, single-surface, four-type exemplar SHAPE.** An exemplar seed (authored under
`src/examples/`, LLD-C4) MUST exist whose `a2uiOutput` carries, in order, at least one instance of
`createSurface`, `updateComponents`, `updateDataModel`, and `deleteSurface` — **all four addressing the SAME
`surfaceId`** (a2ui-training-corpus SPEC-R2/ADR-0064: an exemplar's `a2uiOutput` MUST address exactly one
surface; `deleteSurface` is explicitly among the counted surface-bearing kinds). No `CorpusRecord` schema change
is required — the single-surface discipline already accommodates a full open→restructure→react→close arc as one
ordered stream against one `surfaceId`; a genuinely NEW task boundary (SPEC-R1 rule 3) is therefore modeled as a
SEPARATE exemplar record with its own `surfaceId`, never folded into the same record as the arc above. **Owed by
this intake's build:** the authored seed + its fixture-validation test (LLD-C4). **NOT owed** (a separate,
already-standing follow-up, token-surfaces M2 wave): admission into the curated corpus store (import, dedup,
judge scoring) — a validated seed under `src/examples/` is not automatically an admitted corpus record, and
this SPEC does not require that step here.
- **AC1** *Given* the exemplar's `a2uiOutput` run through `validate-payload`/the shared validator per message in
  sequence (treating each prefix of the stream as the surface's state at that point, the `round-trip.test.ts`
  method), *then* every message validates with 0 errors and the final `deleteSurface` leaves no orphaned
  references.
- **AC2** *Given* the exemplar's `updateComponents` message(s), *then* they satisfy SPEC-R2 (whole-record
  resends, not partial patches).

### 3.4 The dialog demo (Lane 2)

**SPEC-R5 — Visible, annotated four-type arc.** A site demo MUST drive a real renderer through a scripted,
multi-turn dialog exercising all four message types against the SAME surface lifecycle rules as SPEC-R1, with
each turn's rationale visible (which type fired, and why) alongside the real wire JSON — the honest-labels,
"the demo IS the integration proof" site discipline. *(→ ADR-0126 F4: vehicle is `a2ui-live`'s recorded
transcript, not a new page.)*
- **AC1** *Given* the demo's scripted turns, *when* replayed in order, *then* one turn creates a surface (or
  reuses the existing `canvas`/`confirmation` precedent), a later turn restructures it (`updateComponents`), a
  later turn changes only bound data (`updateDataModel`) with **no** accompanying `updateComponents` in that
  turn's lines, and a closing turn deletes a surface whose task is superseded (`deleteSurface`) — while a
  surface that remains a valid part of the record is left undeleted (SPEC-R1 rule 4 / ADR-0126 F5).
- **AC2** *Given* the data-only turn specifically, *when* inspected via the demo's existing JSON tab, *then* its
  emitted lines contain exactly one `updateDataModel` message and zero `updateComponents`/`createSurface`
  messages for that turn — the "reacts without re-render" proof the ticket names.
- **AC3** *Given* each scripted turn, *when* it plays, *then* the demo surfaces a short annotation naming which
  message type fired and why (reusing the existing per-turn `note` meta-line mechanism, ADR-0088 §1 — no new
  annotation chrome required).
- **AC4** *Given* the closing `deleteSurface` turn, *when* it plays, *then* the deleted surface's rendered
  markup is provably gone from the demo's existing HTML tab (the renderer's real DOM teardown, runtime
  SPEC-R2 AC2), not merely asserted in prose.

### 3.5 Non-functional requirements

| ID | Requirement | Target |
|---|---|---|
| **SPEC-N1** | No protocol change | Zero edits to `protocol.ts`'s wire types or `renderer/dispatch.ts`'s routing — every rule is producer-side POLICY over already-shipped mechanics (TKT-0016 non-goal). |
| **SPEC-N2** | No chat framework | The demo reuses `a2ui-live`'s existing chat/canvas/transcript machinery; no new conversational engine is introduced (TKT-0016 non-goal). |
| **SPEC-N3** | Single-owner guidance | The decision rules exist in exactly one normative place (this document); the three teaching surfaces (§3.2) cite, never restate. |
| **SPEC-N4** | Prompt growth is bounded and visible | The GRAMMAR insertion (LLD-owned exact text) is reviewed as a named, deliberate, permanent addition to every generative call's token cost (ADR-0126 F2) — never a silent accretion. |

---

## 4. Non-goals (explicit fences)

- **Protocol/wire changes** — `protocol.ts`'s message types and `renderer/dispatch.ts`'s routing are untouched;
  every rule here is producer-side policy over already-shipped mechanics.
- **A chat framework** — the demo reuses `a2ui-live`'s existing chat/canvas/transcript machinery verbatim; no
  new conversational engine, session model, or transport is introduced.
- **Corpus admission** — importing, deduping, or judge-scoring the exemplar into the curated corpus store is a
  separate, already-standing follow-up (token-surfaces M2 wave); this SPEC requires only the exemplar's shape
  (SPEC-R4).
- **A `ui-command-modal`/`ui-color-picker`-style new component** — this wave ships no new `ui-*` control; it is
  documents + a machine-prompt/skill/transcript diff only.
- **Coupling to `a2ui-chat` (TKT-0013)** — the demo may later serve as that surface's embryo; this SPEC takes
  no dependency on it and makes no design concession toward it.
- **Re-litigating the catalog SPEC's §5.2 component-type guidance or the runtime SPEC's renderer mechanics** —
  both are cited, not amended, by this wave.

## 5. Examples

Illustrative (normative for shape, not exhaustive) — the arc a demo turn or an authored corpus exemplar should
reproduce. The full worked JSONL stream (a `kpi-panel` surface: open → restructure → data-only react → close)
is LLD-C4's; the shape below is the minimal skeleton every implementation must match.

```jsonc
// 1. open (SPEC-R1 rule 3) — a fresh surfaceId for a new task boundary
{"version":"v1.0","createSurface":{"surfaceId":"kpi-panel","catalogId":"agent-ui"}}
{"version":"v1.0","updateComponents":{"surfaceId":"kpi-panel","components":[ /* whole tree, SPEC-R2 */ ]}}

// 2. restructure (SPEC-R1 rule 2 / SPEC-R2) — the changed node's FULL prop/children set, not a diff
{"version":"v1.0","updateComponents":{"surfaceId":"kpi-panel","components":[ /* the resent node(s), whole */ ]}}

// 3. react (SPEC-R1 rule 1) — data only; NO updateComponents in this step
{"version":"v1.0","updateDataModel":{"surfaceId":"kpi-panel","path":"/revenue","value":131500}}

// 4. close (SPEC-R1 rule 4) — the task is superseded; the surface is explicitly torn down
{"version":"v1.0","deleteSurface":{"surfaceId":"kpi-panel"}}
```

**A surface that is NOT deleted** (SPEC-R1 rule 4's "otherwise" arm) — the shipped `a2ui-live` transcript's own
`canvas` surface, which turn 2 leaves untouched while opening `confirmation` as a new surface: no
`deleteSurface` message is emitted for `canvas` at any point, because it remains a valid, standing part of the
dialog's visible record.

## 6. Trace

| Requirement | Ticket / ADR trace |
|---|---|
| SPEC-R1, R2 | TKT-0016 Lane 1 (the when/how rule table); ADR-0126 F2/F3 |
| SPEC-R3 | TKT-0016 "guidance's exact home" open item; ADR-0126 F1 |
| SPEC-R4 | TKT-0016 "corpus exemplar" acceptance line; ADR-0126 (consequence of ADR-0064) |
| SPEC-R5 | TKT-0016 Lane 2; ADR-0126 F4/F5 |

## 7. Open items (non-normative)

- Exact GRAMMAR bullet wording and the `a2ui-compose` skill diff are the LLD's (build-phase, not frozen here).
- The exemplar's exact `promptText` framing (a single literal ask vs a short narrated arc) is left to the
  corpus-curation follow-up that actually authors and admits it.
- Whether this demo becomes the `a2ui-chat` (TKT-0013) embryo is flagged, not decided — no coupling is taken in
  this SPEC or its LLD.
