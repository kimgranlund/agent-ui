// site/pages/sandbox-frame-demo.ts — the ui-sandbox-frame interaction demo (genui-surface.spec.md SPEC
// §3.2/§3.3, D9 — B1's own containment-first slice). Two panels: (1) a LIVE, contained document with a
// button that calls the frame's bootstrap-exposed `genui.action(name, payload)` — the demo listens for
// the re-emitted fleet `action` event and logs it, proving the ONE sanctioned outward channel end to
// end; (2) the fail-closed / never-paint proof — an oversize payload renders the inert fallback
// affordance instead of an iframe, with no error escaping the page. No agent/producer wiring exists yet
// (B2) — both panels feed `html` directly, the same way a future B2 consumer eventually would.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css' // shared demo chrome (.event-log + section spacing)
import { el, exampleSection, uiButton } from '../lib/specimens.ts'
import type { UISandboxFrameElement, GenuiActionDetail } from '@agent-ui/components/components'

const { content } = mountPage({
  title: 'ui-sandbox-frame — demo',
  intro:
    'A sandboxed iframe rendering agent-authored HTML/CSS/JS, contained by construction. The button below ' +
    'lives INSIDE the sandbox and can reach the host through exactly one channel — genui.action(name, ' +
    'payload) — logged below as the fleet action event. The second panel proves the fail-closed law: an ' +
    'oversize payload never paints an iframe at all. The API table is on the ui-sandbox-frame API page.',
})

// ── 1 · the live, contained document + the action bridge ────────────────────────────────────────────────────
const log = document.createElement('ul')
log.className = 'event-log'
log.setAttribute('aria-live', 'polite')
let seq = 0
function logAction(detail: GenuiActionDetail): void {
  seq += 1
  const line = document.createElement('li')
  line.textContent = `#${String(seq).padStart(2, '0')}  action  →  name=${detail.name}  payload=${JSON.stringify(detail.payload)}`
  log.append(line)
  log.scrollTop = log.scrollHeight
}

const frame = el('ui-sandbox-frame', {}) as UISandboxFrameElement
frame.style.cssText = 'display: block; max-inline-size: 28rem;'
frame.addEventListener('action', (e) => logAction((e as CustomEvent<GenuiActionDetail>).detail))
frame.surfaceId = 'demo-surface'
frame.html = `<!DOCTYPE html><html><body style="font-family: system-ui, sans-serif; margin: 0; padding: 1rem;">
  <p style="margin: 0 0 0.75rem;">This paragraph runs inside the opaque-origin sandbox.</p>
  <button id="go" style="font: inherit; padding: 0.4rem 0.8rem;">Click me — reaches the host via genui.action</button>
  <script>
    document.getElementById('go').addEventListener('click', function () {
      window.genui.action('demo-click', { at: Date.now() });
    });
  </script>
</body></html>`

// ── 2 · the fail-closed / never-paint proof ──────────────────────────────────────────────────────────────────
const fallbackFrame = el('ui-sandbox-frame', {}) as UISandboxFrameElement
fallbackFrame.style.cssText = 'display: block; max-inline-size: 28rem;'
const oversizeButton = uiButton('Feed an oversize payload (> 512 KiB)', 'soft')
oversizeButton.addEventListener('click', () => {
  fallbackFrame.html = `<!DOCTYPE html><html><body>${'x'.repeat(524_288 + 1)}</body></html>`
})
const resetButton = uiButton('Reset', 'ghost')
resetButton.addEventListener('click', () => {
  fallbackFrame.html = ''
})

const note = el('p', {}, [
  document.createTextNode(
    'An oversize html payload (SPEC-R2’s 512 KiB cap) is rejected whole — the control shows its inert ' +
      '"Not rendered" fallback instead of ever building an iframe document (SPEC-R5).',
  ),
])

content.append(
  exampleSection('A rendered document + the action bridge', frame, log),
  exampleSection('Fail-closed / never-paint', note, el('div', { style: 'display:flex; gap:0.5rem;' }, [oversizeButton, resetButton]), fallbackFrame),
)
