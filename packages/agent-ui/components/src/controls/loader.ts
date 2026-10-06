// loader.ts: the lazy control loader over the generated registry (ADR-0233).
//
// A host that renders controls it does not import up front (the A2UI renderer behind a catalog's
// `controls` seam, or any app that defers a control) asks a `ControlLoader` two things: which of these
// tags are not defined yet (`missing`, synchronous, so a caller keeps a sync fast path with no
// microtask), and to define them (`ensure`). `ensure` imports each missing tag's entry module through its
// registry record (the module self-defines its tag and imports its own JS dependencies) and, unless the
// host owns styling (`css: 'host'`), links the tag's single sheet, whose `@import` prologue carries the
// sheets of the controls it uses. There is no recursion over `uses`: lazily imported dependencies (the
// text field's calendar and color picker) stay lazy.
//
// DOM-free at module top level: the a2ui catalog compose step imports this module from Node and Workers
// tools, so no top-level statement reads `document`, `window`, `customElements`, `HTMLElement` or
// `location`. Every DOM access sits inside a function body. Its static closure is `control-record.ts`
// (type-only) and `registry.gen.ts`, whose records are object literals holding lazy `import()` thunks.

import type { ControlRecord } from './control-record.ts'
import { CONTROLS } from './registry.gen.ts'

export type { ControlRecord }

/** Defines controls on demand. */
export interface ControlLoader {
  /** The tags in `tags` that have no custom-element definition yet. Synchronous. */
  missing(tags: Iterable<string>): string[]
  /** Define every missing tag in `tags` (and link its sheet unless styling is the host's). */
  ensure(tags: Iterable<string>): Promise<void>
}

/** Options for `createControlLoader` and `ensureControls`. */
export interface ControlLoaderOptions {
  /**
   * How a defined control gets its sheet. Absent: link the record's `css`, resolved against this module's
   * URL (registry paths are relative to `src/controls/`, where this module lives). A function: link the
   * `string | URL` it returns for the record. `'host'`: the host already styles the controls, so the loader
   * never touches `document.head`.
   */
  css?: 'host' | ((css: string, record: ControlRecord) => string | URL)
}

/** Rejection of `ensure`: the named tags have no record, failed to load, or did not define themselves. */
export class ControlLoadError extends Error {
  readonly tags: readonly string[]
  constructor(tags: readonly string[], message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'ControlLoadError'
    this.tags = tags
  }
}

const isUndefined = (tag: string): boolean => customElements.get(tag) === undefined

const defaultCssResolver = (css: string): URL => new URL(css, import.meta.url)

// One pending-or-settled link per resolved href, shared across every loader and call, so a sheet is
// linked at most once per document.
const linked = new Map<string, Promise<void>>()

function linkSheet(href: string, tag: string): Promise<void> {
  const known = linked.get(href)
  if (known !== undefined) return known
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = href
  link.setAttribute('data-ui-control', tag)
  const settled = new Promise<void>((resolve) => {
    link.addEventListener('load', () => resolve(), { once: true })
    link.addEventListener(
      'error',
      () => {
        console.warn(`[agent-ui] control sheet failed to load: ${href} (${tag})`)
        resolve()
      },
      { once: true },
    )
  })
  linked.set(href, settled)
  document.head.appendChild(link)
  return settled
}

/** A loader over `records` (keyed by tag). */
export function createControlLoader(records: Readonly<Record<string, ControlRecord>>, options: ControlLoaderOptions = {}): ControlLoader {
  const css = options.css
  const missing = (tags: Iterable<string>): string[] => [...new Set(tags)].filter(isUndefined)

  async function ensure(tags: Iterable<string>): Promise<void> {
    const todo = missing(tags)
    if (todo.length === 0) return
    const unknown = todo.filter((tag) => !Object.hasOwn(records, tag))
    if (unknown.length > 0) throw new ControlLoadError(unknown, `no control record for ${unknown.join(', ')}`)

    const loaded = await Promise.allSettled(todo.map((tag) => records[tag]!.load()))
    const failed = todo.filter((_, i) => loaded[i]!.status === 'rejected')
    if (failed.length > 0) {
      const cause = loaded.find((r): r is PromiseRejectedResult => r.status === 'rejected')?.reason
      const detail = cause instanceof Error ? ` (${cause.message})` : ''
      throw new ControlLoadError(failed, `control module failed to load: ${failed.join(', ')}${detail}`, { cause })
    }
    const undefinedAfter = todo.filter(isUndefined)
    if (undefinedAfter.length > 0) {
      throw new ControlLoadError(undefinedAfter, `control module did not define its tag: ${undefinedAfter.join(', ')}`)
    }

    if (css === 'host') return
    const resolve = css ?? defaultCssResolver
    const links: Promise<void>[] = []
    for (const tag of todo) {
      const record = records[tag]!
      if (record.css === undefined) continue
      links.push(linkSheet(String(resolve(record.css, record)), tag))
    }
    await Promise.all(links)
  }

  return { missing, ensure }
}

/** Define the missing fleet controls among `tags`, over the generated registry `CONTROLS`. */
export function ensureControls(tags: Iterable<string>, options?: ControlLoaderOptions): Promise<void> {
  return createControlLoader(CONTROLS, options).ensure(tags)
}
