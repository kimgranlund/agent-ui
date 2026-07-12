---
doc-type: ticket
id: tkt-0021
status: open
date: 2026-07-11
owner:
kind: feature
size: small
---
# TKT-0021 — ui-settings wires store.subscribe: external writes reflect into live controls

## Summary
Kim's goal directive (2026-07-11): complete the ui-settings external-sync leg. The `SettingsStore`
interface already carries the F7-resolved optional `subscribe` (store.ts:34 — "changes from
OUTSIDE ui-settings (another tab, a remote push)"), but `ui-settings` never wires it: an external
`store.set` today does not reflect into a rendered control. The M4 Phase 3 review recorded TWO
seams the build inherits: (1) the unwired subscribe itself; (2) the setValue-after-connect codec
wall (schema.test.ts:127 documents that a programmatic setValue doesn't reach a text-field
codec's canonical without a real blur).

## Acceptance
- With a store exposing `subscribe`, an external `set(key, value)` reflects into the rendered
  control for every registry field type (text/number/date via the codec seam, boolean→switch,
  select, slider) — including the codec-wall types (the fix must land wherever the wall really
  is: the RegisteredControl bridge or the control's own value seam; root cause, not a blur hack).
- NO echo loop: an external set reflecting into a control MUST NOT re-emit as a user commit back
  into `store.set` (assert exactly zero store writes per external set); a USER edit still
  commits exactly once (unchanged).
- Stores WITHOUT subscribe: behavior byte-identical (the optional seam stays optional).
- The subscription honors the reconnect law (the M4 relocation class): unsubscribed on
  disconnect, re-subscribed on reconnect (a leak test across repeated relocations).
- The memory-store reference adapter implements subscribe (it's the test vehicle).
- Descriptor/docs truthful; the m4 SPEC/LLD gain REV rows annotated as REALIZING ADR-0120 F7's
  already-accepted optional-subscribe arm (not a contract change — no new ADR unless a genuine
  fork emerges).
- Cross-engine legs for at least the codec-wall type + switch; existing 151 app jsdom + browser
  suites untouched-green.

## Links
- `packages/agent-ui/app/src/controls/settings/{store.ts,memory-store.ts,settings.ts,generate.ts,schema.test.ts}`.
- `.claude/docs/lld/app-surfaces-m4.lld.md` §4 + `spec/app-surfaces-m4.spec.md` (REV rows land
  here) · ADR-0120 F7 (accepted — the authority).
- The M4 Phase 3 review record (the two seams) — `.claude/docs/tickets/`/CHANGELOG 2026-07-11.

## Scope / Open
- The echo-suppression mechanism (a reflecting-write guard vs value-equality cutoff) — builder
  decides from the kernel's Object.is precedent, flags if contested.
- **Non-goals:** async/remote store transport (PRD fence); batched conflict resolution.

## Findings
