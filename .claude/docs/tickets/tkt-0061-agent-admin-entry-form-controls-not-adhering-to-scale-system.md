---
doc-type: ticket
id: tkt-0061
status: done
date: 2026-07-15
owner:
kind: bug
---
# TKT-0061 — `ui-agent-admin`'s entry-list add-form controls render oversized, not matching the fleet's `(scale × size) → §1-row` geometry

## Summary
Reported against a screenshot of the "+ Add section" area (same visual region as TKT-0060): the "+ Add
section" toggle, the "Name"/"Description" fields, the "Content" textarea, and the "Add" submit button all
render noticeably taller/larger than the fleet's default control geometry — visually closer to a `lg`
size-class row than the default `md` (`--ui-height-md` = 28px at root scale/density; the screenshot's
proportions read closer to 48-64px per row).

**This ticket's scope needs to be read against TKT-0060, currently in flight on the SAME visual area and
the SAME files (`entry-list.ts`, `agent-admin.css`):**
- **"Name"/"Description" (currently native `<input>`) and "Add" (currently native `<button>`)** are, as of
  this filing, NOT wired into the fleet's scale system at all — they're sized by `agent-admin.css`'s own
  ad hoc `padding`/`font: inherit` rules (already confirmed dead-or-not per TKT-0050's investigation),
  never by any `--ui-height-*`/`[scale]`/`[size]` token. A native element literally cannot "adhere to the
  scale system" because it was never wired into it. TKT-0060 is converting these three to real
  `ui-text-field`/`ui-button` RIGHT NOW — once that lands, they inherit the real geometry ramp
  automatically. **Do not fix these here** — verify AFTER TKT-0060 closes, as a check on its result, not
  as parallel work that would collide with an actively-changing file.
- **"+ Add section" (`entry-add-toggle`) is DIFFERENT** — it's already a real `<ui-button>` (TKT-0048,
  already shipped), unrelated to TKT-0060's remaining scope. If IT also renders oversized, that's a real,
  independent bug in `ui-button`'s own geometry resolution or something in `agent-admin.css`/
  `agent-admin.ts` overriding its tokens — worth root-causing now, no collision risk (TKT-0060 doesn't
  touch `button.css` or `entry-add-toggle`'s own markup).

## Acceptance
- **`entry-add-toggle`'s real rendered height/font measured against `--ui-button-height`/`--ui-button-font`'s
  expected default-scale values** (real Chromium/WebKit computed style, not a screenshot estimate). If it
  matches the expected default, the screenshot's apparent size was misleading (image scaling, zoom, or a
  visual illusion from the surrounding oversized native elements) — say so plainly. If it doesn't match,
  root-caused: what's overriding `--ui-button-height`/`-font` for this instance specifically (an inherited
  `[scale]`/`[size]` attribute, a page-level CSS rule, or something in how `agent-admin.ts` constructs it)
  and fixed.
- **Explicitly deferred, not fixed in this dispatch:** whether "Name"/"Description"/"Add" adhere to the
  scale system once they become real `ui-text-field`/`ui-button` — checked as a follow-up verification
  against TKT-0060's shipped result, filed as its own follow-up ticket ONLY if a real gap remains after
  TKT-0060 lands (not assumed in advance).
- `npm run check && npm test` green for anything actually changed.

## Repro
No fixed repro script — visual, on `agent-admin.html`'s Instructions pane (or any of the five entry-list
panes): open "+ Add section" and compare the toggle's own height against a `ui-button` rendered at default
size elsewhere on the docs site (e.g. the button gallery/doc page) — same page, same default context,
should be pixel-identical.

## Expected vs actual
- **Expected:** `entry-add-toggle`'s `ui-button` renders at the SAME height/font as any other default-size
  `ui-button` on the site (28px height / 14px font at root scale) — geometry is a property of the
  component + its `[scale]`/`[size]` attributes, not of which page composes it.
- **Actual:** reported as visually oversized relative to expectation; not yet confirmed against a real
  measurement or ruled out as image-scale illusion.

