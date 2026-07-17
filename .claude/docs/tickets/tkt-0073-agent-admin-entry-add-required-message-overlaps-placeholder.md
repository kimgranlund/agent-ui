---
doc-type: ticket
id: tkt-0073
status: done
date: 2026-07-16
owner:
kind: bug
---
# TKT-0073 — `ui-agent-admin`'s entry "+ Add" name field shows its required-validation message INSIDE its own box, overlapping the placeholder

## Summary
Kim's seed (2026-07-16, `/scribe:bug-report`, 2 screenshots): on the "+ Add" form (Instructions pane
of `agent-admin.html`, or any of the other four capability panes — all five share `entry-list.ts`'s
`mountEntryList`), leaving the required `labelField` empty and blurring/submitting shows
`.ui-text-field-message`'s text `"Please fill out this field."` rendered directly above the
`placeholder="Name"` text, both inside the SAME red-bordered `ui-text-field` box — cramped/
overlapping, and in one repro the caret renders mid-way through the message text. Kim: "the helper
text is interfering with the placeholder. helper text should be placed outside, and can just use
the browser default validation UI."

Root-caused (grep + read, not guessed): `entry-list.ts:85-92` builds `labelField`/`descriptionField`
as BARE `<ui-text-field>` elements — never wrapped in `<ui-field>`. `ui-text-field` carries its own
internal `.ui-text-field-message` fallback node (ADR-0029 A1, `text-field.ts:962-985` /
`text-field.css:294-305`) for exactly this case — a control with no `ui-field` ancestor to hand its
error to. That fallback message is a light-DOM child of the text-field HOST itself, so it shares the
host's own `display:inline-grid` box (the bordered frame) with the editor/placeholder — by design,
predating `ui-field`. `field.ts`'s own header comment already names this: "`ui-field` (G7), when it
lands, will relayout/host this node rather than re-introduce it" (text-field.css:300) — G7 shipped
(ADR-0051, accepted), but `entry-list.ts` was never migrated off the bare-control fallback path.
The fleet's OWN precedent for exactly this two-field shape (required name + optional description)
already exists and renders the error OUTSIDE the box: `site/pages/forms.ts:36`,
`site/pages/form-provider-demo.ts:28` — `el('ui-field', { label: 'Name', description: 'Required' },
[el('ui-text-field', { name: 'name', required: '' })])`. `ui-field`'s error part is a separate
flex-column DOM node (`field.css:71-114`), never sharing the control's own bordered box.

## Acceptance
- `labelField` and `descriptionField` in `entry-list.ts`'s `mountEntryList` are wrapped in `<ui-field>`
  (matching the `forms.ts`/`form-provider-demo.ts` precedent) so the required-field validation
  message renders OUTSIDE the `ui-text-field`'s own bordered box, never overlapping the placeholder.
- `agent-admin.ts` registers `@agent-ui/components/controls/field` (the existing
  button/icon/textarea/text-field side-effect-import pattern already documented there).
- Existing `data-part="entry-add-label"` / `data-part="entry-add-description"` attributes stay on the
  `<ui-text-field>` elements themselves (unchanged selector contract for
  `agent-admin.test.ts`/`agent-admin.browser.test.ts`, which already `querySelector` for them —
  nesting one level deeper under `<ui-field>` does not break a descendant `querySelector`).
- Visual/behavioral parity otherwise unchanged: `submitAdd()`, the Enter-to-submit wiring on
  `labelField`, and the reset-only-on-success behavior (TKT-0060) all carry over untouched — this
  ticket only changes WHERE the two fields' validation/label text renders, not the submit logic.
- Kim's "browser default validation UI" alternative was evaluated and is NOT the fix here: `submitAdd()`
  is a manual click/keydown handler, not a native `<form>` `submit` event (TKT-0060 deliberately
  removed the native `<form>`), so there is no native-form trigger point for `reportValidity()`'s
  bubble to hook into without reintroducing what TKT-0060 removed; `ui-field`'s own external error
  part is the fleet's already-shipped, WCAG-1.4.1-compliant equivalent ("outside" placement) and is
  reused rather than inventing a second mechanism.
- `ui:component-reviewer` dispatched before this is called done (shipped `packages/agent-ui/app/**`
  code touching the same file TKT-0048/0049/0050/0060/0061 already worked — expect concurrent-edit
  awareness, not a blind whole-file rewrite).
- `npm run check && npm test` green, including `agent-admin.test.ts`/`agent-admin.browser.test.ts`.

## Repro
No fixed repro needed — visible on `agent-admin.html`'s Instructions pane (or any of the other four
capability panes): open "+ Add section", leave the "Name" field empty, blur it or click "Add" — the
red-bordered box shows "Please fill out this field." directly above/overlapping the "Name" placeholder,
inside the same box.

## Expected vs actual
- **Expected:** the required-field validation message renders outside the input's own bordered
  surface (below it, in its own line), like `ui-field`'s error part does everywhere else it's used
  in this repo (`forms.ts`, `form-provider-demo.ts`).
