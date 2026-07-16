---
doc-type: ticket
id: tkt-0042
status: done
date: 2026-07-14
owner:
kind: bug
---
# TKT-0042 — control labels have no overflow strategy: `ui-button` clips silently, and the same anonymous-text-anatomy gap repeats across the fleet

## Summary
Reported against a screenshot of a `ui-button` ("Send") whose label overflows its frame with no
ellipsis — currently the label just clips/overlaps at the frame edge with zero visual affordance
that text was cut. This is a **named, self-documented deferral**, not a fresh discovery:
`button.css:99-103` already carries the comment "Ellipsis-on-constraint needs a label wrapper
(anonymous grid text can't carry `text-overflow`) — that anatomy follow-up is ticketed with the
`ui-text` overflow-ellipsis pattern," and **ADR-0106** clause 6 explicitly deferred it pending
"evidence it is needed" (`buttons that overflow their container are first a layout defect`). This
report is that evidence.

The same mechanism gap — `white-space: nowrap` with no `overflow`/`text-overflow`, on a control
whose label is anonymous host-as-content text with no wrapper element to carry the CSS — also
exists on at least `ui-badge` (`badge.css:98`) and `ui-tab`/`ui-tabs` (`tabs.css:68`). Per
ADR-0106's own Alternatives ("A generic fleet `truncate` on every control" was explicitly
**rejected** — "controls own their own overflow contracts... per-control adoption stays
per-control evidence"), this is NOT license for one blanket fix; each control needs its own
label-wrapper anatomy decision, evaluated with its own evidence.

## Acceptance
- `ui-button`: a label that overflows the frame's available inline space shows a single-line
  ellipsis (`text-overflow: ellipsis`) instead of clipping/overlapping without affordance —
  requires the label wrapper `button.css:99-103` names (anonymous grid text cannot itself carry
  `text-overflow`), following the anatomy ADR-0106 clause 6 reserved for this.
- The wrapper does not change `ui-button`'s existing geometry contract (frame height, padding,
  icon/label gap) for the non-overflowing case — a visual/geometry regression check confirms
  byte-identical rendering when the label fits.
- `ui-badge` and `ui-tab` are audited against the same anonymous-text-anatomy gap and each gets
  its own named decision (fix now with evidence, or an explicit deferral note matching the
  `ui-button` precedent) — not a shared/generic fix applied blindly across all three.
- Whatever ships is proposed as an ADR (or an amendment to ADR-0106) before landing, since
  ADR-0106 clause 6 named this a "separate anatomy decision on a shipped control" requiring its
  own ratification — this is a contract-touching fork, not a drive-by CSS tweak.

