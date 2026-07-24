---
# sandbox-frame.md frontmatter — the attributes-as-API descriptor for ui-sandbox-frame (ADR-0004;
# genui-surface.spec.md SPEC §3.2/§3.3, D9). The machine-checkable public surface lives HERE
# (frontmatter); the prose below the fence is the /site doc. The `attributes[]` block MUST mirror
# sandbox-frame.ts `static props` (surfaceId/html/csp) — the contract↔props trip-wire
# (sandbox-frame-descriptor.test.ts) targets this fence.
tag: ui-sandbox-frame
description: The sandboxed containment host for free-form, agent-authored HTML/CSS/JS (GenUI) — one native iframe, a closed postMessage bridge, and a fail-closed never-paint law.
tier: container         # geometry.md Container/layout band — no control-height row; the frame's own
                         # block-size is content-driven (clamp() off the min/max size tokens), not a
                         # fixed control height (the card.md/theme-provider.md kin)
extends: UIElement      # a rendered-content-cell coordinator (the avatar.ts/bar-chart.ts shape) — NOT
                         # UIFormElement (no form value) and NOT UIContainerElement (no elevation/
                         # brightness surface axes; this control paints its OWN bespoke surface)
# marginal: not yet measured — B1 folder-only wave; the real `npm run size` figure lands with the
# barrel/component-styles.css/package.json exports integration slice (this same change).

attributes:             # attributes-as-API — mirrors sandbox-frame.ts `static props`
  - name: surfaceId
    type: string
    default: ''
    reflect: false      # NOT reflected — an opaque identifier, carried on the `action` event detail
                         # (SPEC-R8), never styled. Multi-word camelCase ⇒ the explicit kebab
                         # `attribute: surface-id` override (naming.md §3) lives in sandbox-frame.ts.
  - name: html
    type: string
    default: ''
    reflect: false      # NOT reflected — the GenuiEnvelope.html passthrough (SPEC-R2): one whole HTML
                         # document, applied atomically. An unbounded-size blob is never an HTML
                         # attribute in practice; oversize (> GENUI_MAX_HTML_BYTES, 512 KiB) is rejected
                         # whole at build time (SPEC-R2/R5 never-paint), never truncated-and-rendered.
  - name: csp
    type: json
    default: '{}'       # the LIVE default (SandboxFrameCspConfig, SPEC-R4 — every category absent,
                         # default-deny) prints as this literal via a non-enumerable toString override
                         # (sandbox-frame.ts's DEFAULT_CSP) — a bare `String({})` would print
                         # '[object Object]', which syntactically collides with this parser's inline
                         # `[a, b]` array detection and silently corrupts the parsed default; see
                         # sandbox-frame.ts's own comment for the full mechanics (incl. why the codec's
                         # `from(null)` returns `null` so the descriptor gate's `kindOf` classifier
                         # resolves this codec as `json`)
    reflect: false      # property-only (`attribute: false` in sandbox-frame.ts) — a security-relevant
                         # structured allow-list config is never HTML-attribute-fed

properties:             # IDL beyond attributes-as-API
  - name: droppedMessages
    description: The observable SPEC-R7 drop counter (a plain getter, not a reactive prop) — every out-of-vocabulary bridge message, a malformed payload, or a message from a foreign source increments this; never surfaced as a DOM event, never a throw (SPEC-N4).

events:
  - name: action
    detail: '{ surfaceId: string, name: string, payload?: unknown }'
    description: ADR-0153's seventh fleet event, reused verbatim (SPEC-R8) — fired when the frame's bootstrap-exposed `genui.action(name, payload)` posts a structurally valid `action` bridge message (`name` a non-empty string ≤ 128 chars; `payload` absent or JSON-serializable ≤ 16 KiB). Routing this event to a turn loop is a consumer's job (B2 — agent-admin's action→turn wiring), out of this control's own scope.

slots: []               # no light-DOM content model — render() stays the inherited no-op; the ONE child
                         # (the iframe, or the fallback affordance) is control-built (createElement +
                         # appendChild/remove), never author-slotted — the avatar.ts precedent

