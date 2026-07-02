# Rubric — templating + directives (`@agent-ui/components` `src/dom/` G3)

The referential standard the **G3 template layer** (`html`/`svg`/`render` + the part engine and the
opt-in directive seam) is built against and graded by. Companion to [`../plan.md`](../plan.md) §6 and
[`../goals.md`](../goals.md) G3; mirrors [`./element.md`](./element.md) and [`./kernel.md`](./kernel.md).
Like the kernel and element layers, G3 is mostly mechanically verifiable, so this rubric is gate-heavy:
most dimensions are "the named probes are present **and** green," and the anchors name them (that is the
evidence). The two headline invariants — *re-render re-parses nothing* (the prepared-template cache) and
*a `watch` updates its hole WITHOUT re-running the host render effect* — fail **silently** (the UI still
updates, just by re-rendering everything or by leaking), so they carry pinning probes, not "handled."
Scale 1–5; 1 = failure, 3 = adequate, 5 = excellent.

| # | Dimension | Type | What it checks | 1 → 3 → 5 (anchors name the evidence: probe ids) |
|---|---|---|---|---|
| D1 | Prepare & cache — re-parse nothing | [gate] | `html`/`svg` return inert results; the first render of a call site prepares its frozen `strings` once (markers → one `<template>` parse → a parts manifest) into a `WeakMap` keyed by `strings` identity; re-renders re-parse nothing | 1: a re-render re-parses, or there is no cache · 3: `prepare-cache` green — the same `strings` ⇒ the same prepared instance, a second render parses nothing · 5: + the result is proven inert (no DOM work at the call site), the cache is keyed by `strings` *identity* (an equal-but-distinct array misses, as it must), and the parts manifest is built exactly once per call site |
| D2 | Per-part commit & `Object.is` skip | [gate] | each part owns one site and its own dirty check; a child hole commits text / nested template / array; an `attr` / `?bool` / `.prop` / `@event` part commits to its site; an `Object.is`-equal hole writes no DOM; an `@event` part keeps a stable listener identity (the inner handler swaps) | 1: a part kind is missing, or an equal hole still writes · 3: `child-commit` (text + template + array) + `attr-commit` + `part-skip` green · 5: + `?bool`/`.prop`/`@event` each pinned, `event-stable-identity` proves ONE platform listener across re-renders (no add/remove churn, no event dropped mid-swap), and the kernel cutoff holds through the part (an `Object.is`-equal commit wakes no DOM) |
| D3 | The directive seam | [gate] | a directive is a branded factory → an update fn threading state across commits of the SAME hole, with a `dispose()`; the child part recognizes a directive result and routes commits to it; `classMap`/`ref`/`unsafeHTML` ride the seam; a throwing disposer is isolated (doesn't abort sibling teardown) | 1: no seam (directives inlined), or a throwing disposer aborts siblings · 3: `directive-seam` (state threads across commits; `dispose()` runs) + the three simple directives green · 5: + `directive-teardown-isolation` (a throwing disposer leaves siblings torn down) and the seam is the SOLE extension point — `repeat`/`watch` are riders, not special-cased in the part engine |
| D4 | `repeat` — keyed reconcile | [gate] | `repeat(items, key, template)` reuses DOM by key, moves by identity, throws on a duplicate key; append / remove / a stable prefix cost zero DOM moves | 1: re-creates DOM, or moves by index (drops element state) · 3: `repeat-keyed` (reuse by key) + `repeat-dup-throw` green · 5: + `repeat-move-identity` (a reorder MOVES nodes by identity, not re-creates — identity preserved always [jsdom gate]; element state/focus preserved where native moveBefore is supported [browser leg], identity-only fallback otherwise, ADR-0022) and `repeat-zero-move` (append/remove/stable-prefix perform zero moves) |
| D5 | `watch` — scoped reactivity, no host re-render | [gate] | `watch(signal)` updates ONLY its hole on the signal's change WITHOUT re-running the host render effect; its subscription dies on disconnect and respawns on reconnect | 1: a watch update re-runs the whole host render effect, or the subscription is a child of the render effect (torn down every render), or it leaks past disconnect · 3: `watch-isolated-rerender` green — the hole updates and the host render effect does NOT re-run (it gained no source on the signal) · 5: + `watch-reconnect` (dies on disconnect, respawns on reconnect, zero residue) and the per-hole effect is proven owned by the connection scope, not the transient render effect |
| D6 | svg namespace & static-shape errors | [gate] | `svg` fragments parse in the SVG namespace; an unsupported binding position throws with a useful message; tag-name indirection (`${x}` in tag position) throws at prepare time | 1: svg elements parse in the HTML namespace, or a bad position fails silently / corrupts · 3: `svg-namespace` + `bad-position-throws` green · 5: + `tag-indirection-throws`, and each error message names the offending position (actionable, not a bare throw) |
| D7 | html`` end-to-end — the G1–G3 integration proof | [gate] | one `UIElement` subclass's `render()` commits an `html`` template into `renderRoot` through the connection-scoped render effect; a tracked prop change re-runs the host render effect and commits only the changed hole | 1: no end-to-end proof, or `render()` doesn't compose with the host effect · 3: `html-e2e` green — a `UIElement` renders a static `html`` into `renderRoot` · 5: + a tracked-prop change drives a re-render that commits ONLY the changed hole (`Object.is`-skip end-to-end), and a `watch`-driven hole updates without the host re-rendering — the reactive G1–G3 proof |
| D8 | Layering, surface & decorator-free TS | [review] | `template.ts`/`directives.ts` import ONLY `../reactive` (the import-layering trip-wire stays green); no `enum`/`namespace`/decorator (`erasableSyntaxOnly`); the dom barrel exports exactly the intended G3 surface | 1: an upward/sideways import, or an `enum`/decorator slips in · 3: trip-wire green + `tsc` clean + surface mostly minimal · 5: surface is exactly the intended set (`html`, `svg`, `render`, `repeat`, `watch`, `classMap`, `ref`, `unsafeHTML`, the result/part types) with no internal part/manifest field leaking, and the part-kind discriminated union is exhaustiveness-checked (a `never` default) |
| D9 | Budget | [gate] | the reactive+dom+template gz is measured and within the provisional consumer budget | 1: unmeasured · 3: measured (esbuild-min + gzip) and within the ≤ ~6 kB reactive+dom consumer budget (plan §10) · 5: measured, within, and the figure recorded with the commit, with the marginal template+directives cost called out |

## Gate to promote (ship the template layer)

- **D1, D2, D4, D5, D7 ≥ 4** — re-parse-nothing, per-part commit + `Object.is` skip, keyed `repeat`,
  scoped `watch`, and the end-to-end proof are the correctness/perf core of a signals template engine
  (plan §2: *value-diffs against a cached instance, one render effect per host, per-part `Object.is`
  below it*); "adequate" is not enough.
- **D3 ≥ 4** and **D8 ≥ 4** — the seam `repeat`/`watch` stand on, and inward-only layering + a minimal,
  non-leaking surface.
- **D6 ≥ 3** — the error throws are load-bearing (silent corruption otherwise); the svg namespace is
  forward-looking (no svg control until the `ui-select` caret), so it carries less weight than the throws.
- **D9 ≥ 3.**
- Any correctness gate (**D1–D5, D7**) below 4 blocks promotion regardless of the other scores. **D7 is
  the precondition:** until one `UIElement` renders via `html`` end-to-end, the layer is not proven to
  render (goals.md G3 DoD box 4) — and `repeat` is the program-critical export (the A2UI renderer's
  dynamic lists reuse it), so D4 below 4 blocks the renderer too.

**Top failure to look for first:** *re-parse churn* — a re-render that re-parses the template because the
prepared-template cache missed on stable `strings` (D1) — and *watch leaking into the host* — a
`watch(sig)` that either makes the host render effect subscribe to `sig` (so a watch update re-runs the
WHOLE host render) or is created as a child of the render effect (so it is torn down every render) (D5).
Both fail **silently** — the UI still updates, just by re-rendering everything or by leaking — so they
need pinning probes (`prepare-cache`, `watch-isolated-rerender`), not "handled." A third: *event-listener
churn* — an `@event` part re-adding/removing its listener each render instead of a stable identity with a
swapped inner handler (D2), which silently drops an event mid-swap. A fourth: *repeat moving by index* — a
reorder that re-creates DOM (losing focus/selection) instead of moving by identity (D4).

## Probe & fixture naming

Probes live beside the dom layer (`src/dom/*.test.ts`), named for the dimension they pin (`prepare-cache`,
`part-skip`, `child-commit`, `attr-commit`, `event-stable-identity`, `repeat-keyed`, `repeat-dup-throw`,
`repeat-move-identity`, `repeat-zero-move`, `watch-isolated-rerender`, `watch-reconnect`,
`directive-teardown-isolation`, `svg-namespace`, `bad-position-throws`, `html-e2e`, …). The probe id **is**
the evidence link from rubric to suite; a dimension with no green probe of its name scores 1. D7's
`html-e2e` is the G1–G3 integration proof through a real `UIElement` subclass (`render()` committing
`html`` into `renderRoot` under the scope-owned render effect), not a unit stub.

<!-- Self-scored against rubric-rubric: D1 5 · D2 5 · D3 4 · D4 5 · D5 5 · D6 4 · D7 5 · D8 4 · D9 4. Gate (D1,D3,D5,D8 ≥ 3): pass. -->
