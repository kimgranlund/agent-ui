# ADR-0134 — A new FACE primitive `ui-textarea` for long-form multi-line text — a sibling of `ui-text-field`, NOT a text-field mode; `ui-agent-admin`'s per-entry editors migrate to it

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-07-14
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-07-14 *(authored)* |
> | **Proposed by** | system-planner — the design seat, on the TKT-0041 "build a real multiline FACE editor" intake (the user chose acceptance path B over a ruled native-textarea exception) |
> | **Ratified by** | Kim |
> | **Repairs** | **NEW** `components/src/controls/textarea/*` (`textarea.{ts,css,md}` + probes) · `app/src/controls/agent-admin/entry-list.ts` (the two `<textarea>` call sites → `<ui-textarea>`) + `agent-admin.md` (the honest-disclosure caveat is retired) · closes **TKT-0041** · discharges **ADR-0131**'s "Build-time note" + **ADR-0132**'s inherited per-entry-editor question · `.claude/docs/decompositions/multiline-text-editor.decomp.json` (the two-plane decomposition this ratifies) |
> | **Supersedes / Superseded by** | None. **Relates ADR-0014** (the contenteditable editable-surface pattern this reuses) · **Relates ADR-0044** (the "add a mode vs. a sibling" precedent — decided the OTHER way here, for stated reasons) · **Relates ADR-0051** (the field-labelling part-role override reused verbatim) · **Relates ADR-0038/0036** (the single-line `(scale × size) → §1-row` geometry law this control deliberately does NOT ride) |

## Context

`ui-agent-admin` renders every per-entry content editor as a plain native `<textarea>` (`entry-list.ts` —
five instantiations share one editor; plus the add-form's `entry-add-content`). This violates the fleet's
own law (`CLAUDE.md`: "no native form elements"; every other editable surface rides `ui-text-field`'s
**contenteditable** model, ADR-0014). ADR-0131 flagged it as an unratified deviation ("Build-time note")
and TKT-0041 tracks the follow-up; ADR-0132 then generalized the single field into N per-entry editors,
widening — not resolving — the same question. **The user has chosen acceptance path B: build a real
multiline FACE editor** (not a ruled native-textarea exception).

The load-bearing forces:

- **No shipped FACE control renders long-form multi-line text.** This is a genuine fleet gap. The nearest
  candidate, `@agent-ui/code`'s `ui-markdown`, is a **read-only** markdown→DOM renderer — it does not edit,
  so it does not close the gap. There is no prior art to reuse.
- **`ui-text-field` is single-line by construction, in three independent places:** (1) the editor part is
  created with **`aria-multiline="false"`** and its keydown handler **`preventDefault()`s Enter** to *commit*
  (single-line law — `text-field.ts`); (2) its geometry is the fixed-height single-line law — `block-size:
  var(--ui-text-field-height)` off the `(scale × size) → §1-row` **lookup** (ADR-0038/0036), `padding-block:
  0`, `line-height: 1`, `white-space: nowrap`, `overflow: hidden` (`text-field.css`); (3) its `type` prop's
  13 variants (email…color) are all **single-line value-shapes** with adornments/codecs/overlays, and
  `aria-multiline` is hard-`false`.
- **What multi-line needs inverts each of those:** `aria-multiline="true"`; Enter **inserts a newline**
  (commit is blur-only); a **growable** geometry — `min-block-size` from a `rows` count, real block padding,
  `align-items: start`, `overflow-y: auto`, prose `line-height`, `resize: vertical`; and **none** of the
  `type` adornment/codec machinery.
- **What multi-line SHARES with `ui-text-field` is the mechanism, not the shape:** the FACE wiring
  (`formValue`/`formValidity`/`formReset`/`formStateRestore` on `UIFormElement`), the caret-guarded
  model↔surface sync, the IME composition guard, the `trackUserInvalid` timing controller, and the ADR-0051
  field-labelling seam. Several of those are **already extracted** (the `trackUserInvalid` trait, the base's
  labelling seam) and are consumed, not owned, by `ui-text-field`.

## Decision

**We will add a new form-associated primitive `ui-textarea` (`class UITextareaElement extends UIFormElement`,
its own `controls/textarea/` folder), NOT a `type=multiline` member or a `multiline` boolean on
`ui-text-field`.** It reuses ADR-0014's contenteditable **pattern** (a stable, once-created
`[data-part="editor"]` with the caret-guarded two-wire sync + IME guard) and the ADR-0051 field-labelling
override, and declares its **own multi-line geometry law**. `ui-agent-admin`'s two `<textarea>` call sites
migrate to it. This repairs the NEW `components/src/controls/textarea/*` and `app/src/controls/agent-admin/
entry-list.ts`, closes TKT-0041, and discharges ADR-0131's build-time note + ADR-0132's inherited question.

