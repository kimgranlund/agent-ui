# Anatomy — the slot/role adornment standard

> Canonical normative standard for agent-ui control anatomy: **position slots × content roles**. Distilled
> 2026-06-27 from the ratified decisions [ADR-0006](../adr/0006-button-anatomy-optional-icon-slot-density-acceptance.md)
> (the optional leading slot + the presence-driven `:has()` host-as-grid) and
> [ADR-0012](../adr/0012-button-anatomy-trailing-adornment-slot.md) (position slots × `data-role` roles — the
> family adornment standard). Those ADRs hold the *why* and the alternatives; this doc is the resolved
> *how-to-apply* the NEXT control copies. It places adornments; **it does not size them** — the glyph sizing law
> is [`geometry-sizing-spec.md`](./geometry-sizing-spec.md) (§1.4 frame/rhythm · §1.5 per-edge pad · §4.1/§4.6
> affordance vs content-icon), distilled in [`geometry.md`](./geometry.md). First consumer: `ui-button` (G5);
> [`component-author`](../../skills/agent-ui-component-create/SKILL.md) points here for the convention.

## The two axes (the one frame)

An adornment is described by **two orthogonal axes** — a position and a kind — that never cross:

| axis | answers | carried by | vocabulary | drives |
|---|---|---|---|---|
| **SLOT** = position | *where* it sits | the `slot` attribute | `leading` · `label` · `trailing` | placement (which grid column / which edge) |
| **ROLE** = kind | *what* it is | the `data-role` attribute | `icon` · `caret` now; `tag` · `badge` reserved | the glyph's size + any per-kind tuning |

**Position places · role sizes.** The two are independent: any role may sit in either adornment slot (a
`[caret │ label │ icon]` reversal is as valid as the canonical `[icon │ label │ caret]`). The slot names a
*position*, never a content kind — the slot was renamed off `icon`→`leading` precisely so it stops implying its
contents (ADR-0012). Adding a kind is **additive** on the role axis alone (a new `data-role`, no new slot, no new
column logic); growing the layout is additive on the slot axis alone.

## 1 · Slots — the position axis

Three position regions, placed by a **presence-driven host-as-grid** (`:has()`, pure CSS — no JS, no
`observedAttributes`):

- **`slot="leading"`** — an optional adornment in the **start** cell.
- **the label** — the **default/unnamed** children (an explicit `slot="label"` is equivalent); the accessible
  name, filling the `1fr` **centre** cell.
- **`slot="trailing"`** — an optional adornment in the **end** cell.

The grid keys off `[slot="leading"]` / `[slot="trailing"]` *presence*; everything else (default children or an
explicit `slot="label"`) is the label column, placed by DOM order. An absent slot leaves **no phantom gap** — the
presence-driven template collapses it.

```css
:scope { display: inline-grid; grid-template-columns: 1fr; }                 /* [label] — slotless */
:scope:has(> [slot='leading']):not(:has(> [slot='trailing'])) { grid-template-columns: auto 1fr; }
:scope:has(> [slot='trailing']):not(:has(> [slot='leading'])) { grid-template-columns: 1fr auto; }
:scope:has(> [slot='leading']):has(> [slot='trailing'])       { grid-template-columns: auto 1fr auto; }
```

## 2 · Roles — the content-kind axis (`data-role`, off the a11y channel)

What goes *into* a leading/trailing slot carries its **kind** on the node via **`data-role`**:

| `data-role` | kind | status | sizing family |
|---|---|---|---|
| `icon` | content icon | active | **frame** — fills the icon-sized cell |
| `caret` | inline affordance (chevron/arrow) | active | **rhythm** — `= font`, centered in the cell |
| `tag` | a small inline tag | **reserved** | additive — one `[data-role]` rule when it lands |
| `badge` | a count/status badge | **reserved** | additive — one `[data-role]` rule when it lands |

Three rules govern the role axis:

- **`data-role`, not the ARIA `role` attribute** — deliberately a `data-*` so the decorative styling taxonomy
  stays **off the accessibility channel**. The ARIA `role` belongs to the host (set via `ElementInternals`), never
  to an adornment.
- **Adornments are decorative** — mark them `aria-hidden`; the **label stays the accessible name**. A glyph never
  carries meaning assistive tech depends on.
- **Reserved roles are purely additive** — `tag` / `badge` land later as one `[data-role]` sizing rule each, with
  **no** new slot, column, or descriptor surface. The open-ended role axis is the point of the design.

## 3 · The four structures

Slot presence yields exactly four layouts; the canonical authoring example (`ui-button`):

