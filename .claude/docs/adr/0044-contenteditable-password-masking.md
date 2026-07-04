# ADR-0044 — Contenteditable password masking via `-webkit-text-security` (the ui-text-field `type=password` wrinkle)

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-06-30
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-06-30 *(authored)* |
> | **Proposed by** | planning-lead — the design seat, on the Wave-3 Input-variants brief (#49): the `type=password` masking approach |
> | **Ratified by** | orchestration-lead — on the green G6 gate (the password type-matrix proof) |
> | **Repairs** | `controls/text-field/text-field.css` (the `type=password` editor: `-webkit-text-security: disc`; the reveal toggle flips it) + `text-field.md` (the caveat) · `.claude/docs/decompositions/control-suite-wave3-input-variants.decomp.md` (S-B) · **Relates ADR-0014** (the contenteditable-surface choice this handles a consequence of). |
> | **Supersedes / Superseded by** | None. Relates ADR-0014 (contenteditable) + ADR-0012 (the trailing reveal is a slot affordance). |

## Context

`ui-text-field` is a **contenteditable** surface — no native `<input>` (ADR-0014). The Wave-3 `type=password`
variant therefore **cannot** use native `<input type=password>` masking. The masking must be provided another
way, within the uniform contenteditable model.

## Decision

**Mask a `type=password` field with `-webkit-text-security: disc` on the editor part**; the trailing **reveal
toggle** (an eye affordance in the ADR-0012 trailing slot) flips it to `-webkit-text-security: none`.

- **Why `-webkit-text-security`:** a **de-facto-standard** property, universally implemented despite the `-webkit-`
  prefix (Chrome, Safari, Firefox). CSS-only — no mask-layer machinery. It renders the editable text as discs
  while the real value stays editable + carried by `formValue()` to the form.
- **Reveal:** the eye toggle switches the editor between `disc` and `none` (show/hide), the standard reveal UX.

## Consequences

- **Caveat 1 — the value is in `textContent`.** The unmasked value lives in the editor's `textContent`
  (client-side, pre-submit) — the **same exposure as any client-side password field**; `formValue()` carries it
  to the owning form. `-webkit-text-security` is a VISUAL mask, not encryption (as with any web password input).
- **Caveat 2 — AT.** A contenteditable "password" is not a native password field; assistive tech reads the
  masked discs. The FACE `internals` should signal the field's purpose, and the reveal toggle is the accessible
  show/hide. *(A probe asserts the masked render + the reveal flip + the ARIA.)*
- **Stronger masking (a JS mask-layer with a shadow value) is a Phase-2 option** if a caveat proves unacceptable
  — flagged, not built (the `-webkit-text-security` approach is the v1 baseline, matching the contenteditable
  model).

## Acceptance

Browser smoke: a `type=password` editor renders `-webkit-text-security: disc` (the chars show as discs, exact —
not the raw text); the reveal toggle flips to `none` (raw shown) and back; `formValue()` carries the real value;
forced-colors keeps the discs visible. jsdom: the reveal toggle emits + toggles the state.

## Alternatives considered

- **A JS mask-overlay layer** (render discs in an overlay, keep a shadow value) — rejected for v1: heavy (caret
  sync, a parallel value model) for no benefit over `-webkit-text-security`, which every target supports.
- **A native `<input type=password>` as the editor** — rejected: breaks the uniform no-native-input
  contenteditable model (ADR-0014) — one control with a native-input editor only for this `type` fractures the
  field family's single mechanism.
