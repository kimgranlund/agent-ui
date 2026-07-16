---
doc-type: ticket
id: tkt-0045
status: done
date: 2026-07-14
owner:
kind: bug
---
# TKT-0045 — narrowing the `ui-agent-admin` docs demo frame overflows instead of shrinking the three panes

## Summary
On the `ui-agent-admin` composition-guide page (`site/pages/agent-admin.ts`), dragging the resizable
demo frame (`.agent-admin-resize`, `resize: horizontal`) toward its own stated floor
(`min-inline-size: 24rem`) does not shrink the composed `ui-split`'s three panes (canvas/prompts/
settings) proportionally down to that floor. Instead, at least one pane appears to hit an internal
content-driven width floor well above 24rem, the leading (canvas) pane gets squeezed out and clipped by
the frame's `overflow: hidden`, and the page's caption paragraph below the frame
("↑ Reload the page after changing a value — it persists via the store.") renders as if it overlaps the
bottom of the frame rather than sitting in normal flow beneath it.

## Acceptance
- Root-caused: which element actually refuses to shrink below ~content-width when the frame narrows —
  a specific composed child's intrinsic min-content size (candidate: `ui-text-field`'s known 20ch
  `--ui-text-field-min-inline-size` floor on the Agent "Name" field, inside `[data-role='settings']`,
  which sets no `min-inline-size: 0` override on itself in `agent-admin.css`), a `ui-split` ratio/render
  gap (`split.ts#render()`'s `--_pane-flex` computation vs. the frame's actual current width), or
  something else. Confirmed with real DevTools/computed-style evidence in a real engine, not guessed
  from source reading alone.
- Fixed on the correct side: either the offending child gains a `min-inline-size: 0` shrink guard (the
  standard flex/grid overflow escape used elsewhere in this fleet, e.g. `text-field.css:150`,
  `toast.css` `[data-part='message']`) so it can shrink and scroll/clip internally instead of forcing
  its ancestor pane wider, or `.agent-admin-resize`'s stated `min-inline-size: 24rem` is corrected to
  match whatever the composition's real, evidence-based floor is (if 24rem is simply the wrong number
  for a 3-pane split with a text-field inside one pane).
- The caption-paragraph overlap resolves as a consequence of the above (it should never appear to be
  anything other than normal block flow below the frame) — confirm it visually rather than assuming the
  same fix clears it.
- A non-vacuous regression test: a `.browser.test.ts` (cross-engine, per this repo's CSS-truth
  discipline) that renders `ui-agent-admin` inside a container sized at the demo frame's stated
  `min-inline-size` and asserts no pane's rendered box overflows the container (e.g.
  `container.scrollWidth === container.clientWidth`).

