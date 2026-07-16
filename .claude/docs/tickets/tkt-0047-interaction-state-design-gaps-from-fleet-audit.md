---
doc-type: ticket
id: tkt-0047
status: done
date: 2026-07-14
owner:
kind: bug
---
# TKT-0047 — interaction-state design gaps surfaced by the TKT-0046 fleet audit

## Summary
TKT-0046's fleet-wide interaction-state sweep (`.claude/docs/references/interaction-states.md` vs. every
interactive `ui-*` control) found three classes of real deviation that need a design call rather than a
mechanical fix — routed here per TKT-0046's Acceptance ("file a separate, scoped ticket for anything
needing design judgment or touching a control's shipped contract"). All three are **cosmetic/consistency**,
not accessibility regressions (every control still has a compliant focus ring and a working disabled
contract; only the *hover/active/disabled paint mechanism* is inconsistent).

## Acceptance
Each finding below gets its own decision + fix, independently landable:

1. **`ui-checkbox` has no `:hover` state at all** (`packages/agent-ui/components/src/controls/checkbox/
   checkbox.css`) — its Indicator-class siblings both repaint on hover: `ui-switch` steps the track to
   `--ui-switch-track-hover` (switch.css:142-144) and `ui-radio` steps the ring to `--ui-radio-ink`
   (radio.css:160-162). Checkbox's `::before` box has no matching `:hover` rule anywhere in the file. Decide
   whether checkbox should gain a hover treatment (and if so, which — a border-color lift matching radio, or
   a new `--ui-checkbox-bg-hover`/`-border-hover` step) and implement it.
2. **Disabled styling uses ad hoc `opacity` instead of the token-repoint discipline in three places with no
   documented rationale**, unlike the fleet's dominant pattern (button/checkbox/switch/slider/text-field/
   select/textarea all repoint `--ui-{cmp}-bg/-border/-ink` to muted neutral roles):
   - `radio.css:191` — `opacity: 0.5`, explicitly flagged in its own comment as "v1, no danger repoint
     needed" (acknowledged debt, not a documented permanent choice).
   - `combo-box.css:202` — `opacity: 0.5` on the editor's `[aria-disabled='true']` rule; combo-box has **no**
     `:where(ui-combo-box[disabled])` token block at all (unlike its sibling `select.css:151-156`, which
     fully repoints `border`/`bg`/`ink`).
   - `command-modal.css:140` — `opacity: 0.5` on a disabled option row, no comment.
   (NOTE: `calendar.css:411-419` and `color-picker.css:81-87` also use `opacity` for disabled, but both
   carry an explicit, reasoned comment — opacity collapses a multi-layer stacking context, e.g. a calendar
   cell's numeral + selection band + point-glyph, in one declaration where a token repoint would need a
   rule per pseudo-layer. Those two are judged **intentional and out of this ticket's scope** — see TKT-0046
   Findings.) Decide whether opacity is an accepted second disabled mechanism for simple, single-layer parts
   too, or whether radio/combo-box/command-modal should converge on the token-repoint pattern, then apply
   consistently.
3. **`ui-disclosure`'s summary row has no hover feedback** (`disclosure.css`) — only a `:focus-visible` rule
   exists; no `:hover` at all. Its Pattern-class siblings both paint on hover: `ui-tabs` steps ink to
   `--ui-tabs-ink-hover` (tabs.css:82-84) and `ui-menu`'s `[role=menuitem]` steps background to
   `--ui-menu-item-bg-hover` (menu.css:151-153). Decide whether the summary row should gain a matching hover
   treatment (ink-step, matching tabs, is the closer sibling — disclosure has no background fill to step)
   and implement it.

## Repro
No single repro — read the cited `file:line`s directly; each is a static CSS/absence check, not a runtime
bug.

## Expected vs actual
- **Expected:** every Indicator-class control (checkbox/switch/radio) offers the same hover feedback shape;
  every disabled control follows the fleet's dominant token-repoint mechanism, or opacity is explicitly
  ratified as a second accepted mechanism with a stated rule for when it applies; every Pattern-class
  interactive row (tabs/menu/disclosure) paints on hover the same way.
- **Actual:** checkbox is the one Indicator control with zero hover feedback; three controls disable via
  bare opacity with no rationale (vs. two controls that do so **with** a documented multi-layer rationale);
  disclosure is the one Pattern-class row with zero hover feedback.

## Classification
Axis: **structural/consistency** — same axis as TKT-0046, split out because each item needs a design
decision (which hover token/ladder step to mint, whether opacity is an accepted second disabled mechanism)
rather than a mechanical, zero-judgment fix.

