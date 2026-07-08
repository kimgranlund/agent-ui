# ADR-0104 — `ui-tabs` drops its self-seeded surface plane: transparent by default (ADR-0015 cl.1), the plane becomes an asked-for intent

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-07-08
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-07-08 *(authored)* |
> | **Proposed by** | system-planner — the design seat; ticket #29 (pattern-wizard: tabs-in-card double surface), fork-diagnosed to `tabs.css:20` |
> | **Ratified by** | Kim (host) · 2026-07-08 — Status flipped in Kim's own 0101–0106 ratification round (his approved→accepted sed, landed `e30ac3e`); cell was stale-pending until the 2026-07-08 housekeeping pass |
> | **Repairs** | on ratification+build: `controls/tabs/tabs.css:16-20` (delete the `--ui-container-bg: var(--md-sys-color-neutral-surface)` seeding + rewrite the two banner comments claiming "a bare tabs still draws a plane", `:4` and `:11-12`) · `controls/tabs/tabs.md` surface paragraph · `tabs-css.test.ts:45` (the seeding assertion inverts into a negative control) · `site/pages/tabs-doc.ts` + `site/pages/tabs-demo.ts` specimens gain explicit `elevation="0"` (repair, see §Consequences) · `site/pages/a2ui-live.ts:138` chrome tabs: verify-at-build (its pane sits on the app shell) · `a2ui-catalog.spec.md` §5.2 Tabs row note. Decomp: [`css-less-consumer-family.decomp.json`](../decompositions/css-less-consumer-family.decomp.json) |
> | **Supersedes / Superseded by** | Applies **ADR-0102** (the law; lane = restore the safe default, intent stays Lane B via the *already-shipped* `elevation`/`brightness` catalog props). Amends the tabs-specific seeding decision recorded in `tabs.css`'s ADR-0015-era banner — ADR-0015's own clauses (transparent base, the `--ui-container-*` seam, the two axes) stand unchanged; relates ADR-0100 (the same session's mount-surface work the acceptance rides) |

## Context

`tabs.css:16-20` deliberately deviates from the container family's transparent base: a `:where(ui-tabs)`
token block seeds `--ui-container-bg: var(--md-sys-color-neutral-surface)` "so a bare `<ui-tabs>` still
draws a plane" — container.css's own banner (`container.css:27-29`) names card/modal/tabs as the three
elements granted a default surface.

On an A2UI surface that grant misfires deterministically: the pattern-wizard seed composes
`Card elevation='1' > CardContent > … Tabs` (`catalog-coverage.ts:115-119`); the card paints its elevated
plane, and the bare tabs paints `neutral-surface` on top — a wrong-colored second box inside the card
(ticket #29's screenshot). The model did not ask for a plane; it *cannot* un-ask — there is no
"no surface" value on the shipped axes (`elevation`/`brightness` enums have no `none`; an unset axis is
what *should* mean "no plane", and for every other layout container it does). A page author would write
`ui-tabs { --ui-container-bg: transparent }`; the catalog consumer has no such verb (ADR-0102 / ADR-0096).

How the fleet's other surface-owners handle nesting confirms the split: **card-in-card composes** — a
card's plane is its identity (with border/radius/shadow anatomy, G9's elevation/brightness model), and
nested same-plane cards stay delineated by that anatomy. `ui-tabs` has no such anatomy: its identity is
the tablist strip, the indicator, and the divider (`tabs.css:53-59`); the plane was a bolted-on
convenience for the bare-on-page case, not part of the pattern's identity.

## Decision

We make `ui-tabs` **transparent by default**, restoring ADR-0015 cl.1's base for it:

1. **Delete the seeding** (`tabs.css:20`) and the banner claims built on it. A bare `ui-tabs` passes its
   parent's surface through — inside a Card it reads as ONE surface with zero seed/model change; on a page
   it sits on the page's own plane. The strip divider, tab inks, and indicator (the pattern's real
   identity) are untouched.
2. **A plane becomes an asked-for intent, symmetrically for both consumer classes.** The already-shipped
   `elevation`/`brightness` axes (catalog-reachable on the Tabs row since ADR-0087; page-reachable as
   attributes) are the one mechanism: `<ui-tabs elevation="0">` draws exactly the old default plane. No new
   prop, no new token, no new rule — this ADR only removes a wrong default; the intent lane already exists.