**Why a sibling, not a mode (the fork, ruled):**

- **The `type` axis is semantically single-line.** All 13 `type` variants are value-shapes of a *one-line*
  field (masking, steppers, calendar/color overlays, magnifier). Multi-line is not "another value shape" —
  it is "not single-line." A 14th `type`, or a boolean incompatible with all 13 existing types, is a
  prop cross-product whose cells are **mostly invalid** (`multiline type=currency` is meaningless) — a
  design smell the sibling avoids entirely.
- **The geometry is a different law, not a variant of the same one.** Single-line geometry is a *fixed
  height* resolved by the `(scale × size) → §1-row` lookup with `padding-block: 0` / `line-height: 1` — a
  law whose tests assert exact §1 integers (memory: geometry-under-`[scale]` asserts the §1 rows). A
  multi-line box has **no single §1 row**: its height is `rows × line-box + 2·block-padding` as a *minimum*
  that grows. Forcing it into `ui-text-field` means special-casing multi-line **out** of the height lookup
  and its assertions — the mode would corrupt the shipped control's own geometry contract.
- **The Enter contract inverts in the interaction core.** `ui-text-field`'s Enter-`preventDefault`-commits
  handler lives in the connected-time `keydown` listener, **outside** the `type`-effect. A mode would thread
  `this.multiline` into that core interaction wiring — coupling the shipped single-line path to the new
  shape at its most delicate point.
- **Reuse is preserved without the strain.** The genuinely shared surface is the FACE base (inherited from
  `UIFormElement`), the `trackUserInvalid` trait (already extracted, consumed as-is), and the ADR-0051
  labelling seam (a base method, overridden identically). The only real duplication is the ~40-line
  editor-part-creation + the two caret-guarded sync effects — acceptable for a v1, and a candidate for a
  shared `editableSurface(host, opts)` **trait** extraction on the *rule of three* (a THIRD editable
  contenteditable consumer), named here as a deferred follow-up, **not** a prerequisite (extracting the
  shipped, heavily-tested `ui-text-field` editor into a trait now is high blast radius for a single new
  consumer — deferred deliberately).

