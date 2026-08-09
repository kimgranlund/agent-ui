// agent-admin-app.browser.test.ts — GH #51: the canvas-header `[ title | … | agent-menu ]` on the REAL
// page. Side-effect-imports the page module (the a2ui-live-conversation.browser.test.ts precedent — its
// own file, its own document, so the full-viewport mount collides with nothing), then drives the real
// ui-menu switcher end to end: open → commit a different preset → the title, the persisted active id,
// and the admin store all follow. This is the page-wiring proof GH #42 notes the admin page lacked; the
// store-swap MECHANISM itself stays unit-proven in agent-admin-app.test.ts (jsdom).
import { describe, it, expect, vi, afterAll } from 'vitest'
import './agent-admin-app.ts' // side-effect import — mounts the real header + ui-agent-admin
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

describe('agent-admin-app — the canvas-header (GH #51)', () => {
  it('renders [ title | … | agent-menu ]: the active agent names the surface; the chip strip is gone', async () => {
    await raf()
    const header = document.querySelector('header.canvas-header') as HTMLElement
    expect(header, 'the canvas-header must mount above the admin surface').not.toBeNull()
    expect(document.querySelector('.preset-strip'), 'the TKT-0074 chip strip must be fully replaced').toBeNull()

    const name = header.querySelector('.canvas-header-name') as HTMLElement
    expect(name.textContent).toBe(resolvedActive().label)

    // the three zones: title flexes, the two menus sit after it in order [ … | agent-menu ]
    const menus = header.querySelectorAll('ui-menu')
    expect(menus).toHaveLength(2)
    expect(menus[0]!.className).toContain('overflow-menu')
    expect(menus[1]!.className).toContain('agent-menu')
  })

  it('GH #55: the agent rows are seeded with the correct initial aria-checked BEFORE any commit (the migration off the ✓-text/data-active fallback)', async () => {
    await raf()
    const items = [...document.querySelectorAll<HTMLElement>('.agent-menu [role="menuitemradio"]')]
    expect(items).toHaveLength(AGENT_PRESETS.length)
    const active = resolvedActive()
    for (const item of items) {
      const wantChecked = item.dataset.value === active.id
      expect(item.getAttribute('aria-checked'), `row ${item.dataset.value} aria-checked`).toBe(String(wantChecked))
    }
    // Exactly one row is checked — one-true holds even at page-load seed time, not only post-commit.
    expect(items.filter((i) => i.getAttribute('aria-checked') === 'true')).toHaveLength(1)
  })

  it('the agent menu lists EVERY preset un-truncated and a commit switches agent + persists it', async () => {
    await raf()
    const agentMenu = document.querySelector('.agent-menu') as HTMLElement
    const trigger = agentMenu.querySelector('[data-part="trigger"]') as HTMLElement
    trigger.click()
    await raf()

    // GH #55: rows are role=menuitemradio (the selectable-item variant), not plain menuitem.
    const items = [...document.querySelectorAll<HTMLElement>('.agent-menu [role="menuitemradio"]')]
    expect(items, 'one menu row per preset — the un-truncated replacement for the chips').toHaveLength(AGENT_PRESETS.length)

    const before = resolvedActive()
    const target = AGENT_PRESETS.find((p) => p.id !== before.id)!
    const targetItem = items.find((i) => i.dataset.value === target.id)!
    targetItem.click()
    await raf()

    expect(localStorage.getItem(ACTIVE_PRESET_KEY), 'the committed agent persists').toBe(target.id)
    expect((document.querySelector('.canvas-header-name') as HTMLElement).textContent, 'the title zone follows the commit').toBe(target.label)
    expect((agentMenu.querySelector('[data-part="trigger"]') as HTMLElement).textContent).toContain(target.label)
    // GH #168 — the trailing caret ICON survives the commit's label rewrite (`textContent =` wipes
    // children; applyPreset must re-append the caret, the composer #appendCaret law).
    expect(
      (agentMenu.querySelector('[data-part="trigger"]') as HTMLElement).querySelector('ui-icon[glyph="caret-down"]'),
      'the caret icon is re-appended after the label rewrite',
    ).not.toBeNull()
    // GH #55: the ✓-text/data-active fallback is gone — the rows are role=menuitemradio and the
    // active marker is REAL aria-checked, managed by ui-menu itself on commit (one-true).
    const activeRow = items.find((i) => i.dataset.value === target.id)!
    const previousRow = items.find((i) => i.dataset.value === before.id)!
    expect(activeRow.getAttribute('role')).toBe('menuitemradio')
    expect(activeRow.getAttribute('aria-checked'), 'the committed row is checked').toBe('true')
    expect(activeRow.textContent, 'no more hand-rolled ✓ prefix — the label stays plain text').toBe(target.label)
    expect(previousRow.getAttribute('aria-checked'), 'the previous choice is unchecked').toBe('false')
    expect(previousRow.textContent).toBe(before.label)
  })

  it('a long tagline truncates INSIDE the header — the menu triggers stay in reach (the flexbox min-width:auto trap, PR #54 review finding)', async () => {
    await raf()
    const header = document.querySelector('header.canvas-header') as HTMLElement
    const agentTrigger = document.querySelector('.agent-menu [data-part="trigger"]') as HTMLElement
    const tagline = document.querySelector('.canvas-header-tagline') as HTMLElement
    // The header is full-viewport-width; at the fleet's 414px default every preset tagline (70-90ch)
    // exceeds the free space, so truncation MUST be doing the yielding for the triggers to fit.
    const headerBox = header.getBoundingClientRect()
    const triggerBox = agentTrigger.getBoundingClientRect()
    expect(triggerBox.right, 'the agent-menu trigger must not be pushed past the header edge').toBeLessThanOrEqual(headerBox.right + 1)
    expect(triggerBox.width, 'the trigger must remain a real, clickable target').toBeGreaterThan(20)
    expect(tagline.scrollWidth, 'the tagline is genuinely truncated (content wider than its box)').toBeGreaterThan(tagline.clientWidth)
  })

  it('GH #168: both triggers render a real ui-icon — the glued "▾"/"…" text glyphs are gone (the TKT-0048 anti-pattern)', async () => {
    await raf()
    // The agent switcher keeps its visible text label; the dropdown affordance is a trailing caret ICON.
    const agentTrigger = document.querySelector('.agent-menu [data-part="trigger"]') as HTMLElement
    expect(agentTrigger.textContent, 'no glued caret character in the label').not.toContain('▾')
    expect(agentTrigger.textContent, 'the persona name stays a visible text label').toContain(resolvedActive().label)
    const caret = agentTrigger.querySelector('ui-icon[glyph="caret-down"]') as HTMLElement
    expect(caret, 'the caret is a real ui-icon').not.toBeNull()
    expect(caret.getAttribute('slot'), 'the trailing adornment cell (the composer #appendCaret shape)').toBe('trailing')
    expect(caret.getAttribute('data-role'), 'role sizes: caret gets the font-sized centered inset').toBe('caret')
    expect(caret.querySelector('svg'), 'the glyph resolves against the registered Phosphor pack').not.toBeNull()

    // The overflow trigger is icon-only: the vendored dots-three glyph + the accessible name kept.
    const overflowTrigger = document.querySelector('.overflow-menu [data-part="trigger"]') as HTMLElement
    expect(overflowTrigger.textContent ?? '', 'no glued ellipsis character').not.toContain('…')
    expect(overflowTrigger.hasAttribute('icon-only'), 'no label → the explicit square anatomy (button.md)').toBe(true)
    expect(overflowTrigger.getAttribute('aria-label'), 'an icon-only button keeps its accessible name').toBe('Page actions')
    const dots = overflowTrigger.querySelector('ui-icon[glyph="dots-three"]') as HTMLElement
    expect(dots, 'the overflow glyph is a real ui-icon').not.toBeNull()
    expect(dots.getAttribute('slot')).toBe('leading')
    expect(dots.getAttribute('data-role')).toBe('icon')
    expect(dots.querySelector('svg'), 'the GH #168-vendored dots-three glyph resolves against the registered pack').not.toBeNull()
  })

  it('the "…" overflow carries Reset persona (the page action relocated off the strip)', async () => {
    await raf()
    const overflow = document.querySelector('.overflow-menu') as HTMLElement
    const trigger = overflow.querySelector('[data-part="trigger"]') as HTMLElement
    trigger.click()
    await raf()
    const reset = overflow.querySelector('[data-value="reset-persona"]') as HTMLElement
    expect(reset, 'Reset persona lives in the overflow menu now').not.toBeNull()
    expect(reset.getAttribute('role')).toBe('menuitem')
    reset.click() // commit — must not throw; the admin store re-seeds (mechanism unit-proven elsewhere)
    await raf()
    expect(document.querySelector('.canvas-header-name')).not.toBeNull()
  })
})

