// agent-admin-app.browser.test.ts — GH #686's Amendment (admin-three-pane-ia.lld.md §16, S7-d): the page's
// own canvas-header (GH #51) is RETIRED — `ui-agent-admin`'s own S7-c unified header bar is the only
// header this page renders, and every prior page-level overflow action (agent switch, New Agent, Import,
// Export, Reset) now reaches its page-side handler through one of the component's six registration seams
// (LLD §16.3) instead of a page-owned ui-menu commit. Side-effect-imports the page module (the
// a2ui-live-conversation.browser.test.ts precedent — its own file, its own document, so the full-viewport
// mount collides with nothing), then drives the REAL header controls end to end: open → commit a different
// agent → the select's own value, the persisted active id, and the admin store all follow. The store-swap
// MECHANISM itself stays unit-proven in agent-admin-app.test.ts (jsdom); this file proves the page WIRING
// into the six seams (the "picker-wiring" trap — a callback registered is not evidence a real click reaches
// it — this file clicks the REAL affordance and asserts the REAL page-side function ran).
//
// The fleet's default browser-project viewport (414×896, ADR-0150) sits BELOW the header's own 54rem band
// line, so every test below drives the NARROW rendering: `new-agent-narrow` ("+") and the `overflow-menu`
// ("•••", Import/Export) — the wide `new-agent-wide`/`import-action`/`export-action` twins are `[hidden]`
// at this width by the component's own CSS band swap (agent-admin.browser.test.ts proves that swap
// cross-engine already; this file does not re-prove it).
import { describe, it, expect, vi, afterAll } from 'vitest'
import './agent-admin-app.ts' // side-effect import — mounts the real ui-agent-admin, no page-level header
import { AGENT_PRESETS, ACTIVE_PRESET_KEY, IMPORTED_PERSONAS_KEY, ROSTER_ORDER_KEY, loadImportedPersonas, personaRoster } from './agent-admin-presets.ts'
import { readPersonaFile } from './agent-admin-persona-file.ts'

/** The bytes the Export row handed the browser — captured by the first GH #406 leg, replayed by the
 *  second (the import must consume EXACTLY what the export produced, not a hand-built lookalike). */
let exported = ''

// GH #347 — REAL-TIMING HEADROOM. This file awaits real elapsed time (rAF frame settles),
// so its duration is set by the browser's scheduling, which stretches under concurrent host load.
// Class definition + why this is not a global raise: vitest.browser.config.ts, REAL-TIMING HEADROOM.
vi.setConfig({ testTimeout: 30_000 })

const raf = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))

/** The preset the page resolved at import time (localStorage may carry a prior run's choice — resolve by
 *  the SAME rule the page uses rather than assuming the first preset). */
function resolvedActive(): (typeof AGENT_PRESETS)[number] {
  return AGENT_PRESETS.find((p) => p.id === localStorage.getItem(ACTIVE_PRESET_KEY)) ?? AGENT_PRESETS[0]!
}

/** The subset of `SettingsStore` this file reads/writes directly — real delivery proof, never a source grep. */
interface StoreLike {
  get(key: string): unknown
  set(key: string, value: unknown): void
}
function admin(): HTMLElement & { store?: StoreLike } {
  return document.querySelector('ui-agent-admin') as HTMLElement & { store?: StoreLike }
}
function agentSelect(): HTMLElement & { value: string } {
  return admin().querySelector('[data-part="agent-select"]') as HTMLElement & { value: string }
}
/** The picker's ROSTER options — every `[role=option]` EXCEPT the two component-owned "Manage" items
 *  (GH #845's `agent-admin:new-agent` / `agent-admin:edit-agents` sentinels, which are structure, not
 *  agents). Every roster count/last-row assertion in this file goes through here: a bare
 *  `[role="option"]` sweep now also collects those two and would answer "16 agents" for a 14-agent roster. */
function rosterOptions(): HTMLElement[] {
  return [...agentSelect().querySelectorAll('[role="option"]')].filter(
    (option) => !(option.getAttribute('value') ?? '').startsWith('agent-admin:'),
  ) as HTMLElement[]
}
async function openOverflow(): Promise<HTMLElement> {
  const overflow = admin().querySelector('[data-part="overflow-menu"]') as HTMLElement
  ;(overflow.querySelector('[data-part="trigger"]') as HTMLElement).click()
  await raf()
  return overflow
}