## Severity
**cosmetic** — no accessibility regression; every affected control still has a working focus ring and a
functionally inert disabled state. This is a visual-consistency gap only.

## Links
- `TKT-0046` (`.claude/docs/tickets/tkt-0046-fleet-interaction-state-styling-consistency-audit.md`) — the
  audit that surfaced these three findings (see its dated Findings entry for the full sweep table).
- `.claude/docs/references/interaction-states.md` — the standard these deviate from.
- `.claude/docs/adr/0008-interaction-state-styling-standard.md` — hover/active role-ladder + the disabled
  structural-hold discipline (`tokens.md` canon: disabled is a role-repoint, not opacity).

## Findings

### 2026-07-14 — findings 1 and 3 fully closed; finding 2 partial (radio + command-modal done, combo-box deferred)

**Finding 1 — checkbox hover: FIXED.** `checkbox.css` gained `:scope:hover::before { border-color:
var(--ui-checkbox-border-checked); }`, mirroring `radio.css`'s own border-lift mechanism exactly (no
new token minted — reuses the existing `--ui-checkbox-border-checked`). Real cross-engine proof in
`checkbox.browser.test.ts`.

**Component-reviewer MINOR-BUT-REAL fix caught before landing**: the hover rule was first authored
AFTER the `:state(user-invalid)` rule at equal specificity (0,2,1) — source order let hover mask the
danger border, so hovering a required, unchecked, already-blurred checkbox would hide the invalid
signal at the exact moment a user is about to interact. Fixed by relocating the hover rule ABOVE
user-invalid (source order now correctly lets the danger colour win), matching the fleet's own
documented precedence law (`text-field.css:205-208`: idle < hover < user-invalid, source-later wins).
A new regression test proves this — and its own first version was itself briefly wrong: it compared
computed `border-color` immediately after `userEvent.hover()` with no settle wait, catching the
in-flight `border-color` transition (`--ui-motion-fast` = 300ms, `dimensions.css:82`) mid-interpolation
rather than either endpoint colour. Fixed by waiting past the real transition duration (`setTimeout`,
350ms) on both measurements before asserting equality — a 2-animation-frame wait (the pattern the
pre-existing, adjacent user-invalid test uses) is only sufficient for an INEQUALITY assertion (any
mid-transition value already differs from idle), not for an EXACT settled-value comparison.

**Finding 2 — disabled-opacity → token-repoint convergence: PARTIAL.**
- `radio.css` — DONE. Removed the redundant `opacity: 0.5` from the disabled STYLES rule; the TOKEN
  block's own `:where(ui-radio[disabled])` already fully repoints border/ink/dot to
  `--md-sys-color-neutral-on-surface-variant`, so the opacity was pure double-dimming. **Named
  consequence** (component-reviewer finding): radio's slotted LABEL text has no ink token of its own in
  `radio.css` — the removed opacity was the ONLY thing dimming it, so a disabled labelled radio's text
  now renders at full ink, a real (intentional, now-recorded) behavior change. This converges radio with
  checkbox, which never dimmed its label either — the fleet is now CONSISTENT on this point, and disabled
  remains functionally inert + announced (interaction-states.md §3), so no accessibility regression. A
  future Indicator-class disabled-label-ink treatment (`--md-sys-color-neutral-on-surface-disabled`
  exists, tokens.css:60, with a genuinely distinct value) is a separate design call, not this ticket.
  Cross-engine proof in `radio.browser.test.ts` (checked-state fill colour, since an UNCHECKED radio's
  border token is already identical idle vs. disabled — both `-on-surface-variant` — so that leg alone
  proves nothing; the test was corrected once to target the checked fill instead, verified sound).
- `command-modal.css` — DONE. `[role='option'][aria-disabled='true']` now repoints `color` to the
  EXISTING `--ui-command-modal-muted-ink` token (already used for the group-label ink in the same file)
  instead of `opacity: 0.5`, matching `select.css`'s fully-repointed `[disabled]` precedent exactly.
  Cross-engine proof in `command-modal.browser.test.ts`.
- `combo-box.css` — **DELIBERATELY NOT TOUCHED.** A separate, concurrently-running session was actively
  editing this exact file at the time of this work (confirmed via live process evidence — a running
  `vitest`/`npm run dev` plus very recent modification timestamps in the same area); touching it risked
  a real collision with in-progress work. combo-box.css's own `opacity: 0.5` disabled rule (and its
  missing `:where(ui-combo-box[disabled])` token block, unlike sibling `select.css`) remains open. **This
  ticket stays open for this leg** — either resume it directly once the concurrent session's combo-box
  work has landed, or split it into its own follow-up ticket at that point.

