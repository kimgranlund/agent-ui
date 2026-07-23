import { describe, it, expect, afterEach } from 'vitest'
import { server, cdp } from 'vitest/browser'

// LLD-C7's cross-engine leg — jsdom cannot resolve painted flex layout / real scrollHeight/scrollTop
// behaviour / forced-colors. Runs in BOTH Chromium and WebKit (vitest.browser.config.ts). Covers:
// whole-shape (thread + composer, non-zero boxes), the scroll-follow guard (near-bottom follows, scrolled-
// away preserves position — the biting negative control being a naive reactive-listener regression, the
// a2ui-chat.ts banner's own documented failure mode), and forced-colors legibility of the chrome.
import '@agent-ui/components/foundation-styles.css'
import '@agent-ui/components/component-styles.css'
import './conversation.css'
import './conversation-composer.css' // TKT-0056 — the composed ui-conversation-composer's own layout/parts CSS
import '../surface-host/surface-host.css'
import { UIConversationElement } from './conversation.ts'
import { whenFlushed } from '@agent-ui/components'

// jsdom-free here (real engine) — the composer's form-associated ui-button parts need no stub in a REAL
// browser (only jsdom lacks ElementInternals.setFormValue/setValidity, the settings.test.ts precedent).

const mounted: HTMLElement[] = []
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
})

function mountConversation(width = '420px', height = '360px'): UIConversationElement {
  const el = document.createElement('ui-conversation') as UIConversationElement
  // NOTE: never set `el.style.display` here — the component's own CSS declares `:scope { display: flex }`
  // (conversation.css); an inline `display` override (an easy copy-paste from a block-host precedent like
  // app-shell.browser.test.ts) defeats it silently and was caught live while authoring this very probe.
  el.style.width = width
  el.style.height = height
  document.body.append(el)
  mounted.push(el)
  return el
}

const logOf = (el: UIConversationElement): HTMLElement => el.querySelector('[data-part="log"]') as HTMLElement

const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

/** Poll until the log's scrollTop stops moving (mirrors tailFollowLog's own settle discipline) — a fixed
 *  frame count would undershoot, per that function's own banner. */
async function waitSettled(log: HTMLElement, maxMs = 1500): Promise<void> {
  let prev = -1
  let stable = 0
  const start = Date.now()
  while (Date.now() - start < maxMs) {
    const top = log.scrollTop
    stable = top === prev ? stable + 1 : 0
    prev = top
    if (stable >= 3) return
    await wait(40)
  }
}

/** Alpha of a computed colour — 0 ⇒ vanished, > 0 ⇒ painted (the card.browser.test.ts/app-shell.browser.test.ts helper). */
const alphaOf = (color: string): number => {
  if (color === 'transparent') return 0
  const m = color.match(/rgba?\(([^)]+)\)/i)
  if (!m) return 1
  const parts = m[1].split(/[\s,/]+/).filter(Boolean)
  return parts.length >= 4 ? Number(parts[3]) : 1
}

interface CdpSession {
  send(method: string, params?: Record<string, unknown>): Promise<unknown>
}

describe('ui-conversation cross-engine smoke — whole-shape (SPEC-R4)', () => {
  it('the log + composer are real, non-zero-area boxes; the composer sits below the log', () => {
    const el = mountConversation()
    const log = logOf(el)
    const composer = el.querySelector('ui-conversation-composer') as HTMLElement
    const logRect = log.getBoundingClientRect()
    const composerRect = composer.getBoundingClientRect()
    expect(logRect.width).toBeGreaterThan(0)
    expect(logRect.height).toBeGreaterThan(0)
    expect(composerRect.width).toBeGreaterThan(0)
    expect(composerRect.height).toBeGreaterThan(0)
    expect(logRect.bottom).toBeLessThanOrEqual(composerRect.top + 0.5)
  })
})

