---
doc-type: ticket
id: tkt-0041
status: done
date: 2026-07-14
owner:
kind: feature
size: small
---
# TKT-0041 — ui-agent-admin's prompts pane uses a native `<textarea>`, no ratified exception

## Summary
`ui-agent-admin` (TKT-0039, ADR-0131) renders its prompts pane as a plain native `<textarea>` +
`<label>` — the fleet's own law (CLAUDE.md: "no native form elements"; every other editable surface
rides `ui-text-field`'s contenteditable model, ADR-0044) has no exception for it. ADR-0131 never
ruled a fork on the vehicle because none was surfaced at intake — no shipped FACE control renders
long-form multi-line text, and the gap was found mid-build (an independent `component-reviewer`
pass, MAJOR finding), not mid-intake. Recorded in ADR-0131's own "Build-time note" section as a
flagged, unratified deviation — this ticket is that note's tracked follow-up, so it doesn't stay a
prose-only flag with no owner.

## Acceptance
Exactly one of:
- **A ruled exception.** A design intake explicitly rules that `ui-agent-admin`'s prompts pane may
  use a native `<textarea>` (a stated reason — e.g. multiline text has no fleet equivalent and one
  isn't worth building for a single call site), ratified the same way any other fork is (never
  self-ratified).
- **A multiline FACE editor.** A new fleet primitive (or a `ui-text-field` mode) renders long-form
  multi-line text on the contenteditable model, and `ui-agent-admin`'s prompts pane migrates to it,
  closing the gap for any future consumer too.

Either resolution closes this ticket; which one is Kim's call, not pinned here.

## Links
- [ADR-0131](../adr/0131-agent-admin-ui-scope-and-composition.md) — "Build-time note" section (the
  original finding + framing)
- [ADR-0132](../adr/0132-agent-admin-instructions-capabilities-architecture.md) *(proposed)* — the
  instructions/capabilities architecture that INHERITS this question, unresolved, now applying to N
  section/entry editors instead of one field (does not close this ticket)
- [TKT-0039](tkt-0039-agent-admin-ui.md) — the build this deviation shipped in
- `packages/agent-ui/app/src/controls/agent-admin/agent-admin.ts` (the `<textarea>`/`<label>` in
  `#compose()`) · `agent-admin.md` (the descriptor's own honest disclosure)

## Scope/Open
- Not urgent — `ui-agent-admin` ships and works with the native textarea; this is a coherence debt
  (one element diverges from the fleet's own law), not a functional defect.
- If (A) is ruled, `agent-authoring-standards`-equivalent-for-this-repo (`naming.md`/CLAUDE.md)
  should record the exception the same way any other named deviation is recorded, so a future
  fleet-wide native-element sweep doesn't re-flag it as unreviewed.
- **2026-07-14 — scope widened, not resolved:** ADR-0132 generalizes the prompts pane into N
  independently-editable sections (Foundation/Personality/Critical Items + any future custom
  section) — the SAME multiline-editing-vehicle question this ticket tracks now applies per-entry
  across that whole list, not just to one field. Whichever resolution lands here (a ruled exception
  or a new FACE editor) should cover the generic list's per-entry editor, not be re-litigated once
  more when ADR-0132 builds.

## Findings

**2026-07-14 — closed via acceptance path B (a multiline FACE editor).** A new fleet primitive
`ui-textarea` (`packages/agent-ui/components/src/controls/textarea/`) ships per
[ADR-0134](../adr/0134-multiline-textarea-face-editor.md) — a sibling of `ui-text-field`, NOT a
mode on it, reusing the ADR-0014 contenteditable pattern with its own multi-line geometry law
(`rows`-driven growable `min-block-size`, Enter inserts a newline instead of committing, no
`type`/codec machinery). `ui-agent-admin`'s `entry-list.ts` (both the per-entry editor and the
add-form's content field — now covering all five ADR-0132 entry-list instantiations, not just the
original single field) migrated onto it; `agent-admin.md`'s honest-disclosure caveat is retired.

Independently reviewed (`ui:component-reviewer`, fresh context) — verdict GO, with two MINOR
findings, both fixed before closing: (1) `textarea.css`'s header comment claimed `align-items:
start` where the shipped code actually uses plain block flow with no `align-items` rule
(equivalent visual result, simpler; comment corrected to match); (2) `entry-list.ts`'s
uncommitted-edit restore path called `ui-textarea`'s new `selectToEnd()` seam synchronously,
racing the async model→surface render effect — the editor could still be empty when the caret
range collapsed, landing the caret at position 0 instead of the end (focus itself still landed
correctly, confirmed by the cross-engine suite; only caret position was at risk). Fixed by
awaiting `updateComplete` before calling `selectToEnd()`, with the corresponding browser test
updated to await the same flush before asserting `:focus-within`.

Gates: `npm run check` clean · full jsdom suite 331/332 files green (the one failure,
`theme-provider-build-fixture.test.ts`, is a pre-existing CSS-build-fixture staleness issue
unrelated to this change — confirmed failing identically against an unmodified base) · scoped
cross-engine browser suite (`textarea` + `agent-admin` + `text-field`) 38/38 (post-fix) · `npm run
size` — `textarea` marginal 955 B gz (2048 B budget), `ui-*` family 43330 B gz (45056 B budget),
both within budget.

ADR-0134 sits at `Status: proposed` in-file (a hook-level guard blocks any agent from
self-flipping an ADR to `accepted`, even given an explicit in-conversation confirmation) despite
being explicitly authorized/ratified by Kim in conversation — flipping that field is Kim's own
edit to make.
