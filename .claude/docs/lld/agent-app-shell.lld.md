# LLD — Agent-App Shell (M1)

> Status: accepted · v1.0 · 2026-07-06 · Layer: LLD (implementation plan)
> Implements: [`../spec/agent-app-shell.spec.md`](../spec/agent-app-shell.spec.md) (`SPEC-R1…R8`). Refines PRD-D1/D3/D4/D5 (ratified).
> Decomposition: [`../decompositions/m1-app-shell.decomp.json`](../decompositions/m1-app-shell.decomp.json) (coverage-clean; nodes n1a…n4b ≈ the components below). Build-order edges are the decomposition's.
> Altitude: owns **how M1 is built** — file map, concrete interfaces, per-component failure/edge handling, and the build sequence. Behavior is the SPEC's; this doc never re-derives it. **Open forks that need Kim/an ADR are called out in §7 — this LLD recommends but does not self-ratify them.**

## 1. Component map (LLD-C# → SPEC-R#, → decomp node)

| LLD-C | Component | Files | Implements | Decomp |
|---|---|---|---|---|
| **LLD-C1** | `@agent-ui/app` package skeleton | `packages/agent-ui/app/{package.json,tsconfig.json,src/index.ts}` + root workspace | SPEC-R1 | n1a |
| **LLD-C2** | layering trip-wire | `app/src/layering.test.ts` | SPEC-R1 | n1b |
| **LLD-C3** | `ui-app-shell` + `ui-app-shell-region` behavior | `app/src/controls/app-shell/app-shell.ts` | SPEC-R2, R3, R4 | n2a |
| **LLD-C4** | shell CSS (region grid · container-query reflow · forced-colors) | `.../app-shell/app-shell.css` | SPEC-R2, R3, R5, R7 | n2a |
| **LLD-C5** | opt-in isolation mode | `.../app-shell/app-shell.ts` (isolation path) | SPEC-R6 | n2c |
| **LLD-C6** | descriptor + contract↔props | `.../app-shell/app-shell.md` (+ `app-shell-region.md`) | SPEC-R7 | n2a |
| **LLD-C7** | gates (jsdom + cross-engine browser) | `.../app-shell/app-shell.test.ts` · `app-shell.browser.test.ts` · `app-shell-isolation.browser.test.ts` | SPEC-R3, R5, R6, R7 | n2b, n2c |
| **LLD-C8** | public barrel + size line-item | `app/src/index.ts` · `scripts/measure-size.mjs` | SPEC-R1, R7 | n4a |
| **LLD-C9** | `a2ui-live` re-host (reference app) | `site/pages/a2ui-live.{ts,css}` · `site/pages/_page.css` | SPEC-R8 | n3a |

No orphan components (each traces to a SPEC-R); no SPEC-R without a component.

## 2. LLD-C1 — package skeleton (→ SPEC-R1)

`packages/agent-ui/app/package.json`:
```jsonc
{
  "name": "@agent-ui/app",
  "type": "module",
  "exports": { ".": "./src/index.ts", "./app-shell": "./src/controls/app-shell/app-shell.ts" },
  "dependencies": {
    "@agent-ui/components": "*",
    "@agent-ui/a2ui": "*",        // declared now for M2's canvas-host; UNEXERCISED at M1 (fork §7.4)
    "@agent-ui/shared": "*"
  }
}
```
`tsconfig.json` extends the repo base (strict, `erasableSyntaxOnly`, `verbatimModuleSyntax`, `allowImportingTsExtensions`). `src/index.ts` re-exports the shell (LLD-C8). Add `packages/agent-ui/app` to the root workspace list.

**Failure/edge handling.**
- *Name collision* — if `@agent-ui/app` already resolves elsewhere, `npm run check` errors at install; verify the name is free before scaffolding.
- *Unexercised `a2ui` dep* — declaring `a2ui` with no import is legal; the layering test (LLD-C2) permits-but-does-not-require it. If a linter flags the unused dep, suppress with a comment citing the M2 canvas-host, don't drop the dep.
- *Emit posture* — exports point at `.ts` source (emit-ready, mirroring the components ADR-0080 pattern); the `dist/` flip is deferred with the rest of the fleet (plan §12 F2a).

