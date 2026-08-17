// @agent-ui/data — package barrel. The `.` surface: DataSource types + `Streamed<T>` type + store +
// resource/mutation/paginated + DataError/normalizeError (SPEC-R1). MUST NOT import `./gateway` or
// `./stream` — SPEC-R1 AC3's tree-shake gate (a core-only consumer pays zero bytes for either).

export type { Streamed } from './core/types.ts'
export type { SourceContext, DataSource, Fetcher, ResourceSource } from './core/data-source.ts'
export { asDataSource } from './core/data-source.ts'
export type { Store, StoreSnapshot, StoreChangeReason } from './core/cache.ts'
export { createStore, defaultStore } from './core/cache.ts'
export type { DataErrorKind, DataError, NormalizeErrorOptions } from './core/error.ts'
export { HttpError, isDataError, missingCapabilityError, normalizeError } from './core/error.ts'
export type { ResourceStatus, ResourceOptions, Resource } from './core/resource.ts'
export { resource } from './core/resource.ts'
export type { MutationStatus, MutationEffects, Mutation } from './core/mutation.ts'
export { mutation } from './core/mutation.ts'
export type { PaginatedOptions, Paginated } from './core/paginated.ts'
export { paginated } from './core/paginated.ts'
