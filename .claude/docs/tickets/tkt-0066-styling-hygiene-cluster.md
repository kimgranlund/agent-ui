---
doc-type: ticket
id: tkt-0066
status: done
date: 2026-07-15
owner:
kind: bug
---
# TKT-0066 — styling-hygiene cluster from the TKT-0065 lateral review (@scope role reads · literals · dialect forks · the dimensional-constants ruling)

## Summary
The styling axis of the TKT-0065 lateral review surfaced a cluster of `@scope` token-hygiene and
dialect findings needing per-file judgment (which token to mint/route through) rather than a mechanical
one-liner — routed here per the TKT-0046 discipline. The mechanical/high-severity styling findings
(combo-box placeholder ink F13, agent-admin dead `error` token F6, nav-rail reduced-motion F10, select
dead token F14) were already fixed inline in the campaign — this ticket is the remainder.

## The findings (all `file:line`-verified by the sweep, working tree 2026-07-15)
1. **Direct role reads inside `@scope`** (DRIFT — each wants its own `--ui-{cmp}-*` token minted in the
   `:where()` block, per the two-block law): `toast.css:56` (host ink), `text.css:259` (quote-variant
   border), `timeline-item.css:361` (`:state(truncated)` warning ring), `swiper-pagination.css:39`
   (fraction ink — the swiper family token tunnel never minted a fraction-ink role),
   `conversation-composer.css:174` (context-chip bg).
2. **Radius literals** (DRIFT, low): `conversation.css:34` (`12px`), `:55` (`10px`) — the sibling
   toast/menu/card sheets read `--ui-radius-base`.