// TKT-0034 — the busy/re-entrancy composer affordance is CSS-driven (conversation-composer.css's `[busy]`
// dim + its editor pointer-events rule + button.css's own `[disabled]` pointer-inert rule); a jsdom
// text-level probe (conversation.test.ts) can assert the DOM attributes toggle, but NOT that a real engine
// actually CASCADES them into a dimmed, pointer-inert paint — the exact "jsdom-green ≠ done" gap the
// CSS-comment `*/`-in-a-comment trap documents fleet-wide (only a browser smoke catches a rule that
// silently never applied — the TKT-0056 never-imported-stylesheet BLOCKER was caught by exactly this test).
describe('ui-conversation cross-engine smoke — busy/re-entrancy composer affordance (TKT-0034)', () => {
  it('a turn in flight genuinely dims the composer + makes editor/Send pointer-inert in a REAL engine; both resolve back to idle once finalize() runs', async () => {
    const el = mountConversation()
    const composer = el.querySelector('ui-conversation-composer') as HTMLElement
    const field = el.querySelector('[data-part="editor"]') as HTMLElement
    const sendBtn = el.querySelector('[data-part="send"]') as HTMLElement

    // idle baseline — fully opaque, real pointer interaction
    expect(getComputedStyle(composer).opacity).toBe('1')
    expect(getComputedStyle(field).pointerEvents).not.toBe('none')
    expect(getComputedStyle(sendBtn).pointerEvents).not.toBe('none')

    const handle = el.beginAgentTurn()
    // TKT-0056 — `busy` now rides ui-conversation-composer's own reactive prop (its scope-owned effect),
    // not conversation.ts's old direct/imperative DOM writes — the same microtask-batching every other
    // reactive prop in the fleet already has (the checkbox checked-effect precedent). A real engine still
    // paints the dim before the next frame; only a bare-synchronous assertion (this test, pre-extraction)
    // needs the flush made explicit.
    await whenFlushed()

    // busy — the composer's OWN `[busy]` dim rule cascaded, its editor pointer-events rule cascaded, AND
    // the send button's own [disabled] rule made it pointer-inert (button.css) — a REAL engine resolution,
    // not just an attribute present.
    expect(Number(getComputedStyle(composer).opacity), 'the composer did not visibly dim while a turn is in flight').toBeLessThan(1)
    expect(getComputedStyle(field).pointerEvents, 'the editor did not become pointer-inert while busy').toBe('none')
    expect(getComputedStyle(sendBtn).pointerEvents, 'Send did not become pointer-inert while busy').toBe('none')

    handle.finalize()
    await whenFlushed()

    // idle again — every rule releases once the busy effect's next flush runs
    expect(getComputedStyle(composer).opacity).toBe('1')
    expect(getComputedStyle(field).pointerEvents).not.toBe('none')
    expect(getComputedStyle(sendBtn).pointerEvents).not.toBe('none')
  })

  it('a focused editor′s focus survives a busy/idle cycle in WebKit; Chromium blurs it (TKT-0057′s question, re-asked against the TKT-0058 own editor)', async () => {
    // TKT-0057 found (against the OLD nested ui-text-field) that Chromium blurs an already-focused
    // contenteditable when the disable effect lands, WebKit does not — and that the original synchronous
    // assertion had been vacuously passing around it. The v2 own editor (TKT-0058) disables differently
    // (contenteditable=false only; it never carried a tabindex), so the engine split is RE-VERIFIED here
    // against the new mechanism, not assumed: Chromium still drops focus when a focused element stops
    // being editable/focusable; WebKit still keeps it.
    const el = mountConversation()
    const editor = el.querySelector('[data-part="editor"]') as HTMLElement

    editor.focus()
    expect(editor.contains(document.activeElement) || document.activeElement === editor, 'the editor did not take focus in a real engine').toBe(true)

    const handle = el.beginAgentTurn()
    await whenFlushed() // the busy effect must actually flush before this proves anything (TKT-0057)

    if (server.browser === 'chromium') {
      expect(document.activeElement === editor, 'TKT-0057 behavior shifted — Chromium no longer blurs on disable (update this test + the ticket)').toBe(false)
    } else {
      expect(document.activeElement === editor, 'the busy transition unexpectedly dropped focus in a non-Chromium engine').toBe(true)
    }

    handle.finalize()
    await whenFlushed()
    expect(document.activeElement === editor, 'the post-idle focus state shifted — update this test + TKT-0057').toBe(
      server.browser === 'chromium' ? false : true,
    )
  })
})

