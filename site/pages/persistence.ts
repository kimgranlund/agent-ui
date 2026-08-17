// site/pages/persistence.ts — the persistence GUIDE (GH #1046): the `StorageAdapter` seam @agent-ui/shared
// ships at the DAG's bottom (ADR-0193 — STATUS: proposed, not yet ratified; every claim below is cited to
// that ADR rather than restated as settled fact), how it relates to `@agent-ui/app`'s SEPARATE, sync
// `SettingsStore` seam (settings-store vs memory-store, now writing through this seam per PR #1027), and how
// (little) it relates to `@agent-ui/data` (caching, not persistence — data-doc.ts's own "Where it sits" note).
// A GUIDE page for a package ABOVE components on the DAG — the same ungrouped site-level posture as
// router-doc.ts / data-doc.ts / traits-doc.ts, not a fleet component's {doc,demo,...} set.
//
// DERIVE-FIRST: every interface/factory signature below is sliced VERBATIM out of the real source (Vite
// `?raw` + this page's own brace/blank-line-balanced extractors — the traits-doc.ts precedent, duplicated
// rather than shared) — never hand-retyped, so a field rename/addition shows up here with zero edits and a
// genuine rename that breaks a marker throws at page-load (a real drift gate, not just a comment).
//
// Live proof: the localStorage tier is dogfooded directly on this page — a real `createLocalStorageAdapter`
// from `@agent-ui/shared`, written/read/cleared through a real `ui-text-field` (key) + `ui-text-field`
// (value) + three real `ui-button`s, namespaced so it never collides with the site's own theme/settings
// keys. The IndexedDB tier is NOT live-demoed here (jsdom, which this page's own jsdom test runs under,
// implements no `indexedDB` at all — the same gap `indexed-db-adapter.ts`'s own banner names; its real proof
// is `indexed-db-adapter.browser.test.ts`, under Playwright) — stated plainly rather than staged.
import { mountPage, pageLead } from './_page.ts' // FIRST — foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import { createLocalStorageAdapter, type StorageAdapter } from '@agent-ui/shared'
import { heading, tableHead, tableRow, textCell, codeCell } from '../lib/doc-page.ts'
import { codeBlock } from '../lib/code-block.ts'
import { el, exampleSection } from '../lib/specimens.ts'
import type { UITextFieldElement, UIButtonElement } from '@agent-ui/components/components'
import adapterSrc from '../../packages/agent-ui/shared/src/storage/adapter.ts?raw'
import localStorageAdapterSrc from '../../packages/agent-ui/shared/src/storage/local-storage-adapter.ts?raw'
import indexedDbAdapterSrc from '../../packages/agent-ui/shared/src/storage/indexed-db-adapter.ts?raw'
import settingsStoreSrc from '../../packages/agent-ui/app/src/controls/settings/store.ts?raw'

// ── local derivation helpers — used only on this page (the traits-doc.ts precedent, duplicated rather than
// shared: no other page slices these three source files) ──────────────────────────────────────────────────
function extractInterface(source: string, name: string): string {
  const marker = `export interface ${name} {`
  const start = source.indexOf(marker)
  if (start === -1) throw new Error(`persistence.ts: interface "${name}" not found — renamed or removed?`)
  let depth = 0
  let i = start
  for (; i < source.length; i++) {
    if (source[i] === '{') depth++
    else if (source[i] === '}') {
      depth--
      if (depth === 0) {
        i++
        break
      }
    }
  }
  return source.slice(start, i)
}
function extractSignature(source: string, name: string): string {
  const marker = `export function ${name}(`
  const start = source.indexOf(marker)
  if (start === -1) throw new Error(`persistence.ts: function "${name}" not found — renamed or removed?`)
  const bodyStart = source.indexOf('{', start)
  return source.slice(start, bodyStart).trim()
}

function para(...parts: (string | Node)[]): HTMLElement {
  const p = document.createElement('p')
  for (const part of parts) p.append(typeof part === 'string' ? document.createTextNode(part) : part)
  return p
}
function code(text: string): HTMLElement {
  const c = document.createElement('code')
  c.textContent = text
  return c
}
function link(href: string, text: string): HTMLAnchorElement {
  const a = document.createElement('a')
  a.href = href
  a.textContent = text
  return a
}

const { content } = mountPage({
  title: 'Persistence',
  intro:
    'One typed, async StorageAdapter seam at the DAG’s bottom (@agent-ui/shared) so any layer at or above ' +
    'it can persist without an upward import — a localStorage tier, an IndexedDB tier, and an opt-in ' +
    'cross-tab change-notification seam. ADR-0193 (2026-08-16, STATUS: proposed — not yet ratified).',
})

