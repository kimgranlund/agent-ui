# LLD — `ui-field` + `ui-form-provider` (G7 completion: the labelling seam + the fleet's first context/provider primitive)

> Component LLD for the G7 tail (decomp `g7-field-form-provider.decomp.json`). Trace authority: the
> components layer has no SPEC family — there is no `SPEC-R1` here to trace; components trace to the
> **ADR log + `goals.md` milestones** (the house convention, per `indicator-element.lld.md`). Trace
> targets: **ADR-0050** (accepted — the registration mechanism) · **ADR-0051** (proposed — the labelling
> seam) · `goals.md §G7` · the decomp acceptance rows s1–s14. · proposed · 2026-07-01 · g7-planner
>
> **Composes on:** `UIFormElement` (ADR-0013, `dom/form.ts`) · `trackUserInvalid` (ADR-0014 — the
> controller pattern `form-registry.ts` follows, and the user-invalid timing the field honors) · the
> signals kernel (`signal`/`computed`/scope). · **Layers:** `dom/` (the protocol events + the seam) ·
> `traits/` (the registry controller) · `controls/field/` + `controls/form-provider/` (both extend
> **`UIElement`**, NOT `UIFormElement` — neither carries a form value; wrapping them formAssociated would
> double-submit — and not `UIContainerElement` — no surface paint). Imports stay inward-only.
>
> **Freeze discipline.** §2 (Interfaces) is the contract the C/D-wave fan-out codes against **without
> talking to each other**. A builder who cannot satisfy a frozen interface STOPS and escalates — the fix
> is a coordinated LLD/decomp repair, never a local deviation.

## 1 · Intent

Close goals §G7's two open boxes. `ui-field` is the visible label/description/error wrapper around ONE
slotted form control — labelling rides the ADR-0051 seam, the visible error rides the control's own
user-invalid timing (no second timing source). `ui-form-provider` is the aggregation/coordination layer
over `UIFormElement` descendants — discovery rides the ADR-0050 connect-time registration event (no
MutationObserver), aggregation is computeds over member signals, submit/reset compose with (never
replace) an optional native `<form>`.

## 2 · Interfaces (FROZEN — the fan-out contract)

### LLD-C1 — the protocol events (`dom/form.ts`)

```ts
/** Protocol events — the ADR-0050 `ui-` namespace: base↔provider/field plumbing, OUTSIDE the public
 *  component-event vocab (change·input·select·open·close·toggle). Both composed + bubbling, NOT cancelable
 *  (dispatched directly with `dispatchEvent`, not `this.emit` — emit's cancelable/public shape is for
 *  consumer events). */
export const FORM_CONNECT_EVENT = 'ui-form-connect'
export const FORM_RESET_EVENT = 'ui-form-reset'   // detail: none — the target IS the resetting control

/** The `ui-form-connect` detail. The closures are the control's PUBLIC reactive surface, minted by the
 *  base (ADR-0050 §4 realized without widening the class API): each read, inside a computed/effect,
 *  tracks exactly the signals the underlying hook reads. */
export interface FormConnectDetail {
  control: UIFormElement
  /** The connection-scoped teardown handle — the control's live connection AbortSignal (ADR-0050 §3).
   *  Aborts on disconnect; a NEW signal is minted per connection (reconnect ⇒ fresh handle). */
  signal: AbortSignal
  /** Reactive read of the submission value — closes over the protected `formValue()`. */
  value: () => FormValue
  /** Reactive read of the MERGED validity verdict — `formValidity()` ⊕ `setCustomValidity` (the same
   *  merge the base publishes to internals; extracted into one private method, the single source). */
  validity: () => ValidityResult
  /** Reactive read of the user-invalid gate — closes over the `formUserInvalid()` hook (below).
   *  jsdom cannot match `:state(user-invalid)` (no CustomStateSet), so the field's error gate rides THIS
   *  read; the browser smokes assert its equivalence with `:state(user-invalid)` (same tracker source). */
  userInvalid: () => boolean
}

// on UIFormElement:
/** Upgrade-path catch-up (coordinator-ruled 2026-07-01; ADR-0051 cl.5). PUBLIC re-announce:
 *  re-dispatches `ui-form-connect` iff the CONNECTION SIGNAL is non-null — a LIFECYCLE guard, NOT the
 *  structural `isConnected` (the s9 regression: on a BULK subtree insert, `isConnected` is true for
 *  EVERY descendant BEFORE any connectedCallback runs — callbacks fire ancestor-first — so a structural
 *  guard let the consumer's scan announce controls whose signal was still null and the registry threw
 *  on `detail.signal.aborted`). A same-cascade control needs no catch-up: its own
 *  end-of-connectedCallback dispatch fires moments later, when the consumer is already listening; only
 *  a PRIOR-turn connection (late-define/upgrade — the true catch-up target) has a live signal. No-op
 *  when the signal is null (detached OR mid-cascade); otherwise mints a FRESH detail off the live
 *  signal. Idempotent at every consumer (registry dup guard; field first-wins guard). */
announceFormConnect(): void
```

**Dispatch point:** at the END of `UIFormElement.connectedCallback()` (after `super.connectedCallback()`
— scope + AbortController live, `connected()` has run, parts exist — and after the two form effects
install), so the control announces itself fully wired. Ancestors connect before descendants in every
**insertion** path, so a provider/field listener is live before a descendant dispatches — late-added
controls register by construction (ADR-0050; no MutationObserver).