- **Actual:** the message renders inside the text-field's own box, sharing its fixed-height grid
  frame with the placeholder text — visually cramped/overlapping, confusable with typed content.

## Classification
Axis: **structural** (a known, named architectural deferral — the pre-`ui-field` internal-message
fallback was never migrated once `ui-field` shipped — not a fresh component defect).
Plane: `packages/agent-ui/app/src/controls/agent-admin/entry-list.ts:85-92` (`labelField`,
`descriptionField` construction) × `packages/agent-ui/components/src/controls/text-field/text-field.css:294-305`
(the fallback message rule this bug's symptom comes from, working as originally designed for a
control with no `ui-field` ancestor — not itself defective) × `packages/agent-ui/components/src/controls/field/field.ts`
(the already-shipped fix vehicle).

## Severity
**minor** — no functional break (the message text is still readable and the field still validates
correctly); the defect is purely the cramped/overlapping visual presentation Kim flagged.

## Links
- [TKT-0060](tkt-0060-agent-admin-entry-add-form-native-form-conversion.md) (converted `labelField`/
  `descriptionField` to real `<ui-text-field>`s and removed the native `<form>` — the reason a native
  validation-bubble path isn't available here without undoing that ticket)
- `site/pages/forms.ts:36`, `site/pages/form-provider-demo.ts:28` (the `ui-field`-wrapping precedent
  this ticket ports into `entry-list.ts`)
- `packages/agent-ui/components/src/controls/field/field.ts`, `field.css` (ADR-0051, the shipped
  outside-placement mechanism)
- `packages/agent-ui/components/src/controls/text-field/text-field.css:294-300` (the fallback
  message's own comment naming this exact migration as future work)

## Findings

### 2026-07-16 — `ui-field` wrap fix + regression pin

- `entry-list.ts`: `labelField`/`descriptionField` now each wrapped in a `<ui-field>`
  (`labelFieldWrap.label = 'Name'`; `descriptionFieldWrap.label = 'Description'` +
  `.description = 'Optional'`), matching the `forms.ts`/`form-provider-demo.ts` precedent. The two
  `placeholder` assignments ("Name" / "Description (optional)") were removed — redundant once a real
  visible label renders above each field. `addForm.append(...)` now appends the `*Wrap` elements;
  every other reference (`.value`, `.focus()`, the Enter-keydown listener, `data-part` attrs) is
  unchanged, still pointed at the inner `<ui-text-field>`s.
- `agent-admin.ts`: added `import '@agent-ui/components/controls/field'` (the side-effect
  registration import, alongside button/icon/textarea/text-field) + an updated header comment.
- Verified live in a real Chromium tab (Playwright, `agent-admin.html`, "+ Add section" →
  submit while Name is empty): the message "Please fill out this field." now renders on its own
  line BELOW the field's bordered box (the `ui-field` error part), never inside it; the internal
  `.ui-text-field-message` node stays `hidden=""` and empty (ADR-0051 cl.4's yield, confirmed via
  DOM inspection, not just visually).
- `ui:component-reviewer` dispatched (fresh context) — verdict SHIPPABLE. Confirmed: downstream
  logic (`submitAdd`/reset-on-success/focus/Enter-keydown/`render()`) untouched; contract fidelity
  against `field.md` correct; existing `[data-part]` queries nesting-depth-proof; no dangling CSS;
  and a11y is a **strict improvement** (the bare fields were previously unnamed to assistive tech —
  `placeholder` is CSS-only, never an accessible-name source — now real `aria-labelledby`/
  `aria-describedby` via the ADR-0051 seam). One MODERATE finding: the fix had no regression test
  pinning the registration+association, so a severed `controls/field` import would silently regress
  to WORSE than pre-fix (no label, no placeholder, message back in-box) with zero test failures.
  Fixed: added a jsdom test (`agent-admin.test.ts`, "TKT-0073: …") asserting the wrapping `ui-field`
  exists and carries the visible error while the internal `.ui-text-field-message` stays empty/hidden
  — exercises the real blur→interacted→invalid path (dispatched directly on the editor part, since
  jsdom's `.click()` doesn't relocate focus/fire blur the way a real browser does) and awaits
  `whenFlushed()` for the reactive render effect. One MINOR pre-existing (not introduced by this fix,
  filed here as a note rather than a new ticket): a successful Add blurs the label field and then
  resets its value to `''`, so reopening the form shows "Please fill out this field." on a pristine
  field — the old in-box fallback had the same behavior, just less visually prominent; not a
  regression, not blocking.
- Gates: `npm run check` (tsc × 3 legs) green; `npm test` — 342 files / 6283 tests green;
  `agent-admin.test.ts` — 49/49 (jsdom); `agent-admin.browser.test.ts` — 46/46 (Chromium + WebKit).

Files touched: `packages/agent-ui/app/src/controls/agent-admin/entry-list.ts`,
`packages/agent-ui/app/src/controls/agent-admin/agent-admin.ts`,
`packages/agent-ui/app/src/controls/agent-admin/agent-admin.test.ts`.
