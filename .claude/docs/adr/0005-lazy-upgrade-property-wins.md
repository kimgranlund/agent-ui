# ADR-0005 — Lazy-property upgrade precedence: property-wins

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-06-26
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-06-26 *(authored)* |
> | **Proposed by** | planning-lead — resolving a G2 verdict deferral, host/user-ratified, set at the reference control |
> | **Ratified by** | orchestration-lead — 2026-06-26 |
> | **Repairs** | `.claude/docs/goals.md` §G2 verdict (the "lazy-upgrade attribute-wins vs property-wins" deferral), `.claude/docs/plan.md` §5 (the lazy-property upgrade dance). |
> | **Supersedes / Superseded by** | *(none)* |

## Context

G2 shipped the lazy-property upgrade dance (`packages/agent-ui/components/src/dom/element.ts`,
`upgradeProps`/`upgradeProperty`) and the G2 verdict (`goals.md` §G2) **explicitly deferred to G5** the
precedence rule for the one race the dance does not yet pin: when an element has **both** an initial
observed attribute *and* a pre-upgrade `.prop=` assignment present at upgrade, which wins? The current code
reconciles toward the **attribute** ("attribute-wins"); Lit and the platform's lazy-upgrade norm reconcile
toward the **property** ("property-wins").

The gold `ui-button` is the **reference control**: the precedence it establishes is inherited and copied by
every later control and by the `component-author` procedure. Even though `variant`/`size`/`disabled`
do not themselves stress the race (no demo path sets a property before upgrade *and* a conflicting
attribute), the precedent must be ratified at the reference control rather than shipped unresolved and
migrated later.

> The **second** G2-deferred convention — camelCase→kebab attribute folding — is **not** resolved here. The
> button has no camelCase prop (`variant`/`size`/`disabled` are single-word), so it does not exercise
> folding; it stays deferred to the first control that introduces a camelCase prop (recorded in `goals.md`
> §G2).

## Decision

We will adopt **property-wins**: an imperatively-set property (a `.prop=` assignment) is the element's live
value and **takes precedence over the initial attribute** when both are present at upgrade. This matches the
platform's lazy-upgrade contract and Lit (least surprise — a consumer who sets `el.variant = 'soft'` expects
that to be the value, not to be overwritten by `variant="solid"` in markup). The change lands in G5: the
upgrade reconciliation in `element.ts`/`props.ts` resolves toward the own-property value, with a probe in
`element-upgrade.test.ts`. This repairs the `goals.md` §G2 deferral and `plan.md` §5's dance description.

## Consequences

- **Consumer-facing, platform-correct.** `el.variant = 'soft'` set before connect beats `variant="solid"` in
  markup — the behaviour framework consumers expect. The reference control sets the right precedent for the
  fleet.
- **It changes shipped G2 behaviour.** `upgradeProps` currently reconciles an initial-attribute write that
  landed on the pre-upgrade shadow toward the attribute; property-wins reconciles toward the own-property.
  This touches the inbound-attribute ↔ pre-upgrade-property seam (`element.ts` `upgradeProps`/`upgradeProperty`,
  ~lines 92–109, whose comment already names the ordering hazard).
- **The G2 reflect/upgrade suite must stay green** (`element-upgrade`, `element-attrs`, `props-reflect`); the
  change adds a `property-wins` probe and must not regress the no-loop reflection locks.
- **Negative — it diverges from an "attribute is the source of truth" mental model.** That model is wrong for
  custom-element lazy upgrade (the attribute is the *initial* value; the property is the *current* value), but
  the divergence is worth naming for anyone reasoning from HTML-attribute intuition.
- **Propagation:** a small `element.ts`/`props.ts` change + one probe in the Phase-1 button slice; no other
  document regenerates; the rubric/contract gates are unaffected.

## Alternatives considered

- **Keep attribute-wins + document it** — rejected: diverges from Lit/the platform norm, surprises consumers
  who set a property and watch markup override it, and bakes the wrong precedent into the reference control
  that 60 components copy.
- **Defer again to G6/G7** — rejected: the reference control *is* where the precedent is set; deferring ships
  an unratified precedence that later controls inherit, then forces a fleet-wide migration when resolved.
- **Make precedence per-prop configurable** — rejected: bloat. A true/false convention should not be a knob
  (`process.md` anti-accretion: no configuration for a fact that has one right answer); YAGNI until a real
  control needs the other rule.
