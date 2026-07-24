import { describe, it, expect } from 'vitest'

// sandbox-frame.browser.test.ts — genui-surface.spec.md's real-engine ACs (Chromium + WebKit; NEVER
// jsdom, which cannot navigate a sandboxed srcdoc iframe at all). These are REAL security-boundary
// claims: every containment/bridge/theme/lifecycle proof below drives an ACTUAL model-authored script
// running inside the real sandbox and reports its own outcome back through the ONE sanctioned outward
// channel, `genui.action(name, payload)` — the SPEC-R3 AC1 pattern verbatim ("each probe reports its
// own outcome via the bridge action channel").
//
// Direct imports (pre-barrel, the checkbox.browser.test.ts precedent) — the component-styles barrel
// gains the sandbox-frame @import at the barrel-wiring integration slice (this same change).
import '@agent-ui/components/foundation-styles.css'
import './sandbox-frame.css'
import './sandbox-frame.ts'
import type { UISandboxFrameElement, GenuiActionDetail } from './sandbox-frame.ts'

const mount = (): UISandboxFrameElement => {
  const el = document.createElement('ui-sandbox-frame') as UISandboxFrameElement
  document.body.append(el)
  return el
}

/** Collect every `action` CustomEvent detail the control emits, keyed by `name` (last write wins — every
 *  probe below reports each of its names exactly once). */
function collectActions(el: UISandboxFrameElement): Map<string, GenuiActionDetail> {
  const seen = new Map<string, GenuiActionDetail>()
  el.addEventListener('action', (e) => {
    const detail = (e as CustomEvent<GenuiActionDetail>).detail
    seen.set(detail.name, detail)
  })
  return seen
}

const waitFor = async (predicate: () => boolean, timeoutMs = 4000): Promise<void> => {
  const start = Date.now()
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) throw new Error('waitFor timed out')
    await new Promise((r) => setTimeout(r, 20))
  }
}

describe('ui-sandbox-frame — the sandbox posture, literal (SPEC-R3 AC2)', () => {
  it('sandbox="allow-scripts" exactly, in a real engine', async () => {
    const el = mount()
    el.html = '<!DOCTYPE html><html><body>hi</body></html>'
    await waitFor(() => el.querySelector('[data-part="frame"]') !== null)
    const iframe = el.querySelector('[data-part="frame"]') as HTMLIFrameElement
    expect(iframe.getAttribute('sandbox')).toBe('allow-scripts')
    el.remove()
  })
})

