// router-outlet.ts — UIRouterOutletElement, the factory-seam rendering surface (LLD-C7, SPEC-R5,
// ADR-0115 cl.5). `html``/render are private (ADR-0023), so the outlet cannot accept a TemplateResult —
// it swaps in the matched route's OWN factory-produced Element instead (sync or lazy async), guarded
// last-navigation-wins. Light DOM, transparent container: `render()` stays the inherited no-op (this
// control manages its child imperatively via `replaceChildren`, never through the template layer).

import { UIElement, prop, signal, untracked, withViewTransition, type PropsSchema, type ReactiveProps } from '@agent-ui/components'
import type { Router } from '../../core/types.ts'

const props = {
  // GH #740/ADR-0183 cl.2 (un-fencing ADR-0115 cl.7's named future candy) — the OPT-IN View Transitions
  // gate: `true` wraps every route swap in `document.startViewTransition` where the platform allows it
  // (`withViewTransition`'s own availability × reduced-motion gate); the default `false` and every
  // no-API/reduced-motion path are byte-identical to the pre-#740 outlet.
  viewTransitions: { ...prop.boolean(false), reflect: true, attribute: 'view-transitions' },
} satisfies PropsSchema

/** `document.createElement`/DOM APIs are fine here (unlike core/*.ts) — the elements live OUTSIDE the
 *  headless core by design (LLD-C7 is a rendering seam, not part of the DOM-free kernel). */
export interface UIRouterOutletElement extends ReactiveProps<typeof props> {}
export class UIRouterOutletElement extends UIElement {
  // `.router` stays a manual property-only accessor below, never a `static props` entry (SPEC-R5 — a
  // Router instance is not attribute-serializable). `viewTransitions` (GH #740) IS an ordinary boolean
  // prop with an attribute form — the serializability rationale never applied to it.
  static props = props

  #router = signal<Router | null>(null)
  // Bumped on every effect run AND on disconnect — an in-flight async factory resolution is discarded
  // unless its captured token still matches (SPEC-R5 AC2's last-navigation-wins guard; disconnect ALSO
  // bumps it — belt and suspenders — so a resolution arriving after teardown never swaps onto a dead host).
  #token = 0

  /** Property-only — no attribute form (SPEC-R5: a router instance is never attribute-serializable). */
  get router(): Router | null {
    return this.#router.value
  }
  set router(value: Router | null) {
    this.#router.value = value
  }

  /** GH #740/ADR-0183 — the ONE swap site every path funnels through: wraps `replaceChildren` in
   *  `withViewTransition` under the opt-in. The stale-token re-check lives INSIDE the mutate closure —
   *  the helper's own stated caveat: on the transition path the browser snapshots first and runs the
   *  mutation asynchronously, so a check made before the call could admit a superseded swap. The sync
   *  fallback path re-checks harmlessly (the token cannot have moved within the same task). */
  #swap(token: number, ...nodes: Element[]): void {
    // `untracked` — the opt-in flag must not become a dependency of the route effect this is called
    // from: a toggle mid-session would otherwise re-run the effect and re-invoke the route factory
    // (a fresh element for an unchanged route — a real behavior change, not just a wasted render).
    // A no-op clear (already empty, clearing) never transitions either — an unassigned/unmatched
    // outlet's first effect run would otherwise burn a whole-document snapshot painting nothing.
    const enabled = untracked(() => this.viewTransitions) && !(nodes.length === 0 && this.children.length === 0)
    withViewTransition(() => {
      if (token !== this.#token) return // superseded while the transition was snapshotting
      this.replaceChildren(...nodes)
    }, enabled)
  }

  protected override connected(): void {
    this.effect(() => {
      const match = this.#router.value?.route.value ?? null
      const token = ++this.#token

      if (match === null) {
        this.#swap(token) // no match (or no router assigned) — render nothing, never throw
        return
      }

      let result: Element | Promise<Element>
      try {
        result = match.record.component(match)
      } catch (err) {
        // A throwing factory clears the child and logs — no retry, no partial render.
        console.error(`@agent-ui/router: route "${match.record.path}" factory threw`, err)
        this.#swap(token)
        return
      }

      if (result instanceof Promise) {
        result.then(
          (resolved) => {
            if (token !== this.#token) return // stale — a newer navigation/router/disconnect superseded this
            assertElement(resolved, match.record.path)
            this.#swap(token, resolved)
          },
          (err: unknown) => {
            if (token !== this.#token) return
            console.error(`@agent-ui/router: route "${match.record.path}" factory rejected`, err)
            this.#swap(token)
          },
        )
        return
      }

      assertElement(result, match.record.path)
      this.#swap(token, result)
    })
  }

  protected override disconnected(): void {
    this.#token++ // invalidate any in-flight async resolution — see the field comment above
  }
}

/** A non-Element factory result is a developer error — loud, uncaught (never swallowed like a
 *  throw/rejection, which are runtime-data failures the outlet recovers from). Exported for direct unit
 *  testing: a throw from inside a custom-element REACTION (connectedCallback, or an effect flushed from
 *  a microtask) is spec-mandated to be REPORTED, not propagated to the caller — so the "loud" contract
 *  is proven here, at the source, rather than fought through the platform's reaction-reporting semantics. */
export function assertElement(value: unknown, path: string): asserts value is Element {
  if (!(value instanceof Element)) {
    throw new Error(`@agent-ui/router: route "${path}" factory must return an Element (got ${typeof value})`)
  }
}

if (!customElements.get('ui-router-outlet')) customElements.define('ui-router-outlet', UIRouterOutletElement)