3. **Empty-`:where()` dialect fork** (DRIFT, low): `master-detail-pane.css:9-11` ships a vacuous empty
   token block; `form-provider.css` documents the OPPOSITE dialect ("an empty token block is
   deliberately NOT invented"). Pick one dialect, note it in the styling axis pack.
4. **Forced-colors documented-absence dialect** (DRIFT, low): `settings.css`/`master-detail.css` paint
   but carry neither an fc block nor the documented-absence comment the fleet norm uses (list.css /
   theme-provider.css / agent-admin.css all document WHY).
5. **THE RULING (GAP)** — dimensional `:root` constants (`--ui-font-*`, `--ui-space-*`,
   `--ui-radius-base`) are read directly inside `@scope` across 10+ files (nav-rail, toast, card,
   color-picker, text, timeline-item, attachment, agent-admin, swiper-pagination), while the gold
   exemplars route ramp reads through the own chain and the sanctioned direct-read list is only
   ring/motion/line-height. Two coherent resolutions: (a) extend the sanctioned class to ALL
   non-repointable `:root` constants (pragmatic — matches the majority-in-practice; needs the hygiene
   predicate lists in the CSS pin tests updated), or (b) enforce own-chain routing (matches the gold;
   10+ file edits). **Recommendation: (a)** — these constants are deliberately non-repointable (the
   ADR-0007 universal-selector rule already splits constants from derived tokens), so own-chain routing
   adds indirection without a theming benefit. Kim rules; the ruling lands in `interaction-states.md` or
   `tokens.md` + the styling axis pack's ledger.

## Acceptance
- Findings 1–4 fixed per-file (each token minted from the right role, in the file's own idiom), OR
  individually ratified with an in-file comment where the deviation is genuinely deliberate.
- Finding 5 ruled (either direction), the law doc + the `agent-ui-lateral-review` styling pack updated,
  and — if (a) — the CSS pin tests' `sharedFleet` whitelists extended to match.
- `npm run check && npm test` green; scoped browser gates for touched components green both engines;
  the theme-provider fixture regenerated if CSS changed.

## Links
- [TKT-0065](tkt-0065-lateral-review-campaign-1.md) — the campaign that surfaced this cluster (styling
  axis findings F1–F5, F7–F9, F15).

## Findings

### 2026-07-15 — items 1–4 fixed and gated; item 5 (the ruling) remains open

**Item 1 — five own-chain tokens minted, each from the role the sweep named:**
- `toast.css` → `--ui-toast-ink: var(--md-sys-color-neutral-on-surface)`.
- `text.css` → `--ui-text-quote-border: var(--md-sys-color-neutral-outline-variant)` (the quote pin
  test in `text-css.test.ts` updated in the same change — it had enshrined the old raw-role read).
- `timeline-item.css` → `--ui-timeline-item-truncated-border: var(--md-sys-color-warning)`.
- `swiper.css` → `--ui-swiper-pagination-fraction-ink`, minted in the FAMILY TUNNEL
  (`:where(ui-swiper)`, beside `--ui-swiper-dot-color-active`) and consumed by
  `swiper-pagination.css`. First attempt minted it pagination-side; `swiper-css.test.ts`'s pin
  correctly rejected that against the documented "pagination declares NOTHING" tunnel design — the
  pin was right, the fix moved.
- `conversation-composer.css` → `--ui-conversation-composer-chip-bg: var(--md-sys-color-neutral-container)`.

**Item 2 —** `conversation.css` radius literals routed through minted
`--ui-conversation-radius: var(--ui-radius-base, 12px)` + `--ui-conversation-bubble-radius:
calc(… - 2px)` (identical rendered values; deliberately minted-not-direct-read so the fix stands
regardless of item 5's ruling).

**Item 3 —** the form-provider dialect wins: `master-detail-pane.css`'s vacuous empty `:where()`
block removed; an in-file comment records "an empty token block is deliberately NOT invented".

**Item 4 —** `settings.css` + `master-detail.css` gained the fleet's documented-absence
forced-colors comments (the list.css/theme-provider.css shape). While in `master-detail.css`, the
campaign's orphaned styling F11 (the back affordance had NO hover/focus-visible treatment) was fixed
in the same pass: minted `--ui-master-detail-back-bg-hover` + an inset focus-visible ring
(nav-rail/tabs precedent).

**Gates:** `npm run check` green · scoped browser toast/text/timeline-item/swiper 166/166 and
conversation/master-detail/settings 58/58, both engines · swiper+text jsdom pins 182/182 · the
theme-provider built-CSS fixture regenerated (553 791 bytes) with both its freshness + browser
consumer gates green.

**Item 5 stays open** — the dimensional-constants ruling is Kim's; recommendation (a) stands as
written above.

### 2026-07-15 (later) — item 5 RULED (b): own-chain routing enforced; swept clean + gated — CLOSED

Kim ruled **against** the recommendation: **(b) enforce own-chain routing**. Executed same-day:

- **Census (machine, comment-stripped):** 9 files / 22 direct reads — nav-rail (6) · toast (4) ·
  color-picker (3, one shared `label-font` token) · swiper-pagination (3, minted in the
  `:where(ui-swiper)` FAMILY TUNNEL per its pagination-declares-nothing pin) · agent-admin (2) ·
  markdown · attachment · text · timeline-item (1 each). Every read now consumes a role-named
  `--ui-{cmp}-*` token minted in the `:where()` block. (The first, regex-naive census claimed 44
  files — `@scope` mentions inside banner COMMENTS matched; the comment-stripped rerun matched the
  ticket's own list. Strip comments before text-scanning CSS.)
- **The law landed** in `tokens.md` §Consumption invariants: `@scope` never reads
  `--ui-font-*`/`--ui-space-*`/`--ui-radius-base` directly; the sanctioned direct-read list stays
  exactly ring/motion/`--ui-control-line-height`; family leaves route via the family tunnel.
- **A standing trip-wire now enforces it:** `controls/styling-gates.test.ts` (the naming-gates
  fs-walk shape) — fleet-wide scan of every package's `@scope` bodies, comment-stripped, with a
  synthetic negative control proving the scan bites. 3/3 green on the swept fleet.
- The `agent-ui-lateral-review` styling pack's ledger entry flipped from "PENDING a ruling" to the
  ruled law.

**Gates:** `npm run check` green · touched-set browser 338/338 (components) + 104/104
(nav-rail/agent-admin/code), both engines · theme-provider fixture regenerated again (555 449 bytes)
with both gates green · full jsdom sweep green.
