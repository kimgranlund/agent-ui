---
# theme-provider.md frontmatter — the attributes-as-API descriptor for ui-theme-provider (ADR-0004 /
# ADR-0117). The machine-checkable public surface lives HERE (frontmatter); the prose below the fence is
# the /site doc. Field set per .claude/docs/plan.md §10 / ADR-0004; the promotion contract per
# .claude/docs/spec/theme-provider.spec.md / .claude/docs/lld/theme-provider.lld.md.
tag: ui-theme-provider
description: A coordination element that establishes a color-scheme, scale, and density subtree for its descendants.
tier: container         # geometry.md Container/layout band — no control height, no --md-sys-space opinion (the ui-form-provider precedent)
extends: UIElement      # NOT UIFormElement (carries no value/validity of its own) and NOT UIContainerElement (paints no surface of its own) — same reasoning ADR-0050 already ratified for ui-form-provider
# marginal: ui-theme-provider adds a small delta to the self-defining ui-* family (measured via `npm run size`'s leave-one-out per-control marginal, tree-shaken) — a single reflected-scheme effect plus three pure-carrier reflections, materially smaller than ui-form-provider's registry-backed footprint.

attributes:            # attributes-as-API — mirrors theme-provider.ts `static props`; all four default to
                        # '' (unset is a real, first-class, in-vocabulary state — SPEC §2, never a JS fallback)
  - name: scheme
    type: enum
    values: ['', light, dark]
    default: ''
    reflect: true      # reflects; the ONE axis with a JS-side effect (SPEC-R3) — '' clears any inline
                        # color-scheme override rather than defaulting to 'light' (the load-bearing fix)
  - name: scale
    type: enum
    values: ['', ui-sm, ui-md, ui-lg, content-sm, content-md, content-lg]
    default: ''
    reflect: true      # reflects; pure carrier (SPEC-R4) — dimensions.css's [scale] selectors key off the
                        # attribute directly, zero JS-side effect
  - name: density
    type: enum
    values: ['', compact, comfortable, spacious]
    default: ''
    reflect: true      # reflects; pure carrier (SPEC-R4), same shape as scale
  - name: theme
    type: string
    default: ''
    reflect: true      # reflects; the RESERVED package seam (ADR-0079 cl.3 / SPEC-R5) — wired but inert
                        # until a future [theme='<name>'] CSS layer ships

properties: []            # attribute reflection is the entire public surface — no method/getter beyond the four typed accessors static props installs

events: []                 # a pure coordination/carrier element emits nothing of its own

slots:
  - { name: default, optional: false, description: "The themed subtree — any descendant reading a --md-sys-color-*/--ui-* token resolves against this provider's color-scheme + [scale]/[density] attributes." }

parts: []                  # light-DOM wrapper — no control-owned [data-part] nodes, no visual surface

customStates: []           # no :state() hooks — the provider has no interaction states of its own

face:
  formAssociated: false    # the provider carries no value of its own — it is not form-associated

aria:
  role: none                # pure coordination — no accessible surface, no role, no aria-* attribute on the host
  roleSource: none
  labelSource: none

keyboard: []                # no keyboard contract of its own — the themed descendants own their own keyboard models

geometry:
  sizeClass: container       # Container/layout band — no control height, no --md-sys-space opinion of its own
  display: block             # the host's structural default (an unstyled custom element defaults to inline, which would lay slotted block-level descendants out inline against it)
  note: "No --ui-theme-provider-* token chain (nothing to theme, form-provider precedent). ONE further declaration since ADR-0148: the zero-specificity scheme-boundary ink re-root (`:where(ui-theme-provider) { color: var(--md-sys-color-neutral-on-surface) }`) — inherited ink re-resolves at a forced color-scheme boundary; ink only, any consumer declaration outranks it."

forcedColors: No forced-colors rules needed — the provider paints no surface of its own (the ADR-0148 ink re-root consumes a system role that WHCM maps like any other ink); its themed descendants carry their own WHCM treatment.
---

# ui-theme-provider

`ui-theme-provider` is a real, importable theming element for `@agent-ui/components` — a pure
coordination/carrier layer establishing a `color-scheme` subtree plus two pure attribute carriers
(`scale`/`density`) and a theme package seam (`theme`), promoted from the docs site's own
`site/lib/theme-provider.ts` wrapper (ADR-0117).

```html
<ui-theme-provider scheme="dark">
  <ui-button variant="solid">Solid</ui-button>
</ui-theme-provider>
```

## Axes

- **`scheme`** — `'' | 'light' | 'dark'`, default `''`. The one axis with a JS-side effect: a non-empty
  value maps to `this.style.colorScheme`, which every `light-dark()` token in `tokens.css` resolves
  against per-subtree via inheritance. **Unset is a real, first-class state** — `''` clears any inline
  override rather than defaulting to `'light'` (the load-bearing fix over the site-local predecessor), so
  an unwrapped or unset provider imposes no override and its subtree inherits the ambient scheme: the
  page's own, or an ancestor provider's, if this one nests inside another. An out-of-vocabulary value set
  directly via `setAttribute` fails open to `''` (inherit), never fails closed to a named value, never throws.
- **`scale`** — the six ADR-0032 tiers (`ui-sm … content-lg`), default `''`. A pure attribute carrier: no
  JS-side effect. `dimensions.css`'s `[scale]` selectors key off the attribute directly — any wrapper
  element (not just this one) already carries the same mechanism.
- **`density`** — `'' | compact | comfortable | spacious'`, default `''`. Same pure-carrier shape as `scale`.
- **`theme`** — a free string, default `''`. The **package seam** (ADR-0079 cl.3, ADR-0141): swaps whole
  token palettes. This component itself stays a pure carrier — no JS-side effect, no built-in pack registry
  — it only sets the attribute a `[theme='<name>']` CSS layer selects on; loading and injecting that layer's
  stylesheet is the consumer's job (`@agent-ui/shared/themes/*`, lazy-loaded by `site/lib/theme-loader.ts`
  in this repo's own docs shell). An unregistered name degrades silently (no layer matches it, the subtree
  keeps the default palette, nothing breaks).

## Attribute ↔ property reflection

All four axes are typed, reflected `static props` (`el.scheme = 'dark'` and
`setAttribute('scheme', 'dark')` behave identically) — the same `UIElement`/`static props` contract every
other shipped control carries, buying the descriptor↔props trip-wire and `family-coherence.test.ts`
participation for free.

## Nesting

A `ui-theme-provider` establishes its own `color-scheme` only when `scheme` is non-empty; an unset
provider nested inside a scheme'd ancestor lets its own descendants resolve the ANCESTOR's scheme (the
correctness case this promotion exists to fix — the site-local predecessor always collapsed an unset
`scheme` to `'light'`, silently overriding a nested composition).

## Catalog disposition

`ui-theme-provider` is **permanently excluded** from the A2UI default catalog — it is page/app-owner
chrome establishing a theming subtree, not agent-emittable content (the same reasoning class as
`Toast`/`ToastRegion`, ADR-0112 cl.6). No fork in this component's governing SPEC reopens this short of a
future ADR.

## Accessibility

The provider carries no role and no `aria-*` attribute — it is pure coordination, not an accessible
container. Its descendants own their own accessible names and roles.