// TKT-0058 — the v2 field-frame legs only a real engine can prove: the :has()-driven focus ring on the
// HOST (jsdom applies no CSS), the click-to-focus hit area (jsdom cannot focus a contenteditable), and
// the editor's 6em growth cap (jsdom has no layout).
describe('ui-conversation-composer cross-engine smoke — the v2 field frame (TKT-0058)', () => {
  it('focusing the editor rings the HOST frame; focusing the send button does NOT (LLD CVC-C8 — :has, not :focus-within)', async () => {
    const el = mountConversation()
    const composer = el.querySelector('ui-conversation-composer') as HTMLElement
    const editor = el.querySelector('[data-part="editor"]') as HTMLElement
    const sendBtn = el.querySelector('[data-part="send"]') as HTMLElement

    expect(getComputedStyle(composer).outlineStyle, 'idle — no ring').toBe('none')

    editor.focus()
    expect(getComputedStyle(composer).outlineStyle, 'the editor focus must ring the host frame').toBe('solid')
    expect(parseFloat(getComputedStyle(composer).outlineWidth)).toBeGreaterThan(0)

    sendBtn.focus()
    expect(getComputedStyle(composer).outlineStyle, 'focus on the send button must NOT ring the field frame (it has its own)').toBe('none')
  })

  it('clicking the composer′s own area focuses the editor; clicking the send button does not steal it there', () => {
    const el = mountConversation()
    const composer = el.querySelector('ui-conversation-composer') as HTMLElement
    const editor = el.querySelector('[data-part="editor"]') as HTMLElement
    const options = el.querySelector('[data-part="options"]') as HTMLElement

    composer.click() // the host's own padding/area
    expect(document.activeElement === editor, 'a click on the component area must focus the editor').toBe(true)

    ;(document.activeElement as HTMLElement)?.blur()
    options.click() // the options-row background — still the component area
    expect(document.activeElement === editor, 'a click on the options-row background must focus the editor').toBe(true)
  })

  it('the editor auto-grows with content and caps at 6em, then scrolls (the TKT-0058 growth cap)', async () => {
    const el = mountConversation()
    const composer = el.querySelector('ui-conversation-composer') as HTMLElement & { value: string }
    const editor = el.querySelector('[data-part="editor"]') as HTMLElement

    // The 2026-07-19 two-line floor: empty and two-line content BOTH sit at the resting minimum, so
    // growth is proven from the THIRD line (the floor's own value is pinned by its dedicated leg below).
    const atRest = editor.getBoundingClientRect().height
    composer.value = 'line 1\nline 2\nline 3'
    await whenFlushed()
    const threeLines = editor.getBoundingClientRect().height
    expect(threeLines, 'the editor must grow past the two-line floor with a third line').toBeGreaterThan(atRest)

    composer.value = Array.from({ length: 20 }, (_, i) => `line ${i + 1}`).join('\n')
    await whenFlushed()
    const capped = editor.getBoundingClientRect().height
    const capPx = 6 * parseFloat(getComputedStyle(editor).fontSize) // 6em in the editor's own em
    expect(capped, 'the editor must cap at 6em').toBeLessThanOrEqual(capPx + 1)
    expect(editor.scrollHeight, 'past the cap, content scrolls instead of growing').toBeGreaterThan(editor.clientHeight)
  })

  it('the TKT-0062 filled/container state law: empty vs typed repaint background AND ink together', async () => {
    // code-reviewer HIGH finding: reading `composer.color` (the host) alone is vacuous — the editor
    // part carries its own color declaration reading the same token, so a state rule that only
    // repaints the host's `color` property never reaches the visible typed text. Read the EDITOR's
    // own computed color — the element the user actually sees text in.
    const el = mountConversation()
    const composer = el.querySelector('ui-conversation-composer') as HTMLElement & { value: string }
    const editor = el.querySelector('[data-part="editor"]') as HTMLElement
    const emptyBg = getComputedStyle(composer).backgroundColor
    const emptyInk = getComputedStyle(editor).color

    composer.value = 'filled now'
    await whenFlushed()
    ;(document.activeElement as HTMLElement)?.blur() // drop focus so the FILLED (idle) row paints, not the focus row
    await new Promise((r) => setTimeout(r, 250)) // past --md-sys-motion-duration-fast — let the repaint settle

    const filledBg = getComputedStyle(composer).backgroundColor
    const filledInk = getComputedStyle(editor).color
    expect(filledBg, 'the background did not repaint between empty and filled').not.toBe(emptyBg)
    expect(filledInk, 'the VISIBLE editor ink did not repaint between empty and filled').not.toBe(emptyInk)
  })

  it('focus wins over filled: a focused-AND-filled composer shows the FOCUS row, not the filled row', async () => {
    const el = mountConversation()
    const composer = el.querySelector('ui-conversation-composer') as HTMLElement & { value: string }
    const editor = el.querySelector('[data-part="editor"]') as HTMLElement
    composer.value = 'filled and focused'
    await whenFlushed()
    ;(document.activeElement as HTMLElement)?.blur()
    await new Promise((r) => setTimeout(r, 250))
    const filledInk = getComputedStyle(editor).color

    editor.focus()
    await expect.poll(() => getComputedStyle(composer).outlineStyle).toBe('solid')
    // MOTION-AWARE, anti-vacuous: `color` is a transitioned state-paint property — poll until it settles
    // off the filled value rather than reading it synchronously right after the state change (the exact
    // timing bug a synchronous read hit while authoring text-field.css's equivalent of this test).
    // code-reviewer HIGH finding: read the EDITOR's own computed color, not the host's.
    await expect
      .poll(() => getComputedStyle(editor).color, { timeout: 1500 })
      .not.toBe(filledInk)
  })
})

