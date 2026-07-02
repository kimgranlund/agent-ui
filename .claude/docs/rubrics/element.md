# Rubric — element + typed props (`@agent-ui/components` `src/dom/` G2)

The referential standard the **G2 element layer** (`UIElement`, the FACE host + props-as-signals) is
built against and graded by. Companion to [`../plan.md`](../plan.md) §5 and [`../goals.md`](../goals.md)
G2; mirrors [`./kernel.md`](./kernel.md). Like the kernel, G2 is mostly mechanically verifiable, so this
rubric is gate-heavy: most dimensions are "the named probes/fixtures are present **and** green," and the
anchors name them (that is the evidence). The headline bet — `ReactiveProps<typeof props>` declare-merges
to correctly-typed accessors — is a **compile-time** proof (a `tsc`-gated `// @ts-expect-error` fixture),
not a runtime probe. Scale 1–5; 1 = failure, 3 = adequate, 5 = excellent.

| # | Dimension | Type | What it checks | 1 → 3 → 5 (anchors name the evidence: probe / fixture ids) |
|---|---|---|---|---|
| D1 | Props typing — the `ReactiveProps` declare-merge bet | [gate] | `interface X extends ReactiveProps<typeof props> {}` compiles under the strict tsconfig and yields accessors typed *exactly* — an `as const` enum prop is its literal union, never widened to `string`; `number\|null` and `json<T>` are preserved | 1: not proven, or an enum accessor types as `string` · 3: `props-typing` fixture compiles + one `// @ts-expect-error` (a non-member literal assignment fails) green · 5: + the literal union is proven NOT `string` (a `string` assigned to an enum prop `@ts-expect-error`s), `number\|null`/`json<T>` preserved, and the pattern survives `UIFormElement` subclassing |
| D2 | Prop schema & runtime reactivity | [gate] | `prop.*` build a typed `PropConfig` dict; `finalize()` installs signal-backed prototype accessors from `static props`; a read inside an effect tracks, a write invalidates | 1: accessors hand-written or non-reactive · 3: `finalize-installs-accessors` + `prop-write-invalidates` green · 5: + default/coercion via `PropType.from`, and a read in an effect re-runs on write while an `Object.is`-equal write wakes nothing (kernel cutoff holds through the accessor) |
| D3 | Reflection & directional locks (no loop) | [gate] | A `reflect` prop echoes to the attribute exactly once; the platform's `attributeChangedCallback` echo cannot loop (directional locks); the string↔typed boundary lives at exactly two functions | 1: reflection loops or is absent · 3: `reflect-once` + `attr-cross-typed` green · 5: + `json-no-reloop` (a JSON-valued round-trip does not re-loop) and the inbound (string→typed) + outbound (typed→string) crossings are proven lock-guarded so neither re-triggers the other |
| D4 | Lifecycle & zero residue | [gate] | `connectedCallback` opens a connection scope + `AbortController`; the render effect + `this.effect`/`this.listen` ride them; `disconnectedCallback` disposes both; connect→disconnect leaves zero residue | 1: no scope/abort wiring, or leaks · 3: `connect-disconnect-zero` proven (via `inspect`: 0 subscribers; AbortSignal: 0 live listeners) · 5: + `reconnect-zero-residue` (connect→disconnect→reconnect re-subscribes clean — the K2 cycle G1 deferred to G2) and a disposed-while-queued render effect is dequeued |
| D5 | Lazy-property upgrade dance | [gate] | A `.prop=` assignment set *before* upgrade replays through the accessor rather than shadowing it; `upgradeProps` runs at connect; `upgradeProperty` handles manual array/object accessors | 1: pre-upgrade assignment shadows the accessor (silent) · 3: `lazy-upgrade-replay` green for a primitive prop · 5: + `no-accessor-shadow` proves no own-property masks the prototype accessor, and a manual array/object accessor replays too |
| D6 | Internals-only ARIA + light DOM | [gate] | ARIA is set only through `attachInternals()`/`ElementInternals`, never host attributes; light DOM is the default (`static shadow` opts in) | 1: `role`/`aria-*` written to the host · 3: `aria-internals-only` + `no-host-aria` (probe asserts no `role`/`aria-*` attribute on the host) green · 5: + `light-dom-default` proven (no shadow root unless `static shadow`), and internals-set ARIA is read back via the AX/internals surface |
| D7 | Layering, surface & decorator-free TS | [review] | `dom` imports ONLY `../reactive` (the import-layering trip-wire stays green); no `enum`/`namespace`/decorator (`erasableSyntaxOnly`); the barrel exports exactly the intended typed surface; `this.emit` is typed via the `CustomEvent` map | 1: an upward/sideways import, or an `enum`/decorator slips in · 3: trip-wire green + `tsc` clean + surface mostly minimal · 5: surface is exactly the intended set (`UIElement`, `prop`, `PropConfig`, `ReactiveProps`, types), events typed via an `HTMLElementEventMap` augmentation, and no internal field leaks |
| D8 | Budget | [gate] | The reactive+dom kernel gz is measured and within the provisional consumer budget | 1: unmeasured · 3: measured (esbuild-min + gzip) and within the ≤ ~6 kB reactive+dom consumer budget (plan §10) · 5: measured, within, and the figure recorded with the commit |

## Gate to promote (ship the element layer)

- **D1, D3, D4, D5, D6 ≥ 4** — the typing bet, loop-free reflection, zero-residue lifecycle, the
  lazy-upgrade replay, and internals-only ARIA are the correctness core of a custom-element host;
  "adequate" is not enough.
- **D2 ≥ 4** and **D7 ≥ 4.**
- **D8 ≥ 3.**
- Any correctness gate (D1–D6) below 4 blocks promotion regardless of the other scores. D1 is the
  precondition: until the declare-merge typing is proven, **no control may depend on the layer**
  (goals.md G2 DoD1).

**Top failure to look for first:** *literal-union widening* — `ReactiveProps<typeof props>` typing an
enum accessor as `string` instead of `'solid'|'soft'|'ghost'` (D1) — and the *reflection feedback loop*
— a property write reflecting to the attribute, whose `attributeChangedCallback` writes the property,
looping (D3). A third: *lazy-upgrade shadowing* — a pre-upgrade `.prop=` creating an own property that
masks the accessor (D5). All three fail **silently**, so they need pinning fixtures/probes, not "handled."

## Probe & fixture naming

Probes live beside the dom layer (`src/dom/*.test.ts`), named for the dimension they pin (`reflect-once`,
`connect-disconnect-zero`, `reconnect-zero-residue`, `lazy-upgrade-replay`, `aria-internals-only`, …).
The typing bet (D1) is a **`tsc`-gated fixture** (`props-typing.*`) whose `// @ts-expect-error` lines are
the evidence — it scores by compiling under `npm run check`, not by a runtime assertion. The probe/fixture
id **is** the evidence link from rubric to suite; a dimension with no green probe/fixture of its name
scores 1.

<!-- Self-scored against rubric-rubric: D1 5 · D2 5 · D3 5 · D4 5 · D5 4 · D6 4 · D7 4 · D8 4. Gate (D1,D3,D5,D8 ≥ 3): pass. -->
