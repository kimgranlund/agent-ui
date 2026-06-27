# agent-ui — coherence process

> How we keep a growing component framework from drifting, bloating, or wasting context.
> Companion to [`plan.md`](./plan.md) (what we build) and [`goals.md`](./goals.md) (when).
> This system is designed against the orchestration rubric; the scorecard is at the end.
> Ratified design changes (the repair-the-owner up-loop) are logged as ADRs in [`adr/`](./adr/).

## The governing model

Two diseases threaten a multi-component buildout, and one cure applied two ways:

- **Drift** — an artifact silently diverging from reality (a descriptor that no longer matches the
  code; a token name a sibling spells differently). Nothing fails when it happens.
- **Bloat (brittle-feature accretion)** — each special case cheap alone, collectively making the
  framework rigid, oversized, and untestable.

**Cure:** *contracts that fail loudly* (mechanical gates) + *loops that repair the source artifact*
(audit → fix the component, not the symptom). Plus the context-economy primitive — **progressive
disclosure**: descriptions are always loaded, skill bodies load on demand, rubrics load when checking,
scripts never enter context at all.

Three placement rules follow, and they decide every governance artifact below:

1. **Anything with a true/false answer is a script or hook, never agent judgment.** (Determinism → code.)
2. **Judgment grounds against a referential artifact** (a rubric/contract), so review is "check against
   one small standard," not "re-read the library."
3. **Discovery ≠ continuation.** Descriptions decide *what* runs each turn; `/goal`/hooks decide *when*
   the next turn fires. We never ask one to do the other's job.

## The artifact map

| Artifact | Axis | Mode | Unit | Prevents | Authored via | Lands |
|---|---|---|---|---|---|---|
| **Trip-wire suite** (probes + scripts + hook) | behavioral | contract | scripts/hook | drift + bloat | hand + `update-config` (hook) | G0→G1 |
| `authoring-components` | behavioral | procedure | **skill** | drift (by construction) | `authoring-skills` | by G5 |
| `auditing-components` | behavioral | procedure | **skill** | drift (detection) | `authoring-skills` | ~G6 |
| `component-reviewer` | behavioral | — | **subagent** | drift + bloat (judgment) | `authoring-agents` | G5 |
| `tokens-specialist` | behavioral | — | **subagent** | drift (tokens) | `authoring-agents` | G6 |
| contract schema (`{name}.md` frontmatter) | referential | rubric/check | json-schema | drift | hand (draft-2020-12) | G5 |
| component rubric (COMPOSE/REALIZE) | referential | rubric | doc | drift + bloat | `authoring-rubrics` | G5 |
| kernel rubric | referential | rubric | doc | bloat | `authoring-rubrics` | G1 |
| coherence/health rubric | referential | rubric | doc | drift | `authoring-rubrics` | ~G6 |
| `CLAUDE.md` (thin index) | behavioral | instruction | doc | context | `authoring-entry-files` | G0 |

Most teams build only the behavioral axis and neglect the referential one — and a loop with nothing
to check against can't repair anything. We treat the rubrics + contract as first-class, not afterthoughts.

## 1. Trip-wires — the loud contracts (determinism → code)

These cost ~zero agent tokens and catch the bulk of drift/bloat deterministically. Each is a true/false
check, so each is a script or a probe, never an agent. Two speeds:

**Fast static gates (a Stop / pre-commit hook):**
- naming/structure — `ui-*` ↔ `UI*Element`; the exact per-component file set; `--ui-{name}-*` prefix;
  event names ∈ the allowlist.
- contract↔props drift — `{name}.md` frontmatter `attributes[]` === live `finalize(Class)` table (ADR-0004).
- import-layering — `reactive/` imports nothing; `dom/` imports only `reactive/`; no upward imports.
- zero-native + ARIA — no native form elements (allowlist, comment-aware); no literal `role`/`aria-*` on host.
- lifecycle/`upgrade` — every manual value-taking accessor re-applied via `upgrade(...)` at connect.
- token hygiene — no raw `--_*` refs; every `--ui-{cmp}-*` in `:where()`; forced-colors handled-or-flagged.

**Heavy gates (a `check`/`size` script at DoD / CI):**
- size/tree-shake — per-component marginal ≤ cap; keep-all ratchet shrink-only; importing one control
  drags only it + real deps.