const line = (obj: unknown): string => JSON.stringify(obj)

// The composed-path proof (SPEC-R7, the component-reviewer's Blocker 2 finding): the persistent-identity
// routing is jsdom-proven at the textContent level only, which CANNOT catch a real layout collapse — the
// nested `log > bubble > mounts > ui-surface-host > stage > surface` chain is the EXACT shape
// canvas-surface.ts's own comments record a historical "collapse-to-1ch" trap in (an absolutely-positioned
// flex column with only a max-width, whose align-items:center children resolve to min-content). Standalone
// whole-shape (surface-host.browser.test.ts) and standalone whole-shape (this file's own describe above)
// each prove ONE half of this composition; neither proves the NESTED path — a real interactive control
// rendered all the way through every intermediate box — actually paints with real, non-zero geometry.
describe('ui-conversation cross-engine smoke — the COMPOSED path renders with real geometry (SPEC-R7)', () => {
  it('a real A2UI stream through beginAgentTurn()/ingestLine() mounts a real ui-button nested log>bubble>mounts>ui-surface-host>stage>surface, every box non-zero', () => {
    const el = mountConversation()
    const received: unknown[] = []
    el.onClientMessage((m) => received.push(m)) // registered BEFORE the turn — proves the bubble-up wiring too
    const handle = el.beginAgentTurn()
    handle.ingestLine(line({ version: 'v1.0', createSurface: { surfaceId: 'composed-1', catalogId: 'agent-ui' } }))
    handle.ingestLine(
      line({
        version: 'v1.0',
        updateComponents: {
          surfaceId: 'composed-1',
          components: [{ id: 'root', component: 'Button', variant: 'solid', label: 'Go', action: { action: 'go' } }],
        },
      }),
    )
    handle.finalize()

    const bubble = el.querySelector('[data-part="bubble"][data-role="agent"]') as HTMLElement
    const mounts = bubble.querySelector('[data-part="mounts"]') as HTMLElement
    const host = mounts.querySelector('ui-surface-host') as HTMLElement
    const stage = host.querySelector('[data-part="stage"]') as HTMLElement
    const surface = host.querySelector('[data-part="surface"]') as HTMLElement
    const btn = surface.querySelector('ui-button') as HTMLElement

    // anti-vacuous: the WHOLE nested chain genuinely exists (a missing link would make the rect checks
    // below vacuously pass on `null.getBoundingClientRect` throwing, not a silent false-positive — assert
    // presence explicitly first so a broken chain fails LOUDLY, not by accident).
    for (const [name, node] of [
      ['bubble', bubble], ['mounts', mounts], ['host', host], ['stage', stage], ['surface', surface], ['button', btn],
    ] as const) {
      expect(node, `${name} is missing from the composed chain`).not.toBeNull()
    }

    // the actual value this feature exists to prove: EVERY box in the nested chain paints with real,
    // non-zero geometry — not the historical collapse-to-1ch trap (canvas-surface.ts's own comment).
    for (const [name, node] of [
      ['bubble', bubble], ['mounts', mounts], ['host', host], ['stage', stage], ['surface', surface], ['button', btn],
    ] as const) {
      const rect = node.getBoundingClientRect()
      expect(rect.width, `${name} collapsed to zero width`).toBeGreaterThan(1)
      expect(rect.height, `${name} collapsed to zero height`).toBeGreaterThan(1)
    }

    // the button is genuinely INTERACTIVE at this real size (not an inert 1px sliver) — a real click
    // round-trips a real client message all the way out through ui-conversation's own bubble-up wiring.
    btn.click()
    expect(received).toHaveLength(1)
  })
})

