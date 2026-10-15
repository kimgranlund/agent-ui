# @agent-ui/devtools

The chat and A2UI dev and debug harness (ADR-0200): a three-backend transport shelf behind the
`AgentTransport` seam (replay of canned timelines, the `/__a2ui/agent` dev proxy over HTTP, an A2A peer),
the `DevtoolsEvent` timeline vocabulary with `recordTurn`, and the capture format.

> Not published yet. It is a private workspace package (`@agent-ui/devtools`, version 0.0.0) and is not
> in the lockstep set `npm run publish:packages` releases; once added it would publish as
> `@agent-ui-kit/devtools`, the same rename the other packages take.

## Entry points

| Import | What it carries |
| --- | --- |
| `@agent-ui/devtools` | the replay, proxy and A2A-peer transports, backend rows, the timeline events and the capture format |
| `@agent-ui/devtools/server` | a dev-only HTTP orchestration seam |
| `@agent-ui/devtools/playwright` | a types-only Playwright helper |

## Trust boundary

No API key, provider adapter or `produce()` call ever enters this package: keys stay server-side behind
`/__a2ui/agent` (ADR-0073). Nothing imports `devtools`; it imports `a2ui` and `a2a`. Enforced by
`src/layering.test.ts`; the full package graph is in the repository [AGENTS.md](../../../AGENTS.md).

## Where it runs

The harness page stays inside the docs site. `npm run e2e:devtools` is the keyless browser smoke
(`scripts/e2e-devtools.mjs`), local only.
