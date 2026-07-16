---
doc-type: ticket
id: tkt-0062
status: done
date: 2026-07-15
owner:
kind: feature
size: big
---
# TKT-0062 — the entry-control fleet adopts a filled/container state law (bg + border + text-ink)

## Summary
Kim's ruling, verbatim: every entry control (`ui-text-field`, `ui-select`, `ui-textarea`, `ui-combo-box` —
"inputs, selects, textareas, etc") replaces its current ADR-0014 bordered-frame state law (idle/hover/
focus border-color steps only, bg/ink otherwise static) with a filled/container-background law that
repoints THREE channels (background, border, text-ink) across FIVE states:

| State | Background | Border | Text ink |
|---|---|---|---|
| default (empty, idle) | `--md-sys-color-neutral-container-low` | `transparent` | `--md-sys-color-neutral` |
| filled (has a value, idle) | `--md-sys-color-neutral-container` | `transparent` | `--md-sys-color-neutral-on-surface-variant` |
| hover | `--md-sys-color-neutral-container` | `--md-sys-color-neutral-outline-variant` | `--md-sys-color-neutral-on-surface-variant` |
| focus | `--md-sys-color-neutral-container-low` | `transparent` (the shared outline ring is the indicator) | `--md-sys-color-neutral-on-surface` |
| disabled | `--md-sys-color-neutral-container-low` | `transparent` | `--md-sys-color-neutral-low` |

Precedence when states co-occur (not specified verbatim by Kim; derived from the table — filled and
hover already agree on bg/ink, differing only on border, so the only real ordering call is disabled/focus
over hover/filled): **disabled > focus > hover > filled > default**. `user-invalid` (the danger border)
is UNCHANGED — orthogonal to this table, applies on top of whichever bg/ink the table above already
picked, exactly as today.

This SUPERSEDES the ADR-0014 cl.2c field-frame map (bg=static surface, border=the only per-state
channel) for every control it touches — a genuine, ratified (by Kim directly, not self-ratified)
contract change to a previously-shipped, independently-reviewed pattern used by 4+ components.

## Acceptance
- `ui-text-field`, `ui-textarea`, `ui-select`, `ui-combo-box`, and `ui-conversation-composer` (already
  mid-iteration on an earlier, narrower slice of this same law) all repoint their own
  `--ui-{name}-{bg,border,ink}[-hover|-focus]` token chain to the table above, keyed off a NEW "filled"
  signal (has-a-value vs empty/placeholder) alongside the existing hover/focus/disabled hooks.
- **`ui-select` needs a NEW filled-detection wire** (`select.ts`): unlike text-field/textarea/combo-box
  (which already toggle `[data-empty]` on their editor part), select currently writes plain text into
  `[data-part='label']` with no CSS hook distinguishing "showing the placeholder" from "showing a real
  selection" — add the same `[data-empty]`-shaped toggle (on the trigger or label span) so the new law's
  CSS can key off it identically to its siblings.
- `user-invalid`/disabled precedent (role-repoint, not opacity — tokens.md canon) is preserved; the
  danger border tokens are untouched.
- Every structural CSS pin-test that hardcodes the OLD token literals (`text-field-css.test.ts` is the
  known one; audit textarea/select/combo-box for siblings) is rewritten to assert the NEW law, not
  deleted or loosened.
- `npm run check && npm test` green; the scoped browser gate (each touched control's own
  `*.browser.test.ts`) green in Chromium + WebKit; `npm run size` within budget; the theme-provider
  built-CSS fixture regenerated; independent review before done.

## Links
- `packages/agent-ui/components/src/controls/text-field/text-field.css` (+ `text-field-css.test.ts`,
  `text-field-states.browser.test.ts`)
- `packages/agent-ui/components/src/controls/textarea/textarea.css` (+ its own test siblings)
- `packages/agent-ui/components/src/controls/select/select.css` + `select.ts` (+ its own test siblings)
- `packages/agent-ui/components/src/controls/combo-box/combo-box.css` (+ its own test siblings)
- `packages/agent-ui/app/src/controls/conversation/conversation-composer.css` — already carries a
  partial slice of this law from this session's earlier iterative color-token turns (border→
  outline-variant on hover already lands; the ink/bg ladder needs completing to the full 5-state table).

## Scope/Open
- No new ADR minted — Kim directly specified the exact role table (this ticket + each component's own
  Findings entry is the ratification record, matching this session's established "Kim's ruling" pattern
  for direct, unambiguous design instructions; per the operating contract an ADR is earned by a
  contract-changing FORK needing a recommendation to weigh, not a decision already made).
- `[disabled]`'s existing role-repoint precedent (bg→surface-high, ink→on-surface-variant, border→
  outline-variant) is REPLACED by this table's disabled row (bg→container-low, border→transparent,
  ink→neutral-low) — a genuine value change on an existing, tested state, not additive.

## Findings

### 2026-07-15 — built across five components (one hand-built reference, two parallel agent builds, two hand-built), independently reviewed, fixed, gates green — CLOSED