// GH #241 (Kim's ruling) — the chat path's chrome laws, proven on a realistic chat mount in a REAL
// engine: (1) the A2UI render surface is CHROMELESS — no checker/background, zero padding — and spans
// the full message-column width (rect-compared); (2) the agent turn DE-BUBBLES — no background, no
// padding, full column width, the sender label above the content and outside the text container —
// while (3) the user turn keeps its compact bubble. The STREAMING state is proven on the same
// container mid-turn (before finalize()) — the text/surfaces stream bare, never inside a bubble that
// later disappears.
describe('ui-conversation cross-engine — chat-path chrome laws (GH #241)', () => {
  /** The log's content-box width — the message column's available width (clientWidth excludes any
   *  scrollbar; subtracting the log's own padding leaves the box the bubbles lay out in). */
  const availableColumnWidth = (log: HTMLElement): number => {
    const cs = getComputedStyle(log)
    return log.clientWidth - Number.parseFloat(cs.paddingLeft) - Number.parseFloat(cs.paddingRight)
  }

  const driveSurfaceTurn = (el: UIConversationElement, finalize: boolean) => {
    const handle = el.beginAgentTurn()
    handle.ingestLine(line({ version: 'v1.0', createSurface: { surfaceId: 'chrome-1', catalogId: 'agent-ui' } }))
    handle.ingestLine(
      line({
        version: 'v1.0',
        updateComponents: {
          surfaceId: 'chrome-1',
          components: [{ id: 'root', component: 'Button', variant: 'solid', label: 'Go', action: { action: 'go' } }],
        },
      }),
    )
    if (finalize) handle.finalize()
    return handle
  }

  it('the mounted A2UI surface is chromeless and spans the full message-column width (rect-compared)', () => {
    const el = mountConversation()
    driveSurfaceTurn(el, true)

    const log = logOf(el)
    const bubble = el.querySelector('[data-part="bubble"][data-role="agent"]') as HTMLElement
    const host = bubble.querySelector('ui-surface-host') as HTMLElement
    const stage = host.querySelector('[data-part="stage"]') as HTMLElement
    const surface = host.querySelector('[data-part="surface"]') as HTMLElement

    // conversation.ts sets the GH #241 pair on every inline mount.
    expect(host.hasAttribute('bare'), 'the chat mount is missing [bare]').toBe(true)
    expect(host.hasAttribute('wrap'), 'the chat mount lost [wrap] (TKT-0084)').toBe(true)

    // NO chrome of its own: no checker image, no background color, zero padding.
    const stageStyle = getComputedStyle(stage)
    expect(stageStyle.backgroundImage, 'the checker leaked into the chat path').toBe('none')
    expect(alphaOf(stageStyle.backgroundColor), 'the stage color leaked into the chat path').toBe(0)
    // longhands, not the `padding` shorthand — cross-engine computed-shorthand serialization differs.
    const surfaceStyle = getComputedStyle(surface)
    for (const side of ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'] as const) {
      expect(surfaceStyle[side], `the surface ${side} leaked into the chat path`).toBe('0px')
    }

    // FULL width: surface ≈ host ≈ the message column's available width (the de-bubbled agent turn
    // has zero padding, so the whole chain shares one content-box width).
    const available = availableColumnWidth(log)
    expect(host.getBoundingClientRect().width, 'the host does not span the column').toBeCloseTo(available, 0)
    expect(surface.getBoundingClientRect().width, 'the surface does not span the column').toBeCloseTo(available, 0)
  })

  it('the agent turn de-bubbles: no background, zero padding, full column width; the sender label sits ABOVE the content, outside the text container', () => {
    const el = mountConversation()
    const handle = el.beginAgentTurn()
    handle.setNote('A bare agent reply')
    handle.finalize()

    const log = logOf(el)
    const bubble = el.querySelector('[data-part="bubble"][data-role="agent"]') as HTMLElement
    const bubbleStyle = getComputedStyle(bubble)
    expect(alphaOf(bubbleStyle.backgroundColor), 'the agent turn still paints a bubble background').toBe(0)
    for (const side of ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'] as const) {
      expect(bubbleStyle[side], `the agent turn still carries bubble ${side}`).toBe('0px')
    }
    expect(bubble.getBoundingClientRect().width, 'the agent turn does not span the column').toBeCloseTo(availableColumnWidth(log), 0)

    // The sender label: present, above the message text, and OUTSIDE the text container.
    const who = bubble.querySelector('[data-part="who"]') as HTMLElement
    const body = bubble.querySelector('[data-part="body"]') as HTMLElement
    expect(who).not.toBeNull()
    expect(who.textContent).toBe('Agent')
    expect(body.contains(who), 'the label rendered INSIDE the text container').toBe(false)
    expect(who.getBoundingClientRect().bottom, 'the label is not above the message text').toBeLessThanOrEqual(
      body.getBoundingClientRect().top + 0.5,
    )
  })

  it('the STREAMING state is already bare — mid-turn (before finalize) the same container carries no chrome and full width', () => {
    const el = mountConversation()
    const handle = driveSurfaceTurn(el, false) // in flight — streaming, not settled

    const log = logOf(el)
    const bubble = el.querySelector('[data-part="bubble"][data-role="agent"]') as HTMLElement
    const stage = bubble.querySelector('ui-surface-host [data-part="stage"]') as HTMLElement
    expect(alphaOf(getComputedStyle(bubble).backgroundColor), 'the streaming turn renders inside a bubble').toBe(0)
    expect(getComputedStyle(bubble).paddingTop).toBe('0px')
    expect(bubble.getBoundingClientRect().width).toBeCloseTo(availableColumnWidth(log), 0)
    expect(getComputedStyle(stage).backgroundImage, 'the streaming surface paints the checker').toBe('none')

    handle.finalize() // settle cleanly — no dangling turn leaks into the shared afterEach teardown
  })

  it('the user turn KEEPS its compact bubble — painted background, real padding, hugging its text (never full-column)', () => {
    const el = mountConversation()
    el.addUserMessage('hi')

    const log = logOf(el)
    const bubble = el.querySelector('[data-part="bubble"][data-role="user"]') as HTMLElement
    const bubbleStyle = getComputedStyle(bubble)
    expect(alphaOf(bubbleStyle.backgroundColor), 'the user bubble lost its background').toBeGreaterThan(0)
    expect(Number.parseFloat(bubbleStyle.paddingLeft), 'the user bubble lost its padding').toBeGreaterThan(0)
    expect(bubble.getBoundingClientRect().width, 'the user bubble stretched to the full column').toBeLessThan(
      availableColumnWidth(log) - 24,
    )
  })
})

