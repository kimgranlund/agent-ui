# agent-ui — goals

> Companion to [`plan.md`](./plan.md). Milestones are sequential: each `Gn` depends on the prior.
> A milestone is **done** only when every box in its Definition of Done is checked.
> First component family = FACE form controls (button → text-field/checkbox/switch → listbox/select/field).
> Layout: npm-workspaces monorepo — `src/core/*` in milestone text now lives under `packages/agent-ui/components/src/*`.
> Consumed by the A2UI effort (`docs/specs/`, `@agent-ui/a2ui`), which tracks these milestones (its
> Assumption A-2 ≈ G7) and is coordinated by the planning/execution team (`.claude/agents/`).

## Standing definition of done (applies to every milestone)

- [ ] `npm run check` (tsc) and `npm test` (Vitest) are green. (`vite build` is dormant until the gallery — G8.)
- [ ] No unused locals/parameters; type-only imports use `import type`; local imports keep `.ts`.
- [ ] New behaviour is covered by probes; the whole suite stays green (monotonic — nothing regresses).
- [ ] Public surface changes are reflected in the relevant `{name}.md` frontmatter (ADR-0004) and in `plan.md` if a decision moved.

---

## G0 — Tooling & conventions baseline

**Goal.** Make the repo able to host the foundation: pick the test runner, adjust tsconfig, lay down
the folder structure and naming/lint conventions, and replace the starter scaffold's demo wiring.

**Scope.** No kernel code yet — just the ground everything else stands on.

**Deliverables.**
- Test runner chosen and wired (Vitest *or* node:test — resolves `plan.md` §12). `npm test` runs.
- `tsconfig.json`: add `"DOM.Iterable"` to `lib`; confirm test types resolve.
- `src/core/{reactive,dom,traits,controls,tokens}/` directories created with `index.ts` barrels.
- A naming/convention check (lint rule or a probe) that asserts: `ui-*` tag ↔ `UI*Element` class,
  one folder per component, `import type` for type-only imports.
- `src/main.ts` reduced to a foundation entry point (the counter/hero demo removed or parked).

**Definition of done.**
- [x] `npm run check` (tsc type gate) and `npm test` (Vitest/jsdom) both green. *(The app `vite build` /
      `dev` entry was removed with the demo and returns with the gallery at G8; `check` is the standing
      type gate until then.)*
- [x] The decision in `plan.md` §12 (test runner) is recorded as resolved → **Vitest**.
- [x] A toolchain sample (`src/toolchain.test.ts`) type-checks and runs, proving Vitest + jsdom + strict
      TS + custom elements end-to-end. *(Real `signal`/`effect` probes replace it at G1.)*
- [x] Demo scaffold removed; `src/core/` layer dirs + barrels + the import-layering trip-wire in place.
      *(Naming/structure + contract↔props gates deferred to G5/G2, where the concrete shape exists.)*

---

## G1 — Reactivity kernel

**Goal.** Port rce's `graph.ts` + `scheduler.ts` into `src/core/reactive/`, re-typed TS-native.

**Scope.** `Signal` / `Computed` / `Effect` / `Scope`; `signal` / `computed` / `effect` /
`createScope` / `untracked` / `unowned` / `inspect`; `CycleError`; the scheduler (queue, write-loop
budget, `whenFlushed`). The `Producer`/`Consumer` protocol interfaces (`plan.md` §4).

**Definition of done.**
- [x] Public surface matches `plan.md` §4; `ReadonlySignal<T>` / `Signal<T>` enforce read-only vs
      writable at the type level (proven by a `// @ts-expect-error` probe + the `tsc` gate).
- [x] Probes cover equality cutoff, lazy+verified recompute at computeds **and** effects, scope disposal
      ⇒ zero subscribers, `untracked`/`unowned`, `CycleError` on warm re-entry, a throwing computed stays
      dirty and retries (failure poisons verification), scheduler dedupe + the ~100-wave budget throw +
      `whenFlushed()`. **20 probes green.** *(Gaps to all-5s: a dedicated `throw-retry-effect` probe; the
      `reconnect-zero-residue` cycle lands at G2 where elements exist.)*
