---
name: decomposing-systems
description: >
  Decompose any design or planning problem along two crossing planes — OUTSIDE-IN
  (whole → parts, top-down structure) and INSIDE-OUT (atoms/actions → surfaces,
  bottom-up) — then verify the two cover each other. Use when breaking down a
  layout, a component, a technical or UX architecture, a goal or plan, or any
  system into parts; when a breakdown feels lopsided (structure with no behavior,
  or actions with no home); or before authoring a PRD/SPEC/LLD that needs a
  decomposition first. Domain how-to lives in references/.
---

# Harness — Decomposer

Decomposition fails in one of two ways, and running a single direction hides the other. This skill runs **both planes** and makes the gap between them visible and checkable.

## The two planes

- **OUTSIDE-IN** — start from the whole and divide into parts, top-down: context → regions → groups → atoms. Produces the **structure** (a node tree). Answers *"what are the parts, and how do they nest?"*
- **INSIDE-OUT** — start from the irreducible units and compose upward, bottom-up: actions/atoms → bindings → surfaces → coherence. Produces the **behavior/needs** (an action set). Answers *"what must this do, and where does each capability live?"*

They are not alternatives. A decomposition is sound only when they **cross-check**:

| | has a surface (OUTSIDE-IN node) | no surface |
|---|---|---|
| **has an action (INSIDE-OUT)** | ✅ load-bearing | ❌ **unhosted action** — a need with nowhere to live |
| **no action** | ⚠️ **unjustified structure** — decoration / gold-plating (unless a declared affordance) | n/a |

The defect quadrant is the point of the skill: a clean structure that can't host the behavior, or behavior with no surface, are the two silent failures a single-plane breakdown ships.

## Process

1. **Pick the domain reference** (`references/<domain>.md`) for the concrete vocabulary of each plane; read `references/method.md` (procedure), `references/foundations.md` (the models it rests on), and `references/best-practices.md` (the do/don't); grade the result against `references/rubric.md`. If no domain fits, use `references/_template.md` to add one.
2. **Run OUTSIDE-IN** → a node tree. Mark leaf nodes; tag any pure-structure node with a `justify` (why it exists with no action — e.g. `affordance`, `grouping`).
3. **Run INSIDE-OUT** → an action/atom set (the verbs/needs/capabilities), independent of the structure so it can contradict it.
4. **Map** each action to the node(s) that host it.
5. **Check coverage** — write the decomposition to a manifest (schema below) and run `python scripts/coverage_check.py <manifest.json>`. It is deterministic; do not eyeball it.
6. **Fix** every `UNHOSTED` action (add or reshape structure) and every `DANGLING` ref; resolve each `UNJUSTIFIED-LEAF` (add the action it should host, add a `justify`, or delete the node).
7. **Re-check; finalize only when the script exits 0.** Hand the node tree + action map to the downstream author (planning-lead → PRD/SPEC/LLD).

## Manifest schema (what the check reads)

```jsonc
{
  "domain": "layout",
  "nodes":   [{ "id": "n1", "label": "submit bar", "leaf": true, "justify": null }],   // OUTSIDE-IN
  "actions": [{ "id": "a1", "label": "submit the form" }],                             // INSIDE-OUT
  "hosts":   [{ "action": "a1", "node": "n1" }]                                        // the crossing
}
```

## Domains (references/)

| Domain | OUTSIDE-IN axis | INSIDE-OUT axis |
|---|---|---|
| `layout` | frame → regions → groups → atoms | feature-actions → bindings → surfaces |
| `components` | module → component → primitive (tier ladder) | geometry → element → semantics → interaction |
| `technical-architecture` | system → subsystems → modules → units | capabilities → interfaces → data → integration |
| `ux-architecture` | journey → flows → screens → states | user-goals → tasks → interactions → feedback |
| `goals` | mission → outcomes → milestones → tasks | intent → acceptance criteria → checks |

Each reference gives that domain's two axes, the stop rule (when a part is atomic enough), and a worked pass. To add a domain, copy `references/_template.md`.

## Worked example (goals, abbreviated)

OUTSIDE-IN: `ship A2UI runtime` → `{renderer, default catalog, validation}` → `validation` → `{schema, catalog-conformance, id-graph}`.
INSIDE-OUT actions: `parse stream`, `render on root`, `reject invalid payload`, `bind data`.
Map → `reject invalid payload` hosts on `validation`; `bind data` finds **no node** → `UNHOSTED` → add `data-binding` under the renderer. Re-check → clean.

## Validation loop

draft both planes → write manifest → `python scripts/coverage_check.py <manifest.json>` → fix `UNHOSTED`/`DANGLING`/`UNJUSTIFIED-LEAF` → re-run → finalize at exit 0. The script is the gate; the prose is the method.
