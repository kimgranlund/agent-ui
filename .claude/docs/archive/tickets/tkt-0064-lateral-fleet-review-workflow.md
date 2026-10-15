---
doc-type: ticket
id: tkt-0064
status: done
date: 2026-07-15
owner:
kind: feature
size: big
---
# TKT-0064 — a repeatable LATERAL fleet-review workflow (construction · styling · attributes-as-API · traits)

## Summary
Kim's directive: design a workflow for reviewing all component work **laterally** — slicing the fleet by
PATTERN instead of by component — along four axes: construction patterns, styling patterns,
attributes-as-API patterns, and traits implementation. The vertical review seat (`component-reviewer` at
each control's definition-of-done, `rubrics/component.md`) judges ONE component against the law; it
structurally cannot see the three defect classes that only exist BETWEEN components:

- **drift** — components individually "correct" but inconsistent with each other or an outlier vs canon
  (TKT-0062's review found four such defects across five components built the same day, each
  individually green);
- **canon gaps** — the law is silent, so each builder invented, and the inventions diverged (TKT-0047's
  three clusters);
- **missed reuse** — a control hand-rolls behavior a trait already owns.

The worked precedent is [TKT-0046](tkt-0046-fleet-interaction-state-styling-consistency-audit.md) — a
manual, single-axis (styling) sweep that produced a findings table, one mechanical fix, and three routed
clusters. It proved the shape works AND why it must be repeatable: the entry-control state law changed
TODAY (TKT-0062), silently invalidating that sweep's verdicts for every entry control. A one-off audit
decays; the workflow is the durable artifact.

## The design (realized as `.claude/skills/agent-ui-lateral-review/SKILL.md` — this ticket's paired doc)

Five phases, generalizing TKT-0046:

- **Phase 0 — Census (deterministic)**: the work-list is machine-derived from the descriptor corpus
  (`tier:`/`extends:` frontmatter across `controls/*/*.md`), never hand-listed; per-axis exclusions come
  from the tier (Display/Container skip interaction-state checks, `UIElement`-only skip form axes).
- **Phase 1 — Canon pack per axis**: each reviewer receives (a) the axis's LAW docs, (b) the gold
  exemplar(s), and (c) the **ratified-deviations ledger** — the already-ruled exceptions (Indicator
  no-ready-gate per ADR-0042 cl.2, select's keyboard-only focus per TKT-0062 Findings, calendar/
  color-picker's documented opacity rationales, …) so reviewers don't re-flag or re-litigate them
  (TKT-0046 burned real effort re-verifying ADR-0042's motion citation from scratch).
- **Phase 2 — Sweep (axis-sliced fan-out)**: one reviewer context per axis reading that axis's SLICE of
  every in-scope control (`.css` files for styling; `connected()`/parts/listeners for construction;
  `static props` + descriptor frontmatter for attributes; trait call-sites + hand-rolled behavior for
  traits) — axis-sliced, never component-sliced, because drift is only visible when one context holds
  every component's treatment of one concern. Every finding classified into the four-way route:
  **DRIFT** (outlier vs canon → fix the outlier) · **GAP** (canon silent, builders diverged → a ruling or
  proposed ADR fork, never invented by the reviewer) · **UNRECORDED-DEVIATION** (looks deliberate, no
  record → ratify-or-fix decision) · **MISSED-REUSE** (traits axis). Evidence bar: `file:line`, per the
  TKT-0042/0046 precedent.
- **Phase 3 — Verify (adversarial, before routing)**: every canon citation opened and confirmed
  (verify-cited-authorities discipline); every BEHAVIORAL claim proven with a real-browser probe, never
  accepted structurally (the TKT-0062 lesson: the ink-repaint bug passed every structural read and every
  builder-written test — only an engine probe of the right element caught it).
- **Phase 4 — Consolidate → route**: dedup across axes (one root cause can surface on two);
  mechanical/low-risk fixes applied inline with dated Findings entries; judgment clusters → scoped
  follow-up tickets; GAPs → law-doc amendments or `proposed` ADRs (never self-ratified) — TKT-0046's own
  routing discipline, verbatim.

**Repeat triggers** (why this is a skill, not a campaign): after each control wave; after any law change
(a law edit names which axis it invalidates — TKT-0062 → the styling axis for entry controls, due NOW);
axes run independently, never forced together.

**Deterministic pre-passes named for first-run build-out**: the attributes axis wants a cross-control
attribute MATRIX derived from the descriptor corpus via the existing `@agent-ui/components/descriptor`
parser (same-named attributes compared for type/reflect/default/semantics across controls) — a script
producing the matrix makes half that axis's findings mechanical instead of judgment.

## Acceptance
- The skill exists at `.claude/skills/agent-ui-lateral-review/SKILL.md`, carrying the five-phase
  procedure + all four axis packs (slice · canon · gold exemplar · drift checklist · ratified-deviations
  ledger), routing to law docs rather than restating them (the estate's skill idiom).
- The `docs-grammar` gate stays green with the new skill present.
- The four-way finding route and the Phase-3 verification bar are explicit in the skill — a lateral run
  that routes an unverified behavioral claim, or re-flags a ledgered deviation, is a process breach.
- First RUN is a separate dispatch (its own scope/budget decision), not part of this design ticket.

## Links
- `.claude/skills/agent-ui-lateral-review/SKILL.md` — the workflow itself (this ticket's deliverable).
- [TKT-0046](tkt-0046-fleet-interaction-state-styling-consistency-audit.md) — the worked single-axis
  precedent (styling, manual) whose shape Phase 0–4 generalizes.
- [TKT-0062](tkt-0062-entry-control-filled-state-law.md) — the motivating incident (cross-component
  drift among five same-day components) AND the law change that makes the styling axis due for a re-run.
- `.claude/docs/rubrics/component.md` — the VERTICAL rubric this complements (per-component DoD; the
  lateral workflow never replaces it).

## Scope/Open
- No ADR: the workflow is process, not a fleet contract change; the skill + this ticket are the record.
- The attribute-matrix pre-pass script is named, not built — it lands with the attributes axis's first
  run (build-on-first-use, so it is shaped by real need, not speculation).
- Whether lateral runs dispatch as a `Workflow`-tool script (parallel fan-out) or sequential agent
  dispatches is an execution choice per run, not fixed by this design — the skill's phases are
  vehicle-neutral (TKT-0046 proved even a single-context manual run works for one axis).

## Findings

### 2026-07-16 — acceptance met, the workflow is proven in production — CLOSED

Every acceptance line is satisfied, and the design has survived contact with a full campaign:

- The skill exists at `.claude/skills/agent-ui-lateral-review/SKILL.md` with the five phases, all four
  axis packs (slice · canon · gold · checklist · ratified-deviations ledger), routing to law docs.
- `docs-grammar` green throughout (157/157 at every gate this wave).
- The four-way route and the Phase-3 verification bar are explicit in the skill.
- The first run WAS a separate dispatch: [TKT-0065](tkt-0065-lateral-review-campaign-1.md), Kim-scoped
  to all four axes — DRIFT 20 · GAP 7 · UNRECORDED 4 · MISSED-REUSE 0 over 69 components, with the
  named build-on-first-use pre-pass (the attribute matrix) built in that run as designed.

The design earned two amendments from its own first campaign, both folded back into the skill (the
living-record law): Phase 4 gained the comment-strip-before-text-scan rule (the 44-vs-9 false census),
and Phase 5 gained "run every specified probe BEFORE bundling rulings" (TKT-0068 item 3 dissolved under
a mutation probe and never needed a ruling slot) + "a ruled GAP leaves a standing gate behind where
text-checkable" (`styling-gates.test.ts` is the worked shape). Downstream closure: TKT-0066/0067/0068
all done; TKT-0069 (naming rulings) is the one open descendant, in the TKT-0025 owner's orbit.
