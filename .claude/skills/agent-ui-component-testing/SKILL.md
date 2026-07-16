---
name: agent-ui-component-testing
description: >-
  Route to the per-control TEST BAR for a ui-* component: which probes a component must carry
  (descriptor trip-wires, jsdom geometry/token checks, cross-engine browser truth,
  built-output proofs), the whole-shape law, the known jsdom blind spots, and the gates that
  must be green before a control-wave commit. Use for "what tests does this control need",
  "is jsdom enough here", "how do I prove this against the production build", "what gates run
  before commit" — when planning or judging a component's test plan. Routing only: the
  exemplar tests and gate sources are the authority (cite, never copy). NOT for design-time
  law (agent-ui-component-standards) or disk layout (agent-ui-component-packaging).
user-invocable: false
disable-model-invocation: false
---

# Component testing — the per-control bar's map

What "tested" means for a `ui-*` component, and which realized tests to pattern from. The
exemplars ARE the standard — read them, don't re-derive.

## The bar, layer by layer

| Layer | What it proves | Pattern from (exemplar) |
|---|---|---|
| Descriptor trip-wire | frontmatter ≡ `finalize(Class)` AND ≡ source (`customStates`/slots) | `packages/agent-ui/components/src/descriptor/component-descriptor-{driftwire,sourcewire}.test.ts`; per-control `{name}-descriptor.test.ts` (theme-provider's is the newest) |
| jsdom behaviour + geometry/token trip-wires | props/events/form behavior; the geometry/centering trip-wires per [[agent-ui-component-standards]]'s law; every `--ui-{cmp}-*` declared in `:where()`; no raw primitive refs; no dimensional-constant reads in `@scope` (fleet-wide: `controls/styling-gates.test.ts`, the TKT-0066 item 5 ruling) | `controls/checkbox/` (the gold template) · `controls/button/` |
| Cross-engine browser truth (Chromium + WebKit, `{name}.browser.test.ts`) | rendered px responds to `[size]`/`[scale]`/`[density]`; survives `forced-colors`; **the WHOLE rendered bounding box in a realistic container** (the whole-shape law — per-part px can all pass while the control collapses to a dot; assert the gestalt) | `controls/checkbox/checkbox.browser.test.ts`; the negative-control probe pattern in `site/pages/a2a-artifact-feed.browser.test.ts` (proves a width-floor assertion non-vacuous) |
| Built-output proofs (when the behavior depends on the PRODUCTION build) | the shipped CSS/JS bytes behave — dev-green ≠ built-green (TKT-0002: LightningCSS downleveled `light-dark()` and broke per-subtree `color-scheme`; only a built-output test catches the class) | the two-test bridge: `site/lib/theme-provider-build-fixture.test.ts` (node-side real `vite build`, byte-identity vs a committed fixture — red names its own fix: regenerate) + `site/lib/theme-provider-build.browser.test.ts` (`?raw` fixture import, real `getComputedStyle`); shared build via `site/lib/build-css.ts` |
| End-to-end (form controls) | keyboard-only, behaves-like-a-user flows — the archaeology instrument that catches what unit probes bypass | `packages/agent-ui/components/src/controls/form-provider/form-e2e.browser.test.ts` |

## jsdom blind spots (route the proof to a browser test)

- `light-dark()` / `color-scheme` resolution — jsdom cannot resolve either.
- Vite `?raw` imports resolve EMPTY under jsdom, real under the browser project.
- Real layout/scroll geometry (`getBoundingClientRect` truths, scroll regions).
- UA event-dispatch microtask timing differs from scripted dispatch (the ADR-0051 lesson).
- vitest-browser locators are blind to internals-only ARIA — read `internals` directly.
- jsdom's real `ElementInternals` has NO `setFormValue`/`setValidity` — every jsdom test file
  that connects a FACE form control (directly OR composed, e.g. via `entry-list.ts`) MUST
  carry the `attachInternals` stub (the `conversation.test.ts` pattern, or `textarea.test.ts`'s
  per-instance variant). The symptom of a missing stub is deceptive: **all assertions pass**
  (custom-element reaction errors never propagate to calling script) while vitest separately
  reports hundreds of uncaught exceptions and a red exit code (TKT-0055 — misfiled as a kernel
  bug for exactly this reason).
- **No node APIs in any `.browser.test.ts`** — they execute IN the browser; a build shell-out
  belongs in a plain node-side `.test.ts` (the two-test bridge exists exactly for this).

## Traps

- Scheme-divergence proofs: some color roles are deliberately scheme-invariant — verify the
  role's two `light-dark()` branches in `tokens.css` differ before asserting divergence.
- Geometry assertions: heights/fonts STEP across adjacent tiers — assert the exact §1
  integers, never all-distinct (see [[agent-ui-component-standards]]).
- A committed built-CSS fixture spans the whole site bundle — unrelated site CSS edits redden
  its freshness gate until regenerated; that red names its own fix, not a regression.
- Color-repaint assertions must read the element that RENDERS the visible content, never just
  the host frame: a host-level `getComputedStyle(host).color` read passes even when a child
  editor part's own `color: var(--token)` declaration silently pins the visible text to the
  old value — the TKT-0062 vacuous-test bug, live in 3 of 5 components until an independent
  review probed the editor. Pattern: the `TKT-0062` blocks in
  `controls/text-field/text-field-states.browser.test.ts` (editor-targeted, poll-based).
- After an imperative-DOM-write → reactive-prop refactor, SWEEP the sibling `.browser.test.ts`
  files for synchronous assertions on the old call path and add `await whenFlushed()`: the
  effect is now microtask-batched, so a synchronous assertion keeps passing VACUOUSLY (it reads
  the pre-flush state that happens to match its expectation) — and un-vacuousing one such test
  is exactly what unmasked the real TKT-0057 engine-split bug. "It still passes" ≠ "it still
  tests the right thing."
- Scroll offsets do NOT survive disconnect/reconnect by node identity — BOTH engines reset a
  removed scroll container to 0 (scroll state lives in the LAYOUT tree, not the DOM node), and
  `disconnected()` reads 0 too (already out of the document — too late). A reconnect probe must
  scroll, **wait a double-rAF so the async `scroll` event fires before detach** (a live
  listener-shadow is the only capture point), then detach/reattach and assert node identity AND
  the restored offset separately — they regress independently. Pattern: the TKT-0067 probe in
  `controls/table/table.browser.test.ts` (with its anti-vacuous overflow guards).
- MUTATION-VERIFY a new pin test: disable the exact code it pins and prove the test FAILS, then
  restore. "Passes with the fix live" alone can be vacuous — the TKT-0068 radio probe found all
  205 existing radio-family tests pass with the tabindex correction deleted; only the new
  `group-tabindex-late-append` pin (written for the measured load-bearing case) bites. Same
  discipline as the negative-control probe, applied to code instead of a selector.
- Text-scanning CSS (structural pins, fleet gates): STRIP COMMENTS FIRST, preserving newlines —
  a banner comment quoting `@scope (ui-x)` or `var(--token)` matches a naive regex and produced
  a 44-file false census where the comment-stripped truth was 9 (TKT-0066 item 5's sweep).
  Pattern: `stripComments` in `controls/styling-gates.test.ts`.

## The gates (before a control-wave commit)

1. `npm run check` (tsc + site) and `npm test` — both green, read separately.
2. The control's `.browser.test.ts` green on BOTH engines — jsdom-green ≠ done.
3. `npm run size` by hand when the bundle surface changed (manual by Kim's ruling).
4. **Independent review is non-optional**: the `component-reviewer` agent grades before the
   commit (generator ≠ critic) — it has caught real cross-engine bugs green suites bypassed.
5. New site pages drag the standing site gates: `site-canon`, `site-toc`,
   `site-coverage` (all under `components/src/descriptor/`), and the llms byte-gate
   (`site/lib/llms.test.ts` — regenerate via `node scripts/generate-llms-full.mjs` after
   descriptor/CHANGELOG/page changes).

## Cross-links

Design-time law → [[agent-ui-component-standards]] · descriptor schema/packaging →
[[agent-ui-component-packaging]] · the build procedure these gates close →
[[agent-ui-component-create]] · the intake that writes the test PLAN →
[[agent-ui-component-design]].