describe('agent-admin-app — no page-level header of its own (GH #686 Amendment, S7-d)', () => {
  it('renders NOTHING above ui-agent-admin — the canvas-header, the agent-menu, and the page overflow menu are all gone', async () => {
    await raf()
    expect(document.querySelector('header.canvas-header'), 'the canvas-header must be fully retired').toBeNull()
    expect(document.querySelector('.canvas-header-name'), 'the title zone is gone').toBeNull()
    expect(document.querySelector('.agent-menu'), 'the page-owned agent switcher is gone').toBeNull()
    expect(document.querySelector('body > ui-menu'), 'no page-level ui-menu sits outside ui-agent-admin').toBeNull()
    // Exactly ONE header now exists — the component's own S7-c bar.
    expect(admin().querySelector('[data-part="admin-header"]'), "ui-agent-admin's own header bar is the only header").not.toBeNull()
    // The page's actual mount root (this harness has no static `#app`, so the page module's own
    // `document.querySelector('#app') ?? document.body` fallback lands on `document.body` — the file
    // banner's own documented gap, unrelated to this slice) carries no `<header>` child of its own.
    expect(document.body.querySelector(':scope > header')).toBeNull()
  })
})

describe("agent-admin-app — the header's agent-select (S7-d: setAgentRoster/onAgentSelect)", () => {
  it('seeds every preset as a real option, with the resolved active persona already selected', async () => {
    await raf()
    const select = agentSelect()
    const options = rosterOptions()
    expect(options, 'one option per preset').toHaveLength(AGENT_PRESETS.length)
    expect(select.value).toBe(resolvedActive().id)
  })

  // GH #905 — on the REAL page, at boot, with no click anywhere: the active agent's ROW is marked, not just
  // the trigger label. The marker is `ui-select`'s own selected mechanism (`aria-selected`, painted by
  // select.css's `[role='option'][aria-selected='true']` rule) — the owner's report was a panel where every
  // row rendered identically because the silent `value =` write moves the trigger label and nothing else.
  it('marks the ACTIVE agent\'s ROW selected — one marker, agreeing with the committed value, painted, and never on the #845 management items', async () => {
    await raf()
    const select = agentSelect()
    const marked = [...select.querySelectorAll('[role="option"][aria-selected="true"]')] as HTMLElement[]
    expect(marked.map((o) => o.getAttribute('value')), 'exactly one row is marked, and it is the committed agent').toEqual([select.value])
    for (const item of [...select.querySelectorAll('[data-part="roster-action"]')] as HTMLElement[]) {
      // GH #908 — `ui-select` now sweeps `aria-selected` across EVERY `[role=option]` from its own
      // `value` (declarative/programmatic/commit alike), so a verb DOES carry the attribute (as
      // "false") the moment the control's own fleet-wide reflect runs, not only after a first click.
      // The real invariant this test protects is unchanged: never "true", never the selected fill.
      expect(item.getAttribute('aria-selected'), `${item.textContent} is a management VERB — never "where you are"`).not.toBe('true')
    }

    // The PAINT leg on the real page. Read with focus parked outside the panel: the focus and selected
    // fills resolve to the same token (select.css), so a fill measured on the focused row would prove
    // nothing — and a pointer-opened panel (the owner's screenshot) matches no :focus-visible anyway.
    const panel = select.querySelector('[data-part="listbox"]') as HTMLElement
    ;(select.querySelector('[data-part="trigger"]') as HTMLElement).click()
    await raf()
    const focused = document.activeElement as HTMLElement | null
    if (focused !== null && panel.contains(focused)) focused.blur()
    await raf()
    expect(panel.contains(document.activeElement), 'focus is outside the panel — the fill below is selection, not a focus ring').toBe(false)
    const activeRow = marked[0]!
    const otherRow = rosterOptions().find((o) => o.getAttribute('value') !== select.value)!
    const activeBg = getComputedStyle(activeRow).backgroundColor
    expect(activeBg, 'the marked row paints a real fill, not the bare panel surface').not.toMatch(/rgba\([^)]*,\s*0\)$/)
    expect(getComputedStyle(otherRow).backgroundColor, 'and an unselected sibling does not wear it').not.toBe(activeBg)
    // Leave the picker as the next test expects to find it: closed.
    ;(select as unknown as { open: boolean }).open = false
    await raf()
  })

  it('picking a different agent through the REAL select commits, persists, and swaps the admin store', async () => {
    await raf()
    const select = agentSelect()
    // Open the trigger — the real user gesture (selectionCommit's click handler only commits while open).
    ;(select.querySelector('[data-part="trigger"]') as HTMLElement).click()
    await raf()

    const before = resolvedActive()
    const target = AGENT_PRESETS.find((p) => p.id !== before.id)!
    const targetOption = [...select.querySelectorAll('[role="option"]')].find((o) => (o as HTMLElement).getAttribute('value') === target.id) as HTMLElement
    expect(targetOption, `an option for ${target.id} exists`).not.toBeUndefined()
    targetOption.click()
    await raf()

    expect(localStorage.getItem(ACTIVE_PRESET_KEY), 'the committed agent persists').toBe(target.id)
    expect(select.value, 'the select reflects the commit (setAgentRoster re-push, LLD §16.3)').toBe(target.id)

    // GH #905 — and the MARKER moved with the switch: the page's own re-push (applyPersona → pushRoster)
    // rebuilds the rows, so the proof is that the FRESH nodes carry it on the newly-active row alone.
    expect(
      [...select.querySelectorAll('[role="option"][aria-selected="true"]')].map((o) => o.getAttribute('value')),
      'one marker, on the agent the user just picked — never left behind on the previous one',
    ).toEqual([target.id])
    expect(
      [...select.querySelectorAll('[data-part="roster-action"][aria-selected="true"]')],
      'a switch never plants the marker on New Agent / Edit Agents',
    ).toHaveLength(0)
  })
})