**The multi-line geometry law (this control's own):**

- A **`rows` prop** (number, native `<textarea rows>` parity, default `3`) sets a **`min-block-size`** of
  `rows × line-box + 2·(block padding)`; content grows past it via `overflow-y: auto`. **`[size]` (sm/md/lg)
  repoints font + block-padding + the per-row line-box** — it does **NOT** set a fixed control height (the
  single-line `--ui-{height}` lever does not apply here). `--ui-textarea-*` control-tier tokens declare this
  chain (§5 naming law; `--ui-textarea-min-inline-size` reuses the entry-control typing-width-floor leg,
  ADR-0021).
- **Real `padding-block`** (a comfortable text inset) + **`align-items: start`** (text at top-left, not
  vertically centered) + a prose **`line-height`** (NOT the single-line `line-height: 1`) — the exact three
  things the single-line law forbids, which is *why* it is a separate law.
- **`resize: vertical`** on the box (native parity; user-draggable). Auto-grow-to-content (a `autogrow`
  boolean driving a `scrollHeight` sync — `field-sizing: content` does not apply to contenteditable) is a
  **named additive follow-up**, not v1.
- The **border-channel state ladder, `:focus-within` ring (transparent border), forced-colors, and
  reduced-motion** are inherited verbatim from ADR-0014 (the field-frame pattern is shape-independent).

**The `ui-agent-admin` migration (`entry-list.ts`):**

- Both `document.createElement('textarea')` sites (the per-entry `entry-content` editor and the add-form's
  `entry-add-content`) → `document.createElement('ui-textarea')`. The `data-part="entry-content"` /
  `entry-add-content` attribute hooks, the `aria-label`→`label` name, `.value` get/set, and the **`change`-on-
  blur commit timing stay byte-identical** — `ui-textarea` emits `change` on blur-with-change (the closed-six
  law), which is exactly the current contract (`entry-list.ts` commits on the textarea's `change`, never
  `input`).
- **One real migration cost, called out:** `entry-list.ts`'s re-render preservation of an in-progress edit
  keys off `active instanceof HTMLTextAreaElement` and calls `active.setSelectionRange(...)`
  (`entry-list.ts:124-128,183-186`) — native-`<textarea>` APIs a contenteditable host does not expose. The
  migration must swap that for a `ui-textarea`-friendly equivalent (identify the active host by its
  `[data-part]`/tag + `.value`; restore focus + place the caret at end via a Selection/Range on the editor
  part, or a small `selectToEnd()` seam on `ui-textarea`). This is a bounded, single-file change, flagged so
  the builder does not discover it mid-migration.

## Consequences

- **Realized by** NEW `controls/textarea/{textarea.ts,textarea.css,textarea.md}` + probes (jsdom + a
  cross-engine browser leg — the multi-line Enter-inserts-newline behavior, the `rows` min-height, resize,
  and the caret-preservation seam are browser-real, so the `component-reviewer` DoD + the browser gate run
  **before** commit, per the control-wave law). The two-plane decomposition
  (`multiline-text-editor.decomp.json`) passes `coverage_check.py` at exit 0 (clean, incl. `--strict`).
- **The fleet gains its first editable long-form surface**, closing the gap for any future consumer (not
  just `ui-agent-admin`) — the ADR-0132 generic per-entry editor and any prose/notes/description field.
- **Layering + catalog:** `ui-textarea` is a `@agent-ui/components` control (`controls/`, self-defines on
  import, added to the controls barrel + the family-coherence gates). Whether it earns an A2UI catalog type
  is a **separate** intake (out of scope here) — this ADR ratifies the fleet primitive only.
- **Deliberate duplication accepted:** the editor-part-creation + caret-guarded sync (~40 lines) is copied,
  not shared, in v1. The `editableSurface` trait extraction is the named rule-of-three follow-up; until a
  third consumer exists, the copy is cheaper and lower-risk than refactoring shipped `ui-text-field`. Stated
  as a debt, not hidden.
- **Adjacent, explicitly NOT in scope:** the add-form's single-line `<input type=text>` label/description
  fields (`entry-list.ts:63-72`) are also native form elements — but they are single-line and `ui-text-field`
  already covers them; that is a separate coherence cleanup, not this multi-line ticket. Noted so a future
  native-element sweep does not read this ADR as having blessed them.
- **Stale-record repairs on ratification+build:** `agent-admin.md`'s honest-disclosure caveat about the
  native textarea is retired; ADR-0131's build-time note and ADR-0132's inherited question are marked
  discharged by this record; TKT-0041 closes.

## Alternatives considered

- **`type="multiline"` on `ui-text-field`** — rejected: overloads a semantically single-line `type` axis
  with a shape-changer, forces multi-line to be special-cased **out** of every `type`-effect branch and out
  of the `(scale × size) → §1-row` height lookup (corrupting the shipped control's geometry assertions), and
  threads `this.type === 'multiline'` into the connected-time Enter keydown core. Note this is the OPPOSITE
  call from ADR-0044 (`type=password` *was* added as a mode) — justified because password is a genuine
  single-line value-shape sharing the exact geometry + Enter contract, whereas multi-line inverts both.
- **A `multiline` boolean prop on `ui-text-field`** — rejected: same geometry/Enter strain as the `type`
  member, plus a prop cross-product (`multiline` × `type`) whose cells are mostly invalid, requiring
  incompatibility gating that a sibling avoids by construction.
- **Extract a shared editable-surface base/trait NOW, then build `ui-textarea` thin on top** — rejected for
  v1: the *correct* long-term factoring, but it means refactoring the shipped, 990-line, heavily-tested
  `ui-text-field` editor into a base as a prerequisite for one new consumer — high blast radius. Deferred to
  the rule-of-three follow-up; `ui-textarea` v1 reuses the *pattern*, extends `UIFormElement` directly (as
  `ui-text-field` itself does), and duplicates ~40 lines knowingly.
- **A ruled native-`<textarea>` exception (TKT-0041 path A)** — rejected: the user explicitly chose path B.
  A native exception would leave the fleet with no editable long-form surface and would re-surface the same
  question for every future multi-line consumer ADR-0132 foresees.
- **Reuse `@agent-ui/code`'s `ui-markdown`** — rejected: it is a read-only renderer (markdown→DOM), not an
  editor; it cannot host text entry, so it does not close the gap.
