# Decomposition — M1, the app-shell anchor

> `system-decompose` · domain **technical-architecture** · **PLAN** mode · v1 · 2026-07-05
> Manifest: [`m1-app-shell.decomp.json`](./m1-app-shell.decomp.json) — `coverage_check.py` **clean at exit 0** (13 nodes · 16 actions · 16 hosts · 8 edges; `--strict` clean too).
> Traces up to: [`../prd/agent-app-surfaces.prd.md`](../prd/agent-app-surfaces.prd.md) §6 (M1) · PRD-G2/G6 · PRD-D1/D3/D4/D5 (ratified 2026-07-05).
> Hands off to: the M1 SPEC (behaviour, `SPEC-R#`) → the M1 LLD (implementation, `LLD-C#`) → the M1 build fan-out.

## Quadrant verdict

**Load-bearing.** Both planes cross-check: every INSIDE-OUT capability (a1–a16) hosts on an OUTSIDE-IN
node, and every leaf node hosts a capability. No unhosted action, no unjustified structure.

## OUTSIDE-IN (structure — system → subsystems → modules)

```
M1 — the app-shell anchor (n0)
├─ n1  package scaffold + layering boundary        [SERIAL PREP — the fixed base]
│  ├─ n1a  @agent-ui/app package scaffold (package.json deps={components,a2ui,shared} · tsconfig · src/index.ts)
│  └─ n1b  import-layering trip-wire (app/src/layering.test.ts — no cycle, nothing imports the apex) + NC
├─ n2  the ui-app-shell layout primitive
│  ├─ n2a  element build — app-shell.{ts,css,md} (region/docking over the G9 layout family)
│  ├─ n2b  gates — jsdom probes + cross-engine whole-shape/reflow browser smoke
│  └─ n2c  opt-in isolation mode + the 3-leg browser validation (tokens reach · style · no-leak), escalate-on-fail
├─ n3  the reference app
│  └─ n3a  a2ui-live re-hosted on <ui-app-shell> (bespoke shell CSS removed, net-negative LOC)
└─ n4  integration + verification                  [SERIAL INTEGRATION + reviewer]
   ├─ n4a  public barrel + measure-size.mjs @agent-ui/app line-item + tree-shake proof
   └─ n4b  independent component-reviewer pass (pre-commit NO-GO gate, ≥4 both axes)
```

## INSIDE-OUT (behaviour — capabilities the slice must deliver)

Create the apex package (a1) · guarantee no cycle / apex un-imported (a2) · lay out regions (a3) · dock a
surface (a4) · reflow to own container width (a5) · optionally isolate from a host page (a6) · keep tokens
reaching isolated controls (a7) · keep host CSS out (a8) · survive forced-colors (a9) · assemble a2ui-live
with zero bespoke CSS (a10) · expose the shell through the public barrel (a11) · budget the marginal size
(a12) · descriptor + contract↔props trip-wire (a13) · reviewer ≥4 (a14) · escalate-on-isolation-fail (a15) ·
prove layout+reflow cross-engine whole-shape (a16).

## Build order (edges — each a real data dependency)

`n1a → {n2a, n1b}` · `n2a → {n2b, n2c, n3a}` · `n2c → {n4a, n4b}` · `n2b → n4b`.
Serial PREP is **n1a** (the package base). The serial INTEGRATION slice is **n4a** (the only writer of the
shared `scripts/measure-size.mjs`). Everything else is file-disjoint and parallel-safe: `n2b`, `n2c`, and
`n3a` fan out off `n2a`; `n1b` fans out off `n1a`.

## Slicing for the fan-out (one writer per file)

| Slice | Owns (files) | Kind |
|---|---|---|
| n1a | `packages/agent-ui/app/{package.json,tsconfig.json,src/index.ts}` + root workspace list | **serial PREP** |
| n1b | `packages/agent-ui/app/src/layering.test.ts` | parallel (after n1a) |
| n2a | `packages/agent-ui/app/src/controls/app-shell/{app-shell.ts,.css,.md}` | parallel (after n1a) |
| n2b | `.../app-shell/app-shell.test.ts` + `app-shell.browser.test.ts` | parallel (after n2a) |
| n2c | isolation legs (extends `app-shell.ts` + `app-shell.browser.test.ts` isolation block) | parallel (after n2a) |
| n3a | `site/pages/a2ui-live.{ts,css}` ONLY (shared `_page.css` untouched — deferred, F5) | parallel (after n2a) |
| n4a | `packages/agent-ui/app/src/index.ts` (export) + `scripts/measure-size.mjs` | **serial INTEGRATION** |
| n4b | — (reviewer verdict, no file) | gate (after n2b/n2c) |

