---
doc-type: ticket
id: tkt-0059
status: done
date: 2026-07-15
owner:
kind: bug
---
# TKT-0059 — `ui-agent-admin`'s entry-content `ui-textarea` reportedly looks inconsistent with `ui-text-field` (font size, border color) on the same page

## Summary
Reported against `<ui-textarea rows="2" data-part="entry-add-content" style="--ui-textarea-rows: 2;" />`
— the `entry-add-content` field inside `ui-agent-admin`'s "+ Add section" form (the same field TKT-0049
just fixed the `min-block-size`/`rows` mechanism for). The ask: make its text size, border color, etc.
match `ui-text-field` — implying a visible difference against a real `ui-text-field` elsewhere on the same
page (the Agent pane's "Name" field, rendered by `ui-settings` for a `type: 'text'` schema entry).

**Investigated at the component-definition layer before filing — the two components' own tokens already
match, byte-for-byte:** `ui-textarea`'s and `ui-text-field`'s CSS declare IDENTICAL values for every
property named in the report:
- `--ui-{cmp}-border`/`-border-hover`/`-border-focus`/`-border-invalid`/`-border-invalid-hover` — same
  `--md-sys-color-*` role on both (`text-field.css:47-51` vs `textarea.css:34-38`).
- `--ui-{cmp}-font` at default/`sm`/`lg` — same `var(--ui-font-{size})` on both
  (`text-field.css:58,76,82` vs `textarea.css:46,67,70`).
- `--ui-{cmp}-radius` — same `var(--ui-radius-base)` on both (`text-field.css:63` vs `textarea.css:56`).
- Neither `ui-settings` (the Name field's renderer) nor `entry-list.ts` (the textarea's mount site) sets
  an explicit `size` attribute, so both render at the same default.

**If the two elements genuinely render differently despite identical declared tokens, the most likely
cause is [TKT-0050](tkt-0050-agent-admin-entry-content-css-likely-fully-dead.md)'s open question, not a
component-level defect:** `agent-admin.css`'s OWN rule on `[data-part='entry-content']`/
`[data-part='entry-add-content']` still declares `font: inherit` (among other properties) alongside the
already-proven-dead `min-block-size`. If THAT declaration is not dead by the same scoping-proximity
mechanism (unconfirmed either way — TKT-0050 is still open, undispatched), `font: inherit` would override
`ui-textarea`'s own `font-size: var(--ui-textarea-font)` with whatever `font-size` the surrounding page
context inherits — a real, visible mismatch neither component's own CSS would show in isolation. This is
a hypothesis, not confirmed; TKT-0050 already scoped the investigation this ticket needs, just hadn't been
dispatched yet.

## Acceptance
- Real side-by-side computed-style evidence (a live render, both engines) comparing the `entry-add-content`
  `ui-textarea` against the Agent pane's `ui-text-field` (Name field) on the SAME rendered
  `ui-agent-admin` page: `font-size`, `border-color` (idle/hover/focus), and `border-radius` — confirmed
  equal or a real, named difference identified (not assumed from source-reading alone).
- If a real mismatch is found and it traces to `agent-admin.css`'s competing declarations (the TKT-0050
  mechanism), fixed there — this ticket and TKT-0050 should resolve together, not with two separate,
  potentially conflicting edits to the same `agent-admin.css` rule blocks.
- If a real mismatch is found that does NOT trace to TKT-0050's mechanism (something in `ui-textarea`'s or
  `ui-text-field`'s own CSS this investigation's token comparison missed), root-caused and fixed at the
  component level instead — named explicitly, not assumed.
