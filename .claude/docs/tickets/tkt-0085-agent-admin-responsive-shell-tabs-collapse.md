---
doc-type: ticket
id: tkt-0085
status: done
date: 2026-07-17
owner:
kind: feature
size: big
---
# TKT-0085 — `ui-agent-admin`'s 3-pane split collapses into tabs at two narrower breakpoints (Kim's design)

## Summary
Kim's direct design ask (2026-07-17, a screenshot of the current always-3-pane shell + an ASCII
spec): `ui-agent-admin`'s `[ Chat | Instructions | Agent ]` split should collapse responsively —
wide stays 3-pane side-by-side (today's only behavior); a medium breakpoint becomes
`[ Chat | {Instructions, Agent} tabs ]`; the narrowest breakpoint becomes
`[ {Chat, Instructions, Agent} tabs ]`.

No existing fleet mechanism does this. Investigated first: `ui-app-shell`'s `collapse` enum and
`ui-master-detail`'s narrow drill-in are BOTH pure CSS `@container` visibility toggles — the DOM
structure never changes, only `display`/`hidden` flips on content that stays in its ORIGINAL
structural parent. `ui-tabs` has a structurally different anatomy (a tablist strip + panel
siblings) that `@container` CSS alone cannot produce from `ui-split`'s flex-pane markup — this
needed a genuine DOM reparent, a mechanism the fleet had never built before.

## Acceptance
- Three named layouts (`wide`/`medium`/`narrow`), JS-computed via a `ResizeObserver` on
  `ui-agent-admin`'s own box (no existing fleet `@container` breakpoint can drive a reparent —
  `@container` only controls visibility of already-placed DOM).
