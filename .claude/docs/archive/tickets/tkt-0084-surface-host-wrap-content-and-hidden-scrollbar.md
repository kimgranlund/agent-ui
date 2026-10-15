---
doc-type: ticket
id: tkt-0084
status: done
date: 2026-07-17
owner:
kind: bug
size: small
---
# TKT-0084 — `ui-surface-host` forces a fixed artboard size (clipping tall content, showing a visible scrollbar); no option to wrap its content

## Summary
Kim's screenshot (2026-07-17, agent-admin-app.html, a live blackjack-table surface mounted inline
in a `ui-conversation` bubble): the surface's "Stand" button is visibly cut off at the bottom, a
native browser scrollbar is visible on the right, and the checkerboard artboard background shows
through on the LEFT/RIGHT of the centered card content (a width mismatch). Kim: "A2UI
root/container/canvas should have the option [to] wrap contents and not have to overflow. and
when it overflows we should hide scrollbars."

Root-caused (grep + read, not guessed):
- **Height clip:** `packages/agent-ui/app/src/controls/conversation/conversation.css:125-128`
  hardcodes `block-size: 16rem` on every `ui-surface-host` mounted inline in a bubble, regardless
  of the mounted content's actual height. Taller content (the blackjack table + Hit/Stand buttons)
  gets clipped and scrolled inside `ui-surface-host`'s own `overflow: auto` regions.
- **Visible scrollbar:** `packages/agent-ui/app/src/controls/surface-host/surface-host.css` has
  **zero `scrollbar-width` declaration anywhere** — both `overflow: auto` regions
  (`[data-part='stage']` line 39, `[data-part='surface']` line 68) fall back to the platform's
  default VISIBLE scrollbar. The fleet already has a "hidden scrollbar, still scrollable" pattern
  elsewhere (`agent-admin.css:23`'s `--ui-agent-admin-scrollbar-width: none` repointing
  `--ui-conversation-scrollbar-width`/`--ui-split-pane-scrollbar-width`) — `ui-surface-host` never
  joined that seam; there is no `--ui-surface-host-scrollbar-width` token at all.
- **Width mismatch (the checkerboard bleed):** `[data-part='surface']` (surface-host.css:46-69) is
  absolutely positioned, translate-centered inside a `100%`-wide `[data-part='stage']`, capped at a
  fixed `inline-size: min(32rem, calc(100% - 2rem))`. When the stage is wider than 32rem (a wide
  chat viewport), the checkerboard shows on both sides of the centered, narrower content box.
- **No "wrap contents" option exists at all** — `ui-surface-host`'s `:scope` is hardcoded
  `inline-size: 100%; block-size: 100%` (surface-host.css:24-31); it always fills whatever definite
  size its consumer gives it and never sizes itself to its mounted content. `surface-host.ts`'s
  props schema (`label` only) has no such knob either.
- **The design constraint this must reconcile with:** ADR-0100 cl.2 (accepted, ratified) requires
  `[data-part='surface']`'s INLINE size to be externally-determined (fixed/stretched/track-sized,
  never content-derived) so it can validly declare `container-type: inline-size` — the boundary the
  fleet's `ui-row`/`ui-column`/etc. `@container` reflow rules resolve against. A content-hugging
  WIDTH option is therefore only safe as an explicit opt-in that ALSO drops `container-type` for
  that instance — ADR-0100 itself names this exact tradeoff as acceptable graceful degradation
  ("without one, the reflow rules never match... graceful, never an axis flip"), never something to
  default silently. The BLOCK (height) axis carries no such constraint — `container-type:
  inline-size` only contains the inline axis, so a content-hugging height is unconstrained by
  ADR-0100 and safe to fix more broadly.

## Acceptance
- `ui-surface-host` gains an opt-in boolean prop, `wrap` (reflect: true, default `false` — zero
  behavior change for existing consumers): when set, the artboard sizes to its mounted content on
  BOTH axes (no forced fixed height/width, no clipping in the common case) instead of the current
  always-fixed-size/always-scrollable artboard. Anatomy change required: `[data-part='surface']`
  switches from `position: absolute` + translate-centering to normal in-flow centering (the stage
  becomes a flex container centering its one child) when `wrap` is set — an absolutely positioned
  box contributes no intrinsic height to its parent, so simply relaxing `block-size` alone cannot
  work while `surface` stays absolute.
- `wrap` mode DROPS `container-type: inline-size` on `[data-part='surface']` (ADR-0100 cl.2's own
  named tradeoff — content-derived width cannot validly be a query container) — nested layout
  primitives inside a wrapped surface render their default/identity layout, never a corrupted 0px
  collapse. This tradeoff is documented inline (CSS comment) and in the Findings, not silently
  shipped.
