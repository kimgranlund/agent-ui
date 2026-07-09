// router-link.ts — UIRouterLinkElement, the in-app navigation primitive (LLD-C8, SPEC-R6, ADR-0115
// cl.6). Stamps ONE real `<a>` (native link role/keyboard/copy/AT announcement free — the ADR-0114 stamp
// doctrine); the host's authored light children are moved into it ONCE at connect (the anchor WRAPS the
// content). Plain activation is intercepted (`preventDefault` → `router.navigate`); modified/middle
// clicks fall through natively; `aria-current="page"` marks the exact-active link. No keydown path —
// native anchor activation already synthesizes a click on Enter (the checkbox double-fire lesson).

import { UIElement, prop, signal, type PropsSchema, type ReactiveProps } from '@agent-ui/components'
import type { Router } from '../../core/types.ts'
import type { RouterInternal } from '../../core/router.ts'

const props = {
  to: { ...prop.string(''), reflect: true },
  replace: { ...prop.boolean(false), reflect: true },
} satisfies PropsSchema

/** Derive the stamp's `href` from the router's attached URL strategy (LLD-C6's `RouterInternal.urlFormat`
 *  seam) — hash form when none is attached (the documented memory-only degradation, SPEC-R6 AC3). */
function hrefFor(router: Router | null, to: string): string {
  const internal = router as RouterInternal | null
  return internal?.urlFormat ? internal.urlFormat(to) : `#${to}`
}

export interface UIRouterLinkElement extends ReactiveProps<typeof props> {}
export class UIRouterLinkElement extends UIElement {
  static props = props

  /** Class-level wiring (ADR-0115 fork F4) — one line per app; a per-instance `.router` always wins. The
   *  provider/context discovery element is the named foreseen extension (not built at v1). */
  static defaultRouter: Router | null = null

  #router = signal<Router | null>(null)
  #stamp: HTMLAnchorElement | null = null
  #warnedNoRouter = false

  /** Property-only per-instance override — no attribute form (a Router instance is never
   *  attribute-serializable, the same rule as `ui-router-outlet`'s `.router`). */
  get router(): Router | null {
    return this.#router.value
  }
  set router(value: Router | null) {
    this.#router.value = value
  }

  /** Resolve the EFFECTIVE router per-call — never cached at connect, so late `defaultRouter` wiring
   *  works for navigation (LLD-C8 edge). The per-instance value always wins. */
  #effectiveRouter(): Router | null {
    return this.#router.value ?? UIRouterLinkElement.defaultRouter
  }

  protected override connected(): void {
    const stamp = document.createElement('a')
    stamp.append(...this.childNodes) // move the host's authored content into the stamp ONCE
    this.append(stamp)
    this.#stamp = stamp

    this.listen(stamp, 'click', (e) => this.#onClick(e as MouseEvent))

    // ONE effect drives both the href and the aria-current state — both `to` and the effective router's
    // `route` are reactive; `UIRouterLinkElement.defaultRouter` is a plain static and is NOT tracked (a
    // documented limitation: set the default before mounting links, or use the per-instance `.router`).
    this.effect(() => {
      const to = this.to
      const instanceRouter = this.#router.value
      const router = instanceRouter ?? UIRouterLinkElement.defaultRouter

      stamp.setAttribute('href', hrefFor(router, to))

      const active = router !== null && router.route.value?.path === to
      if (active) stamp.setAttribute('aria-current', 'page')
      else stamp.removeAttribute('aria-current')

      if (router === null && !this.#warnedNoRouter) {
        this.#warnedNoRouter = true
        console.warn('@agent-ui/router: <ui-router-link> has no router (no instance, no defaultRouter) — falling back to native hash navigation')
      }
    })
  }

  #onClick(e: MouseEvent): void {
    const stamp = this.#stamp
    if (stamp === null) return
    // A nested interactive element other than the stamp itself — an authoring anti-pattern regardless,
    // but the guard keeps a stray bubbled click from being mis-attributed to this link.
    if ((e.target as Element | null)?.closest('a') !== stamp) return
    // Modified/middle/non-primary clicks are native platform behavior — checked FIRST, before any
    // preventDefault (SPEC-R6 AC2's probe).
    if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return
    const router = this.#effectiveRouter()
    if (router === null) return // no router anywhere — native hash navigation proceeds (documented degradation)
    e.preventDefault()
    router.navigate(this.to, { replace: this.replace })
  }
}

if (!customElements.get('ui-router-link')) customElements.define('ui-router-link', UIRouterLinkElement)
