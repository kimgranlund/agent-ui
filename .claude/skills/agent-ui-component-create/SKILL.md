---
name: agent-ui-component-create
description: >-
  The ordered BUILD procedure for one ui-* agent-ui component, from a frozen design to a
  reviewed, gate-green control: classify → scaffold the folder → typed props → behaviour +
  traits → the single {name}.css to the geometry law → truthful descriptor → the full probe
  set → validation loop → independent review. Use for "build ui-x", "implement this
  component LLD", "bring ui-y up to standard". This skill owns the procedure; the
  component-builder agent preloads it as its seat's method. NOT for the design intake —
  forks, geometry-row assignment, ADRs (agent-ui-component-design) — and never a substitute
  for the independent component-reviewer pass (generator ≠ critic).
user-invocable: true
disable-model-invocation: false
---

# Component create — the build procedure

Implements ONE `ui-*` component per pass to the repo standard, so the fleet shares one shape
instead of drifting into dialects. **Anti-drift by construction**: the standard lives in the
canonical docs mapped by [[agent-ui-component-standards]] / [[agent-ui-component-packaging]] /
[[agent-ui-component-testing]] — **cite, never copy**; read them rather than restating them.
Build to a frozen design ([[agent-ui-component-design]]'s output) when one exists; a wall the
frozen design caused is **escalated, never locally deviated around** (the deviation may be
right and it is still a breach — the record must be amended through the design seat).

`ui-button` is the realized reference — read
`packages/agent-ui/components/src/controls/button/button.{ts,css,md,test.ts}` end-to-end
before a first build; `controls/checkbox/` is the gold probe template.

## Procedure

1. **Classify** (or confirm the frozen design's classification) — base class from the
   schema's `BASE_CLASSES` six (`component-descriptor.ts`): `UIElement` · `UIFormElement` ·
   `UIContainerElement` · the `controls/_base/` targets `UIIndicatorElement` /
   `UIRangeElement` / `UIListboxElement` (ADR-0042); narrowest that fits (the orchestrating
   `UIComponent` tier is planned in plan §5, NOT realized — don't classify against it) ×
   size-class = the descriptor's `tier:`, one of the schema's `SIZE_CLASSES` seven
   (`geometry.md` owns each class's sizing law).

2. **Scaffold** the per-component folder — `controls/{name}/` (ALL components today, display
   and layout included; `components/{name}/` is the packaging doc's RESERVED future split,
   not yet realized — the barrel and `component-styles.css` wire only `controls/`) — holding
   exactly `{name}.ts` · `{name}.css` (single file, ADR-0003) · `{name}.md` (descriptor,
   ADR-0004) · `{name}.test.ts` (+ `{name}.browser.test.ts`, `{name}-descriptor.test.ts` per
   the test bar).

3. **Typed props** (`{name}.ts`) — `static props` with the `prop.*` constructors and the
   `interface UI{Name}Element extends ReactiveProps<typeof props> {}` declare-merge. Closed
   sets are `prop.enum([...])` literal unions — never `enum` (breaks the declare-merge, and
   `erasableSyntaxOnly` bans it), never a free `string`.

4. **Behaviour** (`{name}.ts`) — extend the base; in `connected()` wire
   `this.effect`/`this.listen` and call each trait directly as `traitName(this, opts)` (the
   returned `release` is the early-teardown escape hatch; traits auto-clean on disconnect).
   Content model per the anatomy law: host-as-grid (`render()` stays the inherited no-op) or
   a rendered content cell. Gate first-paint motion behind the `ready` state. ARIA via
   `this.internals` — never host attributes. Emit only
   `change · input · select · open · close · toggle`. Self-define at module scope:
   `if (!customElements.get('ui-{name}')) customElements.define('ui-{name}', UI{Name}Element)`.

5. **CSS** (single `{name}.css`) — behaviour-only `.ts`; styling is pure CSS in two sectioned
   blocks: a `:where(ui-{name})` **token block** declaring `--ui-{name}-*` from the
   `--md-sys-color-{family}-{role}` roles + the dimensional ramps (`[size]`/`[tone]` repoint
   in pure CSS), and an `@scope (ui-{name}) { :scope { … } }` **styles block** consuming ONLY
   `--ui-{name}-*`. Geometry per [[agent-ui-component-standards]]'s law: `block-size` off the
   ramp, zero block padding, the centering law. Keep the blocks sectioned so the "tokens in
   `:where()`" probe can tell declaration from consumption. (Beware the `*/`-inside-a-comment trap — a
   stray close silently drops the next rule; only browser smokes catch it.)

6. **Descriptor** (`{name}.md`) — the attributes-as-API record; the field set is what
   `FIELD_SHAPE` enumerates in the schema source
   (`packages/agent-ui/components/src/descriptor/component-descriptor.ts`) — **block-style
   YAML + inline `[a, b]` arrays only** (flow mappings do not parse). Declare
   `slots`/`customStates` truthfully: they are trip-wired against source.

7. **Probes** — the full [[agent-ui-component-testing]] bar: descriptor trip-wire · jsdom
   behaviour + geometry/token trip-wires · cross-engine browser truth incl. the WHOLE-shape
   bounding-box assertion in a realistic container (jsdom-green ≠ done; geometry must be
   browser-MEASURED) · a built-output leg when the design depends on production CSS behavior.

8. **Integrate** — barrel export (`controls/index.ts`), `component-styles.css` `@import`,
   `package.json` `exports` subpath, and the site surfaces the design named (doc/demo pages,
   gallery/preview specimen) with their standing gates; regenerate llms artifacts after
   descriptor/CHANGELOG/page changes (`node scripts/generate-llms-full.mjs`).

## Validation loop (finalize only when clean)

1. `npm run check` (tsc + site) and `npm test` green — read the gate, THEN commit, separately.
2. Standing trip-wires pass: import-layering, naming/structure, descriptor ↔ `static props`
   AND ↔ source, zero-native + internals-ARIA, the geometry/token checks. A slot/role/prop
   **rename** is a deliberate contract change — run the migration step
   (`.claude/docs/process.md`) before treating it as done.
3. `npm run size` by hand when the bundle surface changed (manual by Kim's ruling);
   marginal size within the tier budget, tree-shake clean.
4. **Hand off to the `component-reviewer` agent** (both rubric axes ≥ 4 at G5+) — the
   non-optional independent pass before any control-wave commit. Fix the component, not the
   check.

## Definition of done

- [ ] Right base class + size-class; props typed (literal unions, not `string`).
- [ ] Light DOM; ARIA via `internals`; no native form elements; events ∈ the allowlist.
- [ ] Single `{name}.css` with `@scope`; tokens in `:where()` from the color roles; geometry
      off the ramp.
- [ ] `{name}.md` validates and matches `static props` AND the source.
- [ ] Full probe set green incl. cross-engine browser truth (+ built-output leg where earned).
- [ ] Integrated (barrel/exports/styles/site) with standing gates green; size in budget.
- [ ] Independent `component-reviewer` pass done; findings fixed.
