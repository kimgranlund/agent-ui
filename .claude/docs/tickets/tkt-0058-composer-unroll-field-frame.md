---
doc-type: ticket
id: tkt-0058
status: done
date: 2026-07-15
owner:
kind: feature
size: big
---
# TKT-0058 — `ui-conversation-composer` v2: unroll the nested `ui-text-field`; the composer IS the field

## Summary
Kim's redesign directive, verbatim intent: the composer currently composes a `ui-text-field` child; that
should be unrolled — the composer itself becomes "a type of advanced ui-text-field (or textarea)": ONE
field frame whose content is a tags (context-chips) row ABOVE the text, the editable multi-line text
itself, and a menus + icon-buttons row BELOW the text. Clicking the component area (but NOT its tags,
menus, or buttons) focuses the text; the focus ring renders on `ui-conversation-composer` itself. States
and text formatting are the same as text-input (but multi-line), and the text region auto-expands with
large inputs up to a `max-height` of `6em`.

## Acceptance
- `ui-conversation-composer` no longer creates a `ui-text-field` child. It owns a
  `[data-part="editor"]` contenteditable region directly — the ADR-0014 pattern reused via its
  multi-line sibling `ui-textarea` (ADR-0134): `contenteditable="plaintext-only"`,
  `role="textbox"`/`aria-multiline="true"` on the PART (never the host), surface→model on `input`
  (IME-composition-guarded), model→surface under the CARET GUARD, `data-empty` +
  `attr(data-placeholder)` placeholder.
- The vestigial nested `<form data-part="composer">` is removed (its only job — Enter-submit plumbing —
  was already handled by this element's own listeners; the ADR-0017 carve-out dependency disappears
  entirely). The HOST is the field frame and the flex column: chips row → editor → options row.
- New public `value` string prop (property-only, `attribute: false` — this element is never
  author-composed, so there is no markup value to seed). `#send()` reads/clears it; the existing
  busy-guard-first ordering (TKT-0056 F2) is unchanged.
- Keyboard: **Enter sends** (preventDefault; suppressed during IME composition via `isComposing`);
  **Shift+Enter inserts a newline** — the multi-line chat-composer convention (the old single-line field
  submitted on every Enter; multi-line needs the split).
- Focus: clicking the host's own area (padding, chips-row background, options-row background) focuses the
  editor; clicks on `ui-button`/`ui-menu`/a context chip do NOT steal focus. `host.focus()` forwards to
  the editor (the ui-textarea override precedent). The focus ring renders on the HOST frame via
  `:scope:has([data-part='editor']:focus)` — deliberately NOT `:focus-within`, which would falsely light
  the field frame whenever focus sits on the send/mic buttons or inside a picker menu (each of which has
  its OWN ring).
- States = the text-input law: the ADR-0014 field-frame border ladder (idle `neutral`, hover
  `neutral-high`, focus `transparent` + the shared outline ring as the sole indicator), bg/ink/placeholder
  from the neutral family, the `:state(ready)` motion gate. `busy` keeps today's whole-composer dim +
  part disabling; the editor becomes non-editable (`contenteditable=false`) + pointer-inert while busy;
  host ARIA (`ariaBusy`/`ariaDisabled`) rides `internals`, never host attributes.
- Geometry: the editor region auto-grows with content from a one-line minimum, capped at
  `max-block-size: 6em` (then scrolls) — the growable-minimum multi-line law (ADR-0134), never a fixed
  §1-row height.
- Consumers keep working with only selector updates in TESTS/helpers (the public callback/prop surface
  of both this element and `ui-conversation` is unchanged): a2ui-chat's `sendIntent` (types via
  `editor.textContent` + `input` — the mechanism survives verbatim, only the `[data-part="composer"]`
  scope hop changes), agent-admin's live-apply browser probe, the conversation/composer test files.
- `npm run check && npm test` green; the SCOPED browser gate (conversation + agent-admin + a2ui-chat
  browser files) green in Chromium + WebKit; `npm run size` within budget; independent review before done.

## Links
- [LLD](../lld/conversation-composer.lld.md) — v2 section appended (the anatomy/mechanism pin).
- [TKT-0056](tkt-0056-conversation-composer-extraction.md) — the extraction this builds on (v1).
- [TKT-0057](tkt-0057-text-field-disable-focus-loss-chromium.md) — the Chromium focus-loss-on-disable
  bug found against the OLD nested `ui-text-field`; the new own-editor busy path re-tests the same
  question (the browser probe keeps the engine-split assertion, retargeted).
- `packages/agent-ui/components/src/controls/textarea/textarea.ts` / `.css` — the donor pattern
  (ADR-0134 / ADR-0014): contenteditable editor wires, field-frame map, multi-line geometry law.

