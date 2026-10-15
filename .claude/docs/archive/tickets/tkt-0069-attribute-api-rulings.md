---
doc-type: ticket
id: tkt-0069
status: done
date: 2026-07-15
owner:
kind: feature
size: small
---
# TKT-0069 — attributes-as-API rulings from the TKT-0065 lateral review (naming.md scope + three vocab/policy GAPs)

## Summary
The attributes axis's judgment findings, routed to the naming-law owner (TKT-0025, the naming master
plan, is live in the working tree — these belong in its orbit, not as freelance edits):

1. **Reserved-word scope amendment** (UNRECORDED-DEVIATION ×2, one ruling): `naming.md` §3 reserves
   `name`/`value` fleet-wide as the form identifiers, but seven non-form controls repurpose them with
   documented local semantics and native-element precedent — `name` on icon (glyph id) / avatar
   (identity) / attachment (file name); `value` on stat / swatch / swiper-item / progress (`<progress
   value>`, `<data value>`, `<option value>` parity). Recommendation: scope the §3 reservation to
   form-participating controls + add §12 entries for the seven. Evidence: naming.md:56-60 vs
   icon.md:12-15 · avatar.md:22-26 · attachment.md:16-19 · stat.md:24 · swatch.md:16-19 ·
   swiper-item.md:13-16 · progress.md:18-21.
2. **`label`-reflect policy** (GAP): toolbar.ts:36 / timeline.ts:23 / status-stream.ts:60 reflect their
   accessible-name `label` with no rationale (timeline cites "the toolbar.ts precedent" — the drift
   propagated); 20 other controls don't reflect it, gold included. Recommendation: `reflect: false` is
   the policy (nothing styles off `[label]`), fix the trio.
3. **`scheme` inherit-sentinel fork** (GAP): `auto` (ramp/swatch) vs `''` (theme-provider — load-bearing
   per its own comment). Ruling: canonize `auto` + record theme-provider's `''` as a §12 exception, or
   align theme-provider.
4. **`duration` type dialects** (GAP): CSS `<time>` string (swiper, reflected) vs milliseconds number
   (toast). Ruling: record duration's canonical shape in §3's concept canon, or rename one side.

Also carried from the sweep, non-blocking: the contract↔props trip-wire compares `String(config.default)`
so descriptor scalar mis-typing is gate-invisible (the 19 quoted-YAML defaults fixed inline in TKT-0065
would not have been caught) — a frontmatter-schema tightening (default's YAML type must match `type:`)
closes the hole permanently; and `grid.md`'s `min` (a CSS length, a DIFFERENT concept from the numeric
range `min`) is a §3 concept-canon candidate.