Kim's exact table applied to `ui-text-field` (hand-built as the reference implementation), `ui-textarea`
and `ui-combo-box` (each built by a separately dispatched agent following the proven text-field pattern),
and `ui-select`/`ui-conversation-composer` (hand-built). `ui-select` needed a new `[data-empty]` toggle
added to `select.ts`'s existing trigger-label effect — select had no prior emptiness signal, unlike its
siblings, since it always wrote SOME text (selection or placeholder) into the label span.

**A load-bearing CSS-precedence lesson, discovered building the reference and propagated to every
component**: the naive approach (bare `:hover`/`:focus-within` pseudo-classes relying on source-order, the
old law's convention) breaks once a "filled" state needs a content-based selector (`:has()`/`:not()`) —
those combinators carry REAL specificity in a plain selector, and a `:not(:is(disabled))`-guarded `:hover`
was MEASURED to outrank an unguarded `:focus-within`, so a mouse-click focus (which also leaves the
pointer hovering) kept the visible hover border instead of stepping transparent. Fixed fleet-wide via
MUTUAL EXCLUSION (`:not()` on every state selector, never source-order/specificity) — verified with new
real-browser tests proving `focus` wins over `filled` even when both conditions are literally true.

**Independent review** (fresh-context code-reviewer, checking all five components for both correctness and
cross-author consistency): 🟡 fix-first — one HIGH, two MEDIUM, two LOW.

- **HIGH (fixed)**: the state rules repainted `color` on the HOST frame, but each component's editor part
  carries its own `color: var(--ui-*-ink)` declaration reading the BASE token directly — an element's own
  declared `color` always wins over an inherited value, so a host-only `color:` override never reached the
  visible typed text or the placeholder in `ui-text-field`, `ui-textarea`, or `ui-conversation-composer`.
  Proven red in a real Chromium+WebKit probe (filled/focus states painted the host correctly while the
  editor stayed at the empty/default ink). `ui-combo-box` was unaffected only because its editor IS the
  frame (no child to diverge from). **Fixed** by repointing the underlying `--ui-*-ink` CUSTOM PROPERTY in
  each state rule (`--ui-text-field-ink: var(--ui-text-field-ink-filled)`, etc.) instead of a direct `color:`
  declaration — the property then cascades to every real consumer (the base rule, the editor, and the
  placeholder's alias) for free, mirroring how the disabled `:where()` block already did it correctly. The
  browser tests' own ink assertions were ALSO vacuous (reading the host's color, which DID change even
  under the bug) — corrected to read the editor's own computed color in all three affected components' test
  files, proving the user-visible fix, not just the host repaint.
- **MEDIUM 1 (filed, not fixed)**: `ui-select`/`ui-combo-box`'s disabled-row CSS never keys off FORM-disabled
  (only their own `[disabled]` attribute) — a genuinely pre-existing mechanism gap (not introduced by this
  ticket's color-law change, just made more visible by it). Filed as
  [TKT-0063](tkt-0063-select-combo-box-form-disabled-css-gap.md) — deliberately out of this ticket's scope
  (a real TS behavior change to two shared, already-shipped controls, orthogonal to a scoped color redesign).
- **MEDIUM 2 (ratified)**: `ui-select`'s focus row triggers on keyboard-only `:focus-visible`, while the
  other four use all-focus (`:focus-within`/`:focus`/`:has(editor:focus)`). This is a PRE-EXISTING decision
  (inherited from `select.css`'s own border-only law before this ticket, matching the button-precedent
  convention for action controls vs. text-entry controls) — TKT-0062 did not introduce or reconsider it.
  Ratified here rather than changed: a select trigger is a real `<button>`-shaped action control, not a
  text-entry surface, so the keyboard-only ring matches the fleet's own existing action-vs-entry-control
  focus convention rather than being an accidental fork.
- **LOW (fixed)**: stale header/doc prose in `text-field.css`, `select.css`, and `text-field.md` still
  described the old border-only channel and the old disabled row. Rewritten to the TKT-0062 table in this
  same change (stale context = a defect, per the operating contract).
- **LOW (recorded, not fixed)**: `ui-combo-box` carries no `:state(ready)` motion-transition block, unlike
  the other four — a pre-existing absence (unrelated to this ticket), now more perceptible since bg
  repaints are a fleet-visible interaction under the new law. Left as a known, deliberately-deferred gap;
  fixing it needs a new TS `:state(ready)` wire in `combo-box.ts`, out of this ticket's CSS-only scope.

**Gates at close** (all re-run after every fix, including a second pass after the LOW doc fixes touched two
derived-corpus fixtures): `npm run check` green · full jsdom 340 files / 6263 tests green (four apparent
failures on the first full run — `a2a-tic-tac-toe`×2/`a2ui-chat`/`a2ui-live.ask-lifecycle`/`gallery` — were
all confirmed transient hook-timeout flakes from environment load, not real regressions: each passed
individually with a longer hook timeout, and none were assertion failures) · scoped browser gate (all 5
components + their consumers: agent-admin, a2ui-chat) 16 files / 334 tests green, Chromium + WebKit ·
`npm run size` — text-field/textarea/select/combo-box all within budget, `@agent-ui/app` (includes
conversation-composer) 64985/69632 B gz · `llms-full.txt` and the theme-provider built-CSS fixture both
regenerated (the doc-prose LOW fixes changed derived-corpus source text).