## Repro
No fixed repro script — visual, on the live docs site:
1. `npm run dev`, navigate to the `ui-agent-admin` composition-guide page
   (`site/pages/agent-admin.ts`'s demo, `.agent-admin-resize` wrapping `.agent-admin-demo`).
2. Drag the frame's resize handle (bottom-right corner, CSS `resize: horizontal`) toward its stated
   floor (`min-inline-size: 24rem` in `site/pages/agent-admin.css`).
3. Observe: the leftmost (canvas/chat) pane gets squeezed to a thin clipped sliver at the frame's left
   edge (visible because the frame is `overflow: hidden`, so nothing scrolls into view — it's just
   gone), and the caption text below the frame appears to overlap/run into the frame's bottom edge.

Screenshot on file: the Instructions/Agent two-pane view with a thin thin dark sliver at the far left
edge (the squeezed canvas pane) and the caption text apparently overlapping the frame's bottom.

## Expected vs actual
- **Expected:** dragging `.agent-admin-resize` down to its own declared `min-inline-size: 24rem` shrinks
  all three composed panes proportionally (per `ui-split`'s ratio-based `--_pane-flex` mechanism,
  `split.ts:339`) with no pane's content forcing an overflow — the frame's stated floor IS the real
  floor.
- **Actual:** the frame's floor and the composition's real (content-driven) floor disagree — narrowing
  past some point above 24rem visibly clips the canvas pane and produces the caption-overlap artifact,
  meaning the composed content does not actually fit at the width the frame chrome advertises as its
  minimum.

## Classification
Axis: **structural** (a min-width/shrink-guard mismatch between a page-local demo-chrome constant and
the actual composed component's content-driven floor) with a **visual** symptom (the caption-overlap).
Plane: `site/pages/agent-admin.css` (`.agent-admin-resize`'s `min-inline-size: 24rem` claim) ×
`packages/agent-ui/app/src/controls/agent-admin/agent-admin.css` (`[data-role='settings']`/
`[data-role='prompts']` set `overflow-y: auto` but no `min-inline-size: 0` shrink guard on the pane's
own flex/scroll box) × possibly `packages/agent-ui/components/src/controls/split/split-pane.css`
(the pane's own `min-width: 4rem` floor is per-pane, not content-aware — it does not know a child inside
it, like a text-field, carries its own larger floor). Not yet root-caused to one specific file:line —
several plausible mechanisms named above, not confirmed against a real render.

## Severity
**minor** — docs-site demo-only surface (no shipped product regression reported; `ui-agent-admin` is
still an in-progress build, TKT-0039), but visibly broken at a width the demo chrome itself claims to
support, and could point to a real composition gap other `ui-split`-based app surfaces would hit too.

## Links
- `site/pages/agent-admin.ts:90-92` (the resize frame + caption markup)
- `site/pages/agent-admin.css` (`.agent-admin-resize`'s `min-inline-size: 24rem`)
- `packages/agent-ui/app/src/controls/agent-admin/agent-admin.css` (`[data-role='prompts']`,
  `[data-role='settings']` — no `min-inline-size: 0` shrink guard)
- `packages/agent-ui/components/src/controls/split/split-pane.css:43` (the per-pane 4rem floor)
- `packages/agent-ui/components/src/controls/split/split.ts:339` (`--_pane-flex` ratio computation)
- `[[text-field-no-intrinsic-width]]` memory / `text-field.css:150`'s `min-inline-size: 0` precedent —
  the exact shrink-guard pattern this ticket's fix likely needs to reuse, if the Agent Name field
  (`ui-text-field`, 20ch floor) turns out to be the forcing element
- [TKT-0039](tkt-0039-agent-admin-ui.md) (the in-progress `ui-agent-admin` build this demo belongs to)

## Findings

### 2026-07-14 — root-caused in a real Chromium render (live `npm run dev`, DevTools JS evaluation)

Confirmed the visual repro first: pinning `.agent-admin-resize`'s inline-size to exactly `384px` (its own
stated `min-inline-size: 24rem`) on the live docs page reproduces the screenshot exactly — the canvas
(chat) pane renders as a near-empty dark sliver with no composer visible.

**The leading hypothesis (settings pane's `ui-text-field` missing `min-inline-size: 0`) is FALSIFIED as
stated.** Real computed-style evidence:

- `.agent-admin-resize` (frame), `.agent-admin-demo` (`ui-agent-admin` host), and `ui-split` itself never
  overflow their own boxes at 384px — `scrollWidth === clientWidth` at every one of those three levels.
  So the ticket's literal framing ("the frame's `overflow: hidden` clips it") is not the actual mechanism —
  nothing overflows the frame or the split.
- The real mechanism is **inside two of the three panes independently**, each swallowed by ITS OWN nested
  overflow boundary before the clipping ever reaches the split/frame level:
  - **Canvas pane** (109–111px allocated): `ui-conversation`'s composer (`form[data-part="composer"]`,
    containing the Message `ui-text-field` + the Send `ui-button`) measures `scrollWidth: 226` against a
    `clientWidth: 109` — a 117px overflow. `ui-conversation`'s own `overflow-x: hidden` (not `auto`)
    clips this **invisibly, no scrollbar** — exactly the "it's just gone" symptom in the ticket's repro
    notes. The Message field hits the *same* 20ch `--ui-text-field-min-inline-size` floor the ticket named
    for the Name field, just on the canvas side.
  - **Settings pane** (~135px allocated): the generated `ui-slider` (Temperature) has `min-width: 192px`
    — wider than `ui-text-field`'s own 176.4px (20ch) floor — plus the pane's own `padding: 0.75rem`
    (24px) from `agent-admin.css`. Real floor ≈ 216px, well above the 135px allocated. The zoomed
    screenshot shows this directly: `"Untitled a[g"` and `"Sonne…"` visibly truncated.
  - **Prompts pane** measured with NO internal overflow at 135px (`scrollWidth === clientWidth`) — its
    content (entry cards, the "+ Add section" button) can wrap/reflow and has no hard per-control floor
    the way a text-field/slider does. It is not part of the bug.
- **Why the ticket's hypothesized fix (a `min-inline-size: 0` shrink guard on `[data-role='settings']`)
  is the wrong direction:** `min-inline-size: 0` is an escape hatch that lets a box shrink and scroll/clip
  its content — appropriate for scrollable list content (the `toast.css`/`text-field.css:150` precedent).
  It is NOT appropriate here: a live message composer and a Temperature slider are not reasonably
  scrollable-while-usable content; their floors (226px / 216px) are real product constraints, not
  overflow bugs. Adding `min-inline-size: 0` would just make the existing invisible clipping *more*
  silent, not fix it.
- **Root cause, restated:** `ui-split-pane`'s only floor is the *generic* `--ui-split-pane-min: 4rem`
  (`split-pane.css:30`), which has no relationship to what's actually composed inside a *specific* pane.
  `ui-agent-admin`'s `#compose()` (`agent-admin.ts`) never sets a per-pane `.min` on any of its three
  panes, so `ui-split`'s own ratio-based flex resolution (SPEC-R2, `split.ts#render()`/`#boundsFor()`) has
  no way to know the canvas pane needs ≥226px or the settings pane needs ≥216px — it treats all three as
  equally shrinkable down to 4rem, and whatever it can't fit gets silently eaten by a nested
  `overflow-x: hidden`/`auto` boundary two levels down. `.agent-admin-resize`'s `min-inline-size: 24rem`
  (384px total, ÷3 ≈ 128px/pane at the default even-ratio seed) was never big enough for a composition
  containing a message composer and a generated settings form — this is the ticket's "OR the frame's
  stated minimum is simply wrong" branch, not the shrink-guard branch.

**Fix direction:** (1) give `ui-agent-admin`'s canvas and settings panes real, content-aware `min` props
in `agent-admin.ts#compose()` (the existing SPEC-R2 per-pane `min` mechanism `ui-split` already supports —
no new mechanism needed) so the split itself never squeezes them below their genuine floor; (2) raise
`.agent-admin-resize`'s `min-inline-size` in `site/pages/agent-admin.css` to match the new real total, so
the native `resize: horizontal` handle can't be dragged past what the composition actually supports. This
touches the shipped `packages/agent-ui/app/src/controls/agent-admin/agent-admin.ts` (component code, not
just docs-page CSS) — `ui:component-reviewer` will run against it before this is called done.

### 2026-07-14 — fix implemented; found and fixed a SECOND, deeper bug along the way (a real `ui-split` defect)

Giving `canvasPane`/`settingsPane` real `min` values (`agent-admin.ts`) and raising the frame's floor
(`agent-admin.css`) surfaced a second, independent defect while verifying in a real browser: **an outer
pane's `min` leaks into an unrelated NESTED `ui-split` further down that pane's own content, via CSS
custom-property inheritance.**

- `ui-settings` (composed inside the settings pane) internally composes its OWN `ui-master-detail`, which
  composes its OWN separate `ui-split` (list/detail drill-in, `master-detail.ts`). This inner split's own
  panes never set `.min` — before the fix, `split.ts#render()` cleared an unset `--_pane-min` via
  `pane.style.setProperty('--_pane-min', min || '')`. Per the CSSOM spec, `setProperty(name, '')` is
  defined to **remove** the property, not set it to an empty value — so the inner detail-pane had NO
  local `--_pane-min` declaration at all, and because unregistered custom properties inherit by default,
  it picked up the OUTER settings pane's real `--_pane-min` (my new `20rem`) straight through several
  intermediate elements (`ui-settings` → `ui-master-detail` → its own inner `ui-split`), forcing the inner
  drill-in pane to `min-width: 320px` even though its own actual container (`ui-settings`, 281px wide) was
  narrower — a genuine cross-element overflow (`detailPane.right` measured 39px past its own flex
  container's right edge in live DevTools).
- This is a **pre-existing `ui-split` architectural gap**, not something new: it only stayed invisible
  because no prior `ui-split` consumer had ever set a non-empty `.min` on a pane that itself contains an
  independent nested `ui-split`. `ui-agent-admin` is (as far as I found) the first place in the fleet doing
  that composition shape.
- Fixed at the source, `packages/agent-ui/components/src/controls/split/split.ts` (`#render()`, ~line
  331-334): changed `min || ''` / `max || ''` to `min || 'initial'` / `max || 'initial'`. The literal
  `'initial'` keyword string is a real, non-removed declaration — it resolves to the custom property's
  guaranteed-invalid value (still tripping `var(--_pane-min, var(--ui-split-pane-min))`'s fallback exactly
  as an actually-unset property would), but being a real declaration on the element itself, it blocks
  inheritance from leaking through. A pane's own inline `--_pane-min`/`--_pane-max` (when `.min`/`.max` IS
  set) still wins via specificity, so this is a pure bugfix with no behavior change for the already-working
  single-split case.

**Component changes (both shipped `packages/**` code, not just docs chrome):**
- `packages/agent-ui/app/src/controls/agent-admin/agent-admin.ts` — `canvasPane.min = '16rem'`,
  `promptsPane.min = '10rem'`, `settingsPane.min = '20rem'` (real, content-aware floors; see the inline
  TKT-0045 comments at each for the measured numbers they're derived from — the composer's ~226px,
  the generated form's widest control, a `ui-slider`, at 192px + padding, and the prompts entry cards).
- `packages/agent-ui/components/src/controls/split/split.ts` — the `'initial'`-not-`''` fix above (a
  general `ui-split` correctness fix, independent of agent-admin).
- `site/pages/agent-admin.css` — `.agent-admin-resize`'s `min-inline-size` raised from the wrong `24rem`
  to `48rem` (the sum of the three panes' new `min` values + divider/padding/border chrome, rounded up
  for cross-engine headroom), so the native `resize: horizontal` handle can no longer be dragged past
  what the composition actually supports.

**Verified in real Chromium via live DevTools** (`npm run dev`, `agent-admin.html`), pinned to the new
768px (48rem) floor: `frame`/`ui-agent-admin`/`ui-split`/`canvas-pane`/`prompts-pane`/`settings-pane`/
`ui-settings`(inner)/`detail-pane`(nested) all report `scrollWidth === clientWidth` — zero overflow
anywhere in the tree. Visually: the composer (message field + Send button) is fully visible in the canvas
pane, every settings field renders untruncated ("Sonnet 5" fully legible, previously cut to "Sonne…"),
and the caption below the frame sits in ordinary block flow (`captionTop === frameBottom` exactly, no
overlap) — confirmed as a side effect of the primary fix, not a separate change.

**Regression tests added:**
- `packages/agent-ui/app/src/controls/agent-admin/agent-admin.browser.test.ts` — new describe block
  mounting `ui-agent-admin` at exactly 768px (the corrected frame floor) and asserting
  `scrollWidth === clientWidth` on the wrapper, `ui-split`, and all three panes individually, plus
  targeted assertions on the composer and the nested `ui-settings` (the two elements that were actually
  silently clipping before the fix).
- `packages/agent-ui/components/src/controls/split/split.browser.test.ts` — new describe block
  (`TKT-0045 — an outer pane min does not leak into a nested ui-split`) that nests one `ui-split` inside
  an outer pane with a real `min` set, and asserts the inner pane's own unset `min` resolves to the
  generic `--ui-split-pane-min` floor, not the outer's leaked value — a component-level regression test
  for the `split.ts` fix, independent of agent-admin.

**Gates:**
- `npx vitest run --config vitest.browser.config.ts packages/agent-ui/app/src/controls/agent-admin/agent-admin.browser.test.ts packages/agent-ui/components/src/controls/split/split.browser.test.ts`
  — 52/52 passed, both Chromium and WebKit.
- `npm run check` — green (tsc + check:site + check:tools).
- `npm test` (jsdom) — 6161/6163 passed; the 2 failures (`site/lib/sitemap.test.ts`'s adr-index.json
  freshness check, `site/lib/theme-provider-build-fixture.test.ts`'s built-CSS fixture freshness check)
  are pre-existing/concurrent noise from an unrelated session's changes already sitting in the working
  tree (`button.css`/`button.ts`/`combo-box.css`/`tabs.css`/`badge.css` etc., none touched by this fix,
  confirmed via `git status`) — not caused by this diff. All 108 agent-admin/split-related jsdom tests
  pass individually.
- Full cross-engine `npm run test:browser` (all 188 files, both engines): 36 failures, but NONE in
  `agent-admin`/`split` — spread across totally unrelated files (nav-rail, button-states, calendar, modal,
  radio-group, swiper, toolbar, toast, combo-box, disclosure, color-picker, field, form-provider, menu,
  tabs, a2ui-gallery, ask-registry, command-palette, component-preview, adr-index), nearly all
  hover/keyboard-roving/real-focus interaction tests — the exact class of test sensitive to which window
  holds OS focus. I had a live `claude-in-chrome` automation tab open and actively driving the SAME
  `agent-admin.html` page throughout this investigation, which almost certainly stole focus from the
  headless Playwright browsers mid-run. Re-ran two of the flagged files in total isolation
  (`button-states.browser.test.ts`, `calendar.browser.test.ts`) and both passed 114/114 clean — confirms
  environmental flake, not a regression. `agent-admin.browser.test.ts` + `split.browser.test.ts` re-ran in
  isolation earlier: 52/52 clean, both engines.

### 2026-07-14 — component-reviewer gate (required: this fix touches shipped `packages/**` component code)

Dispatched `ui:component-reviewer` against the full diff (`agent-admin.ts`, `split.ts`,
`agent-admin.browser.test.ts`, `split.browser.test.ts`). Independently re-ran the gates rather than
trusting my claims (`split` jsdom 99/99, both touched browser specs 52/52 cross-engine) and adversarially
checked the `split.ts` fix's generality (confirmed: the ONLY writer of `--_pane-min`/`--_pane-max` in the
repo is `split.ts#render()`, unconditional on every render pass, so N-level nesting and runtime
set→unset transitions both hold; confirmed no other consumer relies on empty-string-means-unset
semantics; confirmed `min || 'initial'` has no falsy-string trap since `''` is the only falsy value a
reflected string prop can hold).

**Verdict: SHIPPABLE** (Compose PASS, Realize PASS, zero gate failures). One MEDIUM finding (M1 —
the three pane `min`s and the frame's `48rem` are separately-hardcoded numbers with nothing tying them
together, so either could drift silently) and two LOW/TRIVIAL findings (the agent-admin regression test's
canvas/prompts assertions are inert at exactly 768px — only the settings assertion has real teeth against
the fix; a ticket-narrative/code form mismatch, `.min = ...` vs the shipped `setAttribute('min', ...)` —
both correct, just inconsistent wording). Reviewer recommended shipping with M1 as a non-blocking
follow-up.

Closed M1 immediately rather than deferring it (cheap, and directly serves the "stale context is a
defect" standard): added a new test,
`packages/agent-ui/app/src/controls/agent-admin/agent-admin.test.ts` — `'TKT-0045: the three panes' real
content-floor mins sum (+ frame chrome) to the docs demo frame's stated minimum'` — which reads the THREE
pane `min` attributes live off the composed DOM (not a second hardcoded copy), re-derives the expected
frame floor from them plus the documented chrome constants, and pins the pane-min sum (46rem) as one
changeset. If a future edit changes any one of the three pane mins without updating
`site/pages/agent-admin.css`'s `48rem` to match, this test trips. Ran in isolation: 38/38 passing in
`agent-admin.test.ts` (the pre-existing, unrelated `this.internals.setFormValue is not a function`
console errors from `form.ts`/`ui-switch`/`ui-textarea` — untouched by this diff, confirmed via
`git status` — still appear as non-fatal logged errors but fail no test, matching the full-suite baseline).

**Final gate status:**
- `npm run check` — green.
- `npm test` — 6162/6164 passed (2 pre-existing/concurrent failures, unrelated files, documented above).
- `npx vitest run --config vitest.browser.config.ts` (targeted: agent-admin + split) — 52/52 passed,
  both engines.
- component-reviewer — SHIPPABLE, one MEDIUM finding closed same-session.

**Summary of the fix:**
- Confirmed mechanism: TWO independent bugs compounded. (1) `ui-split-pane`'s generic 4rem floor has no
  relationship to what's actually composed inside a specific `ui-agent-admin` pane (a message composer,
  a generated settings form) — nothing told `ui-split` those panes needed ~226px/~216px respectively, so
  they got squeezed below their real content floor and silently clipped via nested `overflow-x`. (2) while
  fixing (1) by giving panes real `min` values, discovered a genuine pre-existing `ui-split` defect: an
  outer pane's `--_pane-min` leaks via CSS custom-property inheritance into any independent NESTED
  `ui-split` composed further down that pane's content (here, `ui-settings`' own internal
  `ui-master-detail`), because clearing an unset value via `setProperty(name, '')` REMOVES the property
  (CSSOM spec) rather than blocking inheritance.
- What changed: `packages/agent-ui/app/src/controls/agent-admin/agent-admin.ts` (three real per-pane
  `min`s, a component fix) + `packages/agent-ui/components/src/controls/split/split.ts` (the
  `'initial'`-not-`''` general fix, also a component fix) + `site/pages/agent-admin.css` (frame floor
  24rem → 48rem, docs-chrome only) + `packages/agent-ui/app/src/controls/agent-admin/agent-admin.test.ts`
  (jsdom coherence guard, new) + `agent-admin.browser.test.ts` / `split.browser.test.ts` (cross-engine
  regression tests, new).
- The caption-overlap symptom resolved as a pure side effect of the primary fix, confirmed directly
  (`captionTop === frameBottom` exactly, zero overlap) rather than assumed.