describe('ui-conversation cross-engine smoke — scroll-follow guard (SPEC-R4 AC2)', () => {
  it('near the bottom, a new turn follows to the new bottom', async () => {
    const el = mountConversation()
    const log = logOf(el)
    for (let i = 0; i < 30; i++) el.addUserMessage(`message ${i}`)
    // Each addUserMessage spawns its OWN up-to-~1s tail-follow settle loop (TAIL_FOLLOW_MAX_CHECKS ×
    // TAIL_FOLLOW_CHECK_MS); firing 30 back-to-back overlaps 30 of them. A flat wait past the worst-case
    // window (never just "3 stable reads", which a STILL-ticking sibling loop can satisfy coincidentally
    // while continuing to re-assert scrollTop afterward) is what actually drains every one of them.
    await wait(1100)
    await waitSettled(log)
    expect(log.scrollHeight - log.scrollTop - log.clientHeight).toBeLessThanOrEqual(24) // already near bottom

    el.addUserMessage('final message — should be followed to')
    await waitSettled(log)
    const distanceFromBottom = log.scrollHeight - log.scrollTop - log.clientHeight
    expect(distanceFromBottom, 'did not follow to the new bottom while already near it').toBeLessThanOrEqual(24)
  })

  it('scrolled away (reading history), a new turn preserves the scroll position — the biting negative control', async () => {
    const el = mountConversation('420px', '200px') // a short log, so 40 messages definitely overflow it
    const log = logOf(el)
    for (let i = 0; i < 40; i++) el.addUserMessage(`message number ${i} — some real content to force real overflow`)
    // Drain every one of the 40 overlapping tail-follow settle loops the setup batch spawned (see the
    // sibling test's banner above) BEFORE touching scrollTop ourselves — otherwise a still-ticking leftover
    // loop clobbers our manual scroll-to-top a tick later, a flake this exact probe caught live.
    await wait(1100)
    await waitSettled(log)
    // anti-vacuous: the log genuinely overflows (there is real scroll room to be "away" from the bottom in).
    expect(log.scrollHeight).toBeGreaterThan(log.clientHeight + 100)

    log.scrollTop = 0 // scroll all the way up — reading history
    await wait(50)
    const scrolledAwayTop = log.scrollTop
    expect(scrolledAwayTop).toBeLessThan(log.scrollHeight - log.clientHeight - 24) // genuinely away from the bottom

    el.addUserMessage('a new message arrives while the user reads history')
    await wait(300) // give a naive implementation time to (wrongly) jump
    expect(log.scrollTop, 'the scroll position moved — a naive reactive-listener regression').toBe(scrolledAwayTop)
  })
})

