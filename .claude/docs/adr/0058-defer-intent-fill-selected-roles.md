# ADR-0058 — defer the dark intent-fill AA text roles until the first filled intent control

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-07-02
>
> | Field | Value |
> |---|---|
> | **Status** | accepted *(2026-07-03 — the DEFER decision confirmed by Kim ("proceed"): no filled intent control exists; the pre-computed remedy [--c-{f}-selected: light-dark({f}-550,{f}-600), checker-verified ≥4.5 both legs] + the activation trigger [the first filled intent control] are recorded — the "no silent gap" requirement satisfied by a written deferral, the ADR-0031/0051 reserved-arm precedent.)* |
> | **Date** | 2026-07-02 |
> | **Proposed by** | tokens-specialist (item 3 of the 2026-07-02 color-verify audit; Kim-directed) |
> | **Ratified by** | orchestration (the coordinator seat) — 2026-07-03, on Kim's confirmation + the green wave gate |
> | **Repairs** | `references/tokens.md` (the `-selected` role note — records the reserved intent siblings + trigger, edited in this change) |
> | **Supersedes / Superseded by** | None. Extends `ADR-0048` (generalizes the `--c-primary-selected` pattern to the intent families) · relates `ADR-0057` (the same L-matched intent ramps) · `ADR-0008` (role-ladder discipline) |

## Context

The 2026-07-02 color-verify audit (item 3) measured **white on the intent-family FILL** — the text a
filled danger/warning/success/info control would carry. In the DARK scheme the fill is the anchor's dark
leg (`--c-{f}` → `{f}-450`), and white-on-`{f}-450` measures **3.13–3.41:1** (danger 3.41 · warning 3.36 ·
success 3.13 · info 3.21) — below the **4.5:1 AA bar for normal text**. The LIGHT leg (`{f}-550`) passes
(4.52–4.92:1). Only `--c-primary` has an AA-safe filled-text step today: `--c-primary-selected`
(`light-dark(550, 600)`, ADR-0048), minted for the `ui-calendar` selected numeral.

The gap is real but **currently unreachable**: no filled intent control exists in the fleet. `ui-button`
is single-family primary (its `solid/soft/ghost` are *emphasis*, not intent); `--c-warning`/`--c-info` have
**zero component consumers** (cf. ADR-0057's conformance table). No shipped surface renders intent-fill
TEXT, so nothing hits the failing pair today. The audit's requirement is **"no silent gap"** — the gap
must be a *written* decision with a named activation trigger, not an unrecorded latent fail.

## Decision

We **defer** minting the four `-selected` intent siblings, recording the measured gap, its pre-computed
remedy, and its activation trigger rather than adding four **unconsumed** public roles now. The owning doc
[`references/tokens.md`](../references/tokens.md) `-selected` note is edited in this change to carry the
reserved-role fact; this ADR holds the why.

This matches the fleet's stated discipline — the `-selected`/`-hover`/`-active` state siblings are
explicitly *"added per-family on demand"* (`tokens.css` / `tokens.md`) — and the **reserved-arm precedent**
(ADR-0031/0051: a decision written now, mechanically activated at first consumer).

**The reserved remedy** (verified with `color-verify/contrast-check.py`, 2026-07-02) — at the first
consumer, mint `--c-{f}-selected: light-dark(var(--c-{f}-550), var(--c-{f}-600))` (the exact
`--c-primary-selected` shape). White-on-fill both legs, all ≥ 4.5 AA:

| family | light `550` | dark `600` | (bare `--c-{f}` dark `450`, the fail) |
|---|---|---|---|
| danger | 4.92 | 5.89 | 3.41 |
| warning | 4.82 | 5.81 | 3.36 |
| success | 4.52 | 5.45 | 3.13 |
| info | 4.58 | 5.57 | 3.21 |

**Activation trigger:** the FIRST filled intent control that renders `-on-{f}` (white) TEXT on an intent
FILL — a solid danger/warning/success/info button (the button `family` attribute, `tokens.md`'s open fleet
decision), or an alert/toast/badge family. At that point mint only the role(s) that control needs and
repoint its fill-text token — a 1–4 line edit whose numbers this ADR already pins.

## Consequences

- **No silent gap.** The failing measurement, the exact remedy, and the trigger are written; activation is
  mechanical, not a re-derivation.
- **GLYPH-on-fill is unaffected** — a checkmark/thumb at the 3:1 non-text bar over an intent fill already
  clears; this is a TEXT-only gap (the same glyph-vs-text distinction ADR-0048 drew for `--c-primary`).
- **Zero token/code change this pass** — no unconsumed roles enter the public vocabulary.
- **The cost, accepted:** the first filled-intent-control author must mint + repoint (this ADR + the
  `tokens.md` `-selected` note are the pointer). A review that ships white intent-fill TEXT on the bare
  `--c-{f}` would be an AA regression the `color-verify` gate catches.
- **Stale → re-verify:** `references/tokens.md` `-selected` note (edited here); on activation, `tokens.css`
  (the minted roles) + the consuming control.

## Acceptance

- `adr_check.py` exit 0; index row present.
- The reserved-remedy table reproduces via `color-verify/contrast-check.py` (the audit's ground truth).
- `references/tokens.md` carries the reserved-siblings note in this change.
- On the first filled intent control: the role(s) mint per this table and the control's `component-reviewer`
  run cites this ADR.

## Alternatives considered

- **Mint all four `-selected` roles now** — rejected: four unconsumed public roles contradict the fleet's
  on-demand discipline (`tokens.md`) and the ADR-0048 precedent (minted for a REAL consumer). Without a
  consumer the exact shape is unpinned — a filled control may also want `-selected-hover`/`-active`, or a
  non-white `-on-{f}` — so minting now risks minting the wrong surface.
- **Do nothing / leave unrecorded** — rejected: violates the audit's "no silent gap" requirement; a future
  filled intent control would silently ship a 3.1–3.4:1 AA-text fail.
- **Darken `--c-{f}` itself to clear white text** — rejected: the anchor is used fleet-wide as
  border/ink/glyph at the **3:1 UI bar** where it already passes; darkening it to clear the **4.5 text bar**
  over-darkens every 3:1-bar consumer and breaks the deliberately L-matched intent ladder (ADR-0057).
