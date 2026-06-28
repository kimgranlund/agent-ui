---
name: intent-grilling
description: >-
  Proactively DERIVE the load-bearing design decisions for a greenfield system, component family, or
  feature whose decision space is mostly unmade — grill them out of TWO reasoning axes (Structural /
  outside-in and Mechanism / inside-out) across cascading rounds, where each round's answers reshape the
  next, grounding every option in the actual codebase and constraints, until the surface is settled
  enough to decompose. Use when designing or planning something new and largely open; when asked to
  "grill me", "plan this", "design this family", "what do we need to decide here", or "interrogate the
  design space"; before running decomposing-systems or authoring a PRD/SPEC/LLD on a fresh domain. The
  proactive design-time inverse of intent-extraction (which sharpens one already-given ambiguous ask).
---

# Intent grilling

Derive the design decisions a greenfield *needs* before it can be decomposed — by interrogating two
reasoning axes across cascading rounds until the decision surface settles. Where
[[intent-extraction]] *minimizes* questions for one given ask, grilling *derives* the questions a
mostly-unmade design implies.

## When to use / when not

- **Use** when designing or planning something **new with a large open decision space** — a system,
  component family, or feature where most decisions are unmade — and before running
  `decomposing-systems` or authoring a PRD/SPEC/LLD on that fresh domain. Triggers: "grill me", "plan
  this", "what do we need to decide".
- **Skip** when the decision space is small or already mostly settled — that is `intent-extraction`'s
  job (resolve only the gaps in a given ask). And skip when a ratified design already exists.
- **The pipeline.** `intent-extraction` sharpens *a given* intent → `intent-grilling` *derives* the
  design decisions → both hand off to `decomposing-systems`. Extraction is **reactive, minimize** (one
  ask, one batched round, ask only what you must). Grilling is **proactive, derive** (a whole space,
  cascading rounds, derive what must be decided). Same closed-question discipline; opposite posture.

## The two reasoning axes — the core technique

These are `decomposing-systems`' two planes (COMPOSE / REALIZE) applied to **question derivation**
instead of to structure. Every round, derive forks from **both**:

- **Structural** (outside-in, whole → part / COMPOSE): scope & breadth · the consumer (who/what drives
  it) · the element/structure set · composition & nesting · where it sits + sequencing/phasing.
- **Mechanism** (inside-out, part → whole / REALIZE): the load-bearing technical mechanisms · the
  capabilities · geometry/semantics · the platform primitives · fidelity / responsiveness / density.

**Why both.** A single axis is self-confirming — the same blindness a single-plane decomposition ships.
Structural-only yields a scope with no idea what's hard to build; Mechanism-only yields clever
primitives with no agreed shape. Crossing the planes is what surfaces the *load-bearing* forks — the
ones whose answers cascade into the rest.

## Method

1. **Frame the decision space.** Name what's being designed and why it's open (greenfield / high fork
   count). Sketch **both** axes — a few open forks each — no questions yet.
2. **Derive the question surface.** Enumerate the open forks per axis. Rank by **leverage** (an answer
   that *cascades* into other decisions) and **load-bearing-ness** (a wrong default does real damage).
   Pick the highest-leverage: **2 Structural + 2 Mechanism** for round 1.
3. **Ground the options in reality.** Investigate the codebase / catalog / tokens / constraints so each
   option is **concrete, not abstract** — with a recommendation + the tradeoff per option. Abstract
   forks get rubber-stamped; grounded ones get *decided*.
