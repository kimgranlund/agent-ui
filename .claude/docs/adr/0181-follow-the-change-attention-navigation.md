# ADR-0181 — follow-the-change: the Builder co-pilot becomes an additive-only pane-visibility writer, a commit-time attention reaction, and a first-party field→location map (GH #695)

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-08-11
>
> | Field | Value |
> |---|---|
> | **Status** | proposed |
> | **Date** | 2026-08-11 |
> | **Proposed by** | planner seat, design intake for [GH #695](https://github.com/kimgranlund/agent-ui/issues/695) (Kim's explicit PRD/SPEC/LLD ask, sized `big`) — decomposition [`follow-the-change.decomp.md`](../decompositions/follow-the-change.decomp.md) (two-plane, coverage clean) · PRD [`follow-the-change.prd.md`](../prd/follow-the-change.prd.md) · SPEC [`follow-the-change.spec.md`](../spec/follow-the-change.spec.md) · LLD [`follow-the-change.lld.md`](../lld/follow-the-change.lld.md) (all proposed, same wave) |
> | **Ratified by** | — (pending; the proposed marker is the real gate — no build dispatches before Kim's flip, and none before GH #691 lands either) |
> | **Repairs** | on ratification: [`admin-three-pane-ia.lld.md`](../lld/admin-three-pane-ia.lld.md) §16.2's write list gains one dated append-only row — the co-pilot's additive-only ensure-shown write joins the wide pill / narrow segment / arm writers (clause 2 below states the whole delta; that LLD stays the visibility model's owning record) · on ratification+build: the S1–S4 slices the decomposition sequences (`field-location.ts` + parity gates · the `#followChange` reaction + `agent-admin.css` wash · the receipt line · docs/browser probes) |
> | **Supersedes / Superseded by** | **Extends [ADR-0179](./0179-agent-admin-three-pane-ia.md) (partial)** — its GH #686 Amendment's shown-set visibility model (`admin-three-pane-ia.lld.md` §16.2) gains ONE new writer class under the constraints of clause 2; every §16.2 invariant (min-one, primary ∈ set, user-chosen membership, no writes on resize) stands byte-untouched. **Extends [ADR-0178](./0178-agent-authoring-conversational-persona-hydration.md)** — cl.2's consumption condition and `PatchReport` are this reaction's unchanged trigger substrate; the gate/fence/apply path is not touched. Relates [ADR-0159](./0159-status-stream-receipt-pattern.md) (considered for the highlight and deliberately NOT reused — clause 3) · GH #691 (blocking prerequisite: the trigger signal is what it reports broken) · GH #574 (the settings sub-nav this navigates) |

## Context

GH #695 (Kim, verbatim): "we need some way for the chat to update UI. Like if I am on the
Capabilities tab, and suggest making a change to default Model (in Agent tab) then the agent tab
should get selected, etc. and scroll to that section." The Builder interview applies consumed
`personaPatch`es to the draft store mid-stream (agent-admin.ts:2569–2576); every subscribed pane
hydrates live, but nothing brings the changed field's HOME on screen — the change lands invisibly
when its pane/section isn't the one the user is looking at.

**The ticket's own mechanism description is stale, and the design must not build against it.**
GH #695 predates GH #686's unified-header rework and names "the top-level Chat / Author / Settings
`ui-tabs` pane-nav (`agent-admin.ts` ~L1180-1207, `#setPane`)". That pane-nav, `#setPane`, and the
whole single-active-tab model are RETIRED (S7-a→S7-e, built and confirmed 2026-08-11). The current
truth is §16.2's shown-SET + primary: the user chooses a set of visible panes; at wide bands every
member paints, below 52.5rem only the primary does. "Switch to the owning tab" is therefore not a
well-formed operation anymore — the honest translations are "ensure the Settings pane is a member
of the shown-set" (wide) and "do NOT steal primary" (narrow, where flipping primary would hide the
very conversation the user is mid-sentence in). The settings SUB-nav (Agent / Capabilities /
Surface, GH #574) survives exactly as the ticket describes.

Two contracts sit in the way of a naive build, which is why this is an ADR and not just an LLD:
§16.2's writer set is user-only by construction (pills, segments, the arm — "teardown never forces
navigation"), so a machine writer is a substantive change to a Kim-ratified model; and no queryable
"field X lives under section Y, fold Z" data exists anywhere (grep: zero `scrollIntoView` in
`agent-admin.ts`) — minting it is new infrastructure with its own drift risk against
`PERSONA_STATE_KEYS`. GH #695 also names five genuinely open forks (trigger time, focus stealing,
scope, highlight mechanics, the map's shape). Real alternatives existed for each — notably
propose-time preview vs commit-time reaction, and auto-navigation vs passive affordance — and the
choices below are hard to walk back once users learn the behavior. Full behavior lives in the SPEC;
this record rules the forks.

## Decision

1. **Commit-time trigger, never propose-time.** The reaction fires only on a CONSUMED patch whose
   `PatchReport` has non-empty `applied`/`added`. The apply gate drops items, so a propose-time
   reaction could navigate to a field that never changed — a lie in navigation form; and the
   shipped flow has no confirmation step, so propose-time buys nothing but new wire semantics.
   (SPEC-R1 states the behavior.)

2. **The co-pilot becomes a pane-visibility writer — ADDITIVE-ONLY, and that constraint is the
   ruling.** The reaction may add `settings` to `#panesShown` through the existing `#setPanesShown`
   mutator. It may never remove a member, never repoint `#panePrimary`, never move keyboard focus,
   and never write visibility at a band where the addition wouldn't paint (the pixel-truth paint
   check, SPEC-R3). §16.2's owning record gains this one writer row on ratification (the Repairs
   cell); every existing invariant stands. The alternative — full auto-navigation including a
   narrow-band primary flip — was rejected: at narrow, primary IS the conversation the user is
   typing into; stealing it to show a settings fold hides the interview mid-turn, the exact
   regression the ticket's own focus-stealing question anticipates.

3. **The attention vocabulary is a degrade ladder, and its top rung is a wash, not a takeover.**
   Visible path: select the owning settings section, scroll the owning fold
   (`prefers-reduced-motion` honored), and mark it with a transient `data-attention` wash on the
   existing `--md-sys-color-primary` tokens (~1.6s, no new color system). Suppressed paths (user's
   focus inside the settings pane; narrow band): no section flip, no scroll — instead a receipt
   line in the turn's own note ("Updated Model (Agent › Model)") plus PENDING attention that fires
   when the user next reveals the owning section themselves. ADR-0159's receipt pattern was
   considered and not reused — it is a status-stream turn-lifecycle collapse, a different job; the
   conversational half here is a plain note line, and the visual half is fold-local. (SPEC-R4/R5/R7.)

4. **The field→location map is minted as first-party queryable data.** A new pure module
   (`field-location.ts`, beside `persona-patch.ts`) maps store key →
   `{pane, section, sectionLabel, item, itemLabel}`, DERIVED from the canonical constants
   (`ENTRY_KINDS`, `kindEnabledKey`, `entriesStoreKey`, the named surface/bankroll/catalog keys) —
   never a hand-listed per-key table — and is pinned total over `PERSONA_STATE_KEYS` plus
   anchor-parity-gated against the composed DOM by its own suite. Fail-closed: an unmapped key
   means no reaction, never a throw. (SPEC-R2; the `persona-patch.ts` hoisting rationale applied
   again — two hand-maintained enumerations of one truth is the GH #406 silent-divergence class.)

5. **Generalization: all patchable keys, consumed patches only.** The reaction covers the entire
   patchable key set from day one (the map's totality makes the example trio and the general case
   the same code path); the trigger scope stays exactly ADR-0178 cl.2's consumption fence — hand
   edits, imports, preset seeding, and test-chat turns never react. The Context sections carry no
   patchable field and are out of scope. (SPEC-R8.)

## Consequences

- The user's attention follows the interview's writes (PRD-G1) without the UI ever taking
  something away from them (PRD-G2): the shown-set only widens, primary and focus are inviolate,
  and every consumed change is narrated in the conversation even on the fully-degraded path
  (PRD-G3).
- §16.2 gains its first non-user writer — fenced to one additive verb. Any future writer (deep
  links, validation jumps) must either fit the same additive-only constraint or come back through
  an ADR; the map (clause 4) is deliberately reusable for those without re-opening this decision.
- A new parity obligation: adding a persona key now requires a location row (the totality gate
  fails the suite otherwise) — the cost of "where does X live?" staying answerable.
- Double-blocked build: nothing dispatches before Kim's flip AND GH #691's landing (the trigger
  signal is exactly what #691 reports broken; PR #692 in flight at authoring time).
- Deliberately NOT done: propose-time preview/confirmation UI, per-field anchors inside a fold,
  any change to the apply gate, new host events, router/URL integration. Each is a named non-goal
  (PRD §4, SPEC §3), not an accident.