**Checkpoint:** `npm run check` exits 0 with the package resolving; no other package.json changed.

## 3. LLD-C2 — layering trip-wire (→ SPEC-R1)

`app/src/layering.test.ts` scans every import specifier under `app/src/**` and asserts each resolves to `@agent-ui/{components,a2ui,shared}` or a local `./`/`../` path; asserts (via a repo grep) that no source under `components/src` or `a2ui/src` imports `@agent-ui/app`. Mirrors `packages/agent-ui/components/src/layering.test.ts`.

**Failure/edge handling.**
- *Negative control (required)* — plant, on a UNIQUE token (e.g. a fresh `import { badge } from '@agent-ui/app'` inside `a2ui/src`), an upward/self import; grep-confirm it applied; the test MUST go red. Remove after proving it bites.
- *Dynamic-`import()` blind spot* — the static `from ['"]`-regex approach is blind to `import()` (the same pre-existing gap as `components/layering.test.ts`). No dynamic imports exist under `app/src` today; document the blind spot in the test header, do not pretend coverage.
- *Empty package* — at the moment C2 lands (before C3), the scan sees only the barrel; the gate is still valid and re-runs as the element lands.

**Checkpoint:** `npm test` includes `app/src/layering.test.ts` green; the NC bit and was reverted.

## 4. LLD-C3 — `ui-app-shell` + `ui-app-shell-region` (→ SPEC-R2, R3, R4)

