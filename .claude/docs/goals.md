# agent-ui — goals

> Companion to [`plan.md`](./plan.md). Milestones are sequential: each `Gn` depends on the prior.
> A milestone is **done** only when every box in its Definition of Done is checked.
> First component family = FACE form controls (button → text-field/checkbox/switch → listbox/select/field).
> The form-control family landed as the **Control Suite** track (Waves 0–5, at the foot of this file) — the full
> Indicator/Range/Input/Overlay families + `ui-calendar` + the 12-type input field — and the **G7-completion
> wave** (2026-07-01, ADR-0050/0051/0052) closed `ui-field` + `ui-form-provider` + the keyboard-only end-to-end
> proof. **State (2026-07-05): G0–G9 + the Control Suite + the icon adapter (`@agent-ui/icons` + `ui-icon`,
> ADR-0065/0066) + G8 ALL DONE — the components foundation is COMPLETE** (see the G8 verdict + root
> `CHANGELOG.md`). The next-tier scope dial was chosen shortly after — see below.
> The next tier was subsequently chosen and shipped (as of 2026-07-09): the **G9 container/layout family**
> (below) landed first, then **`@agent-ui/app`** (the agent-app-shell, ADR-0082–0084), **`@agent-ui/a2a`**
> (the A2A/Agent2Agent protocol layer + the tic-tac-toe arena + concepts corpus), the
> **report/content/feed/chart** component families (ADR-0107/0111–0114 — `ui-table`/`ui-stat`/`ui-badge`,
> `ui-code`/`ui-disclosure`/`ui-text-hyperlink`, `ui-progress`/`ui-avatar`/`ui-attachment`/`ui-toast`(-region),
> `ui-sparkline`/`ui-bar-chart`), and **`@agent-ui/router`** (ADR-0115). Each has its own PRD/SPEC/LLD under
> `.claude/docs/{prd,spec,lld}/` (or `specs/` for A2UI) — this file's scope stays the FACE control
> foundation (G0–G9) + Control Suite + icon adapter. The one still-deferred item is the multi-theme
> `theme` package-swapping system (the seam is wired; one `default` package ships).
> Layout: npm-workspaces monorepo — `src/core/*` in milestone text now lives under `packages/agent-ui/components/src/*`.
> Consumed by the A2UI effort (`@agent-ui/a2ui`; docs on the unified `.claude/docs/{spec,lld,prd}/` map), which tracks these milestones (its
> Assumption A-2 ≈ G7) and is coordinated by the planning/execution team (`.claude/agents/`).

## Standing definition of done (applies to every milestone)

- [ ] `npm run check` (tsc) and `npm test` (Vitest) are green. (`vite build` is LIVE — the docs site is the
      app entry since the ADR-0077 wave; the G8 gallery joined it. plan §12 "App build/dev entry".)
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

**Verdict.** Kernel rubric (`.claude/docs/rubrics/kernel.md`) self-score: K1 5 · K2 4 · K3 4 · K4 5 · K5 5 · K6 5 ·
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

**Verdict.** Element rubric (`.claude/docs/rubrics/element.md`): D1 5 · D2 5 · D3 5 · D4 4 · D5 5 · D6 4 · D7 4 ·
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
- [x] Probes: re-render re-parses nothing (same `strings` ⇒ same prepared instance); per-part
      `Object.is` skips unchanged holes; each part kind commits correctly (`child` text/template/array,
      `attr`, `?bool`, `.prop`, `@event` with stable listener identity); `svg` namespace fragments
      parse and tag-indirection throws; unsupported binding positions throw with a useful message.
- [x] `repeat` reuses DOM by key, moves by identity, throws on duplicate keys; append/remove/stable
      prefix cost zero DOM moves.
