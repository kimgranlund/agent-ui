# Dogfood lint: the four layers that keep the library's own rules true

> Derived from T-0136 (Kim, 2026-10-13: "we need some kind of linter strategy that ensures dogfooding standards
> are adhered to"). The rules derive from ADR-0245 (one n), its Amendments 3 to 5 (pill radius, control rule,
> pill fields and chips), T-0130 (the 400px column) and T-0135 (a date is a real input). On any conflict the
> ADR wins and the rule is wrong.

Every dogfood catch that can be measured becomes a gate, not a reminder. The four layers run from the source
up to a human look; each layer catches what the one before cannot see.

| Layer | Reads | Catches | Gate | Allowlist |
|---|---|---|---|---|
| 1 Render lint | `getComputedStyle` of every docs demo page and every browsable A2UI catalog widget, at 400 and 1000px, light and dark, Chromium and WebKit | radius by role, square icon buttons, the type floor, the 400px column, nested cards, the height ramp, the text edge | `site/pages/dogfood-render.browser.test.ts` (the `site` shard of `npm run test:browser`) | `scripts/dogfood-render-allowlist.json` |
| 2 Composition lint | the A2UI factories, the A2UI example payloads, the agent-admin presets and the site demos, as text | a composition the library has a control for: a calendar standing in for a date field, a grid of buttons standing in for a board, inline literal geometry | `node scripts/dogfood-compose.mjs selftest` and `--gate` (both in `check:scripts`) | `scripts/dogfood-compose-allowlist.json` |
| 3 Foundations census | every stylesheet and source file under `packages/` and `site/` | a hand-tabled ramp read, a px geometry literal, the retired `glyph` prop and `[scale]` / `[density]` axes | `node scripts/foundations-census.mjs --gate` (in `check:scripts`) | `scripts/foundations-allowlist.json` |
| 4 Review | a screenshot of the real widget beside its approved mockup | what no rule measures yet: balance, hierarchy, a wrong control for the job | a `ui-designer` review (or Kim's look check) | none; a finding becomes a rule or a ticket |

## The rules table

`scripts/dogfood-rules.json` holds both lint layers: `render` (layer 1) and `compose` (layer 2). Each render rule
names its ADR clause, its selector, what it measures and the expected value; every expected value is computed
from `resolve(tier, scale, size, density)` in `packages/agent-ui/shared/src/tokens/scale.mjs` at the element's
register (the nearest `data-tier`, `data-scale`, `data-size` or `size`, and `data-density` on the element or an
ancestor; product at scale sm at the root, widget at scale md on an A2UI surface).

| Render rule | Expected |
|---|---|
| `register` | the element's cascade n (its `--md-sys-height` / 4) equals the register's n |
| `pill-radius` | a single-line control or chip has radius at least h/2 |
| `icon-square` | a `ui-button` with an icon and no text is as wide as it is tall |
| `type-floor` | no visible text under `CFG.floor` (9px) |
| `column` | at 400px nothing ends past the content column unless an overflow-x frame inside it holds it |
| `nested-card` | no `ui-card` inside a `ui-card` |
| `control-height` | a single-line control is `resolve().h` (4n) tall |
| `text-edge` | host padding plus the text slot's padding is 2n - c |
| `card-radius` | a `ui-card` takes `resolve().card.radius` |
| `panel-radius` | a visible listbox panel is concentric: 2n + c |

| Compose rule | Use | Not |
|---|---|---|
| `date-field` | `ui-text-field type=date` | a `ui-calendar` in a `ui-popover` or beside a calendar-icon `ui-button` (a Calendar in a Popover in a payload) |
| `board-grid` | `ui-board-grid` (BoardGrid) | a `ui-grid` of cell `ui-button`s (a Grid whose children are all Buttons) |
| `inline-geometry` | the derived tokens, a control's `size`, a container's `data-*` register | an inline style setting padding, margin, gap, radius, height or font-size to a literal length |

## The allowlists

Each allowlist is a flat JSON object, one `"<key>": "<why>"` entry per line in sorted order, so a lane deletes only
its own lines. A render key is `demo/<page>#<rule>` or `widget/<Type>#<rule>`, with `@chromium` or `@webkit` when it
holds in one engine only; a compose key is `<path>#<rule>`. Both gates fail on a finding with no entry, on an
entry that no longer finds anything (stale: the fix landed, delete the line), and on an entry without a reason.
Day one (T-0136) listed 9 render findings and 53 compose findings, every compose one a site demo's inline geometry.

## How to add a rule

1. Add the row to `scripts/dogfood-rules.json` under `render` or `compose`, citing the ADR clause it enforces.
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
