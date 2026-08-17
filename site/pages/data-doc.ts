// site/pages/data-doc.ts — the @agent-ui/data package guide (ADR-0192; saas-data-utilities.spec.md
// SPEC-R14 e). A GUIDE page for a package ABOVE components on the DAG — the same ungrouped site-level
// posture as router-doc.ts / highlight-doc.ts, not a fleet component's {doc,demo,...} set (site-coverage/
// site-toc/site-canon are components/src-scoped and never expect a `data-{type}.html` set).
//
// Every live specimen below runs the REAL package over an in-page fake `DataSource` (a promise + setTimeout,
// honoring `SourceContext.signal`) — never a mock of the package's own API: the status/data/pending lines
// are kernel signals rendered through `effect()`, exactly how a control would bind them (SPEC-N1: the
// package ships no UI; `pending` is the signal a control wires to ADR-0191's `:state(pending)`).
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import { effect } from '@agent-ui/components'
import { createStore, resource, mutation, paginated, type DataSource, type SourceContext } from '@agent-ui/data'
import { pushToPull } from '@agent-ui/data/stream'
import { el, exampleSection, uiButton } from '../lib/specimens.ts'
import { codeBlock } from '../lib/code-block.ts'

const { content } = mountPage({
  title: '@agent-ui/data',
  intro:
    'A zero-dependency, headless data layer (v1): a DataSource<T> strategy seam whose CRUD verbs are all ' +
    'optional capabilities; resource() / mutation() / paginated() returning kernel signals so a control ' +
    'binds with zero data logic; an instance-scoped, structurally-sharing store with one writer; ONE ' +
    'DataError envelope; a ./gateway subpath (middleware onion, single-flight token refresh, retry with ' +
    'jitter, the streaming pass-through law) and a ./stream subpath (ONE Streamed<T> = AsyncIterable<T> ' +
    'contract, a push→pull bridge, fetch/EventSource/WebSocket adapters). Sibling branch off components; ' +
    'catalog-invisible by construction.',
})

// ── shared demo scaffold ────────────────────────────────────────────────────────────────────────────────────
const MONO = 'margin:0.35rem 0 0; font-family:var(--md-sys-typeface-mono); font-size:0.8rem; color:var(--md-sys-color-neutral-on-surface-variant); white-space:pre-wrap;'
const FRAME =
  'padding:1rem 1.25rem; border:1px solid var(--md-sys-color-neutral-outline-variant); border-radius:0.6rem; background:var(--md-sys-color-neutral-surface-low); display:grid; gap:0.5rem;'
const ROW = 'display:flex; gap:0.5rem; flex-wrap:wrap; align-items:center;'

function statusLine(): HTMLElement {
  return el('p', { style: MONO })
}
function frame(...nodes: Node[]): HTMLElement {
  return el('div', { style: FRAME }, nodes)
}
function row(...nodes: Node[]): HTMLElement {
  return el('div', { style: ROW }, nodes)
}
function note(text: string): HTMLElement {
  return el('p', {}, [document.createTextNode(text)])
}
/** A fake latency-bearing async step that honors `SourceContext.signal` (a real fetch's abort posture). */
function later<T>(ms: number, produce: () => T, signal?: AbortSignal): Promise<T> {
  return new Promise<T>((res, rej) => {
    const t = setTimeout(() => {
      try {
        res(produce())
      } catch (e) {
        rej(e)
      }
    }, ms)
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(t)
        rej(new DOMException('aborted', 'AbortError'))
      },
      { once: true },
    )
  })
}

// ── 1 · the seam ────────────────────────────────────────────────────────────────────────────────────────────
content.append(
  exampleSection(
    'The seam — DataSource<T>',
    codeBlock(
      [
        "import type { DataSource } from '@agent-ui/data'",
        '',
        'interface SourceContext { signal: AbortSignal }',
        'interface DataSource<T, Q = unknown, I = Partial<T>> {',
        '  read?(key: string, ctx: SourceContext): Promise<T>',
        '  list?(query: Q, ctx: SourceContext): Promise<readonly T[]>',
        '  create?(input: I, ctx: SourceContext): Promise<T>',
        '  update?(key: string, patch: I, ctx: SourceContext): Promise<T>',
        '  remove?(key: string, ctx: SourceContext): Promise<void>',
        '  subscribe?(key: string, ctx: SourceContext): Streamed<T>',
        '}',
        '',
        '// any subset is a valid source — a bare fetcher is accepted too:',
        "const users = { read: (key, { signal }) => api.json(`users/${key}`, { signal }) } satisfies DataSource<User>",
        "resource('42', users)              // fails fast (missing-capability) if a verb it needs is absent",
      ].join('\n'),
      'ts',
    ),
    note(
      'Every verb is an optional capability (SPEC-R2): a source is accepted with any subset, and resource() / ' +
        'mutation() fail fast with a DataError { code: "missing-capability" } — never a throw at construction — ' +
        'when asked to use a verb the source lacks. Widening the interface later is additive by construction ' +
        '(the AgentProvider effort?/onEvent?/tools? precedent).',
    ),
  ),
)

