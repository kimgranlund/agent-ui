# ADR-0131 — Agent Admin UI: a generic self-contained config, three panes, real persistence — composing the shipped M2/M4 primitives, no new primitive family

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-07-14
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-07-14 |
> | **Proposed by** | design intake ([TKT-0039](../tickets/tkt-0039-agent-admin-ui.md), `system-decompose` both planes — `decompositions/agent-admin-ui.decomp-v2.json`, `coverage_check.py` clean: 17 nodes/10 actions/10 hosts/12 edges) |
> | **Ratified by** | Status flipped to `accepted` in-tree (see `git blame` for provenance) — this field is left unfilled rather than asserting a specific ratifier/date neither witnessed nor confirmed in-conversation |
> | **Repairs** | none yet — this is an intake ADR; a repairs list (PRD/SPEC/LLD, if this earns its own document set or folds into `agent-app-surfaces.prd.md` as a further milestone) is build-time business, per the M2/M4 precedent |
> | **Supersedes / Superseded by** | (none) — composes [ADR-0120](./0120-app-surfaces-m4-panes-settings.md) (`ui-split`, `ui-settings`, the store-adapter seam) and [ADR-0129](./0129-app-surfaces-m2-composition-and-transport-boundary.md) (`ui-conversation`/`ui-surface-host`, the no-transport-ownership law) without amending either |

## Context

Kim's `/feature` ask (2026-07-13, recovered and re-captured as TKT-0039 after the original intake
left no trace on disk — see that ticket's Recovery note): an Agent Admin UI to edit an agent's
instructions and settings with a live chat preview, side-by-side panes. The M2 (chat canvas) and M4
(panes + settings) primitive families both already shipped and are exactly what this composes — the
open questions were never "does the primitive exist," they were three genuine forks a
`system-decompose` intake surfaced and Kim ruled directly.

One fork ROUND-TRIPPED on a real technical constraint, worth recording here since it changed the
decision: the first ruling picked an A2A-protocol-backed agent (Fork 1). Verifying `@agent-ui/a2a`'s
actual consumer barrel before building on that ruling found a real gap — `A2aAgentCard` (name,
capabilities, skills) is a shipped, real wire type, but the only browser-reachable `A2aChannel` is an
in-process loopback pair built for the tic-tac-toe arena's isolation proof; real network transports
live in `tools/`, explicitly walled off from the app/browser consumer surface (SPEC-N1/N2, the
package's zero-dep guarantee). Surfaced as a follow-up fork rather than silently building on an
unverified assumption; Kim reconsidered and returned to the original recommendation once the real
cost was visible.

## Decision

**The Agent Admin UI composes the shipped M2 + M4 primitives into one new `@agent-ui/app` surface —
no new primitive family, no new protocol dependency.** Three forks, each ruled:

1. **Agent shape (Fork 1) — a generic, self-contained config.** Name, model/provider, system
   prompt/instructions, generation params, tools — no external runtime dependency. **Not** a Claude
   Code subagent (`.claude/agents/*.md`) and **not** an A2A protocol agent — the A2A path was
   evaluated and rejected once the missing-transport gap (Context) was visible; the buildable-today
   config needs nothing outside `@agent-ui/app`, consistent with ADR-0129's own "no transport
   ownership" law for `ui-conversation`.
2. **Layout (Fork 2) — three panes**, not four: `[ chat canvas | prompts pane | settings pane ]`,
   on `ui-split` (M4, ADR-0120). "Options" from the original four-pane ask folds into the settings
   pane rather than standing alone.
3. **Persistence (Fork 3) — real, not just the seam.** M4's `ui-settings` store-adapter contract is
   a seam by design (bring-your-own-store); this ticket brings a concrete implementation (e.g.
   localStorage-backed) so an edited config survives a reload. This is genuinely new work, not pure
   composition — flagged explicitly rather than absorbed silently into "wire up the settings pane."

**Fail-closed apply, not fail-open:** an edited config or prompt is validated against its schema
*before* it propagates to the chat canvas's next turn (`decomp-v2.json` node `n6c` → `n6a`) — an
invalid edit is rejected, never silently applied to a live turn.

**Composition, not ownership, of the M2 pair:** the chat canvas is `ui-conversation` +
`ui-surface-host` exactly as M2 shipped them; this surface drives its own turn loop (ADR-0129's law
held, not re-litigated) rather than growing either primitive a new capability.

## Consequences

- **A new `@agent-ui/app` composition, not a new components-tier primitive** — same tier ruling
  precedent as ADR-0120's own master-detail/settings chrome: this is assembly, not a primitive
  family, so it does not enter the a2ui catalog gate's scope (PRD-D2's trusted-frame law, unchanged).