content.append(
  pageLead(
    'Before this seam, only @agent-ui/app could touch localStorage (its own ui-settings SettingsStore), so ' +
      'nothing below it in the DAG could persist anything without an upward import. This page is that ' +
      'seam’s guide: what it is, a live demo of the tier you’ll reach for most, how it differs from ' +
      'ui-settings’ own store, and how (little) it overlaps @agent-ui/data.',
  ),
)

// ════════════════ 1 · The StorageAdapter interface — derived from source ════════════════
content.append(heading(2, 'The StorageAdapter interface'))
content.append(
  para(
    'Sliced verbatim from ',
    code('packages/agent-ui/shared/src/storage/adapter.ts'),
    ' (ADR-0193 cl.1) — async throughout, since an IndexedDB-fronting seam cannot be sync without a stale ' +
      'in-memory mirror (ADR-0193 Alternatives):',
  ),
)
content.append(codeBlock(extractInterface(adapterSrc, 'StorageChange'), 'ts'))
content.append(codeBlock(extractInterface(adapterSrc, 'StorageAdapter'), 'ts'))
content.append(
  para(
    code('subscribe'),
    ' is optional and lazily wired — nothing is listened to until a caller calls it, and the listener stops ' +
      'the moment the returned unsubscribe function runs (ADR-0193 cl.4). Absent ⇒ no external-change ' +
      'reactivity, the same "optional, absence is a documented no-op" shape ',
    code('SettingsStore.subscribe'),
    ' already uses one layer up (§3 below).',
  ),
)

// ════════════════ 2 · Live demo — the localStorage tier ════════════════
content.append(heading(2, 'Live — the localStorage tier'))
content.append(
  para(
    'A real ',
    code("createLocalStorageAdapter({ namespace: 'agent-ui-docs.persistence-demo' })"),
    ' from ',
    code('@agent-ui/shared'),
    ', driven by two real ',
    code('ui-text-field'),
    's and three real ',
    code('ui-button'),
    's — Write calls ',
    code('adapter.set(key, value)'),
    ', Read calls ',
    code('adapter.get(key)'),
    ', Clear calls ',
    code('adapter.delete(key)'),
    '. Reload this page — the namespace persists across reloads, same as any real consumer’s would.',
  ),
)
{
  const namespace = 'agent-ui-docs.persistence-demo'
  const adapter: StorageAdapter = createLocalStorageAdapter({ namespace })

  const keyField = document.createElement('ui-text-field') as UITextFieldElement
  keyField.setAttribute('label', 'Key')
  keyField.setAttribute('placeholder', 'e.g. draft-title')

  const valueField = document.createElement('ui-text-field') as UITextFieldElement
  valueField.setAttribute('label', 'Value')
  valueField.setAttribute('placeholder', 'e.g. Hello, persistence')

  const writeBtn = document.createElement('ui-button') as UIButtonElement
  writeBtn.setAttribute('variant', 'solid')
  writeBtn.textContent = 'Write'
  const readBtn = document.createElement('ui-button') as UIButtonElement
  readBtn.setAttribute('variant', 'soft')
  readBtn.textContent = 'Read'
  const clearBtn = document.createElement('ui-button') as UIButtonElement
  clearBtn.setAttribute('variant', 'ghost')
  clearBtn.textContent = 'Clear'

  const status = el('p', { class: 'persistence-demo-status' }, [document.createTextNode('—')])
  status.style.fontFamily = 'var(--md-sys-typeface-mono)'
  status.style.fontSize = '0.8rem'
  status.style.whiteSpace = 'pre-wrap'

  const currentKey = (): string => keyField.value
  const currentValue = (): string => valueField.value

  const setStatus = (text: string): void => {
    status.textContent = text
  }

  writeBtn.addEventListener('click', () => {
    void adapter.set(currentKey(), currentValue()).then(() => setStatus(`wrote ${namespace}.${currentKey()} = ${JSON.stringify(currentValue())}`))
  })
  readBtn.addEventListener('click', () => {
    void adapter.get(currentKey()).then((v) => setStatus(v === undefined ? `${namespace}.${currentKey()} — no value stored` : `read ${namespace}.${currentKey()} = ${JSON.stringify(v)}`))
  })
  clearBtn.addEventListener('click', () => {
    void adapter.delete(currentKey()).then(() => setStatus(`cleared ${namespace}.${currentKey()}`))
  })

  const row = el('div', { class: 'persistence-demo-row' }, [keyField, valueField])
  row.style.display = 'flex'
  row.style.gap = '0.75rem'
  row.style.flexWrap = 'wrap'
  const buttonRow = el('div', { class: 'persistence-demo-buttons' }, [writeBtn, readBtn, clearBtn])
  buttonRow.style.display = 'flex'
  buttonRow.style.gap = '0.5rem'

  content.append(exampleSection('Live — createLocalStorageAdapter', row, buttonRow, status))
  // Seeded AFTER connection (`value` is a plain, non-reflecting prop.string() — the onboarding.ts precedent
  // sets `.value` only once a field is live in the tree; setting it pre-connect/via attribute is a no-op).
  keyField.value = 'draft-title'
  valueField.value = 'Hello, persistence'
}
content.append(
  codeBlock(
    [
      "import { createLocalStorageAdapter } from '@agent-ui/shared'",
      '',
      "const adapter = createLocalStorageAdapter({ namespace: 'my-feature' })",
      "await adapter.set('draft-title', 'Hello, persistence')  // -> localStorage['my-feature.draft-title']",
      "await adapter.get('draft-title')                        // -> 'Hello, persistence'",
      "await adapter.delete('draft-title')",
      "await adapter.keys()                                    // -> every key under the 'my-feature.' namespace",
    ].join('\n'),
    'ts',
  ),
)
content.append(codeBlock(extractInterface(localStorageAdapterSrc, 'LocalStorageAdapterOptions'), 'ts'))
content.append(codeBlock(extractSignature(localStorageAdapterSrc, 'createLocalStorageAdapter'), 'ts'))
content.append(
  para(
    'The whole ',
    code('namespace'),
    ' belongs to one adapter — ',
    code('keys()'),
    ' prefix-scans it, so nothing else should write under the same namespace (ADR-0193 cl.2). Every method ' +
      'degrades to a safe no-op/undefined — never a throw — when localStorage is unavailable (SSR, a ' +
      'locked-down embed). ',
    code('subscribe'),
    ' rides the native ',
    code('window'),
    ' ',
    code('storage'),
    ' event — zero-dep, and fires only in OTHER tabs sharing the origin (never the tab that made the write).',
  ),
)

