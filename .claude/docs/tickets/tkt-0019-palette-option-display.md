---
doc-type: ticket
id: tkt-0019
status: done
date: 2026-07-11
owner:
kind: bug
---
# TKT-0019 — the search palette's option display is an unscannable paragraph wall; dialog backdrop too light

## Summary
Kim's report (2026-07-11, screenshot, against the freshly shipped TKT-0018 palette): "the content
display needs to be thoroughly decomposed as this is simply not a helpful way to display
anything" + "dialog backdrop should be black 80% opacity". Confirmed at capture: every result
option is ONE flat `textContent` string (`site/lib/command-palette.ts:46` — `"{tag} ({name}) —
{description}"`) that wraps to ~3 lines at the palette's width, with zero type hierarchy — the
list reads as a wall of same-size paragraphs, not a scannable command palette. The backdrop rides
`--ui-modal-scrim: var(--md-sys-color-neutral-scrim)` (modal.css:37), visibly too light over busy
pages.

**Kim's rulings (captured at intake, one batched round):**
1. **Backdrop:** add a NEW token to `tokens.css` — `--{namespace}-dialog-backdrop` (the house
   color-role namespace), value `oklch(0 0 0 / 0.8)` (black, 80% opacity) — and the modal fleet's
   `::backdrop` scrim consumes it (the generic role name = fleet-wide, every `ui-modal` dialog).
2. **Option layout: two-line.** Line 1 (the title): the TAG prominent + the proper name muted
   beside it — tag stays visually/textually FIRST (the `^ui-` regex anchor ruling from TKT-0018
   depends on labelText leading with the tag). Line 2: the description in smaller, muted type,
   clamped to ONE line with an ellipsis — never wraps.

## Acceptance
- A palette result renders as the ruled two-line shape: `{tag}  {Name}` title line (tag
  prominent, name muted), one clamped description line below in secondary type; no option ever
  wraps beyond its two lines (browser-asserted at a realistic narrow width with a long
  description).
- The description is NOT part of the option's committed `label` / filter labelText (it already
  rides `data-keywords` for filtering) — `select` detail.label stays the title, and the `^ui-`
  anchor regex keeps matching (regression-asserted).
- The mechanism respects the composition boundary: if the option content model needs a
  description role, it lands in the CONTROL (`[data-role=description]` beside the existing
  `[data-role=shortcut]` exclusion — command-modal.css owns the two-line/clamp styling; the
  descriptor/docs updated), never a site-side CSS reach into control internals (the ADR-0102
  three-lane law).
- `tokens.css` gains the dialog-backdrop token exactly as ruled (name per the house namespace,
  `oklch(0 0 0 / 0.8)`); `--ui-modal-scrim`'s default consumes it; every modal backdrop darkens
  (the token gate updated if it counts names); WHCM/forced-colors untouched (the backdrop is
  already excluded there).
- Existing suites green (the shipped 58 jsdom + 24 browser command-modal tests untouched);
  cross-engine legs for the new display shape; descriptors/docs truthful; fixture regenerated at
  commit (modal.css + command-modal.css both drift it).

## Repro
Open any docs page → ⌘K → observe: every result is a 2-3-line wrapping paragraph, uniform type;
the page behind is barely dimmed. Screenshot on record (Kim's report).

## Expected vs actual
- **Expected:** a scannable list — two-line options with tag-led title hierarchy + one clamped
  muted description line; a black 80% backdrop isolating the palette.
- **Actual:** flat concatenated paragraphs at uniform size wrapping to 3 lines; a light scrim.

## Classification
Axis: **visual/structural (content display decomposition)** — planes: `site/lib/command-palette.ts`
(the flat textContent composition), `controls/command-modal/` (the option content model + CSS gain
the description role/two-line layout — component-owned lane), `controls/modal/modal.css` +
`tokens.css` (the scrim role — token lane, Kim-specified verbatim).

## Severity
**major** — the flagship dogfood surface (same-day QA class, the TKT-0014/0015/0017 pattern).

## Links
- `site/lib/command-palette.ts:39-47` (the flat label build + the tag-first/`^ui-` invariant note).
- `packages/agent-ui/components/src/controls/command-modal/command-modal.{ts,css,md}` — the
  content model (`[data-role=shortcut]` exclusion precedent at `#labelText`), option CSS.
- `packages/agent-ui/components/src/controls/modal/modal.css:37,82-89` — `--ui-modal-scrim` +
  the ::backdrop rule + the forced-colors exclusion.
- `packages/agent-ui/shared/src/tokens/tokens.css` + its structural gate (`tokens.test.ts`) —
  the new dialog-backdrop role lands here (Kim-authorized, name+value specified).
- TKT-0018 (`4ee53ee`) — the shipped palette; the `^ui-` anchor ruling this fix must preserve.

## Findings

### 2026-07-11 — root cause confirmed, both legs

**Backdrop.** `modal.css:37` — `--ui-modal-scrim: var(--md-sys-color-neutral-scrim)` — resolves to
`--md-sys-color-neutral-500-300` (30% neutral alpha), the generated per-family scrim ladder's own mid rung.
That ladder tops out at `-scrim-strongest` (60%, `-500-600`) but `--ui-modal-scrim` was never repointed to it,
and even 60% neutral-tinted alpha is not the same thing as an opaque-feeling black isolation scrim — Kim ruled
a dedicated, scheme-invariant black-80% role instead of reaching for a stronger rung of the existing (tinted,
per-family) ladder.

**Option display.** `site/lib/command-palette.ts:46` (pre-fix) set the WHOLE option's `textContent` to one
concatenated string `"{tag} ({name}) — {description}"`. `command-modal.css`'s `[role=option]` rule is a single
`display:flex` row with no second line in the content model at all — every option was, structurally, one long
inline run with zero type hierarchy between title and description, wrapping to 2-3 lines of uniform-size text
at the palette's fixed width. There was no `[data-role=description]` role for the control to hang two-line
styling off of, so the CSS-less-consumer three-lane law (ADR-0102) put the real fix in the CONTROL's own
content model + CSS, not a site-side reach into command-modal internals.

### 2026-07-11 — fix shape

**Backdrop (token lane, Kim-specified verbatim):** added `--md-sys-color-dialog-backdrop:
light-dark(oklch(0 0 0 / 0.8), oklch(0 0 0 / 0.8))` to `tokens.css`'s HAND-AUTHORED block (④, alongside the
tint-wash/track/selected roles ①–③) rather than inside the generated `neutral` family's scrim ladder — this
is a one-off, non-family role with no generator-emitted home, the SAME shape as ①–③, and sitting outside the
generated block means a future regen can't silently drop it. Wrapped in `light-dark()` with identical legs
(the sheet's own idiom for every role, scheme-invariant or not — e.g. the `-tint-*`/`-selected` roles above it).
`modal.css:37`'s `--ui-modal-scrim` now defaults to `var(--md-sys-color-dialog-backdrop)` (the public dial is
untouched — a consumer can still override `--ui-modal-scrim` directly).