// ── 2 · resource() — live ───────────────────────────────────────────────────────────────────────────────────
interface User {
  id: number
  name: string
  reads: number
}
const store = createStore()
let serverName = 'Ada'
let readCount = 0
let failNextRead = false
const usersSource: DataSource<User> = {
  read: (key, { signal }) =>
    later(
      600,
      () => {
        readCount++
        if (failNextRead) {
          failNextRead = false
          throw new Error(`simulated 500 for users/${key}`)
        }
        return { id: Number(key.slice(key.lastIndexOf('/') + 1)), name: serverName, reads: readCount } // 'users/1' → 1
      },
      signal,
    ),
  update: (_key, patch, { signal }) =>
    later(
      600,
      () => {
        if (patch.name === 'Zed') throw new Error('simulated 409 — "Zed" is taken')
        serverName = patch.name ?? serverName
        return { id: 1, name: serverName, reads: readCount }
      },
      signal,
    ),
}
const user = resource('users/1', usersSource, { store })

const userLine = statusLine()
effect(() => {
  const d = user.data.value
  userLine.textContent =
    `status = ${user.status.value}   pending = ${user.pending.value}\n` +
    `data   = ${d ? JSON.stringify(d) : 'undefined'}\n` +
    `error  = ${user.error.value ? `${user.error.value.kind}${user.error.value.code ? `/${user.error.value.code}` : ''} — ${String((user.error.value.cause as Error)?.message ?? '')}` : 'undefined'}\n` +
    `updatedAt = ${user.updatedAt.value ? new Date(user.updatedAt.value).toLocaleTimeString() : '—'}`
})

const refetchBtn = uiButton('refetch()', 'soft')
refetchBtn.addEventListener('click', () => void user.refetch())
const invalidateBtn = uiButton("store.invalidate('users/')", 'ghost')
invalidateBtn.addEventListener('click', () => store.invalidate('users/'))
const failBtn = uiButton('fail the next read (SWR keeps stale data)', 'ghost')
failBtn.addEventListener('click', () => {
  failNextRead = true
  void user.refetch()
})

content.append(
  exampleSection(
    'resource() — SWR, dedup, invalidation, abort (live)',
    frame(row(refetchBtn, invalidateBtn, failBtn), userLine),
    codeBlock(
      [
        "import { createStore, resource } from '@agent-ui/data'",
        '',
        'const store = createStore()',
        "const user = resource('users/1', usersSource, { store })   // { status, data, error, updatedAt, pending, refetch, dispose }",
        '',
        '// a control binds the signals — zero data logic in the element:',
        'effect(() => host.toggleState("pending", user.pending.value))   // ADR-0191 :state(pending)',
        "store.invalidate('users/')                                     // every active resource under users/* refetches",
      ].join('\n'),
      'ts',
    ),
    note(
      'Watch pending flip while status stays success and data stays put — that is the SWR contract (SPEC-R3): a ' +
        'cached value is served synchronously, a background revalidate runs, and a failed read KEEPS the stale ' +
        'data (the UI decides what to do with error). Two resources on one key share ONE in-flight source call ' +
        '(dedup); dispose() and a superseding refetch() abort the SourceContext.signal — the last holder out aborts ' +
        'a shared read, a sibling is never stranded.',
    ),
  ),
)

// ── 3 · mutation() — optimistic + rollback (live) ───────────────────────────────────────────────────────────
const rename = mutation<{ name: string }, User>(
  (input, ctx) => usersSource.update!('1', input, ctx),
  {
    store,
    invalidate: ['users/'],
    optimistic: (input, s) => s.commit('users/1', { ...(s.get('users/1') as User | undefined), id: 1, name: input.name, reads: readCount }),
  },
)
const mutationLine = statusLine()
effect(() => {
  mutationLine.textContent =
    `rename.status = ${rename.status.value}` +
    (rename.error.value ? `   error = ${String((rename.error.value.cause as Error)?.message ?? rename.error.value.kind)}` : '')
})
const NAMES = ['Grace', 'Linus', 'Ada', 'Barbara']
let nameIdx = 0
const renameBtn = uiButton('rename (optimistic → confirmed)', 'soft')
renameBtn.addEventListener('click', () => {
  nameIdx = (nameIdx + 1) % NAMES.length
  void rename.run({ name: NAMES[nameIdx] })
})
const renameFailBtn = uiButton('rename to "Zed" (server rejects → rollback)', 'ghost')
renameFailBtn.addEventListener('click', () => void rename.run({ name: 'Zed' }))

