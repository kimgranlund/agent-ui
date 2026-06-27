// watch.ts — the `watch` directive (plan §6; G3 slice 2, per-hole scoped reactivity).
//
// `watch(source)` is a value-producing child directive: it owns ONE inner sub-`ChildPart` and ONE
// connection-scope-owned effect. The effect reads `source` (a `ReadonlySignal`'s `.value`, or a thunk
// `() => T`) UNDER ITS OWN tracking context and commits the value through the inner part — so the value can
// be text, a `TemplateResult`, an array, or even a nested directive (full part machinery, including the
// per-part `Object.is` skip). The headline invariant: a watched-signal change wakes ONLY this hole's effect;
// the HOST render effect gains no source on the watched signal, so it does NOT re-run (rubric D5).
//
// The effect is installed via `ctx.effect` (the scope_seam from template.ts), NOT a bare `effect()`. This
// makes it owned by the CONNECTION SCOPE: it survives unrelated host re-renders, dies on disconnect with
// zero residue (the watched signal drops to zero subscribers), and respawns on reconnect. The `installed`
// flag (reset by the effect's own cleanup when the scope disposes it) guarantees install-once — a host
// re-render or a reconnect never double-installs. The directive instance persists in the (persisted)
// `ChildPart` across disconnect/reconnect; only the scope-owned effect dies and is re-installed.
//
// Imports only `../reactive` (the `ReadonlySignal` type) + the directive seam from `./template.ts`; not
// re-exported from this file — the dom barrel (S3) re-exports `watch`.

import { Directive, directive, NO_COMMIT, type RenderContext, type DirectiveResult } from './template.ts'
import type { ReadonlySignal } from '../reactive/index.ts'

/** A watch source: a readable signal (read via `.value`) or a thunk (read by calling it). */
type WatchSource<T> = ReadonlySignal<T> | (() => T)

/** Read a source UNDER the caller's tracking context — `.value` for a signal, a call for a thunk. */
function readSource<T>(source: WatchSource<T>): T {
  return typeof source === 'function' ? source() : source.value
}

/**
 * The `watch` directive instance. One inner sub-part + one scope-owned effect. `update` stores the current
 * source/mapper (a host re-render may hand new ones) and installs the effect ONCE, via `ctx.effect`. The
 * effect reads the source under its own tracking context — subscribing THIS effect, not the host render
 * effect — and commits the (optionally mapped) value through the inner part. Returns `NO_COMMIT`: the
 * directive owns its DOM (the inner sub-part), so the host part commits nothing.
 */
class WatchDirective extends Directive {
  // The sub-`ChildPart` the effect commits into. Created in the field initializer (runs after the base
  // constructor stored the host part), so it persists with the instance across disconnect/reconnect.
  readonly #inner = this.createPart()
  #source: WatchSource<unknown> | undefined
  #mapper: ((value: unknown) => unknown) | undefined
  #installed = false
  // The effect's disposer — kept so a LEAVE-directive-mode `dispose()` (while still connected) can stop the
  // effect before it commits into the torn-down inner part. On DISCONNECT the connection scope disposes the
  // effect directly (this disposer is not called); both paths are idempotent.
  #disposeEffect: (() => void) | undefined

  update(args: readonly unknown[], ctx?: RenderContext): unknown {
    this.#source = args[0] as WatchSource<unknown>
    this.#mapper = args[1] as ((value: unknown) => unknown) | undefined
    // Install ONCE per connection. A host re-render re-runs `update` with `installed === true` → only the
    // source/mapper fields above are refreshed; the effect is NOT re-installed (no per-render churn). Without
    // a `ctx` (a bare 2-arg `render`, no host scope) there is no owner to install under — stay un-installed.
    if (!this.#installed && ctx) {
      this.#disposeEffect = ctx.effect(() => {
        // Re-assert liveness at the TOP of every run. The kernel calls an effect's cleanup before EVERY
        // re-run (not only on disposal), so resetting `installed` in the cleanup alone would wrongly mark a
        // signal-driven re-run as un-installed and let the next host re-render double-install. The body runs
        // only while the effect is alive, so a normal re-run nets `true` (cleanup false → body true) while a
        // DISPOSAL nets `false` (cleanup false → body never runs) — the flag tracks true liveness.
        this.#installed = true
        const raw = readSource(this.#source!) // tracked by THIS effect (activeConsumer = this effect)
        this.#inner.commit(this.#mapper ? this.#mapper(raw) : raw)
        return () => {
          this.#installed = false
        }
      })
    }
    return NO_COMMIT
  }

  dispose(): void {
    this.#disposeEffect?.() // stop the effect first so it cannot commit into a torn-down inner part
    this.#disposeEffect = undefined
    this.#inner.dispose()
  }
}

const watchDirective = directive(WatchDirective)

/**
 * `watch(source, mapper?)` — bind a child hole to a reactive `source` so only that hole updates when the
 * source changes (the host render effect never re-runs for it). `source` is a `ReadonlySignal<T>` (read via
 * `.value`) or a thunk `() => T` (the general form; a thunk tracks whatever signals it reads at run time).
 * An optional `mapper` transforms the value before it is committed. Use inside a `UIElement.render()` so the
 * host threads its connection scope; outside a host (a bare 2-arg `render`) there is no scope to own the
 * effect and the hole stays empty.
 */
export function watch<T>(source: ReadonlySignal<T> | (() => T), mapper?: (value: T) => unknown): DirectiveResult {
  return watchDirective(source, mapper)
}
