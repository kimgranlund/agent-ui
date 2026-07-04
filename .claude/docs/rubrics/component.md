# Rubric — component (COMPOSE / REALIZE)

The referential standard a `ui-*` component is built against and graded by at its definition-of-done
([`../goals.md`](../goals.md) §G5; the s16 G5-done gate). Companion to [`../plan.md`](../plan.md) §10 +
[`../process.md`](../process.md) §4; mirrors [`./element.md`](./element.md) / [`./kernel.md`](./kernel.md).

Two axes are scored **separately** — **COMPOSE** (does it compose coherently? — layer · anatomy · API ·
contract · packaging) and **REALIZE** (is the realization *real*? — geometry · behaviour · styling ·
fidelity · residue). This is the **defect quadrant**: a clean API cannot hide an inert build, so a high
COMPOSE score cannot promote a sub-4 REALIZE (and vice-versa). Scale 1–5; 1 = failure, 3 = adequate,
5 = excellent. Dimension IDs are `C#` (component dimension), grouped under the two axis headers; each is
typed **[gate]** (mechanically checkable — a named probe/gate green is the evidence) or **[review]**
(judgment grounded in `file:line` + the committed gate results). The reference component the anchors cite
is `ui-button` (G5).

## COMPOSE axis (C1–C5)

| # | Dimension | Type | What it checks | 1 → 3 → 5 (anchors name the evidence) |
|---|---|---|---|---|
| C1 | API surface & minimalism | [review] | Typed props are literal unions, not `string` (`variant`/`size` enums, `disabled` boolean); events ∈ the allowlist (`click`); the optional leading-icon slot is a slot, not a prop; **no boolean explosion** / no redundant API (the bloat dimension) | 1: stringly props, or a prop per variant (boolean explosion) · 3: `variant`/`size` are literal unions (a `@ts-expect-error` rejects a non-member), events in the allowlist · 5: + the surface is exactly the intended set — the icon is a slot not a `hasIcon` prop, no flag that a variant value subsumes, the props map 1:1 to the descriptor |
| C2 | Anatomy & size-class | [review] | Host-as-grid with the presence-driven `:has()` optional icon slot (ADR-0006); the right size-class (Control); both bare-label and icon+label variants compose; the host owns no margin | 1: wrong size-class, or a `render()` wrapper that clobbers user content · 3: host-as-grid; the `:has()` grid places user light-DOM children (icon + label); Control class · 5: + both variants compose cleanly, the slot is genuinely optional (bare path stays slotless), and the host declares no self-owned margin |
| C3 | Contract fidelity | [gate] | `{name}.md` frontmatter ≡ the live `finalize(Class)` table (the contract↔props trip-wire, ADR-0004); the frontmatter validates against the frontmatter contract schema; the public surface is fully recorded | 1: no descriptor, or it drifts from `static props` · 3: the contract↔props probe is green (frontmatter `attributes[]` === `finalize`) and a negative control fails · 5: + the frontmatter validates against the schema and every event/slot/state/face/aria field is present and accurate |
| C4 | Packaging & tree-shake | [gate] | Single `{name}.css` (ADR-0003); the exact folder file-set `{name}.{ts,css,md,test.ts}`; the three barrels; importing the one control drags only it + real deps | 1: CSS trio / stray files / a wrong file-set · 3: single `.css` + the file-set + barrels; `npm run check && npm test` green · 5: + `npm run size` shows the marginal within the tier budget and the tree-shake proof passes (importing it drags only it + real deps) |
| C5 | Layer & composition coherence | [review] | Import-layering holds (`controls/` imports only `dom` + `traits`); behaviour composes via the documented trait seam; names follow the convention; no drift from sibling controls | 1: an upward/sideways import, or behaviour inlined where a trait belongs · 3: the import-layering trip-wire is green; the trait composes via its `(host,opts)=>release` seam; names per `CLAUDE.md` · 5: + the composition reads identically to how a sibling would (zero dialect drift), and the trait is reused, not re-implemented |

## REALIZE axis (C6–C10)

