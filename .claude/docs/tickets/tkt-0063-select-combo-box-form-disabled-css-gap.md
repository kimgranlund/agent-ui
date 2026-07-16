---
doc-type: ticket
id: tkt-0063
status: done
date: 2026-07-15
owner:
kind: bug
---
# TKT-0063 — `ui-select`/`ui-combo-box`'s disabled CSS row never keys off FORM-disabled, only their own `[disabled]` attribute

## Summary
Surfaced during TKT-0062's independent review (the entry-control filled/container state law).
`ui-text-field`/`ui-textarea` key their disabled-row CSS off `:is([disabled], :state(disabled))` — the
effective-disabled channel (own attribute OR a form/fieldset-provider disabling it), with `:state(disabled)`
set explicitly in `text-field.ts` (line ~538) whenever `effectiveDisabled()` is true. `ui-select` and
`ui-combo-box` never do this: their disabled-row `:where()` blocks key off the host's own `[disabled]`
attribute ONLY (`select.css:159` `:where(ui-select[disabled])`, `combo-box.css` similarly), while their own
`.ts` files already compute `effectiveDisabled()` (own || form-disabled) and push it onto a DIFFERENT
element — `select.ts:335` sets `trigger.setAttribute('disabled', ...)` (the trigger, not the host, and not
a custom state), `combo-box.ts:304`-ish sets `aria-disabled` on the editor. Neither ever reaches a
host-level `:state(disabled)` or an equivalent CSS-visible signal on the SAME element the `:where()`
disabled block matches.

**Net effect**: a select/combo-box disabled ONLY via a form/fieldset provider (never its own `disabled`
attribute) paints the DEFAULT row (bg=container-low, ink=neutral — visually indistinguishable from an
enabled, empty control) instead of the disabled row (ink=neutral-low) — the control LOOKS enabled while
it functionally is not.

This is a PRE-EXISTING gap (the mechanism divergence predates TKT-0062 — select/combo-box's border-only
law had the exact same "form-disabled paints nothing different" hole before this ticket, just less
visible since the old law's disabled repoint was smaller/subtler). TKT-0062 did not introduce it; it only
made the divergence between the two mechanism families (text-field/textarea vs select/combo-box) more
apparent by giving disabled a real, larger visual delta worth getting right everywhere.

## Acceptance
- `select.ts`/`combo-box.ts` each add `internals.states.add('disabled')` / `.delete('disabled')` inside
  their own `effectiveDisabled()`-driven effect (mirroring `text-field.ts`'s existing precedent exactly).
- `select.css`'s `:where(ui-select[disabled])` and `combo-box.css`'s `:where(ui-combo-box[disabled])`
  blocks widen to `:is([disabled], :state(disabled))`, matching text-field/textarea.
- A real browser test proves a FORM/fieldset-disabled select/combo-box (never its own `[disabled]`
  attribute set) paints the disabled row — the exact scenario this ticket's Summary describes, driven
  end-to-end (a real `<fieldset disabled>` or `ui-form-provider`-disabled ancestor), not just the
  existing own-`[disabled]` browser tests re-asserted.
- `npm run check && npm test` green; the scoped browser gate for select/combo-box green in Chromium +
  WebKit; independent review before done.

## Links
- [TKT-0062](tkt-0062-entry-control-filled-state-law.md) — the ticket whose independent review surfaced
  this (MEDIUM finding, filed rather than fixed inline — a genuinely pre-existing, orthogonal gap, not a
  regression this ticket's own color-law change introduced).
- `packages/agent-ui/components/src/controls/text-field/text-field.ts:538` — the `:state(disabled)` wire
  precedent to mirror.
- `packages/agent-ui/components/src/controls/select/select.ts:335`, `select.css:159`
- `packages/agent-ui/components/src/controls/combo-box/combo-box.ts` (the `aria-disabled` effect),
  `combo-box.css`

## Scope/Open
- Deliberately NOT fixed as part of TKT-0062: a real TS behavior change (adding a new `internals.states`
  wire) to two shared, independently-reviewed, already-shipped controls, orthogonal to that ticket's own
  scoped color-law change — the same "don't scope-creep a color redesign into an unrelated form-
  participation fix" discipline this session has held elsewhere.

## Findings

### 2026-07-15 — fixed in the TKT-0062 follow-up batch — CLOSED (write-back restored 2026-07-16)

Both controls now key their disabled-row CSS off the effective-disabled channel, exactly the
text-field precedent: `select.css:163` / `combo-box.css:141` widened to
`:where(ui-{cmp}:is([disabled], :state(disabled)))`, and each `.ts` `effectiveDisabled()` effect now
also sets/deletes the host-level `:state(disabled)` (`select.ts:340-343`, `combo-box.ts:310-315`) —
so a select/combo-box disabled ONLY via a form/fieldset provider repaints the disabled row instead of
silently keeping the enabled look. Covered by the TKT-0063-labelled tests in `select.test.ts:1056`
(the form-disabled channel, jsdom) + the `:state(disabled)` browser legs (CustomStateSet is
jsdom-invisible), and the combo-box effective-disabled block (`combo-box.test.ts:1352`). Shipped in
the arc's PR #9; this entry restores the Findings write-back that was lost when the batch closed
(the code + tests carried the ticket citation throughout — the record lagged the tree, repaired on
the TKT-0069 close-out sweep).

