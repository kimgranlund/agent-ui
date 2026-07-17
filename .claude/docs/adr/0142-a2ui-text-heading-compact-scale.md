# ADR-0142 — the A2UI catalog's `Text` heading fan-out shifts one M3 tier down, for compact generative-UI scale (amends ADR-0078 cl.5's table)

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-07-17
>
> | Field | Value |
> |---|---|
> | **Status** | proposed |
> | **Date** | 2026-07-17 |
> | **Proposed by** | bug-report intake ([TKT-0082](../tickets/tkt-0082-a2ui-text-heading-sizes-too-large-for-generated-ui.md) — Kim's screenshot: a Quizmaster quiz-card title/question rendering at document-headline scale, "the font-sizes are crazy... this is pointless when generating UI") |
> | **Ratified by** | pending — Kim |
> | **Repairs** | on ratification: `a2ui-catalog.spec.md` §5.2 `Text` row · `a2ui-catalog.lld.md`'s `textFactory` description · this ADR's own Status cell |
> | **Supersedes / Superseded by** | **Amends [ADR-0078](./0078-ui-text-three-axis-variant-size-as.md) cl.5** (the wire→triple fan-out table only; cl.5's other content — the wire vocabulary staying protocol-unchanged, the real-heading `as` stamp, `catalog.json` untouched — all STAND). Relates [ADR-0025](./0025-ui-text-display-primitive-type-scale.md) / ADR-0078 (both rule `ui-text`'s OWN type scale density-invariant for its docs-site context — untouched by this change, which is scoped to the A2UI catalog's separate mapping choice, never to `ui-text`/`text.css`). |

## Context

ADR-0078 cl.5's `textFactory` fan-out table maps the A2UI wire's `Text.variant` (`h1…h5|caption|body`,
catalog-frozen) onto `ui-text`'s M3 type scale via a **nearest-M3-row-per-heading-level** principle —
correct for `ui-text`'s own origin context (docs-site prose headings) but reused wholesale for a
fundamentally different consumption path: every A2UI surface this catalog renders is a compact
card/dashboard/quiz tile, not a document. TKT-0082's screenshot is the measured consequence: a
36px `h1` towering over a small generated quiz card, triggered by a persona (`quiz-round`,
`site/pages/agent-admin-presets.ts:268`) whose prompt says "Question as Text" with no size guidance
— the model free-picks a heading level the fan-out then renders at document scale regardless of the
small surface it's embedded in.

## Decision

Shift every heading row exactly ONE M3 tier down from ADR-0078 cl.5's table (display→headline,
headline→title), preserving the SAME nearest-row-per-level shape and keeping all five heading sizes
strictly distinct and monotonically decreasing — never collapsing two adjacent levels to the same
token (the failure mode a first draft of this fix hit and a review caught: `title/sm`+`label/lg`
tie at 14px). `catalog.json`'s wire enum is UNCHANGED; only `factories.ts`'s `TEXT_VARIANT_TABLE`
moves:

| Wire `variant` | → `as` | → `variant` | → `size` | Rendered (cl.5's table) | Rendered (this ADR) |
|---|---|---|---|---|---|
| `h1` | `h1` | `headline` | `md` | 36px (`display/sm`) | **28px** |
| `h2` | `h2` | `headline` | `sm` | 32px (`headline/lg`) | **24px** |
| `h3` | `h3` | `title` | `lg` | 28px (`headline/md`) | **22px** |
| `h4` | `h4` | `title` | `md` | 24px (`headline/sm`) | **16px** |
| `h5` | `h5` | `title` | `sm` | 22px (`title/lg`) | **14px** |
| `body` | `none` | `body` | `md` | 14px | 14px — unchanged |
| `caption` | `none` | `body` | `sm` | 12px | 12px — unchanged |

Every rendered heading size stays at or above `body`'s own 14px (a heading never reads smaller than
prose); `h5`'s 14px ties `body`'s numeric size but stays visually distinct by weight (`title-small`
weight 500 vs `body-medium` weight 400, `dimensions.css:144,151`) — the SAME weight-only distinction
`h5` already relied on before this change (it was never the size axis alone carrying that
distinction), so this is not a new tradeoff, only a smaller one.

## Consequences

- **A2UI-generated heading Text now reads at compact/card scale**, fixing TKT-0082's reported defect
  across every persona/mini-skill, not just Quizmaster's — the wire enum is unconstrained, so any
  producer could otherwise free-pick an oversized heading level.
- **`ui-text`/`text.css` (packages/agent-ui/components) are untouched.** ADR-0025/ADR-0078's
  density-invariant type-scale rule for `ui-text` itself is not reopened; this amends only the A2UI
  catalog's separate choice of which `ui-text` variant/size pair each wire heading level maps to.
- **Visual reshaping of existing A2UI exemplars/demos that use heading-level Text** — e.g. the
  shipped dashboard-KPI mini-skill idiom's big-number `h3` (28px→22px) and the gallery `Card` preview
  specimen's `h5` header (22px→14px, `site/lib/component-preview.ts:224`) — both re-verified to
  still read correctly (a smaller but still-bolder-than-body heading), not a regression, just
  smaller. No pixel-golden/snapshot pins the old sizes anywhere in the tree (confirmed by grep).
- **Stale-record repair, same change:** `a2ui-catalog.spec.md` §5.2's `Text` row and
  `a2ui-catalog.lld.md`'s `textFactory` description both still cite cl.5's original table verbatim
  as of this ADR's authoring — repaired on ratification (not before, per this repo's ADR discipline:
  a `proposed` record does not get to rewrite a living reference ahead of Kim's ratification).

## Acceptance

- `npx vitest run packages/agent-ui/a2ui` green with `factories.test.ts`'s fan-out table updated to
  match the table above.
- `npm run check && npm test` green.
- On ratification: `a2ui-catalog.spec.md` §5.2 and `a2ui-catalog.lld.md`'s `textFactory` description
  updated to this ADR's table; this ADR's own Status cell flips to `accepted`.

## Alternatives considered

- **Keep cl.5's table, fix only the Quizmaster persona's prompt** — rejected: the wire enum is
  catalog-wide and unconstrained; any future persona/mini-skill could re-trigger the identical defect
  with a different heading level. A prompt-level fix treats one symptom, not the catalog's own
  context-blind mapping.
- **A context-aware/density-aware type mechanism for `ui-text` itself** (container queries, a new
  `[density]` fan-out for type) — rejected as disproportionate: ADR-0025/ADR-0078 already rule type
  density-invariant for `ui-text`'s own docs-site use, deliberately; reopening that for one catalog
  consumption path would touch a component contract two ratified ADRs settled, for a problem fully
  solvable at the catalog's own mapping seam.
- **A first draft's 24px-capped ladder** (`headline/sm · title/lg · title/md · title/sm · label/lg`)
  — rejected on review: `title/sm` and `label/lg` resolve to IDENTICAL tokens (14px/weight
  500/line-height/tracking, `dimensions.css:144-146` vs `:158-160`), collapsing h4/h5 to visually
  indistinguishable rows — violates the strictly-decreasing-and-distinct criterion this ADR states
  as load-bearing.
