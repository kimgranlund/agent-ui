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
import { AGENT_PRESETS, ACTIVE_PRESET_KEY, IMPORTED_PERSONAS_KEY, loadImportedPersonas } from './agent-admin-presets.ts'
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
    const options = [...select.querySelectorAll('[role="option"]')]
    expect(options, 'one option per preset').toHaveLength(AGENT_PRESETS.length)
    expect(select.value).toBe(resolvedActive().id)
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
    const before = [...agentSelect().querySelectorAll('[role="option"]')].length

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
      if (agentSelect().querySelectorAll('[role="option"]').length > before) break
      await raf()
    }
    const select = agentSelect()
    const options = [...select.querySelectorAll('[role="option"]')]
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
    const before = [...agentSelect().querySelectorAll('[role="option"]')].length
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
    expect(agentSelect().querySelectorAll('[role="option"]'), `${name}: nothing was minted`).toHaveLength(before)
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
    const before = [...agentSelect().querySelectorAll('[role="option"]')].length
    const libraryBefore = loadImportedPersonas().length

    const newAgentBtn = admin().querySelector('[data-part="new-agent-narrow"]') as HTMLElement
    expect(newAgentBtn.hidden, 'the narrow "+" paints at this viewport (onNewAgentRequest IS registered)').toBe(false)
    newAgentBtn.click()
    await raf()

    const select = agentSelect()
    const options = [...select.querySelectorAll('[role="option"]')]
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