- Thresholds: `WIDE_MIN_PX = 1024` (64rem — new, chosen with headroom above the 3-pane mechanical
  floor: canvas 16rem + prompts 10rem + settings 20rem = 46rem/736px hard minimum) and
  `NARROW_MAX_PX = 640` (40rem — the repo's ONE existing precedent value, `app-shell.css`/
  `master-detail.css`'s own collapse threshold, reused rather than inventing a third number).
- Content nodes (`ui-conversation`, the Instructions section host, an Agent-pane content wrapper)
  are MOVED between homes, never cloned or rebuilt — the `master-detail.ts` "relocate a whole
  pane" idiom, generalized from 2 possible homes to 3 per content unit.
- The medium/narrow `ui-tabs` shells are built ONCE at compose time (idempotent, matching this
  file's own discipline) with their full tab/panel set present from the start — only CONTENT moves
  in/out of already-existing, never-added-or-removed panels.
- `#applyLayout` is idempotent — a resize within the same band is a no-op (compares against the
  currently-applied layout before doing anything).
- Verified live in a real browser at all 3 breakpoints (screenshots) — not just unit-tested.
- `ui:component-reviewer` dispatched before this is called done.
- `npm run check && npm test` green, including new coverage for the responsive behavior itself
  (jsdom: DOM restructuring at each band + content-identity survival across a round trip via a
  stubbed, manually-driven `ResizeObserver`; browser: real computed-style `[hidden]` verification
  + real click-driven tab switching + the accepted live-surface-closes-on-crossing behavior).

## Repro
No fixed repro — a feature request, not a bug. Reference shape:
```
wide:   [ Chat | Instructions | Agent ]
medium: [ Chat | {tabs: Instructions, Agent} ]
narrow: [ {tabs: Chat, Instructions, Agent} ]
```

## Expected vs actual
- **Expected:** the shape above, at 1024px/640px thresholds, content preserved across crossings.
- **Actual (pre-fix):** always the 3-pane split, unconditionally, regardless of viewport/container
  width — unusable on a narrow viewport (panes squeeze past their own `min` floors).

## Classification
Axis: **structural** (a new responsive-composition pattern, no existing mechanism to extend) with
a **design-constraint interaction** (ADR-0100's query-container boundary law — not directly
touched, since this feature's breakpoint detection is JS/ResizeObserver-driven, not `@container`-
driven; noted for completeness since it was the first thing checked).
Plane: `packages/agent-ui/app/src/controls/agent-admin/{agent-admin.ts,agent-admin.css,
agent-admin.test.ts,agent-admin.browser.test.ts}` × `packages/agent-ui/components/src/controls/
naming-gates.test.ts` + `.claude/docs/references/naming.md` (2 new registered `data-role` values)
× `vitest.config.ts` (a new `@agent-ui/components/controls/tabs` jsdom alias — the first
consumer of that subpath from outside the components package).

## Severity
N/A (feature, not a bug) — but the DEFECT this ticket's own build caught and fixed mid-flight
(see Findings) was **major**: the responsive shell's `ui-tabs` shells rendered PERMANENTLY VISIBLE
underneath the wide 3-pane split (an author `display:flex` beating the UA `[hidden]{display:none}`
rule, a known pitfall class this repo has hit before — the entry-add-form/combo-box.css precedent)
until caught by live-browser verification and fixed with an explicit `[hidden]` guard.

## Links
- `packages/agent-ui/app/src/controls/app-shell/app-shell.css` / `master-detail/master-detail.css`
  — the two existing (non-reparenting) `@container` collapse precedents investigated and NOT reused
  as-is (their mechanism can't do what this ticket needs).
- `.claude/docs/tickets/tkt-0035-nav-rail-collapse-threshold-coupling.md` — the fresh (4 days prior)
  precedent for the self-vs-ancestor container-measurement question; this feature self-measures
  (matching `app-shell`/`master-detail`'s majority pattern, not nav-rail's escape hatch — agent-admin
  is normally a full top-level surface, the same context those two are used in).
- ADR-0022 (the `moveBefore` atomic-move seam, `dom/template.ts`) — investigated as a way to avoid
  closing an open A2UI surface on a breakpoint crossing; REVERTED. **Corrected finding (F4, see
  Findings):** `moveBefore` provides no benefit here at all — this fleet has no
  `connectedMoveCallback` support, so it cycles the SAME lifecycle callbacks as plain `append()`; the
  original "silent, callback-free content loss" symptom traced to a `HierarchyRequestError` thrown by
  an ordering bug in the first draft (since independently fixed), not to any `moveBefore` anomaly.
  Real surface-survival across every crossing would need `connectedMoveCallback` added to
  `UIElement`'s base class — filed as a candidate follow-up (a new fleet primitive), not built here.

## Findings

### 2026-07-17 — built, browser-verified at all 3 breakpoints, then a `ui:component-reviewer` pass found 3 MAJOR defects — all fixed, re-verified

**First build.** `agent-admin.ts` gained a feature-detected `ResizeObserver` (jsdom has none — falls
back to unconditional 'wide') watching the host's own content-box width; `layoutFor(px)` is a pure
threshold function (`WIDE_MIN_PX=1024`, `NARROW_MAX_PX=640` — the latter reused from the repo's one
existing precedent, `app-shell.css`/`master-detail.css`); `#applyLayout(layout)` reconciles the DOM
shape by moving three content units (`#conversation`, `#instructionsContent`, a new `#agentContent`
wrapper bundling the Agent pane's several sibling nodes into one reparent-able unit) into whichever
pane/tab-panel the target layout uses. The medium/narrow `ui-tabs` shells are built once at compose
time with their full tab/panel set already present — only content moves in/out of existing panels,
never added/removed tabs (avoiding `ui-tabs`' own connect-time tab/panel snapshot concern).
`naming-gates.test.ts`/`naming.md` gained two new registered `data-role` values (`tabs-medium`,
`agent-content` — a real fleet-wide gate); `vitest.config.ts` gained a `@agent-ui/components/
controls/tabs` alias (the first cross-package jsdom consumer of that subpath).

**A CSS `[hidden]`-specificity bug shipped and was caught by live-browser screenshot verification**
before the first review even started: an author `display:flex` on `:scope > ui-split`/`:scope >
ui-tabs` unconditionally beat the UA `[hidden]{display:none}` rule (the entry-add-form/
combo-box.css precedent class of bug), so the narrow all-tabs shell rendered PERMANENTLY VISIBLE
underneath the wide 3-pane split. Fixed with explicit `:scope > ui-split[hidden]`/`:scope >
ui-tabs[hidden] { display: none }` guards, written after the base rules so source order breaks the
tie. Screenshots confirmed clean at all 3 breakpoints before dispatch.

**A `moveBefore`-based attempt to avoid closing live A2UI surfaces on resize was tried and reverted**
before dispatch. Motivation: `ui-conversation.disconnected()` (conversation.ts) closes every OPEN
surface as a leak-safety net, so moving `#conversation` between panes on every crossing would
silently close an in-progress game. `Node.prototype.moveBefore` (this fleet's own ADR-0022 atomic-
move seam, `dom/template.ts`) was tried to dodge that — a live Chromium probe found it silently
emptied a mounted `ui-surface-host`'s rendered DOM with NO lifecycle callback firing anywhere in the
subtree, an unexplained failure mode judged worse than the plain-`append()` fallback (which at least
produces the well-tested, legible "Closed." treatment) — reverted before dispatch. **This diagnosis
was itself WRONG** — see the review's F4 below for the corrected account.

**`ui:component-reviewer` dispatched (fresh context, real Chromium+WebKit probes of its own) —
verdict 🟡 attention, 3 MAJOR findings, all fixed:**

1. **F1 — an open surface closed on EVERY band crossing, not only into/out of narrow, contradicting
   this feature's own design intent ("Chat stays its own split pane" in medium).** Root cause: the
   first draft's `split.replaceChildren(...)` and `append()` calls were UNGUARDED — a real probe
   proved `replaceChildren()` re-listing an ALREADY-PRESENT child, and a same-parent `append()` of an
   already-last child, BOTH cycle `disconnectedCallback`+`connectedCallback` on Chromium AND WebKit,
   contrary to the assumption that a no-op DOM position change is lifecycle-free. **Fixed:** every
   move in `#applyLayout` is now guarded (`if (node.parentElement !== target) target.append(node)`);
   `#split`'s pane SET is reconciled by removing only what's no longer wanted and adding only what's
   missing — `#canvasPane` (a member of both the wide and medium pane sets) is never removed-then-
   re-added crossing between them, so `#conversation` genuinely stays put and its surfaces survive.
2. **F2 — the shipped "wide→narrow shows Closed." browser test was green for the wrong reason.**
   Because of F3 (below), the test's 1200→500px resize never actually reached narrow — it landed in
   medium instead, and the "closed" assertion was observing F1's wide→medium closure bug, not the
   intended wide→narrow case. **Fixed:** the test now explicitly asserts the layout actually reached
   narrow (`getComputedStyle` on both shells) before checking the closed state; a NEW test pins that
   a surface SURVIVES a real wide→medium resize (the F1 regression guard).
3. **F3 — the narrow layout was unreachable via a live browser resize at all**, only via a fresh
   mount at a small width. Root cause: `:scope` had no `min-inline-size: 0`, so as a flex item it
   floored at its content's intrinsic width (measured ~659px, always above the 640px narrow
   threshold) — the ResizeObserver could never report an inline-size low enough once real content
   was mounted. **Fixed:** `min-inline-size: 0` added to `:scope` (the same flex-overflow release
   already applied on the block axis throughout this file).
4. **F4 — the `moveBefore` revert's diagnosis was wrong; the revert was still the right call, for a
   different reason.** The reviewer proved `moveBefore` on a custom element without
   `connectedMoveCallback` support (which does not exist anywhere in this fleet — grep-verified) fires
   the IDENTICAL `disconnected`+`connected` cycle as plain `append()` — it was NEVER going to help
   avoid closing surfaces, full stop. The actually-observed "silent, callback-free content loss" in
   the original attempt is now understood as: `moveBefore` across certain node relationships THROWS
   `HierarchyRequestError` with ZERO callbacks firing on a throw, and the FIRST draft's narrow branch
   detached the source pane BEFORE the move — an ordering bug (since fixed in the shipped code,
   independent of moveBefore) that could throw mid-`#applyLayout` and strand content in a detached
   pane. **Corrected record** (this entry) replaces the original, wrong diagnosis. **Follow-up filed
   here, not built**: real surface-survival across ALL crossings (including into/out of narrow) would
   need `connectedMoveCallback` support added to `UIElement`'s base class — a genuine new fleet
   primitive, out of this ticket's scope. Today's accepted behavior: a surface closes (with the
   already-shipped, legible "Closed." treatment) only when crossing into/out of narrow, since
   `#canvasPane` itself is not a narrow-layout pane and must genuinely leave/rejoin `#split`'s
   children there.
5. **F5 — this ticket's own `## Findings` section was empty at first review dispatch**, while the
   Acceptance/Links sections both promised it. This entry is the repair.

**Re-verified after all 4 fixes:**
- Both new regression pins PROVEN to catch their bug: reverted the F3 CSS fix, reran the "reached
  narrow" browser test — failed on both engines with the exact `did not actually reach narrow`
  assertion; restored, reran — green. Reverted the F1 guard, reran the "survives wide→medium"
  test — failed on both engines showing `data-state="closed"`/"Closed." (the exact regression);
  restored, reran — green.
- `npx vitest run packages/agent-ui/app` — 361/361.
- `npx vitest run --config vitest.browser.config.ts .../agent-admin.browser.test.ts` — 56/56, both
  engines (2 new tests over the reviewer's own count, replacing the one mispinned test).
- `npm run check` — green.
- Live dev-server confirmation (Playwright, real Chromium, `agent-admin-app.html`): all 3
  breakpoints screenshot-clean; a live-opened surface survives an ACTUAL browser window resize from
  1200px to 800px (wide→medium) — `true`.
- Full gate cross-verified against the main tree (temp-copy technique, reverted after).

Files touched (final): `packages/agent-ui/app/src/controls/agent-admin/{agent-admin.ts,
agent-admin.css,agent-admin.test.ts,agent-admin.browser.test.ts}`,
`packages/agent-ui/components/src/controls/naming-gates.test.ts`,
`.claude/docs/references/naming.md`, `vitest.config.ts`.

### 2026-07-17 — a second review pass was blocked (session spend limit); one more self-check added

Dispatched a fresh `ui:component-reviewer` re-review specifically to independently re-verify F1/F3
were genuinely fixed (not just reading the new code — the FIRST review's own real-browser probes
are what caught these bugs, code-reading alone had missed them) and that both regression pins
actually catch their bug. **The dispatch failed on an API error: the session hit its monthly spend
limit before the agent could run.** No second independent review was completed.

In its place, one more self-authored check: a jsdom test chaining SIX consecutive crossings
(wide→medium→wide→narrow→medium→wide) and asserting `#split`'s pane order stays correct
(`['canvas','prompts','settings']` / `['canvas','tabs-medium']` / `[]`) at every step, plus that
content is reachable at its real DOM location after the whole chain — directly targeting the
re-review's own item 5 (does the targeted remove-what's-unwanted/add-what's-missing reconciliation
correctly handle `ui-split`'s own separator elements interspersed in `split.children`, and does pane
order survive repeated transitions). Passes (59/59 in `agent-admin.test.ts`, up from 58).

**Status: NOT independently re-reviewed after the F1/F3/F2 fixes.** Everything else in this entry
(the maker's own revert-and-reprove tests, the full gate, live dev-server confirmation) stands, but
per this session's own established practice (an independent review before calling a fix done), this
ticket was left `open` rather than `done` — the fixes are believed correct and are self-verified
thoroughly, but have not cleared the SAME bar TKT-0082/0084 did (a fresh-context reviewer's own
probes, which have twice now caught real bugs code-reading missed).

**2026-07-17 — Kim accepted the self-verification as sufficient** (explicit, in chat: "TKT-0085:
accepted"), without waiting for the spend limit to reset for a second independent review pass.
Status flipped to `done` on that basis — not a self-ratification, a recorded owner decision.