// ── GH #406 — the persona library on the REAL page, now through the header's Import/Export seams ─────────
// The FORMAT's own round trip (byte-equal composed prompt, deep-equal store snapshot) is proven
// deterministically in agent-admin-persona-file.test.ts; this leg proves the PAGE WIRING those pure
// functions hang off: the narrow overflow carries Import/Export as real menu items wired to
// `onImportRequest`/`onExportRequest`, Export really produces a persona file's bytes (captured off the
// Blob the download hands the browser), and feeding those exact bytes back through the hidden file input
// mints a NEW roster row that becomes the active persona and persists.
describe('agent-admin-app — the persona library (GH #406) via onImportRequest/onExportRequest', () => {
  afterAll(() => {
    // Leave no roster residue: the page reads the imported library at MODULE LOAD, so a leftover record
    // would add a row at the next run's boot and redden this file's own per-preset row counts.
    for (const persona of loadImportedPersonas()) {
      for (const key of Object.keys(localStorage).filter((k) => k.startsWith(`agent-admin-app.${persona.id}.`))) {
        localStorage.removeItem(key)
      }
    }
    localStorage.removeItem(IMPORTED_PERSONAS_KEY)
    localStorage.setItem(ACTIVE_PRESET_KEY, AGENT_PRESETS[0]!.id)
  })

  it('the narrow overflow carries Export/Import as real menu items, and Export hands the browser a real persona file (onExportRequest)', async () => {
    const overflow = await openOverflow()
    expect(overflow.querySelector('[data-value="export-agent"]'), 'the Export menu item').not.toBeNull()
    expect(overflow.querySelector('[data-value="import-agent"]'), 'the Import menu item').not.toBeNull()

    // Capture the downloaded bytes: the page hands the anchor an object URL for the Blob it built.
    const realCreate = URL.createObjectURL.bind(URL)
    const blobs: Blob[] = []
    URL.createObjectURL = (obj: Blob | MediaSource): string => {
      if (obj instanceof Blob) blobs.push(obj)
      return realCreate(obj)
    }
    try {
      ;(overflow.querySelector('[data-value="export-agent"]') as HTMLElement).click()
      await raf()
    } finally {
      URL.createObjectURL = realCreate
    }
    expect(blobs, 'the click actually reached onExportRequest\'s registered callback — exactly one download blob').toHaveLength(1)
    expect(blobs[0]!.type).toBe('application/json')
    exported = await blobs[0]!.text()
    const parsed = readPersonaFile(exported)
    expect(parsed.ok, parsed.ok ? '' : parsed.error).toBe(true)
    if (!parsed.ok) return
    expect(parsed.file.persona.label, 'the file names the ACTIVE persona').toBe(resolvedActive().label)
  })

  it('feeding those exact bytes back through the file input (onImportRequest → fileInput.click()) mints a NEW persona, makes it active, and persists it', async () => {
    expect(exported, 'the export leg above must have run first').not.toBe('')
    const before = rosterOptions().length

    // The real click path: onImportRequest's registered callback opens the hidden file input — spied,
    // not assumed, so a dead registration (the file input populated below regardless) cannot pass this
    // test silently (the exact gap a source-only check would miss).
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    const clickSpy = vi.spyOn(input, 'click')
    const overflow = await openOverflow()
    ;(overflow.querySelector('[data-value="import-agent"]') as HTMLElement).click()
    await raf()
    expect(clickSpy, 'clicking the menu item genuinely reached onImportRequest\'s callback, which opened the file input').toHaveBeenCalledTimes(1)
    clickSpy.mockRestore()
    const transfer = new DataTransfer()
    transfer.items.add(new File([exported], 'persona.json', { type: 'application/json' }))
    input.files = transfer.files
    input.dispatchEvent(new Event('change', { bubbles: true }))

    // The handler reads the File asynchronously — poll rather than assume one frame is enough.
    for (let i = 0; i < 50; i += 1) {
      if (rosterOptions().length > before) break
      await raf()
    }
    const select = agentSelect()
    const options = rosterOptions()
    expect(options, 'one NEW roster row — an import never overwrites a preset').toHaveLength(before + 1)

    const minted = options[options.length - 1]!
    expect(minted.textContent).toContain('(imported)')
    expect(select.value, 'the imported persona becomes the active one (setAgentRoster re-push)').toBe(minted.getAttribute('value'))
    expect(localStorage.getItem(ACTIVE_PRESET_KEY)).toBe(minted.getAttribute('value'))

    // Registered in the PERSISTED library — this is what makes it survive a reload.
    const library = loadImportedPersonas()
    expect(library.map((p) => p.id)).toEqual([minted.getAttribute('value')])
    expect(library[0]!.seed, 'the imported seed is the exported state').toEqual((readPersonaFile(exported) as { ok: true; file: { state: unknown } }).file.state)
  })

  /** Feed one file's bytes through the picker and wait for the failure announcement.
   *
   *  The region is CLEARED first: a toast lives 6s and these tests run in about one, so an earlier
   *  leg's "Import failed…" is still on screen when the next one starts — waiting for "a toast that
   *  says Import failed" would be satisfied by the STALE one and the assertions below would then run
   *  before the (async) import had done anything at all. Measured, not theorized: with the file's
   *  entry-item validation removed this probe passed 20/20 until the clear was added. */
  async function expectRejected(bytes: string, name: string): Promise<void> {
    for (const stale of document.querySelectorAll('ui-toast-region ui-toast')) stale.remove()
    const before = rosterOptions().length
    const activeBefore = localStorage.getItem(ACTIVE_PRESET_KEY)
    const libraryBefore = JSON.stringify(loadImportedPersonas())
    const overflow = await openOverflow()
    ;(overflow.querySelector('[data-value="import-agent"]') as HTMLElement).click()
    await raf()
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    const transfer = new DataTransfer()
    transfer.items.add(new File([bytes], name, { type: 'application/json' }))
    input.files = transfer.files
    input.dispatchEvent(new Event('change', { bubbles: true }))
    const lastToast = (): string => {
      const toasts = [...document.querySelectorAll('ui-toast-region ui-toast')]
      return toasts[toasts.length - 1]?.textContent ?? ''
    }
    for (let i = 0; i < 50; i += 1) {
      if (lastToast().includes('Import failed')) break
      await raf()
    }
    expect(lastToast(), `${name}: the failure is announced, never silent`).toContain('Import failed')
    expect(rosterOptions(), `${name}: nothing was minted`).toHaveLength(before)
    expect(localStorage.getItem(ACTIVE_PRESET_KEY), `${name}: the active persona is untouched`).toBe(activeBefore)
    expect(JSON.stringify(loadImportedPersonas()), `${name}: nothing was persisted`).toBe(libraryBefore)
  }

  it('a file that is not a persona file is rejected visibly, and mints nothing', async () => {
    await expectRejected('{"kind":"something-else"}', 'nope.json')
  })

  it('a hand-edited persona file with a malformed entry is rejected BEFORE it is persisted or activated', async () => {
    // The hazard the format's own hand-editability creates: valid JSON, right kind, right version, but a
    // junk item inside an entry list. Import persists AND activates before anything renders, so accepting
    // this would wedge the page on every reload — the import must die at the door instead.
    const file = JSON.parse(exported) as { state: Record<string, unknown> }
    file.state['entries:prompt-section'] = [...(file.state['entries:prompt-section'] as unknown[]), null]
    await expectRejected(JSON.stringify(file), 'mangled.json')
  })
})

