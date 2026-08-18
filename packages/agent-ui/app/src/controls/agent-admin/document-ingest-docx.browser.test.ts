// document-ingest-docx.browser.test.ts — GH #1214's ONE surface-level real-engine proof (LLD §7, C7).
// jsdom's own suite (`document-extraction-docx.test.ts`) proves the byte/XML parsing exhaustively — every
// malformed-input mode, every knob, the registry precedence. What jsdom genuinely CANNOT prove is the
// browser-native `DecompressionStream`/`DOMParser`/attach path/entry-mint composing on a REAL engine — the
// ticket AC's own browser sentence. This file proves precisely that, once: a generated docx `File` driven
// through the shipped attach path (the SAME `#handleAttach` seam `agent-admin-doc-ingest.test.ts` drives
// under jsdom) → a `resource` Entry holding the real extracted text. Never a second module-level suite
// here (the shard-splitting law) — this lands in the `packages:app` shard alongside this folder's other
// `*.browser.test.ts` files.
import { describe, it, expect, afterEach } from 'vitest'
import '@agent-ui/components/foundation-styles.css'
import '@agent-ui/components/component-styles.css'
import '@agent-ui/code/editor.css'
import '../master-detail/master-detail.css'
import '../master-detail/master-detail-pane.css'
import '../nav-rail/nav-rail.css'
import '../settings/settings.css'
import '../conversation/conversation.css'
import '../conversation/conversation-dialog.css'
import '../conversation/conversation-composer.css'
import '../surface-host/surface-host.css'
import '../super-shell/super-shell.css'
import './agent-admin.css'
import './agent-admin.ts'
import type { UIAgentAdminElement } from './agent-admin.ts'
import { ENTRY_KINDS } from './entries.ts'
import { readEntries } from '../entry-list/entry-data.ts'
import { createMemoryStore } from '../settings/memory-store.ts'
import { buildDocxFile, documentXml } from '../../lib/docx-test-fixtures.ts'

const mounted: HTMLElement[] = []
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
  localStorage.clear()
})

function mount(): UIAgentAdminElement {
  const el = document.createElement('ui-agent-admin') as UIAgentAdminElement
  el.store = createMemoryStore({})
  document.body.append(el)
  mounted.push(el)
  return el
}

/** The SAME hidden-file-input `change` gesture `agent-admin-doc-ingest.test.ts`'s own `attachFile` helper
 *  drives under jsdom (that file's own comment: the composer's jsdom test proves the real drop/paste
 *  gesture reaches this same DOM event identically) — this file's job is proving the REAL engine's
 *  `DecompressionStream`/`DOMParser` compose correctly once the `File` is in `#handleAttach`'s hands. */
function attachFile(el: UIAgentAdminElement, file: File): void {
  const composer = el.querySelector('ui-conversation-composer') as HTMLElement
  const input = composer.querySelector('[data-part="attach-input"]') as HTMLInputElement
  Object.defineProperty(input, 'files', { value: [file], configurable: true })
  input.dispatchEvent(new Event('change', { bubbles: true }))
}

const waitUntil = async (label: string, predicate: () => boolean, ms = 10_000): Promise<void> => {
  const deadline = performance.now() + ms
  while (performance.now() < deadline) {
    if (predicate()) return
    await new Promise((r) => requestAnimationFrame(() => r(undefined)))
  }
  throw new Error(`waitUntil timed out: ${label}`)
}

describe('ui-agent-admin — GH #1214: a real docx File through the attach path in a REAL engine (R1 AC)', () => {
  it('a generated docx File attaches, extracts, and mints a resource entry holding the real extracted text', async () => {
    const el = mount()
    await el.updateComplete

    const file = await buildDocxFile('report.docx', {
      documentXml: documentXml([['Hello from a real docx file, extracted in a real browser engine.']]),
    })
    attachFile(el, file)

    await waitUntil('the resource entry minted', () => readEntries(el.store!, ENTRY_KINDS.resource).length > 0)

    const entries = readEntries(el.store!, ENTRY_KINDS.resource)
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({
      label: 'report.docx',
      content: 'Hello from a real docx file, extracted in a real browser engine.',
      enabled: true,
    })

    const chip = el.querySelector('ui-conversation-composer [data-part="context-chip"]') as HTMLElement | null
    expect(chip, 'the attach chip must render — the same visible-round-trip proof as the jsdom suite').not.toBeNull()
    expect((chip!.querySelector('[data-part="context-chip-label"]') as HTMLElement).textContent).toBe('report.docx')
  })
})