- [x] `watch` updates its hole without re-running the host render effect, dies on disconnect, and
      respawns on reconnect; directive teardown is isolated (a throwing disposer doesn't abort siblings).
- [x] One `UIElement` subclass renders via `html\`\`` end-to-end (the integration proof of G1–G3).

**Verdict.** **G3 DONE** (built after G5's vertical slice, as the A2UI renderer's needs pulled the directive
seam in). Evidence (verified green 2026-07-01): `dom/template.ts` + `dom/repeat.ts` + `dom/watch.ts` +
`template-{core,parts,positions,directives}.test.ts` · `repeat.test.ts` + `repeat.browser.test.ts` ·
`watch.test.ts` · the html-render integration proof `element-render.test.ts`. **ADR-0022** (`repeat`'s
`ChildPart.moveBefore` atomic-reorder focus seam) · **ADR-0023** (public `mount()` directive-host seam +
the directive-authoring trio; `render`/`html` stay private). *(`classMap`/`ref`/`unsafeHTML` are covered by
the directive seam; `mount` is the public entry the A2UI renderer consumes.)*

---

## G4 — FACE base + control traits

**Goal.** `UIFormElement` and the traits the first control family needs.

**Scope.** `src/core/dom/form.ts` (`formAssociated`, internals-once, `value` prop → `setFormValue`,
`validity()` hook → `setValidity`, `formResetCallback` / `formDisabledCallback`, user-invalid timing).
Traits in `src/core/traits/`: `pressActivation`, `tabbable`, `trackUserInvalid`.

**Definition of done.**
- [x] Probes (against an internals stub for jsdom + browser-truth smoke for the real thing): a value
      write contributes to `FormData`; `validity()` non-null sets `setValidity` + `aria-invalid` only
      after interaction; `formResetCallback` restores from the attribute; `formDisabledCallback` makes
      disabled reactive.
- [x] Each trait obeys the contract: attach in `connected()`, idempotent `release()`, listeners/effects
      ride the connection scope, declared `data-*` only, zero residue after disconnect.
- [x] A minimal throwaway `UIFormElement` subclass round-trips a value through a `<form>` in the browser
      smoke (the integration proof of G4).

**Verdict.** **G4 DONE.** Evidence (verified green 2026-07-01): `dom/form.ts` (`UIFormElement`, FACE
value/validity via `ElementInternals`) + `form.test.ts` + the cross-engine `form.browser.test.ts` (the G4
round-trip proof — a required-empty field BLOCKS submit in **both engines**, screenshot-locked) · the traits
`press-activation.ts` / `tabbable.ts` / `track-user-invalid.ts` each with its `*.test.ts` (contract +
zero-residue). **ADR-0013** (`UIFormElement` FACE base) · **ADR-0010** (`tabbable` + `internals.ariaDisabled`
— closes the G5 deferred AX items). Consumed by every form control (text-field, the Indicator/Range/Overlay
families, ui-calendar).

---

## G5 — `ui-button` (the reference control)

**Goal.** Take **one** control fully to the quality bar — the template every later control copies.
Includes the **global token wiring** (load `tokens.css` first so dimensional vars resolve).

**Scope.** `controls/button/` (the full folder: `button.ts` + single `button.css` (ADR-0003) +
`button.test.ts` + `button.md` descriptor (ADR-0004)) — with an **optional leading icon slot** (ADR-0006)
so the reference control exercises the full slot/gap/density law; the dimensional token ramp authored in
`@agent-ui/shared` (the `--ui-{height,font}-{sm,md,lg}` ramp **plus** the `[scale]`/`[density]`
multipliers the geometry smoke asserts); the `components` / `component-styles` / `foundation-styles`
barrels + the host page (tokens loaded first). The G5 governance machinery lands **with** the button
(`process.md` sequencing): the `component-author` skill, the **frontmatter contract schema** +
contract↔props trip-wire (ADR-0004), the **COMPOSE/REALIZE component rubric** (`.claude/docs/rubrics/`), the
**`component-reviewer`** agent, and the **browser-truth harness** (`@vitest/browser` + Playwright —
a devDep + config add; absent today, jsdom-only).

**Definition of done (the gold bar — G5 is declared done from this).**
- [x] Behaviour: Space/Enter activation via the `pressActivation` trait; disabled is fully inert; emits
      native-parity `click`; `variant`/`size` props are typed literal unions; renders via `html\`\`` end-to-end
      (this is also the G3 integration proof — the `render()`→engine host commit lands here).
- [x] Anatomy + geometry (Control class, per `references/geometry.md` — the slot/slotless law that
      **supersedes** `dimensional-standard.md`'s `2px+…` formula; anatomy per **ADR-0006**): the button carries
      an **optional leading icon slot** (presence-driven `:has()` grid). `block-size: var(--ui-button-height)`
      off the ramp, `padding-block: 0`; **slotless** (bare-label) inline-pad `= h/2`; **slot** (icon) edge-pad
      `= ½(h−icon)` with `column-gap: var(--ui-gap-{size})` between icon and label. **Browser smoke (Chromium
      AND WebKit), anti-vacuous both ways:**
   - `[size]` sm→md→lg **and** `[scale]` (ui-sm→content-lg, via `--ui-scale`) **change** the rendered px
     (frame height + font) — on **both** the bare and icon variants.
   - `[density]` (compact→spacious) **changes the icon↔label gap** (`--ui-gap`, the *one* density-bearing
     quantity) on the **icon+label** variant, **and does NOT change the bare-label FRAME** (height + the `h/2`
     pads) — the law's frame-invariance, asserted on the bare variant. (A slotless button is correctly
     density-invariant; `[density]` is proven on the gap, not the frame.)
- [x] Styling: behaviour-only `.ts`; single `button.css` with the `@scope (ui-button)` styles block
      consuming only `--ui-button-*` and the `:where(ui-button)` token block from `--md-sys-color-{family}-{role}`
      roles; survives `forced-colors: active` (the ink doesn't vanish).
- [x] `button.md` frontmatter validates against the frontmatter contract schema and matches the live
      `finalize(Class)` table (the contract↔props trip-wire); the COMPOSE/REALIZE rubric scores both axes
      ≥ 4 via the `component-reviewer` agent.
- [x] `tsc` clean, probes green (jsdom), the cross-engine geometry/forced-colors smoke green (Chromium
      **and** WebKit), marginal size within budget. The token sheet is loaded first in the host page.

**Verdict.** Component rubric (`.claude/docs/rubrics/component.md`), scored by the **`component-reviewer`** (s16 —
the separate critic): **COMPOSE 5/5** (C1–C5 all 5) · **REALIZE 4/5** (C6–C9 = 5; C10 = 4). Promotion gate
(both axes ≥ 4; no `[gate]` dimension < 4; zero blockers): **PASS — G5-DONE, `ui-button` shippable as the
reference control.** Evidence: **245 jsdom probes** green; the **cross-engine geometry/forced-colors smoke
12/12 in Chromium AND WebKit** (`npm run test:browser`); the contract↔props trip-wire (`button.md` ≡
`finalize`) green; tree-shake/file-set/barrels green. Size: **4334 B gz** (the self-defining `ui-*` family /
button entry, within the ≤ 8 kB budget). Each slice was independently negative-control-verified by
orchestration-lead. *(The `html\`\`` render path + the G3 integration proof are met by s1 —
`element-render.test.ts` via a `UIElement` subclass; the button itself is **host-as-grid** (`render()` void,
ADR-0006), styling the host + placing the user's light-DOM icon/label, so it needs no `html\`\`` template.)*
Code: `controls/button/`, `traits/press-activation.ts`, `descriptor/component-descriptor.ts`, shared
`dimensions.css`. ADRs: 0003 (packaging) · 0004 (descriptor) · 0005 (property-wins) · 0006 (icon-slot
anatomy) · 0007 (subtree ramp). **Tracked, non-blocking — the G4 focus/accessibility pass:**
`internals.ariaDisabled` is not wired (a disabled button doesn't announce *disabled* to assistive tech) and
`tabIndex` is absent (not Tab-reachable — the `tabbable` trait is G4 scope). Both close when G4 / the first
focus trait lands. **G5 done.**

---

## G6 — `ui-text-field` · `ui-checkbox` · `ui-switch`

**Goal.** Three more controls, reusing the G5 template; exercise contenteditable FACE + the Indicator class.

**Scope.**
- `ui-text-field`: a `contenteditable` surface (no native `<input>`) mirroring value↔surface, with
  caret guard, `input`/`change`, FACE value + `validity()`.
- `ui-checkbox` / `ui-switch`: Indicator class (box rides the widget ramp `--ui-compact-{size}`, ADR-0041 —
  *not* `--ui-ind`, which never shipped), `--checked` custom state, keyboard activation, `ariaChecked` via internals.

**Definition of done.**
- [x] Per control: behaviour probes + browser smoke + the `{name}.md` descriptor (**ADR-0004 replaced
      `.api.json`** with `.md` frontmatter) + rubric ≥ 4 on both axes (the G5 DoD, applied to each). *(All
      three ship a `.md` + jsdom + cross-engine browser tests; the `component-reviewer` gated each ≥4 both
      axes before commit — `ui-checkbox` was taken to the gold bar as the family template.)*
- [x] `ui-text-field` round-trips through a `<form>` and reports validity; the value is a tracked signal.
- [x] Indicator geometry responds to `[size]`/`[scale]`/`[density]` in the browser; `--checked` state
      survives `forced-colors`.
- [x] No native form elements introduced (the zero-native sweep stays clean — `file-set.test.ts`).

**Verdict.** **G6 DONE.** Evidence (verified green 2026-07-01): `controls/text-field/` (contenteditable FACE
surface, caret guard, `input`/`change`, `.md` descriptor + trip-wire + geometry/states browser smokes) ·
`controls/checkbox/` + `controls/switch/` (Indicator class on the `--ui-compact-*` widget ramp + 2px inset,
`--checked` state, keyboard activation). Built as **Control-Suite Wave 1** (Indicator family) — see the
**Control Suite** track below; the shared `UIIndicatorElement` base is **ADR-0042**, the widget geometry
**ADR-0041**. `ui-text-field` subsequently grew a 12-value `type` family (Waves 3/5 — ADR-0044/0047/0048),
recorded in the Control Suite track. **ADR-0013/0014** (FACE base + contenteditable surface).

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

**Definition of done.** **G7 = DONE** (2026-07-01 — the G7-completion wave; s14 promotion review PROMOTE):
- [x] Each control meets the per-control DoD (probes, smoke, `{name}.md` descriptor [ADR-0004, was
      `.api.json`], rubric ≥ 4). — **`ui-select` DONE** (Control-Suite Wave 4, both-engine smoke, reviewer
      ≥4). **`ui-listbox` shipped as a BASE, not a standalone tag:** `controls/_base/listbox-element.ts`
      (`UIListboxElement` — roving + selection over `[role=option]`, consumed by `ui-select`; ADR-0042/0043).
      **`ui-field` DONE** (the G7-completion wave: `controls/field/` — label/description/error wrapper on the
      ADR-0051 labelling seam, gen-3 REACTIVE error rendering over the seam's closures, user-invalid timing
      honored from the control's own tracker; s14 reviewer COMPOSE 5/5·5/5/5 [C3 re-scored 5 after the
      descriptor repair], REALIZE ≥4 across).
- [x] `ui-select` opens/closes in the top layer, dismisses on outside click, keyboard-navigates the
      listbox, and shows the caret per the geometry law (browser smoke; verify in WebKit too — overlays
      that depend solely on their own stylesheet have a catastrophic failure mode, so the hidden-by-default
      baseline must be stylesheet-independent). — **DONE** (`select.browser.test.ts`, Chromium **and**
      WebKit; open→navigate→commit→close + Escape/outside-click light-dismiss, screenshot-locked; ADR-0045).
      *(The G7-completion wave also fixed the Wave-4 latent `[data-box]`-defeats-popover-hidden bug — a
      closed select's panel now truly computes `display:none`; Tab cannot land in a closed listbox.)*
- [x] `form-provider` aggregates a multi-control form's values/errors reactively; a late-added field is
      discovered; submit/reset work. — **DONE** (`controls/form-provider/` on the ADR-0050 connect-time
      registration protocol — discovery is registration-on-connect + the upgrade catch-up, which SUBSUMES the
      MutationObserver requirement by construction; aggregation = computeds over member signals; submit =
      typed-detail `change` with first-invalid `reportValidity()`; reset partitions by owning `<form>`;
      s14 reviewer PROMOTE, both axes ≥4).
- [x] **The first component family is shippable**: an end-to-end form (button + text-field + checkbox +
      switch + select inside a field, under a form-provider) round-trips in the browser, keyboard-only. —
      **PROVEN** (`form-e2e.browser.test.ts`, Chromium AND WebKit: Tab reaches every control, each operates
      by its keyboard contract, the error law fires on a single real blur and clears on fix, the aggregate
      matches, submit blocks-then-emits, reset restores — zero workarounds; two documented WebKit
      INSTRUMENT bridges for a Playwright `userEvent.tab()`-near-`[popover]` tool gap, behavior proven by
      Chromium real-Tab + WebKit structural probes).

**Status.** **G7 COMPLETE.** The overlay/selection ambition was delivered by Control-Suite Waves 0/4
(`ui-select` + the whole Overlay family on `overlay` + `roving-focus` + `selection-commit`, ADR-0043/0045);
the G7-completion wave (2026-07-01, ADR-0050/0051/0052) closed the final two items — `ui-field` + `ui-form-provider`
— plus TEN pre-commit findings (three latent from prior waves: the Wave-4 `[data-box]`/popover display defeat,
the Wave-1 Indicator no-`formReset`, the G5-era pressActivation Enter default-action leak). The first
component family is shippable, keyboard-proven end-to-end in both engines.

---

## G8 — Gallery demo + release-readiness pass

**Goal.** A filterable gallery of the family and a coherence audit before calling the foundation done.

**Scope.** A `<component-gallery>` built *with* the foundation (a `filter` signal, `repeat`-reconciled
grid, `watch` readouts) — dogfooding the kernel. A read-only coherence audit across API/token/lifecycle
symmetry.

**Definition of done.** **G8 = DONE** (2026-07-05 — all amendments ratified; T3 reviewer GO, T7 audit CLEAN):
- [x] The gallery renders every control, themed through one provider (scheme/scale/density; `theme` a reserved seam, one `default` package), and survives
      `forced-colors`. — **DONE** (ADR-0079: `<component-gallery>` composing `<component-preview mode="component">` per
      descriptor-derived member + ONE `<theme-provider>`; browser-proven whole-shape per member incl. opened
      overlays; the Chromium forced-colors leg green; the preview hardened for fleet-wide construction —
      ADR-0077 Amendment 1's SLOT_TEXT partition + sample children + demo seeds).
- [x] Coherence audit clean (no API/token/lifecycle drift across the family); budgets held; tree-shake
      proof passes (importing one control drags only it + real deps). — **DONE** (ADR-0081: the standing
      `family-coherence.test.ts` gate green — 3 groups / 9 invariants incl. the Am1 inverse-`[size]` rule and
      the Am2 pure-activation `click` carve-out — PLUS the judged read-only audit at zero MAJOR; the one MAJOR
      found — select's missing size axis — closed: `ui-select` joined the sized entry family, descriptor+CSS
      the contract, no new ADR. Budgets + tree-shake evidenced through the public entries.)
- [x] Per-control `exports` are exposed + the `size` gate measures the per-control MARGINAL (the eventual
      DISTRIBUTED footprint, ≤~2 KB/control), not only the all-controls family-barrel worst case (ADR-0049
      Amendment 1; measured 2026-07-05 — a real consumer ships ~5–14 KB; the 22.6 KB family total is worst-case).
      — **DONE** (ADR-0080: `./controls/{name}` entries + the three-way drift gate + the leave-one-out marginal
      leg in `npm run size`; all marginals within budget — one cited override, text-field 4021/4352 B gz, the
      12-type family).
- [x] `plan.md` open decisions (§12) are all resolved or explicitly deferred with a reason. — **DONE**
      (plan §12 dispositioned 2026-07-05; the one deferral = library emit, Kim-confirmed F2a — exports
      emit-ready on TS source, the `dist/`+`.d.ts` flip lands at first publish).
- [x] A short `CHANGELOG`/status note records the foundation milestone; next tier (layout/display
      primitives, or the agent-app surfaces) is a scope-dial decision left to you. — **DONE** (root
      `CHANGELOG.md`, 2026-07-05; the NEXT-tier dial — layout/display primitives vs agent-app surfaces, plus
      the deferred multi-theme `theme` package system — is FLAGGED as Kim's, deliberately unchosen).

**Verdict.** **G8 DONE — the components foundation is COMPLETE.** Final gates (2026-07-05): `npm run check`
(tsc + check:site) green · jsdom **2684** (0 expected-fail markers) · browser **806** (Chromium AND WebKit) ·
`npm run size` foundation **6542/7168 B gz**, family **22935/23552 B gz**, per-control marginals within
budget. ADRs **0079/0080/0081** accepted + amendments **0077 Am1 · 0081 Am1/Am2** ratified (ADR-0049 Am1's
G8 booking realized). Open follow-ups (recorded, not this milestone): combo-box `size` axis (the second
picker's sized-entry completion) · `formUserInvalid` per-control error legs (the G7 follow-up) ·
button-motion browser-test flake hardening · the multi-theme package-swapping system (seam wired, next-tier).

---

## G9 — Container / layout family (A2UI's layout primitives land)

**Goal.** Ship A2UI's reserved layout primitives as `ui-*` **containers** — the first non-form component family.
A2UI-catalog-first: the catalog's reserved `Row` / `Column` / `Card` / `Tabs` / `Modal` (a2ui-catalog SPEC §5.2,
currently `experimental`) flip to **shipped**, bound **directly** (SPEC-R8, no adapter) to new `ui-*` controls with
the `ChildList` child model, plus two non-catalog layout primitives (`ui-list`, `ui-grid`) the family needs. These
are **structural** controls: they extend `UIElement` via a shared `UIContainerElement` surface base — **not**
form-associated (no `ElementInternals` value/validity; Tabs/Modal still use `internals` for ARIA + custom states).
Pulls renderer **LLD-C8 (two-way input binding)** into scope.

**Scope.** ~12 elements across 7 folders, an all-at-once file-disjoint parallel fan-out:
- `controls/row/` `ui-row` · `controls/column/` `ui-column` — A2UI-faithful flex (ADR-0016).
- `controls/list/` `ui-list` · `controls/grid/` `ui-grid` — the two layout extensions (ADR-0016).
- `controls/card/` `ui-card` + `ui-card-header` / `-content` / `-footer` — the surface/region/nested-radius family
  (ADR-0015 surface, ADR-0018 one-level radius).
- `controls/tabs/` `ui-tabs` + `ui-tab` / `ui-tab-panel` — full a11y (roving tabindex + tablist/tab/tabpanel ARIA +
  bindable `selected`).
- `controls/modal/` `ui-modal` — native `<dialog>` `showModal()`, focus trap/restore + Escape + dialog ARIA +
  bindable `open` (ADR-0017).
- A serial PREP: the shared tokens (`--ui-space` density-responsive ladder + the surface elevation/brightness
  composition + `--ui-radius-base`, tokens-specialist; ADR-0015) and the `UIContainerElement` surface base +
  spreadable `surfaceProps`/`flexProps` + the shared `container.css`.
- A2UI: renderer **LLD-C8** (`a2ui/src/renderer/input.ts`, two-way) + the catalog entries (Row/Column/Card/Tabs/
  Modal → `ui-*` factories; `value:{prop,event}` for Tabs `selected` / Modal `open`; the back-filled text-field
  value bind) + the SPEC §5.2 flip. ADRs **0015–0019**.

**Definition of done.**

*Per element (the G5/G6 control bar, applied to each of the ~12 elements):*
- [x] Behaviour probes (jsdom) + the cross-engine browser smoke (Chromium AND WebKit) + the `{name}.md` descriptor
      validating against the frontmatter schema with the contract↔props trip-wire green + the COMPOSE/REALIZE
      rubric ≥ 4 on both axes via the `component-reviewer`.
- [x] `tsc` clean; single `{name}.css` (ADR-0003) — `:where()` token block + `@scope` styles consuming only
      `--ui-{name}-*`; survives `forced-colors: active`; the import-layering trip-wire stays green
      (containers extend `UIContainerElement`/`UIElement`, imports point inward only).

*Surface + spacing (ADR-0015):*
- [x] `elevation` / `brightness` are signed reflected literal-union props (`-3..3`, default `0`, `0`=neutral base);
      a `@ts-expect-error` proves a bare number is rejected. The container reads one role-pure `--ui-container-bg`
      seam; both axes set composes to a defined surface (the proposed base-plane + tonal-overlay mechanism); the
      surface survives `forced-colors`. `--ui-space` is density-responsive (a subtree `[density]` re-multiplies it);
      `--ui-radius-base` seeds the card radius chain. *(Exact ladder values, any shadow ramp, and the 7×7 AA
      surface are tokens-specialist's, gated separately.)*

*Layout (ADR-0016):*
- [x] Row/Column/List/Grid consume the shared `flexProps` (`align`/`justify`/`gap`/`wrap`, reflected literal
      unions → CSS flex props, gap off `--ui-space`); `ui-list` carries `role=list`; `ui-grid` reflows by
      `auto-fit`/`minmax`. **Container-query intrinsic responsiveness**: a layout primitive reflows on its OWN
      container width (no breakpoint props) — the browser smoke resizes the wrapper, not the viewport.

*Card (ADR-0015/0018):*
- [x] Presence-driven region grid (`:has()` — header?/content/footer?); header/footer reuse the leading/label/
      trailing anatomy (`anatomy.md`); `ui-card-content` supports `scroll`/`scroll-fade`; one-level nested radius
      via the published `--ui-card-child-radius` (geometry probe asserts `child == max(0, parent − padding)`; depth
      ≥ 2 documented manual; the JS controller is rejected).

*Tabs / Modal a11y (full widget contract):*
- [x] Tabs: roving-tabindex arrow-key nav, `tablist`/`tab`/`tabpanel` ARIA (via `internals`), bindable `selected`,
      panel show/hide by selection, click/keyboard commit emits `select`. Modal: native `<dialog>` `showModal()`
      (top-layer + `::backdrop`), focus **trap** (platform) + **restore** (control), Escape + backdrop dismissal
      sync `open` and emit `close`/`toggle`, dialog ARIA on the part, host carries no role/aria attribute, bindable
      `open` (ADR-0017).

*A2UI integration (catalog-first; SPEC-R3/R4/R8 + LLD-C8):*
- [x] The default catalog declares Row/Column/Card/Tabs/Modal (+ the region/item sub-types CardHeader/CardContent/
      CardFooter, Tab/TabPanel) bound directly to `ui-*` factories (no adapter, SPEC-R8); the `ChildList` child
      model composes regions as sub-elements; SPEC §5.2 flips those types `experimental → shipped` (Image/Video
      stay absent; List/Grid ship as non-catalog `ui-*` primitives). **LLD-C8 (`input.ts`) is built** — one generic
      two-way input controller wires Tabs `selected` / Modal `open` (each declaring `value:{prop,event}`) and
      back-fills the deferred `ui-text-field` value bind, with 0 per-component renderer code.

*Packaging:*
- [x] One serial integration slice wires the barrels (`controls/index.ts` `export *` per element · `component-
      styles.css` `@import` per `{name}.css` after the shared `container.css` · `dom/index.ts` for
      `UIContainerElement`/`surfaceProps`/`flexProps`); the catalog wiring (a2ui package) is its own single-writer
      slice; `npm run check && npm test && npm run size` green; tree-shake clean (importing one container drags only
      it + the base + real deps).

**Verdict.** **G9 DONE.** The container/layout family shipped (12 elements across 7 folders: `ui-row`/`-column`/
`-list`/`-grid`/`-card`(+header/content/footer)/`-tabs`(+tab/tab-panel)/`-modal`) + the A2UI catalog flip +
`renderer/input.ts` (LLD-C8 two-way binding), browser-proven cross-engine. **ADRs 0015–0021** (surface ·
layout · two-way bind · nested-radius · native-`<dialog>` modal · modal `persistent` · text-field radius/min-
inline-size) + **#102 G9 consistency sweep** (ADR-0039 box-alignment dialect · ADR-0040 foundation-barrel
budget). The container box-model (ADR-0046) later re-based card/modal spacing (see the Control Suite track).

---

## Control Suite — the full FACE control family (Waves 0–5)

> **A milestone TRACK, not a strict `Gn`** (Kim's "maximally use agent teams" directive). It **realizes and
> extends** the G6/G7 control ambitions into a complete control family, built as file-disjoint parallel **waves**
> rather than the sequential march. All work on branch `feat/control-suite-waves-3-4` (**9 commits, NOT pushed**
> as of 2026-07-01). The load-bearing discipline held every wave: **`component-reviewer` ≥4 both axes + the
> cross-engine browser gate run BEFORE each wave-commit** (jsdom-green ≠ done — the browser gate caught 18
> cross-engine bugs in Wave 4 alone; `ui-checkbox` is the gold template).

**Scope delivered.**
- **Wave 0 — foundation.** The **widget-box geometry** sub-system (Kim's 8-value ramp `--ui-compact-*` +
  `--ui-widget-inset: 2px`, **ADR-0041**); the shared `controls/_base/` control-base layer + `UIIndicatorElement`
  / `UIRangeElement` / `UIListboxElement` (**ADR-0042**); the composable traits `overlay` / `roving-focus` /
  `selection-commit` / `value-drag` / `value-codec` (**ADR-0043**); `ui-tabs` migrated onto shared `roving-focus`.
- **Wave 1 — Indicator family.** `ui-checkbox` (gold) · `ui-switch` · `ui-radio` + `ui-radio-group` (the widget
  ramp + 2px inset, `--checked` state, keyboard activation) — these ARE the G6 checkbox/switch DoD.
- **Wave 2 — Range family.** `ui-slider` · `ui-slider-multi` (`value-drag` ARIA-slider + keyboard step; the
  whole-shape floor lesson — a control needing width takes a `min-inline-size` floor).
- **Wave 3 — Input variants.** `ui-text-field` grows a reflected `type` prop + a static type-resolver +
  `value-codec` (**ADR-0044** contenteditable password masking).
- **Wave 4 — Overlay family.** `ui-popover` · `ui-tooltip` · `ui-menu` · `ui-select` · `ui-combo-box` on the
  shared `overlay` controller (Popover API top-layer + JS flip/shift + light-dismiss). **ADR-0045** dismissal
  semantics (platform owns Escape/outside-click · anchor focus-restore · `:popover-open`-resilient close ·
  `selectionCommit` Enter `preventDefault` · 0.25rem anchor↔panel gap). *This is the G7 `ui-select` DoD — and
  overshoots it with the full family.*
- **Container box-model — ADR-0046.** The shared `_surface/container-box.css` (`[data-box]` margin inset ·
  sticky header/content/footer · region padding inline 12/block 4/gap 8) rolled onto the overlay panels +
  `ui-card` + `ui-modal`. **Revised 2026-07-04 (ADR-0046 Amendment 2):** regions (header/content/footer) are
  now INSET, not full-bleed — inset margin 4→6px, region block padding 4→6px (inline stays 12); `ui-card`'s
  6px-inline override is rescinded (card now matches the shared model exactly, across all five families).
- **Wave 5 — Input codecs + date/time pickers.** **ADR-0047** numeric-codec expansion (multi-currency ISO-4217
  · NEW `unit`/`percent` types · generalized `step`/`min`/`max` steppers + range validity · percent canonical =
  the typed number). **ADR-0048** NEW **`ui-calendar`** (`UIFormElement`, bespoke 2D grid, ISO `YYYY-MM-DD`
  value, `[data-box]` panel) + `ui-text-field` `type=date`/`time` (date/time codecs; `type=date` lazily
  `import()`s the calendar into the Wave-4 overlay — the tree-shake proof holds; `datetime-local`/`month` are
  documented STRETCH follow-ups). The fleet's first AA text-on-accent role `--md-sys-color-primary-selected`; **ADR-0049**
  family-barrel budget 16 → 22 kB. → the **12-type input family**: `text · email · url · tel · password ·
  search · number · currency · unit · percent · date · time`.

**Definition of done.**
- [x] Every control meets the G5/G6 control bar (jsdom probes + cross-engine browser smoke + `{name}.md`
      descriptor + contract↔props trip-wire + `component-reviewer` ≥4 both axes) **before** its wave-commit.
- [x] `npm run check` (incl. `check:site`) + `npm test` **green** — re-verified 2026-07-01: **1936 jsdom tests,
      118 files, 0 failures**; `tsc` + `tsc -p site` clean.
- [x] The cross-engine browser gate (Chromium **and** WebKit) green — **514 browser tests** (host-run;
      screenshot-locked, incl. the `type=date` calendar-overlay top-layer + focus-restore smokes).
- [x] `npm run size` within budget — **19 889 B gz of the 22 528 B (22 kB) family budget** (ADR-0049); the
      per-control marginals + shrink-only ratchet hold; tree-shake proof green (`type=date` does NOT drag the
      calendar into a plain field).
- [x] ADRs **0041–0049** authored + ratified (`accepted`); the geometry-sizing-spec §5.2 widget ramp realized.

**Open follow-ups** (recorded, not this track): ~~the two G7 items~~ **`ui-field` + `form-provider` CLOSED**
by the G7-completion wave (2026-07-01, ADR-0050/0051 — §G7 above); its own recorded follow-ups: the LLD-C9
NAME/ERROR-axis forwarding wires for select/combo-box + the calendar labelling merge, the reserved
`ui-form-reset` (activates on the first external consumer), the 3 pre-convention Wave-0 LLD trace notes.
Still open: `datetime-local`/`month`/time-list/date-range (Wave-5 STRETCH/future; `--ui-calendar-range-*`
reserved); the A2UI **LLD-C6 dynamic-list** tail (#137) + the `repeat` moveBefore focus-seam (#69). The
branch is **unpushed**.

## Icon adapter — the swappable icon-pack architecture (2026-07-04, ADR-0065/0066, accepted)

**Goal.** Replace ad-hoc, hand-drawn icon/caret glyphs with a single, swappable icon-sourcing
architecture — Phosphor as the concrete default pack, behind a uniform adapter interface so other packs
could be swapped in later without touching consuming components.

**Shipped.** A new zero-dependency leaf package `@agent-ui/icons` (sibling of `@agent-ui/shared`,
mirrors the corpus-store's pure-core + subpath shape): `types.ts` (the curated `IconName` union +
`IconPack`), `registry.ts` (`IconRegistry`/`Registry`/`iconRegistry`, `body(name)` override-then-active-
pack precedence, `overrideIcon` survives `setActivePack`), `resolve.ts` (`resolveIcon`/`setIcon`,
non-throwing unknown-name fallback), the root barrel (zero Phosphor bytes reachable), and
`phosphor/{icons.gen.ts,index.ts}` — a curated 9-icon `regular`-weight subset vendored at BUILD TIME via
`scripts/vendor-phosphor.mjs` from a devDependency-only `@phosphor-icons/core`, self-registering behind
the `"./phosphor"` subpath only. A new declarative `ui-icon` control (`controls/icon/`) consumes it,
slotting into the *existing* `[data-role=icon]`/`[data-role=caret]` cell geometry with **zero edits to
any existing control's CSS** (verified by git diff) — the same SVG asset naturally serves an icon-sized
cell and insets to font-rhythm in a caret cell via the pre-existing padding law.

**Definition of done.**
- [x] Design intake (system-planner) → independent doc-review (3 must-fix + 4 polish, incl. a real
      contradiction between the frozen registry interface and the `ui-icon` prose — resolved by
      deferring pack-swap reactivity rather than inverting the `icons ↛ components` dependency arrow) →
      revision → build (3 seats, prep → parallel core/Phosphor chains → integration → verify).
- [x] One real bug caught mid-build: the LLD's own frozen `aria-hidden` snippet never cleared the
      attribute in the meaningful branch (a labelled icon that was ever decorative would stay hidden
      from assistive tech forever); fixed via `ElementInternals` both directions, LLD corrected to match.
- [x] `npm run check` + `npm test` green — **143 files, 2311 tests**; `npm run test:browser` green —
      **64 files, 564 tests**, Chromium + WebKit both.
- [x] `npm run size` within budget — **22 193 B gz of the 22 528 B family budget** (335 B headroom).
- [x] Independent `component-reviewer` pass: GO, zero blocker/major (4 minor/note items, 2 folded into
      the same wave as hardening — synthetic-violation assertions added to both architectural negative
      controls so they're proven to bite, not just proven-by-construction).
- [x] ADRs **0065–0066** authored + ratified (`accepted`).

**Migration audit** (grounded against the tree; the 8 real touchpoints — all confirmed UNTOUCHED by this
wave, migration is deliberately a separate later effort, one control per slice):

| # | Site | Current | Canonical icon |
|---|---|---|---|
| 1 | `controls/select/select.ts:282` | `'▾'` | `caret-down` |
| 2 | `controls/calendar/calendar.ts:318` | `'‹'` | `caret-left` |
| 3 | `controls/calendar/calendar.ts:332` | `'›'` | `caret-right` |
| 4 | `controls/text-field/text-field.ts:725` | `'✕'` | `x` |
| 5 | `controls/text-field/text-field.ts:742` | `'👁'` (emoji) | `eye`/`eye-slash` |
| 6 | `controls/text-field/text-field.ts:764` | `'📅'` (emoji) | `calendar-blank` |
| 7 | `controls/text-field/text-field.ts:798` | `'▲'` | `caret-up` |
| 8 | `controls/text-field/text-field.ts:805` | `'▼'` | `caret-down` |

Recommended order (lowest-risk first): (1) `ui-select` caret — the canonical template. (2) `ui-calendar`
month-nav. (3) `ui-text-field` adornments (highest fan-in, incl. the eye/eye-slash toggle-state browser
leg) — do last. Each migration = swap the literal for `setIcon(cell, '<name>')`, NO CSS change, done-when
check+test+test:browser green and the migrated cell's rendered box is unchanged vs. the pre-migration
snapshot. `ui-combo-box` has **no caret today** — a parity caret there is net-new work, not a migration
(optional design decision, not scoped). The checkbox `clip-path` tick stays CSS by design; the vendored
`check` icon is only the forward companion if a future ADR elects otherwise.

**Open follow-ups** (recorded, not this track): the 8-site migration roadmap above (separate waves); two
non-blocking hardening items the reviewer flagged as done-but-worth-watching — the geometry-reconciliation
"no CSS edit" claim has no *permanent* regression gate (verified once by hand at ship, not a standing
test — a future wave touching `icon.css`/the adornment cells should re-verify); the icons↛components /
zero-runtime-Phosphor grep gates are static-import-only (a dynamic `import()` would slip past both,
mirroring the same pre-existing blind spot in `components/layering.test.ts` — low risk, no dynamic
imports exist today).