// ── GH #889 — the dev-debug bundle, via onExportDebugBundleRequest ──────────────────────────────────────
// The FORMAT (which files, what's in them, the manifest) is proven deterministically in
// agent-admin-debug-export.test.ts; this leg proves the REAL page wiring — the overflow's fourth item is a
// real menu row, clicking it reaches the real handler, and the handler hands the browser a real,
// parseable zip Blob (captured off the same `URL.createObjectURL` seam the persona-export leg above uses).
describe('agent-admin-app — the dev-debug bundle (GH #889) via onExportDebugBundleRequest', () => {
  /** A minimal, INDEPENDENT central-directory walk — just the entry NAMES, no data-content re-check (the
   *  bytes themselves are already proven in agent-admin-debug-export.test.ts/zip-writer.test.ts). Proves
   *  this is a real, well-formed zip a real tool could open, not merely "a Blob got created". */
  function zipEntryNames(bytes: Uint8Array): string[] {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    expect(view.getUint32(bytes.length - 22, true), 'ends with a real end-of-central-directory record').toBe(0x06054b50)
    const total = view.getUint16(bytes.length - 22 + 10, true)
    const centralOffset = view.getUint32(bytes.length - 22 + 16, true)
    const decoder = new TextDecoder()
    const names: string[] = []
    let cursor = centralOffset
    for (let i = 0; i < total; i += 1) {
      expect(view.getUint32(cursor, true)).toBe(0x02014b50)
      const nameLen = view.getUint16(cursor + 28, true)
      const extraLen = view.getUint16(cursor + 30, true)
      const commentLen = view.getUint16(cursor + 32, true)
      names.push(decoder.decode(bytes.subarray(cursor + 46, cursor + 46 + nameLen)))
      cursor += 46 + nameLen + extraLen + commentLen
    }
    return names
  }

  it('the overflow carries "Export debug bundle" as a real menu item, wired to a real zip download', async () => {
    const overflow = await openOverflow()
    const item = overflow.querySelector('[data-value="export-debug-bundle"]') as HTMLElement
    expect(item, 'the fourth overflow item').not.toBeNull()
    expect(item.textContent).toBe('Export debug bundle')

    const realCreate = URL.createObjectURL.bind(URL)
    const blobs: Blob[] = []
    URL.createObjectURL = (obj: Blob | MediaSource): string => {
      if (obj instanceof Blob) blobs.push(obj)
      return realCreate(obj)
    }
    try {
      item.click()
      await raf()
    } finally {
      URL.createObjectURL = realCreate
    }
    expect(blobs, 'the click reached onExportDebugBundleRequest\'s registered callback — exactly one zip Blob').toHaveLength(1)
    expect(blobs[0]!.type).toBe('application/zip')

    const bytes = new Uint8Array(await blobs[0]!.arrayBuffer())
    const names = zipEntryNames(bytes)
    // The LIVE active id, read off the header's own select (`resolvedActive()`'s localStorage read is not
    // reliable here — earlier describe blocks in this file switch the live page's active persona via real
    // clicks and only reset localStorage in their own `afterAll`, never re-selecting for real).
    const activeId = agentSelect().value
    expect(names, 'one agent-settings entry per shipped preset').toEqual(
      expect.arrayContaining(AGENT_PRESETS.map((p) => `agent-settings/${p.id}.json`)),
    )
    expect(names).toContain(`test-chat/${activeId}.json`)
    expect(names).toContain(`builder-interview/${activeId}.json`)
    expect(names).toContain('manifest.json')
    // Scoped to the ACTIVE agent only — no OTHER preset's transcript files exist (GH #889's scope ruling:
    // the transcripts are element-lifetime, per-active-draft, never persisted for an inactive agent).
    const otherPresetIds = AGENT_PRESETS.map((p) => p.id).filter((id) => id !== activeId)
    for (const id of otherPresetIds) {
      expect(names).not.toContain(`test-chat/${id}.json`)
      expect(names).not.toContain(`builder-interview/${id}.json`)
    }
  })
})

