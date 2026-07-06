# ADR-0051 — the `UIFormElement` field-labelling seam (element handoff → per-control forwarding; prop-sync bridge)

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-07-01
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-07-01 |
> | **Proposed by** | g7-planner (the design seat, decomp `g7-field-form-provider` slice s0) |
> | **Ratified by** | orchestration (the coordinator seat) — 2026-07-01, on the green s14 gate; the A/B/C fork choice itself was ruled by Kim |
> | **Repairs** | goals §G7 (the `ui-field` DoD box) · `dom/form.ts` (gains the seam + the `ui-form-reset` protocol dispatch) · `controls/text-field/{text-field.ts,text-field.md}` (the editor forwarding wire; the `labelSource`/"ui-field at G7" notes) · **NEW** `controls/field/*` · decomp `g7-field-form-provider.decomp.json` s1/s2/s8/s11 — all edited at build time, gated on this ADR. |
> | **Supersedes / Superseded by** | Extended by **ADR-0085** (lands this seam's anticipated select/combo-box labelling wiring — the "combo-box and select are flagged follow-ups" note in Consequences, now closed). **Relates ADR-0050** (reuses its `ui-`-prefixed protocol-event namespace for `ui-form-reset`) · **ADR-0014** (text-field's `label`→aria-label seam + the control-managed message node this generalizes) · **ADR-0013** (UIFormElement, the base that grows the seam) · **ADR-0029** (the visible message node the stitching rule governs). |

## Context

G7's `ui-field` renders a **visible** label / description / error around one slotted form control — but a
native `<label for>` cannot reach a custom control's **role-carrying part** (text-field's `role=textbox`
rides a light-DOM editor part; checkbox/switch/radio/slider carry their role on `ElementInternals`, and the
house bars host `aria-*` attributes outright). The shipped stand-in — text-field's `label` **prop** → the
editor's `aria-label` (ADR-0014) — is per-control, name-only, and text-only: it has no description/error
path, and two message sources (the field's visible error + the control's internal `aria-describedby` node,
ADR-0029 A1) would double-announce to AT. The fleet needs ONE uniform association seam, cheap per control,
that covers name + description + error with a single-announce guarantee. Kim ruled fork 2 = option B (the
base-level forwarding seam); this ADR pins its design.

## Decision

We will grow **`UIFormElement`** (dom/form.ts — the owning doc for the base contract) by a small,
signal-backed **field-labelling seam**, five clauses:

1. **The handoff surface is a method carrying ELEMENTS.** `ui-field` assigns stable ids to its
   label/description/error part nodes and calls
   `control.setFieldLabelling({ label, description, error })` (each an `HTMLElement | null`; `null`
   argument clears the whole association). It is a **public method writing a private signal** — the
   `setCustomValidity` precedent, NOT a prop: elements cannot ride attributes, and this keeps the seam off
   the attributes-as-API descriptor surface. It hands **elements, not id strings**, because the
   internals path (clause 2) consumes elements (`ariaLabelledByElements`), while the id path can read
   `.id` off the node — one seam shape serves both forwarding targets.
2. **Forwarding is a base-owned effect calling an overridable hook — with a GUARDED internals default.**
   A scope-owned base effect applies the current labelling through
   `protected applyFieldLabelling(refs)`. The base default forwards via **internals ARIA element
   reflection** (`internals.ariaLabelledByElements = [label]`,
   `ariaDescribedByElements = [description, error]`) **only when `internals.role` is set** — so every
   internals-role control (checkbox · switch · radio · slider) wires **for free**, while a role-less host
   deliberately no-ops (a half-attached name on a role-less AX node is silent lossiness that can fool a
   probe). A **part-role** control overrides the hook to id-reference its part (text-field → the editor's
   `aria-labelledby`/`aria-describedby`; combo-box/select follow the same pattern when wired). The
   reflection assignment is feature-detected (the tabs `reflectAriaElements` precedent) — jsdom lacks it,
   so the AX read-back verification burden lands on the **browser gate, both engines**.
