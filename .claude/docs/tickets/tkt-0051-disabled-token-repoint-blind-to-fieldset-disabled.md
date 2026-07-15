---
doc-type: ticket
id: tkt-0051
status: open
date: 2026-07-14
owner:
kind: bug
---
# TKT-0051 — the fleet's disabled token-repoint mechanism is blind to `<fieldset disabled>`/form-disabled, across every control that uses `[disabled]`-keyed CSS

## Summary
Surfaced by an independent `ui:component-reviewer` pass on TKT-0047's combo-box.css leg (the
disabled-opacity → token-repoint convergence). Every FACE form control computes its REAL disabled
state as `effectiveDisabled() = disabled || #formDisabled` (`packages/agent-ui/components/src/dom/
form.ts:364-366` — the control's OWN `disabled` prop OR an ancestor `<fieldset disabled>`/
`<form disabled>` state pushed in by `formDisabledCallback`), and every functional/behavioral gate
(pointer-inertness, focusability, validity) correctly reads `effectiveDisabled()`. But the CSS
token-repoint mechanism (the fleet's now-dominant disabled-styling pattern — `:where(ui-X[disabled])`
repointing `--ui-X-border/-bg/-ink` to muted neutral roles) keys ONLY off the host's own `[disabled]`
ATTRIBUTE selector — which never matches a control that is disabled solely because an ANCESTOR
fieldset/form disabled it (the reflected attribute only ever gets set by the control's OWN `disabled`
prop, never by the inherited fieldset/form state).

Net effect: a control inside `<fieldset disabled>` is fully, correctly INERT (uneditable, unfocusable,
always form-valid) but paints 100% IDLE — no visual signal that it can't be interacted with. This is
NOT new with TKT-0047's combo-box fix; `select.css:151` (`:where(ui-select[disabled])`) has the
identical gap already, predating this ticket. TKT-0047's combo-box change CONVERGED it precisely onto
that pre-existing, ratified precedent — this ticket names the shared, fleet-wide gap itself, not a
regression either change introduced.

## Acceptance
Decide and implement ONE mechanism, applied consistently across every control using the
token-repoint disabled pattern (at minimum: button, checkbox, switch, slider, text-field, select,
textarea, radio, command-modal, combo-box):
- Either the `[disabled]` CSS selector becomes `:is([disabled], :disabled)` / a custom-state-based
  selector that also matches the fieldset-inherited case (needs a real mechanism — CSS alone can't
  see JS-computed `effectiveDisabled()`; likely a `:state(...)` custom state each control's own
  `formDisabledCallback` toggles, mirroring how `user-invalid` already works), OR
- A documented, deliberate decision that fieldset/form-disabled styling is explicitly out of scope
  for v1 (name the reason — e.g. "no consumer currently wraps a form control in a disabled fieldset"
  — verified, not assumed).

Either resolution closes this ticket; which one is Kim's call, not pinned here.

## Repro
No fixed repro script. To observe: wrap any token-repoint-disabled control (e.g. `ui-select`,
`ui-combo-box`) in `<fieldset disabled>`, confirm it is genuinely inert (can't be focused/edited,
always form-valid) yet renders with idle (non-muted) border/background/ink.

## Expected vs actual
- **Expected:** a control disabled via an ancestor fieldset/form paints the SAME muted disabled
  styling as one disabled via its own `disabled` prop — the visual and functional disabled states
  should always agree.
- **Actual:** the functional state (inert) and the visual state (idle-painted) disagree whenever
  disablement comes from an ancestor fieldset/form rather than the control's own prop.

## Classification
Axis: **structural** — a CSS-selector/JS-computed-state mismatch, not a one-off bug in any single
control. Plane: `packages/agent-ui/components/src/dom/form.ts:364-366` (`effectiveDisabled()`, the
correct computed source of truth) × every control's own `:where(ui-X[disabled])` CSS block (the
selector that can't see it).

## Severity
**minor** — no functional/accessibility regression (the control IS correctly inert and announced
either way); a purely visual consistency gap, and only reachable via a fieldset/form-disabled
composition no current shipped consumer is confirmed to use.

## Links
- `packages/agent-ui/components/src/dom/form.ts:364-366` (`effectiveDisabled()`)
- `packages/agent-ui/components/src/controls/select/select.css:151` + `select.ts:330` (the
  pre-existing instance of this same gap, the precedent TKT-0047's combo-box fix converged onto)
- `packages/agent-ui/components/src/controls/combo-box/combo-box.css` (the newest instance,
  TKT-0047)
- [TKT-0047](tkt-0047-interaction-state-design-gaps-from-fleet-audit.md) — the ticket whose
  independent review surfaced this

## Scope/Open
Not urgent — every affected control remains functionally correct (inert + form-valid) regardless of
this gap; this is coherence debt (visual state can lie about interactivity), not a defect users are
likely to hit without a fieldset-wrapped form composition, which no current shipped page is
confirmed to use.

## Findings