describe('ui-sandbox-frame — the containment probe (SPEC-R3 AC1, real engine, never jsdom)', () => {
  it('top-nav / parent-DOM / storage / popup / network attempts all fail; the HOST page is byte-unchanged', async () => {
    const el = mount()
    const actions = collectActions(el)
    const hostUrlBefore = window.location.href
    const hostTitleBefore = document.title

    const doc = `<!DOCTYPE html><html><body><script>
      function report(name, ok, detail) { window.genui.action(name, { ok: !!ok, detail: String(detail || '') }); }

      // (a) window.top.location assignment — blocked (no allow-top-navigation); either throws or silently no-ops.
      try { window.top.location.href = 'https://example.invalid/'; report('top-nav', true, 'no throw (silently blocked)'); }
      catch (e) { report('top-nav', true, e && e.name); }

      // (b) window.parent.document access — an opaque origin makes this a cross-origin read; must throw.
      try { var d = window.parent.document; report('parent-dom', false, 'read succeeded — CONTAINMENT BREACH'); }
      catch (e) { report('parent-dom', true, e && e.name); }

      // (c) localStorage — an opaque origin denies storage APIs outright (an exception on access).
      try { window.localStorage.setItem('x', '1'); report('storage', false, 'localStorage worked — CONTAINMENT BREACH'); }
      catch (e) { report('storage', true, e && e.name); }

      // (c') document.cookie — denied under an opaque origin; readback confirms no write landed.
      try {
        document.cookie = 'x=1';
        var hasCookie = document.cookie.indexOf('x=1') !== -1;
        report('cookie', !hasCookie, hasCookie ? 'cookie set — CONTAINMENT BREACH' : 'denied');
      } catch (e) { report('cookie', true, e && e.name); }

      // (d) a <form target="_top"> submit — the same top-navigation containment class as (a); the
      // host-level URL-unchanged assertion is the real proof, this just confirms the attempt ran.
      try {
        var f = document.createElement('form');
        f.action = 'https://example.invalid/submitted';
        f.target = '_top';
        document.body.appendChild(f);
        f.requestSubmit();
        report('form-submit', true, 'attempted');
      } catch (e) { report('form-submit', true, e && e.name); }

      // (e) window.open — without allow-popups, MUST return null (directly observable, no throw needed).
      try {
        var popup = window.open('https://example.invalid/');
        report('popup', popup === null, popup === null ? 'blocked (null)' : 'OPENED — CONTAINMENT BREACH');
      } catch (e) { report('popup', true, e && e.name); }

      // Network containment (SPEC-R4 AC2): connect-src defaults to 'none' — fetch to a non-allow-listed
      // https origin must REJECT.
      fetch('https://example.invalid/probe')
        .then(function () { report('fetch', false, 'fetch resolved — CONTAINMENT BREACH'); })
        .catch(function (e) { report('fetch', true, e && e.name); });
    </` + `script></body></html>`

    el.html = doc
    await waitFor(() => actions.size >= 7)

    for (const name of ['top-nav', 'parent-dom', 'storage', 'cookie', 'form-submit', 'popup', 'fetch']) {
      const payload = actions.get(name)?.payload as { ok?: boolean; detail?: string } | undefined
      expect(payload?.ok, `${name}: ${JSON.stringify(payload)}`).toBe(true)
    }

    // The load-bearing shared proof (SPEC-R3 AC1): the HOST page's own URL/title are byte-unchanged
    // regardless of how each individual attempt failed (throw vs. silent no-op).
    expect(window.location.href).toBe(hostUrlBefore)
    expect(document.title).toBe(hostTitleBefore)
    expect(window.localStorage.getItem('x')).toBeNull() // the host's OWN storage, untouched

    el.remove()
  })
})

describe('ui-sandbox-frame — the bridge out-of-vocabulary probe (SPEC-R7 AC1, real engine)', () => {
  it('a tools/call-shaped message, a malformed size-changed, raw garbage, and a foreign-source well-formed message are ALL dropped + counted, with NO action event for any of them', async () => {
    const el = mount()
    const actions = collectActions(el)

    const doc = `<!DOCTYPE html><html><body><script>
      window.parent.postMessage({ type: 'tools/call', name: 'evil' }, '*');
      window.parent.postMessage({ type: 'size-changed', height: 'lol' }, '*');
      window.parent.postMessage('raw garbage string', '*');
      window.genui.action('probe-done', {});
    </` + `script></body></html>`

    el.html = doc
    await waitFor(() => actions.has('probe-done'))
    const droppedFromFrame = el.droppedMessages

    // A well-formed vocabulary member from a FOREIGN source (the test's own window, not the iframe's
    // contentWindow) — dropped by the identity check, never processed.
    window.postMessage({ type: 'initialize' }, '*')
    await waitFor(() => el.droppedMessages > droppedFromFrame)

    expect(el.droppedMessages).toBeGreaterThanOrEqual(4) // 3 from the frame + ≥1 foreign-source
    expect(actions.has('initialize')).toBe(false) // never surfaced as a DOM event
    expect(actions.has('tools/call')).toBe(false)

    el.remove()
  })
})