## Acceptance
Each item ruled + the naming.md/§12 edits landed (via the TKT-0025 owner's process), the trio's reflect
flags fixed if item 2 rules as recommended, and the `agent-ui-lateral-review` attributes-pack ledger
updated. The trip-wire schema tightening is optional scope — file separately if it grows.

## Links
- [TKT-0065](tkt-0065-lateral-review-campaign-1.md) — attributes axis findings F2–F6 + handoffs.
- `.claude/docs/references/naming.md` §3/§10/§12 · `.claude/docs/tickets/tkt-0025-naming-master-plan.md`.

## Findings

### 2026-07-16 — all four RULED by Kim (one AskUserQuestion round); items 2/3/4 executed; item 1 = a pending rename wave

**Item 1 — RULED AGAINST the recommendation: the fleet-wide reservation STANDS, the seven RENAME.**
Not executed inline — the renames are breaking contract changes on shipped, reflected,
CATALOG-VISIBLE attributes (icon/avatar/attachment are A2UI catalog components; their attribute
names appear in agent payloads), so the wave needs the process.md migration step + the A2UI
catalog/corpus moving in lockstep. naming.md §12 records the ruling (explicitly NOT exceptions — a
pending wave). **Derived name proposals** (per §13, awaiting Kim's sign-off before the wave
dispatches):

| control.attr | proposal | derivation |
|---|---|---|
| `ui-icon.name` | `glyph` | the concept IS a glyph id; already fleet vocabulary (badge's glyph part, `--ui-attachment-glyph`) |
| `ui-avatar.name` | `identity` | the source the initials derive from — distinct from `label` (the a11y name) |
| `ui-attachment.name` | `filename` | native `File.name`, one word |
| `ui-stat.value` | `figure` | the displayed metric quantity (alternatives: `metric`, `amount`) |
| `ui-swatch.value` | `color` | it IS a CSS color / `--var` |
| `ui-swiper-item.value` | `key` | the bindable item identity the container's `active` points at (ADR-0019 family) |
| `ui-progress.value` | `current` | pairs with `max` (aria-valuenow parity) — note this one spends the strongest native parity (`<progress value>`) |

**Item 2 — RULED AGAINST the recommendation: `reflect: true` fleet-wide — EXECUTED.** All 20
non-reflecting `label` props flipped (18 defaults + nav-rail-group's and field's explicit
`reflect: false`); the trio (toolbar/timeline/status-stream) was already the ruled shape. 20
descriptors updated in lockstep. Test fallout, all repaired to the ruled truth: 4 direct pins
(avatar/icon/command-modal/timeline-item) updated to `label reflects, siblings don't`; 6 negative
controls (bar-chart/ladder/ramp/swatch/table/field) re-armed — their synthetic reflect-drift was
`label → true`, which is now the REAL value, so they flip `→ false` instead. The policy landed in
naming.md §3.

**Item 3 — as recommended: `'auto'` is the scheme-sentinel canon** (naming.md §3);
theme-provider's `''` recorded in §12 (ADR-0117 load-bearing). No code changes.

**Item 4 — as recommended: `duration` canonically = milliseconds NUMBER** (naming.md §3, the
toast shape); swiper's CSS `<time>` string recorded in §12 (feeds CSS timing). No code changes.

**Carried, still open with item 1:** the `String(default)` trip-wire gate hole (frontmatter-schema
tightening) and `grid.md`'s `min` concept-canon candidate — both fold naturally into the rename
wave's naming.md/§3 pass.

**Gates:** full jsdom 6276/6276 green (341 files) after the reflect sweep · docs-grammar green ·
`npm run check` green.

### 2026-07-16 (later) — the rename wave EXECUTED (names approved verbatim) — CLOSED

Kim approved the seven proposals; execution surfaced an **eighth member the sweep missed**:
`ui-tab.value` — the very precedent `swiper-item.ts`'s own comment cites — renamed to `key`
alongside swiper-item (a proper census of every `value:` prop declaration confirmed all OTHER
`value` props are legitimate form/value controls: the FACE five, calendar, color-picker, and the
`_base` indicator `value='on'` / range `value` native-parity pairs).

**The load-bearing architecture decision: the A2UI wire contract did NOT move.** The catalog keeps
its shipped field names (`Icon.name`, `Stat.value`, `Progress.value`, …) — `catalog.json`'s
`mapsTo` now records the non-identity mapping and a new `mappedAccessorFactory` (factories.ts)
translates wire→prop at apply time (bindings included — `bindProp` routes through the same
`applyProp`). Every corpus record, taught idiom, and agent payload stays valid byte-for-byte;
Tab/SwiperItem expose no catalog properties at all, so their renames are wire-invisible. The known
tree.ts narrowed omitted-prop-reset limitation (non-identity mappings are skipped — the documented
Button.label class) now also covers these six wire props. a2ui suite: 1049/1049 green untouched
except the one Icon-factory pin (now asserts wire `name` lands on `glyph` and never on a stale
`name` expando).

**Component-layer sweep (per process.md's both-spellings/both-trees migration law):** props +
in-control reads · descriptors (attribute entries + example markup; part names like stat's
`data-part="value"` cell deliberately unchanged — the parts namespace is §6's, not §3's) ·
event DETAIL fields deliberately unchanged (`select`'s `{ value, index }` is the committed-
selection value — commit semantics, not the item prop) · all consumer writes (avatar's composed
icon, toast/composer/entry-list icons, text-field + color-picker's composed swatch previews,
swiper/tabs identity resolution) · site pages/demos/preview seeds. The final residue sweep greps
zero for every old spelling. Two markup-form stragglers (avatar/attachment `.browser.test.ts`)
were caught by the browser gates, not the greps — the whole-shape probes failed on non-painting
initials/truncation, exactly the process.md `icon→leading` lesson shape.

**Gates at close:** `npm run check` green · full jsdom 6276/6276 (×2 runs) · renamed-control
browser 286/286 + app-consumers 74/74, Chromium + WebKit · a2ui 1049/1049 · llms-full.txt
regenerated twice (descriptor examples changed) · docs-grammar green. naming.md §12 flipped from
pending-wave to EXECUTED (recording the wire-vs-DOM namespace divergence as deliberate).