- **A concrete persistence backend is now in-scope build work** — the store-adapter seam alone
  (M4's existing deliverable) is not sufficient; whoever builds this owns choosing and implementing
  a real backend, sized and gated like any other new module, not treated as "just wiring."
- **No `@agent-ui/a2a` dependency** — this surface stays inside the `shared ← components ← app` DAG
  agent-ui already enforces; A2A protocol agents remain a real, separately-scoped future ask if a
  browser-reachable transport ever ships for that package.
- **Stale → re-verify at build:** confirm `ui-settings`' store-adapter contract shape still matches
  what a concrete backend needs (M4 shipped it as a seam; no concrete implementation has consumed it
  yet, so this is the first real test of that contract).

## Acceptance

This is an **intake** ADR — realized in stages, same shape as ADR-0120/ADR-0129:

- **Intake (this change):** `system-decompose` both planes done (`decomp-v2.json`, coverage clean);
  three forks ruled with one verified round-trip recorded; TKT-0039's Scope/Open closes against
  this record; no code changes.
- **Build (separately dispatched):** the three-pane `ui-split` shell, the generic config schema +
  store + a real persistence backend, the settings/prompts panes, and the chat canvas composition,
  each to the fleet's per-module DoD; fail-closed validation proven non-vacuously (a bad edit
  demonstrably rejected before reaching a live turn, not merely asserted).

## Alternatives considered

- **An A2A-protocol-backed agent (Fork 1's first ruling).** Reconsidered and rejected: no
  browser-reachable live channel to a real external A2A agent exists today; building one would pull
  a new transport-infrastructure deliverable inside what was scoped as a UI-composition ticket.
- **Four panes as originally phrased.** Rejected: Kim's own same-day restatement to Claude already
  collapsed options into settings (three panes); four would split one pane's concern across two
  surfaces for no stated reason.
- **Seam-only persistence (M4's existing shape, unchanged).** Rejected: Kim ruled real persistence
  in scope — an edit that doesn't survive a reload does not satisfy "edit ... in real time" as a
  durable admin tool, only as a throwaway preview.

## Build-time note — an unratified deviation, flagged not silently shipped

The prompts pane renders a plain native `<textarea>`, not a fleet FACE control — the fleet's own law
(CLAUDE.md: "no native form elements"; every other editable surface rides `ui-text-field`'s
contenteditable model, ADR-0044) has no exception for it. This ADR never ruled a fork on the vehicle
because none was surfaced at intake — no shipped control renders long-form multi-line text, and the
gap was found mid-build, not mid-intake. Recorded here rather than silently shipped as an unremarked
precedent (an independent `component-reviewer` pass caught it, MAJOR): a future intake should either
rule an explicit exception for this element, or scope a multiline FACE editor as follow-on work. Not
resolved by this record — a build-time finding, not a re-opened fork.

## Independent review (component-reviewer, post-build)

A fresh-context review of the initial build proved two real defects with non-vacuous repros: (1)
persistence did not survive a reload — the default `createMemoryStore` was constructed with no
`initial`, and the adapter's own localStorage seed loop only checks storage for keys already present
in `initial` at construction time (never a blind scan), so `cl.3`'s ruled scope silently never worked;
(2) the prompts pane's field→store commit listener was armed only once (inside the idempotent
`#compose()`) and never re-armed on reconnect — the exact bug class this same build already fixed once
for the OTHER direction (store→field). Both fixed in the same change: the default store now seeds
`initial` from the effective schema's own field defaults + `SYSTEM_PROMPT_KEY`
(`agent-admin-schema.ts`'s `initialValuesFor`), and the field→store listener now arms in `connected()`
alongside the store→field re-arm, not in `#compose()`. A third, lower-severity finding (the turn loop
accepted an out-of-range/unrecognized stored value verbatim from a bring-your-own store) was also
closed — `sanitizeNumber`/`sanitizeSelect` fail closed against the schema's own declared bounds.