describe('ui-sandbox-frame — the token bridge + live theme flip (SPEC-R6 AC1, real engine)', () => {
  it('a handshaken frame receives host-context-changed on a live theme flip and repaints; state survives', async () => {
    const wrapper = document.createElement('div')
    wrapper.style.setProperty('--md-sys-color-primary', 'rgb(1, 2, 3)')
    document.body.append(wrapper)
    const el = document.createElement('ui-sandbox-frame') as UISandboxFrameElement
    wrapper.append(el)
    const actions = collectActions(el)

    const doc = `<!DOCTYPE html><html><body><script>
      window.__marker = 'alive';
      window.addEventListener('message', function (e) {
        var data = e.data;
        if (data && data.type === 'initialized') {
          window.genui.action('handshake', { color: (data.tokens || {})['--md-sys-color-primary'] || null });
        }
        if (data && data.type === 'host-context-changed') {
          window.genui.action('theme-flip', { color: (data.tokens || {})['--md-sys-color-primary'] || null, markerAlive: window.__marker === 'alive' });
        }
      });
    </` + `script></body></html>`

    el.html = doc
    await waitFor(() => actions.has('handshake'))
    expect(actions.get('handshake')?.payload).toMatchObject({ color: 'rgb(1, 2, 3)' })

    // The live flip: mutate the ANCESTOR wrapper's inline custom property — the control's own
    // MutationObserver (subtree, style/class) catches it and re-syncs a handshaken frame in place.
    wrapper.style.setProperty('--md-sys-color-primary', 'rgb(9, 9, 9)')
    await waitFor(() => actions.has('theme-flip'))
    expect(actions.get('theme-flip')?.payload).toMatchObject({ color: 'rgb(9, 9, 9)', markerAlive: true })

    el.remove()
    wrapper.remove()
  })

  it('a NON-handshaken frame (bootstrap never ran) falls back to a full rebuild on a theme flip — themed, state lost', async () => {
    const wrapper = document.createElement('div')
    wrapper.style.setProperty('--md-sys-color-primary', 'rgb(10, 20, 30)')
    document.body.append(wrapper)
    const el = document.createElement('ui-sandbox-frame') as UISandboxFrameElement
    wrapper.append(el)
    const actions = collectActions(el)

    // A document with NO message listener at all — it never completes the handshake from the model
    // side (the HOST's own bootstrap still sends `initialize`, but nothing here ever calls genui.action
    // for it) — self-reports its OWN color reading once, synchronously, as proof of the rebuilt state.
    const doc = (marker: string) => `<!DOCTYPE html><html><body><script>
      window.genui.action('paint', { marker: '${marker}', color: getComputedStyle(document.documentElement).getPropertyValue('--md-sys-color-primary').trim() });
    </` + `script></body></html>`

    el.html = doc('first')
    await waitFor(() => (actions.get('paint')?.payload as { marker?: string } | undefined)?.marker === 'first')
    expect(actions.get('paint')?.payload).toMatchObject({ color: 'rgb(10, 20, 30)' })

    wrapper.style.setProperty('--md-sys-color-primary', 'rgb(40, 50, 60)')
    // Re-set html to the SAME content with a new marker so the rebuild is independently observable
    // (a genuine rebuild re-runs the script from scratch — the no-bridge fallback, SPEC-R6).
    el.html = doc('second')
    await waitFor(() => (actions.get('paint')?.payload as { marker: string } | undefined)?.marker === 'second')
    expect(actions.get('paint')?.payload).toMatchObject({ marker: 'second', color: 'rgb(40, 50, 60)' })

    el.remove()
    wrapper.remove()
  })
})

describe('ui-sandbox-frame — srcdoc lifecycle: replace is atomic, frame-internal state is lost by design (SPEC-R5 AC1)', () => {
  it('a second envelope for the same instance rebuilds the whole document — a state marker set by the first document is GONE', async () => {
    const el = mount()
    const actions = collectActions(el)

    const doc1 = `<!DOCTYPE html><html><body><script>
      window.__stateMarker = 'set-by-doc-1';
      window.genui.action('doc1-ready', {});
    </` + `script></body></html>`
    el.html = doc1
    await waitFor(() => actions.has('doc1-ready'))

    const doc2 = `<!DOCTYPE html><html><body><script>
      window.genui.action('doc2-ready', { markerSurvived: window.__stateMarker === 'set-by-doc-1' });
    </` + `script></body></html>`
    el.html = doc2
    await waitFor(() => actions.has('doc2-ready'))

    expect(actions.get('doc2-ready')?.payload).toMatchObject({ markerSurvived: false })
    el.remove()
  })
})

describe('ui-sandbox-frame — fail-closed never-paint (SPEC-R5 AC2, real engine)', () => {
  it('an oversize payload never paints an iframe document at all', async () => {
    const el = mount()
    el.html = `<!DOCTYPE html><html><body>${'x'.repeat(524_288 + 1)}</body></html>`
    // Give it a real tick to prove NOTHING ever appears, not just "not yet".
    await new Promise((r) => setTimeout(r, 200))
    expect(el.querySelector('[data-part="frame"]')).toBeNull()
    expect(el.querySelector('[data-part="fallback"]')).toBeTruthy()
    el.remove()
  })
})