| # | Dimension | Type | What it checks | 1 → 3 → 5 (anchors name the evidence) |
|---|---|---|---|---|
| C6 | Geometry & the law | [gate] | `block-size` off the ramp, `padding-block: 0`, slotless inline-pad `= h/2`, slot edge-pad `= ½(h−icon)`, gap `= font/2`; subtree `[scale]`/`[density]` recompute (ADR-0007) | 1: block-padding for height, or a magic-number pad · 3: the static geometry probes green (`padding-block==0`; edge-pad formula; `0<glyph≤box`) · 5: + the cross-engine smoke proves subtree `[scale]`/`[density]` recompute (gap changes, frame holds) per the law — geometry is *measured*, not asserted |
| C7 | Behaviour & semantics | [gate] | Space/Enter→`click` via `pressActivation`; disabled fully inert; native-parity `click`; role/ARIA via `internals` only; light DOM | 1: `role`/`aria-*` on the host, or disabled still activates · 3: activation + disabled-inert + click probes green; `aria`-internals-only probe green · 5: + the keyboard path matches a native button (Space on keyup, Enter on keydown, scroll suppressed) and the trait is disabled-aware end-to-end |
| C8 | Styling & tokens | [gate] | `@scope (ui-{name})` consuming **only** `--ui-{name}-*`; tokens declared in `:where()` from `--md-sys-color-{family}-{role}` roles; survives `forced-colors: active`; **no intent by color alone** — any rule keyed on an intent role has a co-carried visible non-color signifier (best-practices / ADR-0057) | 1: raw primitive refs, or styles leak outside `@scope` · 3: `@scope` + tokens-in-`:where()` probes green; a `forced-colors` block exists · 5: + the forced-colors survival is proven in a real engine (the ink/affordance does not vanish), every `--ui-{name}-*` resolves from a role, never a literal, and each intent-keyed rule names its non-color co-signifier |
| C9 | Cross-engine fidelity | [gate] | The browser-truth smoke is green in **Chromium AND WebKit** — the anti-vacuous geometry assertions + forced-colors | 1: jsdom-only, no real-engine proof · 3: the smoke runs and is green in Chromium · 5: green in **both** Chromium and WebKit, anti-vacuous both ways (`[size]`/`[scale]` change px on both variants; `[density]` changes the gap AND the bare frame holds) |
| C10 | Zero residue & budget | [gate] | Connect→disconnect leaves zero subscribers + zero live listeners (`inspect` + the `AbortSignal`); the trait `release()` is idempotent; marginal size within budget | 1: leaks a subscriber/listener, or a non-idempotent release · 3: `connect-disconnect-zero` proven (0 subscribers via `inspect`, 0 listeners via the abort signal) · 5: + reconnect re-subscribes clean, the trait release is safe to call twice, and the marginal gz is recorded with the commit |

## Gate to promote (the component is shippable / G5-done)

The two axes gate **independently** — the defect-quadrant rule:

- **COMPOSE:** every C1–C5 ≥ 4.
- **REALIZE:** every C6–C10 ≥ 4.
- **No cross-axis compensation** — a 5-across COMPOSE cannot offset a sub-4 REALIZE dimension (or vice-versa).
- **Every [gate] dimension is hard:** any [gate] dimension (C3, C4, C6, C7, C8, C9, C10) below 4 blocks
  promotion regardless of the [review] scores — a mechanically-checkable fact that fails is not negotiable.

Shippable = both axes clear ≥ 4 **and** zero [gate] fails. The `component-reviewer` agent scores against this
rubric and returns the per-axis verdict (the adversarial half of the gate; the probes / cross-engine smoke /
contract trip-wire are the deterministic half).

## Class lens — the **Display** control class (ui-text)

The C1–C10 anchors above are written against the reference control `ui-button`, a **Control**-class
*frame-bearing* control: it has a frame — a `--ui-height-*` box, `padding-block: 0`, the slot/slotless edge-pad
formula, the geometry law (`geometry.md`). The entry-control (`text-field`) and container-control (`card`/`row`/
`column`) classes are likewise frame-bearing — they carry a frame's quantities (radius, surface, the
`min-inline-size` floor; the "frame quantities split by control class" law, ADR-0021). **The frame-bearing
criteria below are NOT weakened by this lens** — for an entry/container control, score C1–C10 exactly as the
anchors read.