// ── GH #686 S7-d — New Agent's ONE verb is Generate (OQ-A) ─────────────────────────────────────────────
// GH #637 S1's own dedicated "New agent → Blank" front door (an interview-less mint) had NO seam of the
// six to route through once the page-level overflow retired, and is RETIRED here — the page-side
// `createBlankAgent` is gone (agent-admin-app.test.ts's own residue-grep pins it), flagged as a real,
// disclosed capability loss pending Kim's OQ-A ruling on Blank's new home (this build's GH #686 Findings
// comment states the full trace). `mintBlankPersona` itself survives, reused verbatim by Generate's own
// seed below — this leg proves the SURVIVING verb, not the retired one.
describe('agent-admin-app — the header\'s New Agent button routes to Generate (GH #686 OQ-A, S7-d)', () => {
  afterAll(() => {
    // Same no-residue duty as the persona-library block above — a leftover "New agent" row would redden
    // this file's own per-preset row counts on the next run.
    for (const persona of loadImportedPersonas()) {
      for (const key of Object.keys(localStorage).filter((k) => k.startsWith(`agent-admin-app.${persona.id}.`))) {
        localStorage.removeItem(key)
      }
    }
    localStorage.removeItem(IMPORTED_PERSONAS_KEY)
    localStorage.setItem(ACTIVE_PRESET_KEY, AGENT_PRESETS[0]!.id)
  })

  it('no "New agent → Blank" affordance exists anywhere on the page — the retirement is real, not a stale label', async () => {
    await raf()
    const bodyText = document.body.textContent ?? ''
    expect(bodyText).not.toContain('New agent → Blank')
    expect(document.querySelector('[data-value="new-agent-blank"]')).toBeNull()
  })

  it('clicking the narrow "+" mints a fresh agent, activates it, persists it, AND arms the Builder over it (the Generate path, never a bare blank mint)', async () => {
    const before = rosterOptions().length
    const libraryBefore = loadImportedPersonas().length

    const newAgentBtn = admin().querySelector('[data-part="new-agent-narrow"]') as HTMLElement
    expect(newAgentBtn.hidden, 'the narrow "+" paints at this viewport (onNewAgentRequest IS registered)').toBe(false)
    newAgentBtn.click()
    await raf()

    const select = agentSelect()
    const options = rosterOptions()
    expect(options, 'one NEW roster row, no preset overwritten').toHaveLength(before + 1)
    const minted = options[options.length - 1]!
    expect(minted.textContent, 'the mint law: "New agent", numbered only on a real collision').toMatch(/^New agent( \d+)?$/)

    // Activated: the select's own value + the persisted active-id both follow the mint (setAgentRoster
    // re-push inside applyPersona — the same contract an imported persona gets).
    expect(select.value, 'the minted agent becomes the active one').toBe(minted.getAttribute('value'))
    expect(localStorage.getItem(ACTIVE_PRESET_KEY)).toBe(minted.getAttribute('value'))

    // Persisted through the GH #406 imported-library record — what survives a reload.
    const library = loadImportedPersonas()
    expect(library.length, 'one new library record').toBe(libraryBefore + 1)
    const record = library.find((p) => p.id === minted.getAttribute('value'))
    expect(record, 'registered under the SAME id the roster row carries').toBeDefined()
    expect(record?.imported).toBe(true)

    // The Generate-specific tail: the Builder interview arms over the fresh draft (the one behavior that
    // distinguishes this from the retired bare-Blank mint) — Co-pilot becomes visible AND primary.
    const holder = admin().querySelector('[data-part="pane-holder"]') as HTMLElement
    expect(holder.getAttribute('data-show')?.split(' '), 'Co-pilot joins the shown set').toContain('copilot')
    expect(holder.getAttribute('data-primary'), 'Co-pilot becomes primary — the interview opens on it').toBe('copilot')
  })
})