- A sane `max-block-size` cap remains in `wrap` mode (oversized content still scrolls rather than
  blowing out page layout) — "wrap contents and not have to overflow" covers the common case, not
  an unconditional no-scroll guarantee.
- **Scrollbar hiding is unconditional, independent of `wrap`:** a new
  `--ui-surface-host-scrollbar-width` token (default `none` — hidden, still scrollable via
  wheel/touch/keyboard) applied to both `overflow: auto` regions, consumer-overridable via the same
  repoint seam `--ui-conversation-scrollbar-width` already uses.
- `ui-conversation`'s inline mount site (`conversation.css`/`conversation.ts`) sets `wrap` by
  default on the surfaces it mounts inline in a bubble (the exact context the screenshot reports)
  — a chat bubble should hug its rendered surface's content, not clip it to an arbitrary 16rem.
  Standalone usage (e.g. `a2ui-live`'s persistent Canvas tab panel) is UNCHANGED — it never sets
  `wrap`, keeping today's fill-the-container behavior, which is correct there (a persistent canvas
  region, not a chat bubble).
- `surface-host.md`'s attributes-as-API descriptor gains the `wrap` prop row (the contract↔props
  trip-wire, `surface-host.test.ts`, must stay green).
- Verified live in a real browser (not just unit tests): the exact repro (a tall card-game surface
  mounted inline) renders without clipping and without a visible scrollbar in the common case;
  before/after screenshots.
- `ui:component-reviewer` dispatched before this is called done (an anatomy change — the
  absolute→in-flow centering switch — plus a ratified-ADR interaction is exactly its remit).
- `npm run check && npm test` green.

## Repro
No fixed repro needed — visible whenever an A2UI-mounted inline surface's content is taller than
16rem or the surface box's `min(32rem, …)` width is narrower than its containing bubble: content
clips at the bottom, a native scrollbar appears, and the checkerboard shows through on the sides.

## Expected vs actual
- **Expected:** an inline-mounted chat surface hugs its content's real size (no arbitrary clip),
  and any scrollbar that IS needed (oversized content) stays hidden while remaining scrollable.
- **Actual:** every inline surface is hard-capped at a fixed 16rem height and a ≤32rem width,
  clipping taller/wider content and showing a raw, visible platform scrollbar.

## Classification
Axis: **structural** (component anatomy — a missing sizing mode, not a broken existing one) with a
**design-constraint interaction** (ADR-0100 cl.2's query-container establishment law, which any
content-hugging WIDTH option must explicitly trade off, never silently break).
Plane: `packages/agent-ui/app/src/controls/surface-host/{surface-host.ts,surface-host.css,surface-host.md}`
(the new `wrap` prop + anatomy) × `packages/agent-ui/app/src/controls/conversation/{conversation.ts,conversation.css}`
(the inline mount site, + the new scrollbar-hiding default).

## Severity
**major** — not a hard functional break (the content is still reachable by scrolling), but a
primary interactive control (the "Stand" button) renders invisible/cut-off by default in the
flagship live-surface showcase, and the visible scrollbar + checkerboard bleed read as visibly
broken chrome on every inline A2UI surface, not an edge case.

## Links
- ADR-0100 (query-container boundary establishment) — the ratified constraint this fix's `wrap`
  mode explicitly trades off (drops `container-type: inline-size`), never silently reopens.
- [TKT-0076](tkt-0076-agent-admin-real-a2ui-surfaces.md) — the surface arm this bubble-mounted
  artboard belongs to.
- `agent-admin.css:23` — the existing `--ui-agent-admin-scrollbar-width: none` "hidden scroller,
  live scroll" precedent this fix's scrollbar token follows.

## Findings

### 2026-07-17 — `wrap` prop + hidden-scrollbar token shipped, one CRITICAL review finding fixed