describe('ui-conversation cross-engine smoke — forced-colors legibility (SPEC-R11 AC2)', () => {
  it('the bordered shell + composer divider stay legible — Chromium emulates (CDP); WebKit asserts the baseline', async () => {
    const el = mountConversation()

    expect(alphaOf(getComputedStyle(el).borderColor), 'baseline border is invisible').toBeGreaterThan(0)

    if (server.browser !== 'chromium') {
      expect(window.matchMedia('(forced-colors: active)').matches).toBe(false)
      return
    }

    const session = cdp() as unknown as CdpSession
    await session.send('Emulation.setEmulatedMedia', { features: [{ name: 'forced-colors', value: 'active' }] })
    try {
      expect(window.matchMedia('(forced-colors: active)').matches, 'CDP did not enter forced-colors').toBe(true)
      expect(alphaOf(getComputedStyle(el).borderColor), 'border vanished under forced-colors').toBeGreaterThan(0)
    } finally {
      await session.send('Emulation.setEmulatedMedia', { features: [] })
    }
  })
})

describe('ui-conversation-composer — the editor rests at TWO line-boxes (2026-07-19 ask)', () => {
  it('empty editor min-block-size computes to exactly 2 × the line-box; the 6em growth cap stands', async () => {
    const el = document.createElement('ui-conversation') as HTMLElement
    el.style.width = '600px'
    el.style.height = '400px'
    document.body.append(el)
    await (el as HTMLElement & { updateComplete: Promise<void> }).updateComplete
    const editor = el.querySelector('ui-conversation-composer [data-part="editor"]') as HTMLElement
    expect(editor).not.toBeNull()
    const cs = getComputedStyle(editor)
    const lineBox = Number.parseFloat(cs.fontSize) * (Number.parseFloat(cs.lineHeight) / Number.parseFloat(cs.fontSize))
    const twoLines = Number.parseFloat(cs.lineHeight) * 2
    expect(Number.parseFloat(cs.minBlockSize), 'two line-boxes at rest').toBeCloseTo(twoLines, 0)
    expect(editor.getBoundingClientRect().height, 'the empty editor actually RENDERS two lines tall').toBeGreaterThanOrEqual(twoLines - 1)
    expect(Number.parseFloat(cs.maxBlockSize), 'the TKT-0058 cap is untouched').toBeGreaterThan(twoLines)
    void lineBox
    el.remove()
  })
})
