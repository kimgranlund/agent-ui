---
doc-type: ticket
id: tkt-0011
status: open
date: 2026-07-10
owner:
kind: feature
size: big
---
# TKT-0011 — `ui-color-picker`: the color-input control

## Summary
Kim's ask (2026-07-10): a `ui-color-picker` — learn from
`https://ui-kit.exe.xyz/site/components/color-picker` and
`/Users/kimba/Projects/adia/gen-ui-kit/packages/web-components/components/color-picker/`
(exists, verified — full component incl. `color-picker.test.js`). Dedup: **greenfield as a
control, with a NAMED fence to honor** — ADR-0118 (token-surfaces, the concurrent
design-system intake) deliberately excluded exactly this scope from its display family:
*"a color picker owes channel models, gamut UI, precision input"* (0118 Context). This
ticket IS that fence's other side: ui-swatch/ramp/ladder DISPLAY color values; the picker
INPUTS them — complementary jobs, and the intake must keep the boundary crisp (a picker may
well COMPOSE a swatch; it never re-owns value rendering). No text-field `type` covers color
(the 12-type enum has none).

## Research inputs (for the design intake, recorded verbatim)
- The exe.xyz color-picker docs page (fetch at intake).
- The adia family: `color-picker.class.js` (interaction model), `.css` (the pad/channel
  geometry), `.test.js` (proven behaviors), `.a2ui.json` (its old catalog shape); promote to
  this fleet's laws, never port.

## Acceptance
- A design intake via `agent-ui-component-design` resolves the forks before any build:
  - **The value model** — what `value` speaks (hex/rgb/hsl/oklch) and the CANONICAL form,
    as a color **value-codec** in the ADR-0044/0047 codec dialect (parse/format/validity).
    This fleet's tokens are OKLCH-native — argue whether the canonical form follows
    (OKLCH-canonical, hex-interoperable?) or stays sRGB-hex for the web's lingua franca;
    gamut handling fenced explicitly either way.
  - **The vehicle(s)** — standalone `ui-color-picker` (a value-bearing `UIFormElement`
    composite) AND/OR a `text-field type=color` leg that lazily composes it into the Wave-4
    overlay — **the ADR-0048 calendar precedent is exact** (type=date → overlay calendar);
    argue both-now vs standalone-first-with-a-trigger.
  - **The 2D interaction** — the saturation/lightness pad is a genuinely new interaction
    class (the `value-drag` trait covers 1D sliders; a 2D pad + hue/alpha channel sliders is
    the novelty leg firing): keyboard stepping in TWO axes, the ARIA model for a 2D slider
    (the hardest a11y in the ask — design it first, not last), pointer capture, and the
    channel sliders likely REUSING `ui-slider`'s machinery where honest.
  - **Anatomy** — pad · channel sliders · value readout/input · optional preset swatches
    slot (position slots × roles); whether the readout is an embedded `ui-text-field`.
  - **Geometry** — pad/channel/swatch quantities under the `[scale]` lookup dialect
    (ADR-0038); size-class assignment (likely Pattern; the novelty leg may propose rows).
  - **Catalog posture** under ADR-0087 — an agent asking a user to pick a color is
    plausible Gen-UI (forms, theming asks); argue it, don't default it.
  - Events ⊂ allowlist (`input` while dragging · `change` on commit — the slider precedent);
    eyedropper (the `EyeDropper` API — Chromium-only; propose as a progressive-enhancement
    fork or non-goal); forced-colors/contrast behavior of the pad itself.
- The shipped control meets the full per-control bar (descriptor, jsdom + cross-engine
  browser probes incl. whole-shape + REAL pointer-drag geometry + the 2-axis keyboard
  proof, independent review, barrels/exports/size, doc + demo pages).

## Links
- The two research inputs above.
- ADR-0118 (`.claude/docs/adr/0118-token-surfaces-v1-scope.md`) — the fence this ticket is
  the other side of; its ui-swatch is the display counterpart (compose, never re-own).
- ADR-0044/0047 (the value-codec dialect) · ADR-0048 (the type=date → overlay-calendar
  composition precedent) · ADR-0038 (geometry lookup) · ADR-0087 (catalog posture).
- `packages/agent-ui/components/src/traits/value-drag.ts` — the 1D precedent the 2D pad
  extends or siblings.
- `.claude/skills/agent-ui-component-design/` — the intake procedure.

## Scope / Open
- **Open:** alpha channel in v1 (prior art likely has it — verify at intake); preset/recent
  swatches (slot vs prop vs non-goal); the OKLCH-vs-sRGB canonical question above (the one
  fork that touches the design system's identity — Kim likely wants a say); whether the
  token-surfaces family's `ui-swatch` (in design, other session) ships first and gets
  composed, or the picker renders its own preview until it exists (sequencing dependency).
- **Non-goal:** porting either prior art's full API; palette GENERATION (palette-design is
  a skill/tooling concern, not this control); re-owning ADR-0118's display surfaces.
- **Sequencing:** design intake first; no build from this ticket directly. Queue: fourth
  behind TKT-0008/0009/0010, Kim's call on order.

## Findings
