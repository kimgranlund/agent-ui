# ADR-0126 — the A2UI message-lifecycle decision layer: one new SPEC/LLD, a GRAMMAR-floor insertion point, and the demo's delete-vs-keep rule

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-07-11
>
> | Field | Value |
> |---|---|
> | **Status** | proposed |
> | **Date** | 2026-07-11 |
> | **Proposed by** | design intake (TKT-0016, Kim's ask 2026-07-10: teach + demo the crystal-clear when/how of the four A2UI server→client message types — `createSurface`/`updateComponents`/`updateDataModel`/`deleteSurface`). Dedup: every mechanism already ships (`protocol.ts`, `renderer/dispatch.ts`, `renderer/renderer.ts`, `renderer/tree.ts` — `deleteSurface` fully wired: `#onDeleteSurface` tears down DOM + disposes the store); the gap is the **decision layer** — nothing teaches an agent WHEN to reach for each, and no demo exercises the full four-type lifecycle visibly. `deleteSurface` does not appear anywhere in `tools/agent/system-prompt.ts`'s `GRAMMAR` today (verified: zero occurrences) — the generating model has no way to know the message even exists. |
> | **Ratified by** | _pending Kim review — forks F2/F5 below need a firm ruling; F1/F3/F4 are settled from shipped mechanics, recorded here for the record_ |
> | **Repairs** | NEW [`../spec/a2ui-message-lifecycle.spec.md`](../spec/a2ui-message-lifecycle.spec.md) · NEW [`../lld/a2ui-message-lifecycle.lld.md`](../lld/a2ui-message-lifecycle.lld.md) · NEW [`../decompositions/a2ui-message-lifecycle.decomp.json`](../decompositions/a2ui-message-lifecycle.decomp.json) (coverage-clean, plan mode). On ratification+build (NOT this intake): `packages/agent-ui/a2ui/tools/agent/system-prompt.ts` (`GRAMMAR`'s "Output rules" section gains the four-type choice bullets + the `deleteSurface` wire shape) · `.claude/skills/a2ui-compose/SKILL.md` (mental model widens from three kinds to four; a new Common-trap entry for the whole-record upsert rule) · `packages/agent-ui/a2ui/tools/agent/transcript.ts` (the `a2ui-live` recorded transcript gains 2–3 turns completing the lifecycle arc) · a new corpus exemplar record (rides the standing corpus-admission follow-up, not owed here) |
> | **Supersedes / Superseded by** | relates ADR-0071 (the catalog-derived system prompt this teaching extends) · relates ADR-0088/0089/0090/0091 (the note-line, clarify/negotiate, mode-axis, and mini-skill additions to the SAME `system-prompt.ts` composition — the precedent this ADR follows: every past addition to `GRAMMAR`/`buildSystemPrompt` earned its own numbered ADR) · relates ADR-0064 (the corpus single-surface rule this exemplar's shape satisfies directly) · relates ADR-0097 (the feed sub-catalog partition — this lifecycle teaching is orthogonal to it: a feed ask is single-surface, single-turn, and never itself deletes a surface) |

## Context

`@agent-ui/a2ui` ships all four server→client message types end-to-end: `protocol.ts` types them,
`renderer/dispatch.ts` routes them, `renderer/renderer.ts` applies them (`#onCreateSurface`/`#onUpdateComponents`/
`#onUpdateDataModel`/`#onDeleteSurface` — the last one verified: it tears down the mounted DOM subtree AND
disposes the surface's store entry, `renderer.ts:283-286`), and `renderer/tree.ts` upserts components by id
(`this.#surface.components.set(comp.id, comp)`, `tree.ts:85` — a **whole-record replace**, never a shallow
prop-merge). None of this is missing. What is missing is the **decision layer**: a producer (the live-agent
system prompt, a human composing via `a2ui-compose`, a corpus exemplar) has no authoritative teaching for
*which* message type a given conversational moment calls for, and the machine prompt (`system-prompt.ts`'s
`GRAMMAR`) never mentions `deleteSurface` at all — confirmed by grep, zero occurrences.

This is a **teaching + demo** intake, not a component intake — `agent-ui-component-design` does not apply.
The center of gravity is: (1) where the normative decision rules live, (2) how they reach the three teaching
surfaces (system prompt, `a2ui-compose` skill, corpus exemplar) without duplicating or drifting, and (3) how
the site demo makes the arc visible. Two genuine Kim-decidable forks surface below (F2, F5); the rest are
settled directly from shipped mechanics and precedent, recorded here so the SPEC/LLD do not silently assume
them.

### The reuse ledger (the precedent sweep, argued per row)

| Existing mechanism | What it already proves | What it does NOT give us |
|---|---|---|
| `renderer/tree.ts:85` (`components.set(comp.id, comp)`) | `updateComponents` is a whole-record upsert-by-id — resending an id REPLACES its entire prop/child bag, never merges | No prose anywhere tells an agent this — a naive "just send the changed prop" would silently drop every other prop on that node |
| `renderer/renderer.ts:283-286` (`#onDeleteSurface`) | `deleteSurface` fully tears down DOM + store, leak-free (SPEC-N3) | The system prompt never mentions it — an agent cannot choose what it does not know exists |
| `a2ui-catalog.spec.md` §5.2's per-type "usage guidance" callouts (List-vs-Grid, Chart-vs-Stat-vs-Table, …) | The established pattern for prompt-facing decision prose living ALONGSIDE (not inside) a mechanical requirements section, cited from multiple build waves | Those callouts choose a **component type**; the axis here is the **message envelope**, a different altitude the catalog SPEC does not own |
| `a2ui-runtime.spec.md` §3.2/§3.4 (SPEC-R2 surface lifecycle, SPEC-R5 data-model upsert) | The renderer-side MECHANICS of all four types, already normative | Nothing about WHEN a producer should reach for one over another — that SPEC owns consumer behavior, not producer policy |
| `tools/agent/system-prompt.ts`'s `HONESTY_FLOOR` (ADR-0090 §2) | The precedent for a mode-INVARIANT paragraph every mode composes identically | `HONESTY_FLOOR` is a separate constant threaded through `grammarFor`'s three branches — adding a FOURTH branch-threaded constant means editing 3 call sites, a real (if small) drift surface |
| `tools/agent/mini-skills.ts` (ADR-0091) | The precedent for intent-TRIGGERED, selectively-composed teaching | Wrong fit here: message-type choice applies to literally every generative turn, not just turns matching lifecycle-flavored trigger words — a mini-skill would silently omit the rule on an unrelated-sounding turn |
| `tools/agent/transcript.ts` (the `a2ui-live` recorded backbone) | A working, already-multi-turn, already-multi-surface script (turn 1 = `canvas`, turn 2 = a NEW `confirmation` surface, `canvas` never deleted) + the `note` per-turn annotation mechanism (ADR-0088 §1) already renders "which type fired and why" prose per turn | Not itself proof of `updateDataModel`-only reactivity or `deleteSurface` — those turns don't exist yet |
| corpus `record.ts` + `a2ui-training-corpus.spec.md` SPEC-R2/ADR-0064 | An exemplar's `a2uiOutput` MUST address exactly ONE `surfaceId`; `deleteSurface` is explicitly counted among the surface-bearing kinds that rule covers | No multi-turn/session field on `CorpusRecord` — a "dialog" exemplar must fit inside ONE ordered message stream, not a literal array of turns |

## Decision

**F1 — Guidance home: a new, dedicated SPEC — `a2ui-message-lifecycle.spec.md` — not §5.2 of the catalog SPEC,
not the runtime SPEC's lifecycle sections (settled from mechanics, not a taste fork).** The catalog SPEC's §5.2
owns **component-type** choice (an orthogonal axis — which `ui-*` widget renders a node); the runtime SPEC's
§3.2/§3.4 own **renderer-side mechanics** (what happens once a message arrives). Neither owns the
**producer-side policy** of which message envelope to emit for a given conversational moment — that is a third
altitude with no existing owner. The new SPEC REFINES both (cites SPEC-R2/R5/R3/R4 mechanics and catalog
SPEC-R2's one-surface-per-record discipline; restates neither) and is the single document the three teaching
surfaces below must conform to.

**F2 — GRAMMAR insertion point: append the four-type choice rules + the `deleteSurface` wire shape as new
bullets inside `GRAMMAR`'s existing "Output rules for the A2UI JSONL" section, in the mode-invariant `OUTPUT_RULES`
zone — NOT a fourth `grammarFor`-threaded constant, NOT a mini-skill. Kim's call to confirm.** `OUTPUT_RULES` is
sliced as `GRAMMAR.slice(GRAMMAR.indexOf(OUTPUT_MARKER)).trim()` (`system-prompt.ts:140`) — everything from that
marker to the end of the literal. Appending new content there (or anywhere after the marker) reaches ALL THREE
modes automatically and by construction: `'default'`/absent returns `GRAMMAR` verbatim (includes it), `'specific'`/
`'blue-sky'` compose `OUTPUT_RULES` (includes it) — zero new plumbing, and the existing `assertMarkersHold()`
guard is untouched (neither marker string moves). The alternative of a fourth `HONESTY_FLOOR`-style constant
threaded through `grammarFor`'s three branches works too but adds three call-site edits for content that reads
naturally as more "Output rules" prose; a mini-skill is the wrong shape entirely (intent-triggered, and this
rule must apply unconditionally, every turn). **Named consequence:** this changes the literal `GRAMMAR` string,
so `buildSystemPrompt(catalog, [])`'s exact default-mode output grows relative to today's shipped ADR-0089 text.
No test pins an exact full-string snapshot (`prompt-drift.test.ts`/`system-prompt-grammar.test.ts` both use
`toContain`/`toMatch`, never `toBe` on the whole prompt) — so no test breaks — but every generative call's prompt
token count grows by this addition, permanently. Recorded for Kim's explicit sign-off since it is a standing,
per-call cost, however small.

**F3 — The whole-record-upsert teaching is a finding, not a fork.** `tree.ts:85` settles it directly: resending
an existing component `id` in `updateComponents` REPLACES its entire prop/children bag. The decision-layer rule
must say so explicitly (a real footgun otherwise — an agent "patching" only the changed prop would silently
drop every other prop on that node), and the `a2ui-compose` skill's "Common traps" section gets one new entry.

**F4 — Demo vehicle: extend `a2ui-live`'s recorded transcript (`transcript.ts`), not a dedicated lifecycle page
(settled from precedent, not a taste fork).** `a2ui-live.ts` already has the exact architecture Lane 2 needs:
a persistent `RendererHost`/canvas surface reused turn-to-turn (never torn down except on an explicit Reset),
a multi-surface precedent already shipped (turn 2 opens `confirmation` as a NEW surface without touching
`canvas`), and the `note` meta-line mechanism (ADR-0088 §1) that already renders a short per-turn rationale in
the chat log — exactly the "annotated with which type fired and why" requirement, with zero new UI chrome. A
dedicated page would rebuild all of this from scratch for no added teaching value.

**F5 — The delete-vs-keep UX rule the demo models: delete when a surface's task is done AND leaving it visible
would confuse a later turn; otherwise leave it (no explicit lifecycle event) as a standing part of the visible
history. Kim's call to confirm.** Grounded in the transcript's OWN existing precedent: turn 2 (`confirmation`)
does not delete turn 1's `canvas` — both remain valid, non-conflicting parts of the conversation's visible
record. The proposed new lifecycle turns delete `confirmation` once its one job (acknowledging the click) is
truly superseded by later content, while `canvas` — the durable subject of the dialog — is never deleted in the
demo. This is a genuine policy call (a different dialog shape could reasonably keep everything, or delete more
aggressively) rather than something the mechanics force, which is why it is named as a fork rather than folded
into F3.

**Corpus-exemplar shape (a consequence of ADR-0064, not a fork).** A single exemplar record's `a2uiOutput` MAY
carry the full create→update→data-only-update→delete arc **as long as every surface-bearing message shares one
`surfaceId`** — `deleteSurface` is explicitly among the kinds SPEC-R2/ADR-0064 counts. No corpus-schema change
is needed; the SPEC records the required shape (§ below) and the actual admission rides the standing
corpus-gap follow-up, per the ticket.

## Consequences

- `system-prompt.ts`'s shipped default-mode prompt grows by roughly one short paragraph plus a `deleteSurface`
  wire-shape line (build-phase edit, gated by `prompt-drift.test.ts`'s existing `toContain` assertions plus new
  ones the build adds).
- `a2ui-compose/SKILL.md`'s mental model goes from three message kinds to four; its trap list gains the
  whole-record-upsert entry (F3).
- The `a2ui-live` demo gains 2–3 additional recorded turns; no new page, no new component, no wire/protocol
  change.
- A future corpus-admission wave owes one new exemplar record satisfying the SPEC's §-cited shape; not owed by
  this intake.

## Alternatives considered (rejected)

- **Fold the lifecycle guidance into `a2ui-catalog.spec.md` §5.2** — rejected: §5.2 is scoped to component-TYPE
  mapping; message-envelope choice is a different, catalog-independent axis, and cramming it in would conflate
  two altitudes the repo has otherwise kept clean (catalog SPEC vs runtime SPEC).
- **A dedicated `a2ui-lifecycle-demo` site page** — rejected (F4): would duplicate `a2ui-live`'s persistent-host,
  multi-surface, note-annotated architecture wholesale for no incremental teaching value.
- **A MINI_SKILLS entry for the lifecycle rules** — rejected (F2): mini-skills are intent-matched and may not
  fire on a turn whose wording doesn't happen to match lifecycle vocabulary, but the rule must hold on every
  turn unconditionally.

## Acceptance

- [ ] `a2ui-message-lifecycle.spec.md` and `.lld.md` exist, doc-lint clean, and cite this ADR.
- [ ] Kim rules on F2 (GRAMMAR insertion mechanism) and F5 (delete-vs-keep heuristic); F1/F3/F4 stand as
      recorded unless Kim overturns them.
- [ ] Status flips to `accepted` only at Kim's explicit ratification (never self-flipped).