**Finding 3 — disclosure hover: FIXED, with a named, real limitation.** `disclosure.css` gained a new
`--ui-disclosure-ink-hover` token (reading `var(--md-sys-color-neutral-on-surface-hover)` — an EXISTING
fleet token-layer role, not newly minted) and `:scope [data-part='summary']:hover { color:
var(--ui-disclosure-ink-hover); }`, structurally mirroring `tabs.css`'s ink-step mechanism. Static
CSS-text coverage added to `disclosure-css.test.ts` (no browser hover-colour test — see below for why).

**Verified, real token-layer gap (component-reviewer confirmed by reading `tokens.css` directly):**
disclosure's idle ink (`--md-sys-color-neutral-on-surface`) and the new hover token
(`--md-sys-color-neutral-on-surface-hover`) currently resolve to the EXACT SAME palette value
(`light-dark(neutral-950, neutral-050)`, `tokens.css:56,58`) — this specific hover wiring is
architecturally correct (reads the semantically right role, the fleet's "always read through a role"
convention) but is CURRENTLY VISUALLY UNDETECTABLE. Porting tabs' literal mechanism (idle
`-on-surface-variant` → hover `-on-surface`, which is why tabs' hover IS visible today) was considered
and rejected: tabs' idle ink is deliberately muted because it labels nav chrome, whereas disclosure's
summary is content-bearing prose and reads correctly at full ink already — dimming disclosure's idle
state to gain hover headroom would be a worse, unrequested regression. Per `interaction-states.md`
§103-105's own standard, a collapsed idle≈hover ladder step is a TOKEN-layer fix (a dedicated,
distinct-valued state role + an ADR-0008 amendment), never something a single component should
special-case around. **A token-layer follow-up is needed** — give `--md-sys-color-neutral-on-surface-hover`
its own genuinely distinct value fleet-wide (a `color:token-builder` seat concern) — before this specific
wiring becomes visually real; until then it is correct-but-latent, not broken.

**Gates**: `npm run check` clean · jsdom suite for all four controls: 229/229 · cross-engine browser
suite: 108/108, both Chromium and WebKit · independently reviewed (`ui:component-reviewer`, fresh
context) — CONDITIONAL GO on first pass (one MINOR-BUT-REAL defect: the checkbox ordering bug above),
fixed and re-verified.

### 2026-07-14 (later same day) — finding 2's combo-box leg closed; ticket now DONE