// ── GH #686 S7-d — Reset Agent's real delivery (onResetRequest → resetPersona + applyPersona) ─────────────
// The exact "picker-wiring" trap this codebase has hit three times this session: a callback registered is
// not evidence a real click reaches it, still less that it does something real. This clicks the ACTUAL
// `reset-agent-button` on the mounted page and asserts the ACTIVE PERSONA'S STORE genuinely re-seeds — a
// brand-new store instance whose dirtied value is gone — never just "a function reference exists in the
// source" (agent-admin-app.test.ts's own jsdom suite proves the seam's shape; this proves the real click's
// real effect). Independent of WHICH persona is active at this point in the file (earlier describe blocks
// switch/mint/import several) — it captures the seed value fresh, dirties it, and proves the exact revert.
// ── GH #845 — roster management, end to end in a REAL engine ─────────────────────────────────────────────
// The mechanics are unit-proven twice over (agent-admin-presets.test.ts / agent-admin-persona-file.test.ts
// for the persistence, agent-admin-app-drawer.test.ts for the page wiring in jsdom). What ONLY a real engine
// can prove is the part jsdom stubs away: the picker's own commit path (a real trigger-open + option click,
// not a synthesized event on an un-opened listbox) and `ui-drawer`'s native `<dialog>` — a genuine top-layer
// `:modal` the roster rows live inside. So this leg drives the WHOLE arc on the real page in one flow:
// picker → Edit Agents → Duplicate a shipped preset → activate + dirty the copy → Delete it → the keys are
// swept and the active agent falls back. The localStorage enumeration afterwards is the AC4 proof.
describe('agent-admin-app — the Edit Agents drawer: duplicate, then delete the ACTIVE custom agent (GH #845)', () => {
  afterAll(() => {
    for (const persona of loadImportedPersonas()) {
      for (const key of Object.keys(localStorage).filter((k) => k.startsWith(`agent-admin-app.${persona.id}.`))) {
        localStorage.removeItem(key)
      }
    }
    localStorage.removeItem(IMPORTED_PERSONAS_KEY)
    localStorage.removeItem(ROSTER_ORDER_KEY)
    localStorage.setItem(ACTIVE_PRESET_KEY, AGENT_PRESETS[0]!.id)
  })

  // GH #917 — the mounted `ui-agent-admin` now carries its OWN per-section entry-CRUD drawers, so a bare
  // `document.querySelector('ui-drawer')` can resolve to one of THOSE (document order: `admin` precedes the
  // page's `drawer` sibling, agent-admin-app.ts's `root.append(admin, toasts, fileInput, drawer)`) instead of
  // this page's own roster drawer — addressed by its own class instead (the agent-admin-app-drawer.test.ts
  // precedent, minted the same slice: "THIS page's roster drawer, addressed by its own class").
  const drawerEl = (): HTMLElement & { open: boolean } => document.querySelector('ui-drawer.roster-drawer') as HTMLElement & { open: boolean }
  const dialogEl = (): HTMLDialogElement => drawerEl().querySelector('[data-part="dialog"]') as HTMLDialogElement
  const rowFor = (id: string): HTMLElement | null => document.querySelector(`.roster-row[data-agent="${id}"]`)
  const keysUnder = (id: string): string[] => Object.keys(localStorage).filter((k) => k.startsWith(`agent-admin-app.${id}.`))
  /** The picker's own roster ids (the two `agent-admin:*` Manage sentinels excluded) — the order the drawer
   *  rows must mirror. Read off the PICKER rather than off a fresh `personaRoster()`: earlier describes in
   *  this file mint and then localStorage-clean their personas without re-syncing the live page, so storage
   *  and the mounted page legitimately disagree until the next refresh. */
  const pickerIds = (): string[] => rosterOptions().map((o) => o.getAttribute('value') ?? '')

  /** Open the drawer through the picker's own "Edit Agents" item — the REAL commit path (`selectionCommit`
   *  only commits while the panel is open, so the trigger click is not optional). */
  async function openDrawerViaPicker(): Promise<void> {
    const select = agentSelect()
    ;(select.querySelector('[data-part="trigger"]') as HTMLElement).click()
    await raf()
    ;(select.querySelector('[data-part="roster-action"][value="agent-admin:edit-agents"]') as HTMLElement).click()
    await raf()
  }

  /** Pick a roster entry through the picker (the same real gesture the file's own agent-select leg uses). */
  async function pickAgent(id: string): Promise<void> {
    const select = agentSelect()
    ;(select.querySelector('[data-part="trigger"]') as HTMLElement).click()
    await raf()
    ;(select.querySelector(`[role="option"][value="${id}"]`) as HTMLElement).click()
    await raf()
  }

  it('opens as a real top-layer :modal listing every roster entry, with the shipped presets structurally unarmed', async () => {
    await raf()
    expect(drawerEl(), 'the page mounts the drawer').not.toBeNull()
    expect(dialogEl().hasAttribute('open'), 'closed until asked for').toBe(false)

    await openDrawerViaPicker()

    expect(dialogEl().hasAttribute('open'), 'the picker item reached the page seam').toBe(true)
    expect(dialogEl().matches(':modal'), 'and the drawer really entered the platform top layer').toBe(true)
    const listed = [...document.querySelectorAll('.roster-row')].map((row) => (row as HTMLElement).dataset.agent)
    expect(listed, 'one row per roster entry, in picker order').toEqual(pickerIds())
    expect(listed.length, 'every shipped preset at least').toBeGreaterThanOrEqual(AGENT_PRESETS.length)
    const preset = rowFor(AGENT_PRESETS[0]!.id)!
    expect(preset.querySelector('.roster-row-delete'), 'a shipped preset carries no delete affordance at all').toBeNull()
    expect(preset.querySelector('.roster-row-rename'), 'nor a rename one').toBeNull()
    expect(preset.querySelector('.roster-row-duplicate'), 'duplicate is the escape hatch, and it IS offered').not.toBeNull()
  })

  it('Duplicate on a preset row mints an editable copy; activating and dirtying it writes real persisted keys', async () => {
    const source = AGENT_PRESETS[0]!
    ;(rowFor(source.id)!.querySelector('.roster-row-duplicate') as HTMLElement).click()
    await raf()

    const copy = personaRoster().find((p) => p.label === `${source.label} (copy)`)
    expect(copy, 'the copy joined the roster').toBeDefined()
    expect(copy?.imported, 'as a LIBRARY record — deletable, unlike its source').toBe(true)
    expect(rowFor(copy!.id)?.querySelector('.roster-row-delete'), 'and its row carries Delete').not.toBeNull()

    // Close the drawer (the page behind a :modal is inert — the picker is unreachable until it closes).
    ;(document.querySelector('.roster-drawer-done') as HTMLElement).click()
    await raf()
    expect(dialogEl().hasAttribute('open')).toBe(false)

    await pickAgent(copy!.id)
    expect(agentSelect().value, 'the copy is now the active agent').toBe(copy!.id)
    const store = admin().store
    store!.set('name', 'DIRTY-BEFORE-DELETE')
    await raf()
    expect(keysUnder(copy!.id).length, 'real persisted keys now exist under its namespace').toBeGreaterThan(0)
    expect(localStorage.getItem(ACTIVE_PRESET_KEY)).toBe(copy!.id)
  })

  it('Delete on the ACTIVE copy sweeps EVERY key under its prefix, drops the record, and falls back to the first roster entry', async () => {
    const copy = loadImportedPersonas().find((p) => p.label.endsWith('(copy)'))!
    expect(copy, 'the previous leg minted it').toBeDefined()

    await openDrawerViaPicker()
    ;(rowFor(copy.id)!.querySelector('.roster-row-delete') as HTMLElement).click()
    await raf()

    expect(keysUnder(copy.id), 'zero orphaned agent-admin-app.<id>.* keys — enumerated in the page context').toEqual([])
    expect(loadImportedPersonas().some((p) => p.id === copy.id), 'the library record is gone').toBe(false)
    expect(rowFor(copy.id), 'and so is its drawer row').toBeNull()

    const fallback = personaRoster()[0]!
    expect(fallback.id, 'the fallback is a shipped preset — presets are undeletable, so it always exists').toBe(AGENT_PRESETS[0]!.id)
    expect(localStorage.getItem(ACTIVE_PRESET_KEY), 'the persisted active id followed the fallback').toBe(fallback.id)
    expect(admin().store!.get('name'), 'and the surface is showing the fallback persona, not the deleted one').toBe(AGENT_PRESETS[0]!.config.name)

    ;(document.querySelector('.roster-drawer-done') as HTMLElement).click()
    await raf()
    expect(agentSelect().value, 'the picker moved to the fallback too').toBe(fallback.id)
    expect((admin().querySelector('[data-part="delete-agent-row"]') as HTMLElement).hidden, 'and both Delete homes hid themselves — a preset is protected').toBe(true)
    expect((admin().querySelector('[data-value="delete-agent"]') as HTMLElement).hidden).toBe(true)
  })
})