- behaviour + browser-truth probes (the test suite of record).

The fast gates are wired as a hook so they fire without anyone remembering (required reliability →
lifecycle boundary, not a sentence in a doc).

**A gate is only as good as its negative control** — anchor each NC on a *unique* code token and confirm
the mutation actually applied before trusting a green run (the full anchor discipline is owned by
`decomposing-systems`). And a green gate is not yet a landed change — read it, *then* commit as a separate
step (`handoff-contract`).

**Contract-change migration — when a slot / role / prop *name* changes.** The trip-wires above catch a
descriptor that silently *drifted*; a deliberate **rename** is the opposite case — an intended contract
change that nothing flags, so it must be propagated by hand to every call site before it counts as done.
This is a loop that repairs the source, not the symptom: change the name at its origin (the CSS + the
descriptor) **and** every dependent. Renaming a `slot`, a `data-role`, or a prop attribute → **grep the
whole repo for every spelling of the old name**, across `packages/` **and** `site/`, in BOTH forms:

- the declarative markup form — `slot="x"` / `slot='x'` (and `data-role="x"`, the bare attribute name);
- the imperative JS form — `setAttribute('slot', 'x')` (and `setAttribute('data-role', 'x')` / the
  property setter).

Migrating the CSS and one demo is not enough. The `icon`→`leading` slot rename (`12fdf49`) updated
`button.css` and the descriptor but left a stale `setAttribute('slot', 'icon')` in `site/main.ts` —
invisible to a grep for the HTML `slot="icon"` form alone — and shipped a user-visible oversized-icon bug
(the old name no longer matched `:has([slot=leading])`). Both spellings, both trees, every time.

## 2. Skills — procedures (recurring methods)

A skill is the right unit only for a *recurring multi-step method*. Two qualify:

**`authoring-components`** — the canonical procedure for adding/upgrading a `ui-*` component. It is the
primary anti-drift instrument: divergence can't happen if every component is built the same way. Its
description (the router-facing interface):

> *Author or update a `ui-*` component in the agent-ui framework to the standard shape — folder layout,
> base-class choice, typed `static props`/`ReactiveProps`, traits/controllers via `use()`, the CSS
> trio + `@scope`, the `.api.json` descriptor, probes, and the per-component definition-of-done. Use
> when adding a new control/component or bringing an existing one up to standard.*

**`auditing-components`** — the library-wide drift sweep, producing a severity-ranked `drift-report.md`.
Valuable only once 3+ components exist.

> *Sweep the agent-ui component library for drift and bloat across API/token/lifecycle/event-name/
> layout symmetry and per-component budgets, producing a severity-ranked drift report. Use when 3+
> components exist, or before shipping a batch of component changes.*

(Authored as **our own** skill via `authoring-skills` — not a generic root audit skill.)

## 3. Subagents — result-only delegation (isolated judgment)

A subagent is the right unit for scoped, isolatable work where only the summary returns — which keeps
file-reading out of the main thread (context economy). Neither needs a team: there is no debate, just a
verdict. Frontmatter below is the intended shape — **verify the exact keys (`tools`/`model`/`skills`)
against the installed build before authoring** (subagent frontmatter drifts).

```markdown
---
name: component-reviewer
description: Adversarially review ONE agent-ui ui-* component against the COMPOSE/REALIZE rubric and the
  api-contract — returns severity-classified, file:line-cited findings and a per-axis score. Use
  PROACTIVELY at a component's definition-of-done, before marking it shippable.
tools: Read, Grep, Glob, Bash
model: sonnet            # judgment task — a stronger model than the search tier
skills: [authoring-components]   # standing knowledge of the standard shape, no discovery needed
---
```

```markdown
---
name: tokens-specialist
description: Own the agent-ui token layer's coherence — the --c-{family}-{role} roles, the
  --ui-{name}-* component chains, the dimensional ramps, contrast and forced-colors. Use when
  adding/changing tokens, wiring a component's -tokens.css, or auditing token drift across the fleet.
tools: Read, Grep, Glob, Bash
model: sonnet
---
```

