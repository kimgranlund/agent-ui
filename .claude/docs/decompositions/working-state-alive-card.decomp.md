# Decomposition — GH #1104: card alive/working state during in-place A2UI updates (ADR-0199)

> Source: GH [#1104](https://github.com/kimgranlund/agent-ui/issues/1104) design leg (Understand+Plan), 2026-08-17 ·
> Contract: [ADR-0199](../adr/0199-working-state-live-surface-mutation.md) (proposed — **every build slice below is
> GATED on its ratification**; slice order is fixed, slices are individually shippable).

## Fork decision (recorded)

**(b) mint `:state(working)`** — a distinct fleet state, not an extension of ADR-0191's `pending`
(ratified opposite semantics: pending = displayed content is STALE, dim it; working = surface is LIVE
and mid-mutation, make it breathe) and not a surface-host-local `data-*` treatment (host-level boolean
visual states are `:state()` vocabulary members per the ADR-0191/0196 precedent discipline, and the
semantic recurs on `ui-sandbox-frame`/future streamed surfaces). Full rationale: ADR-0199 Context.

## Slices

| # | Slice | Files | Contract | Gate |
|---|---|---|---|---|
| S0 | **ADR-0199 ratification** (Kim) | `.claude/docs/adr/0199-…md` | literals (1600ms / 0.15–0.55 / 24px / primary alias) + both precedence edges open to revision at the flip | `adr_ratify.py` (ADR-0149) |
| S1 | **Tokens + reference repair** — mint `--ui-working-duration/-opacity-min/-opacity-max/-blur` in `dimensions.css` (:root constants, TKT-0066 non-direct-read note) + `--ui-working-color` alias in `tokens.css`; add `interaction-states.md` §7 (working axis: state, tokens, channel, precedence row, reduced-motion static law) | `shared/src/tokens/{dimensions,tokens}.css` · `references/interaction-states.md` | ADR-0199 cl.4/5 | `npm run check` + existing token/docs-grammar tests |
| S2 | **`ui-surface-host` wiring + CSS** — `working` boolean prop in `static props`; `connected()` effect mirroring into `internals.states` (`?.`-optional-chained, the `:state(settled)` precedent); `surface-host.css`: `--ui-surface-host-working-*` chain in the `:where()` token block + `:state(working)` overlay `::after` rule (inset shadow, opacity `@keyframes` breathe, `alternate infinite`, easing-standard) + `@media (prefers-reduced-motion: reduce)` static arm (`animation: none`, opacity held at max — never `display:none`); works under `[bare]`+`[wrap]` | `app/src/controls/surface-host/surface-host.{ts,css}` | ADR-0199 cl.1/3 | jsdom prop→state toggle probe + CSS pin-test (keyframes present, reduced-motion arm present, no geometry/`all` in the animation — the §4 lint shape) |
| S3 | **`ui-conversation` turn wiring** — in the `AgentTurnHandle`: on routing a line to a surface host (fresh or KNOWN id — the motivating in-place case), set that host's `working`; in the single guarded `endTurn` (both `finalize()` and `fail()` reach it, TKT-0034), clear `working` on every host this turn touched. No new events; no narration change | `app/src/controls/conversation/conversation.ts` | ADR-0199 cl.2 | jsdom: known-id update mid-turn ⇒ host `working===true`; after `finalize()` AND after `fail()` ⇒ `false`; double-end never wedges it (the endTurn guard) |
| S4 | **Real-engine motion smoke** — cross-engine browser test (the six-shard suite; extension rule per `component-testing`): with `working` set, the overlay's computed `animation-name` is the breathe keyframes and computed opacity changes across two rAF samples; under emulated `prefers-reduced-motion: reduce`, `animation-name: none` AND the overlay's computed opacity equals the max rung (static-visible, the "never nothing" law) | `app/src/controls/surface-host/surface-host-working.browser.test.ts` (new, sharded per the existing split) | ADR-0199 cl.3 reduced-motion arm | `npm run test:browser` exit 0 |
| S5 | **Both surfaces + pixel-truth** — verify in the agent-admin test chat (the issue's own Acceptance: pixel-truth on Kim's live surface, not merged-on-origin) AND on the docs-site surface-host preview page; screenshot evidence in the issue's Findings | agent-admin test chat · `site/` preview | issue Acceptance | live verification note + screenshots on #1104 |

Sequencing: S1 → S2 → S3 (S2/S3 could parallelize but share the app package — serialize to avoid a
double-edit); S4 after S2; S5 last. Each slice lands `npm run check && npm test` green by exit code.

## Non-goals (from ADR-0199, restated for the build lanes)

- No change to ADR-0191 `pending` semantics, tokens, or CSS.
- No AX/announcement channel (`aria-busy` explicitly rejected); narration strip unchanged.
- No per-binding flash-on-change treatment; no `ui-status-stream` wiring; no eighth event name.
- No `working` styling anywhere before S0 ratifies.
