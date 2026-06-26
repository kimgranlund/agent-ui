---
name: authoring-components
description: >-
  Author or upgrade a ui-* component in @agent-ui/components to the standard shape — pick the base
  class + size-class, scaffold the per-component folder, declare typed props (static props +
  ReactiveProps), wire behaviour with traits/controllers via host.use(), write the CSS trio (@scope +
  geometry + token roles), the .api.json descriptor, the probes, and clear the per-component
  definition-of-done. Use when adding a new ui-* control or component, or bringing an existing one up
  to the framework standard ("add a ui-button", "build the checkbox", "is this component up to standard").
---

# Authoring components

The one procedure for adding a `ui-*` component, so 60 components don't drift into 60 dialects. It is
**anti-drift by construction**: every component built this way is born coherent (see
[`docs/process.md`](../../../docs/process.md)). This skill is the *method*; the specifics live in
canonical docs it **cites, never copies** — read them, don't restate them.

## Canonical sources (read these; do not duplicate them)

- **API** — base classes, `static props`/`ReactiveProps` declare-merge, `host.use()`, `root`, `upgrade`,
  events: [`docs/plan.md`](../../../docs/plan.md) §5, realized in `packages/agent-ui/components/src/dom/`.
- **Geometry & sizing** — the centering law, the two families, size-classes, the ramp:
  [`docs/references/geometry.md`](../../../docs/references/geometry.md).
- **Color tokens** — the `--c-{family}-{role}` role system + consumption invariants:
  [`docs/references/tokens.md`](../../../docs/references/tokens.md).
- **Naming / TS / layering** — [`CLAUDE.md`](../../../CLAUDE.md). **Quality bar** — the COMPOSE/REALIZE
  component rubric + the api-contract schema (both land at G5; cite as forthcoming until then).

## When to use / when not

- **Use** when creating a `ui-*` component, or auditing/fixing one against the standard.
- **Skip** for kernel (`reactive/`) or base-class (`dom/`) work — those are graded by `docs/rubrics/{kernel,element}.md`, not this.

## Procedure

1. **Classify** — two axes:
   - *Base class* (plan.md §5): value-bearing form control → `UIFormElement`; reactive display →
     `UIElement`; layout primitive → `UIContainer`; orchestrating pattern → `UIComponent`.
   - *Size-class* (geometry.md): Control · Indicator · Pattern · Container/layout · Display — this sets
     the sizing lever.
2. **Scaffold** the per-component folder — `controls/{name}/` (FACE form controls) or `components/{name}/`
   (display/layout/pattern catalog), holding exactly:
   `{name}.ts` · `{name}-tokens.css` · `{name}-styles.css` · `{name}.css` (barrel) · `{name}.test.ts` · `{name}.api.json`.
3. **Typed props** (`{name}.ts`) — declare `static props` with the `prop.*` constructors and the
   `interface UI{Name}Element extends ReactiveProps<typeof props> {}` declare-merge (plan.md §5). Closed
   sets are `prop.enum([...] )` (literal unions), never `enum`. Don't re-specify the API — follow it.
4. **Behaviour** (`{name}.ts`) — extend the base; in `connected()` wire effects via `this.effect`,
   listeners via `this.listen`, traits/controllers via `this.use`; `render()` returns `html\`\`` for a
   content cell; ARIA via `this.internals` (never host attributes); emit only `change·input·select·open·
   close·toggle`. Self-define `UI{Name}Element.define('ui-{name}')`. Re-route manual value-taking
   accessors through `upgrade(...)` at connect.
5. **CSS trio** — behaviour-only `.ts`; styling is pure CSS:
   - `{name}-tokens.css` — `:where(ui-{name})` declares `--ui-{name}-*` from family roles
     (`var(--c-{family}-{role})`, tokens.md) and the dimensional ramps; `[size]`/`[tone]` repoint in pure CSS.
   - `{name}-styles.css` — `@scope (ui-{name}) { :scope { … } }`, consuming **only** `--ui-{name}-*`. Wire
     geometry per geometry.md: `block-size` off the ramp, `padding-block: 0`, the slot/slotless inline-pad,
     the `(height−glyph)/2` centering law, affordance `= font` vs content-icon `= --ui-ind`.
   - `{name}.css` — barrel: `@import` tokens then styles.
6. **Descriptor** (`{name}.api.json`) — the attributes-as-API record (validates against the api-contract
   schema, G5): tag · tier · extends · attributes (from `static props`) · properties (manual accessors) ·
   events · slots · parts · customStates · face · aria · keyboard · geometry · forcedColors.
7. **Probes** (`{name}.test.ts`) — behaviour (jsdom) + the geometry/token trip-wire checks from
   geometry.md "Mechanization" (`edge-pad == (height−glyph)/2`; `padding-block == 0`; `0 < glyph ≤ box`;
   affordance `== font`) and token hygiene (no raw primitive refs; every `--ui-{cmp}-*` in `:where()`).
   Browser-truth smoke (rendered px responds to `[size]`/`[scale]`/`[density]`; survives `forced-colors`) at G5.
8. **Validate** (loop below) — run the gates; fix; re-run until clean.

## Validation loop (finalize only when clean)

Draft → check → fix → re-check:

1. `npm run check` (tsc) and `npm test` (Vitest) both green.
2. The standing trip-wires pass: import-layering, naming/structure, `{name}.api.json` ↔ `static props`,
   zero-native + internals-ARIA, the geometry/token checks (step 7).
3. (G5+) the `component-reviewer` agent scores **both** COMPOSE and REALIZE axes ≥ 4.

If any fails, fix the component (not the check) and re-run. Finalize only when all are clean.

## Definition of done (per component)

- [ ] Right base class + size-class; props typed (literal unions, not `string`).
- [ ] Light DOM; ARIA via `internals`; no native form elements; events ∈ the allowlist.
- [ ] CSS trio with `@scope`; tokens in `:where()` from `--c-` roles; geometry off the ramp
      (`padding-block: 0`); affordances `= font`.
- [ ] `{name}.api.json` validates and matches `static props`.
- [ ] Probes green (jsdom) + browser-truth smoke (G5); `npm run check && npm test` green.
- [ ] Marginal size within the tier budget; tree-shake clean (importing it drags only it + real deps).

## Worked example

`ui-button` is the reference control — built end-to-end at **G5** (Control class; `variant`/`size` enum
props; `pressActivation` trait; `(height−glyph)/2` caret geometry; the `tokens.css` adoption + first
geometry trip-wire). Until it lands, this procedure is authored from the canonical docs above; the
example fills in at G5 and becomes the copy-from template.
