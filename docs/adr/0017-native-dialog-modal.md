# ADR-0017 — `ui-modal` on the native `<dialog>` `showModal()` (top-layer, not a form widget)

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-06-28
>
> | Field | Value |
> |---|---|
> | **Status** | proposed |
> | **Date** | 2026-06-28 *(authored)* |
> | **Proposed by** | planning-lead — the design seat, ratified G9 container-family session |
> | **Ratified by** | orchestration-lead (on gate) |
> | **Repairs** | `goals §G9` (NEW — the `ui-modal` DoD) · `a2ui-catalog SPEC §5.2` (`Modal` `experimental → shipped`) · `plan §2` (the "no native form elements" rule — scopes it to form *widgets*) · **NEW** `controls/modal/*` |
> | **Supersedes / Superseded by** | Relates: **ADR-0014** (the same "rule bars native form *widgets*, not all native elements" reasoning that cleared `contenteditable`) · **ADR-0019** (the bindable `open` two-way bind) |

## Context

The ratified G9 session ships A2UI's `Modal` as `ui-modal`. A modal needs four hard browser behaviours that are
notoriously fragile to hand-roll in light DOM: **top-layer stacking** (render above all page content regardless of
`z-index`/`overflow`/stacking context), a **`::backdrop`**, **focus containment**, and **Escape-to-dismiss**. The
platform's native `<dialog>` element with `showModal()` supplies all four for free, in the top layer, with zero
dependencies.

The apparent conflict: the repo's standing rule (`CLAUDE.md`, `plan §2`) is **"no native form elements."** ADR-0014
already resolved the analogous tension for `ui-text-field` — that rule bars native form **widgets** (`<input>` /
`<select>` / `<textarea>` / `<button>`), the elements that bring their own UA-styled control affordance and
implicit form semantics; it does **not** bar every built-in element. A `<dialog>` is a generic top-layer container,
not a form control: it submits nothing, carries no `value`, and is not form-associated. (`<dialog>` does support an
optional `method="dialog"` form-close convenience, which we do **not** use.)

## Decision

We implement **`ui-modal` over a native `<dialog>` opened with `showModal()`**, taking the platform's modal
machinery and adding only the gaps the platform leaves. Five clauses, each a buildable acceptance (decomp `s9`):

1. **A control-owned `<dialog>` part.** The control creates **once** (idempotent guard) a light-DOM
   `<dialog data-part="dialog">` and renders its children into it. `render()` stays the inherited void no-op (no
   `html\`\`` template) — re-creating the dialog would drop the top-layer/focus state. This is an internal **part**
   the control owns (descriptor `parts: [dialog]`), not a user slot.
2. **`open` drives `showModal()` / `close()`.** A reflected boolean `open` prop, driven by a scope-owned effect:
   `open` true → `dialog.showModal()` (top layer + `::backdrop` + focus containment + Escape, all from the
   platform); false → `dialog.close()`. `open` is **bindable** (two-way, ADR-0019) — the catalog declares
   `value: { prop: 'open', event: 'toggle' }`.
3. **Escape + backdrop dismissal → `close` event, state synced.** The platform's Escape `cancel`/`close` events are
   listened on `dialog` (via the connection `AbortSignal`); on a platform-initiated close the control sets
   `open = false` (keeping the prop and the platform state in sync) and emits the family `close` event (plus
   `toggle` for the two-way bind). A `[dismissable]` prop (default on) gates backdrop-click dismissal.
4. **Focus trap is the platform's; focus *restore* is ours.** `showModal()` already **traps** focus inside the
   dialog and moves initial focus in. The platform does **not** reliably restore focus to the invoking element on
   close, so the control records `document.activeElement` at open and restores it on close (the one focus gap the
   platform leaves). Initial focus honours an `autofocus` child, else the dialog.
5. **Dialog ARIA via the part, disclosure meaning on the host.** The `<dialog>` carries the dialog role implicitly;
   `aria-modal` is set by `showModal()`. An accessible name rides `aria-labelledby`/`aria-label` on the dialog part
   (a header child or the `label` prop). The host carries **no** role/aria attribute (consistent with the family's
   `internals`-only ARIA discipline) — the dialog part is the semantic element the control owns.

## Consequences

- **Realized by** decomp `s9` (`controls/modal/` — `{ts,css,md}` + probes, including the cross-engine smoke for
  top-layer paint, focus trap, Escape, and forced-colors backdrop). The catalog `Modal` entry (`s11`) binds
  `ui-modal` directly and declares the `open` two-way bind.
- **Top-layer/backdrop/Escape/trap are free and correct** — the catastrophic light-DOM overlay failure mode (an
  overlay hidden or mis-stacked when its own stylesheet does not load) does not apply: the platform owns the
  stacking, not a fragile `z-index`. This is the explicit reason to take the native element rather than a `<div
  role=dialog>`.
- **The "no native form elements" rule is *scoped*, not bent.** `plan §2` now reads: the ban is on native form
  **widgets**; generic built-ins that bring platform structure with no form-control affordance (`<dialog>`,
  `contenteditable`) are permitted. ADR-0014 set this precedent for the editable surface; this ADR confirms it for
  the modal. The native-`<input>` exception stays reserved for `ui-password-field` OS masking only (`plan §12`).
- **One focus gap is ours to own.** Focus *restore* is the single behaviour the platform omits; it is a small,
  testable control-level concern (record-on-open / restore-on-close), not a reimplementation of the trap.
- **Stale → re-verify:** `a2ui-catalog SPEC §5.2` flips `Modal` to shipped (`s11`); `plan §2` gains the
  widgets-vs-elements scoping note. Nothing shipped depends on `ui-modal` (net-new).

## Alternatives considered

- **A light-DOM `<div role="dialog">` overlay with a JS focus trap + a manual top-layer (`position: fixed` +
  `z-index`)** — rejected: it re-implements (badly) what `<dialog>`+`showModal()` give for free, and inherits the
  stacking-context/`overflow: hidden` clipping bugs and the stylesheet-dependent hidden-by-default failure mode the
  G7 overlay note warns about. The platform top layer is immune to all of them.
- **The CSS `popover` attribute / Popover API** — rejected for a *modal*: `popover` is non-modal (it does not trap
  focus or render a blocking backdrop by default) and is the right primitive for the later *non-modal* overlay
  (menu/tooltip/`ui-select` popup, G7), not a blocking dialog. `showModal()` is the modal primitive.
- **Treating `<dialog>` as a banned native form element** (and hand-rolling the overlay to honour the rule
  literally) — rejected: it misreads the rule. The rule exists to keep form **semantics/affordances** under FACE
  control via `ElementInternals`; a `<dialog>` introduces no form semantics. ADR-0014 already established the
  widgets-not-elements reading; applying it consistently here avoids re-litigating settled scope.
