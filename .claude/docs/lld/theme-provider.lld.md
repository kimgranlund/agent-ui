# LLD — `ui-theme-provider`

> Refines: [`../spec/theme-provider.spec.md`](../spec/theme-provider.spec.md) (SPEC-R1…R11) under
> [ADR-0117](../adr/0117-theme-provider-shipped-component.md) (proposed; every fork as recommended). Build
> plan: [`../decompositions/theme-provider-ship.decomp.json`](../decompositions/theme-provider-ship.decomp.json)
> (coverage-clean, plan mode). · proposed · 2026-07-09 · planner
>
> **Composes on:** `UIElement` + the props/signal system (`dom/element.ts`, `dom/props.ts`) — the SAME base
> `ui-form-provider` uses for the fleet's other pure-coordination primitive. **No new package**: one ordinary
> control folder, `controls/theme-provider/`. Catalog work is one allowlist-map entry in
> `packages/agent-ui/a2ui/src/catalog/default/index.test.ts` — no `catalog.json` row, no factory. Site work
> touches TEN real files (§5 enumerates every one, grep-verified against the live tree — a prior draft of
> this LLD named only two and would have shipped a build that silently regresses the TKT-0002-class ink-
> re-root bugfix and throws in two test files).
>
> **Freeze discipline.** §2's interface is the fan-out contract. A builder who cannot satisfy it STOPS and
> escalates — the fix is a coordinated LLD repair, never a local deviation.

## 1 · Intent

Ship a four-attribute `UIElement` control whose entire behavioral surface is one conditional style write
(§2 LLD-C2) plus three inert attribute reflections (§2 LLD-C1) — genuinely simpler than `ui-form-provider`
(which owns a reactive registry), because this component owns no state beyond its own reflected props. The
work is 80% migration/paperwork (descriptor, catalog allowlist, two site consumers repointed, two new site
pages) and 20% code — the code is intentionally small, matching `ui-code`'s "zero-machinery leaf" posture
more than `ui-form-provider`'s registry-and-protocol shape.

## 2 · Components

| ID | Component | File | Traces |
|---|---|---|---|
| LLD-C1 | props schema — `scheme`/`scale`/`density`/`theme`, all `''`-default | `controls/theme-provider/theme-provider.ts` | SPEC-R2 |
| LLD-C2 | the scheme→color-scheme effect (unset clears, not defaults-to-light) | `controls/theme-provider/theme-provider.ts` | SPEC-R3 |
| LLD-C3 | `theme-provider.css` — `display: block`, zero token chain | `controls/theme-provider/theme-provider.css` | SPEC-R6 |
| LLD-C4 | `theme-provider.md` descriptor | `controls/theme-provider/theme-provider.md` | SPEC-R7 |
| LLD-C5 | descriptor↔props trip-wire test | `controls/theme-provider/theme-provider-descriptor.test.ts` | SPEC-R7 |
| LLD-C6 | jsdom behavior suite (reflection, unset-inherit, negative controls) | `controls/theme-provider/theme-provider.test.ts` | SPEC-R2, R3 |
| LLD-C7 | cross-engine browser suite (paint proof, ancestor-inherit) | `controls/theme-provider/theme-provider.browser.test.ts` | SPEC-R3 |
| LLD-C8 | catalog `EXCLUSION_ALLOWLIST` entry | `packages/agent-ui/a2ui/src/catalog/default/index.test.ts` | SPEC-R8 |
| LLD-C9 | site migration — delete local copy, repoint every real consumer (§5 enumerates ten files) | `site/pages/theming.ts`, `site/lib/component-gallery.{ts,css}`, `site/gallery.{test,browser.test}.ts`, `site/theming.{html,css}`, `site/main.ts`, `site/pages/gallery.ts`, `site/lib/light-dark-minify.test.ts`, `site/public/llms.txt` | SPEC-R9 |
| LLD-C10 | new site pages — API doc + composition demo | `site/pages/theme-provider-doc.ts`, `site/pages/theme-provider-demo.ts` | SPEC-R10 |
| LLD-C11 | built-output `light-dark()` proof — TWO tests + a committed fixture (node-side build freshness, browser-side resolved-color) | NEW `site/lib/theme-provider-build-fixture.test.ts` (node, freshness gate) + NEW `site/lib/theme-provider-build.browser.test.ts` (browser, resolved-color assertions) + NEW `site/lib/__fixtures__/theme-provider-built.css` (committed) | SPEC-R11 |
| LLD-C12 | barrel/exports/size integration | `packages/agent-ui/components/{package.json,src/controls/index.ts}`, `barrels.test.ts` | ADR-0080 |

