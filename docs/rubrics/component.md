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
| C8 | Styling & tokens | [gate] | `@scope (ui-{name})` consuming **only** `--ui-{name}-*`; tokens declared in `:where()` from `--c-{family}-{role}` roles; survives `forced-colors: active` | 1: raw primitive refs, or styles leak outside `@scope` · 3: `@scope` + tokens-in-`:where()` probes green; a `forced-colors` block exists · 5: + the forced-colors survival is proven in a real engine (the ink/affordance does not vanish) and every `--ui-{name}-*` resolves from a role, never a literal |
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
