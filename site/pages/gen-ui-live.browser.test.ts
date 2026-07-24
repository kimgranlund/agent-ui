// gen-ui-live.browser.test.ts — the REAL-ENGINE proofs jsdom cannot make (gen-ui-live.test.ts covers the
// turn-selection/round-trip LOGIC in jsdom; this file covers what needs a real sandboxed iframe): the
// two-pane chrome renders sanely, a mounted `ui-sandbox-frame` genuinely CONTAINS its script (SPEC-R3 —
// never re-proving the control's own exhaustive containment battery, sandbox-frame.browser.test.ts already
// does that; ONE cross-engine assertion here is enough, per the brief), the live theme bridge (SPEC-R6)
// re-syncs a mounted surface when the SITE'S OWN real scheme toggle flips (no page-local theme UI exists —
// this page relies entirely on the docs site's existing header control), and the action-bridge round trip
// (SPEC-R8) is observable end to end through a real postMessage exchange.
//
// PROBE TECHNIQUE (reused, not re-invented): sandbox-frame.browser.test.ts's own probes are self-contained
// scripts embedded in the srcdoc document that report their own outcome via `genui.action(...)` — external
// test code cannot reach inside a real opaque-origin iframe at all (`contentDocument` throws), so every
// browser test in this control's own suite drives interaction FROM WITHIN the frame's script, never from
// outside. This file follows the SAME idiom, applied to a REAL surface this page's own real mount/action-
// listener code renders (never a synthetic standalone `ui-sandbox-frame`) — proving THIS page's wiring, not
// re-proving the control's already-exhaustively-tested boundary.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { page } from 'vitest/browser'

let originalPersistedScheme: string | null = null
const raf = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))

beforeAll(async () => {
  // Save/restore the site's persisted scheme choice (theme-provider.browser.test.ts's own precedent) — this
  // file's theme-flip test genuinely flips the site's real header toggle, which persists to localStorage
  // (an origin-scoped store that can carry over from an EARLIER browser test file in the same session, not
  // just this file's own prior runs) — reset to a known Auto ('') state BEFORE the page module reads it at
  // construction, so the cycle's starting point is deterministic regardless of what ran before.
  try {
    originalPersistedScheme = localStorage.getItem('agent-ui.scheme')
    localStorage.removeItem('agent-ui.scheme')
  } catch {
    /* unavailable — nothing to restore either */
  }
  // Above ui-super-shell's 52.5rem/840px compact-window line (ADR-0150/GH #170) — the fleet's default
  // viewport (414x896, ADR-0150's own documented contract) sits BELOW it, which would collapse the nav
  // pane to the narrow overlay story and stack the two panes instead of rendering them side by side (the
  // agent-admin-app-scroll.browser.test.ts precedent for pinning a wide viewport before a layout assertion).
  await page.viewport(1200, 900)
  await import('./gen-ui-live.ts')
  await raf()
})

afterAll(() => {
  try {
    if (originalPersistedScheme === null) localStorage.removeItem('agent-ui.scheme')
    else localStorage.setItem('agent-ui.scheme', originalPersistedScheme)
  } catch {
    /* unavailable */
  }
})

function surfaceCards(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>('.surface-card')]
}

function chatMessages(role: 'user' | 'agent' | 'system'): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>('.chat-log .msg')].filter((m) => m.dataset.role === role)
}

async function sendMessage(text: string): Promise<void> {
  const editor = document.querySelector('.chat-composer [data-part="editor"]') as HTMLElement
  editor.textContent = text
  editor.dispatchEvent(new Event('input', { bubbles: true }))
  const sendBtn = document.querySelector('.chat-composer [data-part="send"]') as HTMLElement
  sendBtn.click()
}

const waitFor = async (predicate: () => boolean, timeoutMs = 4000): Promise<void> => {
  const start = Date.now()
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) throw new Error('waitFor timed out')
    await new Promise((r) => setTimeout(r, 20))
  }
}

interface GenuiActionDetail {
  surfaceId: string
  name: string
  payload?: unknown
}

/** Collect every real `action` CustomEvent detail bubbling off `host` — a SUPPLEMENTARY listener the test
 *  attaches alongside the page's own (multiple listeners on one EventTarget coexist without interference). */
function collectActions(host: HTMLElement): Map<string, GenuiActionDetail> {
  const seen = new Map<string, GenuiActionDetail>()
  host.addEventListener('action', (e) => {
    const detail = (e as CustomEvent<GenuiActionDetail>).detail
    seen.set(detail.name, detail)
  })
  return seen
}

describe('gen-ui-live — the two-pane chrome renders sanely', () => {
  it('the chat pane and the render pane are both real, non-zero, side-by-side boxes', () => {
    const chat = document.querySelector('.chat-pane') as HTMLElement
    const render = document.querySelector('.render-pane') as HTMLElement
    expect(chat).not.toBeNull()
    expect(render).not.toBeNull()
    const chatRect = chat.getBoundingClientRect()
    const renderRect = render.getBoundingClientRect()
    expect(chatRect.width).toBeGreaterThan(0)
    expect(renderRect.width).toBeGreaterThan(0)
    expect(chatRect.right).toBeLessThanOrEqual(renderRect.left)
  })
})

