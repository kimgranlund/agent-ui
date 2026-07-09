---
# router-outlet.md frontmatter — the attributes-as-API descriptor for ui-router-outlet (ADR-0004,
# ADR-0115 cl.5). The `.router` property is PROPERTY-ONLY (no attribute form — a Router instance is
# never attribute-serializable), so `attributes: []`; `properties:` records it instead. Field set per
# .claude/docs/plan.md §10 / ADR-0004.
tag: ui-router-outlet
tier: layout           # geometry size-class (Container/layout band — a transparent container, NO control height; geometry.md)
extends: UIElement     # a plain structural base — NOT UIContainerElement (no surfaceProps/flexProps; the outlet owns no elevation/flex grammar)
# marginal: measured at LLD-C9 (the size line-item slice, out of this component's own scope)

attributes: []          # property-only surface — no attribute-as-API rows (SPEC-R5)

properties:              # the ONE manual accessor beyond the (empty) attributes-as-API
  - name: router
    description: The router instance to render (property-only, no attribute form; default null). While attached, the outlet renders the current `route.value`'s matched record's `component(match)` element as its child, swapping on every route change (SPEC-R5, LLD-C7) — the previous child is removed (its own UIElement teardown provably runs: zero live effects/listeners) and the next is appended. A sync factory swaps immediately; an async (`Promise`) factory resolves last-navigation-wins — a stale resolution (superseded by a newer navigation, a router re-assignment, or the outlet's own disconnect) is discarded, never committed. `route.value === null` (no match, or no router assigned) renders nothing and never throws. Revisit does NOT restore prior child state (keep-alive is fenced, ADR-0115 cl.7).

events: []               # none at v1 — the route signal is the notification surface (ADR-0115 cl.8)

slots: []                 # the child is entirely outlet-managed (the matched factory's element) — no author-facing named slot

parts: []                 # light-DOM, transparent container — no shadow parts exposed

customStates: []          # no interaction states — a structural rendering seam has no hover/active/motion gate of its own

face:
  formAssociated: false   # NOT a FACE form control — a rendering seam contributes nothing to a form

aria:
  role: none              # the outlet itself carries no role — semantics live entirely on the swapped-in content
  roleSource: none        # the host carries no role attribute and internals sets none

keyboard: []               # no keyboard interaction of its own — focus/keyboard behavior belongs to the swapped-in content

geometry:
  sizeClass: layout        # Container/layout — NO control height (never reads --ui-height-*); intrinsic sizing, no padding law
  blockSize: auto          # content-driven — whatever the swapped-in element's own geometry resolves to
  paddingBlock: 0          # the outlet adds no padding of its own

forcedColors: The outlet paints nothing of its own (a transparent container) — forced-colors legibility is entirely the swapped-in content's own concern; no `@media (forced-colors: active)` block is needed here.
---

# ui-router-outlet

`ui-router-outlet` is the rendering half of `@agent-ui/router` (LLD-C7) — a light-DOM,
**non-form-associated** `UIElement` that swaps its single child to whatever the currently-matched route's
`component` factory produces. It is a **factory seam, not a template seam**: `html``` stays private
(ADR-0023), so a route's `component` MUST return a real `Element` (typically a defined custom element),
sync or as a lazy `Promise<Element>` (code-splitting).

```ts
import { createRouter } from '@agent-ui/router'
import '@agent-ui/router/router-outlet'

const router = createRouter([
  { path: '/', component: () => document.createElement('home-page') },
  { path: '/settings', component: async () => { await import('./settings-page.ts'); return document.createElement('settings-page') } },
])

const outlet = document.querySelector('ui-router-outlet')!
;(outlet as HTMLElement & { router: typeof router }).router = router
```

## Behavior

- **Property-only `.router`** — no attribute form; a `Router` instance is never attribute-serializable.
  Assigning a new router (or `null`) re-drives the ONE effect that owns rendering — the previous router's
  route stops driving, with no residue.
- **Swap, not append** — on every route change the previous child is REMOVED (its own connection scope +
  listeners provably torn down, the standard `UIElement` zero-residue contract) before the next child is
  appended.
- **Lazy routes race-guarded** — an async factory's resolution is committed only if it is still the
  MOST RECENT navigation, router assignment, or the outlet's own disconnect; a stale resolution is
  silently discarded (never a flash of superseded content).
- **`null` route renders nothing** — no match, or no router assigned, empties the outlet without
  throwing.
- **No keep-alive** — revisiting a route re-invokes its factory; prior child state is not preserved
  (ADR-0115 cl.7's documented fence — a named future extension, not built at v1).