content.append(
  exampleSection(
    'mutation() — declared cache effects (live)',
    frame(row(renameBtn, renameFailBtn), mutationLine, note('The resource above mirrors the optimistic write the instant you click; a rejected run restores exactly the keys that run touched, then invalidates.')),
    codeBlock(
      [
        "import { mutation } from '@agent-ui/data'",
        '',
        'const rename = mutation((u: User, { signal }) => api.json(`users/${u.id}`, { method: "PATCH", json: u, signal }), {',
        '  store,',
        "  invalidate: ['users/'],                                  // on settle — success OR error",
        '  optimistic: (u, s) => s.commit(`users/${u.id}`, u),      // synchronously, before fn; per-key rollback on error',
        '})',
      ].join('\n'),
      'ts',
    ),
  ),
)

// ── 4 · paginated() — load more (live) ──────────────────────────────────────────────────────────────────────
interface Page {
  items: string[]
  next: number | undefined
}
const PAGES: Page[] = [
  { items: ['alpha', 'bravo', 'charlie'], next: 1 },
  { items: ['delta', 'echo', 'foxtrot'], next: 2 },
  { items: ['golf', 'hotel'], next: undefined },
]
const feed = paginated<Page, number>('feed', (cursor: number | undefined, { signal }: SourceContext) => later(400, () => PAGES[cursor ?? 0], signal), {
  store,
  getNextCursor: (p) => p.next,
})
const feedLine = statusLine()
effect(() => {
  const items = feed.pages.value.flatMap((p) => p.items)
  feedLine.textContent =
    `pages = ${feed.pages.value.length}   hasMore = ${feed.hasMore.value}   pending = ${feed.pending.value}   status = ${feed.status.value}\n` +
    `items = [${items.join(', ')}]`
})
const moreBtn = uiButton('loadMore()', 'soft')
moreBtn.addEventListener('click', () => void feed.loadMore())
const feedResetBtn = uiButton("store.invalidate('feed') → back to page one", 'ghost')
feedResetBtn.addEventListener('click', () => store.invalidate('feed'))
content.append(
  exampleSection(
    'paginated() — a thin layer over resource() (live)',
    frame(row(moreBtn, feedResetBtn), feedLine),
    codeBlock(
      [
        "import { paginated } from '@agent-ui/data'",
        '',
        "const users = paginated('users', (cursor, { signal }) => api.json(`users?cursor=${cursor ?? ''}`, { signal }), {",
        '  getNextCursor: (p) => p.next,   // undefined ⇒ hasMore === false',
        '  store,',
        '})',
        '// pages live under ONE store key; invalidate(key) refetches from the first cursor and replaces pages',
      ].join('\n'),
      'ts',
    ),
  ),
)

// ── 5 · ./gateway ───────────────────────────────────────────────────────────────────────────────────────────
content.append(
  exampleSection(
    './gateway — the client onion, token flow, retry, the pass-through law',
    codeBlock(
      [
        "import { createGateway, withToken, withRetry } from '@agent-ui/data/gateway'",
        '',
        'const api = createGateway({',
        "  baseUrl: '/api/',                          // relative stays relative — the platform resolves it, no invented origin",
        '  middleware: [',
        "    withToken(getToken, { refresh }),        // Authorization: Bearer <t>; ONE refresh across all concurrent 401s, then replay",
        '    withRetry({ maxAttempts: 3 }),           // retryable + idempotent only; exp backoff, full jitter, Retry-After honored',
        '  ],',
        '})',
        "const user = await api.json<User>('users/42')                     // non-2xx → DataError { kind: \"http\", status }",
        "const res = await api.request('events', { headers: { accept: 'text/event-stream' } })  // body untouched",
      ].join('\n'),
      'ts',
    ),
    note(
      'Middleware is (req, next) => Promise<Response>, composed as an onion (first-listed is outermost); a throw ' +
        'anywhere surfaces as a DataError. The pass-through law (SPEC-R11): no built-in middleware reads, tees, or ' +
        'buffers a Response.body — retry decides from status/headers alone, and json() is the ONE terminal helper ' +
        'that consumes a body. A one-shot streaming request body is never replayed after a token refresh (it ' +
        'rejects with code "unreplayable-body"); a JSON/string body replays fine. The token is applied per request ' +
        'and never written into any store this package owns.',
    ),
  ),
)

