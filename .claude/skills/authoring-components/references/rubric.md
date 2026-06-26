# Rubric — ui-* component (the skill's output)

> The standard a finished component is scored against. The **canonical** rubric is the two-axis
> COMPOSE/REALIZE component rubric, which lands at **G5** as `docs/rubrics/component.md`. This file is a
> **derived pointer** — it does not copy the canonical dimensions/anchors; consult that doc once it
> exists. The interim summary below is the standard until then. 2026-06-26.

## The two axes (scored separately — the defect quadrant)

A clean API can't offset an inert build; the axes are never averaged.

- **COMPOSE** (whole→part): `A1` layer/tier · `A2` anatomy · `A3` API surface · `A4` composition ·
  `A5` coherence. *(A1/A2 are `[gate]`; A3–A5 are `[review]`, 1–5.)*
- **REALIZE** (part→whole): `B1` geometry · `B2` element · `B3` semantics · `B4` interaction ·
  `B5` fidelity. *(B1–B3 are `[gate]`; B4/B5 are `[review]`, 1–5.)*

## Gate to promote (shippable)

Both review axes **≥ 4** AND **zero gate fails**. Before any judgement, the mechanical trip-wires
(naming/structure, contract↔props, import-layering, the geometry/token checks, zero-native) must pass —
a component that fails them is not reviewable. (`docs/process.md` §1)

**Top failure to look for first:** a designed-right / built-wrong component — high COMPOSE, low REALIZE
(e.g. a clean API whose geometry ignores the centering law or that dies in `forced-colors`).

> When `docs/rubrics/component.md` lands (G5), this file points to it as the single source; the summary
> above is the interim standard, kept deliberately thin so it does not fossilize against the canonical one.
