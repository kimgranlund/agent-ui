# Rubric — reactivity kernel (`@agent-ui/components` `src/reactive/`)

The referential standard the **G1 reactivity kernel** (the signals graph + scheduler) is built against and
graded by. Companion to [`../plan.md`](../plan.md) §4 and [`../goals.md`](../goals.md) G1. The kernel is
mostly mechanically verifiable, so this rubric is gate-heavy: most dimensions are "the named probes are
present **and** green." Anchors name the probes (that is the evidence). Scale 1–5; 1 = failure, 3 =
adequate, 5 = excellent.

| # | Dimension | Type | What it checks | 1 → 3 → 5 (anchors name the evidence: probe ids) |
|---|---|---|---|---|
| K1 | Equality cutoff & verified recompute | [gate] | An `Object.is`-equal write bumps no version and wakes nothing; a computed/effect whose sources verify unchanged skips its body | 1: any missing/red · 3: `cutoff-no-wake` + one `verify-skip-*` green · 5: `cutoff-no-wake` + `verify-skip-computed` + `verify-skip-effect` + a noisy-source (version churn, value stable → no recompute) case all green |
| K2 | Disposal & zero residue | [gate] | After `scope.dispose()` / `node.dispose()` the node clears its sources and is gone from every producer's subscriber set | 1: no leak probe · 3: `scope-dispose-zero` proven (via `inspect`: producer `subscribers`→0, node `sources`→0) · 5: scope + `effect-dispose-zero` + `computed-dispose-zero` + a connect→disconnect→reconnect `reconnect-zero-residue` cycle all proven |
| K3 | Cycle & failure semantics | [gate] | Re-entrant computed read → `CycleError`; a throwing computed/effect stays dirty, retries on next read, never serves a stale value; effect cleanup runs at most once per run | 1: missing · 3: `cycle-error` + `throw-retry-computed` green · 5: + `throw-retry-effect` + `cleanup-once` + `failure-poisons-verification` (the retry recomputes, never serves the stale value) all green |
| K4 | Scheduler discipline | [gate] | Effects batch + dedupe within a wave (a `Set`, no double-run); the write-loop budget throws at the wave cap instead of hanging; `whenFlushed()` resolves after the batch; an effect disposed while queued is dequeued; a throwing effect never wedges the queue | 1: no budget guard (can hang) · 3: `batch-dedupe` + `budget-throws` green · 5: + `when-flushed` + `dequeue-on-dispose` + `throw-no-wedge` all green |
| K5 | `untracked` / `unowned` isolation | [gate] | `untracked(fn)` reads create no edge; `unowned(fn)` creates nodes outside the active scope (not disposed with it) | 1: missing · 3: `untracked-no-edge` + `unowned-survives-scope` green · 5: + the module-singleton case (`unowned-not-adopted`: a node lazily created during a component scope's first touch is not adopted by that scope) green |
| K6 | Typed, minimal surface | [review] | `ReadonlySignal<T>` vs `Signal<T>` enforced at the type level (a computed's `.value` is not assignable); the barrel exports exactly the intended set; no internal protocol/underscore fields are exported; `inspect()` returns a readonly snapshot | 1: `Signal`/`ReadonlySignal` conflated, or internals exported · 3: types separated, surface mostly minimal · 5: read-only proven by a `// @ts-expect-error` on writing `computed().value`; exports are exactly `{signal, computed, effect, createScope, untracked, unowned, inspect, whenFlushed, CycleError}` + types; the `Producer`/`Consumer` protocol stays internal |
| K7 | `inspect()` graph-inert | [gate] | `inspect(node)` adds no edge, bumps no version, forces no recompute — even called inside a tracking context or on a dirty computed | 1: absent · 3: `inspect-inert` green in a non-tracking call · 5: proven inert inside a tracking context (the surrounding effect gains no source) AND on a dirty computed (it is not evaluated) |
| K8 | Budget | [gate] | The kernel's gz size is measured and within the provisional target | 1: unmeasured · 3: measured (esbuild-min + gzip) and within target — signal-only path ≪ 1 kB gz, full reactive surface within the kernel budget · 5: measured, within, and the figure recorded with the commit |

## Gate to promote (ship the kernel)

- **K1, K2, K3, K4, K7 ≥ 4** — correctness, zero-leak, scheduler safety, and graph-inertness are
  non-negotiable for a kernel; "adequate" is not enough.
- **K5, K6 ≥ 4.**
- **K8 ≥ 3.**
- Any correctness gate (K1–K4, K7) below 4 blocks promotion regardless of the other scores.

**Top failure to look for first:** *warm-cycle silent-stale* — a re-entrant computed read that serves a
stale value instead of throwing `CycleError` (K3) — and *equality-cutoff regressions* where an
`Object.is`-equal write still wakes downstream (K1). Both are the defects rce's own ledger caught; they
fail **silently**, so they must have pinning probes, not just be "handled."

## Probe naming

Probes live beside the kernel (`src/reactive/*.test.ts`) and are named for the dimension they pin (the
ids in the anchors above — `cutoff-no-wake`, `scope-dispose-zero`, `cycle-error`, `budget-throws`,
`untracked-no-edge`, `inspect-inert`, …). The probe id **is** the evidence link from rubric to suite; a
dimension with no green probe of its name scores 1.

<!-- Self-scored against rubric-rubric: D1 5 · D2 5 · D3 5 · D4 4 · D5 5 · D6 4 · D7 5 · D8 5. Gate (D1,D3,D5,D8 ≥ 3): pass. -->
