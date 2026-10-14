# Dogfood lint: the four layers that keep the library's own rules true

> Derived from T-0136 (Kim, 2026-10-13: "we need some kind of linter strategy that ensures dogfooding standards
> are adhered to"). The rules derive from ADR-0245 (one n), its Amendments 3 to 5 (pill radius, control rule,
> pill fields and chips), T-0130 (the 400px column) and T-0135 (a date is a real input). On any conflict the
> source rule (the ADR clause, or the ticket and reference-doc rule it cites) wins and the lint rule is wrong.

Every dogfood catch that can be measured becomes a gate, not a reminder. The four layers run from the source
up to a human look; each layer catches what the one before cannot see.

| Layer | Reads | Catches | Gate | Allowlist |
|---|---|---|---|---|
| 1 Render lint | `getComputedStyle` of every docs demo page, every browsable A2UI catalog widget and every persona seed that renders a persona widget (BookingForm, BookingConfirmation, CardTable, QuestionCard, ContrastPair; T-0144), at 400 and 1000px, light and dark, Chromium and WebKit | radius by role, square icon buttons, the type floor, the 400px column, nested cards, the height ramp, the text edge, hugging badges, option indicators, inline links, adornment gaps, disabled contrast, avatar and badge contrast, button identity, split action groups, prose gaps, glyph gaps, clipped demo cards | `site/pages/dogfood-render.browser.test.ts` (the `site` shard of `npm run test:browser`) | `scripts/dogfood-render-allowlist.json` |
| 2 Composition lint | the A2UI factories, the A2UI example payloads, the agent-admin presets and the site demos, as text | a composition the library has a control for: a calendar standing in for a date field, a grid of buttons standing in for a board, inline literal geometry | `node scripts/dogfood-compose.mjs selftest` and `--gate` (both in `check:scripts`) | `scripts/dogfood-compose-allowlist.json` |
| 3 Foundations census | every stylesheet and source file under `packages/` and `site/` | a hand-tabled ramp read, a px geometry literal, the retired `glyph` prop and `[scale]` / `[density]` axes | `node scripts/foundations-census.mjs --gate` (in `check:scripts`) | `scripts/foundations-allowlist.json` |
| 4 Review | a screenshot of the real widget beside its approved mockup | what no rule measures yet: balance, hierarchy, a wrong control for the job | a `ui-designer` review (or Kim's look check) | none; a finding becomes a rule or a ticket |

Layer 1 and `npm run test:eval-catalog` are local and merge-queue gates, not CI: `.github/workflows/ci.yml` runs
`npm run check` and `npm test` and never `test:browser`, so a lane runs the render lint itself before it lands. Layers
2 and 3 ride `check:scripts`, which CI runs.

## The rules table

`scripts/dogfood-rules.json` holds both lint layers: `render` (layer 1) and `compose` (layer 2). Each render rule
names its source rule (in the `adr` field), its selector, what it measures and the expected value; every geometry value is computed
from `resolve(tier, scale, size, density)` in `packages/agent-ui/shared/src/tokens/scale.mjs` at the element's
register (the nearest `data-tier`, `data-scale`, `data-size` or `size`, and `data-density` on the element or an
ancestor; at the root the shared `ROOT_REGISTER` of `scripts/lib/foundations-rules.mjs`, the generator's root inputs,
product at scale md since Amendment 8; widget at scale md on an A2UI surface, which the renderer stamps). A sweep leg
asserts the rendered `:root` inputs equal `ROOT_REGISTER`, so a root change edits one line and regenerates. The contrast rules expect a fixed
ratio or a comparison with the same control enabled, and `glyph-gap` reads the glyph's own cascade n.

| Render rule | Expected |
|---|---|
| `register` | the element's cascade n (its `--md-sys-height` / 4) equals the register's n |
| `pill-radius` | a single-line control or chip has radius at least h/2, the segmented control's track outline (its `::after`) included (T-0144); a square entry cell is exempt (see `entry-cell-radius`) |
| `icon-square` | a `ui-button` with an icon and no text is as wide as it is tall |
| `type-floor` | no visible text under `CFG.floor` (9px); a glyph is not text (Amendment 6), so glyphs are exempt and checked by `glyph-box` |
| `column` | at 400px nothing ends past the content column unless an overflow-x frame inside it holds it |
| `nested-card` | no `ui-card` inside a `ui-card` |
| `control-height` | a single-line control is `resolve().h` (4n) tall |
| `text-edge` | host padding plus the text slot's padding is 2n - c |
| `card-radius` | a `ui-card` takes `resolve().card.radius` |
| `panel-radius` | a visible listbox panel is concentric: 2n + c |
| `badge-hug` | a `ui-badge` is no wider than its max-content width (T-0140) |
| `option-indicator` | every `ui-multi-select` option paints its indicator, selected or not (T-0140) |
| `inline-text` | a `ui-text` link or span inside running text is `display: inline` (T-0140) |
| `adornment-gap` | adjacent trailing adornments of a `ui-text-field` sit at least c apart (T-0140) |
| `entry-cell-radius` | a square entry cell (`ui-otp-field` cell) is a round square at radius n, not a pill (Amendment 6) |
| `glyph-box` | a glyph (`ui-glyph`'s mark, the board-grid intent mark, the HUD and result-card stat marks) is exactly its glyph box max(8px, 2n - 2c) (Amendment 6; the 8px floor is T-0143) |
| `dash-scale` | no svg shape is non-scaling-stroke with a dasharray other than none (the browser reads such a pattern in screen px; T-0141) |
| `link-ink` | an `a[href]` inside a `ui-*` host is never the browser's default link colour (T-0141) |
| `disabled-ink` | a disabled `ui-button` or `ui-toggle`'s ink contrast against its fill is below the same control's with `disabled` lifted (T-0144) |
| `disabled-ghost` | a disabled ghost `ui-button` paints no background (T-0144) |
| `disabled-edge` | a disabled switch track, checkbox box or radio ring keeps at least 1.3:1 against its surface, fill or border (T-0144) |
| `disabled-toggle-fill` | a disabled unpressed `ui-toggle` paints the enabled unpressed fill (T-0144) |
| `button-text-ink` | a `ui-text` inside a `ui-button` takes the button's colour (T-0144) |
| `avatar-disc` | an initials or icon `ui-avatar` disc is at least 1.3:1 against the surface behind it (T-0144) |
| `badge-overlay` | a `ui-badge` positioned over an image has an opaque fill and ink at least 4.5:1 (T-0144) |
| `button-identity` | every visible `ui-button` paints an icon or a label wider than 0 (T-0144) |
| `action-group` | the buttons of a flex row that also holds other content share one line, or none shares a line with that content (T-0144) |
| `prose-gap` | a `p` under a box (a specimen, a card, a button) sits at least n below it (T-0144) |
| `glyph-gap` | a game-hud or result-card stat glyph sits at least its cascade n from its label (T-0144) |
| `scroll-clip` | at 400px no `ui-card` runs past a demo's overflow-x frame (a `ui-*` control's own scroller is exempt) (T-0144) |

The contrast rules (`disabled-*`, `avatar-disc`, `badge-overlay`) read `site/lib/dogfood-contrast.ts`: each painted
layer (a computed background colour, a flat gradient layer, a border, an ink) resolves to sRGB channels, flattens
source-over down to an opaque colour, and the pair gives the WCAG 2.x ratio. A real image in the stack has no single
colour, so a rule that meets one skips the element, except `badge-overlay`, whose fill must be opaque on its own.
The field-boundary 3:1 role landed with T-0143 (ADR-0245 Amendment 7): `--md-sys-color-neutral-field-outline` holds at
least 3:1 on every plane, gated by `tokens.test.ts` and `field-outline.browser.test.ts` rather than a render rule here.
The standalone-icon floor is ruled out: an icon inside a `[data-tier]` region stays 2n (Amendment 7, item 3), so no
0.875-of-font-size rule exists, and `glyph-box` carries the only floor (8px).

| Compose rule | Use | Not |
|---|---|---|
| `date-field` | `ui-text-field type=date` | a `ui-calendar` in a `ui-popover` or beside a calendar-icon `ui-button` (a Calendar in a Popover in a payload) |
| `board-grid` | `ui-board-grid` (BoardGrid) | a `ui-grid` of cell `ui-button`s (a Grid whose children are all Buttons) |
| `inline-geometry` | the derived tokens, a control's `size`, a container's `data-*` register | an inline style setting padding, margin, gap, radius, height or font-size to a literal length |

## The allowlists

Each allowlist is a flat JSON object, one `"<key>": "<why>"` entry per line in sorted order, so a lane deletes only
its own lines. A render key is `demo/<page>#<rule>`, `widget/<Type>#<rule>` or `persona/<seed>#<rule>`, with `@chromium` or `@webkit` when it
holds in one engine only; a compose key is `<path>#<rule>`. Both gates fail on a finding with no entry, on an
entry that no longer finds anything (stale: the fix landed, delete the line), and on an entry whose reason names
no owner: a `T-NNNN` ticket, an `ADR-NNNN` or a ruling (T-0170, `hasOwner` in `scripts/lib/foundations-rules.mjs`).
An allowlist holds only real debt with an owner. Two ways out of it that are not debt (T-0170):

- A permanent render specimen carries `data-dogfood-ok="<rule>"` and a non-empty `data-dogfood-reason` on the
  element; the nested-card rule honours it (the card demo's nested-card radius specimen).
- A compose rule's `exempt` list in `scripts/dogfood-rules.json` takes a file whose literal geometry is legitimately
  literal (a specimen frame, the sandbox document) out of that rule, `{ path, reason }`, the reason owned like an
  entry; an exemption that finds nothing is stale.

Day one (T-0136) listed 9 render findings and 53 compose findings, every compose one a site demo's inline geometry.
T-0170 fixed two render findings (ui-code border-box, the avatar plane), scoped glyph-gap off a badge mark (two
findings), marked the specimen, moved four to owner tickets, migrated 22 demos to
the `--md-sys-space-*` steps, exempted 6 and left 22 compose entries owned by T-0190.

## How to add a rule

1. Add the row to `scripts/dogfood-rules.json` under `render` or `compose`, citing in its `adr`
   field the rule it enforces: the ticket and the reference-doc rule (`geometry.md`, this file), or an existing
   ADR clause. ADRs are frozen (T-0164); the field keeps its name and takes free text.
2. Write its check: a function in `CHECKS` of `site/pages/dogfood-render.browser.test.ts`, or a branch of
   `findingsIn` in `scripts/dogfood-compose.mjs`.
3. Write its negative control: a `PLANTS` entry (a planted violation and a clean twin) in the render test, or
   selftest cases in the compose script. Both suites fail when a rule has no control.
4. Run the gate; list each current violator in the allowlist with a reason, or fix it. Report the count.

## How a review finding becomes a rule

A layer 4 finding (a `ui-designer` review or a look check) names what is wrong on a screenshot. If it can be
measured, it gets a rule: the measurement goes in `render` (a computed style) or `compose` (a source pattern),
the finding's screenshot becomes the negative control's plant, and the review ticket links the rule id. If it
cannot be measured yet, it stays a review item and the ticket says why.
