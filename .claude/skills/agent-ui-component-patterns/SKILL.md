---
name: agent-ui-component-patterns
description: >-
  Route to the fleet's PRIOR-ART map: the settled mechanisms a new or novel ui-* component
  should reuse instead of reinventing — overlay/dismissal, container box-model, value codecs,
  provider/context, field labelling, focus-preserving reorder, swappable packs, z-scoping,
  catalog exclusion, adopt-or-create declarative children, derived-never-hand-listed maps,
  opt-in progressive-enhancement seams, first-paint-vs-re-render detection. Use when
  designing anything and asking "has the fleet solved this before" — a floating panel, a
  formatted value, cross-component context, a lazy-loaded heavy subtree, an imperative +
  declarative dual contract. One routing sentence + the owning ADR per pattern; the mechanism lives in
  the ADR and its realized source (cite, never copy). NOT for the normative law layer
  (agent-ui-component-standards) or the build procedure (agent-ui-component-create).
user-invocable: false
disable-model-invocation: false
---

# Component patterns — the prior-art map

Before designing a mechanism, sweep this table. Each row: the problem shape → the fleet's
mechanism → the owning ADR (rationale; status noted where not yet ratified) and its realized
home (the working code). Reusing a row is the default; deviating from one is an ADR-worthy
fork, not a local choice.