// ── 6 · ./stream — ONE contract + a live bridge ─────────────────────────────────────────────────────────────
const bridge = pushToPull<string>({ backpressure: 'buffer', highWaterMark: 8 })
const streamLine = statusLine()
const received: string[] = []
let pushed = 0
let ended = false
streamLine.textContent = 'received = []'
void (async () => {
  for await (const v of bridge.stream) {
    received.push(v)
    streamLine.textContent = `received = [${received.join(', ')}]`
  }
  streamLine.textContent = `received = [${received.join(', ')}]\n(stream ended — the consumer loop returned)`
})()
const pushBtn = uiButton('push(value)', 'soft')
pushBtn.addEventListener('click', () => {
  if (ended) return
  pushed++
  const cue = bridge.push(`v${pushed}`)
  if (!cue) streamLine.textContent += '\n(push returned false — the backpressure cue at highWaterMark)'
})
const endBtn = uiButton('end()', 'ghost')
endBtn.addEventListener('click', () => {
  ended = true
  bridge.end()
})
content.append(
  exampleSection(
    './stream — Streamed<T> = AsyncIterable<T>, one bridge, three adapters',
    frame(row(pushBtn, endBtn), streamLine),
    codeBlock(
      [
        "import { fromFetchStream, fromEventSource, fromWebSocket, pushToPull } from '@agent-ui/data/stream'",
        '',
        "for await (const frame of fromFetchStream('/api/events', { method: 'POST', json: q, frame: 'ndjson' })) render(frame)",
        "for await (const evt of fromEventSource('/sse?ticket=…')) render(evt)      // GET-only; NO custom headers — cookie/query ticket auth",
        "const ws = fromWebSocket('/ws/presence', { heartbeat: { intervalMs: 15_000, timeoutMs: 5_000, ping: { t: 'ping' } }, reconnect: { maxAttempts: 5, baseMs: 200, capMs: 5_000 } })",
        "await ws.send(JSON.stringify(hello))   // awaits while bufferedAmount > highWaterMark",
        "const live = resource('presence', { subscribe: () => ws }, { live: true, store })   // each message commits + wakes data",
        '',
        "// the bridge every adapter is built on — push a callback source, pull it as an AsyncIterable:",
        "const { push, end, stream } = pushToPull<Msg>({ backpressure: 'buffer', highWaterMark: 256, onTeardown: () => socket.close(1000) })",
      ].join('\n'),
      'ts',
    ),
    note(
      'The bridge (SPEC-R12): push() returns false at/over highWaterMark (the consumer’s cue — it never ' +
        'throws); drop-oldest / drop-newest exist for telemetry-shaped feeds; iterator.return() and signal.abort() ' +
        'each end the stream and call onTeardown exactly once. The WebSocket adapter treats no message within ' +
        'heartbeat.timeoutMs as dead — reconnect only if opted in, else the stream ends with a DataError ' +
        '{ kind: "network" }; return()/close() send close code 1000 and never reconnect.',
    ),
  ),
)

// ── 7 · where it sits ───────────────────────────────────────────────────────────────────────────────────────
content.append(
  exampleSection(
    'Where it sits',
    note(
      'shared ← components ← { a2ui, router, code, data } — the FOURTH sibling branch off components; a2ui never ' +
        'imports it (catalog-invisible by construction), and nothing imports upward (per-package layering ' +
        'trip-wires). Runtime dependencies: exactly @agent-ui/components (the kernel) and @agent-ui/shared. Three ' +
        'export surfaces: `.` (seam + store + resource/mutation/paginated + DataError), `./gateway`, `./stream` — the ' +
        '`.` barrel never imports either subpath, and `npm run size` gates that: bundling `.` alone reaches no ' +
        'gateway/stream module and carries no DOM foundation bytes (kernel only). Budgets (SPEC-R14 c, min+brotli): ' +
        '`.` ≤ 6 kB · `./gateway` ≤ 3 kB · `./stream` ≤ 4 kB — measured 2.8 / 1.7 / 2.0 kB at the v1 build. Core and ' +
        'gateway modules reference no DOM global (the headless invariant, statically gated); the stream adapters ' +
        'touch only the platform object they wrap and take an injected constructor for tests. Persistence is ' +
        'deliberately NOT this package’s (`@agent-ui/shared`’s StorageAdapter seam). Decision record: ADR-0192; ' +
        'contract: saas-data-utilities.spec.md.',
    ),
  ),
)
content.append(
  el('p', {}, [
    document.createTextNode('Caching (this page) is not persistence: a resource() store lives in memory and dies with the page. For the seam a consumer reaches for to actually survive a reload, see '),
    el('a', { href: './persistence.html' }, [document.createTextNode('Persistence')]),
    document.createTextNode(' — no built-in StorageAdapter hook exists in @agent-ui/data v1; wiring one is a caller-composed read/write around resource()’s own signals.'),
  ]),
)

// A tidy shutdown when the page is torn down (bfcache/navigation): the demos hold timers and a live loop.
window.addEventListener('pagehide', () => {
  user.dispose()
  rename.dispose()
  feed.dispose()
  bridge.end()
})
