---
name: component-testing
description: >-
  Route to the per-control TEST BAR for a ui-* component: which probes a component must carry
  (descriptor trip-wires, jsdom geometry/token checks, cross-engine browser truth,
  built-output proofs), the whole-shape law, the known jsdom blind spots, and the gates that
  must be green before a control-wave commit. Use for "what tests does this control need",
  "is jsdom enough here", "how do I prove this against the production build", "what gates run
  before commit" — when planning or judging a component's test plan. Routing only: the
  exemplar tests and gate sources are the authority (cite, never copy). NOT for design-time
  law (component-standards) or disk layout (component-packaging).
user-invocable: false
disable-model-invocation: false
---

# Component testing — the per-control bar's map

What "tested" means for a `ui-*` component, and which realized tests to pattern from. The
exemplars ARE the standard — read them, don't re-derive.

## The bar, layer by layer

| Layer | What it proves | Pattern from (exemplar) |
|---|---|---|
| Descriptor trip-wire | frontmatter ≡ `finalize(Class)` AND ≡ source (`customStates`/slots) | `packages/agent-ui/components/src/descriptor/component-descriptor-{driftwire,sourcewire}.test.ts`; per-control `{name}-descriptor.test.ts` (any recent control's is a current exemplar) |
| jsdom behaviour + geometry/token trip-wires | props/events/form behavior; the geometry/centering trip-wires per [[component-standards]]'s law; every `--ui-{cmp}-*` declared in `:where()`; no raw primitive refs; no dimensional-constant reads in `@scope` (fleet-wide: `controls/styling-gates.test.ts`, the TKT-0066 item 5 ruling) | `controls/checkbox/` (the gold template) · `controls/button/` |
| Cross-engine browser truth (Chromium + WebKit, `{name}.browser.test.ts`) | rendered px responds to `[size]`/`[scale]`/`[density]`; survives `forced-colors`; **the WHOLE rendered bounding box in a realistic container** (the whole-shape law — per-part px can all pass while the control collapses to a dot; assert the gestalt) | `controls/checkbox/checkbox.browser.test.ts`; the negative-control probe pattern in `site/pages/a2a-artifact-feed.browser.test.ts` (proves a width-floor assertion non-vacuous) |
| Built-output proofs (when the behavior depends on the PRODUCTION build) | the shipped CSS/JS bytes behave — dev-green ≠ built-green (TKT-0002: LightningCSS downleveled `light-dark()` and broke per-subtree `color-scheme`; only a built-output test catches the class) | the two-test bridge: `site/lib/theme-provider-build-fixture.test.ts` (node-side real `vite build`, byte-identity vs a committed fixture — red names its own fix: regenerate) + `site/lib/theme-provider-build.browser.test.ts` (`?raw` fixture import, real `getComputedStyle`); shared build via `site/lib/build-css.ts` |
| End-to-end (form controls) | keyboard-only, behaves-like-a-user flows — the archaeology instrument that catches what unit probes bypass | `packages/agent-ui/components/src/controls/form-provider/form-e2e.browser.test.ts` |

## Detail — read `references/test-craft.md` when

- Writing a new browser-test settle helper (writer vs observer pacing choice), or porting one.
- A test is flaky or suspiciously vacuous — the jsdom blind-spot list + the accumulated Traps
  section (scroll-reconnect, scheme-divergence, comment-stripping, mutation-verify) name the
  known failure shapes before you re-derive one.
- Deciding whether a proof belongs in jsdom or a real-engine browser shard, or touching
  `vitest.browser.config.ts`'s shard split / `FOCUS_TIMING_FILES` (browser-shard discipline).

## The gates (before a control-wave commit)

1. `npm run check` (tsc + site) and `npm test` — both green, read separately.
2. The control's `.browser.test.ts` green on BOTH engines — jsdom-green ≠ done.
3. `npm run size` by hand when the bundle surface changed (manual by Kim's ruling).
4. **Independent review is non-optional**: the `frontend:component-checker` agent grades before the
   commit (generator ≠ critic) — it has caught real cross-engine bugs green suites bypassed.
5. New site pages drag the standing site gates: `site-canon`, `site-toc`,
   `site-coverage` (all under `components/src/descriptor/`), and the llms byte-gate
   (`site/lib/llms.test.ts` — regenerate via `node scripts/generate-llms-full.mjs` after
   descriptor/CHANGELOG/page changes).

## Cross-links

Design-time law → [[component-standards]] · descriptor schema/packaging →
[[component-packaging]] · the build procedure these gates close →
[[component-build]] · the intake that writes the test PLAN →
[[component-design]].
