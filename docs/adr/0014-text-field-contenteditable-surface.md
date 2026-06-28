# ADR-0014 — ui-text-field: the contenteditable editable surface + the form-control interaction deviations

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-06-27
>
> | Field | Value |
> |---|---|
> | **Status** | accepted *(ratified 2026-06-27 — orchestration-lead/host, on gate)* |
> | **Date** | 2026-06-27 *(authored)* |
> | **Proposed by** | planning-lead — the design seat, resolving the G6 first form control |
> | **Ratified by** | orchestration-lead (host) — 2026-06-27, on gate (token map confirmed by tokens-specialist, folded into clauses 2a/2c/4) |
> | **Repairs** | `goals §G6` (the `ui-text-field` DoD) · **NEW** `components/src/controls/text-field/*` · **NEW** `components/src/traits/track-user-invalid.ts` · `references/interaction-states.md` (the text-entry focus + form-control disabled variants) |
> | **Supersedes / Superseded by** | **Extends ADR-0013** (the `UIFormElement` base it extends) · **Extends ADR-0006 / ADR-0012** (the host-as-grid anatomy reused for the editor centre cell) · **Amends ADR-0009** (the `:focus-within` text-entry variant — see its `## Amendment`) · Relates **ADR-0008** (interaction states — the border-channel variant) · Relates **ADR-0010** (the non-form-control disabled standard this diverges from) |

## Context

`ui-text-field` is G6's first **form-associated** control and the first reuse of the new standards
(`anatomy.md` / `component-packaging.md` / `interaction-states.md` / `geometry.md`). `CLAUDE.md` and `plan §2` bar
native form elements ("FACE over `<input>` wrappers … with zero native form elements"; the sole rce exception is
`<input type=password>` for OS masking, reserved by `plan §12`). `goals §G6` names the resolution verbatim —
"a `contenteditable` surface (no native `<input>`)". Three sub-questions had no resolved answer and are the
load-bearing forces here:

- **How to provide an editable text surface without `<input>`** — and whether `contenteditable` contradicts the
  zero-native rule.
- **How focus, disabled, and visual states differ** from the button-derived standards (ADR-0008 / 0009 / 0010),
  which were authored for a keyboard-operated, non-form-associated control.
- **How the submitted value mirrors the editable surface** without the reactive engine destroying the caret on
  every keystroke.

## Decision

We build `ui-text-field` (`extends UIFormElement`, ADR-0013) with the following clauses — each a buildable
acceptance (decomp slices `s5` behaviour, `s6` styling, `s2` the trait, `s7` descriptor):

