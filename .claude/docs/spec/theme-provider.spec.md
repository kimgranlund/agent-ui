# SPEC — `ui-theme-provider`

> Status: proposed · v0.1 · 2026-07-09 · Layer: SPEC (execution contract)
> Refines: TKT-0003 (`../tickets/tkt-0003-ship-theme-provider.md`) under the ratified scope + contract
> directions of [ADR-0117](../adr/0117-theme-provider-shipped-component.md) (proposed; forks F1–F4 as
> recommended).
>
> **No owning PRD — a deliberate, acknowledged deviation from the family-PRD pattern.** Every prior
> multi-component intake in this doc set (chart/report/feed/content-family, router) authored a sibling PRD
> before its SPEC, because each was new product surface needing Problem/Users/Outcomes discovery. This
> intake is not that: it is a scoped promotion of an already-designed, already-shipped contract
> (`site/lib/theme-provider.ts`, ADR-0079 cl.3) whose problem statement and acceptance criteria already
> live in TKT-0003 (a TICKET, which carries Summary/Acceptance/Links per its own type contract). Authoring
> a PRD here would restate TKT-0003's content under different frontmatter — the exact "restated substrate"
> failure `doc-authoring-standards` itself names. **Known, deliberate gap:** `doc-authoring-standards`'
> harness_checks S1 (the SPEC↔PRD uplink) fails on this file by construction; recorded here as a reviewed
> deviation, not a silent miss. (Correction: an earlier draft of this SPEC cited ADR-0114/ADR-0106 as
> PRD-less precedent — that citation was false and is retracted; both rode `content-family.prd.md` at the
> SPEC layer. The basis above is the accurate one.) `goals.md`'s existing G8 DoD line ("the gallery renders
> every control, themed through one provider") is descriptive context, not a requirement this SPEC refines.
> Refined by: [`../lld/theme-provider.lld.md`](../lld/theme-provider.lld.md). Build plan:
> [`../decompositions/theme-provider-ship.decomp.json`](../decompositions/theme-provider-ship.decomp.json)
> (coverage-clean, plan mode).
> Altitude: owns **what the shipped element does and how it behaves at every boundary** (the prop contract,
> the scheme-inheritance fix, the catalog disposition, the site migration's observable end-state).
> Implementation (file layout, CSS mechanics, page content) is the LLD's. Requirement IDs file-scoped
> (`SPEC-R1…`).

---

## 1. Purpose

Contract the promotion ADR-0117 ratifies: `site/lib/theme-provider.ts`'s CONTRACT (not its file) ships as
`ui-theme-provider`, a real `@agent-ui/components` control, with one deliberate behavioral fix (`scheme`
unset no longer collapses to light) and one deliberate scope fence held (the multi-theme package-swapping
system stays out — the attribute ships wired, inert). This SPEC is normative for the component's contract,
the catalog disposition, and the migration's observable end-state; it is not normative for CSS selector
mechanics or page prose, which the LLD owns.

## 2. Definitions

- **Axis** — one of the four independent attributes the component carries: `scheme`, `scale`, `density`,
  `theme`.
- **Unset** — an axis whose resolved value is the empty string `''` — the shared default of all four axes.
  Distinct from any named value; **unset means "impose no override," never "impose the first named value."**
  Reached two ways that are behaviorally equivalent but NOT DOM-identical (LOW-1, precisely stated so no
  implementer assumes "unset" means "attribute absent"): (a) the attribute is never touched — the DOM
  attribute is genuinely absent, and the property reads `''` only via the enum codec's fallback-to-`values[0]`
  path (`props.ts`'s `enumType.from`); (b) the attribute (or property) is explicitly set to `''` — `reflectOut`
  always runs on an explicit set (the enum codec's `to` never returns `null`), so the DOM carries a REAL,
  PRESENT `scale=""` (or `scheme=""`/`density=""`) attribute, not an absent one. Both resolve to the identical
  `''` property value and both are harmless for `dimensions.css`'s VALUE-specific selectors (`[scale=ui-lg]`
  etc. — an empty attribute matches none of them, same as no attribute), so no functional distinction is
  normative here — but a test asserting "unset ⇒ no attribute" would be WRONG for case (b) and must not be
  written that way.
- **Pure carrier** — an axis with zero JS-side effect: the component reflects it to an attribute and does
  nothing else; a separate stylesheet ([scale]/[density] selectors in `dimensions.css`, a future
  `[theme='<name>']` package layer) reads the attribute. `scale`, `density`, and `theme` are pure carriers.
  `scheme` is not — it drives one component-owned effect (§3.1).
- **The reserved seam** — the `theme` axis: wired (attribute exists, reflects, descriptor-documented) but
  inert (no CSS layer in the fleet matches any value it can hold) until a future multi-theme package system
  ships, which is explicitly out of this SPEC's scope (ADR-0117 cl.3, ADR-0079 cl.3's F2b).

## 3. Requirements

Normative per RFC 2119; each carries an ID and acceptance criteria.

### 3.1 Component contract

**SPEC-R1 — Base class and tag.** The component MUST be `ui-theme-provider`, a class extending `UIElement`
(not `UIFormElement`, not `UIContainerElement`), self-defining on import (`customElements.define`, idempotent
guard), living at `packages/agent-ui/components/src/controls/theme-provider/`. *(ADR-0117 cl.2)*
- **AC1** *Given* the module is imported, *then* `customElements.get('ui-theme-provider')` resolves to a
  constructor that is `UIElement`'s subclass.
- **AC2** *Given* an instance, *then* it is NOT `instanceof UIFormElement` and carries no `formAssociated`
  behavior.

**SPEC-R2 — Props schema.** The component MUST declare exactly four `static props`, each a reflected,
attribute-synced prop with `values[0]`-default-first ordering where enumerated: `scheme: enum(['','light',
'dark'], '')`, `scale: enum(['', 'ui-sm','ui-md','ui-lg','content-sm','content-md','content-lg'], '')`,
`density: enum(['','compact','comfortable','spacious'], '')`, `theme: string('')`. *(ADR-0117 cl.3)*
- **AC1** *Given* no attribute is set on a fresh instance, *then* all four properties read `''`.
- **AC2** *Given* `el.scheme = 'dark'`, *then* `el.getAttribute('scheme') === 'dark'` (property→attribute
  reflection) and the reverse (`setAttribute('scheme','dark')` → `el.scheme === 'dark'`).
- **AC3** *Given* an out-of-vocabulary `scheme`/`scale`/`density` attribute value is set directly via
  `setAttribute`, *then* the property resolves to `''` (fail-open to unset, never a crash, never a
  fail-closed coercion to a named value).

**SPEC-R3 — The scheme→color-scheme mapping, unset-inherits.** The component MUST map a non-empty `scheme`
to its own `style.colorScheme`, and MUST clear that inline style (never leave it at a stale prior value, and
never write `'light'` as an unset default) whenever `scheme` resolves to `''`. This is the LOAD-BEARING fix
over the site-local predecessor. *(ADR-0117 cl.3, the F3 fork)*
- **AC1** *Given* `scheme='dark'`, *then* `getComputedStyle(el).colorScheme` includes `'dark'` and a
  descendant `light-dark()` token resolves its dark-scheme value.
- **AC2** *Given* `scheme='light'`, *then* the symmetric light-scheme resolution holds.
- **AC3** *Given* `scheme` is unset (never set, or set then cleared to `''`), *then* `el.style.colorScheme
  === ''` — no inline override — and a descendant `light-dark()` token resolves according to the INHERITED
  ambient `color-scheme` (the page default, or an ancestor provider's explicit scheme if this provider is
  nested inside one).
- **AC4** *Given* an unset provider nested inside an ancestor `<ui-theme-provider scheme="dark">`, *then*
  the nested provider's own descendants resolve DARK tokens (inheritance proof — the fix must hold through
  nesting, not just at the page root).