// ── GH #406 — the persona library on the REAL page ─────────────────────────────────────────────────────
// The FORMAT's own round trip (byte-equal composed prompt, deep-equal store snapshot) is proven
// deterministically in agent-admin-persona-file.test.ts; this leg proves the PAGE WIRING those pure
// functions hang off: the overflow rows exist, Export really produces a persona file's bytes (captured
// off the Blob the download hands the browser), and feeding those exact bytes back through the hidden
// file input mints a NEW roster row that becomes the active persona and persists.

describe('agent-admin-app — the persona library (GH #406)', () => {
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

  async function openOverflow(): Promise<HTMLElement> {
    const overflow = document.querySelector('.overflow-menu') as HTMLElement
    ;(overflow.querySelector('[data-part="trigger"]') as HTMLElement).click()
    await raf()
    return overflow
  }

  it('the overflow carries Export persona + Import persona…, and Export hands the browser a real persona file', async () => {
    const overflow = await openOverflow()
    expect(overflow.querySelector('[data-value="export-persona"]'), 'Export persona row').not.toBeNull()
    expect(overflow.querySelector('[data-value="import-persona"]'), 'Import persona… row').not.toBeNull()

    // Capture the downloaded bytes: the page hands the anchor an object URL for the Blob it built.
    const realCreate = URL.createObjectURL.bind(URL)
    const blobs: Blob[] = []
    URL.createObjectURL = (obj: Blob | MediaSource): string => {
      if (obj instanceof Blob) blobs.push(obj)
      return realCreate(obj)
    }
    try {
      ;(overflow.querySelector('[data-value="export-persona"]') as HTMLElement).click()
      await raf()
    } finally {
      URL.createObjectURL = realCreate
    }
    expect(blobs, 'Export produced exactly one download blob').toHaveLength(1)
    expect(blobs[0]!.type).toBe('application/json')
    exported = await blobs[0]!.text()
    const parsed = readPersonaFile(exported)
    expect(parsed.ok, parsed.ok ? '' : parsed.error).toBe(true)
    if (!parsed.ok) return
    expect(parsed.file.persona.label, 'the file names the ACTIVE persona').toBe(resolvedActive().label)
  })

  it('feeding those exact bytes back through the file input mints a NEW persona, makes it active, and persists it', async () => {
    expect(exported, 'the export leg above must have run first').not.toBe('')
    const before = [...document.querySelectorAll<HTMLElement>('.agent-menu [role="menuitemradio"]')].length
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    const transfer = new DataTransfer()
    transfer.items.add(new File([exported], 'persona.json', { type: 'application/json' }))
    input.files = transfer.files
    input.dispatchEvent(new Event('change', { bubbles: true }))

    // The handler reads the File asynchronously — poll rather than assume one frame is enough.
    for (let i = 0; i < 50; i += 1) {
      if (document.querySelectorAll('.agent-menu [role="menuitemradio"]').length > before) break
      await raf()
    }
    const rows = [...document.querySelectorAll<HTMLElement>('.agent-menu [role="menuitemradio"]')]
    expect(rows, 'one NEW roster row — an import never overwrites a preset').toHaveLength(before + 1)

    const minted = rows[rows.length - 1]!
    expect(minted.textContent).toContain('(imported)')
    expect(minted.getAttribute('aria-checked'), 'the imported persona becomes the active one').toBe('true')
    expect((document.querySelector('.canvas-header-name') as HTMLElement).textContent).toBe(minted.textContent)
    expect(localStorage.getItem(ACTIVE_PRESET_KEY)).toBe(minted.dataset.value)

    // Registered in the PERSISTED library — this is what makes it survive a reload.
    const library = loadImportedPersonas()
    expect(library.map((p) => p.id)).toEqual([minted.dataset.value])
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
    const before = [...document.querySelectorAll<HTMLElement>('.agent-menu [role="menuitemradio"]')].length
    const activeBefore = localStorage.getItem(ACTIVE_PRESET_KEY)
    const libraryBefore = JSON.stringify(loadImportedPersonas())
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
    expect(document.querySelectorAll('.agent-menu [role="menuitemradio"]'), `${name}: nothing was minted`).toHaveLength(before)
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

// ── GH #637 S1 — the blank-agent path on the REAL page ─────────────────────────────────────────────────
// The mint+seed mechanism is proven deterministically in agent-admin-persona-file.test.ts (jsdom); this
// leg proves the PAGE WIRING: the overflow row exists, clicking it mints, persists, stages a roster row,
// and ACTIVATES the new agent — the one leg only a real page can prove (the settings pane genuinely opens
// on the fresh identity, same as any other persona switch).
describe('agent-admin-app — the blank-agent path (GH #637 S1)', () => {
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

  it('the overflow carries "New agent → Blank"', async () => {
    const overflow = document.querySelector('.overflow-menu') as HTMLElement
    ;(overflow.querySelector('[data-part="trigger"]') as HTMLElement).click()
    await raf()
    const row = overflow.querySelector('[data-value="new-agent-blank"]')
    expect(row, 'the blank-agent row lives in the overflow menu').not.toBeNull()
    expect(row?.textContent).toBe('New agent → Blank')
  })

  it('clicking it mints a fresh agent, activates it, and persists it in the SAME library an import writes to', async () => {
    const before = [...document.querySelectorAll<HTMLElement>('.agent-menu [role="menuitemradio"]')].length
    const libraryBefore = loadImportedPersonas().length

    const overflow = document.querySelector('.overflow-menu') as HTMLElement
    ;(overflow.querySelector('[data-part="trigger"]') as HTMLElement).click()
    await raf()
    ;(overflow.querySelector('[data-value="new-agent-blank"]') as HTMLElement).click()
    await raf()

    const rows = [...document.querySelectorAll<HTMLElement>('.agent-menu [role="menuitemradio"]')]
    expect(rows, 'one NEW roster row, no preset overwritten').toHaveLength(before + 1)
    const minted = rows[rows.length - 1]!
    expect(minted.textContent, 'the mint law: "New agent", numbered only on a real collision').toMatch(/^New agent( \d+)?$/)

    // Activated: the header + aria-checked + the persisted active-id all follow the mint, the same
    // contract applyPersona() gives an imported persona (agent-admin-app.ts's applyPersona()).
    expect(minted.getAttribute('aria-checked'), 'the blank agent becomes the active one').toBe('true')
    expect((document.querySelector('.canvas-header-name') as HTMLElement).textContent).toBe(minted.textContent)
    expect(localStorage.getItem(ACTIVE_PRESET_KEY)).toBe(minted.dataset.value)

    // Persisted through the GH #406 imported-library record — what survives a reload.
    const library = loadImportedPersonas()
    expect(library.length, 'one new library record').toBe(libraryBefore + 1)
    const record = library.find((p) => p.id === minted.dataset.value)
    expect(record, 'registered under the SAME id the roster row carries').toBeDefined()
    expect(record?.imported).toBe(true)
    // The seed carries the shipped schema default (`agent-admin-schema.ts`'s `name` field default) — a
    // genuinely blank agent, not a persona-flavored one (no `foundation`/`surfaceStyle` skew from any
    // preset, which a preset-derived seed would always carry as a rewritten Foundation section instead).
    expect(record?.seed.name, 'the shipped schema default name, unrewritten by any preset').toBe('Untitled agent')
  })
})
