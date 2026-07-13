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
import '../surface-host/surface-host.css'
import { UIConversationElement } from './conversation.ts'

// jsdom-free here (real engine), but ui-text-field is still form-associated — no stub needed in a REAL
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
    const composer = el.querySelector('[data-part="composer"]') as HTMLElement
    const logRect = log.getBoundingClientRect()
    const composerRect = composer.getBoundingClientRect()
    expect(logRect.width).toBeGreaterThan(0)
    expect(logRect.height).toBeGreaterThan(0)
    expect(composerRect.width).toBeGreaterThan(0)
    expect(composerRect.height).toBeGreaterThan(0)
    expect(logRect.bottom).toBeLessThanOrEqual(composerRect.top + 0.5)
  })
})

// TKT-0034 — the busy/re-entrancy composer affordance is CSS-driven (conversation.css's `[data-busy]` dim +
// button.css/text-field.ts's own `[disabled]` pointer-inert rule); a jsdom text-level probe (conversation.
// test.ts) can assert the DOM attributes toggle, but NOT that a real engine actually CASCADES them into a
// dimmed, pointer-inert paint — the exact "jsdom-green ≠ done" gap the CSS-comment `*/`-in-a-comment trap
// documents fleet-wide (only a browser smoke catches a rule that silently never applied).
describe('ui-conversation cross-engine smoke — busy/re-entrancy composer affordance (TKT-0034)', () => {
  it('a turn in flight genuinely dims the composer + makes field/Send pointer-inert in a REAL engine; both resolve back to idle once finalize() runs', () => {
    const el = mountConversation()
    const composer = el.querySelector('[data-part="composer"]') as HTMLElement
    const field = el.querySelector('[data-part="field"]') as HTMLElement
    const sendBtn = el.querySelector('[data-part="send"]') as HTMLElement

    // idle baseline — fully opaque, real pointer interaction
    expect(getComputedStyle(composer).opacity).toBe('1')
    expect(getComputedStyle(field).pointerEvents).not.toBe('none')
    expect(getComputedStyle(sendBtn).pointerEvents).not.toBe('none')

    const handle = el.beginAgentTurn()

    // busy — the composer's OWN [data-busy] dim rule cascaded, AND each control's own [disabled] rule made
    // it pointer-inert (button.css/text-field.css) — a REAL engine resolution, not just an attribute present.
    expect(Number(getComputedStyle(composer).opacity), 'the composer did not visibly dim while a turn is in flight').toBeLessThan(1)
    expect(getComputedStyle(field).pointerEvents, 'the field did not become pointer-inert while busy').toBe('none')
    expect(getComputedStyle(sendBtn).pointerEvents, 'Send did not become pointer-inert while busy').toBe('none')

    handle.finalize()

    // idle again — every rule releases the moment finalize() runs (synchronous, no settle wait needed)
    expect(getComputedStyle(composer).opacity).toBe('1')
    expect(getComputedStyle(field).pointerEvents).not.toBe('none')
    expect(getComputedStyle(sendBtn).pointerEvents).not.toBe('none')
  })

  it('a focused field NEVER loses focus while disabled mid-turn, in any engine (component-reviewer finding, investigated)', () => {
    // A focus-loss/restore concern was raised at review and INVESTIGATED empirically here (not assumed):
    // disabling `ui-text-field` rides `contenteditable=false` + a removed `tabindex`, never a native
    // `disabled` attribute — only the latter carries a browser-mandated blur, so focus genuinely never
    // leaves an already-focused field, in Chromium OR WebKit (nor in jsdom — see conversation.test.ts's own
    // note). No restoration mechanism exists in the primitive; this pins that none is needed.
    const el = mountConversation()
    const field = el.querySelector('[data-part="field"]') as HTMLElement & { focus(): void }

    field.focus()
    expect(field.contains(document.activeElement), 'the field did not take focus in a real engine').toBe(true)

    const handle = el.beginAgentTurn()
    expect(
      field.contains(document.activeElement),
      'disabling the field unexpectedly dropped focus — if this ever starts failing, the primitive needs a real restore mechanism',
    ).toBe(true)

    handle.finalize()
    expect(field.contains(document.activeElement)).toBe(true)
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
