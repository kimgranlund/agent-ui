# ADR-0183 — View Transitions (GH #740): ONE shared `withViewTransition` seam in `components/dom`, per-surface OPT-IN booleans (router outlet · super-shell segments · a CSS-only `@view-transition` for the MPA docs site), progressive-enhancement-only — un-fencing ADR-0115 cl.7's named future candy; the A2UI re-render surface is DESIGN-DEFERRED to its own booked slice

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-08-12
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-08-12 |
> | **Proposed by** | host session (GH [#740](https://github.com/kimgranlund/agent-ui/issues/740)'s design intake; Kim's same-morning clarify ruling: ALL FOUR candidate surfaces are in scope) |
> | **Ratified by** | kimgranlund (repo owner), 2026-08-12, via the [`ratify ADR-0183` utterance](https://github.com/kimgranlund/agent-ui/pull/743#issuecomment-5262035942) — verified + flipped by `scripts/adr_ratify.py` (ADR-0149) |
> | **Repairs** | on ratification: none owed elsewhere (ADR-0115 cl.7's fence text stays as history — this ADR IS the "earns its own record" record it demanded; `prd/router.prd.md` §Non-goals' trigger line is satisfied by Kim's mobilization ruling, no edit needed) · on ratification+build: shipped WITH this ADR in the same PR (cl.2–cl.5 below) + the S4 follow-up issue for the A2UI surface (cl.6). |
> | **Supersedes / Superseded by** | **Un-fences** [ADR-0115](./0115-spa-router-v1-scope.md) cl.7's view-transitions item (the one named "natural future candy" — every OTHER cl.7 fence stands untouched) · **Relates** [ADR-0022](./0022-childpart-native-movebefore-reorder-focus.md) (the `moveBefore` identity work is exactly why the A2UI surface is deferred, cl.6) · **Resolves** the design-intake half of GH #740 (the build ships alongside; the issue closes when the S4 follow-up is filed and the PR merges). |

## Context

Kim's ruling (2026-08-12, the AskUserQuestion clarify round GH #740's intake could not run): View
Transitions land on **all four** candidate surfaces — `@agent-ui/router` navigation, `ui-super-shell`
pane/tab swaps, A2UI surface re-renders, and the MPA docs site. Verified platform facts: same-document
`document.startViewTransition` (Level 1) ships in Chromium 111+/Safari 18+; cross-document
`@view-transition` (Level 2) in Chromium 126+/Safari 18.2+; Firefox has neither behind default flags at
intake time — so every design below MUST be progressive enhancement (the issue's own acceptance).

## Decision

1. **ONE shared seam, in `components/dom`.** `withViewTransition(mutate, enabled)` +
   `viewTransitionAvailable()` (`dom/view-transition.ts`): run `mutate` inside
   `document.startViewTransition` iff `enabled` AND the API exists AND `prefers-reduced-motion` is not
   set; synchronously otherwise. `components/dom` is the one home every same-document surface can import
   without a layering violation (`components ← {router, a2ui, code} ← app`). The one stated caveat: the
   transition path runs `mutate` asynchronously (the platform snapshots first) — callers with staleness
   guards re-check INSIDE `mutate`.
2. **Router (S1, shipped here): `viewTransitions` boolean prop on `ui-router-outlet`** (attribute
   `view-transitions`, default `false`) wrapping the ONE `#swap` site every path funnels through — sync,
   async-resolved, and clear alike. The last-navigation-wins token re-checks inside the transition
   callback; a no-op clear (already empty) never transitions; the flag is read `untracked` so a toggle
   never re-runs the route effect (which would re-invoke the factory). `.router` stays property-only —
   SPEC-R5's serializability rationale never applied to a boolean.
3. **Shell (S2, shipped here): `viewTransitions` boolean prop on `ui-super-shell`** wrapping
   `#setActiveSegment`'s visibility flips ONLY. Band crossings stay pure CSS (the shell family's
   no-JS-on-resize law) — unwrappable and deliberately unwrapped. The pane-tabs strip's `selected`
   mirror stays OUTSIDE the wrap (chrome state, not swapped content).
4. **Named-element morphs are the CONSUMER's vocabulary, not shipped defaults.** The platform's own
   `view-transition-name` CSS is fully usable by consumers on top of the shipped cross-fade; the fleet
   ships no names of its own in this wave (a names convention, if ever, is a separate intake).
5. **Docs site (S3, shipped here): CSS-only Level 2** — `@view-transition { navigation: auto }` in
   `_page.css` + a reduced-motion suppression of the transition pseudo-elements. Zero JS; the MPA
   posture (ADR-0115's own fence) is untouched.
6. **A2UI re-renders (S4): DESIGN-DEFERRED to its own booked slice, not silently dropped.** Two real
   unknowns make a same-PR ship dishonest: (a) the renderer applies updates incrementally per streamed
   message — there is no single swap site, and wrapping per-message would strobe a whole-document
   snapshot on every chunk; (b) the ADR-0022 `moveBefore` identity work touches the same swaps — the
   interaction (double-animation, identity conflicts) needs its own analysis. The follow-up issue is
   filed with this PR; its design question is "which grain is the transition boundary for a streamed
   surface" (candidate: `finalize(surfaceId)`), not "whether".

## Consequences

- Default-off everywhere: every no-opt-in, no-API, and reduced-motion path is byte-identical to before
  this family existed — the helper's truth table is unit-pinned, and the outlet/shell behavior is
  pinned at both the jsdom (stubbed API) and real-engine (genuine `startViewTransition` on Chromium,
  feature-detect honesty on WebKit) grains.
- `@agent-ui/router`'s ≤4.0 KB gz marginal (ADR-0115 cl.8, ADR-0040 manual gate) re-measured with the
  new prop — the helper itself is ~30 lines and lives in components (already counted in its own line).
