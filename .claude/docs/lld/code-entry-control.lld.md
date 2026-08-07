# LLD — `ui-one-time-code` (S2-a, the identity family's one Lane-A control)

> Status: proposed · v0.1 · 2026-08-07 · Layer: LLD (implementation plan)
>
> Refines: [ADR-0176](../adr/0176-identity-account-flow-family-design-intake.md) (accepted — cl.1
> rules the Codes mode's code-entry field the family's ONE new components-tier control, Lane A;
> cl.3 rules every Registration/Authentication surface host-page-only, never catalog-driven) ·
> [`identity-flow.decomp.md`](../decompositions/identity-flow.decomp.md) (the S2-a leaf this LLD
> fills — §1 rules it a full LLD before build; §5's `S2-a → S2-a2` edge makes this document the
> contract the OTP composition later wires against; action a4 is the interaction surface owed) ·
> [`identity-mock-transport.spec.md`](../spec/identity-mock-transport.spec.md) SPEC-R2 (the
> request/verify/resend transport side — ALREADY BUILT + unit-covered on `fix-490-s2-sign-in`
> @ `2be7a2b`, `site/lib/identity-mock-transport.ts`; this control never imports it — SPEC-N6
> fences the UI contract out of that SPEC, and the composition seam between them is S2-a2's).
> Author: planner (design seat). No SPEC for S2-a: the decomp's §1 tier ruling grants S2-a "full
> LLD" only — acceptance criteria live inline here (§12), per doc-tier law.
>
> **Composes on (every API verified against shipped source, not summaries):** `UIFormElement`
> (`dom/form.ts` — spreadable `formProps`, the ADR-0051 `FieldLabelling` seam, `formValue`/
> `formValidity`/`formReset` overrides) · `ui-text-field`'s editable-surface machinery as PATTERN
> (`controls/text-field/text-field.ts` — the ADR-0014 cl.1 stable contenteditable editor PART,
> created once/never re-rendered; the composed host `input` re-emit; the IME composition guard; the
> ADR-0051 part-role labelling override; the blur/Enter `change`-commit baseline) ·
> `trackUserInvalid` (`traits/track-user-invalid.ts:62` — `(host, { invalid: () => boolean })`,
> the danger-treatment timing) · the geometry law (`references/geometry.md` — §1-row lookup
> ADR-0038, entry-class radius/floor, the slot/rhythm families) · the naming law
> (`references/naming.md` §10/§13) · the ADR-0087 catalog-or-allowlist gate
> (`a2ui/src/catalog/default/index.test.ts` `EXCLUSION_ALLOWLIST` — the ADR-0112 cl.6 permanent-
> exclusion precedent).
>
> **Freeze discipline.** §4 is the fan-out contract for the builder seat — a builder who finds a
> seam unworkable STOPS and escalates (a coordinated LLD repair), never improvises past this
> document (the S2 build seat's own escalation on hitting S2-a is the correct precedent).

## 1 · Intent

One new FACE control, `ui-one-time-code` (`UIOneTimeCodeElement extends UIFormElement`): a
segmented N-cell one-time-code entry field — ONE focusable editable surface with N presentational
cells — owning the cross-cell interaction logic ADR-0176 cl.1 names as the reason this earns a
control at all: auto-advance on digit entry, backspace walk-back, arrow traversal under a
no-gaps invariant, first-empty focus on entry, and paste-split of a full or partial code with
non-digit filtering. Value = one string prop; commit = the fleet's `change` event the moment the
code completes (the S2-a2 composition's submit trigger). Host-page-only by ratified law — a
permanent catalog exclusion, never a catalog row (§9).

## 2 · Fork sheet (every row decided; WHY one line each)

| Row | Ruling | Why |
|---|---|---|
| **Tag / family name** | `ui-one-time-code` — folder `controls/one-time-code/`, class `UIOneTimeCodeElement`, tokens `--ui-one-time-code-*`, descriptor `one-time-code.md`, docs pages `one-time-code-{doc,demo}.html` (§13 derivation, one decision in). | §10 rubric: "code" alone COLLIDES with the concept canon — `@agent-ui/code`, `ui-code-editor`, and the catalog's `Code` type all mean SOURCE code, so `ui-code-entry` (the working name) would enter the tag/class/catalog namespaces ambiguously. `one-time-code` is the platform's own canon (HTML `autocomplete="one-time-code"`), the transport's own verb stem (`requestOneTimeCode`/`verifyOneTimeCode`, SPEC-R2), and GH #490's own mode name — fully derivable, no reserved-word collision, no abbreviation (`otp` fails the never-abbreviate law). |
| **Base class** | `UIFormElement`. | Value-bearing form control (one committed string); none of the `_base` families (indicator/range/listbox) fits a typing surface — the text-field's own classification, reapplied. |
| **Tier (size-class)** | `control` (full height). | The cells are entry boxes on the control band — same lever as `ui-text-field`/`ui-select` (`geometry.md` five-class table: Control = `block-size` off the §1 row). |
| **Anatomy** | Host = the cell grid (inline-grid, N tracks + an overlay track). Control-created light-DOM parts, created ONCE (the ADR-0014 idempotent-guard law): `data-part="editor"` (ONE `contenteditable="plaintext-only"` div, `role=textbox`, `inputmode=numeric`, visually transparent, stretched over the grid) + N × `data-part="cell"` (presentational, `aria-hidden="true"`, `[data-filled]`/`[data-active]` state attributes) + the `data-part="message"` aria-describedby node (text-field's ADR-0014 cl.4 pattern, yielding under `ui-field` association). No slots — nothing is author-supplied inside this control. | One editable surface is the a11y ruling (§6); cells as owner-stamped `data-part` chrome is ADR-0157's channel law (nothing here is an author-placed `data-role` adornment). |
| **Props** | `...UIFormElement.formProps` (name/disabled/required) · `value: prop.string()` — observed not reflected (the live value never rides a host attribute; the initial attribute seeds the reset baseline — text-field's exact convention) · `length: prop.number(6), reflect` — N cells, cleaned to an integer clamped `[1, 12]` (beyond 12 a segmented readout stops being readable and paste/geometry degenerate; nonsense → default 6) · `label: prop.string(), reflect` — the bare-usage `aria-label` stand-in, yielding to `ui-field` association (ADR-0051/0085) · `size: prop.enum(['sm','md','lg'], 'md'), reflect` — the geometry dial (§7). | Minimal surface: no `type`, no `readonly`, no mask — named non-goals (§10). `length` is native `maxlength`'s concept with the fleet's plain-noun spelling; no §3 reserved word collides. |
| **Events** | `input` — composed, target = host, after EVERY value mutation (digit, backspace, paste). `change` — on commit: (a) the moment `value.length` reaches `length` (the completion commit — S2-a2's auto-submit trigger) and (b) blur-with-change against the value-at-focus baseline (text-field parity; the completion commit resets the baseline so blur never double-fires). Both ∈ the closed seven — **no new event name, no fleet-contract fork**. | Mirrors text-field's commit grammar exactly; completion-as-commit is a new commit MOMENT, not a new vocabulary member. |
| **Geometry** | §7. `(scale × size) → §1 row` LOOKUP (ADR-0038 — no multiplier): `sm`→24/13 · `md`→28/14 · `lg`→36/16 (height/font, text-field's own rows). Cell inline-size `= height` (square cell — a one-glyph entry box; derived off the lever, no new ramp). Gap `= font/2 ×` density (rhythm family). Radius = entry class (`--md-sys-shape-corner-base`, fixed). | Every quantity resolves off the row or a derived formula — no ad hoc value, no new geometry row, so no ADR (the novelty leg is NOT taken). |
| **Tokens** | `--ui-one-time-code-{height,font,cell-inline-size,gap}` + cell surface/state roles piggybacking the entry family's color law (§7). | `--ui-{name}-*` law; color roles consume the same `--md-sys-color-*` roles the text-field's entry states already consume (TKT-0062's fleet-wide filled-state law) — zero new color roles. |
| **A11y** | ONE textbox, N presentational cells — ruled in §6 with the full WHY. ARIA rides the editor PART (`role=textbox`) + `internals` for form semantics, NEVER host attributes (the FACE law; text-field's ADR-0051 part-role override is the labelling template). | §6. |
| **Interaction states** | The standard four states + `[density]` per `interaction-states.md`, applied per cell; `[data-active]` (the caret-cell indicator, focus-gated) is the one addition — a component-local visual state, not a custom `:state()` (no closed-set admission, no fork). | Deviation-only row: active-cell is presentation of the edit position, not a new interaction state class. |
| **Form participation** | `formValue()` = the raw (possibly partial) string. `formValidity()`: `required && value === ''` → `valueMissing`; `0 < value.length < length` → `tooShort` (the native flag for under-length — no `customError` misuse). `formReset()` → the initial `value` attribute baseline. `trackUserInvalid` gates the danger treatment on merged validity (the GH #554-corrected pattern, `text-field.ts`). No codec — the canonical IS the display. | Straight reuse of shipped mechanics; nothing novel. |
| **Catalog posture** | **Permanently excluded** — §9. | ADR-0176 cl.3 (ratified): credential-bearing auth chrome is host-page-only, never agent-emittable. |
| **Site surfaces** | Descriptor `one-time-code.md` + doc/demo pages + a `<component-gallery>` specimen — the standard step-8 trio + gates (§11). | Standing law, no decision to make. |

## 3 · The value + edit model (the cell focus graph, frozen)

State: `value` — a **contiguous digit prefix** (`/^[0-9]{0,N}$/`, the no-gaps invariant: cells fill
left-to-right, a hole can never exist) — plus a session-local **active index** `a ∈ [0, min(len,
N−1)]` (NOT a prop; it is the edit position, meaningless outside a focused session). `N =
this.length`, `len = value.length`, `firstEmpty = min(len, N−1)`.

All editing is control-owned: `beforeinput` on the editor is intercepted (`preventDefault`
unconditionally) and routed, with `keydown` for the non-input keys, through ONE exported pure
reducer (`model.ts`, §4 LLD-C2) — the editor's contenteditable exists to summon the mobile numeric
keyboard, host the SR-readable text, and receive paste/composition; the native caret never edits.

| Action | Transition |
|---|---|
| **Focus** (first-empty rule) | `a = firstEmpty` — typing always fills the first empty cell; a full code focuses the last cell. |
| **Digit `d`** | Overwrite at `a`: `value = value.slice(0,a) + d + value.slice(a+1)` (appends when `a === len`); then auto-advance `a = min(a+1, firstEmpty′)`. Non-digit keys: filtered, no-op, no event. |
| **Backspace** | `value === ''` → no-op. Cell `a` filled → splice it out (`value.slice(0,a) + value.slice(a+1)` — contiguity preserved), `a` stays. Cell `a` empty (`a === len`) → `a −= 1`, then splice out cell `a` (the walk-back). |
| **ArrowLeft / ArrowRight** | `a = max(0, a−1)` / `a = min(a+1, firstEmpty)` — traversal never passes the first empty cell (no gap can be created, so none can be edited). |
| **Home / End** | `a = 0` / `a = firstEmpty`. |
| **Pointer down on cell k** | Focus the editor; `a = min(k, firstEmpty)` (a click past the fill clamps to the first empty cell). |
| **Delete forward / Enter / Escape** | Delete = Backspace's filled-cell arm at `a` (splice, stay). Enter = commit-if-changed (text-field parity). Escape = no-op (no clear-on-escape — a destructive surprise on a code mid-entry). |
| **Composition** (IME) | Suppressed during composition (the text-field guard); `compositionend`'s final text runs through the PASTE path (§5) — a composed numeric string behaves like a partial paste. |

`input` (composed, host) fires after every transition that changed `value`; the completion commit
(§2 Events) fires on the `len < N → len === N` edge. External `value` writes (prop/attribute) pass
through the same normalize step (§5's `normalize`, then truncate to N) and reset `a = firstEmpty`.

## 4 · Components (build slices — one writer per file)

| ID | Component | File(s) | Traces |
|---|---|---|---|
| **LLD-C1** | `UIOneTimeCodeElement` — class, `static props` (§2 Props row), `connected()`: ensure-parts (idempotent, ADR-0014), editor listeners (`beforeinput`/`keydown`/`paste`/`compositionstart`/`compositionend`/`focus`/`blur`), reducer dispatch + `value`/active writes, the composed `input` re-emit + commit baseline, `trackUserInvalid(this, { invalid: () => !this.mergedValidity().valid })`, the ADR-0051 `applyFieldLabelling` part-role override (editor `aria-labelledby`/`aria-describedby` id-wiring; internal message node yields under association — text-field's template, copied not re-derived). `render()` stays the inherited void — no `html\`\`` under the editor, ever (the caret law). | `controls/one-time-code/one-time-code.ts` | decomp a4; §2/§3/§6 |
| **LLD-C2** | The pure edit model — `normalize(text): string` (strip non-digits) and `reduce(state, action): state` implementing §3's table verbatim + §5's paste arm. Zero DOM, exported for direct jsdom unit probes (the fleet's pure-core testing shape). | `controls/one-time-code/model.ts` (co-located) | §3, §5 |
| **LLD-C3** | Cell rendering — N `data-part="cell"` nodes created/adjusted by an effect on `length` (append/remove tail cells; never recreate all), each painted from `value`/active via effects: `textContent = value[i] ?? ''`, `[data-filled]`, `[data-active]` (active AND editor-focused). All cells `aria-hidden="true"` — presentational, the ONE accessible surface is the editor (§6). | `controls/one-time-code/one-time-code.ts` (same writer as C1 — one file, one seat) | §2 Anatomy |
| **LLD-C4** | Geometry + tokens + states CSS — §7's table; the editor overlay (grid-area spanning all tracks, `opacity` on text `0`/`caret-color: transparent`, still focusable/hit-testable); cell states (empty/filled/active/disabled/user-invalid) on the entry family's color roles; forced-colors + `[density]` participation per `interaction-states.md`. | `controls/one-time-code/one-time-code.css` | §7 |
| **LLD-C5** | Descriptor — `one-time-code.md` frontmatter: tag/class/tier `control`/props/events (`input`,`change`)/parts (`editor`,`cell`,`message`)/the geometry row contract. | `controls/one-time-code/one-time-code.md` | §2 |
| **LLD-C6** | The permanent catalog exclusion — `EXCLUSION_ALLOWLIST` entry `['OneTimeCode', 'ADR-0176 cl.3 — PERMANENT exclusion, never catalogue-bound: credential-bearing authentication chrome is host-page-only (security inversion, PRD-D2); the ADR-0112 cl.6 Toast/ToastRegion reasoning applied verbatim.']`. | `a2ui/src/catalog/default/index.test.ts` | §9 |
| **LLD-C7** | Integration trio + site surfaces — `controls/index.ts` barrel, `component-styles.css` `@import`, `package.json` exports subpath; docs doc/demo pages + gallery specimen. | per `agent-ui-component-create` step 8 | §2 Site row |

## 5 · Paste-split (frozen algorithm)

On editor `paste` (and `compositionend`, §3): `digits = normalize(clipboardText)` (strip every
non-digit — separators, whitespace, letters all drop; the "424 242" and "code: 424242" shapes both
land clean).

- `digits === ''` → no-op (no event, no error — a wrong-shaped paste is not user-invalid, it is
  nothing).
- `digits.length ≥ N` → **full-code paste into ANY cell replaces the whole value**:
  `value = digits.slice(0, N)`, `a = N−1`, completion commit fires. (A user pasting a full code
  mid-edit means "use this code", never "splice this in" — the only reading that is never wrong.)
- `digits.length < N` → **partial paste writes forward from the active cell, overwriting**:
  `value = (value.slice(0, a) + digits + value.slice(a + digits.length)).slice(0, N)`, then
  `a = min(a + digits.length, firstEmpty′)`. Contiguity holds by construction (`a ≤ len` always).

`input` fires once per paste (one mutation, not per character); the completion commit fires if the
paste completes the code.

## 6 · A11y — the one-input-vs-N-inputs fork, RULED

**Ruling: ONE focusable editable surface (one `role=textbox`), N presentational `aria-hidden`
cells.** The N-tab-stops alternative (each cell its own textbox, real DOM focus moving cell to
cell) is REJECTED, on mechanics:

1. **Screen-reader shape.** N one-character textboxes are the known-hostile OTP pattern: every
   auto-advance is an unrequested focus steal mid-typing (each one re-announcing "edit text,
   blank"), backspace semantics differ from what was announced, and the user hears six fields
   where the task is one code. One textbox announces once — accessible name from `label`/`ui-field`
   ("One-time code"), role textbox, its text content = the digits entered — and character-level
   review uses the SR's own text navigation. This is also why the platform's own affordance
   (`autocomplete="one-time-code"`) is a single-input hint.
2. **Form/value model.** The committed value is ONE string (decomp: "one string prop"); one
   FACE control = one `ElementInternals`, one `setFormValue`, one validity verdict. N cells as N
   form participants would re-aggregate what the control exists to own.
3. **Focus graph cost.** With one surface, §3's whole graph is a pure reducer over `(value, a)` —
   no roving-tabindex orchestration, no focus-timing races across N elements (the fleet's
   focus-timing flake class), ONE Tab stop in the page order (enter once, leave once — Tab never
   walks the cells; arrows do).
4. **Paste.** One surface = one paste target; §5 is string math. Per-cell paste targets re-open
   the split across N listeners.
5. **Fleet precedent.** The single stable contenteditable surface is text-field's shipped, proven
   machinery (caret guard, IME suppression, composed re-emit) — reuse over invention.

**Announcement shape (frozen):** accname = `label` prop → editor `aria-label`, yielding to
`aria-labelledby` under `ui-field` association (ADR-0051, the accname-precedence rule text-field
already implements); `role=textbox`, `aria-multiline` absent (single line); validity messages via
the `data-part="message"` `aria-describedby` node, yielding to the field's error node under
association (ADR-0014 cl.4 / ADR-0029 A1); the danger treatment is never color-alone (WCAG 1.4.1
— the message node is the non-color signifier). Digits are the editor's literal text content — SRs
read them as entered and navigate them by character.

**Named, accepted tradeoff:** no native `<input>` means no OS-level SMS code autofill (WebOTP /
`autocomplete="one-time-code"` keyboard suggestions bind to native inputs only). This is the
fleet's standing no-native-inputs law, not this control's choice — same tradeoff `type=password`
already carries fleet-wide (no password-manager integration). §5's paste-split is the deliberate
mitigation; reopening native-input access would be a fleet-contract ADR, not an S2-a call (§10).

## 7 · Geometry & tokens

`tier: control`, entry class:

| Token | Source | `md` default |
|---|---|---|
| `--ui-one-time-code-height` | §1-row lookup (ADR-0038), keyed by `[size]` — text-field's rows | 28 |
| `--ui-one-time-code-font` | same row | 14 |
| `--ui-one-time-code-cell-inline-size` | `= height` (square one-glyph entry cell — derived, no new ramp) | 28 |
| `--ui-one-time-code-gap` | `= font/2 ×` density (rhythm family — density rides the gap, never the frame) | 7 |
| cell radius | `--md-sys-shape-corner-base` (entry class — fixed, never `h/2`) | fleet constant |
| cell surface/border/states | the entry family's `--md-sys-color-*` roles, TKT-0062 filled-state law applied per cell | — |

Cell text: `line-height: var(--md-sys-control-line-height)` (= 1), centered (the centering law).
No `min-inline-size` floor token: the host's intrinsic size IS N cells + gaps (a code field is
never bare-unsized the way a text field is — the grid is its own floor). No icon/affordance slots
— no slot-model participation. Every quantity above resolves off the row or a stated derivation:
the geometry trip-wire probe (§11) asserts it.

## 8 · Error / edge handling

- **`length` change mid-entry:** cells adjust (LLD-C3); `value` re-truncates to N; `a` re-clamps.
  A shrink that completes the code fires the completion commit (the edge is still `len === N`).
- **External `value` write:** normalized + truncated, `a = firstEmpty`, NO `input` event (not a
  user edit — native parity), validity recomputes reactively.
- **Disabled / form-disabled:** editor `contenteditable` off + the platform form-disabled channel
  (`effectiveDisabled = own || form`, ADR-0014 dev#b — text-field's exact wiring).
- **Reconnect / zero-residue:** parts persist as light DOM (created once); listeners are
  scope-owned and re-attach; C10 reconnect probe gates it.
- **RTL:** the code is a digit string read left-to-right in RTL contexts too (standard for
  verification codes); the grid sets `direction: ltr` locally — named, deliberate.

## 9 · Catalog posture — permanently excluded

ADR-0176 cl.3 (ratified, not re-litigated): Registration/Authentication surfaces are
host-page-only forever — "a credential-bearing form is at least as security-sensitive as the shell
itself." A one-time-code entry IS the credential-bearing element of the Codes mode, so the control
lands with LLD-C6's PERMANENT `EXCLUSION_ALLOWLIST` entry (the ADR-0087 catalog-or-allowlist gate
satisfied on the exclusion arm; the ADR-0112 cl.6 Toast precedent's entry shape, reason + citation
inline). The `a2ui-basic` catalog needs nothing: its 18-type partition is pinned to the upstream
schema (ADR-0169 cl.9) — a new fleet control never enters that set. No allowlist drain is ever
expected: this is the never-drained class, not the "shipped ahead of its row" class.

## 10 · What this control does NOT do (non-goals)

- **No request/resend/submit wiring, no countdown, no transport import** — S2-a2's Lane-C
  composition (decomp a3/a5) wires this control to SPEC-R2; this control only emits `input`/
  `change`. It never imports `site/lib/identity-mock-transport.ts` (a package control importing
  site code would invert the DAG).
- **No auto-submit** — completion emits `change`; acting on it is the composer's call.
- **No native `<input>`, therefore no WebOTP/SMS autofill** — §6's named tradeoff, fleet law.
- **No alphanumeric mode** — digits only v1 (`inputmode=numeric`, SPEC-R6's own code shape); a
  future additive `mode` prop is the seam if a consumer ever needs letters. Not built now.
- **No masking/secret display** — a one-time code is not a reusable secret; no `type=password`
  treatment.
- **No group separator** (3+3 visual chunking) — uniform gap v1; a cosmetic future option.
- **No `readonly` prop** — `disabled` covers the in-flight-verify lock S2-a2 needs; add-on-demand.
- **No catalog row, ever** (§9) — and no `*.flow.json`/layout card here either (S2-c/S2-d leaves).

## 11 · Probe / test plan

**jsdom (`one-time-code.test.ts`):** LLD-C2's pure reducer probed directly — §3's table row by row
(digit overwrite/advance, backspace both arms, arrow clamps at 0 and firstEmpty, Home/End, the
first-empty focus rule, click clamp) and §5's paste arms (full ≥ N replaces from cell 0; partial
writes forward from `a`; `"424 242"`/`"code: 424242"` normalize clean; all-garbage → no-op) —
the no-gaps invariant asserted after every transition. Control level: `value` normalize/truncate
on external write with no `input` emit; `length` clamp `[1,12]` + mid-entry change (§8);
`input`-per-mutation and the completion `change` (fires exactly once at `len → N`, no blur
double-fire); `required` → `valueMissing`, partial → `tooShort`, complete → valid; `formReset`
baseline; descriptor↔`static props` trip-wire; geometry trip-wire (own `*-DIM` source probe);
naming-gates trip-wire (tag/class/folder/token alignment, zero special-casing).

**Browser (`one-time-code.browser.test.ts` — Chromium + WebKit; ADD to
`vitest.browser.config.ts`'s `FOCUS_TIMING_FILES`, never a new shard — this file is focus-timing
by nature):** the focus-order probe — Tab enters ONCE (a single tab stop; Tab again leaves —
cells are never tab stops), refocus lands the active ring on the first empty cell, real typed
digits auto-advance `[data-active]` cell by cell, backspace walks back, arrows clamp; the paste
probe — a real `ClipboardEvent`+`DataTransfer` paste of a full code into a mid-code active cell
replaces the whole value and fires ONE `input` + the completion `change`, a partial paste writes
forward from the active cell; IME smoke via composition events routed through the paste path;
axe-core zero violations (the one-textbox accname/role shape, §6); forced-colors; C10
zero-residue reconnect; the `[scale]×[size]` geometry smoke (cell `inline = block = height` off
the row, gap `= font/2`, `GEO-LAW` family).

**Visual (`one-time-code.visual.browser.test.ts`):** committed-baseline pixel diff — empty /
partially filled with active ring / complete / disabled / user-invalid — Chromium-only (ADR-0110).

**Catalog gate:** no new probe — LLD-C6's entry keeps `index.test.ts`'s standing coverage +
residue guards green (the exclusion arm IS the gate).

## 12 · Acceptance (inline — the decomp granted no SPEC)

1. §3's reducer table and §5's paste algorithm hold verbatim under the jsdom probes; the no-gaps
   invariant is asserted, not assumed.
2. One tab stop; one `role=textbox`; cells `aria-hidden`; axe-core clean; ARIA via parts +
   internals, zero host `role`/`aria-*` attributes (grep-provable).
3. `input`/`change` are the only events emitted (source-scan `emit(` ⊆ the closed seven);
   completion `change` observed exactly once per completion in the browser leg.
4. Geometry trip-wire green: every rendered quantity resolves off the §1 row or a §7 derivation.
5. `EXCLUSION_ALLOWLIST` carries `OneTimeCode` with the ADR-0176 cl.3 citation; catalog coverage +
   residue gates green with zero catalog rows added.
6. `npm run check && npm test` then `npm run test:browser` — all judged by EXIT CODE.

## 13 · Build sequence

1. `controls/one-time-code/model.ts` (LLD-C2) + its reducer/paste unit probes — the pure core
   ships first.
2. `one-time-code.ts` (LLD-C1/C3) + `one-time-code.css` (LLD-C4) + `one-time-code.md` (LLD-C5) +
   the three test files (§11, incl. the `FOCUS_TIMING_FILES` append).
3. LLD-C7's integration trio + site doc/demo/gallery surfaces (`check:site` green).
4. LLD-C6's exclusion entry.
5. Gates per §12.6 + the standing trip-wires; `npm run size` by hand (new control = bundle-surface
   change, Kim's ruling); `node scripts/generate-llms-full.mjs` (descriptor changed).
6. Independent `component-checker` hand-off (generator ≠ critic; both rubric axes ≥ 4).
7. Only then may S2-a2 (the OTP composition) dispatch against the shipped control (decomp §5's
   `S2-a → S2-a2` edge).

## 14 · Risks / open forks

- **Open forks for Kim: none blocking.** Every ruling above lands inside ADR-0176's grant + the
  decomp's LLD mandate; no fleet contract changes (no new event, state, geometry row, or catalog
  posture beyond the ratified cl.3), so no ADR is earned (default-no held). The **name**
  (`ui-one-time-code` over the docs' working title "code-entry") is this LLD's one
  namespace-entering ruling — cheap to veto at doc review, expensive after build; flagged to Kim
  via the handback, not silently buried.
- **SR announcement granularity** is best-effort beyond the frozen shape (§6): scripted
  `textContent` updates in a textbox announce inconsistently across SR/browser pairs. Mitigation
  if a real SR pass finds it mute: a polite live-region echo inside the message node — an additive
  repair, not a redesign; deliberately NOT pre-built.
- **The invisible-editor overlay** (LLD-C4) is the one genuinely novel CSS piece (text-field's
  editor is its visible surface; ours is transparent over cells). Risk: hit-testing/caret
  artifacts on WebKit. The browser leg runs both engines; if WebKit misbehaves, the fallback is
  positioning the editor as a 1px offscreen-clipped sibling (same listeners, zero model change) —
  an implementation swap inside LLD-C4's own file, pre-authorized here so the builder need not
  escalate for it.
- **`length` clamp `[1,12]`** is a judgment bound (readability + paste sanity), not a contract
  anyone stated — recorded so a future consumer needing 16 knows where the wall is and that
  widening it is a one-line, non-fork change.
- **No `Escape`-to-clear** (§3) is deliberate (destructive surprise); if UX review wants it, it is
  additive.
