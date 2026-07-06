# ADR-0082 — the app-shell's per-instance style isolation (shadow at connect + fleet CSS injected inside the boundary)

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-07-05
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-07-05 |
> | **Proposed by** | planner — the M1 app-shell LLD (SPEC-R6 isolation), after the doc-review's F1/F2/F3 corrections to the mechanism |
> | **Ratified by** | Kim — 2026-07-05 |
> | **Repairs** | `agent-app-surfaces.prd.md` PRD-D3 / Fork-3 (the "first `static shadow` consumer" phrasing) · `plan.md` §5 (the class-level `static shadow` model) · `plan.md` §12 (the isolation-boundary revisit note) · SPEC-R6 (`spec/agent-app-shell.spec.md`) · LLD-C4/C5 (`lld/agent-app-shell.lld.md`) — all edited in this change |
> | **Supersedes / Superseded by** | Supersedes the class-level `static shadow` model of plan §5 **for the app-shell's per-instance opt-in** (plan §5/§12 are plan docs, not ADRs — repaired via `Repairs:`, not a reciprocal ADR link). Relates ADR-0003 (single-file `@scope` CSS barrels) · ADR-0007/0038 (the `*` derived ramp). No ADR superseded. |

## Context

SPEC-R6 (PRD-D3, ratified) requires the `ui-app-shell` to offer **opt-in** style isolation from a host page — default light-DOM, opt-in encapsulated — with three legs holding cross-engine: theme tokens still reach composed controls (a), those controls style correctly (b), host CSS does not leak in (c). The M1 LLD's first mechanism could not satisfy this, and the doc-review caught it:

- **plan §5's `static shadow`** — the reserved seam — is a **class-level, all-or-nothing** flag read in the base `UIElement` constructor (`dom/element.ts:47`). It cannot express a **per-instance** opt-in (one shell isolated, another not).
- **`shadowRoot.adoptedStyleSheets` fed the barrel text cannot work.** `component-styles.css`/`foundation-styles.css` are pure-CSS `@import` barrels delivered by `<link>`, never injected from JS (ADR-0003); a constructable `CSSStyleSheet` built via `replaceSync(barrelText)` **silently ignores `@import`** → an empty sheet. It also omits the universal `*` dimension ramp (ADR-0007/0038), which a **document** `*` rule cannot apply to **shadow-tree** elements — so composed controls inside the shadow would render with no geometry (leg a fails).
- **Slotting the controls** (leaving them light, `<slot>`-projected) defeats leg (c): slotted content stays in the document tree, so a host `ui-button {…}` rule still reaches it.
- The shell's **own** region-grid CSS is a document `@scope (ui-app-shell)` sheet; it does not cross into the shadow, so relocated in-shadow regions would lose their `grid-area` placement + `@container` reflow (SPEC-R3/R5 silently break under isolation) — the F1b gap.

The isolation boundary is the tier's primary M1 risk; the mechanism must be recorded correctly before it is built, else the build inherits a recipe that cannot work.

## Decision

We will isolate the app-shell **per instance**, at connect, and **inject the fleet CSS inside the boundary** — not via `static shadow`, not via `adoptedStyleSheets(barrelText)`:

1. **`isolated`** is a reflected boolean prop, default `false` (light-DOM, byte-identical to the non-isolated build). When `true`, `ui-app-shell` overrides `connectedCallback`: `if (this.isolated && !this.shadowRoot) this.attachShadow({ mode:'open' })` (the guard makes re-connect safe; a shadow root cannot be detached), **before** `super.connectedCallback()` resolves `renderRoot` (`shadowRoot ?? this`, `element.ts:185`).
2. **Inject the fleet stylesheets INTO the shadow root** — `<style>@import url(foundation-styles.css); @import url(component-styles.css)</style>` (or equivalent `<link>` nodes; a build-flattened constructable sheet is an acceptable equivalent). `foundation-styles` is **included** so the universal `*` ramp re-matches shadow-tree elements and re-substitutes the `--ui-scale`/`--ui-density` inherited through the boundary; the `@scope (ui-{name})` control sheets style the in-shadow controls.
3. **Relocate** the authored `<ui-app-shell-region>` children into the shadow tree (not slotted), so a host rule cannot reach them (leg c).
4. **Inject a `:host`-shaped grid variant** into the shadow (the F1b fix) — inside a shadow the host is `:host`, not `:scope`/`ui-app-shell` — mirroring LLD-C4's region `grid-area` placement + `@container` narrow rules onto `:host > ui-app-shell-region[region=…]`, so the relocated regions keep their named layout + reflow. This variant lives in the **C5 isolation slice**, NOT the base `app-shell.css` (LLD-C4 unchanged; a non-isolation builder is unaffected).

The owning docs are repaired by ID: SPEC-R6 states the behaviour (now with the AC5 isolated-layout leg); LLD-C4/C5 hold the mechanism; plan §5/§12 and PRD-D3/Fork-3 are corrected to point here for the app-shell's isolation.

## Consequences

- **The reserved `static shadow` seam stays unused** — the app-shell does not become its first consumer (PRD-D3/Fork-3's earlier phrasing is now wrong and is repaired here). `static shadow` remains available for a genuine all-instances-shadow class later.
- **A new element-code shape:** `ui-app-shell` attaches its shadow at **connect**, diverging from the base's **constructor** attach. This is a documented, localized divergence (one override), not a base-class change — the base is untouched.
- **`isolated` is connect-time only, not reactive.** A shadow root cannot be detached; toggling `isolated` after connect logs a dev warning and takes effect on re-connect. Accepted (isolation is a mount-time app decision, not a runtime toggle).
- **Static-composition scope at M1.** Only children present at connect are relocated into the shadow; dynamically appending a region to an isolated shell after connect lands it in light DOM. Documented M1 limit; a MutationObserver/slot strategy is an M2 concern.
- **The cross-engine risk is real and gated, not assumed.** The genuinely-unproven surfaces are `@scope` evaluated inside a shadow-injected sheet (Safari 17.4) and the `*`-ramp custom-property re-derivation across the boundary — NOT `adoptedStyleSheets` support (broadly available). SPEC-R6's browser legs (Chromium AND WebKit) target these; **if any leg fails cross-engine, light-only ships and the decision returns to Kim with evidence** (PRD-D3's escalation path) — this ADR ratifies the *mechanism*, the browser gate ratifies its *realization*.
- **Slight duplication:** the `:host{display:grid…}` mirror overlaps the document `@scope`/`:scope` host rule (the host is in the light tree); harmless (same values), kept for shadow self-containment.

## Alternatives considered

- **Class-level `static shadow` (plan §5, the reserved seam)** — rejected: all-or-nothing per class, cannot express per-instance opt-in (SPEC-R6 requires default-off + per-instance on).
- **`shadowRoot.adoptedStyleSheets` = `new CSSStyleSheet().replaceSync(barrelText)`** — rejected: constructable sheets ignore `@import`, so the barrel yields an empty sheet; and it omits the `*` ramp (document-`*` doesn't reach shadow-tree elements) → composed controls unstyled.
- **Leave controls light / `<slot>`-projected** — rejected: slotted content stays in the document tree, so host CSS still reaches it (leg c fails) — that is not isolation.
- **Keep the region grid only as the document `@scope` sheet** — rejected (the F1b gap): a document sheet does not style relocated in-shadow regions, so `grid-area`/reflow break under isolation; the `:host` variant must be injected inside the boundary.
