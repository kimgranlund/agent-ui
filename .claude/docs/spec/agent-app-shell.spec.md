# SPEC — Agent-App Shell (M1)

> Status: accepted · v1.0 · 2026-07-06 · Layer: SPEC (execution contract)
> Refines: [`../prd/agent-app-surfaces.prd.md`](../prd/agent-app-surfaces.prd.md) — **PRD-G2** (assemble the layout without bespoke CSS), **PRD-G6** (fleet DoD + layering), **PRD-G1** (down-payment via the re-host); realizes the ratified **PRD-D1** (app-shell anchor), **PRD-D3** (`@agent-ui/app` apex package + opt-in isolation), **PRD-D4/D5**.
> Refined by: `../lld/agent-app-shell.lld.md` (implementation). Decomposition: [`../decompositions/m1-app-shell.decomp.json`](../decompositions/m1-app-shell.decomp.json) (coverage-clean).
> Altitude: owns the **M1 behavior contract** — the package boundary, the `ui-app-shell` region/docking/responsiveness/isolation behavior, and the fleet-DoD gates. Internal build order + file map are the LLD's. This SPEC scopes **M1 only**; the conversation surface (PRD-G4), the canvas/surface-host (PRD-G3), and the tool-call surface (PRD-G5) are later milestones and out of this SPEC.
> Requirement IDs file-scoped (`SPEC-R1…`); cross-document references qualify by doc name.

---

## 1. Purpose

Define what the **`@agent-ui/app`** package is at M1 and how the **`ui-app-shell`** layout primitive behaves: it lets a developer assemble the persistent application chrome — the outer frame and its regions — by composing the shipped `@agent-ui/components` layout family, so the frame adapts to its own width and can be optionally isolated from a host page, **without authoring bespoke shell/layout CSS** (PRD-G2). M1 proves the tier's architecture (the apex-package boundary, the isolation decision) and pays down PRD-G1 by re-hosting the existing `a2ui-live` chrome on the primitive.

## 2. Definitions

- **`@agent-ui/app`** — the new apex package composing `@agent-ui/components` (+ `@agent-ui/a2ui` from M2). The top of the dependency DAG: `@agent-ui/shared ← components ← a2ui ← app` (and `app → components` directly).
- **App shell** — the `ui-app-shell` element: a structural (non-form-associated) `UIElement` that lays out named application **regions** and places docked surfaces into them.
- **Region** — a named landmark slot of the shell (banner · navigation · main · complementary · contentinfo), each carrying its ARIA landmark role via `ElementInternals`.
- **Docking** — assigning a light-DOM child of the shell to a target region.
- **Isolation mode** — an opt-in style-encapsulation boundary (a shadow root) around the shell; **off by default** (light-DOM), matching today's site shell.

---

## 3. Requirements

Normative per RFC 2119; each carries an ID, a PRD trace, and testable acceptance criteria. Behavior only — the region-realization mechanism (slots vs sub-elements), the docking attribute spelling, and the file map are the LLD's (open LLD forks are listed in the decomposition `.md`).

### 3.1 Package boundary

**SPEC-R1 — `@agent-ui/app` is the apex of the DAG, no cycle.** The package MUST declare runtime dependencies of **exactly** `{@agent-ui/components, @agent-ui/a2ui, @agent-ui/shared}` and MUST NOT be imported by any inward package (`components`, `a2ui`, `shared`, `reactive`/`dom`/`traits`/`controls`). No dependency cycle may exist. Strict decorator-free TS applies (`erasableSyntaxOnly`/`verbatimModuleSyntax`/`.ts`-extension local imports). *(→ PRD-G6, PRD-D3, PRD-D4)*
- **AC1** *Given* the `@agent-ui/app` package, *when* `app/src/layering.test.ts` runs, *then* every import under `app/src` resolves only to `{@agent-ui/components, @agent-ui/a2ui, @agent-ui/shared}` or a local `./` path, and the test goes RED under a planted upward/self `@agent-ui/app` import (negative control, unique token, grep-confirmed applied).
- **AC2** *Given* the whole repo, *when* grepped, *then* no source under `packages/agent-ui/components/src` or `/a2ui/src` imports `@agent-ui/app` (nothing inward imports the apex).

### 3.2 Composition & region model

**SPEC-R2 — The shell composes the fleet as light-DOM by default.** `ui-app-shell` MUST extend `UIElement` (structural, `formAssociated: false`), default to **light DOM**, and lay out its regions by composing the shipped `@agent-ui/components` layout family. It MUST import **only** the public `@agent-ui/components` barrel (no deep `packages/**/src` import). Its single `app-shell.css` MUST declare only `--ui-app-shell-*` custom properties in a `:where(ui-app-shell)` block and consume only its own + allow-listed shared tokens (the fleet single-file `@scope` convention, ADR-0003). *(→ PRD-G2, PRD-D1)*
- **AC1** *Given* `ui-app-shell`, *when* type-checked and imported, *then* `npm run check` exits 0 and a grep finds no deep `packages/**/src` import; the `:where()` token block declares only `--ui-app-shell-*`.

