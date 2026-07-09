// router-outlet.ts — UIRouterOutletElement, the factory-seam rendering surface (LLD-C7, SPEC-R5,
// ADR-0115 cl.5). `html``/render are private (ADR-0023), so the outlet cannot accept a TemplateResult —
// it swaps in the matched route's OWN factory-produced Element instead (sync or lazy async), guarded
// last-navigation-wins. Light DOM, transparent container: `render()` stays the inherited no-op (this
// control manages its child imperatively via `replaceChildren`, never through the template layer).

import { UIElement, signal } from '@agent-ui/components'
import type { Router } from '../../core/types.ts'

/** `document.createElement`/DOM APIs are fine here (unlike core/*.ts) — the elements live OUTSIDE the
 *  headless core by design (LLD-C7 is a rendering seam, not part of the DOM-free kernel). */
export class UIRouterOutletElement extends UIElement {
  // No attribute-as-API surface (SPEC-R5) — `.router` is a manual property-only accessor below, not a
  // `static props` entry. An empty schema keeps `finalize()`/the descriptor contract↔props trip-wire
  // well-typed against a real (if empty) PropsSchema rather than `undefined`.
  static props = {}

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

  protected override connected(): void {
    this.effect(() => {
      const match = this.#router.value?.route.value ?? null
      const token = ++this.#token

      if (match === null) {
        this.replaceChildren() // no match (or no router assigned) — render nothing, never throw
        return
      }

      let result: Element | Promise<Element>
      try {
        result = match.record.component(match)
      } catch (err) {
        // A throwing factory clears the child and logs — no retry, no partial render.
        console.error(`@agent-ui/router: route "${match.record.path}" factory threw`, err)
        this.replaceChildren()
        return
      }

      if (result instanceof Promise) {
        result.then(
          (resolved) => {
            if (token !== this.#token) return // stale — a newer navigation/router/disconnect superseded this
            assertElement(resolved, match.record.path)
            this.replaceChildren(resolved)
          },
          (err: unknown) => {
            if (token !== this.#token) return
            console.error(`@agent-ui/router: route "${match.record.path}" factory rejected`, err)
            this.replaceChildren()
          },
        )
        return
      }

      assertElement(result, match.record.path)
      this.replaceChildren(result)
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