## 3 · Interfaces (frozen)

```ts
// controls/theme-provider/theme-provider.ts — LLD-C1/C2.
import { UIElement, prop, type PropsSchema, type ReactiveProps } from '../../dom/index.ts'

const SCHEMES = ['', 'light', 'dark'] as const
const SCALES = ['', 'ui-sm', 'ui-md', 'ui-lg', 'content-sm', 'content-md', 'content-lg'] as const // ADR-0032
const DENSITIES = ['', 'compact', 'comfortable', 'spacious'] as const

const props = {
  // LLD-C2 drives this one — the ONLY axis with a JS-side effect.
  scheme: { ...prop.enum(SCHEMES, ''), reflect: true },
  // LLD-C1 pure carriers — reflected, zero effect; dimensions.css [scale]/[density] key off the attribute.
  scale: { ...prop.enum(SCALES, ''), reflect: true },
  density: { ...prop.enum(DENSITIES, ''), reflect: true },
  // The reserved package seam (ADR-0079 cl.3) — free string, inert until a future [theme=] layer ships.
  theme: { ...prop.string(''), reflect: true },
} satisfies PropsSchema

export interface UIThemeProviderElement extends ReactiveProps<typeof props> {}
export class UIThemeProviderElement extends UIElement {
  static props = props

  protected connected(): void {
    // LLD-C2 — the one behavioral line. '' clears any inline color-scheme (never coerces to 'light'),
    // so an unset provider imposes NO override and its subtree inherits the ambient color-scheme —
    // the page's own, or an ANCESTOR provider's if this one nests inside another (SPEC-R3 AC4).
    this.effect(() => {
      this.style.colorScheme = this.scheme === '' ? '' : this.scheme
    })
  }
}

if (!customElements.get('ui-theme-provider')) customElements.define('ui-theme-provider', UIThemeProviderElement)
```

Note on `scale`/`density`/`theme`: **no effect reads them.** They exist on the class purely so
`static props` reflects them (attribute↔property sync, SPEC-R2 AC2) and so the descriptor trip-wire
(LLD-C5) has a live schema to compare against — the SAME reason `ui-form-provider` carries an (empty)
`static props` object. Their behavioral meaning lives entirely in `dimensions.css`'s existing `[scale]`/
`[density]` selectors and, later, a `[theme='<name>']` package layer — neither is touched by this LLD.

```css
/* controls/theme-provider/theme-provider.css — LLD-C3. The whole sheet. */
:where(ui-theme-provider) {
  display: block; /* an unstyled custom element defaults to inline — this would lay block-level slotted
                      children out wrong, exactly the form-provider.css precedent */
}
/* Deliberately NO --ui-theme-provider-* token chain: this component paints no surface of its own and has
   nothing to theme (SPEC-R6). No forced-colors block for the same reason. */
```

```yaml
# controls/theme-provider/theme-provider.md frontmatter — LLD-C4 (abbreviated; full fence at build time).
tag: ui-theme-provider
tier: container         # geometry.md Container/layout band — no control height, no --ui-space opinion
extends: UIElement
attributes:
  - { name: scheme,  type: enum, values: ['', light, dark], default: '', reflect: true }
  - { name: scale,   type: enum, values: ['', ui-sm, ui-md, ui-lg, content-sm, content-md, content-lg], default: '', reflect: true }
  - { name: density, type: enum, values: ['', compact, comfortable, spacious], default: '', reflect: true }
  - { name: theme,   type: string, default: '', reflect: true }  # RESERVED package seam, ADR-0079 cl.3
properties: []
events: []
slots:
  - { name: default, optional: false, description: "The themed subtree." }
parts: []
customStates: []
face: { formAssociated: false }
aria: { role: none, roleSource: none, labelSource: none }
keyboard: []
geometry:
  sizeClass: container
  display: block
  note: "No --ui-theme-provider-* token chain (nothing to theme, form-provider precedent)."
forcedColors: "No forced-colors rules needed — the provider paints nothing of its own."
```

