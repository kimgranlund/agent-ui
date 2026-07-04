# ADR-0075 — ui-column A2UI-canvas-root refinements: the `stretch` fill attribute + the `align="center"` prohibition

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-07-04
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-07-04 |
> | **Proposed by** | component-builder territory (implementing Kim's directives, this session — "add a boolean attribute `stretch`…" + "no align center allowed on ui-column" + "remove align=center") |
> | **Ratified by** | Kim (2026-07-04) |
> | **Repairs** | `column.ts` (`static props` — new `stretch` prop; `align` enum narrowed) · `column.css` (new `:scope[stretch]` sizing rule; `[align='center']` repoint removed) · `column.md` descriptor (new `stretch` attribute + "Sizing" prose; `align` values narrowed) · `catalog.json` `Column.align` enum (center dropped; Row unchanged) · `site/pages/a2ui-live.ts` (`applyRootStretch`) + `site/pages/a2ui-live.css` (definite-width artboard) · column jsdom/browser/descriptor/css tests |
> | **Supersedes / Superseded by** | Extends ADR-0016 (the shared flex grammar) + ADR-0030 (column cross-axis default `stretch`). Neither is reversed — `align` keeps its ADR-0030 `stretch` default; this NARROWS the value set (drops `center`) and ADDS a column-local `stretch` sizing prop. **Depends on [ADR-0076](./0076-renderer-honors-catalog-declared-enums.md)** for the align-center prohibition to be effective in the rendered DOM. |

## Context

The A2UI live-agent canvas ([ADR-0069](./0069-a2ui-live-agent-demo-shape.md)) renders the agent's surface into a translate-centered `.canvas-surface` with a **definite** artboard width (a fixed `inline-size`, so the surface isn't in shrink-to-fit). Two ui-column defects surfaced against real agent output:

1. **Collapse.** A root `ui-column` (a common agent-emitted root) carries `container-type: inline-size` (its own query-container seam, `_surface/container.css`). Under the canvas's `align-items:center` flex parent, inline-size containment means its content contributes ~0 intrinsic inline size, so a root column shrink-collapses to a ~1ch strip and drags every descendant with it (even the text-field 20ch floor can't hold once the whole abspos chain is shrink-fit). A column needs a way to FILL its parent when it is the root.
2. **`align="center"`.** The agent kept emitting `align="center"` on columns. On a column the cross axis is inline/width, so `align-items:center` **shrink-wraps** children and centers them — defeating the ADR-0030 fill-width default and mis-serving the stacked content the tag exists to lay out. Kim ruled center is not allowed on `ui-column`.

## Decision

**1. `ui-column` gains a `stretch` boolean prop.** Reflected, default off → `width: stretch` (a fill-available cascade `-webkit-fill-available` / `-moz-available` / `stretch`, so it fills in every engine — a single custom-prop token can't hold the cascade, so it is the one sizing rule the `@scope` block owns directly). Present ⇒ the host FILLS its parent's available inline size instead of shrink-wrapping. It is **column-LOCAL** — deliberately NOT folded into the shared `flexProps` grammar, so `ui-row`/`ui-grid`/`ui-list` are unaffected. The A2UI canvas sets it on a **root** `ui-column` (`applyRootStretch`, re-applied each render since `updateComponents` can replace the root) so the rendered surface fills the artboard.

**2. `align="center"` is PROHIBITED on `ui-column`.** The `align` enum is narrowed from the shared 5-member `flexProps` set to the 4-member `[stretch, start, end, baseline]` (center dropped). `stretch` LEADS the array so it is BOTH the default AND the invalid-value snap target (`enumType.from` falls to `values[0]`) — an `align="center"` *attribute* snaps the prop back to `stretch`. `column.css` drops its `[align='center']` repoint, so even a raw attribute cannot center (it stays at the `stretch` base). The catalog's `Column.align` enum drops `center` too (Row keeps the full grammar). Horizontal centering ⇒ use a `ui-row` or wrap the content.

## Consequences

- **A root column fills the artboard; a card centers at its natural width.** The canvas keeps `align-items:center`, so a column-rooted surface fills (via `stretch`) while a card-rooted surface centers — the right default for both.
- **The `align`-center prohibition is enforced in three layers:** type (`el.align = 'center'` is a compile error), runtime attribute (snaps to `stretch`), and CSS (no `[align='center']` rule). BUT the catalog factory applies props via the property SETTER, which bypasses the component's own coercion — so the DOM-attribute layer is only closed by **[ADR-0076](./0076-renderer-honors-catalog-declared-enums.md)** (the renderer honoring the catalog enum). This ADR + 0076 are two halves of one story.
- **`stretch` is a sizing escape-hatch, not grammar.** It sits OUTSIDE the ADR-0016 role-pure `--ui-column-*` token model (a multi-declaration fill cascade can't be tokenized); the header comment records the one exception.
- **No visual regression:** `stretch` is opt-in (default off); the align narrowing only removes a value that shrink-wraps (an anti-pattern), and center already had a repoint that is now simply gone.

## Acceptance

- `npm run check` (packages + site) green; jsdom + column browser (Chromium+WebKit) green; `npm run size` within the family budget (the `stretch` prop adds ~6 B gz).
- Column tests: `column-stretch-reflect` + a cross-engine fill proof; `column-no-center` (attribute snaps to stretch) + a cross-engine "center does not center" proof; the descriptor contract↔props trip-wire mirrors the narrowed enum + new prop; `column-css` asserts NO `[align='center']` rule.

## Alternatives considered

- **Fold `stretch` into shared `flexProps`.** Rejected: `ui-row`/`ui-grid`/`ui-list` do not want a fill-width default; the need is column-root-specific.
- **`align-items:stretch` on `.canvas-surface` instead of a per-column attribute.** Rejected: Kim asked for the explicit `stretch` attribute, and cards should center at natural width while columns fill — a blanket stretch on the surface would force lone controls full-width.
- **Keep `center` but make it a no-op via CSS only.** Rejected: leaves an inert `align="center"` attribute in the DOM and a compile-legal value; narrowing the enum makes the prohibition real at the type + catalog level.