**(1) The editable surface — a stable contenteditable editor PART.** A control-created light-DOM
`<div data-part="editor" contenteditable="plaintext-only" role="textbox" aria-multiline="false">`, placed in the
host-as-grid centre value cell, **created once** (an idempotent guard, appended in `connected()`) and **never
re-rendered** — `render()` stays the inherited void no-op, so the text-field has **no `html\`\``/G3 dependency**.
A contenteditable region is a generic element, **not** a native form *widget*; form participation rides
`ElementInternals.setFormValue` on the host (the FACE pattern, ADR-0013) — so this satisfies "no native form
elements". `value`↔surface sync is two scope-owned wires: **surface→model** (an editor `input` listener →
`this.value` + a host `input` event) and **model→surface** (an effect writing `editor.textContent` **only when
the model diverges from the surface** — the **caret guard**: equal ⇒ skip, so a keystroke never resets the caret),
both **suppressed during IME composition** (a `compositionstart`/`compositionend` guard). The **host carries no
`role`/`aria-*` attribute** (the editor carries `role=textbox`; the host's form semantics ride `internals`);
`host.focus()` forwards to the editor (label-association + `.focus()` parity). `contenteditable="plaintext-only"`
with a `contenteditable=true` + input-sanitize fallback for an engine lacking it (a noted risk). The
native-`<input>` exception stays **reserved for `ui-password-field` OS masking** (`plan §12`) — out of scope here.

**(2) Three deviations from the button-derived interaction-states standard, each explicit:**

- **(a) Focus on `:focus-within` (ALL focus), not `:focus-visible` (keyboard-only)** — native text-input parity
  (a text field must visibly signal where typing will land, including on a mouse click). The focus treatment is
  **BOTH** a `border-color` step **AND** the standard shared `outline` ring, **both keyed on `:focus-within`**: on
  focus the field-frame border steps to `--c-focus-ring` (the **screen enhancement**) **and** the host draws
  `outline: var(--ui-focus-ring-width) solid var(--c-focus-ring)` at `var(--ui-focus-ring-offset)` (the
  **forced-colors WHCM indicator**). The outline is load-bearing because `border-color` does **not** survive
  `forced-colors: active` as `Highlight` — the `outline` does, via `--c-focus-ring → Highlight`; so the
  ALL-focus / `:focus-within` reading applies to the **outline ring too**, not just the border. It reuses the
  **same** shared `--c-focus-ring` / `--ui-focus-ring-width` / `--ui-focus-ring-offset` tokens and the same
  layout-neutral recipe — **only the trigger pseudo-class differs** from the button. This **amends ADR-0009** via
  its append-only `## Amendment` (the keyboard-control default stands; this adds the text-entry-control variant).
  `:focus-within` (not `:focus-visible` on the editor) is used because the focusable element is the editor child;
  the ring + border are drawn on the host frame off the focused editor.
- **(b) Disabled rides the editor + the platform form-disabled channel, not host `ariaDisabled`.** With
  `effectiveDisabled = own disabled || #formDisabled` (ADR-0013): disabled → editor `contenteditable=false` + **not
  focusable** + `aria-disabled` + host inert (`pointer-events: none`) + `:state(disabled)`. This **resolves the
  form-control caveat** `interaction-states.md` / ADR-0010 flagged (ADR-0010's `ariaDisabled` is for
  non-form-associated controls). **`readonly`** (RATIFIED in G6 scope) → editor `contenteditable=false` **but
  focusable** (`tabindex=0`) + `aria-readonly` + **still submits**.
- **(c) States are a BORDER channel, not a background channel** — a text field has **no pressed/active** state, so
  the button's background-fill ladder does not apply. The tokens-specialist confirmed the field role map and
  ratified the **SOLID** border ladder over soft-alpha (alpha outlines resolve sub-3:1 against the field surface —
  failing WCAG 1.4.11 for the field boundary). **No token edit — all roles exist.** The pinned field-frame map:
  - **border** idle = `--c-neutral` (≈3.86 / 4.78 :1) · hover = `--c-neutral-high` (5.60 / 5.64) · focus =
    `--c-focus-ring` · invalid = `--c-danger` (4.05 / 4.56) · invalid+hover = `--c-danger-high`;
  - **bg** = `--c-neutral-surface` · **ink** = `--c-neutral-on-surface` · **placeholder** =
    `--c-neutral-on-surface-variant`;
  - **disabled** = a role-**repoint** (bg → `--c-neutral-surface-high`, ink → `--c-neutral-on-surface-variant`,
    keep a faint `--c-neutral-outline-variant` frame), **NOT opacity** (`tokens.md` canon).

  **`user-invalid` timing** comes from the new **`trackUserInvalid`** controller (G4, `s2`): `aria-invalid` +
  `:state(user-invalid)` appear **only after the first interaction** (blur/change), gating the danger border. The
  control **applies** the AX state + custom state via `internals` (the `tabbable`/`ariaDisabled` split — a
  controller cannot reach protected `internals`).

**(3) Labelling (Q1, RATIFIED).** A minimal `label` prop → the editor's `aria-label` (the labelling **seam**). The
visible label / description / error wrapper is **deferred to `ui-field` (G7)** — no visible label in G6.

**(4) Non-colour reinforcement of validity (WCAG 1.4.1).** The invalid state leans on colour (the danger border),
so per **WCAG 1.4.1 (Use of Colour)** the field carries a **non-colour** cue: the editor's validity message is
surfaced via **`aria-describedby`** (a minimal aria hook in G6 — the editor points at a control-managed message
node carrying `validity().message`, populated when `:state(user-invalid)` is set). The **visible** error wrapper is
G7 `ui-field`; this complements the `valueMissing` / `user-invalid` design already in the decomp (it makes the
colour-only danger border perceivable without colour).

## Consequences

- **Realized by** `s5` (`text-field.ts` — the editor, value-sync, validity, disabled/readonly, the role/label
  seam) · `s6` (`text-field.css` — host-as-grid, the border-on-host field frame, the `:focus-within` ring, the
  border-channel states, forced-colors, motion) · `s2` (`track-user-invalid.ts`) · `s7` (the descriptor). Every
  Decision clause maps 1:1 to an acceptance there.
- **The contenteditable-not-rendered choice decouples the text-field from the concurrent G3 template workstream**
  (no `html\`\`` dependency) — the two parallelize cleanly.
- **The family now has two focus modes on the one ring** — keyboard-operated controls (`:focus-visible`) and
  text-entry controls (`:focus-within`) — recorded in the ADR-0009 amendment so a future control picks by *control
  kind*, not by drift.
- **forced-colors:** the field border / ink / placeholder stay visible (`CanvasText`); the focus **outline** (not
  the focus `border-color`, which `forced-colors` drops) survives free via `--c-focus-ring → Highlight` — which is
  *why* deviation #1 keeps both the border step and the outline. Proven in the cross-engine smoke (`s11`).
- **No new token primitive — tokens-specialist CONFIRMED, no `tokens.css` edit.** The field consumes existing
  neutral / danger / surface roles (the role map is **pinned in clause (2c)**; the SOLID border ladder was ratified
  over soft-alpha for WCAG 1.4.11) and inlines its icon ramp the way `button.css` does (no shared `--ui-ind` edit).
- **Negative consequence accepted:** `contenteditable` carries cross-engine quirks (a bogus trailing `<br>` on
  clear → the placeholder keys off a control-toggled `data-empty` attr, not `:empty`; `plaintext-only` support is
  near-universal but not total → the `contenteditable=true` + sanitize fallback). These are bounded and probe-/
  smoke-covered, not open-ended.

## Alternatives considered

- **A native `<input>` (or an `<input>` hidden behind the host)** — rejected: it violates the zero-native-widget
  rule (`plan §2` / `CLAUDE.md`); the FACE contract is full control of geometry/ARIA/styling via `internals`, which
  a native input forecloses. The exception is reserved for password OS masking only (`plan §12`).
- **The editor as an `html\`\`` template re-rendered on `value` change** — rejected: re-committing a contenteditable
  subtree under the user's caret destroys the selection on every keystroke. A stable, imperatively-created editor +
  the caret-guarded `textContent` write is the correct contenteditable discipline — and it removes the G3 dependency.
- **`:focus-visible` on the host (the button standard, unchanged)** — rejected for a text field: native text inputs
  show focus styling on mouse click too; `:focus-visible` would suppress the ring on click, breaking input parity.
  `:focus-within` (on the host frame, driven by the focused editor) is the text-entry contract.
- **Host `ariaDisabled` (the ADR-0010 button channel)** — rejected for a form control: a `UIFormElement` control has
  a platform/editor disabled state (`effectiveDisabled`, incl. fieldset), so the disabled state rides the editor +
  form-disabled, not host `ariaDisabled`.
- **A control-driven clear-`×` / leading-icon in G6** — deferred: the leading/trailing adornment **slots**
  (`anatomy.md`) are supported positions, but a control-driven clear button is out of G6 scope (the minimal field is
  editor + value + validity); it lands as an additive role later.
- **A visible label in G6** — rejected (Q1): the visible label / description / error wrapper is `ui-field`'s job
  (G7); G6 keeps the minimal `aria-label` seam so the field is usable standalone.

## Amendment — deviation #1 focus treatment: a TRANSPARENT border, not a `--c-focus-ring` border-color step (2026-06-28)

> Status: ratified 2026-06-28 (orchestration-lead/host, on gate). Append-only; this **narrows** deviation #1's
> focus treatment after a defect found on the live site. It leaves the Context / Decision / Consequences above
> intact as history. NOTE — this removes the "**BOTH** a border-color step" half of clause (2a), so it sits closer
> to a *supersession* than a foreseen amendment under `docs/adr/README.md`; recorded append-only here at the host's
> direction (a bounded, defect-driven correction), with the supersession-vs-amendment routing flagged to
> planning-lead for confirmation.

**What stands (unchanged).** Everything load-bearing in deviation #1: focus is keyed on **`:focus-within`** (ALL
focus — native text-input parity, not the button's keyboard-only `:focus-visible`), drawn on the **host** frame off
the focused editor child, using the **shared** `outline` ring on the identical `--c-focus-ring` /
`--ui-focus-ring-width` / `--ui-focus-ring-offset` fleet tokens. The outline is still the **forced-colors** indicator
(it survives `forced-colors: active` via `--c-focus-ring → Highlight`, which `border-color` does not). The ADR-0009
`## Amendment` (its ring-only `:focus-within` snippet) already anticipated exactly this shape.

**What changes.** Clause (2a) drew the focus treatment as **BOTH** a `border-color` step to `--c-focus-ring` **AND**
the `outline` ring. On the live site that **doubled**: the field showed two concentric blue frames (the stepped
border *plus* the offset ring). The `border-color` step is dropped — on `:focus-within` the field border steps to
**`transparent`** (the `--ui-text-field-border-focus` ladder token is `transparent`, not `var(--c-focus-ring)`), so
the **outline ring is the SOLE focus indicator** and there is no second frame. A transparent border preserves the
box geometry (the 1px frame still occupies its track — no layout shift on focus).

**forced-colors is unaffected.** The dropped half carried nothing under forced colors anyway — `border-color` does
not survive `forced-colors: active`, so the outline (→ `Highlight`) was already the lone survivor. With the border
transparent on focus, the unfocused field still repaints its border to `CanvasText`; a focused field shows the
`Highlight` outline (the field's transparent focus border is honoured by forced colors). Proven in the cross-engine
states smoke (`text-field-states.browser.test.ts`): the ring is drawn on mouse focus, the focus border is
transparent, and under emulated forced-colors the ring survives while the idle border / ink / placeholder do not
vanish.

**Realized by** `text-field.css` (the `--ui-text-field-border-focus: transparent` token + the `:focus-within` rule
keeping only the `outline`) and its probes (`text-field-css.test.ts` asserts the transparent focus token + the
ring; `text-field-states.browser.test.ts` asserts the transparent focus border + ring survival).