**Nested-member guard (defect repair, coordinator-ruled 2026-07-02; A2UI patterns-page-caught):** a
`UIFormElement` with a `UIFormElement` ANCESTOR never announces — neither the initial connect dispatch
nor `announceFormConnect()` reaches a listener. Native form controls do not nest as members of each
other; ADR-0050's intent was always to discover form-owning MEMBERS, not every `UIFormElement`-shaped
node regardless of position. `ui-text-field type=date` creates its own internal `<ui-calendar>` (itself a
`UIFormElement`) and appends it INSIDE itself — undetected, a wrapping `ui-form-provider`'s catch-up scan
discovered the calendar as a phantom SECOND member, whose aggregate reads fed back into the field's own
effects and wrote an unbounded loop (the kernel's ~100-wave budget throw). Both dispatch sites route
through the ONE choke point (`#dispatchFormConnect`, `dom/form.ts`) that applies the guard
(`#hasFormElementAncestor`: a `parentElement` walk, O(depth), stops at the first hit) — so it cannot be
bypassed by using one path and not the other. This also correctly covers `ui-radio` nested in
`ui-radio-group` (itself a `UIFormElement`) — the group is the aggregation owner of its own radios, the
same relationship as the calendar's to its text-field.

**The upgrade caveat + catch-up (ADR-0051 cl.5):** custom-element **UPGRADE follows define order, not
tree order** — with pre-existing DOM and granular imports a control can be defined/upgraded BEFORE its
provider/field is, and its connect dispatch lands in the void (no listener yet); the field's
`closest('ui-field')` guard also sees not-yet-upgraded tags (it matches by TAG — see §3). The ruled
complement: the provider (LLD-C7) and the field (LLD-C4) each run a **ONE-SHOT catch-up at their own
connect** — `querySelectorAll('*')`, filter `instanceof UIFormElement`, call `announceFormConnect()` on
each. Un-upgraded controls in the scan are skipped by the instanceof filter and cover themselves: their
own `connectedCallback` dispatches at upgrade, when the consumer is already listening. Both define
orders are closed; this is ADR-0050's upgrade-order complement, NOT a MutationObserver revival.

**`ui-form-reset` dispatch:** `formResetCallback()` becomes: `this.formReset()` **then** dispatch
`FORM_RESET_EVENT` (bubbles, composed). Both reset paths reach it (native `form.reset()` walks its FACE
members' callbacks; the provider's form-less path calls `formResetCallback()` directly).
Provider-less/field-less usage: both events bubble to nobody — **zero drift** (the existing form suite
is the gate). **Gen-3 note (the reactive-rendering re-rule, LLD-C4):** the FIELD no longer consumes
this event — its reset re-suppression rides `tracker.reset()`'s signal write, tracked by the render
effect. **Status: RESERVED** (coordinator-ruled 2026-07-01; the ADR-0031 reserved-arm precedent, per
ADR-0051 cl.4): the dispatch stands as shipped — the s1 `dom/form.test.ts` probes ARE its contract —
with zero fleet consumers today; activation trigger = the first coordination consumer outside the
field family (A2UI's form surface is the named candidate).

### LLD-C2 — the ADR-0051 labelling seam (`dom/form.ts`)

```ts
/** The field-labelling handoff (ADR-0051 cl.1). ELEMENTS, not id strings — the internals path consumes
 *  elements; the id path reads `.id` off the node (the field seeds ids before handing over). */
export interface FieldLabelling {
  label: HTMLElement | null
  description: HTMLElement | null
  error: HTMLElement | null
}

// on UIFormElement:
/** Public — the field calls it; `null` clears. Signal-backed (the setCustomValidity shape); deliberately
 *  NOT a prop (elements can't ride attributes; stays off the attributes-as-API descriptor). */
setFieldLabelling(refs: FieldLabelling | null): void
/** Protected reactive read — a control effect reading it re-runs on association/clear (the yield gate). */
protected get fieldLabelling(): FieldLabelling | null
/** Protected forwarding hook (ADR-0051 cl.2), applied by a base scope-owned effect:
 *  `this.effect(() => this.applyFieldLabelling(this.#fieldLabelling.value))` — installed in
 *  `connectedCallback` BEFORE the connect dispatch. Default = internals ARIA element reflection,
 *  GUARDED on `this.internals.role != null`; feature-detected (jsdom no-op — the tabs
 *  `reflectAriaElements` precedent, a local 4-line copy in form.ts):
 *    role set  → ariaLabelledByElements = refs.label ? [refs.label] : null;
 *                ariaDescribedByElements = [refs.description, refs.error].filter(nonNull) || null
 *    refs null → both reflections = null (clear)
 *    role null → no-op (a part-role control MUST override; half-attachment is banned — ADR-0051).
 *  Contract for overrides: idempotent; handle `null` (clear); handle a not-yet-created part (guard);
 *  and — because this base effect installs AFTER a subclass's `connected()` effects and both react to
 *  the same signal in ONE flush wave with NO documented ordering — **an override's null branch must
 *  only touch attributes it exclusively owns: no dual-writer attribute on the null path** (whoever ran
 *  last would win incidentally, not by invariant). */
protected applyFieldLabelling(refs: FieldLabelling | null): void
/** Protected user-invalid hook — default `false`. A control composing trackUserInvalid overrides it with
 *  its tracker gate (`() => tracker.userInvalid()`), keeping ONE timing source. Feeds detail.userInvalid. */
protected formUserInvalid(): boolean
```

**text-field's wire (the reference override — lands in s1, same writer as form.ts):**

1. `applyFieldLabelling(refs)` override: on the **editor part** — `aria-labelledby = refs?.label?.id`
   (set/remove — `aria-labelledby` is this override's EXCLUSIVE concern, both directions), and when refs
   present `aria-describedby = [description.id, error.id]` (space-joined, present members only); when
   `null`, remove ONLY `aria-labelledby` — **the null branch never touches `aria-describedby`** (on the
   bare path that attribute belongs entirely to the message effect, item 3 — the built s1 truth: the
   earlier literal "remove both" raced the message effect over the same attribute in one flush wave).
2. The existing label effect (`text-field.ts:403`) yields: `aria-label` is set from the `label` prop
   ONLY when `this.fieldLabelling === null` (read inside the effect — reactive; aria-labelledby beats
   aria-label in accname anyway, this keeps the editor clean).
3. The user-invalid/message effect (`text-field.ts:433–451`) yields (ADR-0051 cl.4): when
   `this.fieldLabelling !== null` the internal message node stays empty + `hidden`, and the effect writes
   the editor's `aria-describedby` in **NEITHER branch** (neither set nor remove) — **ownership of that
   attribute transfers to `applyFieldLabelling` only WHILE associated** (so an invalid→valid transition
   cannot strip the external description/error ids); on the null/bare path the message effect is the
   SOLE `aria-describedby` writer — **the labelling side never touches it** (item 1's null branch), so
   each attribute has exactly one writer per direction and the same-flush effect race cannot bite.
   Bare behavior unchanged.
4. `formUserInvalid()` override: `return this.#userInvalid.userInvalid()` (the existing tracker).

### LLD-C3 — the registry controller (`traits/form-registry.ts`)

```ts
import { computed, signal } from '../reactive/index.ts'
import type { ReadonlySignal } from '../reactive/index.ts'
import { UIFormElement, FORM_CONNECT_EVENT } from '../dom/index.ts'          // runtime: instanceof guard
import type { UIElement, FormConnectDetail, FormValue, ValidityResult } from '../dom/index.ts'

export interface FormMember {
  control: UIFormElement
  value: () => FormValue
  validity: () => ValidityResult
}

export interface FormRegistryController {
  /** Live members, registration order (≈ document order for parse/append; a re-slotted control re-enters
   *  at the end — documented, not corrected). */
  members: ReadonlySignal<readonly FormMember[]>
  /** Submission entries — native FormData parity: name ≠ '', not effectiveDisabled(), value() ≠ null;
   *  duplicate names PRESERVED. */
  entries: ReadonlySignal<ReadonlyArray<readonly [string, FormValue]>>
  /** Keyed convenience view of entries — LAST entry wins on a duplicate name (documented). */
  values: ReadonlySignal<Readonly<Record<string, FormValue>>>
  /** Members whose merged verdict is invalid — unnamed controls INCLUDED (native: validation is
   *  name-independent), effectiveDisabled() members EXCLUDED (native: disabled ⇒ barred from
   *  constraint validation). */
  invalid: ReadonlySignal<readonly UIFormElement[]>
  /** invalid().length === 0 */
  valid: ReadonlySignal<boolean>
  /** Idempotent early teardown (the trait contract); otherwise everything dies with the connection. */
  release: () => void
}

/** Invoke from the provider's `connected()` (connection scope + AbortSignal live) — the trackUserInvalid
 *  controller pattern. */
export function formRegistry(host: UIElement): FormRegistryController
```

**Mechanics (pinned):**

- `members` is a plain `signal<readonly FormMember[]>([])`; every add/remove writes a NEW frozen array
  (Object.is cutoff ⇒ fine-grained waking). The four aggregates are `computed`s over it — un-owned is
  correct: a computed's subscriptions live only while a reading effect subscribes, so residue dies with
  the readers (kernel semantics); the `members` listener rides `host.listen` (the connection signal).
- The connect listener: `host.listen(host, FORM_CONNECT_EVENT, onConnect)` where `onConnect`:
  1. `detail = (e as CustomEvent<FormConnectDetail>).detail`; **guard** `detail?.control instanceof
     UIFormElement` — else return (never registers a non-form child; the event never fires from one, the
     guard is defense).
  2. `e.stopPropagation()` — nearest-provider scoping (ADR-0050 §2). Stopped even for a dup/aborted
     registration (the event was addressed to this provider).
  3. guards: `detail.signal.aborted` → return; already-registered control → return (impossible by
     construction — one dispatch per connect — kept as an idempotence guard).
  4. append `{ control, value, validity }`; then
     `host.listen(detail.signal, 'abort', () => remove(control), { once: true })` — **dual-lifetime**:
     control disconnect aborts ⇒ removed; provider disconnect aborts the HOST signal ⇒ this listener
     itself is removed (no residue on a still-connected control's signal).
- `release()`: sets a `released` flag the handlers check + empties `members` — idempotent.

### LLD-C4 — `UIFieldElement` (`controls/field/field.ts`)

```ts
const props = {
  label: prop.string(),        // the visible label text → [data-part=label] (reflect: false — text-field precedent)
  description: prop.string(),  // the visible description text → [data-part=description] (reflect: false)
} satisfies PropsSchema
export interface UIFieldElement extends ReactiveProps<typeof props> {}
export class UIFieldElement extends UIElement { static props = props; … }
customElements.get('ui-field') ?? customElements.define('ui-field', UIFieldElement)
```

- **Parts (control-owned, created ONCE in `connected()`, idempotent, light-DOM children that persist
  through disconnect — the text-field editor precedent):** `[data-part=label]` (a `<div>` — NOT a
  `<label>`: no `for` semantics apply, and a bare `<label>` invites click-forwarding expectations the
  seam doesn't need), `[data-part=description]`, `[data-part=error]`. DOM placement IS the reading
  order: label **prepended**, description + error **appended** (author children sit between) — column
  flow needs no CSS `order`. Ids seeded from a module-level sequence (`ui-field-label-N` /
  `-description-N` / `-error-N`; the `messageSeq` precedent). `error` starts `hidden` + empty.
- **Association (event-driven, the LLD-C1 event doing double duty):**
  `this.listen(this, FORM_CONNECT_EVENT, onConnect)` — the field does **NOT** `stopPropagation` (the
  event must continue up to the provider). Accept iff: detail valid ∧
  `detail.control.closest('ui-field') === this` (the nearest-field rule — also rejects a deeper nested
  field's control) ∧ no control associated yet (**first-wins**; a second form control in one field stays
  un-associated but still provider-registers; the descriptor documents ONE control per field).
  On accept: store `#assoc = detail`; call
  `detail.control.setFieldLabelling({ label, description, error })`; arm the bridge (below); listen
  `this.listen(detail.signal, 'abort', () => this.#dissociate(), { once: true })` (control removed ⇒
  clear). `#dissociate()`: **early-return iff `#assoc === null`** (idempotence insurance — TWO caller
  paths reach it: the control-abort listener and the field-disconnect hook); then dispose the RENDER
  effect (`#renderDispose` — the reactive error rendering below) and the bridge
  effect (below), `control.setFieldLabelling(null)` (safe on
  a detached node — a plain signal write), clear `#assoc`, empty + hide the error node, drop the field
  state — then, **iff `this.isConnected`** (dissociation by control removal, not field teardown), re-run
  the one-shot catch-up scan so a second, still-slotted control can associate next (first-wins is
  per-tenure, not forever; rides `announceFormConnect`). In the disconnect path the re-scan is skipped —
  re-associating from a field being removed would mint labelling refs into a detached subtree.
- **Upgrade-path catch-up at connect (LLD-C1 / ADR-0051 cl.5):** in `connected()`, AFTER the listeners
  install: one-shot `querySelectorAll('*')` → `instanceof UIFormElement` → `announceFormConnect()`. This
  is how a field defined/upgraded AFTER its slotted control still associates it.
- **On field disconnect** (`disconnected()`, resources still live): `#dissociate()` — a field removed
  from around its control must not leave stale labelling behind.
- **The option-A bridge (ADR-0051 cl.3):** at association, if the control is NOT covered by the seam
  (no internals role AND no override — not detectable directly, so the bridge is applied by the simpler
  pinned rule: control has a string `label` prop whose value is `''`), install a scope-owned effect and
  **STORE ITS DISPOSER** (`#bridgeDispose = this.effect(() => { control.label = this.label })` — tracks
  the field's `label` prop) plus a bridge-owned flag. `#dissociate()` **calls the disposer** — a
  scope-owned effect otherwise outlives dissociation and keeps writing a removed control's label — and
  clears `control.label = ''` **iff bridge-owned** (the bridge wrote it; a consumer-set label is never
  touched, arriving or leaving). Never arms when the consumer pre-set the control's label. Wired
  controls tolerate it (labelledby wins accname).
- **Error rendering (REACTIVE — a scope-owned effect over the association detail's reactive closures;
  decomp `fld-observe`; NO effect over control internals, NO second timing source):** at `#associate`,
  install a scope-owned effect (disposer stored as `#renderDispose`, disposed at `#dissociate` — the
  bridge pattern) reading `#assoc.userInvalid()` + `#assoc.validity()` — the ADR-0050 §4 reactive
  surface the provider already aggregates through:

  ```
  // the render effect (installed at #associate, disposed at #dissociate)
  verdict = #assoc.validity()
  showing = #assoc.userInvalid() && !verdict.valid && verdict.message !== ''
  error.textContent = showing ? verdict.message : ''   // verdict.message ≡ control.validationMessage,
  error.hidden = !showing                              //   but TRACKED (an internals read tracks nothing)
  internals.states?.add/delete('user-invalid')         // optional-chained — jsdom lacks CustomStateSet
  ```

  NO event listeners, NO scheduler: every trigger is signal-tracked — the tracker's `interacted` flip
  (blur/change at the control), the validity deps (the props `formValidity()` reads), the
  `setCustomValidity` signal, and reset (BOTH reset paths end in `tracker.reset()`'s signal write).
  Kernel flush batching replaces any hand-rolled coalescing.

  **Why reactive — the three-generation history (load-bearing knowledge; do not re-walk it):**
  1. *Event-driven listeners, synchronous render* (gen 1) — blur/invalid must ride capture (they don't
     bubble), and capture fires ANCESTOR-FIRST: the field read `userInvalid()` BEFORE the control's
     deeper capture listener (`trackUserInvalid`) flipped `interacted` — one plain blur on an untouched
     required control never showed the field error while the control's own danger treatment did.
  2. *One-microtask deferred, coalesced render* (gen 2) — held under SCRIPTED dispatch (jsdom + every
     probe: `dispatchEvent` keeps the JS stack live through the whole propagation) but FAILED under
     real UA-driven dispatch, proven by s11's framework-free cross-engine repro: **the spec runs a
     microtask checkpoint BETWEEN capture listeners** (each UA-invoked listener return empties the
     stack), so the deferred read ran before the deeper tracker listener — and **no microtask-hop
     count survives a UA checkpoint** (the queue drains fully at each one). Scripted-dispatch probes
     structurally CANNOT catch this class.
  3. *Reactive effect over the seam's closures* (gen 3, coordinator-RULED) — two ordering bugs from one
     smell meant the event-driven OBSERVATION design was the root cause: the render now depends on
     signal VALUES, never on listener ordering, dispatch phase, or task timing.

  Scope note: only the five OBSERVATION listeners (`input`/`change`/`blur`/`invalid`/`ui-form-reset`)
  and the gen-2 scheduler are DELETED — the association/registration listeners (`ui-form-connect`, the
  abort handle) are the ADR-0050 protocol and remain event-driven.

  The gate rides `detail.userInvalid()` (LLD-C1) because jsdom cannot `matches(':state(user-invalid)')`;
  the s11 browser smoke asserts the equivalence (`error visible ⟺ control.matches(':state(user-invalid)')`
  — same tracker source, decomp s2's observable holds verbatim in the engines).
- **required/disabled affordances:** pure CSS off the control's REFLECTED attrs —
  `:has([required])` / `:has([disabled])` (LLD-C5). No field-side state duplication.
- **Host:** no role, no `aria-*` (a structural wrapper; `internals.role` stays unset — the column
  precedent). The only internals use is the `user-invalid` custom state (a CSS hook).

### LLD-C5 — `field.css` (single sheet, ADR-0003)

- `:where(ui-field)` token block (§-sectioned like text-field.css):
  `--ui-field-gap: var(--ui-space-xs)` (label↔control↔description rhythm — layout spacing, density-bearing) ·
  `--ui-field-label-ink: var(--md-sys-color-neutral-on-surface)` · `--ui-field-label-font: var(--ui-font-md)` ·
  `--ui-field-label-weight: 500` ·
  `--ui-field-description-ink: var(--md-sys-color-neutral-on-surface-variant)` (the muted on-surface variant) ·
  `--ui-field-description-font: var(--ui-font-sm)` ·
  `--ui-field-error-ink: var(--md-sys-color-danger)` · `--ui-field-error-font: var(--ui-font-sm)`
  (= the text-field message tokens — one visual voice for the ONE error).
- `@scope (ui-field)` consumes ONLY `--ui-field-*`: host `display: flex; flex-direction: column;
  row-gap: var(--ui-field-gap); min-inline-size: 0` (the slotted control brings its own ADR-0021 floor —
  the field adds none). Parts styled by `[data-part=…]`.
- Error visibility: `[data-part=error]` default `display: none`; shown via
  `:scope:state(user-invalid) [data-part=error]` **plus** the explicit guard
  `:scope [data-part=error][hidden] { display: none }` written **AFTER the state rule** — both compute
  specificity (0,3,0), so source order decides and the `hidden` guard must win (the `hidden` attr is the
  jsdom-visible switch; the state is the styling hook).
- required/disabled affordances: `:scope:has([required]) [data-part=label]::after { content: " *";
  color: var(--ui-field-error-ink) }` · `:scope:has([disabled])` repoints label/description ink to the
  muted variant (role REPOINT, not opacity — tokens.md).
- **Geometry class: Container/layout** (the decomp's "STRUCTURE" intent — no control height anywhere;
  spacing off `--ui-space-*` × density; label/description/error ride font tokens). No `[size]` prop/ramp.
- Motion: error appearance = an unconditional small transition (the INDICATOR family pattern — no
  `:state(ready)` gate; the error can never show at first paint because user-invalid is
  interaction-gated) + `@media (prefers-reduced-motion: reduce)` zeroes it.
- Forced-colors: label/description/error inks stay CanvasText (no `forced-color-adjust: none` — these
  are real text, not decorative glyphs); the error remains distinguishable by presence, not color alone
  (WCAG 1.4.1 — the text IS the cue).

### LLD-C6 — `field.md` (descriptor + /site body)

Frontmatter pins: `tag: ui-field` · `tier: container` (the radio-group precedent — "not a sized control";
comment: no control height, label rides the font/type tokens, spacing off `--ui-space`) ·
`extends: UIElement` · `attributes:` = exactly the two props (`label`, `description`, both
`reflect: false`) · `slots:` the default slot (ONE form control; extra element children are permitted
static content) · `parts:` label/description/error (ids control-seeded, the ADR-0051 handoff) ·
`customStates:` `user-invalid` (mirrors the associated control) · `aria:` `role: none` /
`roleSource: none` / `labelSource:` "the field's label part → the control's role-carrying part via the
ADR-0051 seam (internals reflection or part id-refs); bridge = the control's `label` prop" /
`describedBy:` "description + error part ids join the control's accessible description; the control's
internal message yields — ONE announced error" · `events:` none emitted (the field only listens).
Body: association model, first-wins single-control contract, the bridge's lossiness, the error timing —
**and the error-leg limitation (F4):** the visible error requires the control to wire
`formUserInvalid()` (one tracker source); at G7 only text-field does — an invalid indicator/range/select
member shows no field error (consistent: it exposes no `:state(user-invalid)` either). Per-control error
legs are the LLD-C9 follow-ups.
**Same slice repairs `text-field.md`:** the two "the visible label/description/error wrapper is ui-field
at G7" notes (frontmatter `label` comment + `labelSource` + §"Validity & accessibility") now point at
`controls/field/field.md` as SHIPPED, and `labelSource` records the seam override (s4's writer owns both
files; no other slice touches text-field.md).

### LLD-C7 — `UIFormProviderElement` (`controls/form-provider/form-provider.ts`)

```ts
export class UIFormProviderElement extends UIElement {
  // The EMPTY schema — a coordination element takes no configuration, declared explicitly
  // (coordinator-ruled, s10 finding): every other control in the fleet declares the field (an absent
  // table would make form-provider the lone outlier), and the s10 compareDescriptorToProps trip-wire
  // compares against a LIVE schema object — kept strict on absence so it catches real future omissions.
  // (Descriptor: attributes: [] — s7/s10 builders: verify parseDescriptor accepts the empty inline
  // sequence; if not, escalate, don't invent a prop.)
  static props = {} satisfies PropsSchema
  #registry: FormRegistryController | null = null       // created in connected(), nulled in disconnected()

  get controls(): readonly UIFormElement[]              // registry.members → controls (reactive read; [] when disconnected)
  entries(): ReadonlyArray<readonly [string, FormValue]> // registry.entries.value ([] disconnected)
  values(): Readonly<Record<string, FormValue>>          // registry.values.value ({} disconnected)
  invalid(): readonly UIFormElement[]                    // ([] disconnected)
  valid(): boolean                                       // (true disconnected — vacuous)
  submit(): boolean
  reset(): void
}
customElements.get('ui-form-provider') ?? customElements.define('ui-form-provider', UIFormProviderElement)
```

- **Upgrade-path catch-up at connect (LLD-C1 / ADR-0051 cl.5):** in `connected()`, AFTER `#registry =
  formRegistry(this)` installs its listener: one-shot `querySelectorAll('*')` → `instanceof
  UIFormElement` → `announceFormConnect()`. This is how a provider defined/upgraded AFTER its descendant
  controls still discovers them; the registry dup guard makes it idempotent.
- **`submit()`:** **the disconnected check PRECEDES the validity check** (coordinator-ruled, s9): if
  `#registry === null` → return `false`, no `reportValidity()`, no emit — this ordering is load-bearing
  because `valid()` is vacuously `true` while disconnected (a READ degrades gracefully; an ACTION
  refuses), so composing submit off `valid()` first would route a disconnected call to success+emit.
  Then: if `!valid()` → `reportValidity()` on the FIRST invalid member (registration order —
  native "focus the first invalid control" parity; the UA anchors/announces) and return `false`, no
  event. Else `this.emit('change', { entries: entries(), values: values() } satisfies FormSubmitDetail)`
  and return `true`. **Event naming (pinned; reviewer-verified sufficient):** `change` — the closed
  house vocab has no `submit`, a provider-level submit IS a commit semantically, and decomp s7 pins the
  house vocab. Disambiguation is documented in `form-provider.md`: member `change` events bubble THROUGH
  the provider with `detail: null`; the provider's own carries the aggregate detail and
  `event.target === provider`.

  ```ts
  export interface FormSubmitDetail {
    entries: ReadonlyArray<readonly [string, FormValue]>
    values: Readonly<Record<string, FormValue>>
  }
  ```
- **`reset()` (native composition — decomp `provider_and_native_form`):** partition members by their
  public `.form`: for each DISTINCT non-null owning `<form>` call `form.reset()` ONCE (the platform walks
  its FACE members' `formResetCallback`s — no double-reset); for form-less members call
  `member.formResetCallback()` directly (public platform callback). Both paths end in `formReset()` +
  tracker reset (no post-reset danger flash — the tracker's signal write is what re-suppresses field
  errors under the LLD-C4 reactive rendering; the LLD-C1 `ui-form-reset` dispatch also fires —
  RESERVED, zero consumers today).
- The provider never creates or intercepts a native `<form>`; native submission rides the platform
  (FACE `setFormValue`). A2UI's checks/submit surface is an integration POINT only (out of scope).
- **Nesting:** the registry's `stopPropagation` scopes membership to the nearest provider (jsdom
  negative control in s9).

### LLD-C8 — `form-provider.css` + `form-provider.md`

- `form-provider.css`: single sheet, full §-discipline at minimal size (the token-hygiene probes don't
  special-case it): `:where(ui-form-provider) { display: block }` — no paint, no tokens declared (an
  empty `--ui-form-provider-*` block is NOT invented; the sheet documents the deliberate absence).
- `form-provider.md`: `tag`/`tier: container` (comment: pure coordination, no geometry)/`extends:
  UIElement` · `attributes: []` · `events:` the `change` submit surface (detail = `FormSubmitDetail`;
  the target-check disambiguation) · a `protocol:`-documenting body section: `ui-form-connect` (named as
  ADR-0050 plumbing, NOT a consumer event), nearest-provider nesting, teardown-by-abort, the
  native-`<form>` composition rule, and `ui-form-reset`.

### LLD-C9 — the per-control forwarding inventory (ADR-0051 cl.2 realized; two axes)

The seam has TWO per-control axes: the NAME/description path (`applyFieldLabelling`) and the ERROR leg
(`formUserInvalid()` — default `false`; only a control composing `trackUserInvalid` can wire it, and at
G7 only text-field does).

| Control | Role carrier | NAME path | ERROR leg (`formUserInvalid`) | When |
|---|---|---|---|---|
| checkbox · switch · radio · slider · slider-multi | `internals.role` | base default (guarded reflection) — **free** | not wired (no trackUserInvalid) — follow-up | name: this wave (nothing to write) |
| calendar | **grid role is a PART attribute** (not `internals.role`) — the grid part already carries a self-`aria-labelledby` to its month header | **override needed** — must **MERGE** (append the field label ref to the existing `aria-labelledby`, never clobber the month-header ref) | not wired — follow-up | flagged follow-up — NOT this wave |
| **text-field** | editor part (`role=textbox`) | **override** (LLD-C2 wire) | **wired** (tracker override, LLD-C2 §wire 4) | **s1, this wave** |
| combo-box | editor part (`role=combobox`) | override (same pattern as text-field) | follow-up | flagged follow-up — NOT this wave |
| select | trigger `<button>` part (host role none) | override (trigger `aria-labelledby`) | follow-up | flagged follow-up — NOT this wave; no `label` prop ⇒ bridge inert; its trigger-text name stands in (s13 keyboard e2e unaffected) |

## 3 · Error / edge enumeration (L5 — per component, with handling)

**Protocol / base (LLD-C1/C2):**

- **No provider above** → `ui-form-connect` bubbles to nobody; **no field** → labelling stays `null`
  (aria-label path unchanged). Zero drift; the existing form suite is the gate.
- **Reconnect** → a fresh AbortSignal per connection; the registry guards `signal.aborted` so a stale
  handle can never register. Re-dispatch on reconnect re-registers/re-associates by construction.
- **Reparenting (incl. between providers/fields)** → disconnect+reconnect (the house defines no
  `connectedMoveCallback`): abort removes from A, the new dispatch registers with B.
- **Upgrade order (define order ≠ tree order)** → a control upgraded before its provider/field dispatches
  into the void; closed by the LLD-C1 catch-up (`announceFormConnect` + the one-shot consumer scans);
  a control upgraded AFTER the consumer covers itself (its own connect dispatch). Idempotent both ways
  (dup/first-wins guards).
- **Un-upgraded inner `ui-field`** → `closest('ui-field')` matches by TAG, so an outer upgraded field
  correctly REFUSES a control sitting inside a not-yet-upgraded inner field (the guard returns the inner
  element); the inner field associates it via its own catch-up at upgrade. No steal, no loss.
- **Bulk subtree insert (same-cascade connect ordering — the third leg beside upgrade-order and
  reconnect)** → on one insert of a provider/field subtree, `isConnected` is true for EVERY descendant
  BEFORE any connectedCallback runs (callbacks fire ancestor-first), so the consumer's catch-up scan
  reaches controls whose connection signal is still null — `announceFormConnect`'s SIGNAL guard no-ops
  them (a structural `isConnected` guard announced null handles and the registry threw — the s9 crash);
  each same-cascade control self-covers via its own end-of-connectedCallback dispatch moments later,
  when the consumer is already listening.
- **Nested `UIFormElement` (defect repair, coordinator-ruled 2026-07-02)** → a `UIFormElement` with a
  `UIFormElement` ANCESTOR never announces (neither dispatch site) — it is an INTERNAL PART of that
  ancestor's own submission graph, never a registry/field member. Closes the `ui-text-field type=date` ↔
  its internal `<ui-calendar>` phantom-member write-loop (a provider aggregating BOTH as separate members
  fed back into the field's own effects, tripping the kernel's ~100-wave budget); also correctly covers
  `ui-radio` inside `ui-radio-group` (the group is the aggregation owner of its own radios). Negative
  control: an ordinary (non-`UIFormElement`) ancestor never suppresses the dispatch (s1 `dom/form.test.ts`).
- **Editor part not yet created when the labelling effect first runs** → cannot happen for text-field
  (parts are created in `connected()`, the effect installs after), but every override guards a null part
  (contract in LLD-C2).
- **`setFieldLabelling` on a disconnected control** → a plain signal write; **no LIVE state carries
  stale labelling** — the stale part attributes on the detached editor are inert (a detached node is
  AX-inert) and are cleared by the apply effect's **INSTALL-RUN at the next connect** (ANY reconnect —
  bare or fielded). Teardown-time DOM cleanup via the dying control's own scope-owned effects is
  IMPOSSIBLE by kernel teardown order (scope dispose precedes the abort that triggers dissociation —
  the G1/G2 law) and UNNECESSARY (inert while detached) — deliberately not depended on. (Contrast the
  FIELD-disconnect dissociation path: the control stays attached with live effects, so the null-apply
  cleans the editor on the next flush.) Probe spec: the §4 s8 dissociation rows — kept in lockstep
  with this row.

**Registry (LLD-C3):**

- **Empty provider** → `entries []` / `values {}` / `invalid []` / `valid true`; `submit()` emits an
  empty aggregate (documented; vacuously valid).
- **Duplicate names** → `entries` preserves both (FormData parity); `values` last-wins (documented).
- **Unnamed control (`name === ''`)** → excluded from `entries`/`values`, INCLUDED in validity.
- **`effectiveDisabled()` member** → excluded from `entries` AND validity (native parity) — reactive:
  the fieldset-disabled channel is a signal, so the aggregates re-fire on it.
- **Non-`UIFormElement` child** → never dispatches; the instanceof guard is defense-only (s9 negative
  control).
- **Nested providers** → `stopPropagation` at the nearest; the outer never sees the inner's members
  (s9 negative control). Sibling providers scope their own subtrees by bubbling alone.
- **Provider disconnects with live members** → host signal aborts: the connect listener AND every
  per-member abort listener die (they ride `host.listen`); computeds lose their last readers with the
  scope. Members keep their native form association untouched. Zero residue (`inspect` + signal checks).
- **Provider disconnected, methods called** → empty snapshots (`#registry === null` branch);
  `submit()` → `false`, no emit (its disconnected guard PRECEDES the validity check — the vacuously-true
  `valid()` read never routes a disconnected submit to success+emit; LLD-C7).
- **Shared-form reset blast radius (m1)** → `reset()` delegates to each distinct owning `form.reset()`,
  which resets ALL of that form's controls — including non-members outside the provider (native
  semantics: reset is form-scoped, not provider-scoped). Documented in `form-provider.md`, not
  "corrected": narrowing it would fork native behavior.

**Field (LLD-C4/C5):**

- **No slotted control** → parts render, error hidden, no association; the bridge never arms.
- **Two controls in one field** → first-wins association; the second still provider-registers
  (documented single-control contract). **After dissociation while the field stays connected (m3)** →
  first-wins is per-tenure: `#dissociate()` re-runs the catch-up scan, so the remaining control
  associates next (LLD-C4); in the field-disconnect path the re-scan is skipped.
- **Error leg is text-field-only this wave (F4)** → `formUserInvalid()` defaults `false` and only
  text-field composes `trackUserInvalid`, so an invalid indicator/range/select member shows NO field
  error — consistent with its absent `:state(user-invalid)`; per-control error legs are the LLD-C9
  follow-ups. The s13 error assertion is pinned to the text-field field (§4).
- **Nested fields** → `closest('ui-field')` rule: the inner field associates; the outer ignores.
- **Late-slotted control** → its connect dispatch passes the field → association by construction.
- **Control removed from the field** → `detail.signal` abort → `#dissociate()` (labelling cleared,
  error emptied, state dropped). **Field itself removed** → `disconnected()` runs `#dissociate()` while
  resources are live.
- **`label`/`description` prop changes while associated** → the render updates part text; the part
  ELEMENTS (and ids) are stable — no re-handoff needed.
- **Empty `validationMessage` while user-invalid** → treated as not-showing (guard in
  `#renderValidity`) — no empty-but-visible error box.
- **Single blur on an untouched required control (the canonical tab-through case)** → the FIRST plain
  blur must reveal the field error, in step with the control's own danger treatment — not the second.
  Closed BY DESIGN by the reactive render effect (LLD-C4 gen 3): the tracker's `interacted` flip is a
  tracked signal write, so the render re-runs regardless of listener ordering, dispatch phase (scripted
  vs UA-driven), or task timing — the class of bug the gen-1/gen-2 event mechanisms carried is
  unreachable.
- **Submit attempt with an untouched invalid member** → provider returns false + `reportValidity()`
  (UA focuses/announces); the FIELD error appears on the user's next interaction — the user-invalid law
  (decomp s2) is not widened. Native `:user-invalid`-after-submission parity is a flagged FUTURE
  trackUserInvalid extension, deliberately not built here.
- **Reset** → both reset paths end in `tracker.reset()`'s signal write → the render effect re-runs:
  gate false ⇒ error cleared + re-suppressed (no `ui-form-reset` consumption — LLD-C1 gen-3 note).
  Mid-IME reset semantics stay control-owned.
- **Forced-colors** → label/description/error stay CanvasText; error presence (text) is the cue, not
  color. **Reduced-motion** → transition zeroed. **Whole-shape (s11)** — a labelled field with an
  error renders a plausible stacked bounding box in a realistic flex container (test-the-whole-shape:
  the field is content-sized; its control brings the ADR-0021 width floor).

## 4 · Verification map (what proves what, where)

- **s8 `field.test.ts` (jsdom):** association via the passed-through connect event (editor
  `aria-labelledby` = the field label id — the text-field wire); late-slotted association; the
  pre-interaction negative control (invalid-but-untouched ⇒ error node empty+hidden); error shows
  post-blur via the `userInvalid()` gate and clears when fixed — the pinned assertion: **ONE untouched
  blur reveals** (a single plain blur on an untouched required control shows the error after the kernel
  flush — retained as the ordering-regression probe, closed by design under LLD-C4's reactive render); ONE message-bearing node (internal
  message empty+hidden under association — the stitching probe); reset re-suppression BEHAVIOR-asserted
  on both paths (a real `<form>` reset and a direct `formResetCallback()` — rides `tracker.reset()`'s
  signal write, no event consumption); **describedby
  retention (F3):** after an invalid→valid fix the editor's `aria-describedby` still carries the
  description + error ids (only the error TEXT empties — static membership, LLD-C2 §wire 3);
  **dissociation on control removal (corrected to §3's detached-inert design — these rows are that
  row's probe side, kept in lockstep):** associate → interact-invalid → remove the control → assert
  FIELD-side cleanup (error node emptied + hidden, field state dropped) and the signal-cleared contract
  (the labelling signal is `null` — the next install-run applies it); the stale external ids on the
  DETACHED editor are documented-inert — an optional, COMMENTED assertion only, never a requirement
  (no live effect can clear them: kernel teardown disposes the scope before the abort that triggers
  dissociation, and a detached node is AX-inert — asserting their absence would contradict the
  teardown order); **the reconnect leg (where DOM restoration IS asserted):** re-append the control
  BARE → flush → the apply effect's install-run clears the stale external ids; then — the tracker
  re-arms fresh on reconnect (`interacted = false`), so the probe follows shipped behavior — after a
  NEW blur-invalid interaction, `editor.getAttribute('aria-describedby') === message.id` and the
  message node carries the validity text (the internal path RESTORED). This reconnect probe is the one
  transition the existing text-field suite cannot catch (it never calls `setFieldLabelling`);
  field-disconnect zero residue, **including the bridge disposer
  (F5):** post-dissociation a field-label write no longer reaches the removed control, and a
  bridge-owned label was cleared (consumer-set: untouched — both prop-level assertions, valid on a
  detached node); **post-dissociation re-association (m3):**
  a remaining second control associates next; the bridge (empty control label populated; consumer-set
  label untouched); **upgrade-order (F1):** a dedicated late-define probe file builds the field+control
  DOM FIRST, then dynamically imports the barrel (vitest per-file isolation makes define-after-DOM
  deterministic) and asserts the catch-up associates; `@ts-expect-error` negative control = a non-string
  assigned to `label` (the field has no enum prop — the decomp's "literal-union" clause is N/A,
  recorded here).
- **s9 `form-provider.test.ts` (jsdom):** discovery at connect + late-added + removed-leaves-aggregate;
  the reactivity proof (an effect over `values()` re-runs on a member's value write); duplicate-name,
  unnamed, disabled aggregate rules; `submit()` valid/invalid legs (+ no-emit on invalid); `reset()`
  both partitions; nested/nearest + non-form-child negative controls; disconnect zero residue;
  **`announceFormConnect` semantics (F1):** re-dispatch on a registered control keeps the registry at
  ONE entry (dup guard — call it twice, `members` length stable), and it is a no-op whenever the
  connection signal is not live (detached control, or mid-cascade before its own connect); **the
  bulk-insert REGRESSION leg (the s9 crash):** appending a provider subtree WITH its descendant
  controls in ONE insert throws nothing — the scan no-ops the same-cascade controls (null signal) and
  every control still ends registered via its own connect dispatch (`members` complete); plus a
  dedicated late-define probe file (DOM first, dynamic barrel import — vitest per-file
  isolation) proving a provider defined AFTER its descendant controls discovers them via the catch-up.
- **s10 descriptor trip-wires:** both frontmatters validate; `attributes[] ≡ finalize(class)` bijection
  (field: 2; provider: 0 — verify the parser's empty-sequence handling); planted-drift negative control.
- **s11 browser smokes (Chromium AND WebKit):** the AX read-back — field label text is the accessible
  name on text-field's editor AND on a checkbox (internals reflection — the path jsdom cannot see); the
  `:state(user-invalid)` ⟺ visible-error equivalence; **the UA-GESTURE first-blur regression (the
  gen-2 killer, LLD-C4):** a REAL Tab-away blur reveals the field error on the FIRST blur in both
  engines — load-bearing and browser-ONLY (scripted dispatch holds the JS stack through the whole
  propagation, so jsdom probes structurally cannot exercise the UA microtask checkpoint); error
  survives forced-colors; the provider aggregate tracks a real typed input; the whole-shape box.
- **s13 e2e (browser, keyboard-only):** the G7 DoD form — button + text-field + checkbox + switch +
  select in fields under one provider; Tab traversal, per-control keyboard operation, error
  show/fix/clear **asserted on the TEXT-FIELD field** (the one wired error leg this wave — F4/LLD-C9),
  aggregate round-trip, submit + reset. (Select's accessible name rides its trigger text until its
  follow-up wire — LLD-C9.)

## 5 · Build sequence (waves ↔ decomp slices, with freeze points)

1. **s1 (B-prep, SERIAL — one writer):** `dom/form.ts` (LLD-C1 events + dispatches +
   `announceFormConnect`, LLD-C2 seam) + `traits/form-registry.ts` (LLD-C3) + the text-field wire
   (LLD-C2 §wire; `text-field.ts` only) + the barrel exports (`dom/index.ts`) with the D7
   exhaustive-surface trip-wire ack (`dom/dom-surface.test.ts` — mechanical, the pinned-surface list
   grows) + zero-drift run of the whole existing suite. **FREEZE POINT α on green:** every §2 export — names,
   types, semantics — is locked; C/D-wave builders code against this document, not the diff.
2. **C-wave (fan-out, file-disjoint):** s2 `field.ts` (LLD-C4) ∥ s3 `field.css` (LLD-C5) ∥ s4 `field.md`
   + the `text-field.md` repair (LLD-C6) ∥ s5 `form-provider.ts` (LLD-C7) ∥ s6 `form-provider.css` ∥
   s7 `form-provider.md` (LLD-C8). Part names / token names / event detail shapes are already frozen
   above so .ts/.css/.md builders never negotiate.
3. **D-wave (fan-out):** s8 ∥ s9 ∥ s10 ∥ s11 per §4 — ∥ s15 (the /site doc+demo pages + both TOCs;
   decomp s15, docs-writer seat — drift-gated by site-coverage/site-toc/check:site, derived from the
   s4/s7 descriptors; outside this LLD's component scope).
4. **s12 (E, the LONE shared-tree slice):** barrels (`traits/index.ts` + `controls/index.ts`) ·
   `component-styles.css` @imports · fleet-enumerating tests (site-coverage / descriptor-source) ·
   `npm run size` (manual). **Tree-shake pins:** `field.ts` imports dom ONLY (never the registry, never
   the provider); `form-provider.ts` imports dom + `traits/form-registry.ts`; neither imports the other
   → importing one must not drag the other. **Budget risk (flagged):** family barrel = 19 889 B gz of
   22 528 (ADR-0049) — headroom 2 639 B for BOTH marginals + the form.ts growth; if exceeded, that is a
   budget re-base ADR (the 0040/0049 pattern), NOT a silent trim.
5. **s13 (F)** the DoD e2e → **s14 (G)** component-reviewer (COMPOSE ≥4 ∧ REALIZE ≥4, zero gate fails,
   BEFORE the wave commit) + goals §G7 flip + ADR-0051 ratification by the orchestrator.

## 6 · New-ADR flags

- **ADR-0051** (this design's owning decision, incl. the cl.5 upgrade-path catch-up) — proposed;
  ratifies on the s14 green gate.
- **Flagged, NOT opened:** native `:user-invalid`-after-submission parity in `trackUserInvalid` (§3) ·
  the LLD-C9 follow-up wires (select/combo-box name forwarding · calendar MERGE-forwarding · per-control
  `formUserInvalid` error legs) · a family-budget re-base if s12 trips ADR-0049's 22 KB ceiling (§5.4).
  *(The event-vocab `submit` extension is CLOSED, not flagged: the reviewer verified the
  `change`+target-check disambiguation sufficient — LLD-C7. The `ui-form-reset` keep-or-remove question
  is CLOSED as ruled, 2026-07-01: KEPT as a RESERVED protocol member — the ADR-0031 reserved-arm
  precedent; zero fleet consumers today, activation = the first consumer outside the field family;
  LLD-C1's gen-3 note + ADR-0051 cl.4 carry the characterization.)*