**SPEC-R3 — Named regions with landmark ARIA, presence-driven.** The shell MUST expose the named regions **banner · navigation · main · complementary · contentinfo** (`main` mandatory; the other four optional). Each present region MUST carry its ARIA landmark role via `ElementInternals` (never a host attribute), and an absent region MUST collapse — the layout is presence-driven (`:has()`-style), it does not reserve space for a region with no content. **Landmark override ([ADR-0083](../adr/0083-app-shell-region-role-decouple.md), ratified 2026-07-06):** `region` drives the column and the DEFAULT landmark; an OPTIONAL `landmark` prop (over the ARIA landmark set) overrides the ARIA role independently of the column — `internals.role = landmark || REGION_ROLE[region]` (`||`, not `??`: the unset prop value is `''`, which `??` would keep but `||` correctly falls through); an out-of-set `landmark` coerces to `''` and likewise falls through (never throws). *(→ PRD-G2)*
- **AC1** *Given* a shell with only `main` content, *when* rendered, *then* only the `main` region occupies space and no empty banner/nav/aside/footer band is visible (browser whole-shape).
- **AC2** *Given* a shell with a populated navigation region, *when* the accessibility tree is read, *then* that region exposes `role="navigation"` sourced from `internals`, and the host carries no `role`/`aria-*` attribute.
- **AC3** *(ADR-0083)* *Given* a region `region="navigation" landmark="complementary"`, *when* the AX tree is read, *then* it sits in the navigation column but exposes `role="complementary"`; *given* no `landmark`, *then* the role is `REGION_ROLE[region]` (back-compat); *given* an out-of-set `landmark`, *then* it coerces to the region default and does not throw.

