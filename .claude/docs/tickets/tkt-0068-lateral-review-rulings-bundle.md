---
doc-type: ticket
id: tkt-0068
status: open
date: 2026-07-15
owner:
kind: feature
size: small
---
# TKT-0068 — rulings bundle from the TKT-0065 lateral review (four canon GAPs needing a decision, not a fix)

## Summary
Four findings where the canon is SILENT and builders diverged — each needs a ruling (Kim, or a proposed
ADR fork), never a reviewer-invented rule. Bundled because each is one decision + a small law-doc/pack
edit, not a build.

1. **Slider release-handle discipline** (construction GAP): `slider.ts:34,46` stores `_releaseDrag`
   with NO `disconnected()`; `slider-multi.ts:337-346` explicitly releases with a "belt-and-suspenders
   … outer listener fires after abort" rationale. Either the edge case is real (slider is missing the
   guard) or overstated (slider-multi's is dead weight). One sibling should change to match the ruling.
2. **Part-level disabled focusability dialect** (traits GAP): tabbable owns only HOST tab
   participation; part-focusable controls hand-roll the part's disabled repoint in two dialects —
   `removeAttribute('tabindex')` (textarea.ts:141, text-field.ts:535, combo-box.ts:309 — native-parity
   unfocusable) vs `tabindex='-1'` (slider-multi.ts:203-205, color-picker.ts:277 — out of tab order but
   programmatically focusable). Behaviorally distinct for programmatic `.focus()`. Ruling: one dialect
   (or a documented split by part kind) + a line in `interaction-states.md` §3.
3. **Radio's stale tabindex correction** (traits DRIFT, needs investigation before deletion):
   `radio.ts:60-76` hand-corrects tabIndex citing "the tabbable trait overrides rovingFocus's -1
   assignments" — a pre-ADR-0121 premise; tabbable now DEFERS under `data-roving` (tabbable.ts:55-58)
   and radio.ts never references the marker. Possibly dead for same-subtree connects, plausibly still
   load-bearing for a late-appended radio. Resolve with the connect-order probe the sweep specified
   (real-engine + jsdom, correction removed), then delete or re-document.
4. **Does §1b govern `ui-command-modal`'s search field?** (styling GAP): the palette search IS a fleet
   entry surface (contenteditable + `data-empty` placeholder, `command-modal.css:26-30,68-93`) still on
   the pre-TKT-0062 role set; `interaction-states.md` §1b enumerates five controls and is silent here.
   Note the search is always-focused while the modal is open, so the five-state table may apply
   degenerately (focus row only + disabled). Ruling: extend §1b's census or ratify the exemption.

## Acceptance
Each item: ruled (with the ruling recorded in the owning law doc or the item's own ADR fork), the
divergent code aligned or its deviation ratified in-file, and the `agent-ui-lateral-review` axis-pack
ledger updated. Item 3 additionally requires the probe's measured result in this ticket's Findings
before any code deletion.

## Links
- [TKT-0065](tkt-0065-lateral-review-campaign-1.md) — construction F3, traits F4/F5, styling F12.

## Findings

### 2026-07-15 — item 3 RESOLVED by the specified probe: the correction is load-bearing, keep it

The mutation probe ran exactly as specified: correction disabled → all 205 existing radio-family
tests (129 jsdom + 76 browser, Chromium+WebKit) still pass — proving the existing surface never
exercised it — but the LATE-APPENDED case fails: a radio appended to an already-connected group
keeps the tabbable trait's `tabIndex=0` (rovingFocus's `applyTabindexes` ran at group connect,
before the late radio existed, so it was never stamped `data-roving` and tabbable's deferral never
engages) — the group grows a second tab stop. So the comment's premise is PARTLY stale (the
same-subtree connect-order half is covered by the ADR-0121 `data-roving` deferral) but the code is
correct and needed for late appends, which had ZERO coverage.

**Landed:** the correction stays; a new pinning test
(`radio-group.test.ts` · `group-tabindex-late-append`) covers the load-bearing case and was
mutation-verified (fails with the correction disabled, 89/89 with it live). No ruling needed —
item 3 leaves the bundle; items 1, 2, and 4 remain Kim's.

### 2026-07-15 (later) — items 1, 2, 4 RULED by Kim (one AskUserQuestion round) and executed — CLOSED

**Item 1 — belt-and-suspenders is the ruled shape; slider changed.** `slider.ts` gained a
`disconnected()` that explicitly releases its valueDrag binding (idempotent, then re-null), matching
`slider-multi.ts`'s shape verbatim. The two range siblings are now symmetric.

**Item 2 — `removeAttribute('tabindex')` is the fleet dialect** (native parity: a disabled part is
not even programmatically focusable; coheres with TKT-0057's accept-the-blur ruling).
`slider-multi.ts` (both thumbs) + `color-picker.ts` (the pad) converted; the two tests pinning the
old `'-1'` dialect updated to `hasAttribute === false`. The law landed as a §3 note in
`interaction-states.md`.

**Item 4 — §1b's census EXTENDED: command-modal's search is the degenerate sixth member.** The
palette search now wears §1b's FOCUS row permanently (always-focused surface): `container-low` bg ·
`transparent` border (the 1px border-block-end stays for layout; the field/panel bg contrast now
carries the search/list separation the old solid divider drew) · `on-surface` ink · placeholder =
the standard ink alias. The suppressed ring stays (ratified — a ring on an always-focused surface is
noise). The law landed as the §1b degenerate-member note in `interaction-states.md`; the census line
names it.

**Ledger:** all three rulings + item 3's measurement recorded in the `agent-ui-lateral-review`
styling/traits packs.

**Gates:** `npm run check` green · slider/slider-multi/color-picker jsdom 151/151 · command-modal
60/60 · touched-set browser 338/338 both engines · full jsdom sweep green.