**SPEC-R4 — `scale`/`density` are pure carriers.** The component MUST NOT establish any JS-side effect for
`scale` or `density` beyond attribute reflection (SPEC-R2); their behavioral meaning is entirely owned by
`dimensions.css`'s `[scale]`/`[density]` selectors, unmodified by this SPEC. *(ADR-0117 cl.3)*
- **AC1** *Given* a grep of `theme-provider.ts`, *then* neither `scale` nor `density` is read inside a
  `this.effect(...)` call or any other reactive callback — reflection is the whole story.

**SPEC-R5 — `theme` stays the reserved, inert seam.** The component MUST reflect `theme` as a free string
with zero rendering effect; this SPEC does not admit any `[theme='<name>']` CSS layer or package-resolution
mechanism. *(ADR-0117 cl.3, ADR-0079 cl.3 F2b — explicitly out of scope)*
- **AC1** *Given* `theme` set to any string, including an unregistered name, *then* no visual change results
  beyond what `scheme`/`scale`/`density` already produce (degrades silently — no layer matches, nothing
  breaks, matching today's gallery behavior).

**SPEC-R6 — Layout and token surface.** The component's own stylesheet MUST declare exactly one rule
(`display: block`) and MUST NOT declare or consume any `--ui-theme-provider-*` custom property — the
deliberate absence documented in the sheet (the `ui-form-provider` precedent). No forced-colors block is
required (the component paints no surface of its own). *(ADR-0117 cl.4)*

> **REV 2026-07-18 ([ADR-0148](../adr/0148-theme-provider-ink-reroot-fold-in.md), proposed — the LLD
> §5.3 named-not-solved trigger fired, issue #31):** the stylesheet additionally declares the
> SCHEME-BOUNDARY INK RE-ROOT — `color: var(--md-sys-color-neutral-on-surface)` in a zero-specificity
> `:where(ui-theme-provider)` block — so ink INHERITED across a forced `color-scheme` boundary
> re-resolves against the provider's own scheme (ink only, never a surface; any consumer declaration
> outranks it). "Exactly one rule" reads as amended: the `@scope` structural default plus this one
> token-block declaration. The `--ui-theme-provider-*` prohibition stands unchanged — the re-root
> consumes the shared neutral ink role directly and mints nothing.

- **AC1** *Given* `theme-provider.css`, *then* `family-coherence.test.ts`'s B-group token invariant passes
  with zero `--ui-theme-provider-*` declarations or consumptions.
- **AC2** *(REV 2026-07-18, ADR-0148)* *Given* a dark-pinned root and a `scheme="light"` provider whose
  bare-text child declares no `color`, *then* the child's rendered ink equals the LIGHT-resolved neutral
  ink role (and the inverse holds under a light-pinned root with a dark provider) — the
  `theme-provider.browser.test.ts` ink re-root legs, both engines.

**SPEC-R7 — Descriptor + geometry.** The descriptor (`theme-provider.md`) MUST declare `tier: container`,
`extends: UIElement`, `geometry.sizeClass: container`, and an `attributes[]` fence mirroring `static props`
1:1 (the standing per-control trip-wire). *(ADR-0117 cl.4)*
- **AC1** *Given* the descriptor↔props trip-wire test, *then* it passes with zero drift.

### 3.2 Catalog disposition

**SPEC-R8 — Permanent catalog exclusion.** `ThemeProvider` (the descriptor-derived PascalCase type name)
MUST NOT gain a default-catalog row. It MUST be seeded into the a2ui default catalog's `EXCLUSION_ALLOWLIST`
as a PERMANENT entry (never drained, mirroring the ADR-0112 cl.6 Toast/ToastRegion precedent), with a
recorded reason citing this SPEC and ADR-0117. *(ADR-0117 cl.4)*
- **AC1** *Given* `theme-provider.md` ships, *then* `ThemeProvider` enters the fleet-derived `FLEET_TYPES`
  set (ADR-0087) and the catalog coverage gate stays green ONLY because of the allowlist entry.
- **AC2** *Given* the allowlist residue-guard test, *then* `ThemeProvider` is never ALSO present in the
  catalog's key set (the drained-seed contradiction the guard exists to catch).

### 3.3 Site migration

**SPEC-R9 — Zero site-local survivor.** After this SPEC's build lands, `site/lib/theme-provider.ts` MUST NOT
exist, and no LIVE, functional site source may reference the bare, unprefixed tag `theme-provider` — not a
definition, not a selector, not a `querySelector`/`createElement` call, not forward-looking prose. Every
site consumer of the theming wrapper MUST construct/import `ui-theme-provider` from `@agent-ui/components`.
*(ADR-0117 cl.1, "clean cutover, no alias")* **Correction (HIGH-1, doc-review):** the original AC below
checked only `customElements.define('theme-provider'` — too narrow to catch a CSS selector or a
`querySelector` call, exactly the shape of two of the real migration items LLD §5 now enumerates.
**Second correction (MEDIUM-B, delta review):** the first-pass fix (`(^|[^-A-Za-z])theme-provider`) is
UNSATISFIABLE on a correct build — it also matches the migration's own REQUIRED outputs: the import path
`@agent-ui/components/controls/theme-provider` (preceded by `/`, which the pattern failed to exclude) and
the required page ids/hrefs `theme-provider-doc`/`theme-provider-demo` (the pattern checked only the
character BEFORE the match, never after, so it also caught these legitimate compounds). Replaced below with
a pattern excluding both directions.
- **AC1** *Given* `grep -rnE "(^|[^-A-Za-z/])theme-provider([^-A-Za-z]|$)" site --include=*.ts --include=*.css
  --include=*.html` PLUS `site/public/llms.txt`, *then* zero matches. The pattern excludes `ui-theme-provider`
  (preceding `-`) AND `controls/theme-provider` (preceding `/`) on the LEADING side, and excludes
  `theme-provider-doc`/`theme-provider-demo` (a following `-`) on the TRAILING side — while still catching a
  bare `customElements.define('theme-provider'`, a CSS type selector (`theme-provider { … }`), a
  `querySelector('theme-provider')`, an HTML/comment mention, and a `createElement('theme-provider')` call,
  each of which is followed by a quote/brace/space/angle-bracket, none of them `[-A-Za-z]`. `CHANGELOG.md`
  and `site/public/llms-full.txt` are EXCLUDED from this AC (see AC3) — append-only history correctly
  retains the old name.
- **AC2** *Given* `site/pages/theming.ts` and `site/lib/component-gallery.ts`, *then* both construct/reference
  `ui-theme-provider` exclusively (import path, `document.createElement`/`querySelector` calls, and prose).
- **AC3** *Given* `CHANGELOG.md`'s pre-existing historical entries (the G8 gallery ship note, the TKT-0002
  bugfix note) and `site/public/llms-full.txt` (a DERIVED corpus regenerated from `CHANGELOG.md` +
  descriptors, gated byte-identical by `llms.test.ts` G1), *then* NEITHER is edited to retroactively say
  `ui-theme-provider` — they describe what was true at their own time, and rewriting them would be dishonest
  revisionism, not a fix. A NEW `CHANGELOG.md` entry recording this promotion lands on ratification+build
  (the repo's own convention); `llms-full.txt` picks it up automatically on next regeneration
  (`node scripts/generate-llms-full.mjs`), never by hand-edit.

**SPEC-R10 — Required site pages.** The component's `tier: container` classification REQUIRES a `{doc,
demo}` page pair under `site-coverage.test.ts`'s ratified per-tier sets. `theme-provider-doc.ts` MUST be the
descriptor-derived API page; `theme-provider-demo.ts` MUST show a composition case (nested providers, or an
override-at-a-subtree case) distinct from `theming.ts`'s existing narrative content. `theming.ts` remains the
conceptual guide and is repointed, not replaced. *(ADR-0117 cl.4)*
- **AC1** *Given* `site-coverage.test.ts`, *then* the required-page-set check for `ui-theme-provider` passes.

**SPEC-R11 — Built-output `light-dark()` resolution (the TKT-0002 regression class).** A REAL-BROWSER test
MUST prove, against the PRODUCTION bundle's actual CSS bytes (not dev-mode source, not a text-inspection
proxy for resolution), that a real shipped control nested under a built `<ui-theme-provider scheme="dark">`
resolves its dark-scheme token value via `getComputedStyle`, and its light-scheme value outside such a
subtree. *(ADR-0117 Acceptance, ADR-0117 Consequences)* **Correction (MEDIUM-1, doc-review):** the original
AC below named `light-dark-minify.test.ts` as this requirement's "sibling," but that file is a jsdom-project
test that shells out to a real `vite build` and does TEXT INSPECTION of the built CSS asset
(`toContain('light-dark(')`) — jsdom does not implement `light-dark()`/`color-scheme` resolution, so it
cannot produce a `getComputedStyle` result this requirement can assert against. **Second correction
(MEDIUM-A, delta review):** the first-pass fix put the `vite build` shell-out AND the `node:fs` CSS read
INSIDE the `.browser.test.ts` body — but the browser project executes the test module IN the browser via
the Playwright provider; no `node:child_process`/`node:fs` is reachable there (verified: zero
`.browser.test.ts` in this repo imports a `node:` module, and the repo has no `@vitest/browser` server-
commands bridge). The build step MUST live in a separate NODE-context test; the browser test consumes its
output as a plain asset import, never by shelling out itself.
- **AC1** *Given* a two-part mechanism, node-side build + browser-side assertion, with a COMMITTED fixture
  bridging them (the `llms.test.ts` G1 byte-identical-freshness pattern, applied to a built-CSS artifact
  instead of a generated corpus): (1) a NODE-context test (a plain `.test.ts`, the jsdom/node project —
  `light-dark-minify.test.ts`'s own shell-out-to-`vite-build` mechanics, reused rather than duplicated)
  builds fresh, joins the built CSS assets exactly as that file does, and asserts the result is
  BYTE-IDENTICAL to a committed fixture file — a red result names its own fix (regenerate the fixture from
  a fresh build and commit the diff); (2) the committed fixture is a plain, tracked `.css` file (NOT
  regenerated implicitly, NOT loaded via a live dev-server transform of SOURCE — its content IS a captured
  production build's bytes) imported into the `.browser.test.ts` via Vite's `?raw` query (the
  `app-shell.ts` `ISOLATION_GRID_CSS` precedent — proven to resolve to REAL content specifically under the
  browser-test project, per `app-shell-isolation.browser.test.ts`; jsdom's empty resolution of the same
  query is the documented, unrelated caveat, avoided here because this is a `.browser.test.ts`); (3) the
  browser test injects the fixture text into its own document via a `<style>` element, mounts real
  `<ui-theme-provider scheme="dark"><ui-button variant="soft">…</ui-button></ui-theme-provider>` beside a
  `scheme="light"` sibling, and asserts `getComputedStyle` on each button's resolved INK (`color`, not
  `backgroundColor`) genuinely differs and matches an independently-resolved expected dark/light token
  value — *then* the assertions hold, proving the mechanism through a real browser parsing
  genuinely-production-built bytes, with the freshness of those bytes independently gated by (1).
  **Deviation record (MEDIUM-2, post-build doc repair):** the vehicle above is corrected from a frozen
  earlier draft that named `variant="solid"` asserting `backgroundColor`. That vehicle was
  vacuous-by-construction: `--md-sys-color-primary` (the `solid` variant's bg/ink) is
  `light-dark(primary-500, primary-500)` in `tokens.css` — deliberately scheme-INVARIANT — so it could
  never diverge regardless of whether the mapping mechanism worked. `soft`'s ink reads
  `--md-sys-color-primary-high` (`light-dark(primary-650, primary-400)`), which genuinely differs per
  scheme. Both the builder and an independent reviewer verified this substitution against the shipped test
  before this record caught up; per the freeze discipline, the conflict should have escalated before
  building around it — recorded honestly rather than treated as silently pre-approved.

## 4. Non-goals (explicit fences)

- **The multi-theme package-swapping system** — SPEC-R5 ships the `theme` attribute wired and inert only;
  no `[theme='<name>']` CSS layer, no package registry, no resolution mechanism. Named next-tier
  (ADR-0079 cl.3 F2b).
- **A `ThemeProvider` catalog row or any A2UI bindability for these props** — SPEC-R8 is a permanent
  exclusion, not a deferred one; no fork in this SPEC reopens it short of a future ADR.
- **A `scheme` value beyond `light`/`dark`** (e.g. a third named contrast mode) — out of scope; the fleet's
  `color-scheme` CSS property itself is a two-value axis.

## 5. Trace

| Requirement | ADR-0117 clause | Decomp node(s) |
|---|---|---|
| SPEC-R1 | cl.2 | n3 |
| SPEC-R2 | cl.3 | n5, n6, n7, n8 |
| SPEC-R3 | cl.3 | n9 |
| SPEC-R4 | cl.3 | n6, n7 |
| SPEC-R5 | cl.3 | n8 |
| SPEC-R6 | cl.4 | n10 |
| SPEC-R7 | cl.4 | n11, n12 |
| SPEC-R8 | cl.4 | n15 |
| SPEC-R9 | cl.1 | n17, n18, n19 |
| SPEC-R10 | cl.4 | n20, n21 |
| SPEC-R11 | Consequences | n25 |