**SPEC-R4 — Docking a surface to a region.** A light-DOM child of the shell MUST be placeable into a named region via a declared, typed assignment (the attribute/slot spelling is the LLD's; the contract is: a child names its target region and the shell renders it there). An unrecognized region name MUST be handled without throwing — the child renders in a defined default (the `main` region) and the condition is observable (not silently dropped). *(→ PRD-G2)*
- **AC1** *Given* a child assigned to `navigation`, *when* rendered, *then* it appears within the navigation region and nowhere else.
- **AC2** *Given* a child assigned to an unknown region, *when* rendered, *then* it appears in the `main` region (defined fallback) and the shell does not throw.

**SPEC-R5 — Intrinsic (container-query) responsiveness.** The shell MUST reflow to its **own container width** (container queries), NOT the viewport, and MUST NOT take breakpoint props. At or below a defined narrow threshold the side regions (navigation, complementary) MUST collapse to a single column. **Per-region collapse ([ADR-0084](../adr/0084-app-shell-narrow-reflow-collapse.md), ratified 2026-07-06):** the collapse is a **per-region opt-in** — `collapse: 'hide' | 'stack'`, default `hide` (the region `display:none`s when narrow; back-compat). `collapse="stack"` keeps the region **visible and stacked** into the single column so a primary-input side region (e.g. a chat composer) stays reachable narrow. The wide layout MUST be unchanged. (`toggle` is a RESERVED future value, not built at M1.) *(→ PRD-G2)*
- **AC1** *Given* the shell inside a resizable wrapper, *when* the **wrapper** (not the viewport) is narrowed below the threshold, *then* the side regions collapse and `main` retains the width, proven in **Chromium AND WebKit**; the assertion bites on a non-reflowing fixed layout (negative control).
- **AC2** *(ADR-0084)* *Given* a narrow container, *when* rendered, *then* a `collapse="stack"` side region stays **visible** (non-zero box) and stacks into the single column while a `collapse="hide"` (default) region is `display:none` — proven in **Chromium AND WebKit**; the assertion **bites** when the `collapse="stack"` rule is dropped (the region hides). *Given* a wide container, *then* the layout is identical regardless of `collapse` (no wide-layout effect).

### 3.3 Isolation

**SPEC-R6 — Opt-in style isolation, default light-DOM.** The shell MUST default to light DOM (byte-identical composition to the non-isolated build) and MUST offer an **opt-in** isolation mode that encapsulates its styles behind a shadow boundary. *(Mechanism ratified: [ADR-0082](../adr/0082-app-shell-per-instance-isolation.md) — per-instance `attachShadow` at connect + fleet CSS injected inside the boundary; the LLD-C5 owns the how.)* In isolation mode ALL THREE must hold on each target engine: **(a)** theme tokens (inherited custom properties from an ancestor `theme-provider`/`:root`) reach controls composed inside the shell — those controls render with correct geometry and colour; **(b)** those controls' own styles apply; **(c)** a host-page CSS rule targeting a composed control does NOT change its computed style (no inbound leak). If any leg is unmet on a target engine, the result MUST be **escalated to Kim with the browser-truth evidence** — the light-only-vs-isolation decision (PRD-D3) is resolved on evidence, never silently worked around. *(→ PRD-G2, PRD-D3)*
> **Where the cross-engine risk actually is (targets the AC2 browser legs).** Not `adoptedStyleSheets` support (broadly available, Safari 16.4+). The fragile surfaces, which the leg-(a)/(b) browser assertions MUST exercise, are: **(i)** `@scope (ui-{name})` (the fleet's styling mechanism, ADR-0003) evaluated inside a sheet **injected into the shadow root** (`@scope` shipped Safari 17.4; its in-shadow behaviour is the unknown), and **(ii)** re-derivation of the universal `*` dimension ramp (ADR-0007/0038) across the shadow boundary — the inherited `--ui-scale`/`--ui-density` re-substituting on shadow-tree elements so geometry matches the light-tree control. The LLD (LLD-C5) owns the delivery mechanism that makes these possible.
- **AC1** *Given* isolation **off** (default), *when* the shell renders, *then* it is light-DOM and its composed output is byte-identical to a shell built without the isolation code path.
- **AC2** *Given* isolation **on**, *when* a `ui-*` control is composed inside the shell under an ancestor `theme-provider`, *then* (a) the control's computed geometry + colour match the same control outside the shell [tokens pierced], and (b) the control's own styles are applied — proven in **Chromium AND WebKit**.
- **AC3** *Given* isolation **on** and a host-page rule `ui-button { color: red }`, *when* the shell's composed button is measured, *then* its computed `color` is unchanged [no inbound leak]; the assertion bites when isolation is off (negative control).
- **AC4** *Given* any isolation leg fails on a target engine, *when* M1 concludes, *then* an escalation note with the failing-leg browser evidence is filed for Kim and no leg is worked around.
- **AC5** *(isolated layout — closes the F1b gap)* *Given* isolation **on** with regions authored (`banner`/`navigation`/`main`/`complementary`/`contentinfo`), *when* rendered, *then* each region occupies its correct grid area (SPEC-R3's named layout holds under isolation, not just light-DOM) **and** narrowing the container below the threshold collapses the side regions (SPEC-R5's reflow fires under isolation) — proven in **Chromium AND WebKit**; the assertion **bites** when the `:host` grid variant is NOT injected into the shadow (the regions land un-placed) — the negative control that proves the F1b fix is load-bearing.

### 3.4 Fleet definition-of-done

**SPEC-R7 — The shell meets the standing component bar + forced-colors.** `ui-app-shell` MUST ship a `{name}.md` descriptor validating against the frontmatter schema (ADR-0004) with the contract↔props trip-wire green; MUST survive `forced-colors: active` (its chrome/dividers do not vanish); MUST pass an independent `component-reviewer` pass at **COMPOSE ≥4 AND REALIZE ≥4** before commit; and the package MUST carry a `npm run size` line-item within the budget set at M1 kickoff (provisional ≤ ~3 KB gz marginal), importing the shell dragging only it + composed real deps (tree-shake). *(→ PRD-G6)*
- **AC1** *Given* `app-shell.md`, *when* the contract↔props trip-wire runs, *then* it matches `finalize(UIAppShellElement)` exactly (green).
- **AC2** *Given* `forced-colors: active`, *when* the shell renders (browser), *then* its region structure remains legible (no ink vanish).
- **AC3** *Given* the finished element, *when* `component-reviewer` scores it, *then* both axes ≥4 with zero blockers, recorded BEFORE the M1 commit.
- **AC4** *Given* `npm run size`, *when* run, *then* an `@agent-ui/app` line-item reports within budget and a tree-shake probe shows importing the shell drags only it + composed real deps; a planted over-budget number fails the gate (negative control).

### 3.5 The reference-app down-payment

**SPEC-R8 — `a2ui-live`'s OWN chrome re-hosted on the shell.** The `site/pages/a2ui-live` chrome MUST be re-expressed on `ui-app-shell`, with **`site/pages/a2ui-live.css`'s bespoke shell/layout rules removed**, proving the primitive replaces hand-built chrome (the PRD-G1 M1 down-payment). The rendered `[chat | canvas]` layout MUST be unchanged. **The shared `site/pages/_page.css` shell (`.app-shell` grid, loaded by every site page) is OUT of scope** — migrating it onto `ui-app-shell` is cross-page work risking every page and is DEFERRED to a later wave (its `_page.ts` SHELL NOTE already names that deferred trigger). M1 edits only a2ui-live's own page chrome. *(→ PRD-G1)*
- **AC1** *Given* the re-hosted page, *when* `npm run check` (+ `check:site`), `npm run build`, `npm test`, and `npm run test:browser` run, *then* all exit 0/green — and `site/pages/_page.css` is unmodified (`git diff` shows no change to it).
- **AC2** *Given* the change, *when* `git diff --stat` is read, *then* net bespoke-chrome LOC on **a2ui-live's own** chrome is **negative** (CSS removed from `a2ui-live.css` exceeds CSS added).
- **AC3** *Given* the re-hosted page in the browser, *when* compared to the pre-re-host snapshot, *then* the `[chat | canvas]` layout renders unchanged, and no OTHER site page regresses (the shared shell untouched).
- **AC4** *(ADR-0083 + ADR-0084 — the a2ui-live rework, sequenced after the C3/C4 props land)* *Given* the composer region authored `region="navigation" landmark="complementary" collapse="stack"`, *when* the AX tree is read, *then* the composer's landmark is `complementary` (not `navigation`); *and when* the container is narrowed below the threshold, *then* the composer stays **visible and interactive** (does not vanish), proven **Chromium AND WebKit**.

---

## 4. Typed contracts (behavioral — signatures illustrative; internals are the LLD's)

The precise props are the LLD's to finalize (and the region/docking-mechanism forks in the decomposition `.md` gate the shapes below). The M1 public surface is bounded to:

```ts
// ui-app-shell — structural UIElement (formAssociated: false)
interface UIAppShellElement {
  // opt-in isolation (SPEC-R6). Default off (light-DOM). Mechanism RATIFIED: per-instance
  // attachShadow at connect + fleet CSS injected inside the boundary (ADR-0082 — NOT the
  // class-level `static shadow` seam, which cannot express per-instance opt-in). Connect-time only.
  isolated: boolean          // reflected; default false
}
// ui-app-shell-region — RATIFIED generic region element (Kim 2026-07-05); docking = composition.
interface UIAppShellRegionElement {
  region: 'banner'|'navigation'|'main'|'complementary'|'contentinfo'   // reflected; drives column + default landmark
  // ADR-0083: ARIA landmark override, decoupled from the column. absent ('') ⇒ REGION_ROLE[region] (|| not ??).
  landmark?: 'banner'|'navigation'|'main'|'complementary'|'contentinfo'|'region'|'form'|'search'
  // ADR-0084: narrow-reflow behaviour. default 'hide' (display:none narrow); 'stack' stays visible.
  collapse: 'hide'|'stack'   // 'toggle' reserved (future stateful affordance, not M1)
}
```

- **Events:** none required at M1 (structural layout). A side-region collapse/expand toggle, if introduced by the narrow-container rule (SPEC-R5), emits only an allow-listed simple name (`toggle`) — decided in the LLD.
- **No native form elements; ARIA via `ElementInternals` only** (CLAUDE.md invariants; SPEC-R3 AC2).

## 5. Non-functionals

- **Cross-engine truth (gate):** SPEC-R3/R5/R6/R7 browser assertions pass in **Chromium AND WebKit** (the fleet whole-shape discipline).
- **Budget (gate):** the `@agent-ui/app` marginal size line-item within the M1-kickoff budget (SPEC-R7 AC4).
- **Layering (gate):** SPEC-R1's no-cycle/apex-un-imported invariants hold as a standing trip-wire.

## 6. Traceability (this SPEC → PRD)

| SPEC-R | Requirement | Traces to |
|---|---|---|
| SPEC-R1 | apex package boundary, no cycle | PRD-G6 · PRD-D3/D4 |
| SPEC-R2 | light-DOM composition of the fleet | PRD-G2 · PRD-D1 |
| SPEC-R3 | named regions + landmark ARIA, presence-driven | PRD-G2 |
| SPEC-R4 | docking a surface to a region | PRD-G2 |
| SPEC-R5 | intrinsic container-query responsiveness | PRD-G2 |
| SPEC-R6 | opt-in isolation (3-leg), escalate-on-fail | PRD-G2 · PRD-D3 |
| SPEC-R7 | fleet DoD + forced-colors + budget | PRD-G6 |
| SPEC-R8 | a2ui-live re-host, bespoke chrome removed | PRD-G1 |

_All eight requirements trace to a ratified PRD goal; every PRD-G served at M1 (G1 down-payment · G2 · G6) is covered. The M2/M3 goals (G3/G4/G5) are deliberately out of this SPEC._