## Scope/Open
- No ADR earned: no new event name (`events: []` stays — submission remains a callback), no new base
  class (`UIElement` + `internals` suffices; this element is still not form-associated — nobody submits
  it in a form, and `ui-conversation` drives it imperatively per SPEC-R4), no catalog admission, no new
  geometry law (ADR-0134's multi-line law reused). The editable-surface mechanics are a reuse of the
  shipped, reviewed ADR-0014/0134 pattern, not a redesign of it.
- The mic/send/picker parts, the chips row, the picker sync machinery, and all five callbacks are
  UNCHANGED — this ticket only replaces the field mechanism and re-frames the outer box.

## Findings

### 2026-07-15 — built, independently reviewed (fix-first → fixed), gates green — CLOSED

Built against the LLD's v2 section (CVC-C3′/C7/C8/C9/C10): `conversation-composer.ts`/`.css`/`.md`/
`.test.ts` rewritten (own contenteditable editor via the ui-textarea ADR-0014/0134 pattern; the nested
`ui-text-field` AND the nested `<form>` both gone; new property-only `value`; Enter-sends/Shift+Enter-
newline, double-IME-guarded; click-to-focus with the buttons/menus/chips exclusion; focus ring on the
host via `:has(editor:focus)`; busy → editor `contenteditable=false` + pointer-inert + host `[busy]` dim
+ `internals.ariaBusy/ariaDisabled`; `:state(ready)` motion gate; 6em editor growth cap). Consumers
updated selector-only: `conversation.test.ts`/`.browser.test.ts` (plus a NEW v2 browser describe: host
ring vs send-button focus, click-to-focus, the 6em cap — all proven in Chromium AND WebKit),
`agent-admin.test.ts` (3 submit sites + the busy-hook check), `agent-admin.browser.test.ts` (2 sites),
both a2ui-chat `sendIntent` helpers (scope hop only — the `editor.textContent` + `input` mechanism
survived verbatim). `conversation.css` gives the composer child an inset margin (the frame replaces the
old flush border-top divider). The theme-provider built-CSS fixture regenerated (self-documented
"regenerate on red" gate; the composer CSS is real shipped site CSS).

**TKT-0057 re-verified, not assumed**: the engine-split focus test was retargeted at the own editor and
re-run — Chromium still blurs a focused contenteditable when `contenteditable` flips false (no tabindex
involved at all now), WebKit still keeps focus; TKT-0057's Findings updated with the refined root-cause
reading.

**Independent review** (fresh-context code-reviewer, all gates re-run under its own hands): 🟡 fix-first,
no functional defect — 1 MEDIUM (three stale comments this change invalidated: agent-admin.ts's 16rem
pane-floor derivation still described the v1 field+Send anatomy; two test banners still justified their
jsdom `setFormValue` stubs by a `ui-text-field` that no longer exists) and 1 LOW (raw part-level editor
`input` events escaped the host — the donor stopPropagates; this element's contract is `events: []`, so
an internal part event leaking out contradicts the descriptor). All fixed: the three comments rewritten
against the v2 anatomy; `event.stopPropagation()` added as the input listener's first act, with a new
regression test pinning that a host-level `input` listener never fires (and that the surface→model wire
still runs — same-target listeners are unaffected). Also took the reviewer's free INFO hardening: the
Enter guard now checks BOTH `isComposing` and the listener-tracked `#composing`. The reviewer's remaining
INFO (internals.ariaBusy never asserted — internals are private, an AX-probe would be the honest
instrument) accepted as-is, not built.

**Gates at close** (all re-run after the review fixes): `npm run check` green · full jsdom 340 files /
6250 tests green · scoped browser (conversation + agent-admin + a2ui-chat) 54/54 Chromium+WebKit ·
`npm run size` `@agent-ui/app` 64967/69632 B gz. The full UNscoped browser suite remains unmeasured (the
known pre-existing node-heap OOM infra issue, documented at TKT-0056's close — the scoped runs of every
touched file are the load-bearing verification).

### 2026-07-15 — post-close follow-up ruling (Kim): mic AND send are both neutral ghost

Send switched `variant="solid"` → `"ghost"`; since ui-button's ghost wash/ink are primary-family by
design (button.css), BOTH `[data-part='mic']`/`[data-part='send']` gained the neutral token-repoint in
`conversation-composer.css` (hover/active wash → the neutral container ladder, ink → the composer's
variant ink — the exact pattern the Models/Effort picker pills already used). Descriptor updated; scoped
jsdom (113) + browser (54/54 both engines) green; the theme-provider built-CSS fixture regenerated.

### 2026-07-15 — post-close follow-up: idle border → outline-variant

`--ui-conversation-composer-border` (idle) switched from the donor's own `--md-sys-color-neutral` to
`--md-sys-color-neutral-outline-variant` (Kim's ruling) — the fainter role, matching `ui-conversation`'s
own shell border for visual consistency between the two frames. Scoped jsdom (59) + browser (20, both
engines) green; the theme-provider built-CSS fixture regenerated.

### 2026-07-15 — post-close follow-up: the text-ink three-state ladder

Kim's ruling on the composer's text colors: the empty-state placeholder always reads as the BASE
`neutral` role (was `on-surface-variant`); typed/filled text (idle OR focused-and-typing — one role for
both, no separate "active" step) reads as `neutral-on-surface-variant` (was `neutral-on-surface`); `[busy]`
repoints ink to `neutral-low` (was `neutral-on-surface-variant`, indistinguishable from the idle
placeholder). All three land as token-only edits to `--ui-conversation-composer-{ink,placeholder}` in
`conversation-composer.css` — no `.ts`/`.md`/test changes needed (no test asserted the specific color
role). Scoped jsdom (59) + browser (20, both engines) green; the theme-provider built-CSS fixture
regenerated.
