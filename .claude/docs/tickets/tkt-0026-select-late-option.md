---
doc-type: ticket
id: tkt-0026
status: open
date: 2026-07-12
owner:
kind: bug
---
# TKT-0026 — ui-select never adopts an Option added after first connect

## Summary
Discovered during tkt-0024's intake (verified against `select.ts:470-503`): ui-select moves its
Option/group children into the listbox panel ONLY at first connect (a one-time idempotent guard)
— a later-added Option mounts as a light-DOM child but stays OUTSIDE the panel, invisible and
unselectable. This is why ADR-0053's first-connect limit is RETAINED by ADR-0128 rather than
lifted: even with the renderer's structural-resend reconciliation landed, a late catalog `Option`
would reach the DOM correctly and still not appear — the residual defect is ui-select's own.

## Acceptance
- An Option (or option group) appended to a connected ui-select is adopted into the panel and
  becomes selectable (the dynamic-options mechanism — likely the MutationObserver child-list
  precedent ui-split uses), for BOTH direct-DOM consumers and the A2UI catalog path.
- The select.md dynamic-options note and ADR-0053's teaching update to the new truth in the same
  change (the a2ui-compose "ship together" trap relaxes only when this is REAL end-to-end).
- Selection/active state survives an adoption; no double-move on reconnect (the relocation law);
  cross-engine legs.

## Repro
Connect a ui-select; `select.append(option)` — the option node exists in light DOM, never appears
in the panel.

## Expected vs actual
- **Expected:** late options adopt into the panel like first-connect ones.
- **Actual:** one-time child-move at first connect; later children ignored.

## Classification
Axis: **functional (dynamic content adoption)** — plane `controls/select/` (+ combo-box shares
the listbox lineage — verify at fix). Consumers: direct DOM, the catalog Select row, ADR-0053's
teaching.

## Severity
**minor** — today's producers obey the ship-together rule, so no shipped surface hits it; it
becomes MAJOR the moment ADR-0128's reconciliation teaches producers that late structure works.

## Links
- `packages/agent-ui/components/src/controls/select/select.ts:470-503` · ADR-0053 · ADR-0128
  (retains 0053 because of exactly this) · `.claude/docs/tickets/tkt-0024-renderer-structural-resend.md`
  (the discovering intake) · the ui-split MutationObserver precedent (dynamic panes).

## Findings