- [x] `inspect()` is proven graph-inert (no edge inside a tracking context; no eval of a dirty computed).
- [x] Kernel size measured and recorded: **1209 B gz** (3377 B min) for the full reactive barrel
      (graph + scheduler) — within the kernel budget.

**Verdict.** Kernel rubric (`docs/rubrics/kernel.md`) self-score: K1 5 · K2 4 · K3 4 · K4 5 · K5 5 · K6 5 ·
K7 5 · K8 5. Promotion gate (K1–K4, K7 ≥ 4; K5, K6 ≥ 4; K8 ≥ 3): **PASS** — kernel shippable.
Code: `packages/agent-ui/components/src/reactive/` (`graph.ts`, `scheduler.ts`, `index.ts`).

---

## G2 — Element + typed props

**Goal.** `UIElement` (the FACE host) and props-as-signals with the inferred-type schema pattern.

**Scope.** `src/core/dom/element.ts` + `props.ts`. Connection scope + AbortController lifecycle,
`this.effect` / `this.listen` / `this.emit` / `updateComplete`, light-DOM default, `attachInternals`,
the lazy-property upgrade dance. Typed props: `prop.*` constructors, `PropType`/`PropConfig`,
`ReactiveProps<S>`, the attribute↔value reflection with the directional locks.

**Definition of done.**
- [x] The `declare`-merge prop pattern (`interface X extends ReactiveProps<typeof props> {}`) compiles
      under the strict tsconfig and yields correctly-typed accessors (`enum` props are literal unions,
      not `string`). **This validates the headline TS bet — do it before any control depends on it.**
      *(props-typing.test.ts; negative-control verified: a bare `string` → `TS2322` against the union.)*
- [x] Probes: a prop write inside an effect invalidates; reflect echoes to the attribute exactly once
      (no loop) and a JSON round-trip doesn't re-loop; `attributeChangedCallback` crosses string→typed;
      pre-upgrade `.prop=` assignment replays through the accessor (no shadowing).
      *(props-install · props-reflect · element-attrs · element-upgrade; the no-loop lock proven
      end-to-end through the real `attributeChangedCallback`.)*
- [x] Connect→disconnect leaves zero subscribers and zero live listeners (provable via `inspect` +
      an AbortSignal check). *(element-lifecycle: subscriber half + reconnect-zero-residue, the K2 cycle
      G1 deferred; element-helpers: listener half via the connection `AbortSignal`.)*
- [x] ARIA is set only via `internals`, never host attributes (probe asserts no `role`/`aria-*` on host).
      *(element-internals; the AX-tree read-back is a browser-smoke deferral to G5, not faked.)*