## Classification
Axis: **visual** (a reported geometry mismatch), scope-split against **structural** (the native-element
sizing gap TKT-0060 already owns and is actively closing). Plane:
`packages/agent-ui/app/src/controls/agent-admin/entry-list.ts` (`entry-add-toggle`'s construction) ×
`packages/agent-ui/components/src/controls/button/button.css` (the `--ui-button-height`/`-font` tokens
this instance should be reading unmodified) — explicitly NOT `agent-admin.css`'s native-input rules,
which are TKT-0060's territory.

## Severity
**cosmetic** — no functional break; a geometry-consistency report. Will be reclassified if the
`entry-add-toggle` measurement reveals something more structural (e.g. a token resolution bug that could
affect other `ui-button` consumers beyond this one page).

## Links
- [TKT-0060](tkt-0060-agent-admin-entry-add-form-native-form-conversion.md) (in-flight, same file, same
  visual area — do not dispatch parallel edits to `entry-list.ts`/`agent-admin.css` until it lands)
- [TKT-0048](tkt-0048-agent-admin-entry-list-bespoke-buttons-not-ui-button.md) (shipped the real
  `entry-add-toggle` `ui-button` this ticket's in-scope measurement targets)
- [TKT-0050](tkt-0050-agent-admin-entry-content-css-likely-fully-dead.md) (already confirmed
  `agent-admin.css`'s native-element styling rules are largely dead CSS — background for why the native
  fields' current sizing isn't governed by any scale token today)
- `packages/agent-ui/components/src/controls/button/button.css:36,61,67` (the `--ui-button-height`
  size-class tokens `entry-add-toggle` should be reading)

## Findings

### 2026-07-15 — `entry-add-toggle` measured clean; screenshot's oversizing was the native siblings, not this button

**Collision check first:** TKT-0060's own Findings section was empty (no dated entries) at investigation
time — still in flight. Per this ticket's dispatch, `entry-list.ts` and `agent-admin.css` were read-only
for this pass; no edits were made to either file.

**Static read, both files:**
- `entry-list.ts:65-73` constructs `addToggle` with only `variant="soft"` and `data-part="entry-add-toggle"`
  — no `[size]`/`[scale]` attribute set on the element itself.
- `agent-admin.css` has exactly one comment referencing `entry-add-toggle` (line 140-142), explicitly
  stating the adjacent bespoke `[data-part='entry-add-submit']` rule stays "ONLY for entry-add-submit" —
  i.e. `agent-admin.css` deliberately carries **no** styling rule targeting `entry-add-toggle` at all
  (button.css owns its anatomy entirely, per that same comment).
- `agent-admin.ts` and `agent-admin.css` were grepped for `scale`/`size` attributes/selectors — no
  `[scale]`/`[size]` attribute is set anywhere on `ui-agent-admin`, its ancestors, or `entry-add-toggle`
  itself.
- `button.css:36-37` confirms the default (no `[size]` attr) geometry is `--ui-button-height: var(--ui-height-md)`,
  `--ui-button-font: var(--ui-font-md)`.

**Real-browser measurement** (scratch `*.browser.test.ts`, written temporarily under
`packages/agent-ui/app/src/controls/agent-admin/`, run via `npx vitest run --config
vitest.browser.config.ts --project packages` against both Chromium + WebKit instances, then deleted —
no permanent test artifact left behind): mounted `ui-agent-admin`, read `getComputedStyle()` on
`[data-part="entry-add-toggle"]` and on a bare `<ui-button>Test</ui-button>` mounted in the same document
with no `agent-admin` ancestor styling.

| | Chromium | WebKit |
|---|---|---|
| `entry-add-toggle` computed `height` | 28px | 28px |
| `entry-add-toggle` computed `font-size` | 14px | 14px |
| `entry-add-toggle`'s own `--ui-button-height` | 28px | 28px |
| `entry-add-toggle`'s own `--ui-button-font` | 14px | 14px |
| bare `<ui-button>` computed `height` | 28px | 28px |
| bare `<ui-button>` computed `font-size` | 14px | 14px |
| `[size]` attribute present | none | none |
| `[scale]` attribute anywhere in the ancestor chain | none | none |

`entry-add-toggle` and the bare baseline `ui-button` are byte-identical in both engines — 28px height /
14px font, exactly `--ui-height-md`/`--ui-font-md` (root scale, default size). No override, no scale/size
attribute, no agent-admin CSS rule touches it.

**Verdict — confirmed fine, no fix needed.** The screenshot's apparent oversizing of the whole "+ Add
section" area was NOT a defect in `entry-add-toggle` itself. As this ticket's own Summary already
anticipated, the toggle sits directly beside the "Name"/"Description" native `<input>`s and the native
`<button>` "Add" — TKT-0060's territory — which per TKT-0061's Summary and TKT-0050's prior investigation
genuinely ARE unwired from the fleet's scale system (styled by `agent-admin.css`'s own ad hoc
padding/font-inherit rules, not any `--ui-height-*` token). A correctly-sized 28px button sitting next to
oversized native siblings reads as "everything in this row is too big" in a screenshot even though only
three of the four elements are.

**No code change made** (nothing to fix) — `npm run check && npm test` not run per the dispatch's own
"no gate run required for a confirmed-fine outcome" instruction.

**Follow-up, not this ticket's scope:** the deferred re-check named in this ticket's own Acceptance —
whether "Name"/"Description"/"Add" adhere to the scale system once TKT-0060 converts them to real
`ui-text-field`/`ui-button` — remains open, to be verified after TKT-0060 lands, filed as its own ticket
only if a real gap remains.