parts:
  - name: frame
    description: The control-built `<iframe data-part="frame" sandbox="allow-scripts" srcdoc="…">` — present only while a valid, contained envelope is rendering (SPEC-R3/R5). Exactly the sandbox token set `allow-scripts`; every excluded token (`allow-same-origin`/top-navigation/popups/forms/modals/downloads/…) stays excluded per the SPEC-R3 matrix. `srcdoc` carries the composed document: the SPEC-R4 meta-CSP, the SPEC-R6 token-bridge `<style>`, and the SPEC-R7 bootstrap `<script>`, each inserted ahead of the model's own `<head>` content.
  - name: fallback
    description: The control-built `<div data-part="fallback">` inert "Not rendered" affordance (SPEC-R5's fail-closed/never-paint law) — present whenever `html` is empty, oversize, the CSP config is malformed, the sandbox posture cannot be established, or `html` fails to compose into a srcdoc document. Mutually exclusive with `frame`.

customStates: []        # no :state() hooks — B1 has no interaction-state axis of its own (no hover/
                         # active/focus contract; the iframe owns its own internal focus/AX tree)

face:
  formAssociated: false  # not form-associated — carries no form value/validity

aria:
  role: none             # the host carries no role/aria-* of its own; the fallback affordance is plain
                          # visible text (no announcement machinery in B1) and the iframe's document owns
                          # its own accessibility tree once rendered
  roleSource: none
  labelSource: none

keyboard: []              # no keyboard contract of the HOST's own — a rendered iframe's document owns
                           # its own focus/keyboard behavior entirely (out of this control's reach by the
                           # sandbox boundary itself)

geometry:
  sizeClass: container
  blockSize: 'clamp(var(--ui-sandbox-frame-min-block-size), var(--content-height, var(--ui-sandbox-frame-min-block-size)), var(--ui-sandbox-frame-max-block-size))'
  note: "Content-driven auto-height (SPEC-R7's clamp law), not a fixed control-height row; --content-height is the JS-seam inline custom property (the --value-pct precedent) sandbox-frame.ts writes on a valid size-changed bridge message."

forcedColors: A `@media (forced-colors: active)` block repoints the frame border + fallback surface/ink to the WHCM system colors (CanvasText/Canvas) so the containment boundary and the fail-closed affordance both stay visible in high-contrast modes.
---

# ui-sandbox-frame

`ui-sandbox-frame` is the containment host for **GenUI** — free-form, agent-authored HTML/CSS/JS
rendered inside a sandboxed `<iframe>` (genui-surface SPEC §3.2/§3.3, PRD-D9). It wraps exactly ONE
native iframe, owns the sandbox attribute set, composes the meta-CSP + token-bridge + bootstrap into
the `srcdoc`, and takes a fail-closed **never-paint** path whenever containment cannot be proven.

```html
<ui-sandbox-frame></ui-sandbox-frame>
```

```js
const frame = document.querySelector('ui-sandbox-frame')
frame.surfaceId = 'surface-1'
frame.csp = { resourceDomains: ['https://images.example.com'] }
frame.html = '<!DOCTYPE html><html><body><h1>Hello from the model</h1></body></html>'
```

## Containment (SPEC-R3)

The iframe's `sandbox` attribute is **exactly** `allow-scripts` — no `allow-same-origin` (the one
permanently-closed row: with scripts enabled it would collapse the boundary), no top-navigation, no
popups, no forms, no modals, no downloads, no device/display capture. With `allow-same-origin` absent,
the srcdoc document gets a unique **opaque origin**: every same-origin check against the host fails by
construction, and storage APIs (`localStorage`, cookies, IndexedDB) deny.

## CSP (SPEC-R4)

`csp` accepts a `SandboxFrameCspConfig` carrying four allow-list categories — `connectDomains` →
`connect-src`, `resourceDomains` → `img-src`/`font-src`, `frameDomains` → `frame-src`/`child-src`,
`baseUriDomains` → `base-uri` — each **default-deny** when absent. Images/fonts always work via
`data:`/`blob:`; everything else needs an explicit, scheme-pinned `https://` entry. An invalid entry
(`http:`, a bare host, an over-broad wildcard) rejects the WHOLE config — the control never renders a
partial policy; it takes the never-paint path instead.

## The bridge (SPEC-R7/R8)

A CLOSED six-member vocabulary: `initialize · initialized · teardown · size-changed ·
host-context-changed · action`. The frame's bootstrap exposes exactly one model-facing API,
`genui.action(name, payload)`; a valid call re-emits the fleet's `action` CustomEvent with detail
`{ surfaceId, name, payload }`. Anything outside the vocabulary, malformed, or arriving from a source
other than this instance's own iframe is dropped and counted on `droppedMessages` — never surfaced as
an event, never a throw.

## Live theme (SPEC-R6)

The srcdoc's `:root` gets the host's active `--md-sys-*` custom properties + `color-scheme` at build
time. A frame that completed the `initialize` handshake receives `host-context-changed` on a live host
theme change (frame-internal state survives); a frame that never handshook falls back to a full srcdoc
rebuild (state is lost — the stated, accepted no-bridge cost).

## Fail-closed / never-paint (SPEC-R5)

Nothing paints when containment cannot be proven: an oversize `html` (> 512 KiB), a malformed CSP
config, an unestablishable sandbox posture, or an `html` that fails to compose into a srcdoc document.
The control shows its inert `[data-part="fallback"]` affordance instead — the turn's other channels are
unaffected.

## Catalog disposition

`ui-sandbox-frame` is **permanently excluded** from the A2UI default catalog (SPEC-N1, PRD-G4) — no
agent can compose it via A2UI; only `@agent-ui/app` composes it into the conversation feed (a future,
B2 wave).
