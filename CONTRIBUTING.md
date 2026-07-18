# Contributing

## The standing gate

`npm run check && npm test` must be green before any change is considered done — no exceptions,
no "I'll fix the type error later." `check` is `tsc` (packages) → `check:site` → `check:tools`, all
`noEmit`; `test` is the full Vitest (jsdom) suite. UI or interaction changes additionally need a
real-engine pass (`npm run test:browser`) and, where the change is visual, a look in an actual
browser — type-checking and jsdom prove correctness, not that the feature looks right.

See [CLAUDE.md](CLAUDE.md) for the fleet conventions (naming, layering, prop/token shape) a change
needs to follow, and the commands above in full.

## How a change gets made here

This repo runs an explicit plan → build → review loop, recorded as it happens rather than after the
fact, under [`.claude/docs/`](.claude/docs/):

- **Tickets** capture intent before work starts — what's being asked for, the acceptance criteria,
  and (once work lands) a dated Findings entry recording what actually shipped and why. A bug,
  feature, or any non-trivial change gets one. As of 2026-07-18 (ADR-0145) this means a **GitHub
  Issue** (`gh issue create`, or the `.github/ISSUE_TEMPLATE/{feature,bug}.yml` forms) — `kind` is
  the `bug`/`enhancement` label, `size` is `size:small`/`size:big`, `status` rides the Issue's own
  open/closed state plus close reason (`completed`/`not planned`) and a `doing` label for
  in-progress work, and Findings is the dated comment stream. `.claude/docs/tickets/` is a frozen
  historical archive (98 files through TKT-0096) — read for context, never a target for new ones.
- **ADRs** (`.claude/docs/adr/`) record a ratified decision — a naming rule, an architectural fork,
  an accepted tradeoff. An ADR starts `proposed`; only a human ratifies the flip to `accepted` (a
  standing hook blocks any agent-authored self-flip). See [`adr/README.md`](.claude/docs/adr/README.md)
  for the index and status lifecycle.
- **PRD/SPEC/LLD** (`.claude/docs/{prd,spec,lld}/`) — the fuller design-document set for work that
  spans multiple components or needs a frozen contract before a build starts.

The full doc grammar — when each document type is warranted, its required shape, and the status
lifecycle each carries — lives in the `agent-ui-doc-standards` skill
(`.claude/skills/agent-ui-doc-standards/`). Read it before authoring a new ticket, ADR, or spec
rather than guessing the shape from a nearby example — the shape is enforced by standing lint gates
(`site/lib/docs-grammar.test.ts`), and an unlintable doc isn't a captured one.

## Component work specifically

Adding or changing a `ui-*` control follows its own intake procedure —
`.claude/skills/agent-ui-component-design/` — before any code is written: classify the control's
base class/size-class/catalog posture, resolve its prop/event/token surface, and get an independent
doc review before the design freezes. `.claude/docs/plan.md` and `.claude/docs/goals.md` frame the
overall build plan and current milestone.

## Coherence, not just correctness

`.claude/docs/process.md` is the fuller rationale — the drift/bloat failure modes this whole
ticket → ADR → gate loop exists to prevent, and why documentation here is treated as a living
record rather than a one-time artifact. Worth reading once before your first non-trivial change.