**Fan-out is reserved.** The per-component reviewer is a single subagent (cheap). A multi-critic
*council* red-team (the "delete it / simplest thing / build the banks" lenses) runs **per tier, not per
component** — that cadence is what makes the fan-out earn its token cost.

## 4. Rubrics + contract — the referential axis (what "good" means)

These are read to check, never obeyed. They are the single source of truth review grounds against:

- **contract schema** (the `{name}.md` frontmatter schema, ADR-0004) — the machine-checkable public
  surface; also the target of the contract↔props trip-wire, and the `/site` doc source.
- **component rubric** (COMPOSE/REALIZE) — two axes scored separately; shippable = both ≥ 4, zero gate
  fails. Carries the explicit bloat dimensions (API minimalism / no boolean explosion, marginal size,
  no self-owned margin, tier discipline).
- **kernel rubric** — the kernel's *different* concerns (invariants preserved, surface minimal+typed,
  zero leaks, budget); G1–G4 grade against this, not the component rubric.
- **coherence/health rubric** — the scoring backbone of `auditing-components`.

## 5. Discovery vs. continuation (how it's wired)

- **Discovery (every turn):** the skills and subagents route off their descriptions. So the descriptions
  above are versioned like API signatures — when a skill's behavior changes, its description changes.
- **Continuation (when the next turn fires):** **human-driven for now.** The only automation is the
  Stop/pre-commit **hook** running the fast gate suite (enforcement, not selection). A per-component DoD
  as a `/goal` condition (authored via `loop-design`) is a *later* option, considered only
  if the buildout fans out to the full catalog — not for ~7 controls. We never expect `/goal` to *select*
  the reviewer or the author skill; discovery does that underneath, goal or no goal.

## How this maps to the three risks

- **Drift** → fails loudly at the trip-wires (contract/naming/layering/tokens), is built-out by the
  `authoring-components` procedure, detected library-wide by `auditing-components`, and judged by
  `component-reviewer` against the contract+rubric.
- **Bloat** → the size/tree-shake gate (mechanical) + the rubric's API-minimalism dimensions + the
  per-tier council red-team. And the discipline: **no rubric/agent for what a probe already checks** —
  adding agent judgment for a true/false fact is itself accretion.
- **Context inefficiency** → progressive disclosure (thin descriptions, on-demand bodies, scripts that
  never enter context); single-source-of-truth (review = check one rubric, not re-read the library);
  determinism in code (gates cost zero agent tokens); excerpt-first fan-out (subagents return summaries);
  a thin `CLAUDE.md` that indexes rather than inlines; decisions in memory so they're not re-derived.

## Sequencing

```
G0  thin CLAUDE.md · fast-gate hook · naming/layering/contract-drift probes · size script
G1  kernel rubric
G5  authoring-components skill · frontmatter contract schema · component rubric · component-reviewer agent   (land WITH ui-button)
G6  auditing-components skill · coherence rubric · tokens-specialist agent
per-tier  council bloat red-team (occasional, justified fan-out)
```

## What we do NOT build (anti-ceremony)

- No autonomous harness-forge lattice yet — human-driven was chosen, and ~7 controls won't amortize it.
- No bespoke per-component agents — one reviewer + one tokens specialist; everything else is mechanical.
- No rubric/agent for a check a probe already owns.

---

### Appendix — design scorecard (rubric-orchestration)

| Dim | Type | Score | Note |
|---|---|---|---|
| D1 right unit | review | 5 | author/audit = skills (recurring methods); reviewer/tokens = subagents (result-only); council = the only fan-out, per-tier |
| D2 connective-tissue | **gate** | 4 | every skill/agent description written as a precise trigger interface |
| D3 static vs dynamic | review | 4 | only `component-reviewer` hard-wires expertise (`skills:` preload); rest left to discovery |
| D4 frontmatter validity | **gate** | 3 | shapes valid; flagged to verify `tools`/`model`/`skills` keys against the installed build at authoring time |
| D5 plane separation | review | 5 | discovery (descriptions) and continuation (human + Stop hook; later `/goal`) kept explicitly separate |
| D6 fan-out justified | review | 5 | per-component = single subagent; multi-critic fan-out reserved for per-tier red-teams |

Gate (D2, D4 ≥ 3): **pass.**