| Problem shape | The fleet's mechanism | ADR · realized home |
|---|---|---|
| Reusable behaviour shared across controls | a **trait**: a free `(host, opts) => cleanup` function called from `connected()` — no registry, no decorators, no `host.use()` | foundational (plan §5 + the `traits/index.ts` header; earliest trait decision ADR-0010) · `packages/agent-ui/components/src/traits/` |
| Shared value-control base plumbing across a control family | the **`controls/_base/`** widget value-control bases (a sub-layer, deliberately NOT traits — the ADR argues why) | ADR-0042 · `packages/agent-ui/components/src/controls/_base/` |
| A floating panel anchored to a trigger (menu, select, tooltip, combo-box) | the **Overlay controller** + platform-owned dismissal (Escape/outside-click are the platform's; anchor focus-restore; `:popover-open`-resilient close) | ADR-0043 + ADR-0045 · `traits/overlay*`, patterned in `controls/select/`, `controls/menu/` |
| Consistent padding/gaps/sticky regions inside any container surface | the shared **`[data-box]` container box-model** (one spacing layer, nested content levels, adjacent-sibling content gap) | ADR-0046 · `controls/_surface/container-box.css` |
| A container stacking its own children sanely under overlays | **a container is its own z-depth scope** (`isolation: isolate` on `[data-box]`) | ADR-0052 · `controls/_surface/container-box.css` |
| A typed value with a formatted editing surface (currency, unit, percent, date, time) | a **value codec** per `type` (parse/format/step/validity, per-type `AbortSignal`) | ADR-0047 (numeric family) + ADR-0048 (date/time) · `traits/value-codec.ts` + `controls/text-field/` |
| A heavy sub-component only some usages need | **lazy `import()` at the interaction point** so tree-shaking holds (calendar into the text-field overlay) | ADR-0048 · `controls/text-field/` |
| One component needs to know about many descendants (form ⇄ fields) | **connect-time registration event + reactive registry** — the provider/context primitive; guard work on the CONNECTION signal (the bulk-insert cascade lesson) | ADR-0050 · `traits/form-registry.ts` + `controls/form-provider/` |
| A wrapper labels/describes a control it doesn't own | the **field-labelling seam** (`setFieldLabelling`/`applyFieldLabelling`, `formUserInvalid`, reactive error rendering) | ADR-0051 · `controls/field/` + `dom/` |
| Reordering children without losing focus | **`ChildPart.moveBefore`** over native `Node.prototype.moveBefore` — only the native call preserves focus; the seam upgrade is gated | ADR-0022 · `dom/` (repeat) |
| Imperative composition into a template-rendered tree | the public **`mount()` directive-host seam** | ADR-0023 · `dom/` |
| A swappable asset/provider family (icon packs) | **pure core + subpath adapters** in a zero-dep leaf package (default pack vendored at build time as inert TS) | ADR-0065 + ADR-0066 · `packages/agent-ui/icons/` |
| A component that must NEVER be agent-emittable (page/app-owner chrome) | the a2ui **`EXCLUSION_ALLOWLIST`** — a permanent, tested catalog exclusion | ADR-0112 cl.6 (Toast/ToastRegion reasoning), applied by ADR-0117 (ThemeProvider) · `packages/agent-ui/a2ui/src/catalog/default/index.test.ts` |
| Nesting a SHIPPED control whose connect-time child-move relocates your parts (modal, select, combo-box panels) | the ORDERING constraint: the nested control moves light-DOM children at ITS connect — compose parts before/after that move deliberately, never assume your DOM order survives (the same shape as lazy-import-into-overlay) | ADR-0017 (the child-move pattern) + ADR-0048 (lazy calendar into the overlay) · `controls/modal/`, `controls/combo-box/` — the command-modal intake's recorded footgun |
| A multi-column grid whose columns are POPULATED CONDITIONALLY by props (a card row with an optional action) | pin every fixed-role part to an EXPLICIT `grid-column` — auto-placement is only safe when every child is always present (the phantom-track defect; the measured detail lives in the cited ticket) | TKT-0014 (the toast dismiss-X proof: an 8px mis-inset exactly equal to the column gap) · `controls/toast/toast.css` |
| Ambient theming context (scheme/scale/density) over a subtree | **`ui-theme-provider`** — reflected props re-rooting `color-scheme`; unset means inherit-ambient, never a forced default | ADR-0117 · `controls/theme-provider/` |
| A component-owned SCROLL REGION that must survive disconnect/reconnect | the parts-once `#built` guard alone is NOT enough — pair it with a **live scroll-listener shadow** restored synchronously in `connected()` (engines reset a removed scroll container's offsets; the mechanism detail lives in the cited ticket + probe) | TKT-0067 (measured 40 → 0 in Chromium AND WebKit with identical-node reattach) · `controls/table/table.ts` + the reconnect probe in `table.browser.test.ts` |
| A component with BOTH an imperative API and declarative light-DOM children | **adopt-if-authored-else-create**: `connected()` looks up `:scope >` recognized children and seats whichever exist, else creates the SAME element internally — every method already writes through the seated reference, so the imperative API gains ZERO mode branches (identity under both paths is structural, not promised); NEVER a second imperative surface on the adopted child (engine duplication is the exact two-implementations failure ADR-0129 cl.4 exists to prevent). Third independent instance of the consumer-authors-a-child seam: TKT-0056/0058's composer extraction → GH #666's `setEmptyState` + SPEC-R12's `setContentRenderer` → this contract | ADR-0180 (cl.2/cl.4) · `packages/agent-ui/app/src/controls/conversation/` |
| A second lookup/map must exist over an already-canonical key set | **derive it from the canonical constants, never hand-list a parallel table** — a pure function/spread over the constants the first consumer already reads, pinned TOTAL over the key set and parity-gated against the real DOM/data by its own suite; fail-closed on an unmapped key (no reaction, never a throw). Two hand-maintained enumerations of one truth is the GH #406 silent-divergence class — hit twice, by name: the `persona-patch.ts` hoisting, then `field-location.ts` citing it as precedent | ADR-0181 cl.4 · `controls/agent-admin/persona-patch.ts` + `controls/agent-admin/field-location.ts` (`@agent-ui/app`; the totality gate in `field-location.test.ts`) |
| An OPTIONAL browser API several surfaces want, progressive-enhancement-only (View Transitions) | **ONE shared seam in `components/dom`** — the one home every same-document surface can import without a layering violation: `withViewTransition(mutate, enabled)` + `viewTransitionAvailable()` run the mutate inside the API iff enabled AND the API exists AND `prefers-reduced-motion` is unset, synchronously otherwise; each surface wraps its own swap site behind a **default-`false` boolean prop**, byte-identical when unset. The stated caveat: the transition path runs `mutate` ASYNC (the platform snapshots first) — staleness guards re-check INSIDE the mutate | ADR-0183 · `dom/view-transition.ts`, opted in by `ui-router-outlet`, `ui-super-shell`, `ui-surface-host` |
| A streaming, incrementally-painted host must tell FIRST PAINT from a RE-RENDER (animate one, never strobe the other) | the host's OWN **settled-once boundary**: the first `finalize()` marks the host settled — every `ingest()` before it is first-paint streaming (never transitions), every one after is a re-render (transition-eligible); a reset flips the flag back so a rebuilt surface streams as a first paint again. Burst coalescing is the platform's own update-callback queue, relied on deliberately (at most ~one visible cross-fade per burst, FIFO, no line lost) | ADR-0183 Amendment (GH #742) · `controls/surface-host/surface-host.ts` (`@agent-ui/app`; the `#settledOnce` flag) |

## How to use a row

1. Read the ADR (the rationale + the forks it settled) — `.claude/docs/adr/README.md` is the
   index with per-ADR consequence trails.
2. Read the realized home end-to-end — the code is the resolved shape, the ADR is why.
3. If your case doesn't fit the row's stated scope, that's a **fork**: name it in the intake
   ([[agent-ui-component-design]]), don't quietly stretch the mechanism.

## Cross-links

The law layer (anatomy/geometry/states/tokens) → [[agent-ui-component-standards]] · packaging
→ [[agent-ui-component-packaging]] · the test bar → [[agent-ui-component-testing]] · the
intake procedure that runs this sweep → [[agent-ui-component-design]].
