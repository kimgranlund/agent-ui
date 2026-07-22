---
name: agent-ui-example-standards
description: >-
  The example-builder seat's canonical sources, the two standing laws (representative specimen,
  one-knob-per-prop), the inventory→propose→implement→re-probe procedure, and the validation loop
  for the docs site's preview example content. Model-only knowledge preloaded by the example-builder
  seat; not a user-facing action.
user-invocable: false
disable-model-invocation: true
---

# example-builder standards

## Canonical sources (read before you start; cite, never copy)

- **The preview harness** — `site/lib/component-preview.ts`: the `<component-preview>` element, `#buildKnob`
  (the knob→control mapping — the single source of every `cp-knob-*`), `SAMPLE_TREES` + `sampleFor`
  (per-container specimen trees + the generic fallback), the a2ui-mode defaults, and
  `COMPONENT_SAMPLE_CHILDREN`. You edit the CONTENT + knob CONFIG here — never the harness's render
  pipeline, and never concurrently with docs-writer (the maker↔maker file-race).
- **The gallery** — `site/lib/component-gallery.ts`: composes one `<component-preview>` per fleet member
  from `ALL_DESCRIPTORS`; `themeSelect()` is the reference ui-select-knob wiring.
- **Per-control doc pages** — `site/pages/*-doc.ts` + the shared `site/lib/doc-page.ts` renderer.
- **What a control IS** — its `{name}.md` descriptor under `packages/agent-ui/components/src/controls/{name}/`
  (tier, attributes, slots, content model) — the source of truth for a faithful specimen; and the shipped
  ui-* control APIs you consume for knobs (`ui-select` `value`+`select`, `ui-segmented-control`/`ui-segment`
  `checked`+`change` (ADR-0095, small closed enums), `ui-checkbox`/`ui-switch` `checked`+`change`,
  `ui-slider` range, `ui-text-field` `value`+`input`).
- **Conventions / gates** — `CLAUDE.md`; the site drift gates (site-canon / coverage / toc / nav) and the
  descriptor↔props trip-wire that pins any derived table.

## The two standing laws

1. **Representative specimen.** A specimen must show the control doing its actual job with realistic content
   and realistic quantity/arrangement — a `ui-grid` shows a real grid of cells, a `ui-list` a populated
   list, a `ui-row` several items revealing the axis + gap. A single stub cell, lorem "Sample content", or
   an empty container is a defect: it teaches nothing. Derive the shape from the control's tier + content
   model in its descriptor.
2. **One control per prop, right type, no redundancy.** A prop gets exactly one knob, chosen by type:
   closed enum → `ui-segmented-control` (small, ≤5 members — ADR-0095, superseding the retired
   `ui-radio-group[variant="segmented"]`) or `ui-select` (large); boolean → `ui-switch` / `ui-checkbox`;
   numeric range with min/max/step → `ui-slider`; free number/string → `ui-text-field`.
   Never render the same prop twice — historical case in point: a doubled PROPS knob plus a redundant
   `#buildChipRow` VARIANTS chip-row for the same prop, fixed 2026-07-06 (`7dfdecd`) by removing the
   chip-row and letting the typed knob carry it.

## Procedure

1. **Inventory** — enumerate every control's example content across all sources above; for each, record the
   current specimen + its representativeness verdict (representative / stub / empty / wrong-shape) and the
   current knob set + any redundancy or wrong-type control. Output a table.
2. **Propose** — for each defect, the specific fix (the better specimen shape; the control-type change; the
   redundancy to remove). Hand the inventory + proposal to the host and get direction before mass-editing —
   representativeness is the host's taste call.
3. **Implement** the approved changes in `component-preview.ts` (the knob→control map, `SAMPLE_TREES`/
   `sampleFor`) and any doc-page demo content — consuming the shipped ui-* controls, never editing them.
   If a control can't express what a knob needs, STOP and report the fleet gap.
4. **Update the probes** — re-point any preview/gallery browser test that queried the old control structure;
   add an assertion that a representative specimen renders (e.g. a grid preview mounts >1 cell).

## Validation loop (finalize only when clean)

1. `npm run check` (tsc + site) · `npm test` · `npm run test:browser` (the preview/gallery + touched pages,
   both engines) · `npm run build` — all green; the site drift gates pass.
2. Assert the WHOLE rendered shape, not a single part — a specimen can pass a per-element probe and still
   read as an empty box (the "test the whole shape" law). Measure the rendered preview in a realistic frame.
3. Hand off to `teamwork:code-checker` for the code, and surface the visual result to the host for the taste verdict.
   Fix the example, never the control.

## Definition of done

- [ ] Every touched preview shows a representative specimen (real content + quantity), verified rendered.
- [ ] Each prop has exactly one knob of the correct ui-* type; no doubled PROPS/VARIANTS; no native controls.
- [ ] ui-* controls consumed, not modified; any fleet gap reported, not worked around silently.
- [ ] Probes re-pointed + a whole-shape specimen assertion; `check` · `test` · `test:browser` · `build` green.
- [ ] Inventory + proposal shown to the host before mass-editing; representativeness verdict is the host's.

The dogfooded knobs in `site/lib/component-preview.ts` `#buildKnob` (ui-select / ui-checkbox / ui-text-field)
are the realized reference for consuming a control as a knob — read them before your first change.
