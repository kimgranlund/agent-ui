// loader.ts: the lazy catalog body loader (ADR-0241 cl.4-5).
//
// A recorded catalog (`LazyCatalogRecord`) holds its body behind `load()`. The body load is memoized
// MODULE-WIDE and keyed by the record object, because every `ui-surface-host` builds its own renderer and
// each renderer's `Registry` registers the same records: one fetch serves them all, while each registry
// registers the loaded body into itself (`Registry.ensure`). A rejected load is dropped from the memo so
// the next call retries (the ADR-0197 cl.3 `loadAgentAdmin()` precedent). Pure: imports types only and
// touches no DOM, so `registry.ts` stays safe in the Node and Workers closures that import `compose.ts`.

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
  loading.catch(() => {
    if (bodies.get(record) === loading) bodies.delete(record)
  })
  return loading
}