3. **Option A is the documented BRIDGE, not the mechanism.** For a control not yet wired (no override and
   no internals role), the field additionally one-way-syncs its own label **text** into the control's
   string `label` prop — **only when the control exposes one and the consumer left it empty**
   (a consumer-set label is never clobbered). The bridge is name-only and text-only: description and
   error do **not** bridge — recorded lossiness, the reason the seam (not the bridge) is the contract.
4. **Single-error-announce stitching + the reset channel.** When a labelling is present, the control's
   internal message node (ADR-0014 cl.4 / ADR-0029 A1) **yields** — empty, `hidden`, and dropped from the
   role part's `aria-describedby`; the field's error node is the ONE description-borne error. Its
   membership is **static** (an empty node contributes nothing to the accessible description — the text
   is the timing): the field writes `control.validationMessage` into it only under the control's
   user-invalid gate, and clears it otherwise. The reset leg holds on **both** reset paths (native
   `form.reset()` AND a provider-driven member reset) because both end in the tracker's reset — a
   SIGNAL write the field's rendering tracks (the final, coordinator-re-ruled observation design: a
   scope-owned effect over the seam's reactive closures, no event-ordering dependence — the LLD's
   three-generation record holds the mechanics). `formResetCallback` additionally dispatches a
   composed, bubbling **`ui-form-reset`** protocol event — the ADR-0050 `ui-`-prefixed protocol
   namespace, plumbing outside the public event vocab — **KEPT as a RESERVED protocol member**
   (coordinator-ruled 2026-07-01; the ADR-0031 precedent — the reserved `INVALID_FUNCTION_CALL` arm
   that ADR-0034 later activated). Honest status: shipped + contract-probed (s1's `dom/form.test.ts`),
   **zero fleet consumers today** — the field re-suppresses via the tracker's signal write, not this
   event; the connect/reset pair is a coherent protocol surface, and the activation trigger is the
   first consumer outside the field family (A2UI's form surface is the named candidate).
5. **The upgrade-path catch-up (coordinator-ruled, 2026-07-01).** Custom-element UPGRADE follows
   **define order, not tree order** — with pre-existing DOM and granular imports a control can announce
   into the void (its provider/field not yet upgraded/listening), and the field's `closest('ui-field')`
   guard sees not-yet-upgraded tags. `UIFormElement` therefore gains a public
   **`announceFormConnect()`** — re-dispatches `ui-form-connect` iff its **connection signal is live**
   (a LIFECYCLE guard, not the structural `isConnected`: on a bulk subtree insert every descendant is
   `isConnected` BEFORE any connectedCallback has run — ancestor-first — so a structural guard would
   announce controls that have no handle yet; a same-cascade control needs no catch-up, its own connect
   dispatch fires moments later), minting a fresh detail off that live signal — and each consumer
   (`ui-form-provider`, `ui-field`)
   runs a **one-shot** `querySelectorAll` catch-up at its own connect, calling it on descendant
   `UIFormElement`s; the consumers' idempotence guards (registry dup / field first-wins) dedupe. This is
   NOT a MutationObserver revival: ADR-0050's registration-on-connect stands — the catch-up is its
   upgrade-order complement (a control upgraded AFTER the consumer covers itself by its own connect
   dispatch).

## Consequences

- **The base contract grows — the honest enumeration the zero-drift audit keys off:** two PUBLIC methods
  (`setFieldLabelling`, `announceFormConnect`), one protected reactive getter (`fieldLabelling`), two
  protected hooks (`applyFieldLabelling`, `formUserInvalid` — the field's error gate: jsdom cannot match
  `:state(user-invalid)`, so the gate rides a reactive hook read off the ONE tracker source), the
  `ui-form-reset` protocol dispatch in `formResetCallback`, and the ADR-0050 connect detail WIDENED with
  three reactive read closures (`value` / `validity` / `userInvalid` — realizing ADR-0050 §4 without
  widening the class API further). Every existing control inherits all of it; the full form suite must
  show **zero behavioral drift** for un-fielded, provider-less usage (labelling stays `null`; the
  protocol events bubble to nobody).
- **Per-control wiring cost is real, one-sided, and TWO-AXIS.** The NAME path: internals-role controls
  are free (the guarded default); each part-role control costs one hook override + amending its existing
  label/message effects to yield (text-field lands this wave; **combo-box and select are flagged
  follow-ups** — until wired, a select inside a field keeps only its own trigger-text name, and the
  bridge cannot help select (it has no `label` prop); **calendar is a follow-up too** — its grid role is
  a PART attribute, not `internals.role`, and the grid already self-labels to its month header, so its
  override must MERGE the field ref into the existing `aria-labelledby`, never clobber). The ERROR leg
  (`formUserInvalid`): default `false`, wired only where `trackUserInvalid` is composed — **text-field
  only at G7**; an invalid unwired member shows no field error (consistent with its absent
  `:state(user-invalid)`).
- **The bridge is lossy by design** — name-only, text-only, and inert for controls without a `label`
  prop. Anyone relying on it for description/error gets nothing; the descriptor documents this.
- **The cross-engine burden is booked.** ARIA element reflection on `ElementInternals` is
  modern-Chromium/WebKit; jsdom has neither the reflection nor `:state()` matching — so the seam's AX
  read-back (accessible name ON the role-carrying part, ONE announced error) is only provable in the s11
  browser smokes, both engines. jsdom probes cover the id path, the yield, and the bridge.
- **The internal message node stays** — bare (un-fielded) controls keep the ADR-0014/0029 behavior
  unchanged; the yield is strictly additive under association.
- **Stale → re-verify:** `dom/form.ts` + form-suite tests (seam + zero drift) ·
  `controls/text-field/*` (the wire, the yield, `labelSource`) · **NEW** `controls/field/*` ·
  goals §G7 · decomp s1/s2/s8/s11 acceptance rows.

## Acceptance

- **Both-engine AX read-back (s11):** inside a `ui-field`, the field's label text is the accessible name
  on text-field's editor part (id path) AND on an internals-role control (reflection path), in Chromium
  and WebKit.
- **Single announce:** a user-invalid control inside a field exposes exactly ONE message-bearing
  description node (the field's error); the control's internal message node is empty + hidden.
- **Bridge:** an unwired control with an empty `label` prop receives the field's label text; a
  consumer-set `label` is not overwritten.
- **Reset re-suppression, both paths:** native `form.reset()` and a provider-driven reset each clear the
  field's visible error and re-suppress until the next interaction (behavior-asserted — both paths end
  in the tracker's signal write, tracked by the field's reactive rendering).
- **Upgrade-order discovery (cl.5):** with pre-existing DOM and the provider/field defined AFTER its
  descendant controls (a late-define probe: DOM first, then the barrel import), the catch-up still
  registers/associates them; `announceFormConnect` is a no-op whenever its connection signal is not
  live (detached, or mid-bulk-insert before its own connect — the bulk-insert regression probe) and
  dedupes on an already-registered/associated one.
- **Zero drift:** the existing form suite stays green with no field present.

## Alternatives considered

- **(A) prop-sync as THE mechanism** (the field writes the slotted control's `label` prop) — rejected as
  the contract: name-only (no description/error path, so no single-announce story), text-only (flattens
  rich label content), and only reaches controls that happen to carry a `label` prop. Kept as the
  clause-3 bridge — its virtue (zero new seam) is real for not-yet-wired controls.
- **(C) the field writes the control's `[data-part]` internals directly** — rejected (stands rejected
  from the intake): parts are control-owned; a wrapper mutating another control's internal DOM crosses
  the ownership boundary the whole FACE architecture is built on.
- **Handing id STRINGS instead of elements** — rejected: `ElementInternals` element reflection consumes
  elements (there is no internals attribute surface), so a string seam would fork into two shapes per
  role carrier; elements degrade to ids for free, not vice versa.
- **An UNGUARDED internals default** (always reflect, role or not) — rejected: on a role-less host the
  labels half-attach to a generic AX node — silently ineffective, and worse than a no-op because it can
  pass a naive probe while AT hears nothing.
- **A control-pulls protocol** (the control requests label nodes from an ancestor field, context-style) —
  rejected: it inverts ownership (the field owns the nodes and their ids) and re-introduces the
  request/respond machinery ADR-0050 already declined for the provider; the field is the one party that
  knows when its nodes exist.