## 4 · The catalog allowlist entry (LLD-C8)

```ts
// packages/agent-ui/a2ui/src/catalog/default/index.test.ts — one new EXCLUSION_ALLOWLIST entry,
// alongside the existing PERMANENT Toast/ToastRegion pair (ADR-0112 cl.6).
const EXCLUSION_ALLOWLIST = new Map<string, string>([
  ['Toast', '...'],        // existing
  ['ToastRegion', '...'],  // existing
  ['ThemeProvider',
    'ADR-0117 / theme-provider.spec.md SPEC-R8 — PERMANENT exclusion, never catalogue-bound: ' +
    'page/app-owner theming chrome establishing a color-scheme subtree, not agent-emittable content ' +
    '(the ADR-0112 cl.6 Toast/ToastRegion reasoning applied verbatim).'],
])
```

No `catalog.json` row, no `factories.ts` entry, no `feed-catalog.ts` disposition (moot — it never reaches
the catalog to need a feed-partition verdict). `fleetPrimaryTypes()` (ADR-0087's descriptor-glob →
PascalCase derivation) picks up `ThemeProvider` automatically the moment `theme-provider.md` ships; this map
entry is the ONLY catalog-side change required.

## 5 · Site migration (LLD-C9/C10)

**§5 is the corrected slice (HIGH-1, doc-review).** A prior draft named only two consumers
(`theming.ts`, `component-gallery.ts`); a fresh `grep -rn theme-provider site/` finds real, load-bearing
references in ten files. Every one is enumerated below with its fix — a build that skips any of the
CSS/test rows breaks `npm test`/`npm run test:browser` outright or silently regresses a shipped bugfix.

**5.1 Deletion.** `site/lib/theme-provider.ts` is deleted outright (no alias, ADR-0117 cl.1).

**5.2 Import + construction repoints (functional code).**
- `site/pages/theming.ts` — drops `import '../lib/theme-provider.ts'` (line 11) for the shipped import;
  three `document.createElement('theme-provider')` call sites (the scheme-card builder, the axis-cluster
  demo is attribute-only so unaffected) become `'ui-theme-provider'`; prose at lines 1, 4–5, 25, 43, 81, 178
  (`code("<theme-provider …")`  literal too) is reworded to describe the shipped element, not "a plain,
  passive site-local wrapper."
- `site/lib/component-gallery.ts` — the import comment (line 16), the `connected()` provider construction
  (`document.createElement('theme-provider')`, line 184), and the LLD-C4 cross-reference comment (line 196)
  all repoint to `ui-theme-provider`.
