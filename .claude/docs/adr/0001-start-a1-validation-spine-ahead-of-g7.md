# ADR-0001 — Start A1 with the control-free validation spine ahead of G7

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-06-26
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-06-26 *(authored + ratified)* |
> | **Proposed by** | planning-lead — surfaced by the A1 decomposition dependency-gap finding |
> | **Ratified by** | orchestration-lead |
> | **Repairs** | *(none — sequencing/routing decision; edits no owning doc. Consistent with `PRD-A2`, runtime `SPEC-R11`/`SPEC-N6`, renderer `LLD-C11`, catalog `SPEC-R1`/`R2`/`R7`.)* |
> | **Supersedes / Superseded by** | *(none)* |

## Context

The A1 decomposition ([`../decompositions/a1-runtime-foundation.decomp.json`](../decompositions/a1-runtime-foundation.decomp.json), coverage-clean — `coverage_check.py --strict` exits 0: 24 nodes · 30 actions · 34 hosts) surfaced a **discovered reality** the milestone framing did not make explicit: `@agent-ui/components` is at **G1** — only the `reactive/` kernel exists; `dom/`, `traits/`, `controls/` are empty stubs, so there is **no `repeat` directive and no `ui-*` control family**, and `packages/agent-ui/a2ui` does not exist yet. A1 and PRD §4 Assumption **A-2** assume the component plan has reached **~G7** (button, text-field, checkbox, switch, select, field).

Read literally, the A1 milestone note "*(depends on `@agent-ui/components` ≈ G7)*" could be taken as "write no A1 code before G7." But the owners already distinguish two things:

- **A1 *completion*** does need the controls — PRD-G1's metric is ≥95 % valid-and-interactive render, which requires real `ui-*` widgets.
- **A1's *standalone spine* does not.** Renderer `LLD-C11` (§11 build-sequence step 1) already names `validate.ts` "**first: it gates everything and is shared**," carrying only a compile-time dependency on the `Catalog` type. The decomposition confirms a 13-module `build:now` core that touches neither controls, `repeat`, nor `@agent-ui/shared` tokens.

So the question is purely sequencing: may the control-free spine land on `main` while the controls are still at G1? Nothing in the owning docs forbids it (A-2 is an explicit re-verify *assumption*; the LLDs already build against a stub catalog until controls land), but the decision and its guardrail had no recorded home.

## Decision

We will **start milestone A1 by building its control-free validation spine** — `cat-c2 naming → cat-c1 catalog model (the `Catalog` type) → cat-c6 conformance → r-c11 validate.ts` — **ahead of `@agent-ui/components` reaching ~G7**, and more broadly permit any `build:now` module from the decomposition to land in that window.

This edits **no owning document**: it ratifies a sequencing/routing decision already consistent with renderer `LLD-C11` (§11 step 1), runtime `SPEC-R11`/`SPEC-N6`, and catalog `SPEC-R1`/`R2`/`R7` — those docs still hold the underlying facts.

**Guardrail (the load-bearing part).** Only modules marked `build:now` in the manifest may land ahead of the control family. Control-, `repeat`-, or token-dependent modules MUST stay deferred until their G-dependency lands: widget factory/resolver (renderer `LLD-C7`), default catalog factories (catalog `LLD-C5`), dynamic list (renderer `LLD-C6`, needs the `repeat` directive), theme applier (catalog `LLD-C8`, needs `@agent-ui/shared` tokens), and the `partial` tail (tree/input/host render proofs). No control-dependent code is written against absent controls, mocks, or stubs and merged as "A1 progress."

## Consequences

- **Unblocks now.** The `build:now` spine (13 modules) proceeds. `validate.ts` (renderer `LLD-C11`) closes the corpus LLD step-3 import TODO, satisfying validator parity (`SPEC-N6` / corpus `SPEC-N1`) — a cross-vertical unblock, not just an A1 one.
- **Deferred + tracked.** The `partial` (5) and `blocked` (3) tail stays gated; the manifest's `build`/`dep` annotations are the tracking surface. They are a **G1 snapshot** — re-verify as the component plan advances (which milestone lands the `repeat` directive vs the first `ui-*` controls is still open).
- **Negative — a "started but incomplete" A1 on `main`.** A1's PRD-G1 metric cannot be met until the controls land, so "A1 in progress" MUST NOT be read as "A1 done." The guardrail contains scope-bleed but relies on reviewers honoring `build:now`; if they don't, control-dependent code can rot against the real controls.
- **No propagation.** No downstream document regenerates — no owning fact changed. This is pure sequencing.

## Alternatives considered

- **Block all A1 until components reaches ~G7** — rejected: wastes the standalone, gating `validate.ts` that the LLD itself sequences first, and leaves the corpus-admission import TODO (parity) open with no upside; nothing in the spine needs controls.
- **Build the full A1 (incl. widget/factories/list) against stubs or mocks now** — rejected: stub-rendered widgets are not the PRD-G1 proof, and merging control-dependent code against fake controls invites silent rot and violates Assumption A-2 ("`@agent-ui/a2ui` cannot outrun the controls that exist").
- **Repair the PRD/SPEC/LLD to relax the ~G7 dependency** — rejected: nothing is wrong. A-2 is a re-verify assumption and the LLDs already build against a stub catalog until controls land; editing them would invent a problem and duplicate a fact that already has a home.
- **Route informally, record nothing** — rejected: the `build:now`-only guardrail is a durable constraint on what may merge; without a recorded home a future contributor has no traceable reason not to land `widget.ts`/factories and call A1 "started."