**Verdict.** Element rubric (`docs/rubrics/element.md`): D1 5 · D2 5 · D3 5 · D4 4 · D5 5 · D6 4 · D7 4 ·
D8 5. Promotion gate (D1,D3,D4,D5,D6 ≥ 4; D2,D7 ≥ 4; D8 ≥ 3): **PASS** — ratified by orchestration-lead
against per-slice independently-gated evidence (a negative control per slice). Suite: 148 probes green;
import-layering trip-wire green. Size: **2427 B gz** (reactive+dom barrel, 6575 B min; `npm run size`,
within the ≤ ~6 kB budget). Code: `packages/agent-ui/components/src/dom/` (`props.ts`, `element.ts`,
`index.ts`). Resolved at G5: lazy-upgrade precedence = **property-wins** (ADR-0005). Still deferred (the
button doesn't exercise it): **camelCase→kebab** attribute folding — to be resolved at the first
camelCase-prop control. **G2 shippable.**

---

## G3 — Templating + directives

**Goal.** The passive template layer and the opt-in directive seam.

**Scope.** `src/core/dom/template.ts` (`html` / `svg` / `render`, the part classes, the prepare/
WeakMap cache) and `directives.ts` (`repeat`, `watch`, `classMap`, `ref`, `unsafeHTML`).

**Definition of done.**
- [ ] Probes: re-render re-parses nothing (same `strings` ⇒ same prepared instance); per-part
      `Object.is` skips unchanged holes; each part kind commits correctly (`child` text/template/array,
      `attr`, `?bool`, `.prop`, `@event` with stable listener identity); `svg` namespace fragments
      parse and tag-indirection throws; unsupported binding positions throw with a useful message.
- [ ] `repeat` reuses DOM by key, moves by identity, throws on duplicate keys; append/remove/stable
      prefix cost zero DOM moves.
- [ ] `watch` updates its hole without re-running the host render effect, dies on disconnect, and
      respawns on reconnect; directive teardown is isolated (a throwing disposer doesn't abort siblings).
- [ ] One `UIElement` subclass renders via `html\`\`` end-to-end (the integration proof of G1–G3).

---

## G4 — FACE base + control traits

**Goal.** `UIFormElement` and the traits the first control family needs.

**Scope.** `src/core/dom/form.ts` (`formAssociated`, internals-once, `value` prop → `setFormValue`,
`validity()` hook → `setValidity`, `formResetCallback` / `formDisabledCallback`, user-invalid timing).
Traits in `src/core/traits/`: `pressActivation`, `tabbable`, `trackUserInvalid`.

**Definition of done.**
- [ ] Probes (against an internals stub for jsdom + browser-truth smoke for the real thing): a value
      write contributes to `FormData`; `validity()` non-null sets `setValidity` + `aria-invalid` only
      after interaction; `formResetCallback` restores from the attribute; `formDisabledCallback` makes
      disabled reactive.
- [ ] Each trait obeys the contract: attach in `connected()`, idempotent `release()`, listeners/effects
      ride the connection scope, declared `data-*` only, zero residue after disconnect.
- [ ] A minimal throwaway `UIFormElement` subclass round-trips a value through a `<form>` in the browser
      smoke (the integration proof of G4).

---

## G5 — `ui-button` (the reference control)

**Goal.** Take **one** control fully to the quality bar — the template every later control copies.
Includes the **global token wiring** (load `tokens.css` first so dimensional vars resolve).

**Scope.** `controls/button/` (the full folder: `button.ts` + single `button.css` (ADR-0003) +
`button.test.ts` + `button.md` descriptor (ADR-0004)); the dimensional token ramp authored in
`@agent-ui/shared` (the `--ui-{height,font}-{sm,md,lg}` ramp **plus** the `[scale]`/`[density]`
multipliers the geometry smoke asserts); the `components` / `component-styles` / `foundation-styles`
barrels + the host page (tokens loaded first). The G5 governance machinery lands **with** the button
(`process.md` sequencing): the `authoring-components` skill, the **frontmatter contract schema** +
contract↔props trip-wire (ADR-0004), the **COMPOSE/REALIZE component rubric** (`docs/rubrics/`), the
**`component-reviewer`** agent, and the **browser-truth harness** (`@vitest/browser` + Playwright —
a devDep + config add; absent today, jsdom-only).

**Definition of done (the gold bar — G5 is declared done from this).**
- [ ] Behaviour: Space/Enter activation via the `pressActivation` trait; disabled is fully inert; emits
      native-parity `click`; `variant`/`size` props are typed literal unions; renders via `html\`\`` end-to-end
      (this is also the G3 integration proof — the `render()`→engine host commit lands here).
- [ ] Geometry (Control class, per `references/geometry.md` — the slot/slotless law that **supersedes**
      `dimensional-standard.md`'s `2px+…` formula): `block-size: var(--ui-button-height)` off the ramp,
      `padding-block: 0`, slotless inline-pad `= h/2`. **Browser smoke asserts the rendered px *changes***
      across `size=sm→md→lg`, under an ancestor `[scale]`, and under `[density]` (anti-vacuous: assert it
      changed, not just present), in **Chromium AND WebKit**.
- [ ] Styling: behaviour-only `.ts`; single `button.css` with the `@scope (ui-button)` styles block
      consuming only `--ui-button-*` and the `:where(ui-button)` token block from `--c-{family}-{role}`
      roles; survives `forced-colors: active` (the ink doesn't vanish).
- [ ] `button.md` frontmatter validates against the frontmatter contract schema and matches the live
      `finalize(Class)` table (the contract↔props trip-wire); the COMPOSE/REALIZE rubric scores both axes
      ≥ 4 via the `component-reviewer` agent.
- [ ] `tsc` clean, probes green (jsdom), the cross-engine geometry/forced-colors smoke green (Chromium
      **and** WebKit), marginal size within budget. The token sheet is loaded first in the host page.

---

## G6 — `ui-text-field` · `ui-checkbox` · `ui-switch`

**Goal.** Three more controls, reusing the G5 template; exercise contenteditable FACE + the Indicator class.

**Scope.**
- `ui-text-field`: a `contenteditable` surface (no native `<input>`) mirroring value↔surface, with
  caret guard, `input`/`change`, FACE value + `validity()`.
- `ui-checkbox` / `ui-switch`: Indicator class (box rides `--ui-ind-{size}`), `--checked` custom state,
  keyboard activation, `ariaChecked` via internals.

**Definition of done.**
- [ ] Per control: behaviour probes + browser smoke + `.api.json` + rubric ≥ 4 on both axes (the G5 DoD,
      applied to each).
- [ ] `ui-text-field` round-trips through a `<form>` and reports validity; the value is a tracked signal.
- [ ] Indicator geometry responds to `[size]`/`[scale]`/`[density]` in the browser; `--checked` state
      survives `forced-colors`.
- [ ] No native form elements introduced (the zero-native sweep stays clean).

---

## G7 — `ui-listbox` · `ui-select` · `ui-field` (+ form-provider)

**Goal.** Complete the first family: a list selection control, a collapsed select on the overlay
mechanics, the field wrapper, and form-level coordination.

**Scope.**
- `ui-listbox`: `role=listbox`, roving/active-descendant selection via a selection-commit trait.
- `ui-select`: collapsed dropdown composing `ui-listbox` as its popup (introduces minimal overlay
  positioning — `anchor` + a light-dismiss trait; the `(height−glyph)/2` caret law from
  `references/geometry-sizing-spec.md`, asymmetric padding).
- `ui-field`: label/description/error wrapper; `--user-invalid` timing.
- A `form-provider` that discovers `UIFormElement` descendants by `name` and publishes values/errors/valid
  via context (introduces the context/provider primitive).

**Definition of done.**
- [ ] Each control meets the per-control DoD (probes, smoke, `.api.json`, rubric ≥ 4).
- [ ] `ui-select` opens/closes in the top layer, dismisses on outside click, keyboard-navigates the
      listbox, and shows the caret per the geometry law (browser smoke; verify in WebKit too — overlays
      that depend solely on their own stylesheet have a catastrophic failure mode, so the hidden-by-default
      baseline must be stylesheet-independent).
- [ ] `form-provider` aggregates a multi-control form's values/errors reactively; a late-added field is
      discovered (MutationObserver); submit/reset work.
- [ ] **The first component family is shippable**: an end-to-end form (button + text-field + checkbox +
      switch + select inside a field, under a form-provider) round-trips in the browser, keyboard-only.

---

## G8 — Gallery demo + release-readiness pass

**Goal.** A filterable gallery of the family and a coherence audit before calling the foundation done.

**Scope.** A `<component-gallery>` built *with* the foundation (a `filter` signal, `repeat`-reconciled
grid, `watch` readouts) — dogfooding the kernel. A read-only coherence audit across API/token/lifecycle
symmetry.

**Definition of done.**
- [ ] The gallery renders every control, themed through one provider (scale/density/tone), and survives
      `forced-colors`.
- [ ] Coherence audit clean (no API/token/lifecycle drift across the family); budgets held; tree-shake
      proof passes (importing one control drags only it + real deps).
- [ ] `plan.md` open decisions (§12) are all resolved or explicitly deferred with a reason.
- [ ] A short `CHANGELOG`/status note records the foundation milestone; next tier (layout/display
      primitives, or the agent-app surfaces) is a scope-dial decision left to you.
```