A **Display**-class control has **no frame**. It is a typographic/structural *leaf* (`geometry.md` §size-classes:
`divider · icon · spinner · … · text`): no control height, no `padding-block` law, no edge-pad formula, no
surface/elevation, no `min-inline-size` floor. The worked precedent is **`ui-text`** (ADR-0025) — a light-DOM
display leaf whose lever is the fleet type scale (`--ui-type-*` as shipped; ADR-0078, *proposed*, replaces it
with `--md-sys-typescale-{role}-{size}-*` and moves heading semantics to the `as`-stamped real element — this
lens's C6/C7/C10-Display anchors are booked for rewrite in that build wave), not `--ui-height-*`. The C6/C7
frame anchors
cannot fairly score it (they assume a frame), and the type-scale + heading-semantics facts the anchors omit are
exactly what a Display leaf must be judged on. This lens says, per dimension, what is **N/A** (do not score it as
a fail — record `N/A — Display`), what **still fully applies**, and what is **NEW for Display** and must be scored.

The two-axis spine, the independent ≥ 4 gates, and the defect-quadrant rule are **unchanged** — a Display control
still gates COMPOSE and REALIZE separately, and every [gate] dimension is still hard.

### What is N/A for a Display leaf (record `N/A — Display`, never a silent fail)

- **C2 — the *frame* anatomy.** Host-as-**grid** with the `:has()` optional-icon slot, and the *Control*
  size-class assertion, are Control-specific. A Display leaf is **host-as-content** (ADR-0006: void `render()`,
  light-DOM children flow through; under ADR-0078 the `as` semantic stamp — a scope-owned adoption wrapper,
  still no template — is the ONE sanctioned exception) and the *Display* size-class. Score C2's host/anatomy on
  the Display facts
  below, not the grid anatomy.
- **C6 — the geometry law (frame quantities).** `block-size` off the `--ui-height-*` ramp, `padding-block: 0`,
  the slotless inline-pad `= h/2`, the slot edge-pad `= ½(h−icon)`, the `gap = font/2` — **all N/A**. A Display
  leaf has no control height and no padding law (`block-size` is content-driven). C6 is re-pointed for Display
  (below) onto the *type-scale* lever; do not fail it for the absent frame formulae.
- **C7 — interaction behaviour.** `pressActivation` (Space/Enter→`click`), the disabled-inert path, and
  native-`click` parity are N/A for a non-interactive leaf (`ui-text` has no focus, no keyboard contract, no
  `disabled`; `user-select` stays **enabled** — the deliberate inverse of `button`). C7 is re-pointed for Display
  onto *semantics* (heading roles), below.
- **The frame-law / `min-inline-size` floor / surface-elevation criteria** (ADR-0021; the G9 container surface)
  are **N/A** — a leaf bears no frame and no surface. If a future Display-class rubric row names them, mark
  `N/A — Display`.

### What still fully applies (score exactly as the anchors read)

- **C1 — API surface & minimalism.** Literal-union props (`variant` is `'h1'|…|'body'`, a `@ts-expect-error`
  rejects a bare string — the `button.size` precedent), the event allowlist (a Display leaf emits **nothing** —
  `events: []`), and **no boolean explosion**. The content-as-**slot-not-prop** call (ADR-0025 Fork 1: text is
  light-DOM children, not a `text` prop) is a *strong* C1 fact — it is the minimal surface, not a gap.
- **C3 — Contract fidelity** [gate]. The `{name}.md` frontmatter ≡ live `finalize(Class)` trip-wire (ADR-0004)
  applies unchanged; the frontmatter must validate against the schema and record every field — including the
  Display-specific rows (`tier: display`, `geometry.sizeClass: display`, and the `aria` heading role/level
  rows, below). A drifting descriptor is a C3 fail for a Display leaf exactly as for a Control.
- **C4 — Packaging & tree-shake** [gate]. Single `{name}.css`, the `{name}.{ts,css,md,test.ts}` file-set, the
  three barrels, the marginal-size budget — unchanged.
- **C5 — Layer & composition coherence.** Import-layering (`controls/` imports only `dom`+`traits`), the naming
  convention, and zero sibling-dialect drift apply unchanged. *Trait-seam note:* a pure Display leaf may carry
  **no trait** (`ui-text`'s only behaviour is the cl.4 heading effect, a `connected()` leg off the `variant`
  signal — not a `use()`-registered trait). "Behaviour composes via a trait" is therefore satisfied vacuously
  when there is no behaviour to compose; do not invent a trait. The heading effect's coherence is scored under
  C7-Display and its residue under C10.
- **C8 — Styling & tokens** [gate]. **Fully applies, and is core for Display.** `@scope (ui-{name})` consuming
  **only** `--ui-{name}-*`; component tokens declared in `:where()` and repointed from roles; survives
  `forced-colors: active`. For `ui-text` this is the role-pure **two-block** seam (ADR-0025 cl.3a): the
  `:where(ui-text)` block declares `--ui-text-{size,weight,leading}` from the fleet `--ui-type-body-*` and each
  `:where(ui-text[variant='h1'])…` repoints them; the `@scope` block consumes **only** `--ui-text-*`, never a
  `--ui-type-*` or `--md-sys-color-*` literal. A Display leaf reading the fleet scale directly is a C8 fail.
- **C9 — Cross-engine fidelity** [gate] and **C10 — Zero residue & budget** [gate] apply unchanged in *form*
  (Chromium AND WebKit; connect→disconnect zero subscribers/listeners; marginal gz recorded) — their *content*
  for Display is named below.

### What is NEW for Display and MUST be scored

These re-point the frame gates (C6/C7) and sharpen C2/C9/C10 onto the Display facts. They are the Display leaf's
"is the realization real?" — judge them with the same 1→3→5 rigour as the frame anchors.

- **C2-Display — no-intrinsic-frame + Display size-class.** *1:* claims a frame a leaf must not have (a control
  height, a `padding-block` law, a surface) or wrong size-class. *3:* host-as-content (void `render()`, light-DOM
  children untouched, ADR-0006); declared `tier: display` / Display size-class; host owns no margin. *5:* + the
  leaf is genuinely frameless — `block-size` is content-driven, no `--ui-height-*`/floor/surface anywhere, and
  the content model is a slot not a clobbering text-prop effect.
- **C6-Display — the type-scale binding (re-points the geometry gate)** [gate]. The lever is the `--ui-type-*`
  ramp (ADR-0025 cl.3), not the frame. *1:* hard-coded sizes/weights, or the leaf reads `--ui-type-*`/raw px
  directly (no component-token seam). *3:* the static probes prove `font-size: var(--ui-text-size)` resolves
  from the `[variant]`-repointed `--ui-type-{level}-size`, weight/leading likewise; type is **density-invariant**
  (size carries `× var(--ui-scale)` but **not** `var(--ui-density)`). *5:* + the cross-engine smoke proves a
  subtree `[scale]` **re-multiplies** the type px (the `*`-ramp pre-substitution, ADR-0007) while `[density]`
  leaves type untouched — type is *measured*, not asserted. (This is the Display analogue of C6's "geometry is
  measured": the *type scale* is the law a Display leaf obeys.)
- **C7-Display — heading semantics correctness (re-points the behaviour gate)** [gate]. The content model +
  ARIA hierarchy (ADR-0025 cl.2/cl.4). *1:* a host `role`/`aria-*` attribute, or wrong/absent heading semantics
  (e.g. a `role="button"` on inert text — the very lie ADR-0025 fixes). *3:* slotted light-DOM text is the
  accessible name; for `variant ∈ h1…h5` `internals.role = 'heading'` + `internals.ariaLevel = 1…5` via
  `ElementInternals`; `body`/`caption` clear **both** (generic styled text). *5:* + the level mapping is exact
  and reactive (`h1→1 … h5→5`, flips live when `variant` changes), set **only** through `internals` (never a host
  attribute — the FACE pattern), and the leaf is correctly non-focusable with `user-select` enabled.
- **C9-Display — cross-engine content.** The browser-truth smoke (Chromium AND WebKit) asserts the *type-scale*
  facts, not the frame law: `[scale]` changes the type px on both engines, `[density]` does **not** touch type,
  and the `forced-colors` block keeps the text visible (`CanvasText`). Anti-vacuous both ways (the scale moves px;
  density holds them).
- **C10-Display — heading-effect residue.** The `connected()` heading effect (the leaf's only behaviour) must
  leave **zero** residue on disconnect — zero subscribers (`inspect`) off the `variant` signal — and reconnect
  must re-subscribe clean. A Display leaf with no trait still has this one effect to account for; a leaked
  `variant` subscriber is a C10 fail.

### Display gate to promote

Unchanged spine: **COMPOSE** = C1–C5 ≥ 4; **REALIZE** = C6–C10 ≥ 4; no cross-axis compensation; every [gate]
dimension hard (C3, C4, **C6-Display**, **C7-Display**, C8, C9, C10). Score the re-pointed C6/C7 on their
Display content; record N/A dimensions as `N/A — Display` (not a fail). A Display leaf is shippable when both
axes clear ≥ 4 with the frame criteria correctly marked N/A and the type-scale + heading-semantics facts scored
real. Worked precedent: `ui-text` (ADR-0025).
