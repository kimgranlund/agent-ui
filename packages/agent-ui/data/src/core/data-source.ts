// core/data-source.ts — SPEC-R2: `DataSource<T>`, every CRUD verb an OPTIONAL capability, and
// `subscribe()` returning `Streamed<T>` so a source declares live updates as a first-class verb
// (a23) — the `AgentProvider` additive-optional-capability precedent (ADR-0137) generalized to
// CRUD/query data, never re-drawn.

import type { Streamed } from './types.ts'

/** Per-call context every verb receives — `signal` carries abort/supersede (SPEC-R2). */
export interface SourceContext {
  readonly signal: AbortSignal
}

/**
 * A consumer-authored strategy object. Every verb is OPTIONAL: a source declares only the
 * capabilities it has, and adding a new verb to this interface in a later version MUST NOT
 * require any change to an existing source (SPEC-R2).
 */
export interface DataSource<T, Q = unknown, I = Partial<T>> {
  read?(key: string, ctx: SourceContext): Promise<T>
  list?(query: Q, ctx: SourceContext): Promise<readonly T[]>
  create?(input: I, ctx: SourceContext): Promise<T>
  update?(key: string, patch: I, ctx: SourceContext): Promise<T>
  remove?(key: string, ctx: SourceContext): Promise<void>
  subscribe?(key: string, ctx: SourceContext): Streamed<T>
}

/** A bare async fetcher accepted anywhere a `DataSource` is (Purpose §1's "source | fetcher"). */
export type Fetcher<T> = (ctx: SourceContext) => Promise<T>

/** Either a full `DataSource` or a bare fetcher shorthand for the common read-only case. */
export type ResourceSource<T, Q = unknown, I = Partial<T>> = DataSource<T, Q, I> | Fetcher<T>

/** Normalizes a `ResourceSource` into a `DataSource` — a bare fetcher becomes a `read`-only source. */
export function asDataSource<T, Q = unknown, I = Partial<T>>(
  src: ResourceSource<T, Q, I>,
): DataSource<T, Q, I> {
  return typeof src === 'function' ? { read: (_key, ctx) => src(ctx) } : src
}