> **One coupling to resolve in the LLD:** n2c (isolation legs) and n2b both touch `app-shell.browser.test.ts`.
> The LLD should either split the isolation legs into `app-shell-isolation.browser.test.ts` (fully disjoint)
> or serialize n2b→n2c on that one file. Flagged as an LLD build-sequence decision, not a coverage gap.

## Negative controls (every new gate ships one, anchored on a unique token)

- **n1b (layering):** plant an upward/self `@agent-ui/app` import inside `a2ui` (or a `components→a2ui`
  edge) on a unique token → the test must go red; grep-confirm the mutation applied.
- **n2b (browser):** the whole-shape assertion must bite on a zero-width/collapsed region (the ui-slider
  "dot" lesson) and the reflow assertion on a non-reflowing fixed layout; **ADR-0084** — the
  `collapse="stack"` leg must bite when the stack rule is dropped (the region hides narrow).
- **n2c (isolation):** the no-leak leg must bite when a host-page rule DOES reach the control (isolation off); the **F1b isolated-layout leg** must bite when the `:host` grid variant is NOT injected into the shadow (regions land un-placed).
- **n4a (size):** a planted over-budget number must fail the size gate.

## Forks — RESOLVED (Kim, 2026-07-05)

1. **Region model + docking (was forks #1+#2) — RESOLVED: generic `<ui-app-shell-region region="…">`.** Kim
   ratified the generic element over five named `ui-app-shell-{region}` sub-elements (agent/a2ui
   data-targetability + fewer tags/one descriptor > the ui-card named-sub-element consistency argument,
   which was weighed and lost). Docking collapses into composition — the developer authors the region
   element; no attribute-on-arbitrary-child. Affects n2a anatomy + a3/a4 (both host on n2a).
2. **Isolation mechanism (was fork #3) — RATIFIED → [ADR-0082](../adr/0082-app-shell-per-instance-isolation.md).**
   Per-instance `isolated` + `attachShadow` at connect (not class-level `static shadow`); fleet + shell CSS
   injected INTO the shadow (incl. `foundation-styles` ramp); **plus the F1b `:host` grid variant** so
   relocated in-shadow regions keep their `grid-area` + `@container` reflow (n2c leg d). ADR-0082 back-edits
   PRD-D3/Fork-3 · plan §5 · §12.
3. **The a2ui dependency at M1 — stands.** `@agent-ui/app` declares the (unexercised) `a2ui` dep now for
   M2's canvas-host; n1a/n1b accept it. *Minor.*

## M1-polish refinements — RATIFIED (Kim, 2026-07-06; surfaced by the a2ui-live dogfood, C9)

4. **Region role-decouple — [ADR-0083](../adr/0083-app-shell-region-role-decouple.md) (accepted).** Optional
   `landmark` prop overrides the ARIA role independently of the `region` column (a2ui-live's composer wants the
   `navigation` column but a `complementary` landmark). Additive/back-compat; a *refinement* of the ratified
   generic model (fork #1), only possible because the region is generic. Resolver `internals.role = landmark ||
   REGION_ROLE[region]` (`||` NOT `??` — the unset value is `''`). Lands in n2a props + n2b jsdom leg.
5. **Narrow-reflow strategy — [ADR-0084](../adr/0084-app-shell-narrow-reflow-collapse.md) (accepted).** Per-region
   `collapse:'hide'|'stack'` (default `hide` = today's `display:none`; `stack` keeps a primary-input side region
   reachable narrow — fixes a2ui-live's composer-vanish). `toggle` reserved. Lands in n2a props + n2b browser leg
   + the n2c isolated `:host` mirror (keep-in-sync). Resolves the old fork #5 (LLD §7.5).
6. **C9 a2ui-live rework (sequence AFTER #4+#5's props build in n2a/n2b).** The composer region authors
   `region="navigation" landmark="complementary" collapse="stack"`; n3a's accept gains the composer-stays-
   reachable-narrow + correct-landmark checks.