## Repro
No fixed repro script — visually reproducible by rendering any `ui-button` with a label longer
than its available inline space (e.g. a narrow flex/grid cell, or a long label with no
`inline-size` floor above the control's own min-inline-size). Screenshot on file: a pill "Send"
button where a longer label would run past the pill's rounded edge with no ellipsis.

## Expected vs actual
- **Expected:** an overflowing control label truncates with a visible ellipsis, matching the
  pattern ADR-0106 shipped for `ui-text[truncate]` (`nowrap` + `overflow: hidden` + `text-overflow:
  ellipsis` on the box that holds the text).
- **Actual:** `ui-button` (and `ui-badge`, `ui-tab`) set `white-space: nowrap` only — no
  `overflow`/`text-overflow` — so an overflowing label clips or overlaps the frame with no ellipsis
  affordance. The anonymous host-as-content text has no element to carry `text-overflow` on, which
  is exactly why ADR-0106 scoped its own `truncate` prop to `ui-text` only and left this as a named
  control-level deferral.

## Classification
Axis: **structural** (anatomy gap — the anonymous-text/no-wrapper shape a `text-overflow` rule
can't attach to) recurring across three controls; plane: `packages/agent-ui/components/src/
controls/button/button.css:99-103` (the named deferral site) · `badge/badge.css:98` ·
`tabs/tabs.css:68`. Severity floor set by the shipped `ui-button`; `ui-badge`/`ui-tab` need their
own confirmation before being folded into the same fix.

## Severity
**minor** — no functional break (labels remain in the accessible name; this is a purely visual
truncation-affordance gap), but user-visible on any layout that constrains a button/badge/tab's
inline space, and explicitly flagged by Kim as low-hanging fruit.

## Links
- `packages/agent-ui/components/src/controls/button/button.css:99-103` (the named deferral comment)
- `.claude/docs/adr/0106-text-truncate-css-only.md` clause 6 + Alternatives (the ratified deferral
  this ticket supplies evidence for; a generic fleet-wide truncate was explicitly rejected there)
- `packages/agent-ui/components/src/controls/text/text.css:303-309` (the shipped `ui-text[truncate]`
  precedent — the two-leg `nowrap`/`overflow:hidden`/`text-overflow:ellipsis` mechanism to reuse)
- `packages/agent-ui/components/src/controls/badge/badge.css:98`, `controls/tabs/tabs.css:68` (the
  other two controls sharing the same anonymous-text/no-wrapper gap, flagged for audit)

## Findings

### 2026-07-14 — ADR-0133 authored (proposed) and `ui-button` label-ellipsis anatomy shipped; `ui-badge`/`ui-tab` named-deferred

**ADR:** [`.claude/docs/adr/0133-button-label-ellipsis-anatomy.md`](../adr/0133-button-label-ellipsis-anatomy.md)
(ADR-0133), status `proposed` — never self-ratified, awaiting Kim. Extends ADR-0106 clause 6 (the
reserved `ui-button` anatomy follow-up) and reuses ADR-0078 clause 4's `ui-text` stamp/heal
`MutationObserver` mechanism, adapted from a conditional semantic stamp to an unconditional label
wrapper. README index row added.

**Which controls got the fix vs. a deferral:**
- **`ui-button` — fixed.** Gains a persistent `<span data-part="label">` wrapper around the label
  region (everything without `slot="leading"`/`slot="trailing"`), built at connect and self-healed by
  a `childList` MutationObserver so it survives later mutations — including the A2UI `buttonFactory`'s
  `el.textContent = label` write (`packages/agent-ui/a2ui/src/catalog/default/factories.ts:117-119`),
  the exact clobbering pattern `ui-text`'s own heal observer exists to survive. Unconditional — no new
  opt-in prop — because the label was already forced single-line (`white-space: nowrap`).
- **`ui-badge` / `ui-tab` — named deferral, not fixed.** No evidence was submitted for either (TKT-0042's
  screenshot is `ui-button`-specific), and ADR-0106's own Alternatives already rejected a generic
  fleet-wide truncate fix. Comments added at the existing `white-space: nowrap` site in each, matching
  `button.css`'s original deferral-comment precedent and pointing back to ADR-0133/TKT-0042.

**File:line locations of the code changes:**
- `packages/agent-ui/components/src/controls/button/button.ts` — `isAdornment()` helper, `#label`/
  `#observer` fields, `connected()`/`disconnected()` wiring, `#heal()` (the wrap/heal mechanism).
- `packages/agent-ui/components/src/controls/button/button.css:112-122` — the new
  `:scope > [data-part='label']` overflow/text-overflow/`min-inline-size:0` rule; `button.css:99-102` —
  the updated (no-longer-stale) `white-space` comment.
- `packages/agent-ui/components/src/controls/button/button.md` — `slots.label`/`parts.label`
  frontmatter rows + a new "Overflow (ADR-0133)" prose section.
- `packages/agent-ui/components/src/controls/badge/badge.css:98-106` — named-deferral comment (no logic
  change).
- `packages/agent-ui/components/src/controls/tabs/tabs.css:68-76` — named-deferral comment (no logic
  change).
- Tests: `packages/agent-ui/components/src/controls/button/button.test.ts` (repaired the stale
  `button-host-as-grid` probe → `button-render-void`; new `UIButtonElement — the label wrapper
  (ADR-0133)` describe block incl. the whitespace-anchoring regression test; new
  `button-label-observer-residue` zero-residue test) and NEW
  `packages/agent-ui/components/src/controls/button/button-label-overflow.browser.test.ts`
  (byte-identical geometry when the label fits, a real rendered ellipsis when it overflows, and
  survival of a `textContent` clobber — cross-engine, Chromium + WebKit).
- Site follow-on (button.md's `parts:` went from empty to non-empty): `site/pages/button-doc.ts` now
  calls `renderPartsTable`; `site/lib/doc-page.test.ts`'s stale "ui-button renders NO Parts section"
  assertion replaced with a parse+render pin matching the sparkline/bar-chart precedent.

**Component review (generator ≠ critic):** dispatched `ui:component-reviewer`. Verdict: "designed
right, built wrong" — the abstraction (Compose axis) scored 5/5, but the Realize axis caught a real
defect (MEDIUM-1): the original `#heal()` anchored the wrapper's insert position on `strays[0]`, which
inverted the adornment order when authored, pretty-printed multiline markup put a whitespace-only text
node *before* a `slot="leading"` adornment (a realistic authoring shape none of the original tests
exercised — flagged as LOW-1, a coverage gap). **Fixed**: `#heal()` now anchors on the trailing
adornment ELEMENT itself (never moved, so a stable anchor) — insert before it, or append when absent —
which is whitespace-agnostic by construction since adornments are never relocated, only label strays
are. Added `button-label-wrapper-whitespace` regression test reproducing the reviewer's exact repro
shape. ADR-0133's Decision clause 1 was corrected to describe the fixed (trailing-anchor) mechanism
rather than the stale `strays[0]` claim the reviewer falsified. Re-ran the full jsdom + scoped browser
suites after the fix — all green (see below). The reviewer's remaining LOW-2 (pathological split-label
edge case around a trailing adornment) was left as documented, bounded undefined behavior — not a
regression, not exercised by any real anatomy this control documents. The badge/tabs deferral call was
independently confirmed AC-compliant by the reviewer, not scope-avoidance.

**Gates:**
- `npm run check` — green (tsc + check:site + check:tools).
- `npm test` — every file touched by this change is green (129/129 tests across button/badge/tabs +
  `site/lib/doc-page.test.ts`, re-confirmed after the reviewer's fix). A full unscoped `npm test` run
  also shows unrelated failures (`ui-textarea` site-coverage/site-TOC/catalog-coverage gates, plus
  llms.txt/sitemap.json/theme-provider-fixture byte-identical drift gates) caused by a **concurrent,
  unrelated teammate session** actively building a brand-new `ui-textarea` component mid-session
  (untracked `packages/agent-ui/components/src/controls/textarea/**` + `ADR-0134`, tied to a different
  ticket, TKT-0041) — confirmed by every failing test naming `ui-textarea` or being a regen-drift gate
  that went stale again after that concurrent work landed CSS/ADR changes following my own regeneration.
  None of these reference button/badge/tabs. Also present: a long-standing, pre-existing uncaught
  exception from `agent-admin.test.ts`/`packages/agent-ui/components/src/dom/form.ts`
  (`this.internals.setFormValue is not a function`) — untouched by this diff and already tracked by
  TKT-0040. Neither is this ticket's responsibility to fix.
- `npm run test:browser` scoped to `button`/`badge`/`tabs` — green, 118/118 (re-run after the reviewer's
  fix: still 118/118). Two consecutive **unscoped** full-suite runs both hit the same infra-level
  `Unknown Event` WebSocket crash spanning ~18 files unrelated to this change (calendar, modal, tooltip,
  combo-box, nav-rail, etc. — none touched by this diff), matching a known concurrent-browser-build
  resource-constraint pattern already documented in this repo (`site/lib/build-css.ts`'s own comments).
  Treated as a pre-existing environment flake, not a regression — the scoped run is the trustworthy
  signal for this change.
- Regenerated derived artifacts as part of this change (ADR-0133 + button.md's `parts:` change required
  it): `site/public/llms-full.txt`, `site/public/adr-index.json`/`site/public/sitemap.json`,
  `site/lib/__fixtures__/theme-provider-built.css`. These were correct at generation time; they have
  since gone stale again from the concurrent `ui-textarea` work described above — that is expected churn
  in a shared, concurrently-edited repository, not a defect in this diff, and is left for whichever
  process closes out the textarea work to re-regenerate.