The concurrent session's activity on `combo-box.css` settled (confirmed: no live process, file
unchanged since the earlier check) — Kim explicitly authorized proceeding despite the residual risk.
`combo-box.css` now converges exactly like radio/command-modal: three new `-disabled` suffix tokens
(`--ui-combo-box-border-disabled`/`-bg-disabled`/`-ink-disabled`, muted neutral roles) plus a new
`:where(ui-combo-box[disabled])` repoint block, byte-mirroring `select.css`'s own fully-repointed
`[disabled]` precedent exactly (same 4 properties, same naming). The editor's `opacity: 0.5` disabled
rule is gone. New cross-engine test in `combo-box.browser.test.ts` proves the ink genuinely differs
disabled-vs-idle (a real, distinct token pair — `-on-surface` vs `-on-surface-variant` — unlike
radio's border leg, which needed a corrected test target) and that opacity dimming is gone.

**Independently reviewed (`ui:component-reviewer`, fresh context) — GO**, with one real finding
recorded rather than silently absorbed:

- **The disabled token-repoint is blind to `<fieldset disabled>`/form-disabled inheritance** — every
  control's REAL disabled state is `effectiveDisabled() = disabled || #formDisabled`
  (`dom/form.ts:364-366`), but the CSS `[disabled]` attribute selector only ever matches a control's
  OWN `disabled` prop, never an inherited fieldset/form state. A fieldset-disabled combo-box is
  correctly inert (uneditable, unfocusable, always valid) but paints 100% idle. **Not a regression
  this change introduced** — `select.css:151` has the identical, pre-existing gap; this change
  converges combo-box precisely onto that same ratified precedent. Filed as its own fleet-wide
  follow-up: [TKT-0051](tkt-0051-disabled-token-repoint-blind-to-fieldset-disabled.md).
- **Unadvertised hunk, now recorded**: the same diff also converged the editor's `:focus` outline
  from hardcoded `2px solid`/`2px` offset to `var(--ui-focus-ring-width)`/`var(--ui-focus-ring-offset)`
  (both tokens resolve to `2px` — zero rendering delta), matching `select.css`'s own focus-ring
  wiring. A correct, deliberate convergence, called out explicitly per the review's request rather
  than left as a silent piggyback change.

**Gates**: `npm run check` clean · combo-box jsdom suite 99/99 · combo-box cross-engine browser suite
80/80, both Chromium and WebKit.

### 2026-07-15 — finding 3 (disclosure hover) SUPERSEDED: the ink-step mechanism itself was replaced, not just deferred

The prior entry above closed the ticket with disclosure's hover shipped as an ink-step reading
`--ui-disclosure-ink-hover: var(--md-sys-color-neutral-on-surface-hover)`, framed as "correct-but-
latent" pending a future token-layer value decision. That framing was itself replaced, not just the
value it was waiting on — the ink-step mechanism CANNOT ever work for this consumer, independent of
whatever value `-on-surface-hover` is eventually given: disclosure's idle ink already sits at the
ceiling of the neutral ramp, so there is no headroom above it for a hover-ink value to occupy. This
was reasoned through directly rather than waiting on the token-layer decision, since the mechanism
itself — not the specific colour — was the actual blocker.

**Revised twice, in one pass, both revisions independently reviewed:**

1. First revision — switched to a background-tint wash (`--md-sys-color-neutral-tint-dim`, the
   `combo-box.css` active-descendant precedent) instead of an ink-step. **`ui:component-reviewer`
   caught this was wrong**: the tint ladder was already EVICTED from row-hover fleet-wide by a prior,
   ratified `menu.css` consistency pass (2026-07-07, `menu.css:87-96`) — a 10% tint wash was the
   fleet's ONLY row-hover using it, read as visibly weaker/inconsistent against every other
   interactive-row/control hover (select's option, button — even its ghost variant, the closest
   structural analogue to this summary row — text-field, checkbox, switch, calendar's cell, all of
   which hover to the solid, scheme-inverting `--md-sys-color-neutral-surface-high` role), and was
   converged onto `surface-high` for exactly that reason. `tint-dim` is additionally a
   scheme-INVARIANT ~5% black wash (`tokens.css:1060`) — visibly weaker still than the ALREADY-evicted
   10% figure, and near-invisible over a dark surface, silently resurfacing this exact defect in dark
   scheme.
2. Second revision (this entry) — repointed `--ui-disclosure-bg-hover` to
   `--md-sys-color-neutral-surface-high`, converging disclosure onto the SAME solid row-hover role
   every sibling control already uses, satisfying the ticket's own original Expected clause ("every
   Pattern-class interactive row — tabs/menu/disclosure — paints on hover the same way") for real.
   `disclosure-css.test.ts` updated to assert the `surface-high` role AND explicitly assert the tint
   ladder is NOT used (a negative regression guard against re-introducing the evicted mechanism).
   A stale doc note this same review surfaced — `tokens.css:1052`'s tint-role consumer list still
   naming `menu.css` after its own 2026-07-07 convergence away from that role — corrected in the same
   pass.

**`--ui-disclosure-ink-hover` removal confirmed correct, not just adequate**: the reviewer noted
keeping it as unused belt-and-suspenders would have been actively wrong — a silently-inert consumer
token would start double-repainting (ink AND background) the moment a future token-layer pass ever
gives `-on-surface-hover` a real distinct value, a combination nobody designed for. The shared
`-on-surface-hover` role itself remains real at the token layer for a future consumer that might
actually have ink headroom to use it — it simply has no named consumer in THIS repo anymore.

**Gates**: `npm run check` clean · disclosure jsdom suite 44/44 · disclosure cross-engine browser
suite 24/24, both Chromium and WebKit (including a NEW real hover test proving the background
genuinely repaints — the tint-wash revision's own test only proved the CSS rule fired, not that the
change was perceptible, which is exactly the gap `surface-high`'s solid, scheme-inverting paint
closes for real) · independently reviewed twice (`ui:component-reviewer`, fresh context each time) —
first pass NO-GO on the tint-ladder eviction + a stale-record finding, both fixed and captured here.

**Ticket stays DONE** — this entry supersedes, not reopens, the prior closure: finding 3 is now
genuinely, perceptibly resolved in both colour schemes, not deferred behind an unmade token-layer
decision. [TKT-0051](tkt-0051-disabled-token-repoint-blind-to-fieldset-disabled.md) remains the one
real follow-up this whole ticket spun out.
