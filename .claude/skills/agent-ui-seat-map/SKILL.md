---
name: agent-ui-seat-map
description: >-
  The agent-ui repo's seat-ownership map and standing dispatch laws — which agent seat owns which
  artifact class, and the law pointers every dispatch brief must carry. Model-only knowledge preloaded
  by the repo-local orchestrator seat; not a user-facing action.
user-invocable: false
disable-model-invocation: true
---

# agent-ui seat map & dispatch laws

## Seat map — route by ownership

| Artifact class | Maker seat | Critic seat |
|---|---|---|
| ui-* control source / CSS / geometry | `component-builder` | `ui:component-reviewer` (NON-optional before a control-wave commit) |
| `@agent-ui/a2ui` package / renderer / catalog code | `a2ui-builder` | `a2ui-reviewer` |
| A2UI payload composition (message streams) | `a2ui-composer` | `a2ui-reviewer` |
| Docs-site pages / shell / non-preview prose | `orchestration:docs-writer` | `orchestration:code-reviewer` |
| Preview specimens + knobs in `site/lib/component-preview.ts` | `example-builder` | host judges representativeness |
| Color / dimension tokens | `color:token-builder` | `ui:component-reviewer` (consuming control) |
| PRD / SPEC / LLD / ADR authoring | `orchestration:system-planner` | `scribe:doc-reviewer` |
| Non-UI code diffs / slices | `orchestration:system-builder` | `orchestration:code-reviewer` |
| Broad searches / codebase questions | `Explore` (read-only, conclusions not dumps) | — |
| Measured experiment loops (regressions, tuning, stress) | `scribe:researcher` | host verifies the report |

`example-builder` and `docs-writer` share `component-preview.ts` by concern — never dispatch both
onto that file concurrently.

## Dispatch laws — copy the directive, point at the law

Subagents inherit the repo CLAUDE.md, so briefs copy the *directive*, not the law's full text:

- **Foreground gates.** Every build brief MANDATES running `npm run check && npm test` (plus the
  browser gate when the slice touches rendering) in the seat's own foreground context, judged by
  EXIT CODES cited in the report — backgrounded gate runs stall seats and are forbidden.
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
