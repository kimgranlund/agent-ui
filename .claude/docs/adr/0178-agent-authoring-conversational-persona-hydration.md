# ADR-0178 — Agent-authoring flow (GH #633): conversational persona hydration is a NEW model-authored `personaPatch` meta-line arm (the ask/plan precedent, exactly), applied HOST-side through the persona-file key-enumeration + per-key-sanitizer gate; a builder-scoped modality gate keys it; the guiding questions are MODEL-authored (ask arm + prose), never host heuristics; the try-it toggle never swaps store identity

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-08-09
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-08-09 |
> | **Proposed by** | planner (design seat — the GH [#633](https://github.com/kimgranlund/agent-ui/issues/633) design-intake campaign, Kim's 2026-08-09 'New Agent' ask; the [agent-authoring-flow decomposition](../decompositions/agent-authoring-flow.decomp.md) is the companion manifest this ADR gates) |
> | **Ratified by** | kimgranlund (repo owner), 2026-08-09, via the [`ratify ADR-0178` utterance](https://github.com/kimgranlund/agent-ui/issues/633#issuecomment-5232182942) — verified + flipped by `scripts/adr_ratify.py` (ADR-0149) |
> | **Repairs** | **On ratification:** `roadmap.md` gains the agent-authoring family's Now/Next/Later entry per the companion manifest's §5 sequencing. **On ratification+build (future SPEC amendment + LLD, not authored here):** [`a2ui-live-agent.spec.md`](../spec/a2ui-live-agent.spec.md) — new SPEC-R rows for the `personaPatch` arm + apply gate + degrade law (the SPEC-R14 `ask` / SPEC-R20 `plan` lineage, cl.1/cl.2) · `packages/agent-ui/a2ui/src/agent/meta-line.ts` (`A2uiMetaEnvelope` gains the additive arm; `readMetaLine` widens — the ONE reader, never a second parse path) · `packages/agent-ui/a2ui/src/agent/produce.ts` (`formatMetaLine` — the writer lives here, not in meta-line.ts — widens with the arm) · `system-prompt.ts`'s `GRAMMAR` constant (the arm's mechanics teaching, host-owned — cl.1 rule 5) · `agent-admin-schema.ts` (one new `SURFACE_*_KEY`-shaped modality-gate constant + `AdminSurfaceTurnEvent` gains a patch event kind — cl.3) · `site/lib/admin-live-runner.ts` (peels the arm into the new event kind) · `site/pages/agent-admin-presets.ts` + `agent-admin-persona-file.ts` (the Builder persona preset; `PERSONA_STATE_KEYS` gains the gate key) · `packages/agent-ui/app/src/controls/agent-admin/` (the apply loop + try-it anatomy, per the future LLD). |
> | **Supersedes / Superseded by** | **Extends** [ADR-0088](./0088-a2ui-live-conversational-channel.md) (the `a2uiMeta` envelope gains another additive field; nothing existing is touched) · **Extends** [ADR-0097](./0097-a2ui-feed-embedded-asks.md) (the `personaPatch` arm follows the model-authored/shallow-validated `ask`-arm precedent point-for-point, AND the guiding questions REUSE the shipped ask surfaces — cl.1/cl.4) · **Extends** [ADR-0174](./0174-planner-stage-pilot-sequential-opt-in-loop.md) (the second application of its modality-gate + new-arm worked example; the `agent-ui-a2ui-meta-line-facts` skill's five rules applied verbatim) · **Relates** [ADR-0132](./0132-agent-admin-instructions-capabilities-architecture.md) (model-contributed capability entries route through the SAME `validateNewEntry` add path every other add already uses — cl.2) · **Relates** [ADR-0136](./0136-agent-admin-dev-only-live-model-overlay.md) / [ADR-0152](./0152-live-agent-production-worker-proxy.md) (the `agentTurn`/`agentSurfaceTurn` injectable seams + every-environment runner probe — the transport reality this family builds on; `identity-mock-transport.spec.md` is NOT this family's seam) · **Relates** [ADR-0170](./0170-catalog-library-kind-single-select.md) (the dimmed-while-off admin-row law the new gate's row follows) · **Relates** [`agent-app-surfaces.prd.md`](../prd/agent-app-surfaces.prd.md) PRD-D2 (the trusted frame stays host-authored — the load-bearing constraint cl.2 derives the apply gate from) · **Resolves** the design-intake half of GH [#633](https://github.com/kimgranlund/agent-ui/issues/633) (the issue stays open, tracking the slices). |

## Context

**The ask (GH #633, Kim 2026-08-09).** agent-admin gains a 'New Agent' flow: a blank path; a GENERATE
path where the user describes the agent over multiple chat turns while the schema hydrates
progressively and the HOST asks guiding questions; a try-it toggle flipping authoring ⇄ live-testing;
and (maybe) a generalized NL-edit mode for existing agents. The issue names the hydration mechanism
as "genuinely undecided, the design campaign's first question" — this ADR is that answer, proposed.

**Verified facts, standing on real source:**

- **A persona IS an enumerated set of store keys, and every key already has a fail-closed reader.**
  `site/pages/agent-admin-persona-file.ts` (GH #406) defines `PERSONA_STATE_KEYS` — config +
  master switches + Surface Options + the six entry lists — and its own header states the law: that
  set "IS what `composeLiveSystemPrompt` consumes at turn time," so byte-identical state means
  byte-identical live behavior; `readPersonaState` "filters on the way IN as well as OUT," so a
  foreign file can never smuggle unknown keys. Per-key sanitizers are already the standing
  discipline (`sanitizeModel`/`sanitizeCatalog`/`sanitizeLocalPatterns`/`sanitizeBankroll`/
  `isEnabledFlag`/`isGenuiSurfaceEnabled`…, `agent-admin-schema.ts`).
- **Minting a new persona is a shipped path.** GH #406's import flow mints a collision-safe roster
  identity + its own persisted store (`agent-admin-presets.ts` — per-persona
  `createMemoryStore({ persistKey: 'agent-admin-app.<id>' })`; `agent-admin-app.ts` stages the row
  and activates it). Export falls out of the same persona-file envelope. Persistence and export for
  a new agent are therefore REUSE, not design.
- **The family's transport reality is the injectable admin seam, not `identity-mock-transport`.**
  `ui-agent-admin` runs a deterministic stub by default (`runStubAgentTurn`, ADR-0131) and accepts
  two injectable runners (`agentTurn` prose, `agentSurfaceTurn` streamed — SPEC-N1-fenced app-local
  types in `agent-admin-schema.ts`); `site/lib/admin-live-runner.ts` implements both against the
  `/__a2ui/agent/chat` proxy, probed at runtime in EVERY environment (ADR-0152). The RUNNER owns
  the meta-line peel; the component consumes typed `AdminSurfaceTurnEvent`s
  (`line`/`note`/`progress`/`genui` today).
- **The envelope's precedent for a model-declared structural fact is settled twice over.** The
  `agent-ui-a2ui-meta-line-facts` skill states the five ask-arm rules (additive-only ·
  model-authored · shallow-validated per-field · never overload a closed vocabulary · mechanics
  teaching in `GRAMMAR`); `ask` (ADR-0097) and `plan` (ADR-0174, SPEC-R20) each applied them; there
  is exactly ONE meta-line reader, ever.
- **The modality-gate pattern is settled.** `SURFACE_A2UI_KEY`/`SURFACE_GENUI_KEY`/
  `SURFACE_PLANNER_KEY` (`agent-admin-schema.ts`): persona-scoped, OFF by default (inverse-default
  read for opt-in capabilities), dimmed-while-off in the admin UI (ADR-0170 cl.5), byte-identical
  when absent/false, threaded to a host-loop flag `produce()` never inspects (ADR-0174 cl.1).
  SPEC-R20's degrade law: a volunteered declaration is never consumed while the gate is off.
- **PRD-D2 (agent-app-surfaces): the trusted frame is never agent-authored.** "Agent-EMITTABLE
  shell surfaces" is an explicit PRD non-goal — "letting the agent emit its own container is a
  security inversion." The generative mode may therefore emit persona STATE (schema/content); the
  panes, roster, store machinery, and chrome stay host-authored.
- **Store-identity swap resets the conversation.** GH #145 (`agent-admin-presets.ts` header): a
  real `admin.store` reassignment clears the chat log, surfaces, history ring, and Dialog Turns —
  deliberately, so a switched persona starts clean. Any try-it design that swaps store identity
  mid-draft would wipe the authoring conversation by construction.
- **Model-contributed entries have ONE validated add path.** `validateNewEntry` (the fail-closed single-add-path LAW is ADR-0132 cl.4's; the symbol itself is ADR-0164's extraction, living in `entry-list/entry-data.ts`) is the single admission gate library packs and hand-authored
  entries both route through — slug-dedup, order, fail-closed rejection.

## Decision

### 1 · The hydration mechanism — a new model-authored, additive, shallow-validated `personaPatch` meta-line arm (working name; exact shape/name = SPEC/LLD), following the ask-arm precedent's five rules exactly

**Ruling.** The generate path's model output declares persona-state deltas on the SAME leading
meta-line `note`/`ask`/`plan`/`progress`/`trace`/`error` already ride: an additive
`personaPatch` field carrying a PARTIAL record of persona-scoped store state (config values,
switch states, entry contributions — the `PERSONA_STATE_KEYS` universe, cl.2). Model-authored
(rule 2 — the model, interviewing the user, is the author of the extracted structure; this rules
out host-side regex/extraction over prose); shallow-validated per-field (rule 3 — a malformed
patch drops only itself, never the envelope); the envelope stays versionless and additive (rule 1 —
`AgentTransport.turn` byte-identical); no closed vocabulary is widened (rule 4); the arm's
mechanics teaching lands in `GRAMMAR`, host-owned, byte-pinned, never persona-editable prose
(rule 5 — ADR-0174 cl.6's reasoning applies verbatim: garbled teaching is unrecoverable).
Patches are INCREMENTAL per turn — each turn's patch merges onto the draft (last-writer-wins per
key), never a full-state rewrite, so progressive hydration composes with the user's own concurrent
hand-edits in the panes instead of clobbering them (the exact-merge semantics are the SPEC
amendment's to pin).

**Considered alternatives.**
- **A fenced JSON block parsed out of the prose `/chat` reply — rejected.** It invents a SECOND
  structural parse path beside `readMetaLine` (the skill's one-reader law), has no per-field
  shallow-validation home, no degrade law, and no streaming envelope — a hand-rolled variant of a
  problem the meta-line already solves.
- **An A2UI surface the model emits as a "config form" whose actions write the store — rejected.**
  It routes CONFIG AUTHORITY through untrusted rendered content — exactly the inversion PRD-D2
  fences — and the catalog deliberately has no store-write seam to do it with.
- **Host-computed extraction (the runtime-composed field class) — rejected.** `progress`/`trace`/
  `error` are runtime-composed because the HOST is the source of those facts; here the model is the
  author of the extracted structure by definition. Wrong axis of the two-field-class table.

### 2 · The apply gate — HOST-side, fail-closed, and made of three shipped filters; the model proposes state, only the host writes it (PRD-D2)

**Ruling.** The component (never the model, never the runner) applies a patch to the DRAFT
persona's store through exactly the discipline the substrate already ships: **(i)** keys filtered
against the enumerated persona key set (`PERSONA_STATE_KEYS` — the `readPersonaState`
"filters on the way in" law; unknown keys drop silently), **(ii)** each surviving value through
that key's OWN existing fail-closed sanitizer (`sanitizeModel`, `sanitizeCatalog`,
`isEnabledFlag`…), **(iii)** entry-list contributions through `validateNewEntry` — the SAME
validated add path hand-authored and library entries use (ADR-0132; a patch is a third projection
into the store, and it honors the same admission law as the other two). Live hydration then falls
out for free: the panes already re-render on store writes (the standing live-apply-is-a-fresh-read
law). The trusted frame — roster, panes, store machinery, chrome — stays host-authored throughout;
the model only ever proposes VALUES inside the host's enumerated schema. A rejected/dropped key is
a degrade, never an error surface mid-conversation.

### 3 · The opt-in seam — one builder-scoped modality-gate key, the `SURFACE_PLANNER_KEY` shape verbatim; the runner projects the arm as a new typed event

**Ruling.** One new `SURFACE_*_KEY`-shaped store constant (working name `surfaceAuthoring`;
inverse-default OFF — explicit `true` to enable), joining the established two-layer seam: a
persona-scoped store key, dimmed-while-off in the admin UI (ADR-0170 cl.5's "noise, not
configuration"), threaded per-call so the GRAMMAR teaching only composes — and the host only
consumes a patch — when the gate is on (SPEC-R20's degrade law verbatim: a volunteered
`personaPatch` while the gate is off is never consumed). The host-authored **Builder persona**
(cl.4) seeds it ON; every other persona ships it OFF. Deliberately persona-scoped rather than
flow-hardcoded: flipping this gate ON for an ORDINARY persona is precisely capability 4's future
entry point (cl.6) — the seam is built once. Consumer-side, `AdminSurfaceTurnEvent` gains one
additive event kind (the runner peels the arm exactly as it peels `note`/`progress`); the
component's SPEC-N1 fence is unchanged.

### 4 · The guiding questions — MODEL-authored, riding shipped ask surfaces + prose; the interviewer is a host-authored Builder persona, not host heuristics

**Ruling.** The host-side guided-conversation loop's questions are authored by the MODEL: the
Builder persona — a host-authored preset whose prompt sections teach the interview craft (what a
complete persona needs: name, model, temperament, capabilities, surface modalities; ask before
assuming; one topic per turn) — asks in prose, and via ADR-0097's shipped feed-embedded ask
surfaces wherever the answer set is closed (pick a model, confirm a modality, choose a category).
Zero new question machinery. **Host-heuristic question scripts are rejected:** a hardcoded decision
tree duplicates competence the model already has, goes stale against every schema change, and the
ask arm was built for exactly this shape. "The HOST asks guiding questions" (the issue's phrasing)
is satisfied at the product level — the host-authored Builder persona is doing the asking — without
the host runtime authoring a single question string.

### 5 · The try-it toggle — flips the ACTIVE persona composition over ONE stable draft store; never a store-identity swap; both conversations survive

**Ruling.** Authoring mode and test mode are two conversation contexts over the SAME draft store:
authoring runs the Builder persona (gate ON, patches applied to the draft); test runs the DRAFT
persona itself (its own composed `composeLiveSystemPrompt` output, its own Surface Options, gate
irrelevant), exactly as any persona runs today. The toggle changes WHICH composition drives the
next turn and which transcript is visible — it never reassigns `admin.store`, because a store
identity swap is the shipped conversation-reset signal (GH #145) and would wipe the authoring
thread by construction. Both transcripts persist across flips (round-tripping is the issue's own
acceptance); test turns write to the draft store only what an ordinary session writes today (the
bankroll mirror is currently the only such write) — the draft's authored state is not test-run
state. Whether the two transcripts are two mounted conversation instances or one instance with
snapshot/restore is the LLD's call (the manifest's OQ3 carries the recommendation), not this
ADR's — the contract here is only: no store swap, no lost transcript, one draft store.

### 6 · Capability 4 (NL-edit everywhere) — the mechanism generalizes by construction; the slice is deferred behind the pilot; in/out is Kim's confirm

**Ruling.** Nothing in cl.1–cl.3 is draft-specific: the arm patches whatever persona store the
active conversation runs against, so "modify an EXISTING agent by describing the change" is the
SAME mechanism with the gate flipped on for that persona (cl.3's seam) plus an entry-point
affordance. GH #633 delegates the v1-vs-later call to the decomposition; this ADR rules the
mechanism-generalizes half and DEFERS the slice: it ships only after the generate path proves the
arm end-to-end, and its final in/out (plus any destructive-edit safety — undo/versioning for edits
to a persona someone already uses) is Kim's confirmation at that slice's own intake, informed by
the pilot. Deferred-not-foreclosed, named so it is not later mistaken for something the pilot
already covers.

## Non-goals

- **NL-edit for existing agents in v1** (cl.6 — deferred slice, mechanism-ready).
- **Any real backend persistence.** Personas stay per-persona localStorage stores + the portable
  persona file (GH #406); no server, no account linkage.
- **A new chat/conversation component or a new entry-list kind.** The flow composes shipped
  primitives; ADR-0132's "a future kind is seed data, not code" stands untouched.
- **The exact `personaPatch` JSON shape, merge semantics, gate constant name, Builder persona
  copy, and try-it anatomy** — SPEC-amendment/LLD-level, booked in Repairs, not settled here.
- **Schema-migration of the arm across future persona-file versions** — the persona-file
  `version` field owns envelope evolution; the arm inherits whatever the SPEC pins.

## Consequences

- GH #633's generate path gains a ratifiable architecture that is almost entirely reuse: ONE new
  meta-line arm + ONE new gate key + ONE new typed event kind; the apply gate, mint path,
  persistence, export, live hydration, and ask surfaces are all shipped mechanics cited by ID.
- The blank path (capability 1) needs none of this ADR — it is pure GH #406-mint reuse and can
  build before ratification (the companion manifest sequences it first).
- The `GRAMMAR` byte-pinning discipline (`system-prompt-grammar.test.ts`) extends to the new
  teaching block, the same drift protection every prior arm got.
- Flipping the gate on an ordinary persona becomes capability 4's entire producer-side cost —
  the deferred slice is UI + safety, not new wire design.
- If Kim rejects cl.1 in favor of a different seam, the manifest's S2–S5 re-open; S1 is unaffected.

## Open forks

- **OF1 — patch granularity + merge law** (incremental merge recommended, cl.1; exact shape,
  key-conflict and entry-dedup semantics = the SPEC amendment's to pin).
- **OF2 — try-it anatomy**: two mounted conversation contexts vs one with snapshot/restore
  (cl.5 fixes the contract; the LLD picks the anatomy — dual-context recommended, it avoids
  inventing transcript serialization).
- **OF3 — capability 4's final in/out + destructive-edit safety** (cl.6 — Kim's, at that slice's
  intake, after the pilot ships).
- **OF4 — whether the Builder persona is roster-visible or reachable only via the New-Agent
  flow** (a small IA/product call; hidden-until-invoked recommended so the showcase roster stays
  a showcase).

## Alternatives considered

(Full reasoning inline per clause; recapped.) Fenced-JSON-in-prose hydration — rejected, cl.1
(second parse path, no validation home). Model-emitted A2UI config form writing the store —
rejected, cl.1/PRD-D2 (config authority through untrusted content). Host-side extraction from
prose — rejected, cl.1 (wrong field class). Host-heuristic question scripts — rejected, cl.4
(brittle, duplicates the model, ask arm exists). Store-swap-based try-it (two stores, swap on
toggle) — rejected, cl.5 (GH #145 makes the swap a reset; state loss by construction). Building
NL-edit-everywhere in v1 — rejected, cl.6 (unproven arm; safety questions unanswered).
