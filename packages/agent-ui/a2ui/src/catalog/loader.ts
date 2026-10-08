// loader.ts: the lazy catalog body loader (ADR-0241 cl.4-5).
//
// A recorded catalog (`LazyCatalogRecord`) holds its body behind `load()`. The body load is memoized
// MODULE-WIDE and keyed by the record object, because every `ui-surface-host` builds its own renderer and
// each renderer's `Registry` registers the same records: one fetch serves them all, while each registry
// registers the loaded body into itself (`Registry.ensure`). A rejected load is dropped from the memo so
// the next call retries (the ADR-0197 cl.3 `loadAgentAdmin()` precedent). A resolved body is also kept apart
// (`loadedCatalogBody`), so a registry built after the load registers it at once in `registerLazy` (the warm
// memo, ADR-0241 Amendment 1, A2). Pure: imports types only and touches no DOM, so `registry.ts` stays safe in
// the Node and Workers closures that import `compose.ts`.

import type { CatalogBody, LazyCatalogRecord } from './types.ts'

/** Rejection of `Registry.ensure`: the named catalog has no record, failed to load, or failed to register. */
export class CatalogLoadError extends Error {
  readonly catalogId: string
  constructor(catalogId: string, message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'CatalogLoadError'
    this.catalogId = catalogId
  }
}

/** The message of a caught value, for a `CatalogLoadError` message. */
export const reasonOf = (cause: unknown): string => (cause instanceof Error ? cause.message : String(cause))

const bodies = new WeakMap<LazyCatalogRecord, Promise<CatalogBody>>()
const settled = new WeakMap<LazyCatalogRecord, CatalogBody>()

/** The body of `record` once its load has resolved, else `undefined` (never loaded, in flight, or rejected). */
export const loadedCatalogBody = (record: LazyCatalogRecord): CatalogBody | undefined => settled.get(record)

/** The body of `record`, loaded at most once (a failed load is retried). A synchronous throw becomes a rejection. */
export function loadCatalogBody(record: LazyCatalogRecord): Promise<CatalogBody> {
  const known = bodies.get(record)
  if (known !== undefined) return known
  let loading: Promise<CatalogBody>
  try {
    loading = record.load()
  } catch (error) {
    loading = Promise.reject(error)
  }
  bodies.set(record, loading)
  // Attached before the promise is returned, so it runs ahead of any caller's `.then`: the body is already in
  // `settled` when an `await preload(id)` resumes.
  loading.then(
    (body) => {
      if (bodies.get(record) === loading) settled.set(record, body)
    },
    () => {
      if (bodies.get(record) === loading) bodies.delete(record)
    },
  )
  return loading
}
