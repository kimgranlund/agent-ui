# agent-ui — foundation plan

> Status: planning. Companion: [`goals.md`](./goals.md) (the milestone/DoD breakdown).
> Reference standards (canonical, distilled): [`references/geometry.md`](./references/geometry.md) ·
> [`references/tokens.md`](./references/tokens.md). Provenance (rce ledgers + token values):
> `references/{dimensional-standard,geometry-sizing-spec}.md`, `references/tokens.css`.
> Coordination: the A2UI layer that consumes this foundation is specced under [`specs/`](./specs/)
> (PRD→SPEC→LLD) and built by the planning/execution team in [`../.claude/agents/`](../.claude/agents/);
> ratified design changes are logged as ADRs in [`adr/`](./adr/).

## 1. What this is

`agent-ui` is a zero-dependency, reactive **web-component library** authored in modern, advanced
TypeScript. It carries over the proven architecture of the `rce` prototype
(`/Users/kimba/Projects/fable-tests/reactive-components`) — but the foundation is **re-authored
here as TS-native code**, not consumed as a package. We keep rce's algorithms of record (the signal
graph, the scheduler budget, the FACE element host, the template part-system, the trait contract)
and re-express them with first-class types.

Four pillars, adopted deliberately:

| Pillar | What we take | Source of record (to port from) |
|---|---|---|
| **Signals & reactivity** | push-staleness / pull-value graph, version-equality cutoff, ownership scopes, microtask scheduler with a write-loop budget | rce `src/core/graph.ts` + `scheduler.ts` |
| **FACE custom elements** | `UIElement` (4 platform callbacks → the graph's 2 lifetimes), props-as-signals, light DOM, internals-only ARIA; `UIFormElement` form participation | rce `src/core/element.ts`, `props.ts`, `form.ts` |
| **Modern templating** | `html`/`svg` tagged templates → prepared parts → reconciled `render`; opt-in directives (`repeat`, `watch`, `classMap`, `ref`) | rce `src/core/template.ts`, `directives.ts` |
| **Traits** | stateless `(host, config) => release()` behaviours that ride the connection scope | rce `src/core/overlay.ts`, `orchestrate.ts`, `behaviors/*` |

**First component family: FACE form controls.** The first real surface is `ui-button`
(the reference control), then `ui-text-field` / `ui-checkbox` / `ui-switch`, then
`ui-select` / `ui-listbox` and the `ui-field` wrapper. Layout/display primitives come after the
control family is proven end-to-end.

## 2. Why these choices

- **Signals, not a VDOM.** Updates are value-diffs against a cached template instance; one render
  effect per host, per-part `Object.is` below it. No diff of unchanged subtrees, no framework runtime.
- **FACE over `<input>` wrappers.** Controls participate in forms via `ElementInternals`
  (`setFormValue`, `setValidity`, `role`, `aria*`) with zero native form elements — full control of
  geometry, ARIA, and styling. (One sanctioned exception class exists in rce: `<input type=password>`
  for OS masking; we adopt the same allow-listed-exception discipline rather than a blanket ban.)
- **Pure-CSS `@scope` distribution.** Behaviour-only `.ts` + external `{name}-styles.css` /
  `{name}-tokens.css`; components self-**define** but no longer self-**style**. Tree-shakeable,
  inspectable, no runtime style injection.
- **Traits over inheritance.** Cross-cutting behaviour (press activation, roving tabindex, focus
  trap, drag) composes as functions, avoiding a base-class diamond.

## 3. Architecture & directory layout

The kernel is small (rce's is ~2.3k lines across 8 modules). agent-ui is an **npm-workspaces monorepo**:
the framework is one package, with `shared` for cross-cutting tokens/styles/utils and `a2ui` (the A2UI
layer, now team-led under `docs/specs/`).

```
packages/agent-ui/
  components/                  # @agent-ui/components — the whole framework
    src/
      reactive/
        graph.ts        # Signal / Computed / Effect / Scope, untracked, unowned, inspect, CycleError
        scheduler.ts    # microtask queue, write-loop budget, whenFlushed
        index.ts        # public reactive surface (signal, computed, effect, createScope, …)
      dom/
        element.ts      # UIElement — the FACE host (graph ∘ props ∘ template)
        props.ts        # typed props-as-signals, the attribute↔value reflection boundary
        template.ts     # html / svg / render + parts
        directives.ts   # repeat, watch, classMap, ref, unsafeHTML
        form.ts         # UIFormElement — form participation over UIElement
        component.ts    # UIComponent — orchestration helpers pre-wired (later)
      traits/
        press-activation.ts, tabbable.ts, roving-tabindex.ts, track-user-invalid.ts, …
      controls/
        button/  text-field/  checkbox/  switch/  listbox/  select/  field/
          <name>.ts  <name>.css  <name>-tokens.css  <name>-styles.css  <name>.test.ts  <name>.api.json
      index.ts          # the package barrel (@agent-ui/components)
  shared/                      # @agent-ui/shared — tokens, styles, utility types
    src/
      tokens/  raw-color-tokens.css  semantic-color-tokens.css  runtime-tokens.css  tokens.css (barrel)
      index.ts
  a2ui/                        # @agent-ui/a2ui — A2UI layer, team-led (docs/specs/); depends on @agent-ui/components
docs/  plan.md  goals.md  process.md  references/    # repo root
```

Layering is strict and inward-only: `reactive` imports nothing; `dom` imports `reactive`; `controls`
import `dom` + `traits` + their own CSS; cross-package, only `components` → `@agent-ui/shared`; nothing
imports upward. The import-layering trip-wire (`packages/agent-ui/components/src/layering.test.ts`) enforces it.

## 4. The reactivity kernel (port + re-type)

Preserve these invariants exactly — they are the correctness core and rce found real bugs proving them:

- **Push possible-staleness, pull values, cut on equality.** A write bumps `_version` only when the
  value actually changes (`Object.is`); staleness propagates eagerly; recomputation is lazy and
  verified at *both* computeds and effects (a scheduled effect whose sources verify unchanged skips
  its body).
- **Ownership scopes make disposal provable.** Computeds/effects created inside a scope die with it
  (`scope.dispose()` ⇒ zero subscribers). Signals are inert boxes, safe to hold.
- **`untracked` / `unowned`** — read without subscribing / create outside any scope (the latter is
  load-bearing: lazily-created module singletons must not be adopted by whichever component's
  connection scope happened to trigger first touch).
- **Scheduler**: a `Set`-deduped microtask queue, a ~100-wave write-loop budget that throws rather
  than hang, and a settled promise behind `whenFlushed()`.
- **`CycleError`** on re-entrant computed read; a throwing computed/effect stays dirty and retries
  (failure poisons verification so the retry recomputes).
- **`inspect(node)`** — a pure, graph-inert readonly snapshot; the public face of the internal
  instrumentation.

### TS surface

```ts
export interface ReadonlySignal<T> { readonly value: T; peek(): T }
export interface Signal<T> extends ReadonlySignal<T> { value: T }

export function signal<T>(initial: T): Signal<T>
export function computed<T>(fn: () => T): ReadonlySignal<T>
export function effect(fn: () => void | (() => void)): () => void
export function createScope(): Scope
export function untracked<T>(fn: () => T): T
export function unowned<T>(fn: () => T): T
export function inspect(node: ReadonlySignal<unknown>): NodeSnapshot
```

The internal producer/consumer protocol (a Computed reading another node's subscriber set and
version) cannot use `#private` — same-class-only access does not span `Signal`/`Computed`/`Effect`.
Model it as explicit interfaces and back them with documented internal fields:

```ts
interface Producer { readonly subscribers: Set<Consumer>; version: number }
interface Consumer { track(src: Producer): void; markStale(): void }
```

Everything outside that protocol uses `#private`. This is the typed equivalent of rce's documented
`_subs`/`_version`/`_sources` surface.

## 5. The FACE element layer

### `UIElement` (the host)

Maps the four platform callbacks onto the graph's two lifetimes:

- `connectedCallback` → create a connection **scope** + an `AbortController`; run `connected()` and
  install **one render effect** under the scope (every render pass runs under the scope, so a
  directive attaching on a later conditional re-render is scope-owned too).
- `disconnectedCallback` → `scope.dispose()` (every computed/effect dies) + `ac.abort()` (every
  platform listener dies). "Zero subscribers after removal" is provable, not aspirational.
- Helpers: `this.effect(fn)` (scope-owned), `this.listen(target, type, fn)` (rides `{ signal }`),
  `this.emit(type, detail)` (composed/bubbling/cancelable `CustomEvent`), `updateComplete`.
- **Light DOM by default**; `static shadow` opts a single shadow root (only the app shell needs it).
- ARIA via `attachInternals()`, never host attributes.
- The lazy-property upgrade dance (`upgradeProps` at connect; `upgradeProperty(...)` for manual
  array/object accessors) — a `.prop=` binding set before upgrade otherwise shadows the accessor.

### Props as typed signals (the headline TS pattern)

A declared prop **is** a kernel signal behind a prototype accessor; reading `this.count` inside an
effect tracks it, writing it invalidates and (when declared `reflect`) crosses back to the attribute
under directional locks so the platform's echo can't loop. The string↔typed boundary lives at exactly
two functions.

We make the **schema a typed dict** and infer the instance's accessor types from it — no decorators
(banned by `erasableSyntaxOnly`), no hand-written duplication:

```ts
// typed prop constructors carry the value type
type PropType<T> = { from(attr: string | null): T; to(value: T): string | null }
interface PropConfig<T> { type: PropType<T>; default: T; attribute?: string | false; reflect?: boolean }

export const prop = {
  string : (def = ''      ) => ({ type: Types.string,  default: def }) satisfies PropConfig<string>,
  number : (def: number | null = null) => ({ type: Types.number, default: def }),
  boolean: (def = false   ) => ({ type: Types.boolean, default: def }),
  enum   : <const T extends readonly string[]>(values: T, def: T[number]) =>
             ({ type: enumType(values), default: def }) as PropConfig<T[number]>,
  json   : <T>(def: T) => ({ type: jsonType<T>(), default: def }),
}

type PropsSchema = Record<string, PropConfig<unknown>>
// map the schema dict → the instance's reactive property types
export type ReactiveProps<S extends PropsSchema> = { [K in keyof S]: S[K] extends PropConfig<infer T> ? T : never }
```

Authoring a control then reads:

```ts
const props = {
  variant : prop.enum(['solid', 'soft', 'ghost'], 'solid'),
  size    : prop.enum(['sm', 'md', 'lg'], 'md'),
  disabled: prop.boolean(false),
} satisfies PropsSchema

export interface UIButtonElement extends ReactiveProps<typeof props> {} // declaration merge → typed accessors
export class UIButtonElement extends UIFormElement {
  static props = props
  // `this.variant` is 'solid'|'soft'|'ghost', `this.disabled` is boolean — inferred, runtime-installed by finalize()
}
```

The class + same-name `interface` merge gives fully-typed, fully-inferred prop accessors that the base
class installs at runtime via `finalize()` — the modern, decorator-free expression of rce's pattern.
`enum`/`json` use a `const` type parameter so literal unions are preserved.

### `UIFormElement` (form participation)

`extends UIElement` with `static formAssociated = true`, internals acquired once in the constructor,
a `value` signal-prop, and connection-scoped effects wiring `setFormValue` and (optionally)
`setValidity` from a `validity()` hook. Platform doors `formResetCallback` / `formDisabledCallback`
make reset and disabled reactive. User-invalid timing (`aria-invalid` only after interaction) is a
small shared trait. This is the base every control in the first family extends.

## 6. Templating & directives

- `html\`…\`` / `svg\`…\`` return inert results; first render of a call site prepares its frozen
  `strings` (markers → one `<template>` parse → a parts manifest), cached forever in a `WeakMap`
  keyed by `strings` identity. Re-renders re-parse nothing.
- Part kinds, by binding sigil: child (text/template/array/directive), `attr`, `?bool`, `.prop`,
  `@event`. Each owns one site and its own `Object.is` dirty check. Event parts keep a stable
  listener identity (the handler swaps inside).
- Directives are branded update functions threading state across commits of the same hole, with a
  `dispose()` for teardown. Ship `repeat` (keyed reconcile), `watch` (signal-in-hole without
  re-running the host render effect), `classMap`, `ref`, and `unsafeHTML` (the one sharp edge, named).

## 7. Traits

Contract: `trait(host, config?) => release()`. Attach in `connected()`, store the release, call it in
`disconnected()` (idempotent — safe even if never attached, safe to call twice). A trait owns at most
one internal signal and reflects only to its declared `data-*` hooks; all listeners ride
`this.listen` and all effects ride `this.effect`, so the trait's lifetime is the component's.

Traits needed for the control family (build alongside the controls that need them):
`pressActivation` (Space/Enter → click, disabled-inert), `tabbable`, `trackUserInvalid`,
`rovingTabindex` (radio/segmented), and later `focusTrap` / `scrollLock` / `anchor` for overlays.

## 8. Styling & the dimensional system

Every component is a folder of behaviour-only `.ts` + a CSS trio:

- `{name}-tokens.css` — `:where(ui-{name})` (specificity 0,0,0) declares `--ui-{name}-*` defaults from
  family-prefixed color roles (`--c-{family}-{role}`) and the dimensional ramps; `[size]` / `[tone]`
  selectors repoint them in pure CSS (no JS, no `observedAttributes`).
- `{name}-styles.css` — `@scope (ui-{name}) { :scope { … } }`, consuming only `--ui-{name}-*`.
- `{name}.css` — barrel: `@import` tokens then styles.

**Dimensional standard** (see `references/dimensional-standard.md`): vertical size is
`block-size: var(--ui-{cmp}-height)`, **never** block-padding (`padding-block: 0`); inline-padding is
*derived* from height (`2px + height × 0.375 × density`); `scale × size → {height, font, indicator}`;
density multiplies inline spacing only. Controls are the **Control class** (full height); checkbox/
switch are the **Indicator class** (the box rides `--ui-ind-{size}`). Affordance glyphs (the select
caret, field steppers, clear ×) follow the geometry law in `references/geometry-sizing-spec.md`:
a `--ui-glyph-{size}` ramp token and the `(height − glyph) / 2` centering law, with asymmetric padding
where an affordance sits inside the box. The nonoun *studio-54* token set
(`references/.../studio-54-the-dancefloor`) is the seed palette; tokens must be **loaded first** or
every `var(--ui-height-*)` falls to its literal floor.

## 9. Naming & TypeScript conventions

This section is itself a deliverable — the foundation's job is to set the patterns everything copies.

**Identifiers**
- Tags: `ui-{name}` (kebab). Classes: `UI{Name}Element` (Pascal). Files: kebab-case `.ts`, one folder
  per component. Tokens: `--ui-{name}-{prop}`; color roles `--c-{family}-{role}`; scales `--space-*`,
  `--radius-*`, `--ui-{height,font,ind}-{sm,md,lg}`.
- Events: simple names only — `change`, `input`, `select`, `open`, `close`, `toggle` (no `ui-`-prefixed
  compounds). Typed via a `CustomEvent<Detail>` map and an `HTMLElementEventMap` augmentation.
- Register tags in `HTMLElementTagNameMap` so `document.querySelector('ui-button')` is typed.

**Type-system patterns (modern/advanced, decorator-free)**
- **Closed sets are `as const` objects or string-literal unions, never `enum`** (`erasableSyntaxOnly`):
  ```ts
  export const Size = { sm: 'sm', md: 'md', lg: 'lg' } as const
  export type Size = (typeof Size)[keyof typeof Size]   // 'sm' | 'md' | 'lg'
  ```
- **Typed dicts / typed data** are the default shape for configuration: `Record<K, V>` for closed
  keys, `ReadonlyMap`/`Map` for dynamic, `satisfies` to keep literal types while checking shape, and
  **mapped + conditional types** to derive one dict's type from another (the `ReactiveProps<S>` pattern
  in §5 is the canonical example). Prefer `keyof` + indexed access over restating union members.
- **`const` type parameters** (`<const T extends …>`) to preserve literal tuples/unions through helpers
  (prop `enum`, token sets).
- **Branded/nominal types** for stringly values that must not be confused:
  ```ts
  type Brand<T, B extends string> = T & { readonly __brand: B }
  type Tag = Brand<string, 'tag'>; type TokenName = Brand<string, 'token'>
  ```
- **Discriminated unions** for state (validity `{ valid: true } | { valid: false; message: string }`,
  part kinds, directive results) — exhaustiveness checked via `noFallthroughCasesInSwitch` + a `never`
  default.
- **`declare`-merged accessors** (class + same-name interface) for runtime-installed props — the only
  way to get inferred typed accessors without decorators. `declare` is fully erasable.
- **Encapsulation**: `#private` fields by default; the reactive graph's cross-node protocol is the one
  documented exception (modeled as `Producer`/`Consumer` interfaces, §4). Expose introspection through
  `inspect()`, not raw fields.
- **Imports**: `import type { … }` for type-only (`verbatimModuleSyntax`); keep the `.ts` extension on
  local imports (`allowImportingTsExtensions`); no unused bindings.
- Add `"DOM.Iterable"` to `tsconfig` `lib` (the template engine spreads `NodeList`/`attributes`).

## 10. Quality bar

Three instruments, ported from rce's discipline:

1. **API contract** — each control ships `{name}.api.json`: an "attributes-as-API" descriptor
   (tag · tier · extends · attributes[type/reflect/default] · properties[manual/readonly] · events ·
   slots · parts · customStates · face[formAssociated/value/validity] · aria[role/labelSource] ·
   keyboard · geometry · forcedColors). Machine-checkable; keeps the public surface from drifting.
2. **Evaluation rubric** — two crossing axes scored separately: **COMPOSE** (layer/anatomy/API/
   composition/coherence) and **REALIZE** (geometry/element/semantics/interaction/fidelity). Shippable =
   both review axes ≥ 4 and zero gate fails. A clean API can't hide an inert build.
3. **Per-component definition of done** (see `goals.md`): probes green, `tsc` clean, budget held,
   browser-truth smoke green, contrast re-validated, forced-colors survived.

**Budgets** (gz; provisional, confirm with a `size` script): reactive+dom kernel ≤ ~6 kB consumer;
per-control marginal ≤ ~1.5–2 kB; a keep-all library ratchet that is shrink-only. Tree-shake proof:
importing one control drags only it + real deps.

**Test strategy.** agent-ui has no runner yet. **Recommendation: Vitest** (Vite-native, TS-native) —
jsdom/happy-dom for the fast structural/behaviour probes, `@vitest/browser` (Playwright) for the
**browser-truth** layer that jsdom cannot judge (`@scope`, `light-dark()`, container queries, top
layer, real focus, computed geometry px, the AX tree). `tsc --noEmit` (already the `build` gate) stays
the type gate. Zero-dep alternative: node:test `--experimental-strip-types` + a custom Playwright
smoke (rce's approach) — chosen if we want to keep `devDependencies` minimal. **Open decision, see §12.**

## 11. Phasing (maps to `goals.md`)

```
G0  Tooling & conventions baseline   (runner, tsconfig lib, folder layout, naming/lint, this plan)
G1  Reactivity kernel                (graph + scheduler, probe-backed)
G2  Element + typed props            (UIElement, props-as-signals, reflection, the ReactiveProps pattern)
G3  Templating + directives          (html/svg/render/parts, repeat/watch/classMap/ref)
G4  FACE base + control traits       (UIFormElement; pressActivation/tabbable/trackUserInvalid)
G5  ui-button — the reference control (end-to-end: CSS trio, dimensional tokens, api.json, rubric)
G6  ui-text-field / ui-checkbox / ui-switch
G7  ui-listbox / ui-select / ui-field (+ form-provider) — first family complete
G8  Gallery demo + release-readiness pass
```

G1–G4 are the prerequisite kernel slice; G5 is the proving vertical (one control taken fully to the
quality bar, including the global token wiring) before G6–G7 fan out.

## 12. Open decisions & risks

- **Test runner** (§10): **RESOLVED → Vitest** (jsdom inner loop; `@vitest/browser` + Playwright for the
  browser-truth layer at G5). `tsc` (`npm run check`) stays the type gate.
- **App build/dev entry**: the demo `index.html` was removed, so `vite build` / `dev` have no entry until
  the gallery (G8). `npm run check` + `npm test` are the standing gates meanwhile; revisit a library-emit
  build (the "Library emit" item above) when agent-ui is first consumed.
- **Library emit**: agent-ui currently builds as an app (`noEmit`). Shipping it as a consumable package
  later needs a `tsc` emit + `.d.ts` path (rce uses a separate `tsconfig.build.json`); out of scope
  until the first family ships.
- **Password exception**: adopt rce's allow-listed `<input type=password>` exception, or hold a strict
  zero-native line and accept the masking gap. Decide when `ui-password-field` is scheduled (post-family).
- **Shadow vs light boundary for the eventual app shell** — only the shell needs a shadow root; controls
  stay light DOM.
- **Risk**: the `declare`-merge prop pattern is ergonomic but unusual; validate it against the strict
  tsconfig early in G2 before every control depends on it.
```