describe("agent-admin-app — the Settings model-grid fold's Reset Agent button genuinely re-seeds the active persona (GH #686, S7-d)", () => {
  it('dirtying the active persona then clicking Reset Agent restores the seed value through a FRESH store instance', async () => {
    await raf()
    const before = admin().store
    expect(before, 'the component has a real store to dirty').toBeDefined()
    const original = before!.get('name')

    // Dirty a real field on the REAL, currently-active persona's store — a genuine edit, not a stub.
    before!.set('name', 'DIRTY-RESET-DELIVERY-PROBE')
    expect(before!.get('name')).toBe('DIRTY-RESET-DELIVERY-PROBE')

    const resetBtn = admin().querySelector('[data-part="reset-agent-button"]') as HTMLElement
    expect(resetBtn.hidden, 'onResetRequest IS registered on this page').toBe(false)
    resetBtn.click()
    await raf()

    const after = admin().store
    expect(after, 'applyPersona reassigns admin.store to a FRESH instance — never a mutation of the dirtied one').not.toBe(before)
    expect(after!.get('name'), 'the dirtied value is genuinely gone — a real re-seed, not a no-op').not.toBe('DIRTY-RESET-DELIVERY-PROBE')
    expect(after!.get('name'), 'the seed value is restored').toBe(original)
  })
})