| structure | slots present | grid template | example markup |
|---|---|---|---|
| `[label]` | — | `1fr` | `<ui-button>Save</ui-button>` |
| `[leading │ label]` | leading | `auto 1fr` | `<ui-button><svg slot="leading" data-role="icon">…</svg>Download</ui-button>` |
| `[label │ trailing]` | trailing | `1fr auto` | `<ui-button>Options<svg slot="trailing" data-role="caret">…</svg></ui-button>` |
| `[leading │ label │ trailing]` | both | `auto 1fr auto` | `<ui-button><svg slot="leading" data-role="icon">…</svg>Account<svg slot="trailing" data-role="caret">…</svg></ui-button>` |

The four are **position** structures — orthogonal to role, so each cell may hold any role. The canonical reading is
`[icon │ label │ caret]`, but because the axes are independent the **reversed** `[caret │ label │ icon]` (a leading
`data-role="caret"` + a trailing `data-role="icon"`) is equally valid — the slot still places, the role still
sizes. A trailing **content icon** (`slot="trailing" data-role="icon"`) is a supported role, distinct from the
caret affordance (ADR-0012).

## 4 · Position places, role sizes (the split)

The two axes map onto the sizing law's **frame/rhythm split** (`geometry-sizing-spec.md` §1.4) — placement is
frame-driven by *position*, glyph size is decided by *role*:

- **The cell is icon-sized, for either role.** Both adornment slots get the **same** square, `icon`-sized cell
  (border-box), so the grid column is icon-wide and the per-edge centering pad holds whichever role sits in it.
- **The glyph differs by role.** `data-role="icon"` (a content icon, **frame**) **fills** the cell
  (`= --ui-{cmp}-icon`). `data-role="caret"` (an inline affordance, **rhythm**) is sized to the label **font**
  (`--ui-{cmp}-glyph = --ui-{cmp}-font`) and **centers** within the icon-sized cell, landing at the emergent
  `½(h − font)` edge. Sizing a caret to the icon ramp is the named oversize "button caret" bug class
  (`geometry-sizing-spec.md` §4.6) — `caret = font` is the law, not a judgment call.
- **Padding is presence-driven and role-agnostic.** Each *present-slot* edge pads `½(h − icon)`, each *slotless*
  edge `h/2` — decided by the slot (position), **not** the role. The exact per-edge formulas are the frame law
  (`geometry-sizing-spec.md` §1.5 / `geometry.md`), not re-derived here.

For `ui-button` the concrete tokens are `--ui-button-icon` (the cell, the `--ui-ind` icon ramp) and
`--ui-button-glyph` (`= --ui-button-font`, the caret). A second control reuses the same two-token shape.

## 5 · The disclosure boundary (meaning rides the host, not the glyph)

A caret/chevron is **layout only** — it must never *announce* a popup it cannot guarantee. Disclosure semantics
live on the **host**, never on the adornment:

- **Glyph** — `aria-hidden`, presentation-only; it carries no `role` and no `aria-*` state.
- **Host** — popup/disclosure meaning (`aria-haspopup` / `aria-expanded`) rides the host via `ElementInternals`,
  wired when a real disclosure/menu control exists (**G7**). A plain button with a decorative caret therefore
  announces nothing — it never lies to assistive tech (ADR-0012).

## Mechanization

The anatomy facts this doc owns are placement, presence, and the position⟂role independence; their *sizing*
consequences are locked by the geometry probes (`geometry-sizing-spec.md` §6 — a law without a probe is not a
law). The load-bearing one:

- **`BTN-CARET`** — asserts the caret renders `= font` (not `--ui-ind`), `0 < caret < icon ≤ box`, and lands at
  the emergent `½(h − font)` edge — "the probe that would have caught the oversized caret."
- The icon-cell square + the four presence structures (grid templates, `½(h − icon)` / `h/2` per-edge pad) are
  the `BTN-*` source probes + the cross-engine geometry smoke.

## Decisions (source)

This doc carries no decisions of its own; it applies these ratified ADRs. Consult them for rationale,
alternatives, and open questions:

- [**ADR-0006**](../adr/0006-button-anatomy-optional-icon-slot-density-acceptance.md) — the optional leading slot,
  the presence-driven `:has()` host-as-grid, and the law-true `[density]` acceptance (the gap is the one
  density-bearing quantity; the frame is density-invariant).
- [**ADR-0012**](../adr/0012-button-anatomy-trailing-adornment-slot.md) — position slots × `data-role` roles as
  the **family** adornment standard: `leading`/`label`/`trailing`; `icon`/`caret` active + `tag`/`badge` reserved;
  position-for-placement / role-for-sizing; the disclosure boundary deferred to G7 on the host.

Sizing law this doc must not perturb: [`geometry-sizing-spec.md`](./geometry-sizing-spec.md) (the authority),
distilled in [`geometry.md`](./geometry.md). State styling of the same controls: [`interaction-states.md`](./interaction-states.md).
</content>
</invoke>
