# Component testing — craft detail

Harvested from `component-testing`'s own body (2026-08-15 extraction, GH #929/wave-2 W2-5) —
the jsdom blind-spot list, the accumulated traps, the settle-helper writer/observer split, and
browser-shard discipline. The SKILL.md's "bar, layer by layer" table and its gate checklist stay
inline; this file is the detail behind them. Read when: writing a new browser-test settle
helper, chasing a flaky/vacuous test, or deciding whether a proof belongs in jsdom or a browser
shard.

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
  integers, never all-distinct (see [[component-standards]]).
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
- A fresh worktree WITHOUT its own `npm install` resolves `@agent-ui/*` through the MAIN
  checkout's node_modules — import-resolving tests/builds silently exercise main's sources, and
  Vite's fs-allow denies `?raw` modules. Give the worktree its OWN `node_modules` — but by
  SYMLINK, not install (Kim ruling 2026-08-20, the load-108 incident: seven parallel lane
  installs + Spotlight indexing the churn saturated the host): lockfile unchanged vs origin/main
  ⇒ the PER-ENTRY symlink recipe in `seat-map`'s Dispatch laws (amended 2026-08-19: a whole-root
  symlink splits TS type identity — the root's @agent-ui/* workspace links point at MAIN's
  packages/, yielding phantom TS2345s on a clean tree; the recipe symlinks third-party entries and
  re-links @agent-ui/* to the worktree's own packages); lockfile changed ⇒ `npm ci
  --prefer-offline`; then `readlink node_modules/@agent-ui/shared` MUST resolve inside the
  worktree before trusting any import-resolving gate. The
  dispatch-side ceilings (≤3 concurrent gate-running lanes, `--maxWorkers=4` per lane, reap
  worktrees on lane-return) live in `seat-map`'s Dispatch laws.
- Bundle-shape gates (the built-output-proofs bar, applied to lazy splits): assert the arm is
  absent from the transitive **EAGER CLOSURE** — entry chunks PLUS every chunk they statically
  import, walked to a fixed point — never merely from `isEntry` chunks. A lazy accessor's arm can
  leak into a STATIC SHARED chunk the entry imports eagerly (`isEntry: false` yet loaded with the
  barrel), so "absent from isEntry chunks" passes VACUOUSLY on exactly the regression it exists to
  catch. Pattern: `chunksOf`'s eager `Set` (seeded from `isEntry`, expanded over `imports`) in
  `packages/agent-ui/app/src/controls/agent-admin/agent-admin-lazy.bundle.test.ts` (ADR-0197,
  refining the markdown-lazy precedent), with its anti-vacuous non-empty-closure guard and the
  negative control (a synthetic statically-importing entry DOES land the arm eagerly).
- **Thin ink does not police at the fleet's default visual tolerance — measure before pinning a
  hairline.** A 1px border baseline measured 1 changed pixel at `includeAA:false, threshold:0.1`
  (the harness default) — AA-edge classification and a sub-threshold colour delta both absorb it,
  independently. The same pixel diff read 7 at `includeAA:true, threshold:0.1` and 997 at
  `includeAA:true, threshold:0.02` (GH #382/#383's overlay-divider pin). Any new hairline/thin-line
  baseline needs the SAME measurement pass (plant the defect, measure the diff count at each
  candidate setting, pick the one that separates present-from-absent) or its "green" proves
  nothing — small text isn't the only thing default settings fail to see.

## Settle helpers — writer vs observer

One question decides every pacing choice in a settle helper: does it WRITE the value it reads
back, or OBSERVE an animation it does not drive? (GH #359/#364/#365/#366.)

- **Writer** — e.g. `scrollTop = scrollHeight` with no `scroll-behavior`. The read-back is
  synchronous and layout-derived, so TIMER pacing is correct and frame pacing is wrong: rAF
  shrinks the stability window, and it stalls outright on a hidden tab where the log must stay
  pinned. Pattern: the public `followTail()` seam on
  `packages/agent-ui/app/src/controls/conversation/conversation-dialog.ts` (discriminated resolve —
  promoted verbatim off conversation.ts's old `#tailFollowLog`, whose name this line once cited, GH #761).
- **Observer** — e.g. a smooth `scrollIntoView`. Positions commit only at PAINT, so it must
  sample once per painted frame (N identical painted frames is evidence; N identical timer
  reads is not — queued timers drain back-to-back under starvation) PLUS a wall-clock floor.
  Pattern: `waitUntilSettled` in
  `packages/agent-ui/components/src/controls/status-stream/status-stream.browser.test.ts`.
- An observer's own guarantee-tests need MORE timeout headroom than the live call sites — the
  #359 guard measured 5× more fragile than the code it guarded.
- **Exhaustion always reports**: throw with a diagnostic naming elapsed ms, painted frames, and
  the last read. Race the frame wait against the remaining budget so a suspended page (zero
  rAF) reports "0 painted frames" instead of stranding into the runner's bound.
- Before porting a fix between helpers: re-read the CURRENT upstream (one port faithfully
  copied a pre-fix snapshot), and check every call site discards or consumes the return — a
  throw is only safe where the value is discarded.

## Browser-shard discipline

`npm run test:browser` runs SIX SEQUENTIAL vitest shards (packages:components → packages:app →
packages:rest → site → focus-timing → visual; GH #41) — never re-monolith it or add a heap
bump. A single shard nearing the default ceiling splits further: the `packages` project split
2026-07-19 (measured red on `main` pre-diff), and `:rest` split again the same day when it
flipped 134 under load. `focus-timing` (GH #56, 2026-07-19) is a NAMED, CLOSED set of
focus/keyboard/scroll-timing files pulled out of `packages`/`site` and run with zero file
parallelism — they flake under concurrent-page focus contention, not component defects (each
passes solo); a future addition to that class is a one-line append to
`vitest.browser.config.ts`'s `FOCUS_TIMING_FILES`, not a new shard.

A seventh, NON-vitest step runs after these six: `test:eval-catalog`
(`scripts/eval-catalog-gate.mjs`, GH #1356) — its own vite dev server + real playwright
Chromium against `site/a2ui-catalog.html`, mirroring `scripts/e2e-devtools.mjs`'s
freePort/killTree boot-a-server shape rather than a vitest project. It's appended to the
`test:browser` chain, not the six-shard vitest count above — the two counts stay distinct
because this step has no vitest project to split or heap-bump in the first place.