// ════════════════ 3 · The IndexedDB tier — derived from source, not live-demoed ════════════════
content.append(heading(2, 'The IndexedDB tier'))
content.append(
  para(
    'For a genuinely large-value consumer (a corpus cache, a multi-KB A2UI payload) — localStorage’s ~5MB/' +
      'origin ceiling doesn’t apply. ONE object store per adapter instance, every ',
    code('IDBRequest'),
    '/transaction hand-wrapped in a ',
    code('new Promise'),
    ' (the ',
    code('idb'),
    ' library’s PATTERN, hand-rolled, never the dependency — the fleet’s zero-dep law, ADR-0193 Alternatives).',
  ),
)
content.append(codeBlock(extractInterface(indexedDbAdapterSrc, 'IndexedDbAdapterOptions'), 'ts'))
content.append(codeBlock(extractSignature(indexedDbAdapterSrc, 'createIndexedDbAdapter'), 'ts'))
content.append(
  para(
    'Absent ',
    code('indexedDB'),
    ' (jsdom — this page’s own test environment — or a locked-down embed), every method REJECTS with a named ' +
      'Error instead of silently no-op-ing: an IndexedDB failure is a real capacity/availability failure a ' +
      'caller needs to see, unlike a missing localStorage (ADR-0193 cl.3). Cross-tab notification rides ',
    code('BroadcastChannel'),
    ' (IndexedDB has no ',
    code('storage'),
    '-event equivalent), opened lazily on the first ',
    code('set'),
    '/',
    code('delete'),
    '/',
    code('subscribe'),
    ' call — with no ',
    code('close()'),
    ' exposed in this slice, a real (small) leak surface for a caller constructing many short-lived instances ' +
      'against the same store (ADR-0193 Consequences, named rather than hidden).',
  ),
)

// ════════════════ 4 · Choosing a tier ════════════════
content.append(heading(2, 'Choosing a tier'))
{
  interface TierRow {
    readonly tier: string
    readonly syncAsync: string
    readonly capacity: string
    readonly crossTab: string
    readonly when: string
  }
  const ROWS: readonly TierRow[] = [
    {
      tier: 'createLocalStorageAdapter',
      syncAsync: 'Async wrapper (localStorage itself is sync)',
      capacity: '~5MB / origin, string-keyed',
      crossTab: 'Native storage event (zero-dep, other tabs only)',
      when: 'Small string/JSON values — a draft, a filter set, a small preference blob.',
    },
    {
      tier: 'createIndexedDbAdapter',
      syncAsync: 'Genuinely async (IDBRequest/transaction)',
      capacity: 'Capacity-realistic, browser-quota-bound',
      crossTab: 'BroadcastChannel (zero-dep, every other open channel — tab or not)',
      when: 'A corpus cache, a session transcript, a multi-KB A2UI payload.',
    },
    {
      tier: 'SettingsStore (@agent-ui/app)',
      syncAsync: 'Deliberately sync (fork F7 — no pending/loading state)',
      capacity: 'Whatever the concrete store backs it with (memory-store.ts: localStorage)',
      crossTab: 'Store-defined optional subscribe(key, value)',
      when: 'ui-settings only — this contract is what it reads/writes through, not a general-purpose seam.',
    },
    {
      tier: '@agent-ui/data resource()/mutation()',
      syncAsync: 'N/A — an in-memory cache, not a storage tier',
      capacity: 'Process memory, dies with the page',
      crossTab: 'None',
      when: 'Never for persistence — see §6 below.',
    },
  ]
  const table = document.createElement('table')
  table.append(tableHead('Tier', 'Sync / async', 'Capacity', 'Cross-tab', 'Reach for it when'))
  const tbody = document.createElement('tbody')
  for (const r of ROWS) {
    tbody.append(tableRow(codeCell(r.tier), textCell(r.syncAsync), textCell(r.capacity), textCell(r.crossTab), textCell(r.when)))
  }
  table.append(tbody)
  content.append(table)
}

