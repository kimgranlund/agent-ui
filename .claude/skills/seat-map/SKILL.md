---
name: seat-map
description: >-
  The agent-ui repo's seat-ownership map and standing dispatch laws — which agent seat owns which
  artifact class, and the law pointers every dispatch brief must carry. Model-only knowledge preloaded
  by the repo-local repo-orchestrator-agent seat; not a user-facing action.
user-invocable: false
disable-model-invocation: false
---

# agent-ui seat map & dispatch laws

## Seat map — route by ownership

| Artifact class | Maker seat | Critic seat |
|---|---|---|
| ui-* control source / CSS / geometry | `component-build-agent` | `screens:component-checker` (NON-optional before a control-wave commit) |
| `@agent-ui/a2ui` package / renderer / catalog code | `a2ui-build-agent` | `a2ui-review-agent` |
| A2UI payload composition (message streams) | `a2ui-payload-authoring-agent` | `a2ui-review-agent` |
| Docs-site pages / shell / non-preview prose | `teamwork:docs-writer` | `teamwork:code-checker` |
| Preview specimens + knobs in `site/lib/component-preview.ts` | `example-authoring-agent` | host judges representativeness |
| Color / dimension tokens | `design:token-builder` | `screens:component-checker` (consuming control) |
| PRD / SPEC / LLD / ADR authoring | `teamwork:planner` | `docs:doc-checker` |
| Non-UI code diffs / slices | `teamwork:builder` | `teamwork:code-checker` |
| Broad searches / codebase questions | `Explore` (read-only, conclusions not dumps) | — |
| Measured experiment loops (regressions, tuning, stress) | `docs:experiment-runner` | host verifies the report |
| A2UI corpus record admission/judging (ADR-0068) | `a2ui-corpus-curation` (skill, host-run or briefed) | `a2ui-review-agent` (the VerdictsFile judge — never the seed's own author) |
| One confirmed work-item build (feature/task/bug, by issue id) | `teamwork:build-lead` | per-artifact critic above |
| Raw report/idea intake → durable records | `docs:intake-lead` | — (intake only, structurally cannot dispatch builds) |
| A SKILL.md's contract/shape | maker of the change | `harness:skill-checker` |
| An agents/*.md definition | maker of the change | `harness:agent-checker` |
| A hook (registration + script) | maker of the change | `harness:hook-checker` |
| Prompt-carrying wording (a brief, a description, a CLAUDE.md line) | maker of the change | `harness:wording-checker` |
| Skill/agent/team wiring + frontmatter composition | maker of the change | `teamwork:wiring-checker` |
| One screen/shell/page layout | maker of the change | `screens:layout-checker` |
| A cross-screen user flow (*.flow.json, journeys) | maker of the change | `screens:flow-checker` |

`example-authoring-agent` and `docs-writer` share `component-preview.ts` by concern — never dispatch both
onto that file concurrently.

## Dispatch laws — copy the directive, point at the law

Subagents inherit the repo CLAUDE.md, so briefs copy the *directive*, not the law's full text:

- **Foreground gates.** Every build brief MANDATES running `npm run check && npm test` (plus the
  browser gate when the slice touches rendering) in the seat's own foreground context, judged by
  EXIT CODES cited in the report — a seat never ends a turn waiting on a backgrounded gate run
  (4/9 batch workers stalled exactly there, 2026-08-18); backgrounded gate runs are forbidden.
- **Batch gate topology.** When N workers run concurrently on one host, each brief carries
  REDUCED targeted gates — `npm run check` + the slice's own tests + the specific shared-file
  gates it touches — and the DESK runs the ONE full suite on merged main; that single desk run
  caught the one real red all nine reduced gates missed (2026-08-18).
- **Worktree trap.** Any worktree-isolated brief mandates its own `npm install` plus a
  `readlink node_modules/@agent-ui/shared` check before trusting an import-resolving gate
  (CLAUDE.md "Always").
- **Maker ≠ critic, serialized.** The building seat never grades its own slice; never send an
  author a revision directive while its reviewer is mid-read — freeze → review → consolidate →
  one revision pass.
- **Brief by name.** Every dispatch names its seat and bounds its task; no open work-queues to
  self-claim from.
- **Work items → GitHub Issues.** New items file via `gh issue create` (ADR-0145), never new
  ticket files.
- **Due process for size:big (GH #969).** Any dispatch brief for a `size:big` issue/PR cites the
  `due-process` skill by name before design work starts — the four-phase Understand/Research →
  Plan → Execute → Evaluate loop, each phase with its own checkable exit artifact.
  `size:small` is unaffected.
