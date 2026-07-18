# ADR-0148 — the scheme-boundary ink re-root folds into `theme-provider.css` itself: ADR-0117 LLD §5.3's named-not-solved trigger has fired (the TKT-0088 site shell is the second consumer), so the inherited-ink re-resolution becomes the component's own identity concern (ADR-0102 Lane A), amending SPEC-R6's "exactly one rule"

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-07-18
>
> | Field | Value |
> |---|---|
> | **Status** | proposed |
> | **Date** | 2026-07-18 |
> | **Proposed by** | bug-report intake ([issue #31](https://github.com/kimgranlund/agent-ui/issues/31) — Kim's two screenshots, 2026-07-18: the `h1.page-heading` on `/timeline-demo` and doc-page prose/bullets rendering near-white on the light surface with the site toggle on Light under a dark OS scheme; root-caused to the ink-inheritance hazard ADR-0117's LLD already names) |
> | **Ratified by** | — (proposed; the Status cell is Kim's to flip) |
> | **Repairs** | on ratification+build: `packages/agent-ui/components/src/controls/theme-provider/theme-provider.css` (the `:where(ui-theme-provider)` ink re-root + banner) · `site/lib/component-gallery.css` (the gallery-local rule retires to a pointer) · `controls/theme-provider/theme-provider.browser.test.ts` (the bare-text light-in-dark bite leg) · [`../spec/theme-provider.spec.md`](../spec/theme-provider.spec.md) SPEC-R6 REV amendment · [`../lld/theme-provider.lld.md`](../lld/theme-provider.lld.md) §5.3/§7/§9 trigger-fired notes · `theme-provider.md` (tokens-note prose) · `site/lib/__fixtures__/theme-provider-built.css` (LLD-C11 fixture refresh) |
> | **Supersedes / Superseded by** | **Amends [ADR-0117](./0117-theme-provider-shipped-component.md)** (cl.4's SPEC-R6 "exactly one rule / paints nothing" surface gains ONE zero-specificity inherited-ink declaration; every other clause stands) · Relates [ADR-0102](./0102-css-less-consumer-contract-law.md) (Lane A — component-owned identity, the routing the LLD itself predicted) · [ADR-0141](./0141-theme-packs-ultimate-tokens-pipeline.md) (cl.4/5 — TKT-0088's shell-dogfood leg is the second consumer that fired the trigger) |

## Context

`ui-theme-provider` re-roots `color-scheme` for its subtree (ADR-0117), but `light-dark()` only
re-resolves where a property *containing* it is declared. Ink inherited from outside the provider —
`_page.css` sets body `color: var(--md-sys-color-neutral-on-surface)` — is computed ONCE at the root
scheme and inherits into the subtree as a concrete channel value. Under a dark root with the provider
forced light (or the inverse), every bare-text descendant that never declares `color` paints the WRONG
scheme's ink: white headings and prose on light surfaces (issue #31's two screenshots).

The gallery hit this first (TKT-0002 class) and fixed it locally —
`:where(ui-theme-provider) { color: var(--md-sys-color-neutral-on-surface) }` in
`component-gallery.css` — and ADR-0117's LLD §5.3/§7/§9 deliberately did NOT fold that rule into the
component ("it would change SPEC-R6's contract and needs its own bite-tested regression suite"),
naming a precise trigger instead: *a second consumer independently hitting the same defect*. TKT-0088
(ADR-0141) made the site shell itself a `ui-theme-provider`; issue #31 is that second consumer, on
every docs page. The trigger has fired; per the LLD's own routing this is now ADR-0102 Lane A — the
component's identity concern, not a per-consumer patch.

## Decision

1. **The re-root moves into the component.** `theme-provider.css` gains exactly one declaration —
   `color: var(--md-sys-color-neutral-on-surface)` — in a zero-specificity `:where(ui-theme-provider)`
   block, so ANY consumer declaration (any real selector) outranks it. It mints no
   `--ui-theme-provider-*` token: the declaration consumes the shared, universally-consumable neutral
   ink role directly, which is the token-block grammar's sanctioned shape (family-coherence B-group;
   styling-gates ban only raw *dimensional* reads).
2. **Ink only, never a surface.** The rule re-resolves inherited `color` at the scheme boundary; the
   provider still paints no background, declares no geometry, and keeps `role: none`. The gallery's
   load-bearing invariant travels with the rule: every background reachable under a provider must
   itself be scheme-declared (all fleet surfaces are); bare text sitting directly on a
   NON-re-rooted ancestor's ground remains the consumer's own hazard, now documented in the sheet.
3. **The gallery-local copy retires.** `component-gallery.css`'s rule is deleted in favor of a pointer
   comment — one home for the fix (stale-context law); its behavior tests
   (`site/gallery.browser.test.ts`, the scheme-boundary describe) keep passing against the
   component-owned rule and stay where they are as the consumer-side proof.
4. **SPEC-R6 is amended, not silently contradicted.** "Exactly one rule (`display: block`)" becomes
   "the structural default plus the scheme-boundary ink re-root"; the amendment is REV-annotated in
   the (still-`proposed`) SPEC citing this ADR. The LLD's three named-not-solved entries (§5.3, §7,
   §9) gain dated trigger-fired notes rather than rewrites (append-only history).
5. **The bite-test is component-owned.** `theme-provider.browser.test.ts` gains the light-in-dark
   bare-text leg (dark ancestor scheme → `scheme="light"` provider → bare text child's computed ink is
   the LIGHT-resolved role), both engines — the regression suite whose absence deferred the fold-in.

## Consequences

- Any app embedding `ui-theme-provider` around bare text now gets correct ink at the scheme boundary
  with zero consumer CSS — the CSS-less-consumer law honored for the component's own boundary defect.
- The site shell (`ui-theme-provider.app-shell`) needs no shell-local patch; `_page.css` stays
  untouched. Body-level ink outside any provider is unaffected.
- `site/lib/__fixtures__/theme-provider-built.css` (LLD-C11) is regenerated — the site bundle's CSS
  text changes in both directions (rule added in the component sheet, removed from the gallery sheet).
- A consumer that WANTS the raw inherited ink to leak through a scheme boundary can no longer get it
  by default; declaring `color: inherit` on the provider restores it (zero-specificity rule, any real
  selector wins). No known consumer wants this.
