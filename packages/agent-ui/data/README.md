# @agent-ui/data

A zero-dependency, headless data layer for agent-ui: a `DataSource<T>` seam whose CRUD verbs are
optional capabilities, and signal-backed `resource()`, `mutation()` and `paginated()` built on the
components signals kernel (ADR-0192).

> Published as `@agent-ui-kit/data` (from v0.2.0) in the lockstep set `npm run publish:packages`
> releases; in this repo it is the private workspace package `@agent-ui/data`, the same rename the other
> packages take.

## Entry points

| Import | What it carries |
| --- | --- |
| `@agent-ui/data` | `DataSource`, `asDataSource`, `createStore`, `resource`, `mutation`, `paginated`, the `DataError` family |
| `@agent-ui/data/gateway` | the consumer-side gateway client: middleware, token flow, typed error envelope, retry and backoff |
| `@agent-ui/data/stream` | one `Streamed<T>` contract with fetch-stream, EventSource and WebSocket adapters |

## Usage

```ts
import { resource } from '@agent-ui/data'
```

The worked example (a `resource()` and a `mutation()` behind one signal-backed owner) is in
[`.claude/docs/references/state-and-persistence.md`](../../../.claude/docs/references/state-and-persistence.md).
Real consumers: the agent-admin persona roster, skill-pack shelf and team records in `@agent-ui/app`
(ADR-0227).

## Layering

Imports only `@agent-ui/components`; `app` may import it, `a2ui` never does. Enforced by
`src/layering.test.ts`; the full package graph is in the repository [AGENTS.md](../../../AGENTS.md).