describe('gen-ui-live — a mounted surface genuinely CONTAINS its script (SPEC-R3, real engine, never jsdom)', () => {
  it('sandbox="allow-scripts" exactly on a REAL rendered turn\'s frame', async () => {
    await sendMessage('render the first turn')
    await waitFor(() => surfaceCards().length >= 1)
    const iframe = surfaceCards()[0]!.querySelector('[data-part="frame"]') as HTMLIFrameElement
    expect(iframe).not.toBeNull()
    expect(iframe.getAttribute('sandbox')).toBe('allow-scripts')
  })

  it('a parent-DOM access attempt from inside that SAME real, page-mounted surface is denied; the host page is byte-unchanged', async () => {
    const host = surfaceCards()[0]!.querySelector('ui-sandbox-frame') as HTMLElement & { html: string }
    const actions = collectActions(host)
    const hostUrlBefore = window.location.href
    const hostTitleBefore = document.title

    // The SAME probe shape sandbox-frame.browser.test.ts's own containment suite runs (one leg of its
    // matrix), fed onto the REAL host this page already mounted and wired an `action` listener on.
    host.html = `<!DOCTYPE html><html><body><script>
      (function () {
        try {
          var d = window.parent.document;
          window.genui.action('containment-probe', { blocked: false, detail: 'read succeeded — CONTAINMENT BREACH' });
        } catch (e) {
          window.genui.action('containment-probe', { blocked: true, detail: String(e && e.name) });
        }
      })();
    </` + `script></body></html>`

    await waitFor(() => actions.has('containment-probe'))
    expect(actions.get('containment-probe')?.payload).toMatchObject({ blocked: true })

    // This page's own real action handling ALSO fired for this probe (it doesn't special-case action
    // names) — the received action must show up in the chat log, same as any other action (SPEC-R8's
    // "displayed back in the chat" contract).
    expect(chatMessages('system').some((m) => m.textContent?.includes('containment-probe'))).toBe(true)

    expect(window.location.href).toBe(hostUrlBefore)
    expect(document.title).toBe(hostTitleBefore)
  })
})

describe('gen-ui-live — the live theme bridge (SPEC-R6): the SITE\'S OWN real scheme toggle re-syncs a mounted surface', () => {
  it('flipping the header scheme control changes the token value a handshaken, page-mounted surface observes', async () => {
    const host = surfaceCards()[0]!.querySelector('ui-sandbox-frame') as HTMLElement & { html: string }
    const actions = collectActions(host)

    // The SAME handshake-then-report shape sandbox-frame.browser.test.ts's own theme-flip test uses,
    // fed onto the REAL, page-mounted host (no synthetic standalone `ui-sandbox-frame` — this proves the
    // live flip through the exact instance this page's real turn loop rendered). The real site tokens
    // declare `--md-sys-color-primary` as a `light-dark(...)` FUNCTION (tokens.css) — reading a custom
    // property's own computed value (`data.tokens[...]`) returns that unresolved function TEXT verbatim
    // regardless of scheme (a custom property's computed value is its token stream, per spec; `light-
    // dark()` only resolves when a real longhand consumes it). So the probe consumes the token on a real
    // property (`color`) and reports the RESOLVED rgb — the same distinction PRD-G5/SPEC-R6 care about
    // (what the model's own CSS actually paints), not the raw string sandbox-frame.ts happens to copy.
    host.html = `<!DOCTYPE html><html><body><script>
      window.addEventListener('message', function (e) {
        var data = e.data;
        if (data && (data.type === 'initialized' || data.type === 'host-context-changed')) {
          document.body.style.color = 'var(--md-sys-color-primary)';
          window.genui.action('theme-color', { color: getComputedStyle(document.body).color });
        }
      });
    </` + `script></body></html>`

    await waitFor(() => actions.has('theme-color'))

    // The docs site's OWN real header control (_page.ts's buildThemeControl) — no page-local toggle exists
    // for this demo by design (the file banner). Direct child of `.app-context-theme-group`, the scheme-
    // cycle button (the sibling theme-PICKER lives on a `ui-menu`, not a bare `ui-button`, so this selector
    // resolves to exactly one element). The cycle is Auto -> Light -> Dark -> Auto (SCHEME_CYCLE,
    // _page.ts) — clicking through BOTH explicit legs (Light, then Dark) rather than comparing against the
    // starting Auto state: a headless engine's OS/media `prefers-color-scheme` default can coincide with
    // Auto's resolved value, which would make an Auto-vs-one-click comparison a false negative; Light and
    // Dark are two definitionally distinct `light-dark()` arms (tokens.css), so they can never coincide.
    const schemeBtn = document.querySelector('.app-context-theme-group > ui-button') as HTMLElement
    expect(schemeBtn).not.toBeNull()

    actions.delete('theme-color')
    schemeBtn.click() // -> Light
    await waitFor(() => actions.has('theme-color'))
    const colorLight = (actions.get('theme-color')!.payload as { color: string | null }).color

    actions.delete('theme-color')
    schemeBtn.click() // -> Dark
    await waitFor(() => actions.has('theme-color'))
    const colorDark = (actions.get('theme-color')!.payload as { color: string | null }).color

    expect(colorDark).not.toBe(colorLight)
  })
})