**Fix, first pass:**
- `surface-host.ts`: new opt-in `wrap` boolean prop (reflect, default false — zero behavior change
  for existing standalone consumers, e.g. a2ui-live's persistent Canvas tab panel).
- `surface-host.css`: `--ui-surface-host-scrollbar-width: none` applied unconditionally to both
  `overflow:auto` regions (`stage`/`surface`) — hidden, still scrollable, regardless of `wrap`.
  `--ui-surface-host-wrap-max-block-size: 32rem` caps oversized wrapped content. `[wrap]` anatomy:
  `surface` switches `position:absolute`+translate → `position:static`, `stage` gains
  `display:flex`; `[data-part='surface']` drops `container-type: inline-size` → `normal` (ADR-0100
  cl.2's own named tradeoff — a content-derived inline size cannot validly be a query container;
  nested primitives resolve `@container` reflow against the nearest ANCESTOR boundary instead, or
  render identity if none exists).
- `conversation.ts`: sets `host.wrap = true` on every surface mounted inline in a bubble (the exact
  context the bug reports); `conversation.css`: removed the now-dead hardcoded `block-size: 16rem`.
- `surface-host.md` (descriptor) + `surface-host.test.ts` (`ATTR_NAMES`) updated for the new prop.

**`ui:component-reviewer` dispatched (fresh context) — verdict 🟡 attention, one CRITICAL finding
(B4, "designed right, built wrong"):** centering the wrap-mode artboard via `align-items:center;
justify-content:center` on the SCROLLING flex container (`stage`) splits any over-cap overflow
SYMMETRICALLY — content taller than the 32rem cap renders half above / half below, and `scrollTop`
cannot go negative to reach the top half, so it is **permanently clipped and unreachable** —
exactly the "Stand button cut off" defect class this ticket exists to fix, resurrected the moment
content exceeds the cap. Reviewer's real headless-Chromium probe measured ~210px of a 900px surface
unreachable under a 512px cap. My own live verification never exercised the cap (content stayed at
244-304px, well under 512px), which is why this was missed.

**Fixed:** `margin: auto` on the wrap-mode `[data-part='surface']` flex item (removing
`align-items`/`justify-content: center` from `stage`) — the standard fix: auto margins center when
free space exists but collapse to 0 in the overflow direction, keeping the start edge
scroll-reachable at `scrollTop: 0` regardless of how far over the cap content runs.

**Regression-pinned with a NEW permanent browser test leg** (`surface-host.browser.test.ts`, 3 new
`[wrap]` tests, cross-engine): content-hug (small content sizes the artboard, no scroll needed),
empty-state collapse (placeholder-only, no huge fixed box), and the CRITICAL reachability pin
(40-line + button payload exceeding the cap — asserts the first element is visible at `scrollTop:
0` and the last element is visible at `scrollTop: max`). **Proved the pin actually catches the bug**:
reverted `surface-host.css` to the pre-fix `align-items:center` version, re-ran — the pin failed on
BOTH engines with `expected -158 to be greater than or equal to -1` (the exact measured clipping,
matching the reviewer's own probe almost exactly); restored the fix, re-ran — 12/12 green both
engines. This addresses the reviewer's own question 8 ("should a `.browser.test.ts` be required" —
yes, and it now exists).

**Gates:**
- `npx vitest run packages/agent-ui/app` — 354/354 (worktree).
- `npx vitest run --config vitest.browser.config.ts .../surface-host.browser.test.ts` — 12/12,
  Chromium + WebKit.
- `npm run check` — green.
- `site/lib/__fixtures__/theme-provider-built.css` regenerated (the documented whole-bundle-CSS
  drift note — any component CSS byte reddens this fixture; regenerated via a real `vite build`
  per the test file's own banner, standard process, not a defect).
- Full gate cross-verified against the main tree (temp-copy technique, reverted after): **346
  files / 6332 tests green.** Note: the main tree is moving fast under a separate concurrent
  session's commits — the fixture will likely need a routine re-regenerate again at actual merge
  time; that's expected, not a defect in this change.

**Environment note (unrelated to the fix, but blocked verification until diagnosed):** this
worktree's `node_modules` was empty (git worktrees don't get their own `npm install`), so
package-level imports (`@agent-ui/app`, `@agent-ui/a2ui`, etc.) were silently resolving UP to the
main tree's `node_modules/@agent-ui/*` symlinks — meaning the dev server was serving STALE
(pre-edit) component code for an hour of live-browser verification, producing misleading identical
before/after measurements. Fixed by adding matching `node_modules/@agent-ui/*` → `../../packages/
agent-ui/*` symlinks inside the worktree (mirroring the main tree's own workspace layout exactly).
Flagging this as a durable gotcha for any future worktree session that needs `npm run dev`/a real
browser, not just `vitest` (which resolves relative imports directly and was unaffected).

Files touched: `packages/agent-ui/app/src/controls/surface-host/{surface-host.ts,surface-host.css,
surface-host.md,surface-host.test.ts,surface-host.browser.test.ts}`,
`packages/agent-ui/app/src/controls/conversation/{conversation.ts,conversation.css}`,
`site/lib/__fixtures__/theme-provider-built.css` (regenerated).