**Region model — RATIFIED generic (Kim, 2026-07-05; decomp fork #1+#2; the honest counter-argument stands recorded in §7.1).** Two elements:
- `ui-app-shell` — the grid container (`extends UIElement`, `formAssociated:false`, light-DOM default). Presence-driven CSS grid (`:has()`), no props required beyond `isolated` (LLD-C5).
- `ui-app-shell-region` — a **generic** region element. `region` (reflected literal-union `'banner'|'navigation'|'main'|'complementary'|'contentinfo'`) drives the grid column/area (`ui-app-shell-region[region=navigation] { grid-area: nav }`) **and** the DEFAULT ARIA landmark role, set via its OWN `ElementInternals` (SPEC-R3 AC2 — never a host attribute). **Landmark override ([ADR-0083](../adr/0083-app-shell-region-role-decouple.md), ratified 2026-07-06):** an OPTIONAL `landmark` prop overrides the ARIA role independently of the column (`internals.role = landmark || REGION_ROLE[region]`), so the author can pick the column via `region` and the landmark separately.

This collapses docking (SPEC-R4) into composition: the developer authors `<ui-app-shell-region region="navigation">…</ui-app-shell-region>` as children — a child "names its target region" via the sub-element's own prop, no attribute-on-arbitrary-child mechanism needed.

> **The honest counter-argument, recorded (weighed and lost, Kim 2026-07-05).** The fleet's own region family,
> `ui-card`, uses **named sub-elements** (`ui-card-header` / `-content` / `-footer` — real files), NOT a generic
> `[region=]` element — so the CONSISTENCY argument favoured five named `ui-app-shell-{region}` tags. Kim
> ratified the **generic** element anyway: agent/a2ui data-targetability of a single `[region]`/`[landmark]`
> attribute + fewer tags / one descriptor outweighed consistency. (Vindication note: the ADR-0083 landmark
> decouple below is only *possible* because the region is generic — named sub-elements would have baked the
> landmark into the tag.) (There is no region-architecture precedent ADR; the earlier ADR-0015 cite was wrong
> — that ADR is the container *token* model.)

```ts
const shellProps = { isolated: prop.boolean(false) } satisfies PropsSchema      // reflected; connect-time only (LLD-C5)
const regionProps = {
  region  : prop.enum(['banner','navigation','main','complementary','contentinfo'], 'main'),
  // ADR-0083: optional ARIA-landmark override, decoupled from the column. '' = use the region default.
  landmark: prop.enum(['','banner','navigation','main','complementary','contentinfo','region','form','search'], ''),
  // ADR-0084: narrow-reflow behaviour. 'hide' = display:none (default); 'stack' = stay visible + stack.
  collapse: prop.enum(['hide','stack'], 'hide'),   // 'toggle' RESERVED (future stateful affordance, not M1)
} satisfies PropsSchema
const REGION_ROLE = { banner:'banner', navigation:'navigation', main:'main',
  complementary:'complementary', contentinfo:'contentinfo' } as const           // region → DEFAULT ARIA landmark
// role resolution (ADR-0083): internals.role = this.landmark || REGION_ROLE[this.region]
```

**Failure/edge handling.**
- *Unknown `region` value* (SPEC-R4 AC2) — the reflected `enum` prop coerces an out-of-set value to the default `main`; the region renders in the `main` grid-area and the element does not throw. (The renderer-enum-honoring precedent, ADR-0076, applies to any a2ui-driven case at M2.)
- *`landmark` override (ADR-0083)* — absent/`''` ⇒ role defaults to `REGION_ROLE[region]` (back-compat). An out-of-set `landmark` coerces to the default via the same enum precedent (never throws). **Author responsibility:** exactly one `main` landmark per document — `landmark="main"` on a second region yields a duplicate-`main` AX tree (an author error the platform surfaces), the same responsibility the region model already carries; the generic element cannot prevent it cross-instance. Documented.
- *`ui-app-shell-region` used outside a shell* — it still sets its landmark role via internals and renders its content as a plain block (no grid parent → no grid-area effect). Degrades gracefully; documented.
- *Empty shell* (no region children) — the grid collapses to zero tracks; nothing renders. `main` is not auto-injected (SPEC-R3 makes `main` mandatory as a CONTENT contract, not an auto-created empty band); a shell with no `main` region is a developer error surfaced by a dev-time console warning, not a thrown error.
- *Duplicate regions* (two `navigation`) — both land in the same grid-area (stacked); allowed, documented (the developer composed it).
- *Deep-import guard* — `app-shell.ts` imports only the public `@agent-ui/components` barrel; the layering test (C2) + a grep in the C3 accept guard this.

**Checkpoint:** `npm run check` 0; the contract↔props trip-wire (C6) green.

## 5. LLD-C4 — shell CSS (→ SPEC-R2, R3, R5, R7)

Single `app-shell.css`, two sectioned blocks (ADR-0003): a `:where(ui-app-shell)` token block declaring only `--ui-app-shell-*`, then `@scope (ui-app-shell)`. The region grid is presence-driven:

```css
@scope (ui-app-shell) {
  :scope {
    display: grid;
    grid-template:
      "banner banner banner" auto
      "nav    main   aside " 1fr
      "footer footer footer" auto / auto 1fr auto;
    container-type: inline-size;                 /* SPEC-R5: reflow on OWN width */
  }
  @container (inline-size < 40rem) {             /* narrow rule — side regions yield to main */
    :scope { grid-template: "banner" auto "main" 1fr "footer" auto / 1fr; grid-auto-flow: row; }
    /* default collapse=hide: side regions disappear when narrow */
    :scope > ui-app-shell-region[region="navigation"],
    :scope > ui-app-shell-region[region="complementary"] { display: none; }
    /* ADR-0084 collapse=stack: the region stays visible + stacks full-width into the single column (DOM order);
       inline-size:auto + margin-inline:0 neutralize an explicit region width so grid-stretch wins (ADR-0084 refinement 2026-07-06) */
    :scope > ui-app-shell-region[collapse="stack"] { display: block; grid-column: 1 / -1; grid-row: auto; inline-size: auto; margin-inline: 0; }
  }
}
```
**Narrow-reflow strategy ([ADR-0084](../adr/0084-app-shell-narrow-reflow-collapse.md), ratified 2026-07-06).** `ui-app-shell-region` gains a reflected `collapse: 'hide' | 'stack'` prop, default `hide` (today's `display:none`, back-compat). `collapse="stack"` keeps the region reachable when narrow — it stacks full-width into the single-column auto-flow (author controls order via DOM order); the rule also zeroes any explicit region width + inline margins (`inline-size: auto; margin-inline: 0`) so a consumer's fixed wide-sidebar width can't defeat the grid-stretch span (ADR-0084 refinement 2026-07-06; a `max/min-inline-size` cap still needs the consumer's own narrow override). `toggle` is a RESERVED future value (a stateful collapse-behind-an-affordance emitting `toggle`, SPEC §4 — not built at M1). The wide layout is unchanged (the prop only touches the `@container` branch). This resolves LLD §7.5's reserved item and fixes a2ui-live's composer-vanish (LLD-C9).

**Failure/edge handling.**
- *Forced-colors* (SPEC-R7 AC2) — region dividers use `currentColor`/system colors so structure stays legible under `forced-colors: active`; a browser leg asserts no ink vanish. Watch the `*/`-in-comment CSS pitfall (a stray `*/` silently drops the next rule — browser-smoke-only catch).
- *Zero-width container* — grid tracks collapse without error; the narrow rule fires (main-only).
- *No container-query support* (legacy engine) — the default (wide) template is the fallback (progressive enhancement); no JS shim. Target engines (Chromium/WebKit current) support `@container`.
- *Threshold value* — `40rem` is a starting value; the exact narrow threshold is tunable (C7-reviewed). *(The hide-vs-stack behaviour is no longer an open question — it is the per-region `collapse` prop, ADR-0084 above; `toggle` is a reserved future `collapse` value, not an M1 review item.)*
- *Isolation (F1b) leaves this base grid UNCHANGED* — the `@scope (ui-app-shell)` document sheet here drives LIGHT mode. Isolated mode needs a `:host`-shaped mirror of these same region-placement + `@container` rules injected INTO the shadow (a document sheet can't reach relocated in-shadow regions); that mirror is authored in the **C5 isolation slice**, not added here. **A non-isolation builder implementing this base grid needs no change from F1b.**
- ⚠️ **KEEP-IN-SYNC (two copies of the grid, by construction)** — the region grid-template + `grid-area` placement + `@container` narrow rules live in **two** places: this base `@scope (ui-app-shell) {:scope …}` sheet (light mode) **and** the injected `:host` variant in C5 (isolated mode). Same values on purpose (ADR-0082 §Consequences flags the overlap harmless). **Any change to the region set, grid-template, area names, or the narrow rule MUST edit BOTH in the same commit — or the isolated layout silently drifts from light mode.** (This obligation includes the ADR-0084 `collapse` rule below — the `collapse="stack"` `@container` rule must land in both copies.)

## 6. LLD-C5 — opt-in isolation (→ SPEC-R6) — the primary M1 risk

**Recommended mechanism — inject the fleet CSS INSIDE the boundary.** `isolated` (reflected boolean, opt-in, default off): when on, `ui-app-shell` attaches a shadow root, **injects the fleet stylesheets into that shadow root** (a `<style>@import url('@agent-ui/components/foundation-styles.css');@import url('@agent-ui/components/component-styles.css')</style>` node, or equivalent `<link>` nodes, resolved to the built asset URLs), and relocates the authored region children into the shadow tree (not `<slot>`-projected). Default (off) keeps today's light-DOM path, byte-identical (SPEC-R6 AC1).

**Why NOT `shadowRoot.adoptedStyleSheets` fed the barrel text** (this is the F1 correction). `component-styles.css`/`foundation-styles.css` are **pure-CSS `@import` barrels delivered by `<link>`, NEVER injected from JS** (ADR-0003 — the barrel header says so). There is no constructable `CSSStyleSheet` to adopt, and a constructable sheet built via `replaceSync(barrelText)` **silently ignores `@import`** → an EMPTY sheet. Worse, the naive adoption also **omits the derived dimension ramp**: SPEC-R6 leg (a) "correct geometry" needs the universal `*` ramp (`packages/agent-ui/shared/src/tokens/dimensions.css` — the `*`-declared ramp, ADR-0007/0038) plus the `[scale]`/`[density]` rules, and a **document** `*` rule does **not** style shadow-tree elements. Injecting `foundation-styles.css` (which carries the `*` ramp + the `--md-sys-color-*` roles) AND `component-styles.css` **inside** the shadow root is what makes both legs work: the `*` rule now matches shadow-tree elements and each re-substitutes the `--ui-scale`/`--ui-density` it inherits through the boundary; the `@scope (ui-{name})` control sheets are present to style the in-shadow controls. A build-flattened constructable sheet (imports inlined at build) is an acceptable equivalent; a barrel-text `replaceSync` is not.

**Why not `static shadow`** (resolves decomp fork #3, RATIFIED → ADR-0082): the base `UIElement` attaches its shadow in the **constructor**, keyed on the class-level `static shadow` flag (`packages/agent-ui/components/src/dom/element.ts:47`), so `renderRoot` stays a pure getter (`shadowRoot ?? this`, `element.ts:185`). That flag is **class-level, all-or-nothing** — it cannot express SPEC-R6's per-INSTANCE opt-in. So isolation is an instance decision (`isolated` + a conditional attach), a **new code shape** that deliberately diverges from the base; the reserved `static shadow` seam stays unused. Ratified as [ADR-0082](../adr/0082-app-shell-per-instance-isolation.md) (which back-edits plan §5 · §12 · PRD-D3/Fork-3).

**The isolated-connect flow (F3 — the divergence spelled out).** Because the base resolves `renderRoot` from `shadowRoot ?? this`, the shadow must exist **before** the base's render effect runs. Override `connectedCallback`:
1. `if (this.isolated && !this.shadowRoot) this.attachShadow({ mode: 'open' })` — the `!this.shadowRoot` guard makes re-connect safe (`attachShadow` throws on a second call; a shadow root cannot be detached once attached).
2. Inject the two fleet `<style>@import…`/`<link>` nodes into `this.shadowRoot` — **plus the `:host` shell-grid variant (F1b, below)**.
3. **Relocate** the authored `<ui-app-shell-region>` light children into the shadow root (`shadowRoot.append(...this.children)`) so they are shadow-tree content — this is what makes leg (c) hold (a host `ui-button{…}` rule cannot reach shadow-tree elements; slotted/light content it still could).
4. `super.connectedCallback()` — now the base's render effect resolves `renderRoot` to the shadow root.

**F1b — the region grid must ALSO cross into the shadow.** The base region-grid CSS (LLD-C4) is a **document** sheet: `@scope (ui-app-shell) { :scope > ui-app-shell-region[region=…] { grid-area: … } }` + the `@container` narrow rules. Under isolation the region children are relocated INTO the shadow tree, and a document sheet does NOT style shadow-tree elements — so the `grid-area` placement (SPEC-R3) and the narrow-reflow hide rules (SPEC-R5) **silently break**: every region collapses to default placement, the named layout is lost. Fix: the isolation slice injects a **`:host`-shaped grid variant** into the shadow alongside the fleet sheets — inside a shadow, the host is `:host`, NOT `:scope`/`ui-app-shell` (`@scope (ui-app-shell)` does not match the host from within its own shadow). The injected variant mirrors LLD-C4's grid onto `:host` + its relocated children:
```css
/* injected into the shadow ONLY in isolated mode (NOT in the base app-shell.css) */
:host { display: grid; grid-template: "banner banner banner" auto "nav main aside" 1fr "footer footer footer" auto / auto 1fr auto; }
:host > ui-app-shell-region[region="banner"]        { grid-area: banner }
:host > ui-app-shell-region[region="navigation"]    { grid-area: nav }
:host > ui-app-shell-region[region="main"]          { grid-area: main }
:host > ui-app-shell-region[region="complementary"] { grid-area: aside }
:host > ui-app-shell-region[region="contentinfo"]   { grid-area: footer }
@container (inline-size < 40rem) {
  :host { grid-template: "banner" auto "main" 1fr "footer" auto / 1fr; grid-auto-flow: row; }
  :host > ui-app-shell-region[region="navigation"],
  :host > ui-app-shell-region[region="complementary"] { display: none; }
  /* ADR-0084 — MUST mirror the base collapse=stack rule (keep-in-sync), incl. the inline-size/margin neutralization (refinement 2026-07-06) */
  :host > ui-app-shell-region[collapse="stack"] { display: block; grid-column: 1 / -1; grid-row: auto; inline-size: auto; margin-inline: 0; }
}
```
This lives in the **C5 isolation slice** (a small injected `app-shell-isolation.css` asset or a template string), **NOT in the base `app-shell.css`** — so LLD-C4's base grid is UNCHANGED and a non-isolation builder is unaffected. The `:host{display:grid…}` line is belt-and-suspenders (the document `@scope`/`:scope` rule already sets grid+template on the host, which is in the light tree) — including it keeps the shadow self-contained; the load-bearing part is the child `grid-area` + `@container` rules that ONLY reach the in-shadow regions from inside the shadow. **Keep-in-sync obligation (forward-maintenance):** this `:host` variant intentionally duplicates LLD-C4's base grid-template + `40rem` narrow threshold + the `collapse="stack"` rule (harmless — same values; [ADR-0082](../adr/0082-app-shell-per-instance-isolation.md) §Consequences, extended by [ADR-0084](../adr/0084-app-shell-narrow-reflow-collapse.md)). Any future change to the region grid-template, the narrow threshold, OR the `collapse` rule MUST edit BOTH the base `app-shell.css` and this injected `:host` variant, or the isolated layout silently drifts from light mode — SPEC-R6 AC5 (isolation-on layout) is the gate that would catch such a drift. ⚠️ **Source-order caveat:** the `collapse="stack"` rule overrides the `display:none` hide rule ONLY by CSS source order (equal specificity — both are `:scope > [attr]` / `:host > [attr]`); the stack rule MUST stay AFTER the hide rules in BOTH copies. A future edit that reorders them silently inverts the fix (stack regions would hide) — keep stack-after-hide.

**The genuinely-unproven cross-engine surfaces (F2 — risk re-pointed).** `adoptedStyleSheets` on shadow roots is NOT the fragile part (broadly supported, Safari 16.4+). The two surfaces the browser gate must actually prove are: **(i) `@scope (ui-{name})` evaluated inside a shadow-injected sheet** — the fleet styles via `@scope` (ADR-0003); `@scope` shipped in Safari 17.4, and its behaviour inside a shadow tree is the real unknown; and **(ii) custom-property re-derivation of the `*` ramp across the boundary** — the inherited `--ui-scale`/`--ui-density` re-substituting on shadow-tree elements so geometry matches the light-tree control. SPEC-R6's browser legs target these.

**Failure/edge handling / escalation (SPEC-R6 AC4).**
- *Leg (b) fails — `@scope`-in-shadow or the `*`-ramp doesn't re-derive on an engine* — the in-shadow control renders wrong geometry/colour. Try the `<link>`-in-shadow form vs the `<style>@import` form vs a build-flattened sheet. If none holds cross-engine → **escalate to Kim with the failing-engine evidence**; do not ship one-engine isolation.
- *Leg (c) fails — host CSS reaches a composed control* — means a control stayed light/slotted instead of being relocated into the shadow tree (step 3 missed) — a build bug, fix the relocation.
- *Later-added children (post-connect) in isolated mode* — step 3 relocates only the children present at connect. M1 scope is **static composition** (regions authored at mount); dynamically appending a region to an isolated shell after connect lands it in light DOM (un-relocated) — documented as an M1 limitation, an `M2` concern (a MutationObserver relocation or a slot strategy), NOT silently handled.
- *Runtime `isolated` toggle* — connect-time only; a shadow root cannot be detached. Toggling after connect logs a dev warning and takes effect on re-connect (documented; not reactive).
- *Escalation is a first-class outcome* — if the 3-leg validation cannot pass cross-engine, the M1 result is "isolation deferred, light-only ships, decision returned to Kim with evidence" (PRD-D3's escalation path), NOT a silent workaround.

**Checkpoint:** the `app-shell-isolation.browser.test.ts` 3-leg suite green in both engines, OR an escalation note filed.

## 7. Forks — RESOLVED (Kim, 2026-07-05) + the remaining design details

1. **Region model — RESOLVED: generic `ui-app-shell-region[region]`** (§4). Kim ratified the generic element over five named `ui-app-shell-{region}` sub-elements. *Rationale (Kim):* agent/a2ui data-targetability of a single `[region]` attribute + fewer tags / one descriptor outweighed the fleet-consistency argument. **Considered-and-rejected (recorded honestly):** the fleet's own `ui-card` uses named sub-elements (`ui-card-header/-content/-footer`), so *consistency* favoured five named tags; this was weighed and lost. (There is no region-architecture precedent ADR — the earlier ADR-0015 cite was wrong; it is the container token model.) **Refinement — [ADR-0083](../adr/0083-app-shell-region-role-decouple.md) (ratified Kim 2026-07-06):** an optional `landmark` prop decouples the ARIA role from the column (a2ui-live's composer wants the `navigation` column but a `complementary` landmark). Additive/back-compat; only possible *because* the region is generic — a vindication of this ratified choice, not a reversal.
2. **Docking = composition — RESOLVED** (rides #1): the region is a `ui-app-shell-region` element the developer authors; SPEC-R4 collapses into SPEC-R3, no separate docking attribute.
3. **Isolation mechanism — RATIFIED (Kim, 2026-07-05) → [ADR-0082](../adr/0082-app-shell-per-instance-isolation.md).** Per-instance `isolated` opt-in → `attachShadow` at connect (NOT class-level `static shadow`); fleet + shell CSS injected INTO the shadow via `<style>@import foundation-styles.css; @import component-styles.css</style>` (foundation ramp included; `replaceSync(barrelText)` rejected — constructable sheets ignore `@import`); **plus the F1b `:host` shell-grid variant** (§6) so relocated in-shadow regions get their `grid-area` + `@container` reflow. Re-pointed risk: `@scope`-in-shadow (Safari 17.4) + `*`-ramp re-derivation. ADR-0082 carries the Repairs back-edits (PRD-D3/Fork-3 · plan §5 · plan §12), applied in this change.
4. **Declare the `a2ui` dep at M1** though unexercised until M2 (§2) — stands (establish the apex boundary once).
5. **Narrow-container rule — RATIFIED → [ADR-0084](../adr/0084-app-shell-narrow-reflow-collapse.md) (Kim 2026-07-06).** The reserved revisit fired: a2ui-live's chat composer lives in a side region and `display:none` made the primary input vanish narrow. **Recommended: per-region `collapse: 'hide' | 'stack'`** (default `hide` = today's behaviour, back-compat; `stack` = stay visible + stack full-width in the single column). Weighed against (a) a nav-toggle affordance (heaviest — a stateful control; reserved as the future `collapse="toggle"`) and (c) stack-all-when-narrow (changes the default for every consumer). Wide layout unchanged; the `collapse="stack"` `@container` rule lands in BOTH grid copies (base + isolated `:host` mirror — keep-in-sync). New cross-engine browser leg + biting NC (§ LLD-C7).

## 8. LLD-C6…C9 (brief)

- **LLD-C6 — descriptor** (`app-shell.md` + `app-shell-region.md`): frontmatter per ADR-0004; `extends: UIElement`; `customStates`/`parts` as used; contract↔props trip-wire must equal `finalize(UIAppShellElement)`/`finalize(UIAppShellRegionElement)`. *Edge:* descriptor drift fails the trip-wire loudly.
- **LLD-C7 — gates:** jsdom `app-shell.test.ts` (region→role/grid-area mapping; unknown-region fallback; empty/duplicate cases; **`landmark` override → `internals.role = landmark || REGION_ROLE[region]`, incl. out-of-set coercion — ADR-0083**). Browser `app-shell.browser.test.ts` (whole-shape region layout non-zero boxes; wrapper-resize reflow; forced-colors; **a `collapse="stack"` side region stays VISIBLE [non-zero box] when narrow while a `collapse="hide"` one is `display:none` — ADR-0084**) + `app-shell-isolation.browser.test.ts` (the 3 token/leak legs **+ the AC5 isolated-LAYOUT leg**: region `grid-area` placement + narrow reflow hold with isolation ON, incl. the `collapse="stack"` mirror). **Split the isolation legs into their own file** so C7's two browser files are single-writer-disjoint (resolves the decomp n2b/n2c file coupling). Every new gate ships a biting negative control (whole-shape bites on a collapsed region; reflow bites on a fixed layout; no-leak bites with isolation off; **AC5 bites when the `:host` grid variant is NOT injected — regions land un-placed**; **the `collapse="stack"` leg bites when the stack rule is dropped — the region hides**; size bites on a planted over-budget number).
- **LLD-C8 — barrel + size:** `app/src/index.ts` exports `UIAppShellElement`/`UIAppShellRegionElement`; `scripts/measure-size.mjs` gains ONE `@agent-ui/app` line-item (single-writer integration slice) with the budget baseline recorded at kickoff (provisional ≤ ~3 KB gz marginal). *Edge:* over-budget fails the (manual, ADR-0040 §3) gate; tree-shake proof importing the shell drags only it + composed real deps.
- **LLD-C9 — re-host (scoped to a2ui-live's OWN chrome; F5):** re-express `site/pages/a2ui-live` on `<ui-app-shell>` and delete the bespoke shell/layout rules from **`a2ui-live.css` only**; `git diff --stat` net-negative on that page's chrome; the `[chat | canvas]` layout unchanged vs the pre-re-host snapshot (browser). **Do NOT edit `site/pages/_page.css`** — it is the SHARED shell (`.app-shell` grid) for EVERY site page; migrating it onto `ui-app-shell` would risk regressing all pages and is CROSS-PAGE work, not an M1 down-payment. The shared-`_page`-shell migration is **explicitly DEFERRED** to a later wave (fittingly — `_page.ts`'s own SHELL NOTE already reads "a deliberate placeholder, to be rebuilt to dogfood an app-shell component family once one ships"; that is the deferred trigger, not M1). *Edge:* if a2ui-live's chrome inherits a `.app-shell` rule from `_page.css`, override it locally on the page rather than editing the shared sheet.
  - **a2ui-live rework (ADR-0083 + ADR-0084 — sequence after the C3/C4 props land):** the composer region authors `region="navigation" landmark="complementary" collapse="stack"` — the left column, a correct chat landmark (ADR-0083), and it STAYS reachable when the canvas narrows (ADR-0084) instead of vanishing. C9's accept gains: the composer is present + interactive at a narrow container width (cross-engine), and its landmark reads `complementary` (not `navigation`) in the AX tree. This rework depends on the C3/C4 props existing (both ADRs are ratified — Kim 2026-07-06); sequence C9's rework after the polish slices land.

## 9. Build sequence (center-out, dependency-ordered — matches the decomp edges)

1. **LLD-C1** package skeleton *(serial PREP; checkpoint: `check` 0)*.
2. **LLD-C2** layering trip-wire + NC *(after C1; checkpoint: `test` green, NC bit)*.
3. **LLD-C3 + LLD-C4 + LLD-C6** the element (behavior + CSS + descriptor) as one owning slice *(after C1; checkpoint: `check` 0, trip-wire green)*.
4. **LLD-C5** isolation mode *(after C3; checkpoint: isolation browser suite green OR escalation filed)* — parallel-safe with C9.
5. **LLD-C7** gates *(after C3 for the whole-shape/reflow file; after C5 for the isolation file)*.
6. **LLD-C9** re-host *(after C3; parallel with C5/C7; checkpoint: site build + browser unchanged, diff net-negative)*.
7. **LLD-C8** barrel + size *(serial INTEGRATION, after C5 so size measures the final; checkpoint: `size` line-item within budget)*.
8. **Reviewer gate** (decomp n4b): `component-reviewer` GO ≥4 both axes on `ui-app-shell` BEFORE the M1 commit.

## 10. Failure/edge summary (the cross-cutting cases)

- **Cross-engine divergence** — every browser assertion runs Chromium AND WebKit; a one-engine pass is a fail (the fleet discipline; the 18-bug Wave-4 lesson).
- **Isolation cannot pass cross-engine** — light-only ships, decision + evidence returned to Kim (SPEC-R6 AC4); not a silent workaround.
- **Shared-file races** — only C8 writes `measure-size.mjs`; only C1 writes the workspace list; everything else is file-disjoint (decomp slicing table).
- **Negative-control discipline** — each new gate's NC anchored on a unique token, grep-confirmed applied before trusting green (a green NC without a confirmed mutation is "my probe is wrong" first).
