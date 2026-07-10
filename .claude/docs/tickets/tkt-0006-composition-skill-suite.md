---
doc-type: ticket
id: tkt-0006
status: open
date: 2026-07-09
owner:
kind: feature
size: big
---
# TKT-0006 — an `agent-ui-*` skill suite for COMPOSING UI, layouts, and systems with the fleet

## Summary
Kim's ask (2026-07-09): "plan out a full comprehensive set of agent-ui-* skills focused on
composing UI, Layouts, Systems with agent-ui components." This is the **consumer side** of the
skill estate — TKT-0005's suite covers *building* components (producer); nothing covers
*assembling product surfaces from* the shipped fleet. The raw material exists and is rich:
~40 shipped controls including the layout primitives (row/column/grid/card/modal/tabs),
`@agent-ui/app` (agent-app-shell, ADR-0082..0084), `@agent-ui/router` (ADR-0115),
`ui-theme-provider` (ADR-0117), the form spine (ui-field + ui-form-provider, ADR-0050/0051),
and consumer-facing site guides (choosing · forms · layout-overview · sizing · theming ·
getting-started). What's missing is the skill layer: no routable map of "which control for
which job," and no procedure for composing a feature, a screen, or an app. (`a2ui-compose`
covers ONLY the A2UI-wire path — payloads against the catalog — not direct composition.)

## Planned roster (the "plan out" deliverable; namespaced `agent-ui-*` per Kim's 2026-07-09 ruling)

**Knowledge-skills** (model-only, routing over owned sources):

- **K5 `agent-ui-catalog`** — the fleet map: every shipped control + the job it's for, the
  tier partition (control/container/display), what's deliberately catalog-excluded. Derives
  its routing from the descriptors (`{name}.md`) + the site choosing guide — never a
  hand-maintained duplicate list (the descriptor corpus is the owner; the skill routes).
- **K6 `agent-ui-composition-patterns`** — the assembly prior-art map, consumer-angle
  (distinct from TKT-0005's K4, which maps producer mechanisms): form rhythm
  (field/form-provider wiring), container box-model consumption (`[data-box]` levels),
  overlay anchoring from the consumer seat, scroll-region ownership (the `.app-page`
  lesson), theming subtrees (`ui-theme-provider` semantics), router wiring
  (`ui-router-outlet`/`ui-router-link`), app-shell slotting.

**Forge-skills** (procedures, user-invocable) — one per plane Kim named:

- **F3 `agent-ui-compose-ui`** — compose a FEATURE/fragment: pick controls via K5, wire typed
  props/events (the event allowlist), assemble forms on the field/form-provider spine with
  validation, honest states.
- **F4 `agent-ui-compose-layout`** — compose a SCREEN: row/column/grid/card structure, the
  box-model levels, scroll regions, `[scale]`/`[density]` axes, modal/tabs/disclosure
  patterns, whole-shape sanity (a layout that collapses is the known failure class).
- **F5 `agent-ui-compose-app`** — compose a SYSTEM: the package DAG (what imports what —
  shared←components←a2ui←app; router as sibling), agent-app-shell, router integration,
  theme-provider subtrees, signals-based state, and the optional A2UI arm (route to
  `a2ui-compose` at that boundary, never re-own it).

**Review wiring** — no new reviewer seats: the generic `ui:layout-reviewer` /
`ui:flow-reviewer` / `ui:component-reviewer` grade composed artifacts; the forge-skills name
those handoffs (generator ≠ critic).

## Acceptance
- Same bar as TKT-0005: repo-local `.claude/skills/`, lint-clean (the skill-postwrite hook),
  both invocation dials explicit, accurate routing descriptions with crisp NOT-boundaries
  (vs each other, vs TKT-0005's producer suite, vs `a2ui-compose`, vs the generic ui-plugin
  method skills), every referenced path/ADR resolving, `forge:skill-auditor` pass per skill.
- K5 stays derivation-honest: routes to descriptors/guides; a grep finds no hand-copied
  control inventory that could drift from the descriptor corpus.
- The **corpus-gap** (below) is resolved before or during the wave — a knowledge-skill with
  no owned source to route to is the defect, not a shortcut.
- F3–F5 each executable by a fresh seat: run one against a real composition task as its
  shakedown (the F1-against-next-intake precedent).

## Links
- TKT-0005 — the producer-side suite (K1–K4 + F1/F2, shipped 2026-07-09); this suite's sibling
  and boundary.
- `site/pages/{choosing,forms,layout-overview,sizing,getting-started}.ts` + `theming.ts` —
  the consumer-facing guide prose these skills route to.
- `packages/agent-ui/{app,router}/` · `controls/{form-provider,field,theme-provider}/` — the
  system-plane sources.
- ADR-0046 (container box-model) · ADR-0050/0051 (form spine) · ADR-0082..0084 (app-shell) ·
  ADR-0115 (router) · ADR-0117 (theme-provider).
- `.claude/skills/a2ui-compose/` — the A2UI-wire composition boundary (route to, never re-own).

## Scope / Open
- **Granularity fork (open):** three compose forge-skills (F3/F4/F5, one per plane) vs one
  `agent-ui-compose` with three modes — resolve at authoring time; leaning three (the planes
  have disjoint sources and disjoint reviewers), same routing-precision argument that
  resolved TKT-0005's fork to four.
- **Corpus-gap (open, sequencing):** unlike TKT-0005 (the references/ corpus pre-existed),
  the composition knowledge has no single owned reference doc — it lives in site guides
  (consumer prose) + scattered ADRs. Decide per K-skill: route to the site guides + ADRs
  as-is (thinner but honest), or first author a `references/composition.md` via
  reference-forge and route to that. Default: route as-is; author the reference only if the
  K6 table can't stay one-sentence-per-row without it.
- **Non-goal:** no A2UI payload composition (owned by `a2ui-compose`); no new reviewer
  agents; no changes to the generic ui-plugin skills (they stay the method spine).
- **Non-goal:** no site content changes — the guides are sources here, not deliverables.

## Findings
