# ADR-0003 — Single-file component CSS + barrels + host-page packaging

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-06-26
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-06-26 *(authored)* |
> | **Proposed by** | planning-lead — encoding the host/user-ratified plan-incorporation, forced live by the gold `ui-button` (the reference template every later control copies) |
> | **Ratified by** | orchestration-lead — 2026-06-26 |
> | **Repairs** | `.claude/docs/plan.md` §8 (the CSS-trio + per-component file set), `.claude/docs/goals.md` §G5 DoD (the styling bullet), `.claude/docs/process.md` §1 (the naming/structure trip-wire's "exact per-component file set"), the `component-author` skill (scaffold step 2 + CSS-trio step 5). *(No edit: the import-layering trip-wire — `controls/` stays the FACE layer.)* |
> | **Supersedes / Superseded by** | *(none)* |

## Context

Ratified G5 design (`.claude/docs/plan.md` §8) packages every component as a folder holding a **CSS trio** —
`{name}-tokens.css` (the `:where(ui-{name})` token block), `{name}-styles.css` (the `@scope (ui-{name})`
rules), and `{name}.css` (a barrel that `@import`s the first two). The plan-incorporation (a failed
fork's analysis, judged sound and host-ratified) proposes instead: each component is a folder holding a
**single `{name}.css`**; the package exposes three **barrels** — `components` (the self-defining JS
modules), `component-styles` (per-component CSS), `foundation-styles` (tokens + reset); and a component
is consumed by a **simple host page** that `<link>`s the foundation + component styles (tokens first) and
loads the JS modules via `<script type=module>` (each module self-`define`s its tag).

Building `ui-button` to the gold bar forces the choice now: it is the reference control whose file shape
every later control (and the `component-author` procedure) copies, and Phases 2–4 (demo, `/site`,
A2UI canvas) all consume it through the host-page mechanism. Shipping the trio and then migrating 60
components later is the expensive path.

## Decision

We will package a component as a folder **under its existing layer** — `controls/{name}/` for FACE
controls (unchanged; the import-layering trip-wire's named layer), `components/{name}/` for the later
display/pattern catalog — holding a **single `{name}.css`** that carries both blocks in clearly separated
sections: a `:where(ui-{name})` token block (declaring `--ui-{name}-*` from `--md-sys-color-{family}-{role}` roles +
the dimensional ramps, repointed by `[size]`/`[tone]`) **then** an `@scope (ui-{name})` styles block
consuming only `--ui-{name}-*`. The trio collapses to one file; **the styling invariants are unchanged**
(tokens in `:where()`, `@scope` isolation, consume-only-`--ui-{name}-*`, behaviour-only `.ts`, no runtime
style injection) — only the file count drops from three to one.

The package adds three barrels — `components`, `component-styles`, `foundation-styles` — and the canonical
consumer is a host page linking foundation + component styles (**tokens loaded first**, per `plan.md` §8)
and self-defining JS modules. This repairs `plan.md` §8, `goals.md` §G5, `process.md` §1, and
`component-author` (which now scaffolds `{name}.{ts,css,md}`).

## Consequences

- **Fewer files, same guarantees.** The token-hygiene and geometry trip-wires operate on **CSS content**,
  not file count — they re-target `{name}.css` (one file) and are otherwise unchanged. The naming/structure
  trip-wire's "exact per-component file set" becomes `{name}.{ts,css,md,test.ts}` (the `.md` per ADR-0004).
- **The `controls/` layer is untouched** — FACE controls stay under `controls/{name}/`; the import-layering
  trip-wire needs no change. `components/{name}/` is reserved for the display/pattern catalog (per
  `component-author`).
- **Barrels enable tree-shaking + the host page** — importing one control drags only it + real deps
  (the size/tree-shake gate, `process.md` §1), and the host page is the demo/`/site`/canvas substrate.
- **Negative — one file now mixes the `:where()` token layer and the `@scope` style layer.** The two must
  stay sectioned (a comment banner, or `@layer`) so the "every `--ui-{name}-*` in `:where()`" probe can
  still distinguish the declaration layer from the consumption layer in a single file. The probe parses one
  file instead of three — a one-line change to its glob, flagged for the trip-wire slice.
- **Propagation:** the `component-author` scaffold + the (unbuilt) naming/structure + token-hygiene
  trip-wires regenerate against the single-file shape. No code exists yet to migrate (G5 is unstarted),
  so this is a design repair, not a refactor.

## Alternatives considered

- **Keep the CSS trio** — rejected: three files × every component is ceremony with **no probe benefit**
  (the invariants are content-level, not file-level); the incorporation's single file is simpler and the
  reference control should establish the lean shape, not the verbose one.
- **A single `.ts`-injected stylesheet (constructable/adopted)** — rejected: violates "behaviour-only `.ts`,
  no runtime style injection" (`plan.md` §2); the pure-CSS `@scope` distribution is a deliberate pillar.
- **Two files (tokens + styles, drop the barrel)** — rejected: the barrel `{name}.css` was the single
  consumer entry; collapsing both blocks **into** `{name}.css` keeps that one import while removing the
  `@import` indirection — strictly simpler than two files.
- **Flatten FACE controls into `components/{name}/`** (as the incorporation's loose wording suggests) —
  rejected: `controls/` is the import-layering trip-wire's enforced layer (CLAUDE.md, `plan.md` §3); the
  layer carries meaning (controls import `dom` + `traits`), so it stays.