**Option display (component-owned lane):** `command-modal.ts`'s `#labelText` exclusion selector gained
`[data-role=description]` alongside the existing `[data-role=shortcut]`/`[data-role=icon]`/`[aria-hidden=true]`
— but selector-based ONLY, no `aria-hidden` added to the description itself (unlike shortcut), so it stays
fully in the accessibility tree per Kim's stated preference. `command-modal.css`'s `[role=option]` gained
`flex-wrap: wrap`, and a new `[data-role=description]` rule (`flex-basis:100%` forces it onto its own line
regardless of how many title-row children precede it; `min-inline-size:0` overrides the flex default so
`overflow:hidden`/`text-overflow:ellipsis`/`white-space:nowrap` can actually clamp instead of just growing the
box). Description ink stays the muted role UNCONDITIONALLY under `[data-active]` (the shortcut precedent —
not re-colored to the active ink), which is AA-proven by the same composed-surface math tokens.test.ts already
runs for `-on-surface-variant`. `command-modal.md`'s contentModel/events/keyboard prose + a new "two-line
option shape" section describe the role truthfully. `site/lib/command-palette.ts`'s `buildOption` now appends a
separate text node (title, `{tag} ({name})`, no trailing description) plus a `[data-role=description]` div —
`data-keywords` unchanged (still folds tag+description, so the description stays filterable via keywords even
though it's excluded from `labelText`).

### 2026-07-11 — gates

`npm run check` clean. Scoped jsdom (`command-modal` + `modal` + `shared` + `command-palette.test.ts`): 142/142
passed. Scoped browser, both engines (`command-modal.browser.test.ts` + `modal.browser.test.ts` +
`command-palette.browser.test.ts`): 58/58 passed — two real findings surfaced and fixed during this pass:
(1) the backdrop's `getComputedStyle(dialog, '::backdrop').backgroundColor` serializes as a literal `oklch(...)`
string in both real engines (not down-converted to `rgb()`), so the pre-existing local `alphaOf` test helper
(regex-matches `rgba?\(...\)` only) silently returned `1` for it — masked previously because the ONLY existing
assertion was `toBeGreaterThan(0)`, true either way; extended `alphaOf` (modal.browser.test.ts) to also read the
trailing `/ alpha` component any modern CSS Color 4 function serializes, so the new `toBeCloseTo(0.8, 1)` leg
now genuinely proves the darker backdrop. (2) the two-line-height regression test's initial tolerance (`+2px`)
didn't budget for `--ui-command-modal-item-gap` landing as the row-gap between title/description lines under
`flex-wrap` — loosened to a still-tight-but-correct bound (`< oneLineHeight + descLineHeight * 2`, i.e.
genuinely less than a third line's worth of growth) rather than a brittle pixel-exact figure.

Full `npm test` surfaced two out-of-scope-adjacent, real drifts caused by these edits, both resolved: (a)
`site/pages/tokens-doc.test.ts`'s family-count gate legitimately gained a tenth family — `--md-sys-color-
dialog-backdrop` parses as `{family:'dialog', role:'backdrop'}` via the exact same bare-utility-token shape as
the existing `focus` pseudo-family (no special case needed) — updated the expected list + added a `dialog`
parity assertion beside the existing `focus` one; (b) `site/lib/llms.test.ts`'s committed
`site/public/llms-full.txt` corpus embeds `command-modal.md`'s prose verbatim and drifted once that file
changed — regenerated via `node scripts/generate-llms-full.mjs` (a deterministic, mechanical script, distinct
from the reserved `theme-provider-built.css` CSS fixture). `npm run size`: `command-modal` marginal 1093 B gz
(within its 2048 B budget), `modal` marginal 0 B gz (no measurable delta) — both clean.

`site/lib/__fixtures__/theme-provider-built.css` was NOT touched (per constraint); its own drift gate
(`site/lib/theme-provider-build-fixture.test.ts`) fails as expected against these CSS changes — left for the
host to regenerate at commit.

No deviations from the two ruled fixes. Both are complete, gate-clean, and ready for review.
