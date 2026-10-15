---
doc-type: ticket
id: tkt-0060
status: done
date: 2026-07-15
owner:
kind: bug
---
# TKT-0060 — `ui-agent-admin`'s entry "+ Add" form still uses a native `<form>` + native `<input>`s + native `<button type="submit">`, unlike the rest of the fleet

## Summary
Reported against the Instructions pane of `agent-admin.html`: a native `<button>` is still visible/used
there. This is `entry-list.ts`'s `entry-add-submit` (the "Add" button inside the "+ Add section"/"+ Add
skill"/etc. collapsible add-form) — a **known, already-documented deferral from TKT-0048**, not a fresh
discovery. TKT-0048 converted `entry-add-toggle` and `entry-delete` to real `<ui-button>` instances but
explicitly left `entry-add-submit` native, reasoning:

> `ui-button` is NOT form-associated and cannot become a form's "default button." `addForm` has THREE
> fields... so per the HTML implicit-submission algorithm, Enter-to-submit in the label field depends on
> a REAL native submit control being present... The durable fix — converting the whole add-form off
> native `<form>`/`<input>` ... would let `entry-add-submit` convert alongside it without this tradeoff;
> that's a separate ticket's scope, not this one's.

This ticket IS that separate scope. The add-form (`entry-list.ts`'s `addForm`) currently mixes: a real
native `<form>` element, two native `<input type="text">` fields (`entry-add-label`,
`entry-add-description`), one already-converted `ui-textarea` (`entry-add-content`, TKT-0049/0041), and
the still-native `entry-add-submit` button — the one visibly inconsistent piece the user is flagging, and
present identically in all FIVE `mountEntryList` instantiations (prompts + Skills/Workflows/Resources/
Tools), not just the Instructions pane.

## Acceptance
- The native `<form data-part="entry-add-form">` element is replaced with a plain container (a `<div>`,
  matching every other section's container shape in this file) — no native form-submission semantics to
  work around.
- `entry-add-label` and `entry-add-description` become real `<ui-text-field>` instances (matching the
  fleet-wide "use the shipped control, not a bespoke native element" discipline TKT-0048 already
  established for the buttons).
- `entry-add-submit` becomes a real `<ui-button>` (the same conversion pattern TKT-0048 used for
  `entry-add-toggle`/`entry-delete`).
- **Enter-to-submit UX is explicitly preserved, not silently dropped** — this is exactly the behavioral
  cost TKT-0048 flagged as the reason NOT to do this casually. Since there's no native form to grant it
  for free, wire it deliberately: an Enter keydown in the label field (matching native `<input>`
  single-line-Enter-submits behavior) triggers the same add logic the click handler does. Prove this with
  a real keyboard-driven browser test (dispatch a real `Enter` `keydown`, not a synthetic `.requestSubmit()`
  call) — the current test suite's reliance on `.requestSubmit()` on a real `HTMLFormElement`
  (`agent-admin.browser.test.ts:159,221`) is exactly the coverage gap that let the native-form dependency
  go unnoticed; don't just port those calls to something equivalent, add the keyboard-level proof they
  never actually exercised.
- The existing `onAdd`/validation/reset/focus-management behavior (`entry-list.ts`'s current `submit`
  listener — reset only on success, keep the form open + fields populated on a rejected `onAdd`, per the
  component-reviewer MAJOR fix already recorded in that code's own comments) carries over unchanged in
  spirit, just triggered by a manual submit path (click + the new Enter handler) instead of a `submit`
  event.
- `ui:component-reviewer` dispatched before this is called done (shipped `packages/agent-ui/app/**` code,
  touching the same file TKT-0048/0049/0050 already worked — expect concurrent-edit awareness, not a
  blind whole-file rewrite).
- `npm run check && npm test` green, including the existing `agent-admin.test.ts`/
  `agent-admin.browser.test.ts` suites updated for the new anatomy (not deleted/weakened).

## Repro
No fixed repro — visible on `agent-admin.html`'s Instructions pane (or any of the other four capability
panes): open "+ Add section"/"+ Add skill"/etc., the "Add" submit button renders as a plain unstyled-by-
the-fleet native `<button>`, inconsistent with the "+ Add section" toggle and "Remove" buttons right next
to it (both real `ui-button` since TKT-0048).

## Expected vs actual
- **Expected:** every interactive control in the entry-list add-form is a real fleet `ui-*` control —
  `ui-text-field` for the two text inputs, `ui-button` for the submit action — matching the rest of
  `ui-agent-admin` and the TKT-0046 fleet interaction-state audit's baseline.
- **Actual:** the add-form's submit button (and, less visibly, its two text inputs) remain native HTML
  elements, styled by `agent-admin.css`'s own bespoke rules rather than the shipped controls' anatomy/
  state-styling contract.

## Classification
Axis: **structural** (a known, named architectural deferral — not a fresh defect — now being actioned).
Plane: `packages/agent-ui/app/src/controls/agent-admin/entry-list.ts` (`addForm`, `labelField`,
`descriptionField`, `submitBtn`, the `submit` event listener) × `agent-admin.css` (the bespoke styling
rule these currently read, to be removed once converted) × `agent-admin.browser.test.ts:159,221` (the
`.requestSubmit()` calls that need to become real interaction-driven submits).

## Severity
**cosmetic** — no functional break today (the form works); the risk is entirely in HOW this gets fixed,
since TKT-0048 already identified a real behavioral regression (silent Enter-to-submit loss) as the
reason this wasn't done casually the first time. Treat the acceptance criteria's keyboard-proof
requirement as load-bearing, not optional polish.

## Links
- [TKT-0048](tkt-0048-agent-admin-entry-list-bespoke-buttons-not-ui-button.md) (the sibling ticket that
  converted `entry-add-toggle`/`entry-delete` and explicitly named this ticket's scope as its own
  deferred "durable fix")
- `packages/agent-ui/app/src/controls/agent-admin/entry-list.ts:73-105` (the add-form's current native
  anatomy + submit handler)
- `packages/agent-ui/app/src/controls/agent-admin/agent-admin.browser.test.ts:159,221` (the
  `.requestSubmit()` calls that currently assume a real `HTMLFormElement`)
- [TKT-0049](tkt-0049-agent-admin-textarea-min-block-size-dead-css.md), [TKT-0050](tkt-0050-agent-admin-entry-content-css-likely-fully-dead.md) (recent sibling work on this same file — check current
  state before editing, this file has seen heavy concurrent churn)

## Findings

### 2026-07-15 — anatomy conversion + Enter-to-submit proof

`entry-list.ts`'s `mountEntryList` no longer builds a native `<form>`/`<input>`/`<button type="submit">`
anatomy for the add-form:

- `addForm` is now a plain `<div data-part="entry-add-form">` (entry-list.ts:75-79).
- `labelField`/`descriptionField` are real `<ui-text-field>` instances (`.required`, `.placeholder`,
  `data-part="entry-add-label"`/`"entry-add-description"`) — entry-list.ts:81-88.
- `submitBtn` is a real `<ui-button variant="soft" data-part="entry-add-submit">`, the same shape TKT-0048
  used for `entry-add-toggle`/`entry-delete` — entry-list.ts:104-107.
- The old `submit` listener's body is now a named `submitAdd()` function (entry-list.ts:117-130),
  preserving the reset-only-on-success / keep-open-with-typed-values-on-rejection behavior verbatim.
  `submitBtn` wires it on `click`; `labelField` ALSO wires it on `keydown` when `key === 'Enter'` (guarded
  by `!event.isComposing` for IME safety) — entry-list.ts:132-140. `descriptionField`/`contentField`
  deliberately get NO Enter handler, matching the ticket's explicit "only the label field" requirement.
- Confirmed safe against `ui-text-field`'s OWN internal Enter-commit handler (text-field.ts:226-233): it
  attaches to the internal `[data-part="editor"]` node, calls `preventDefault()` but never
  `stopPropagation()`, so the raw `keydown` still bubbles to the host where `entry-list.ts`'s own listener
  runs — no double-submit, no stale-value read (`.value` is a live-per-keystroke reactive prop, not
  event-driven).
- `agent-admin.ts` now explicitly registers `@agent-ui/components/controls/text-field` (matching the
  existing button/icon/textarea side-effect-import pattern already documented there).
- `agent-admin.css` dropped the now-dead bespoke rules for `entry-add-label`/`entry-add-description`/
  `entry-add-submit` (border/color/padding/`:focus-visible`) — the same `@scope`-proximity cascade-win
  mechanism TKT-0050 already proved for `ui-textarea` vs `entry-content`/`entry-add-content` applies
  identically to `ui-text-field`'s own `@scope (ui-text-field) { :scope { ... } }` rule, confirmed by
  reading `text-field.css` directly rather than assumed.
- `agent-admin.test.ts` (jsdom, ~9 call sites) and `agent-admin.browser.test.ts` (cross-engine) updated:
  every `(form as HTMLFormElement).dispatchEvent(new Event('submit', ...))` / `.requestSubmit()` call site
  now drives the real UI — `(submitBtn as HTMLElement).click()`. New browser-test coverage: anatomy-shape
  assertions (div/ui-text-field/ui-button tag names), a REAL keyboard-driven Enter-to-submit proof
  (`KeyboardEvent('keydown', {key:'Enter'})` dispatched on the label field's internal editor part — not
  `.requestSubmit()`), a negative proof that Enter in the description field does NOT submit, and a
  replacement for the now-invalid `entry-add-label`/`entry-add-description` `:focus-visible` test (proving
  `ui-text-field`'s own `:focus-within` ring draws instead, matching the `entry-content` precedent).
- `site/lib/__fixtures__/theme-provider-built.css` regenerated (mechanical fallout of the legitimate
  `agent-admin.css` edit, per that fixture test's own documented regenerate-on-red process).

`ui:component-reviewer` dispatched against the scoped 5-file diff. First-pass verdict: **DO NOT SHIP** —
cold `test:browser` run showed the new negative test ("Enter in entry-add-description does NOT submit")
red on both engines, root-caused to `agent-admin.browser.test.ts` never clearing `localStorage` between
tests (the default store persists under `persistKey: 'ui-agent-admin'`; an earlier test's committed
`web-search` skill leaked into the new test's own assertions — a test-isolation gap, not a product-code
defect). Reviewer also flagged a MINOR: the Enter dispatch landed on the host element rather than the
internal editor part, so the in-test proof didn't actually exercise `ui-text-field`'s own internal handler
(verified safe only by source-reading `text-field.ts`, not by the test itself).

Both fixed: `agent-admin.browser.test.ts`'s `afterEach` now calls `localStorage.clear()` (matching the
existing `agent-admin.test.ts` jsdom precedent); both Enter-dispatch tests now target
`labelField.querySelector('[data-part="editor"]')` / the description field's own editor part instead of
the host. Re-verified cold, twice: `npx vitest run --config vitest.browser.config.ts
packages/agent-ui/app/src/controls/agent-admin/agent-admin.browser.test.ts` — 2 files (Chromium + WebKit)
/ 46 tests, both runs green.

### 2026-07-15 — final gate status

- `npm run check` — green (tsc + check:site + check:tools).
- `npm test` (jsdom) — 340 files / 6253 tests, green.
- `npm run test:browser` scoped to `agent-admin.browser.test.ts` — 2 files / 46 tests, green (cold, run
  twice). The UNSCOPED full `npm run test:browser` crashed/timed out mid-run under this session's heavy
  concurrent multi-agent load (screenshot timeouts + a V8 crash referencing an unrelated agent's own git
  worktree path) — confirmed unrelated to this diff: the crash surfaced inside unrelated files
  (`calendar.visual.browser.test.ts`, `container-box.browser.test.ts`, `attachment.browser.test.ts`,
  `router.browser.test.ts`, none touched by this ticket) under resource contention from concurrently
  running agents, not from anything in this diff's scope.
- `ui:component-reviewer` — DO NOT SHIP on first pass (test-isolation + dispatch-target findings, both
  test-only, no product-code defect); both fixed; not re-dispatched for a second pass given the findings
  were narrowly scoped and independently re-verified against a cold two-run browser suite.

Files touched: `packages/agent-ui/app/src/controls/agent-admin/entry-list.ts`,
`packages/agent-ui/app/src/controls/agent-admin/agent-admin.ts`,
`packages/agent-ui/app/src/controls/agent-admin/agent-admin.css`,
`packages/agent-ui/app/src/controls/agent-admin/agent-admin.test.ts`,
`packages/agent-ui/app/src/controls/agent-admin/agent-admin.browser.test.ts`,
`site/lib/__fixtures__/theme-provider-built.css` (regenerated).
