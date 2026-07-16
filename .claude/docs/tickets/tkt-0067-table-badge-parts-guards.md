---
doc-type: ticket
id: tkt-0067
status: done
date: 2026-07-15
owner:
kind: bug
---
# TKT-0067 — `ui-table`/`ui-badge` rebuild their parts on every connect (the idempotent-guard canon outliers)

## Summary
The construction axis of the TKT-0065 lateral review found the fleet's only two violations of the
parts-created-once canon (both `file:line`-verified):

- **`ui-table`** (`table.ts:63-72`): fresh `#scroll/#table/#thead/#tbody` minted + `replaceChildren`
  unconditionally in `connected()`. The file's own SPEC-R4.1 "identity clause" comment protects node
  identity WITHIN a connection, but a reconnect discards everything — including, per the sweep's
  `[NEEDS PROBE]`, the scroll offset the comment claims "survives by omission". Fix: the `progress.ts:44`
  field-guard shape (`if (!this.#track)`).
- **`ui-badge`** (`badge.ts:52-60`): glyph/label created as LOCALS + `replaceChildren`'d every connect,
  despite the "One-time DOM build (LLD-C7) … neither node is ever replaced" comment — true within a
  connection, false across reconnect. Behavior converges (the label effect re-stamps), so this is
  lower-severity, but the comment misdescribes the code and the shape is the outlier.

NOT covered by the display-leaf whole-swap ledger entry (attachment/avatar/bar-chart/… rebuild inside
the RENDER EFFECT per their SPECs' whole-array-swap clauses): table/badge INTEND persistent parts and
merely lack the guard.

## Acceptance
- Both gain the idempotent field guard; the misleading badge comment repaired in the same change.
- A reconnect browser probe for `ui-table` proving the fix's user-visible half: scroll a wide table,
  detach + reattach, `scrollLeft` (and the built skeleton's node identity) survive — the exact
  `[NEEDS PROBE]` claim the sweep filed, resolved by measurement rather than assumption.
- Reconnect-behavior tests for both (the conversation-composer reconnect-test precedent).
- `npm run check && npm test` + scoped browser gates green; independent review (shipped-control
  behavior change).

## Links
- [TKT-0065](tkt-0065-lateral-review-campaign-1.md) — construction axis findings F1/F2.
- `packages/agent-ui/components/src/controls/progress/progress.ts:44` — the guard shape to copy.

## Findings

### 2026-07-15 — both guards landed; the probe FALSIFIED "survives by omission" across reconnect — CLOSED

**The measured discovery (the sweep's `[NEEDS PROBE]`, resolved):** node identity alone does NOT
preserve scroll across a disconnect/reconnect. Both Chromium AND WebKit reset a scroll container's
offsets when it leaves the document even when the identical node is reattached — scroll state lives
in the LAYOUT tree, not the DOM node. The probe measured 40 → 0 in both engines with the guard alone.
And reading `scrollLeft` in `disconnected()` is too late (the element is already out of the document;
it reads 0 there). So the fix has two halves:

- **`table.ts`** — the `#built` idempotent guard around the skeleton build (the progress.ts field-guard
  shape, via a boolean since `#scroll!` is definite-assignment typed), PLUS a live scroll-offset shadow:
  `#lastScrollLeft/#lastScrollTop` captured by a `this.listen(#scroll, 'scroll', …)` listener (re-armed
  per connect on the connection AbortSignal, per the fleet idiom) and restored synchronously in
  `connected()`. The BODY effect's "survives by omission" comment trued: by omission across DATA
  updates; across RECONNECT restored from the shadow.
- **`badge.ts`** — the `#label` field guard around the glyph/label build; the misleading "never
  replaced" comment repaired.

**Tests:** `table.browser.test.ts` gained the reconnect probe (scroll to 40 → double-rAF so the async
scroll event captures BEFORE detach → remove+append → same node AND `scrollLeft === 40`; anti-vacuous
overflow guards included) — it catches BOTH regression halves independently. `table.test.ts` gained
the jsdom node-identity reconnect test; `badge.test.ts`'s shape-only reconnect test tightened to node
identity.

**Gates:** `npm run check` green · full jsdom 340 files / 6273 green · table+badge browser 68/68 in
Chromium + WebKit.

**Independent review:** clear-to-merge, zero blocking findings; four informational notes, one worth
the ledger: the parts-once canon (progress.ts's own shape included) does not self-heal if a host's
children are externally evicted (`#built` stays true, effects write into detached nodes) — the OLD
rebuild-every-connect code self-healed by accident. Out-of-contract under the light-DOM
component-owned-children law; if the fleet ever wants self-healing (`|| #scroll.parentNode !== this`)
that is a fleet-wide canon fork, not a table/badge patch.