- `site/pages/gallery.ts` — the import-site comment (line 5) and the nav blurb prose (line 10, "themed
  through one `<theme-provider>`") are reworded.
- `site/main.ts` — the theming page's nav blurb (line 127, "theme-provider's three live axes…") is reworded
  for tag-name consistency (prose only, not a functional break, but left stale would drift from the
  descriptor the moment someone greps for the real tag).

**5.3 Selector + test repoints (BREAKING if missed — the two real regressions this correction exists for).**
- **`site/lib/component-gallery.css:45-60` — the SCHEME-BOUNDARY INK RE-ROOT rule.** A load-bearing bugfix
  (the "white text on a light card" defect: a `<theme-provider scheme=light>` nested in a dark root
  re-roots `color-scheme`, but that alone does not re-resolve an INHERITED `color` a bare-textContent
  specimen never explicitly declares — `component-gallery.css` re-declares `color:
  var(--md-sys-color-neutral-on-surface)` on the provider itself so the inherited ink re-resolves at the
  scheme boundary too). The selector `theme-provider { display: block; color: … }` is re-keyed to
  `:where(ui-theme-provider) { color: … }` (the `display: block` half moves into the SHIPPED component's own
  `theme-provider.css`, LLD-C3 — it is no longer the consumer's job; only the `color` re-root stays
  gallery-local for this wave). **Named, not solved (a real follow-up, not this ADR's scope):** per ADR-0102's
  CSS-less-consumer law, a per-subtree scheme override creating exactly this ink-inheritance hazard for
  bare-text content is arguably the COMPONENT's own identity concern (Lane A), not a per-consumer patch —
  any app embedding `ui-theme-provider` around bare text hits the identical defect the gallery already
  fixed for itself. This LLD deliberately does NOT fold the fix into `theme-provider.css` this wave (it
  would change SPEC-R6's "paints nothing of its own" contract and needs its own bite-tested regression
  suite) — it migrates the existing fix unchanged in substance, re-keyed to the new tag, and names the
  broader question as a trigger for a future intake if a second consumer hits the same bug.
  **Trigger FIRED (REV 2026-07-18, [ADR-0148](../adr/0148-theme-provider-ink-reroot-fold-in.md), issue
  #31):** the TKT-0088 site shell (`ui-theme-provider.app-shell`) was the second consumer — white
  headings/prose on every docs page under a light toggle + dark OS. The rule now lives in
  `theme-provider.css` itself (zero-specificity `:where()`, SPEC-R6 REV-amended, bite legs in
  `theme-provider.browser.test.ts`); the gallery-local copy retired to a pointer.
- **`site/gallery.browser.test.ts`** — two `gallery.querySelector('theme-provider')` calls (lines 215, 313)
  become `'ui-theme-provider'` (a missed rename here THROWS — `as HTMLElement` on a `null` querySelector
  result); the describe-block titles (lines 159, 302) and comments (lines 14, 73, 294, 299) are reworded.
- **`site/gallery.test.ts:217`** — the same `querySelector('theme-provider')` fix, same failure mode if missed.

**5.4 Prose-only repoints (drift, not breakage — repaired in the same change per keep-context-live).**
- `site/theming.html:9` (HTML comment) · `site/theming.css:29` (comment referencing `theme-provider.ts`,
  now-deleted) · `site/lib/light-dark-minify.test.ts:6` (its comment cites `<theme-provider scheme>` and the
  now-deleted file path by name — the comment is corrected; the test's OWN mechanism and assertions are
  untouched, since it proves a general build-pipeline property, not anything specific to this component) ·
  `site/public/llms.txt:14` (the theming-page description line — hand-maintained prose, not derived; the
  `<theme-provider>` mention is reworded).

**5.5 Explicitly NOT touched (append-only history; SPEC-R9 AC3).** `CHANGELOG.md`'s existing entries (the
G8 gallery ship note, the TKT-0002 bugfix note) describe what was true at their own time and stay
byte-unedited — rewriting history to say `ui-theme-provider` retroactively would be dishonest, not a fix. A
NEW entry recording THIS promotion lands on ratification+build. `site/public/llms-full.txt` is a DERIVED
corpus (`scripts/generate-llms-full.mjs`, gated byte-identical by `llms.test.ts` G1 against `CHANGELOG.md` +
every descriptor) — it is never hand-edited; it picks up both the new descriptor and the new CHANGELOG entry
automatically on next regeneration, and its pre-existing CHANGELOG-sourced historical mentions of
`theme-provider` are exactly as correct as `CHANGELOG.md`'s own.

**New pages (LLD-C10).** `theme-provider-doc.ts` follows the standard descriptor-derived API page shape
(the `form-provider-doc.ts`/`code-doc.ts` precedent — attributes table, geometry note, a minimal live
specimen). `theme-provider-demo.ts` is new CONTENT, not a restatement: it demonstrates (a) two nested
providers with different `scheme`s to prove subtree independence, and (b) one provider left `scheme`-unset
nested inside a `scheme="dark"` ancestor, proven with a **self-coloring control** (`ui-button` — LOW-3,
doc-review: NOT bare text, which is precisely the ink-inheritance shape §5.3's re-root fix exists to
handle; using bare text here would conflate the ancestor-inherit proof [SPEC-R3 AC4, a `color-scheme`/
`light-dark()` question] with the separate ink-re-root defect class [an inherited-`color` question] the
demo is not trying to teach). `theming.ts` itself is otherwise unchanged in structure; only its import,
construction calls, and prose (§5.2) are corrected to describe the shipped component.

## 6 · The built-output regression guard (LLD-C11)

**Corrected mechanism, twice (MEDIUM-1 then MEDIUM-A, doc-review).** First correction: jsdom cannot
resolve `light-dark()`/`color-scheme`, so the proof needs a real browser. Second correction: the browser
project executes the test module IN a real Playwright-driven browser — it cannot shell out to `vite build`
or read files via `node:fs` (verified: zero `.browser.test.ts` in this repo imports a `node:` module; the
repo has no server-commands bridge for one to reach out through). **The build step and the assertion step
must therefore be two separate tests, bridged by a committed fixture** — the `llms.test.ts` G1
byte-identical-freshness pattern, applied to a captured build artifact instead of a generated corpus:

```ts
// site/lib/theme-provider-build-fixture.test.ts — NODE-context (.test.ts, the jsdom/node project), NOT a
// .browser.test.ts. Reuses light-dark-minify.test.ts's spawnSync('vite', ['build', '--outDir',
// SCRATCH_OUT_DIR, ...]) shell-out + its cssFiles.map(...).join('\n') extraction VERBATIM (import the
// helper, or factor it into a tiny shared module — a builder call, not a design fork) to produce the
// SAME real production CSS text that file already builds. Then, mirroring llms.test.ts's G1 exactly:
//   1. reads the committed fixture site/lib/__fixtures__/theme-provider-built.css
//   2. asserts the fresh build's joined CSS text is BYTE-IDENTICAL to the committed fixture
// A red result names its own fix: rebuild, inspect the diff, commit the refreshed fixture (the
// llms-full.txt regeneration precedent — no --update flag exists yet; adding one is a foreseen, not
// required, refinement). THIS test owns build freshness; it asserts nothing about resolved color.
```

```ts
// site/lib/theme-provider-build.browser.test.ts — a REAL .browser.test.ts (the test:browser project,
// Chromium at minimum). Imports the SAME committed fixture as a plain asset — no shell-out, no node:fs:
import builtCss from './__fixtures__/theme-provider-built.css?raw'
// `?raw` resolves to REAL file content specifically under the browser-test project (the app-shell.ts
// ISOLATION_GRID_CSS precedent, proven live by app-shell-isolation.browser.test.ts) — jsdom's empty
// resolution of the same query is a documented, unrelated caveat that does not apply here.
//
// The test then:
//   1. injects builtCss into ITS OWN live document via a <style> element (document.head.appendChild) —
//      genuinely production-built bytes, freshness independently gated by the node-side test above
//   2. mounts <ui-theme-provider scheme="dark"> and <ui-theme-provider scheme="light"> siblings, each
//      wrapping a real <ui-button variant="soft"> (a self-coloring control — the LOW-3 vehicle choice,
//      §5's demo-page rationale applies here too: a bare-text probe would conflate this proof with the
//      separate ink-re-root defect class)
//   3. asserts getComputedStyle(darkButton).color !== getComputedStyle(lightButton).color (soft/ghost ink
//      reads --md-sys-color-primary-high, ADR-0117 build-verified: light-dark(primary-650, primary-400) —
//      a genuine per-scheme divergence) AND each matches an INDEPENDENTLY-resolved expected value for that
//      scheme (a separate probe with its own explicit color-scheme, not a hardcoded literal that could
//      silently drift from the palette) — not just "differs from the other" (a degenerate "both unstyled"
//      false-pass is ruled out this way too)
// Proves the production CSS, parsed by a real engine, resolves per-subtree through THIS component's
// scheme mapping — the TKT-0002 regression class, scoped through a real consumer's real DOM, complementing
// (not duplicating) light-dark-minify.test.ts's general-purpose "the bytes survive minification" proof.
```

**Deviation record (MEDIUM-2, post-build doc repair).** The build could not satisfy the frozen vehicle
above verbatim: `--md-sys-color-primary` (the `solid` variant's bg/ink) is `light-dark(primary-500,
primary-500)` in `tokens.css` — DELIBERATELY scheme-INVARIANT (a stable brand accent) — so a `solid`
`background-color` assertion would have been vacuous-by-construction, never able to diverge regardless of
whether the mapping mechanism worked or not. The build switched to `variant="soft"` asserting `color` (ink)
against `--md-sys-color-primary-high` (`light-dark(primary-650, primary-400)` — genuinely scheme-dependent),
verified independently by BOTH the builder and a second reviewer against the shipped test
(`site/lib/theme-provider-build.browser.test.ts`) before this record caught up. Per the freeze discipline
(§ intro), a frozen-interface conflict should escalate BEFORE building around it — that didn't happen here;
recording the honest process gap rather than silently treating the deviation as pre-approved.

**Why not `globalSetup`/`provide`/`inject`** (the alternative the review offered): grepped for precedent —
zero hits anywhere in this repo, and it would mean editing the SHARED root `vitest.browser.config.ts` (every
browser project's config) for one component's regression test. The two-test-plus-fixture design above reuses
three ALREADY-PROVEN patterns (`light-dark-minify.test.ts`'s shell-out, `llms.test.ts`'s byte-identical
freshness gate, `app-shell.ts`'s `?raw`-under-browser-project asset import) and touches zero shared
infrastructure — judged sturdier on that basis.

## 7 · Failure/edge summary (cross-cutting, MEDIUM-3 doc-review)

- **Empty-attribute vs absent-attribute (LOW-1)** — `scale=""` (explicitly set) and no `scale` attribute at
  all (never touched) resolve to the identical `''` property value and are equally harmless against
  `dimensions.css`'s value-specific selectors, but they are NOT DOM-identical. LLD-C6's jsdom suite MUST
  cover both cases explicitly (SPEC §2's Unset definition states the mechanism); no test may assert "unset
  ⇒ attribute absent" as a general claim — it is only true for the never-touched case.
- **Malformed/out-of-vocabulary values** — already covered, SPEC-R2 AC3: any invalid `setAttribute` value
  fails open to `''` (inherit), never fail-closed to a named value, never throws.
- **Nested-unset (an unset provider inside a scheme'd ancestor)** — already covered, SPEC-R3 AC4: the
  correctness case this whole promotion exists to fix. LLD-C7's browser suite is the proof; the demo page
  (§5) is the LIVE teaching surface, using a self-coloring control per LOW-3.
- **Disconnect/reconnect** — NOT a new invariant this component must implement: `this.effect()` (LLD-C2) is
  scope-owned by `UIElement`'s own connect lifecycle, which already disposes effects on disconnect and
  re-establishes them on reconnect for every fleet control. LLD-C6 adds ONE probe re-verifying this holds
  here too (a regression net on the base class, not new machinery in `theme-provider.ts`).
- **The ink-re-root latent risk (§5.3)** — named and migrated (re-keyed selector), not solved as a
  component-owned concern this wave; a second consumer hitting the same defect is the trigger for revisiting
  whether it belongs in `theme-provider.css` itself (ADR-0102 Lane A candidate). *(REV 2026-07-18: fired and
  folded in — [ADR-0148](../adr/0148-theme-provider-ink-reroot-fold-in.md), issue #31; see §5.3's note.)*
- **Zero residue** — the one effect this component establishes rides the standard connect-scope disposal;
  no listener, timer, or subscription of any kind exists outside it.

## 8 · Gates (the definition of done)

`npm run check`(+site) · `npm test` (theme-provider.test.ts + theme-provider-descriptor.test.ts +
family-coherence.test.ts + the a2ui catalog `EXCLUSION_ALLOWLIST` suite + site-coverage.test.ts +
`site/gallery.test.ts` + `site/lib/llms.test.ts` G1 + `theme-provider-build-fixture.test.ts` [the LLD-C11
node-side freshness gate]) · `npm run test:browser theme-provider` (Chromium + WebKit, incl. the
ancestor-inherit leg) · `site/gallery.browser.test.ts` (both re-keyed querySelector legs, both engines) ·
`theme-provider-build.browser.test.ts` (the LLD-C11 browser-side resolved-color proof) ·
`grep -rnE "(^|[^-A-Za-z/])theme-provider([^-A-Za-z]|$)" site --include=*.ts --include=*.css --include=*.html
site/public/llms.txt` empty (SPEC-R9 AC1) · `npm run size` measured by hand (ADR-0040 §3) · independent
`component-reviewer` GO.

## 9 · Open (named, not blocking)

- **`ui-router-link`/`ui-router` convergence** — none; theme-provider has no interaction with the router
  package (orthogonal axes).
- **A future `[theme='<name>']` package layer** — when it ships, it reads the SAME `theme` attribute this
  LLD reflects; no change to this component is anticipated (the seam was built for exactly this).
- **Folding the scheme-boundary ink re-root (§5.3/§7) into `theme-provider.css` itself** — named, not solved;
  the trigger is a second consumer independently hitting the same "bare text under a per-subtree scheme
  override" defect the gallery already fixed for itself. *(CLOSED 2026-07-18 — the trigger fired: the
  TKT-0088 site shell, issue #31; folded in per [ADR-0148](../adr/0148-theme-provider-ink-reroot-fold-in.md).)*