// ════════════════ 5 · settings-store vs memory-store, now on the seam ════════════════
content.append(heading(2, 'settings-store vs memory-store — now on the seam (PR #1027)'))
content.append(
  para(
    code('@agent-ui/app'),
    '’s ',
    code('ui-settings'),
    ' reads/writes through its OWN, deliberately sync ',
    code('SettingsStore'),
    ' contract (',
    code('packages/agent-ui/app/src/controls/settings/store.ts'),
    ') — a DIFFERENT, higher-altitude seam ADR-0193 does not touch, supersede, or require ',
    code('ui-settings'),
    ' to adopt (ADR-0193’s own header, "Relates" line):',
  ),
)
content.append(codeBlock(extractInterface(settingsStoreSrc, 'SettingsStore'), 'ts'))
content.append(
  para(
    'The REFERENCE adapter, ',
    code('memory-store.ts'),
    '’s ',
    code('createMemoryStore'),
    ', bridges the two: its ',
    code('persistKey'),
    ' flavour now WRITES through ',
    code('@agent-ui/shared'),
    '’s ',
    code('createLocalStorageAdapter'),
    ' (PR #1027) instead of touching ',
    code('localStorage'),
    ' directly, fronted by a synchronous read-through cache (a construct-then-',
    code('get'),
    ' must see a persisted value in the same tick — no async ',
    code('keys()'),
    '/',
    code('get()'),
    ' round trip can satisfy that). Full detail + the derived ',
    code('MemoryStoreOptions'),
    ' interface: ',
    link('./settings.html', 'the Settings guide'),
    ', §2b.',
  ),
)

// ════════════════ 6 · How @agent-ui/data relates ════════════════
content.append(heading(2, 'How @agent-ui/data relates — caching is not persistence'))
content.append(
  para(
    'Honestly: barely. ',
    code('@agent-ui/data'),
    '’s ',
    code('resource()'),
    '/',
    code('mutation()'),
    '/',
    code('paginated()'),
    ' back a structurally-sharing, instance-scoped, IN-MEMORY store — it dies with the page, exactly like ',
    code('memory-store.ts'),
    '’s un-persisted Map flavour. ',
    code('@agent-ui/data'),
    '’s own guide states this explicitly: persistence is "deliberately NOT this package’s" (',
    link('./data-doc.html', 'Data'),
    ', "Where it sits"). ',
  ),
)
content.append(
  para(
    'There is no built-in ',
    code('StorageAdapter'),
    ' hook anywhere in ',
    code('@agent-ui/data'),
    ' v1 — no ',
    code('resource(key, source, { persist: adapter })'),
    ' option exists today. A consumer wanting a ',
    code('resource()'),
    ' to survive a reload would compose it by hand: read the adapter at construction to seed an ',
    code('initial'),
    ' value, and write through it on every commit — the exact shape ',
    code('memory-store.ts'),
    ' hand-rolls one layer down (§5 above), not a capability ',
    code('@agent-ui/data'),
    ' ships. Stated as a gap, not a feature — a future adapter-hook slice, if it happens, is its own dispatch ' +
      'against a future issue, not decided here.',
  ),
)

// ════════════════ 7 · Where it sits ════════════════
content.append(heading(2, 'Where it sits'))
content.append(
  para(
    '@agent-ui/shared',
    ' — the DAG’s bottom (',
    code('shared ← components ← {a2ui, router, code, data} ← app'),
    ') — imports nothing, so every layer AT OR ABOVE it can reach ',
    code('StorageAdapter'),
    ' without an upward import: a corpus cache, an A2UI payload store, a session-transcript buffer, or ',
    code('@agent-ui/app'),
    '’s own settings surfaces (ADR-0193 Consequences). ADR-0193 itself is STATUS: proposed, not yet ratified — ',
    'the interface + both tiers + the notification seam are shipped code (PRs #1012/#1027), but the decision ' +
      'record backing them has not been ratified as of this page’s own build.',
  ),
)