4. **Grill in cascading rounds.** `AskUserQuestion` (discipline below). Then **re-derive**: each answer
   reshapes the surface — a "full set" answer pulls in the stateful-composite + sequencing forks; a
   chosen mechanism closes some forks and opens others. Re-rank, ask the next round. (This is the
   inverse of extraction's single round.)
5. **Converge + synthesize.** Stop at the convergence rule (below); restate the **Ratified Design**
   across **both** planes, ready to hand to `decomposing-systems` / `authoring-*`.

## AskUserQuestion discipline (shared with [[intent-extraction]] — one inversion)

Same closed-question design, run as a cascade rather than one-shot. Use the **AskUserQuestion** tool.

- **1–4 questions per round, 2–4 concrete options** each; a short **header chip**; phrase options so the
  author **picks, not writes**. The "Other" escape is automatic — never add one yourself.
- **Lead with the option you'd recommend**, marked "(Recommended)", and state **its tradeoff**. Where an
  option is a concrete artifact (an element set, a layout, a primitive choice), include a **tiny
  preview** so the author compares at a glance.
- **Ground before you ask** — never present an abstract fork. Investigate first so the set is real ("the
  catalog already reserves these names"; "the token ladder stops here").
- **The inversion vs extraction.** Extraction batches *everything* into one round; grilling runs
  *multiple* rounds because answers reshape the surface. Still never **drip** — each round is a full
  batch. You stop adding rounds when the surface **settles**, not when you run out of small doubts.

## Convergence rule — when to stop grilling

Stop when the surface is **settled enough to decompose**: every remaining open fork is either (a)
defaultable without cascading, or (b) downstream of a decision `decomposing-systems` will make anyway.
**Over-grilling is the mirror of over-extracting** — manufacturing rounds past convergence spends the
author's attention and stalls the design. If a fork stops cascading, default it (state the default) and
move to synthesis.

## Output contract — the "Ratified Design"

```
DECISION SPACE  — one line: what's being designed and why it's open (greenfield / large fork count).
AXES            — the two planes sketched: Structural forks · Mechanism forks.
DECISIONS       — each ratified decision, tagged [S]/[M], the option chosen, and the cascade it triggered.
GROUNDING       — the codebase/catalog/constraint facts the options were built on (so they were concrete).
OPEN (deferred) — forks intentionally left to a default or to decomposing-systems — each with its default.
RATIFIED DESIGN — both planes resolved: the structure (scope · element set · composition · sequencing) AND
                  the mechanisms (primitives · semantics · fidelity) — ready for decomposing-systems / authoring-*.
```

## Validation loop (finalize only when clean)

Check the Ratified Design and fix what fails — re-check until all pass:

- **Both-planes test** — does it name decisions on **both** axes? Structure with no mechanism (or
  vice-versa) ran one plane and inherits its blindness → derive the missing axis.
- **Leverage test** — was each round the highest-leverage open forks, or did a *cascading* decision get
  left to a silent default? If a load-bearing fork was defaulted, surface it.
- **Grounding test** — was every option **concrete** (traceable to a codebase/catalog/constraint fact),
  not abstract? Abstract forks get rubber-stamped → re-ground and re-ask.
- **Convergence test** — did grilling stop at *settled*, not manufacture rounds past it (over-grilling)
  nor stop short (a load-bearing fork reaching `decomposing-systems` unhosted)? → adjust.
- **Handoff test** — could `decomposing-systems` run **both** planes from this without another grilling
  round? If not, a load-bearing fork is still open → one more round.

## Worked example — container/layout family (2026-06-28)

The teaching point: the **axes DERIVED the questions**, and each answer **RESHAPED the next round**.

**Decision space.** A new container/layout component family for agent-ui (G9) — greenfield, most
decisions unmade.

**Round 1 — 2 Structural + 2 Mechanism, the highest-leverage forks:**
- `[S]` *scope/breadth* — minimal stack primitives vs a full layout set?
- `[S]` *consumer* — author-facing (hand-written) vs A2UI-driven (catalog) vs **both**?
- `[M]` *nested-radius mechanism* — how does a child's corner radius relate to its parent's (the
  load-bearing geometry)?
- `[M]` *surface model* — light-DOM like the existing controls vs shadow encapsulation?

**Ground before round 2.** Inspected the A2UI catalog spec → `Row` / `Column` / `Card` / `Tabs` /
`Modal` are already **reserved** names (experimental/absent until layout primitives land). That fact
**reshaped** the element-set question: the names aren't free; the set must align with the reserved
catalog.

**Round 2** (reshaped by round 1's "both consumers" + the catalog fact):
- `[S]` *element set* — which of the reserved {Row, Column, Card, Tabs, Modal} land in this family, and
  in what order? A **"full set"** answer cascaded → pulled in the stateful composites.

**Round 3** (pulled in by the full-set answer):
- `[M]` *Tabs/Modal a11y* — roll our own vs native `<dialog>` for Modal; the focus/escape semantics.
- `[S]` *composition* — do containers nest arbitrarily, and how does the round-1 nested-radius decision
  propagate down the tree?

**Round 4** (the tail):
- `[S]` *phasing* — which primitives ship first (sequencing).
- `[M]` *density + binding* — density tokens; the per-prop binding slice.

**16 decisions over 4 rounds → a ratified design** (both planes: element set · composition · phasing on
Structural; nested-radius · native-`<dialog>` · density on Mechanism) handed to
planning / `decomposing-systems`. No round was a pre-planned checklist — each was *derived* from the two
axes and *reshaped* by the prior answers.

## References & tools

| Path | Use when |
|---|---|
| `AskUserQuestion` | Every grilling round — closed multiple-choice forks |
| `references/foundations.md` | The models behind design-time decision derivation |
| `references/best-practices.md` | The do/don't — deriving from both axes, cascading rounds, grounding |
| `references/rubric.md` | Score a Ratified Design (the skill's output) |