3. **Card and modal keep their default planes.** The law's test is identity: a card IS a surface (its
   anatomy delineates nesting); a modal IS a surface over a scrim. Tabs was the odd member of
   `container.css:29`'s trio, and leaves it.

## Acceptance

- Cross-engine browser legs: a bare `ui-tabs` inside `ui-card[elevation='1']` computes
  `background-color: transparent` on the tabs host (rgba(0,0,0,0)) — the card's plane shows through;
  `ui-tabs[elevation='0']` computes the `neutral-surface` resolution (the preserved intent leg). Negative
  control: re-adding a token-block seeding fails the transparency leg.
- `tabs-css.test.ts:45` re-keyed: asserts the token block does NOT seed `--ui-container-bg`.
- The pattern-wizard seed renders one card surface on an unmodified A2UI mount — screenshot-verified.
- `tabs-doc`/`tabs-demo` pages render their specimens with a plane via explicit `elevation="0"` —
  visually unchanged from today against the `canvas-surface` grid stage.
- `npm run check && npm test` + `test:browser` green.

## Consequences

- **A breaking visual change for any bare `ui-tabs` on a non-`neutral-surface` background.** Measured
  reliance: `tabs-css.test.ts:45` (asserts the seeding — re-keyed); `tabs-doc.ts:23`/`tabs-demo.ts:20`
  specimens sit on `.canvas-surface` (`neutral-surface-low` + a `neutral-surface` grid texture,
  `canvas-surface.css:16-18`) where the plane IS load-bearing today — repaired with one explicit
  `elevation="0"` each, which also dogfoods clause 2's intent lane; `a2ui-live.ts:138`'s chrome tabs sit on
  the app-shell pane — flagged verify-at-build (expected: the shell plane reads through, an improvement or
  no-op, but it is a *visible page* and gets a screenshot check, not an assumption). The shipped corpus
  exemplars and other seeds place Tabs inside Cards — repaired-by-default.
- **A bare tabs dropped onto an arbitrary dark/odd host background no longer self-rescues with a plane.**
  Accepted: that self-rescue is exactly what painted the wrong box inside every composed surface; the
  consumer who knows the background owns the intent (one attribute), per ADR-0102.
- **`container.css:29`'s comment trio (card/modal/tabs) shrinks to card/modal** — repaired in-change.
- **Out of scope, unchanged:** the `--ui-container-*` seam and both axes (ADR-0015), tab-row geometry and
  inks, the Tabs catalog row (already carries the axes), card/modal defaults.

## Alternatives considered

- **Composition-aware surface ("paint the plane only when not inside another surface").** Rejected: the
  component would have to enumerate ancestor surface-owners (`ui-card ui-tabs`, `ui-modal ui-tabs`,
  `[elevation] ui-tabs`, …) — an open set that misses host-app backgrounds by construction (a tabs inside a
  host's painted `<section>` still double-paints), inverts the fleet's local-seam surface model (ADR-0015
  cl.2: an element's surface is its own, set through its own seam, never inferred from ancestry), and adds
  a selector-maintenance treadmill every new surface-owner must join. The consumer that knows the
  composition already has the knob; ancestry-guessing is a worse oracle.
- **A `surface="none"` (or axis value) opt-OUT prop, default plane kept.** Rejected: fixes nothing by
  default — every composed A2UI payload would depend on model uptake to *remove* a plane it never asked
  for (ADR-0096 alternative 1's probabilistic-mitigation failure); and it mints a second surface vocabulary
  beside the shipped axes.
- **Seed/teaching-side (exemplars set Tabs `brightness` to match their card).** Rejected: repairs the
  corpus, not the contract — every future composition re-inherits the trap, and matching a parent's plane
  from the child is exactly the ancestry knowledge components don't have.
- **Keep the plane; restyle it to match card's plane.** Rejected: identical colors merely hide the box on
  DEFAULT cards; any elevated/brightness-shifted parent re-exposes it (the reproduced case IS
  `elevation='1'`).
