# ADR-0186 — `ui-card-header` gains `format: 'default' | 'structured'`: the one prop the Figma dialog-bubble structured-container header needs, composed from shipped typescale + typeface + border tokens, no new mechanism

> Source: agent-ui ADR log (this directory — the numbered files ARE the index; status lives in each ADR's own header). · 2026-08-13
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-08-13 *(authored)* |
> | **Proposed by** | planner (design seat) — the GH [#807](https://github.com/kimgranlund/agent-ui/issues/807) design-intake leg (`card-structured-container.intake.md`), Kim's owner ruling that #807 (component arm) and #808 (catalog arm, GH [#808](https://github.com/kimgranlund/agent-ui/issues/808)) share ONE header-anatomy question, ruled once here. |
> | **Ratified by** | kimgranlund (repo owner), 2026-08-13, via the [`ratify ADR-0186` utterance](https://github.com/kimgranlund/agent-ui/issues/807#issuecomment-5274643511) — verified + flipped by `scripts/adr_ratify.py` (ADR-0149) |
> | **Repairs** | On ratification+build (not authored here — see the intake's §7): `packages/agent-ui/components/src/controls/card/card-header.md` (a new `format` row in `attributes[]`) · `card-header.ts` (`static props` widening) · `card.css`'s `[format='structured']` STYLES leg · the doc/demo page + a structured specimen · `agent-ui-composition-patterns` SKILL.md (the label/value-chip row recipe, §4b of the intake — doc debt riding the same wave). |
> | **Supersedes / Superseded by** | None. **Relates** [ADR-0046](./0046-container-box-model.md) / [ADR-0056](./0056-region-less-card-humane-default.md) (the zero-padding shell + region system this fork composes with, unchanged) · [ADR-0078](./0078-ui-text-three-axis-variant-size-as.md) cl.2/cl.2b (the `kicker` typescale role + the typeface-not-typescale fence this fork REUSES rather than reopens) · [ADR-0102](./0102-css-less-consumer-contract-law.md) (the CSS-less-consumer law — the reason this needs a real prop, not an author `style=` escape hatch, since #808's catalog row cannot emit raw CSS) · [ADR-0173](./0173-descriptor-inversion-generation-intake.md) (`ui-badge`'s `intent` enum — the status affordance this fork's trailing slot rides, unchanged) · **Resolves** the header-anatomy fork of GH [#807](https://github.com/kimgranlund/agent-ui/issues/807) (component arm) — **feeds** GH [#808](https://github.com/kimgranlund/agent-ui/issues/808) (catalog arm), which builds its `CardHeader`/`Badge` catalog marks on this record without re-litigating the anatomy question. |

## Context

GH #807 (owner ruling, intake round 2026-08-12): restyle `ui-card` toward the Figma
`dialog-bubble` frame's structured-container language — a formal header (leading icon ·
letterspaced-uppercase-mono title · trailing status) over a divider, plus label/value-chip body
rows. Visual bar: **direction, not spec** — the mock sets direction; final geometry/type resolve
through this repo's own token + design-intake process (`agent-ui-component-design`'s fork sheet,
run in full at `card-structured-container.intake.md`).

That intake's precedent sweep (its §2) found every mechanism the mock needs ALREADY shipped except
one: `ui-card-header`'s existing leading/label/trailing grid, `ui-badge`'s `intent` enum, `ui-row`'s
`justify` distribution, the `kicker` typescale role (ADR-0078 cl.2b, letterspaced uppercase
already), and `--md-sys-typeface-mono` (an existing, deliberately typescale-orthogonal constant,
ADR-0078 cl.2's own fence: *"`-font` (font-family) is deliberately NOT minted — the fleet has no
font-family tokenization yet"*) compose to reproduce the ENTIRE mock — leading icon, trailing
status, and label/value rows — with zero new mechanism.

The one place composition runs out: `ui-text` never sets `font-family` at all (verified against
`text.css` — it repoints only `--ui-text-{size,weight,line-height,tracking}`), so an AUTHOR could
already get the mono-kicker look today via an inline `style="font-family:
var(--md-sys-typeface-mono)"` wrapper around `<ui-text variant="kicker">`. That escape hatch is
closed for the actual consumer this ticket serves: ADR-0102's CSS-less-consumer law means an A2UI
catalog payload (GH #808's arm) can never emit raw `style=` CSS — an agent producing this header
needs a real, typed, catalog-bindable PROP to reach the mono-header look, not an author-only
composition trick. That forces exactly one small widening of a shipped control's public contract —
the trigger for this ADR, per `agent-ui-component-design`'s own bar ("a row that needs a NEW
mechanism or changes a fleet contract is a fork").

## Decision

We will add ONE new reflected enum attribute to `ui-card-header` (and, for symmetry with the
family's shared header/footer anatomy block, `ui-card-footer` — both consume the same
`:where(ui-card-header, ui-card-footer)` rule block in `card.css`, so the attribute is defined on
both, though the structured-container use case is header-only):

**`format: 'default' | 'structured'`, default `'default'`, reflected.**

Under `format='structured'`:

- **cl.1 — Title typography repoints, in-place, no new region/slot.** The header's label column
  (the unnamed default-slot child — `ui-text` or plain text, unchanged either way) repoints its
  `font-size`/`font-weight`/`line-height`/`letter-spacing` to
  `--md-sys-typescale-kicker-medium-{size,weight,line-height,tracking}` (the SAME row
  `ui-text[variant='kicker']` already reads — `text.css:86-91`) and gains `text-transform:
  uppercase` (mirroring `text.css:259-263`'s existing kicker/overline uppercase leg) plus a new
  component token, `--ui-card-header-title-font`, default `inherit`, repointed to
  `var(--md-sys-typeface-mono)` under this attribute. **No `--md-sys-typescale-*` role is minted.**
  `ADR-0078` cl.2's typeface-not-typescale fence stands unamended — this is a SECOND opt-in
  consumer of the same orthogonal constant `base.css` already documents for code/figure surfaces,
  not a reason to widen the schema.
- **cl.2 — Header/body divider.** `border-block-end: 1px solid var(--ui-card-border)` (the
  EXISTING hairline-border token, `card.css:91` → `--md-sys-color-neutral-outline-variant`) — no
  new color role.
- **cl.3 — Leading/trailing cells are UNCHANGED.** The `[slot='leading']`/`[slot='trailing']` grid
  columns (`card.css:316-327`) already place an icon and a status affordance; `format='structured'`
  touches only the label column's typography and the region's own bottom border. An author (or
  agent, via #808's catalog row) composes `<ui-icon slot="leading">` and `<ui-badge
  slot="trailing" intent="success">` exactly as today — **zero anatomy change**.
- **cl.4 — The label/value-chip body rows earn NO fork.** `ui-row[justify='between']` +
  `ui-text[variant='label']` + `ui-badge[intent='neutral']` inside `ui-card-content` reproduces the
  mock's Arrive/Depart rows with zero new mechanism (the intake's §4b) — recorded here only so a
  reader does not go looking for a second ADR clause that does not exist; the Repairs list's
  `agent-ui-composition-patterns` row is the only artifact this leg earns.
- **cl.5 — Zero-padding shell law is untouched.** `format='structured'` never repoints
  `--ui-card-region-margin`/`-pad-inline`/`-pad-block` — the region's inset stays exactly what
  `ADR-0046`/`ADR-0056` already establish; this fork is confined to typography + one border, inside
  the region's existing box.

The owning intake record is `card-structured-container.intake.md` (`.claude/docs/spec/`) — this
ADR repairs it by freezing the ONE contract-changing fork it found; the intake's §4a/§4b/§4c hold
the full reasoning (mint-vs-compose test applied, alternatives weighed).

## Consequences

- `card-header.md`'s `attributes[]` gains one row (`format`, enum, 2 values, default `'default'`)
  — the contract↔props trip-wire (`card-header-descriptor.test.ts` or its equivalent) regenerates
  against it; `card-header.ts`'s `static props` widens to match, with the standard out-of-enum
  runtime hardening (the `ui-badge`/`ui-text` precedent — a bound-garbage value snaps to
  `'default'`, never left un-enumerated).
- `card.css`'s header/footer TOKEN block gains one new `--ui-card-header-title-font` declaration
  (default `inherit`) plus the `[format='structured']` STYLES leg (cl.1/cl.2 above) — role-pure per
  the file's own banner (consumes only the control's own `--ui-card-*` chain plus the existing
  `--md-sys-typeface-mono`/`--md-sys-typescale-kicker-medium-*` reads `ui-text` already performs
  the identical style of read against).
- A built-output test is owed (the intake's §7 leaf 2 — the TKT-0002 class): asserting the
  RESOLVED `font-family` under `[format='structured']` computes to the mono stack, not just that
  the token declaration exists in source — a cascade-dependent claim needs a real-DOM assertion.
- `agent-ui-composition-patterns` gains a documentation row for the label/value-chip recipe (§4b) —
  doc debt, not a code change, but part of the same definition-of-done once built.
- **Downstream, on ratification:** GH #808's catalog arm gains exactly one new bindable mark —
  `CardHeader.format` (one-way/static, since it is a structural mode switch, not live status
  data the ADR-0111-style bindable-status precedent would otherwise argue for) — and reuses
  `Badge.intent` (already bindable) for the trailing status affordance. No second anatomy ruling is
  owed there; this ADR IS that ruling for both records.
- **Negative consequence, accepted:** `ui-card-header`/`ui-card-footer` now carry a formatting
  attribute whose visual effect (uppercase + mono + a divider) is opinionated enough that an author
  reaching for "just a slightly different header" without wanting the FULL structured-container
  look has no dial between `'default'` and `'structured'` — a deliberately binary v1, matching the
  mock's own single named direction; a third mode is a future fork, not pre-built here (KISS —
  the intake's §8 names this trade-off explicitly).

## Alternatives considered

- **Widen `ui-text`'s `variant` enum with a new `kicker-mono`-shaped role** — rejected. `variant`
  is a fleet-wide contract (ADR-0078's 27-cell matrix, consumed everywhere `ui-text` renders); a
  card-header-specific look does not belong on the general text primitive, and any OTHER consumer
  wanting the same treatment can already compose `kicker` + an inherited mono `font-family` without
  a new enum value. Confining the blast radius to the one control that actually needs it is the
  KISS-consistent choice (intake §4c).
- **Mint a new `ui-card-header-title` sub-control** — rejected. No new interaction, value, a11y
  role, or geometry class is needed; the switch is a pure CSS repoint on an existing region's
  existing label slot. A new tag would duplicate `ui-card-header`'s own grid instead of widening it
  (intake §4a).
- **Leave it to author composition (`style="font-family: var(--md-sys-typeface-mono)"`)** —
  rejected as the SOLE answer, though it remains a legal escape hatch for a hand-authored page.
  ADR-0102's CSS-less-consumer law means an A2UI catalog payload (GH #808) can never emit raw
  `style=` CSS, so a prop-level surface is required for the producer-facing half of this ticket's
  own acceptance to be satisfiable at all.
- **A boolean `structured` attribute instead of an enum** — considered, rejected for headroom: an
  enum leaves room for a future third header mode without a second boolean colliding with the
  first (`structured` + some later `compact` would need to interact; two independent enum values
  under one `format` axis compose cleanly, matching the fleet's existing preference for named enum
  modes over boolean stacks — e.g. `ui-row`'s `reflow`).
