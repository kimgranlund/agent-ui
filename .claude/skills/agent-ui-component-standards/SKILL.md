---
name: agent-ui-component-standards
description: >-
  Route to the normative LAW layer for designing or judging a ui-* component: anatomy
  (position slots × content roles), the geometry & sizing law (the §1 ramp, the
  (scale × size) → row lookup, the centering law), the four interaction states + focus ring,
  and the color-token role system. Use for any design-time question — "what slots does this
  control get", "what height/font at this scale", "how do hover/active/focus style", "which
  color role do I consume" — BEFORE writing component code. Routing only: the law itself
  lives in .claude/docs/references/ (cite, never copy). NOT for disk layout/exports
  (agent-ui-component-packaging), the test bar (agent-ui-component-testing), or "has the
  fleet solved this before" (agent-ui-component-patterns).
user-invocable: false
disable-model-invocation: false
---

# Component standards — the law layer's map

The normative standards for `ui-*` components live in `.claude/docs/references/` with one owner
per question. This skill is the **routing table + reading order** — it restates nothing (a copy
here is the drift it exists to prevent; when a doc below disagrees with this map, the doc wins
and this map gets repaired).

## Reading order for a NEW component

1. `component-authoring-foundations.md` — the load-bearing mental models the rest assumes.
2. Then the law doc your question lands on (table below).
3. `component-authoring-best-practices.md` — the judgment layer: what a competent author
   still gets wrong. Read last, once the law is loaded.

## The routing table

| Question | Owner (read this) | Decision authority behind it |
|---|---|---|
| Parts, slots, content model (host-as-grid vs rendered cell), adornments | `.claude/docs/references/anatomy.md` | ADR-0006 (optional leading slot, presence-driven `:has()`) · ADR-0012 (position slots × `data-role` roles) |
| Height / font / icon / padding at a given `[scale]`×`[size]`; the centering law; size-classes | `.claude/docs/references/geometry.md` (the resolved law) → `geometry-sizing-spec.md` (the §1 master ramp + rationale; **§5 wins on conflict**) | ADR-0038 (the explicit (scale × size) → §1-row LOOKUP — **no multipliers on the control path**) · ADR-0036 (single-line Control text `line-height: 1`) · ADR-0041 (the widget-box ramp for Indicator/Range classes) · ADR-0032 (the `ui-sm…content-lg` tier vocabulary — `density` keeps its own vocabulary; they are different axes) |
| hover · active · focus · disabled styling; the focus-ring; first-paint motion | `.claude/docs/references/interaction-states.md` | ADR-0008 (per-variant states) · ADR-0009 (shared focus-ring token) · ADR-0010 (`tabbable` trait + `aria-disabled`) |
| Which color role to consume; token naming | `.claude/docs/references/tokens.md` (the role SYSTEM; values live in `@agent-ui/shared/src/tokens/tokens.css`) | ADR-0057 (intent never travels by color alone — every intent needs a non-color signifier) |

## Traps the docs encode (route-to hints, not the content)

- Fonts and heights **step** across adjacent tiers — geometry tests must assert the exact §1
  integers and must NOT assume all-distinct values (`geometry-sizing-spec.md`).
- Frame quantities (radius, min-inline-size floors) split **by control class** — an entry
  control and a button answer differently (`geometry.md`; ADR-0021's law).
- `dimensional-standard.md` is **superseded/historical** — its producer→consumer wiring
  rationale holds, its specifics do not; each stale claim is flagged inline. Don't build on it.
- Some semantic color roles are deliberately **scheme-invariant** (identical in both
  `light-dark()` branches) — a "differs by scheme" proof must pick a genuinely divergent role;
  check the role's two branches in `tokens.css` before asserting divergence.

## Cross-links

Disk layout, barrels, descriptor, budgets → [[agent-ui-component-packaging]] · the probe/DoD
bar → [[agent-ui-component-testing]] · prior-art mechanisms (overlay, codec, provider…) →
[[agent-ui-component-patterns]] · the intake procedure → [[agent-ui-component-design]] · the
build procedure → [[agent-ui-component-create]].