- If, after real-browser confirmation, NO visible mismatch actually exists (the components already render
  identically and the report was based on a visual impression that doesn't hold up under inspection),
  say so plainly with the comparison evidence, rather than forcing a change with nothing to fix.
- `ui:component-reviewer` dispatched if the fix touches shipped `packages/**` code.
- `npm run check && npm test` green.

## Repro
No fixed repro script. Render `ui-agent-admin` (the docs-site composition guide or any consumer), open
the "+ Add section" form (or an existing entry's content field), and compare its `ui-textarea` against the
Agent pane's "Name" `ui-text-field` on the same page — inspect computed `font-size`/`border-color` on
both in real DevTools.

## Expected vs actual
- **Expected:** `ui-textarea` and `ui-text-field` render with the same font size and border color when
  neither sets an explicit `size`/variant override — per this repo's own field-frame convention
  (ADR-0014 cl.2c, explicitly reused verbatim by `ui-textarea` per ADR-0134).
- **Actual:** reported as visibly inconsistent. Not yet confirmed against a real render — the component-
  level token definitions already match, so the cause (if real) is most likely external interference
  (TKT-0050), not the components themselves.

## Classification
Axis: **visual** (a reported rendering mismatch) with a **structural** likely-cause (TKT-0050's still-
open dead-CSS question on the exact same two `data-part` selectors). Plane:
`packages/agent-ui/app/src/controls/agent-admin/agent-admin.css` (`[data-part='entry-content']`,
`[data-part='entry-add-content']`) × `packages/agent-ui/components/src/controls/textarea/textarea.css` ×
`packages/agent-ui/components/src/controls/text-field/text-field.css` (both already confirmed consistent
with each other at the token-definition level).

## Severity
**cosmetic** — no functional break; a visual-consistency report, pending real-browser confirmation of
whether it's even reproducible.

## Links
- [TKT-0050](tkt-0050-agent-admin-entry-content-css-likely-fully-dead.md) (the still-open, undispatched
  investigation into the exact same two selectors — dispatch together, not separately)
- [TKT-0049](tkt-0049-agent-admin-textarea-min-block-size-dead-css.md) (the sibling fix that already
  proved the scoping-proximity mechanism for `min-block-size` on these same selectors)
- `packages/agent-ui/components/src/controls/textarea/textarea.css:34-38,46,56` (ui-textarea's border/
  font/radius tokens)
- `packages/agent-ui/components/src/controls/text-field/text-field.css:47-51,58,63` (ui-text-field's,
  confirmed identical)
- `packages/agent-ui/app/src/controls/agent-admin/agent-admin.css` (the competing declarations, incl.
  `font: inherit`, TKT-0050 already flagged but did not dispatch)

## Findings

### 2026-07-15 — real side-by-side computed-style evidence (dispatched jointly with TKT-0050)

Mounted `ui-agent-admin` in a real browser (Chromium + WebKit, `npx vitest run --config
vitest.browser.config.ts --project packages`), read the seeded `foundation` entry's
`[data-part="entry-content"]` `ui-textarea` and — after driving the settings pane's drill-in rail to
populate its panel (`ui-nav-rail-item.click()` + `await uiSettings.updateComplete`, mirroring
`settings.browser.test.ts`'s own setup) — the Agent section's `ui-text-field[name="name"]` (the Name
field), both on the SAME rendered page.

**Result: BYTE-IDENTICAL, both engines.**
- `font-size`: `14px` on both.
- `border-color` (idle): `oklch(0.5586 0.0155 93.1)` on both.
- `border-radius`: `12px` on both.

**The reported mismatch does NOT reproduce.** This is not a coincidence of agent-admin.css unifying them —
TKT-0050's joint investigation (see its own Findings) confirmed agent-admin.css's competing declarations on
`entry-content`/`entry-add-content` are ENTIRELY dead (lose to `ui-textarea`'s own `@scope`-scoped rule via
the TKT-0049 scoping-proximity mechanism). Both controls render off their own component-scoped CSS, and —
exactly as this ticket's pre-filing investigation already established at the source level — `ui-textarea`'s
and `ui-text-field`'s own `--ui-{cmp}-border`/`-font`/`-radius` tokens are declared identically
(`text-field.css:47,58,63` vs `textarea.css:34,46,56`). The visual consistency is real and was never at
risk from the component definitions; the only latent threat was agent-admin.css's dead-but-differently-
valued border rule (a genuinely different role, `--md-sys-color-neutral-outline-variant` vs
`--md-sys-color-neutral` — see TKT-0050's Findings), which never actually won the cascade.

**Padding is NOT part of this parity claim** — `ui-textarea` (multi-line, ADR-0134: `padding-block: font ×
0.5`, `padding-inline: font × 0.75`) and `ui-text-field` (single-line: `padding-block: 0`,
`padding-inline: height / 2`) use deliberately different geometry laws by design; the report named font
size and border color specifically, both of which match exactly.

### 2026-07-15 — resolution (closes with TKT-0050)

No component-level fix needed — the mismatch traces to nothing in `ui-textarea`'s or `ui-text-field`'s own
CSS. TKT-0050's dead-CSS removal in `agent-admin.css` (same commit/change) removes the one latent risk
(the differently-valued, but never-winning, border declaration) without altering any rendered pixel — the
computed values above were captured AFTER that removal and are unchanged from the pre-removal state (as
expected: the removed rules were already dead).

Regression test: `packages/agent-ui/app/src/controls/agent-admin/agent-admin.browser.test.ts:319`, the `it`
titled `"TKT-0059: entry-content/entry-add-content's ui-textarea renders the SAME font-size/border-color/
border-radius as the settings pane's ui-text-field (Name field) — the reported mismatch does not
reproduce"` — pins this exact parity going forward, both engines.

Reviewer: `ui:component-reviewer` dispatched jointly with TKT-0050 (scoped to `agent-admin.css`'s diff +
the new test block). Verdict: **GO** (one MINOR test-assertion fix applied before closing — see TKT-0050's
Findings for detail, it concerned the border-color proof, not this ticket's parity test).

Gates: `npm run check` green, `npm test` green (6251/6251), isolated cross-engine `agent-admin.browser.test.ts`
38/38 green (both engines, run twice). See TKT-0050's Findings for the full gate/OOM-contention note (a
full-repo `npm run test:browser` run hit unrelated resource-contention crash from concurrent agents on this
machine — not a regression from this change).
