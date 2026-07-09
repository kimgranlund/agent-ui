// core/types.ts — the shared type surface for the headless core (SPEC §4 typed contracts). Type-only:
// `Element` appears in type position only (a route's `component` factory returns one) — this is not a
// DOM-global VALUE reference, so it does not trip the no-DOM gate (LLD-C5's static scan targets
// window/document/location/history tokens, not DOM interface types).
import type { ReadonlySignal } from '@agent-ui/components'

/** One entry of the developer-authored route table (SPEC §2 "Route record"). */
export interface RouteRecord {
  path: string
  component: (match: RouteMatch) => Element | Promise<Element>
}

/** The resolved current-route value (SPEC §2 "Route match"). */
export interface RouteMatch {
  path: string
  record: RouteRecord
  params: Record<string, string>
  query: Record<string, string>
}

/** The router instance surface (SPEC-R2, SPEC §4). */
export interface Router {
  readonly route: ReadonlySignal<RouteMatch | null>
  navigate(path: string, opts?: { replace?: boolean }): void
  back(): void
  forward(): void
  dispose(): void
}
