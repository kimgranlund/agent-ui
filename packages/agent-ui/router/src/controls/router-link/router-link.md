---
# router-link.md frontmatter — the attributes-as-API descriptor for ui-router-link (ADR-0004, ADR-0115
# cl.6). The `attributes[]` block MUST mirror router-link.ts `static props` (to/replace, in that order) —
# the contract↔props trip-wire (router-link.test.ts) targets this fence. `.router` is property-only (no
# attribute — a Router instance is never attribute-serializable), documented under `properties:` instead.
# Field set per .claude/docs/plan.md §10 / ADR-0004.
tag: ui-router-link
tier: display           # geometry size-class (Display band — text-bearing, wraps an inline <a>; NO control frame/height, the ui-text link-leg precedent; geometry.md)
extends: UIElement      # a light-DOM navigation stamp — NOT form-associated (face below), NOT a UIContainerElement surface
# marginal: measured at LLD-C9 (the size line-item slice, out of this component's own scope)

attributes:              # attributes-as-API — mirrors router-link.ts `static props`
  - name: to
    type: string
    default: ''
    reflect: true        # reflects so a JS-set `to` is inspectable/stylable too (the text.ts `as` precedent)
  - name: replace
    type: boolean
    default: false
    reflect: true        # reflects to a `replace` attribute — SPEC-R6: navigate(to, {replace}) on activation

properties:               # manual accessors beyond the attributes-as-API
  - name: router
    description: Property-only per-instance router override (no attribute form; default null). When null, activation and href-derivation fall back to the class-level `UIRouterLinkElement.defaultRouter` (ADR-0115 fork F4). The per-instance value always wins.
  - name: defaultRouter
    description: A STATIC class property (`UIRouterLinkElement.defaultRouter`, default null) — one-line app wiring so markup-heavy pages need no per-link JS. Read PER-ACTIVATION (not cached at connect), so wiring it after links have connected still works for navigation; the `href` display is NOT reactive to a late-set default (a plain static carries no signal) — set it before mounting links, or use the per-instance `.router` override, for a live href. The provider/context discovery element is the named foreseen extension (ADR-0115 cl.6), not built at v1.

events: []                # none at v1 — the route signal is the notification surface (ADR-0115 cl.8)

slots:                     # light-DOM, host-as-content — the default/unnamed children ARE the link's content
  - name: label
    optional: false
    description: The link's content — the default/unnamed children, MOVED (never cloned) into the one real stamped `<a>` at connect (the ADR-0114 stamp doctrine). The accessible name comes from this content, exactly as a native anchor.

parts: []                  # light-DOM, host-as-content — no shadow parts exposed

customStates: []           # no :state() usage — `aria-current` lives as a REAL attribute on the stamped native anchor, not an internals custom state

face:
  formAssociated: false    # NOT a FACE form control — a navigation stamp contributes nothing to a form

aria:
  role: link                    # native — the stamped <a href> carries its own implicit link role, no ARIA authored by this control
  roleSource: native-anchor     # semantics live on the REAL <a> element, never ElementInternals (there is nothing for internals to own — the anchor already IS accessible)
  activeState: aria-current="page" on the stamped anchor when `to` equals the current resolved route path (exact match; prefix matching fenced, SPEC-R6)

keyboard:
  - keys: Enter
    action: Native anchor activation synthesizes a click — no separate keydown handler (double-fire risk, the checkbox lesson)
  - note: Tab — natively focusable (a real `<a href>`); no `tabbable` trait needed, unlike ui-button's synthetic role=button focus parity

geometry:
  sizeClass: display        # Display band — text-bearing, NO control frame/height (geometry.md); sizes off the ambient font, not --ui-height-*
  blockSize: auto           # inline content — no fixed frame
  paddingBlock: 0           # no padding of its own

forcedColors: A `@media (forced-colors: active)` block repoints the stamped anchor's ink to `LinkText` (the platform's own link role) in both idle and `[aria-current='page']` states; the active state's non-color cue (bolder underline + weight, ADR-0057) survives independently of hue, so the distinction never vanishes under high-contrast mode or for CVD readers.
---

# ui-router-link

`ui-router-link` is the navigation half of `@agent-ui/router` (LLD-C8) — a light-DOM,
**non-form-associated** `UIElement` that stamps a real `<a>` around its authored content and intercepts
plain activation to navigate **in-app** (`router.navigate`), never a full document load.

```html
<ui-router-link to="/settings">Settings</ui-router-link>
```

```ts
import { UIRouterLinkElement } from '@agent-ui/router/router-link'
import '@agent-ui/router/router-link.css'

UIRouterLinkElement.defaultRouter = router // one line, wires every link on the page
```

## Behavior

- **A real stamped `<a>`** — native link role, keyboard activation, copy-link, AT announcement, all free
  (the ADR-0114 stamp doctrine). The host's authored children are moved into it once, at connect.
- **`href` is strategy-derived** — hash form (`#/path`) when memory-only (a documented degradation),
  the attached URL strategy's own form otherwise (LLD-C6's `connectUrl`); still navigates via
  interception either way.
- **Plain activation is intercepted** — an unmodified primary click calls `preventDefault()` then
  `router.navigate(to, { replace })`; **no document navigation** occurs.
- **Modified/middle clicks fall through natively** — `ctrl`/`meta`/`shift`/`alt` or a non-primary button
  is left entirely to the platform (open-in-new-tab etc. keep working).
- **`aria-current="page"`** is set on the stamped anchor exactly when `to` equals the current resolved
  route path (exact match — prefix matching is fenced), and removed otherwise.
- **No router anywhere** (no per-instance `.router`, no `defaultRouter`) — the link still renders its
  anchor (hash-form `href`) and a plain click is NOT intercepted: native hash navigation proceeds, a
  documented, honest degradation. A one-time dev warning fires.
