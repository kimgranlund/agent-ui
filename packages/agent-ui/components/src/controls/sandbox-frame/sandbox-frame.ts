// sandbox-frame.ts — UISandboxFrameElement, the GenUI containment host (genui-surface.spec.md
// SPEC-R3…R8; PRD-G3/G4/G5/G8). B1 SLICE ONLY (the SPEC's own §6 build plan): the component +
// containment + the bridge's HOST side + bootstrap + counters + the `action` event's emission — the
// wire (`genui` line reader), the producer packs, and agent-admin's action→turn ROUTING are B2
// (out of scope here; SPEC-R8 AC2's routing leg is a future consumer's job, not this control's).
//
// Content model: NOT host-as-grid — this is a rendered-content-cell control (the avatar.ts /
// bar-chart.ts shape): `render()` stays the inherited no-op, and ONE effect (keyed on `html`/`csp`)
// imperatively builds/replaces/tears down EXACTLY ONE light-DOM child — the `[data-part="frame"]`
// `<iframe sandbox="allow-scripts" srcdoc>` when contained, or the `[data-part="fallback"]` inert
// affordance when SPEC-R5's "Fail-closed/never-paint" law fires — never both, never neither once `html`
// is non-empty. Two triggers are PROVEN reachable and tested: an oversize `html` (the byte cap) and a CSP
// config build failure. `buildSrcdoc` (bootstrap.ts) ALSO returns `undefined` defensively on a genuine
// parse exception, but `DOMParser`'s `'text/html'` mode never throws/never yields `parsererror` for a
// string input (component-review finding) — that leg is defense-in-depth, not a third proven "malformed
// html" trigger; see bootstrap.ts's own HONEST SCOPE note.
//
// RECORDED LIMIT (component-review finding, PRD-G3): frame-level NAVIGATION egress
// (`location.href`/`location.replace`, a `<meta http-equiv=refresh>`, a real `<a href>` click) is NOT
// closable by the meta-CSP this control builds — no portable `navigate-to` CSP directive exists to name
// in SPEC-R4's own "recorded meta-CSP limits" list. This is NOT a host-containment breach (the top-nav/
// popup/parent-DOM/storage probes all hold, proven cross-engine — sandbox-frame.browser.test.ts — and the
// host's own URL/DOM/storage stay byte-unchanged regardless): the sandboxed frame simply navigates
// ITSELF, inside its own (attribute-sandboxed, opaque-origin) browsing context, to wherever it points.
// The threat model this control relies on for that channel: the frame holds NO secrets (no cookies, no
// storage, no host DOM reach — the opaque origin already denies all three), so a self-navigation cannot
// exfiltrate anything the frame does not already lack. PRD-G3's "allow-listed, never open" network-reach
// law is honored for `fetch`/`XHR`/WebSocket (`connect-src`) and image/font loads (`img-src`/`font-src`);
// frame-level navigation is the one egress class outside that law's reach, recorded here rather than
// silently assumed closed.
//
// The bridge (SPEC-R7/R8): ONE `window` `message` listener (connection-scoped via `this.listen`,
// auto-removed on disconnect), filtering by `event.source === <this instance's iframe>.contentWindow`
// (the identity check an opaque origin's null `event.origin` cannot substitute for) and then by
// `parseFrameMessage` (bridge.ts) — anything failing EITHER check is dropped + counted on the
// observable `droppedMessages` accessor, never surfaced as a DOM event, never a throw (SPEC-N4). A
// valid `action` message re-emits the fleet's ADR-0153 seventh event, `action`, with detail
// `{ surfaceId, name, payload }` (SPEC-R8) — routing that event to a turn loop is the B2 consumer's job.
//
// Live theme (SPEC-R6): a `MutationObserver` on `document.documentElement` (`subtree: true`,
// `attributeFilter: ['style', 'class']`) — broad by design, so a `ui-theme-provider` ancestor's inline
// `color-scheme` write is caught regardless of nesting depth — re-syncs on any hit: a HANDSHAKEN frame
// gets `host-context-changed` (state survives); an UN-handshaken frame gets a full rebuild (the
// no-bridge fallback's honest cost, PRD §8 m2).
//
// `controls → dom` is the allowed import direction; the CSP/bridge/token-bridge/bootstrap modules are
// same-folder siblings (the bar-chart / bar-math.ts co-location precedent).

import { UIElement, prop, type PropConfig, type PropsSchema, type ReactiveProps } from '../../dom/index.ts'
import { buildCsp, type SandboxFrameCspConfig } from './csp.ts'
import { parseFrameMessage, utf8ByteLength, type HostToFrameMessage } from './bridge.ts'
import { readTokenMap } from './token-bridge.ts'
import { buildSrcdoc } from './bootstrap.ts'

export type { SandboxFrameCspConfig } from './csp.ts'

/** SPEC-R2 — 512 KiB, UTF-8 byte length of `html`. Mirrored HERE as this control's OWN defense-in-depth
 *  never-paint check (SPEC-R5), independent of the (B2) wire's own structural gate — the wire's
 *  `readGenuiLine` is not built under this B1 scope; a control fed an oversize `html` property directly
 *  (bypassing the wire entirely) must still never paint it. */
const GENUI_MAX_HTML_BYTES = 524_288

/** SPEC-R8's fleet event detail shape — `ui-sandbox-frame`'s reuse of ADR-0153's seventh `action` event. */
export interface GenuiActionDetail {
  surfaceId: string
  name: string
  payload?: unknown
}

/** SPEC-R3 — "If the environment cannot establish this posture (no sandbox support, srcdoc
 *  unavailable), the control MUST take the never-paint path." A pure predicate so a posture-unavailable
 *  stub is a plain unit-test input (no monkeypatching a real HTMLIFrameElement needed). Checks `srcdoc`
 *  only — the genuinely load-bearing content-delivery IDL property every engine that ships `sandbox`
 *  also ships; the sandbox ATTRIBUTE itself is always set via `setAttribute` (never the `.sandbox` IDL
 *  reflection), so checking for that property's mere PRESENCE would test an implementation detail no
 *  real engine ever lacks while jsdom (a test tool, not a production target) happens to omit it —
 *  jsdom implements `srcdoc` but not the `.sandbox` IDL reflection, a documented jsdom gap. */
export function canEstablishPosture(probe: { srcdoc?: unknown } = document.createElement('iframe')): boolean {
  return 'srcdoc' in probe
}

/** The live default for `csp` — every category absent (default-deny, SPEC-R4). A plain `{}` would print
 *  as `String({}) === '[object Object]'` for the descriptor↔props trip-wire's DRIFT_DEFAULT comparison —
 *  and `'[object Object]'` (post-unquote) syntactically COLLIDES with the frontmatter parser's inline
 *  `[a, b]` array detection (`component-descriptor.ts`'s `addField`), silently corrupting the parsed
 *  default into an array. A non-enumerable `toString` override sidesteps the collision (`String(...)`
 *  yields the plain `'{}'` the descriptor declares) without changing the object's real shape — every
 *  `SandboxFrameCspConfig` property stays absent, `JSON.stringify`/`Object.entries`/`for…in` all skip a
 *  non-enumerable property, so `buildCsp`/`JSON.stringify` behave identically to a bare `{}`. */
const DEFAULT_CSP: SandboxFrameCspConfig = Object.defineProperty({}, 'toString', { value: () => '{}', enumerable: false })

/** A safe, never-throwing `SandboxFrameCspConfig` codec (the bar-chart/bar-math.ts `barDataProp` safe-
 *  codec precedent, SPEC-N4's "never throws" law applied to this control's `csp` prop): a malformed
 *  attribute JSON string falls back to `{}` (default-deny), never propagates to `attributeChangedCallback`.
 *  `from(null)` returns `null` (the generic `jsonType<T>()` shape, `props.ts`) so the descriptor↔props
 *  trip-wire's `kindOf` heuristic classifies this codec as `json` — it must pass a VALID JSON string
 *  straight through UNCOERCED (`from('"x"') === 'x'`, kindOf's own json-detection probe), not clamp every
 *  non-object result to `{}` (an earlier draft's bug — clamping broke kindOf's classification). The LIVE
 *  default is `DEFAULT_CSP` above (what a fresh instance actually starts at — `signalFor` seeds from
 *  `config.default`, never from `type.from(null)`). Property-only (`attribute: false`): a security-
 *  relevant structured config is never HTML-attribute-fed. */
const cspConfigProp: PropConfig<SandboxFrameCspConfig> = {
  type: {
    from(attr) {
      if (attr === null) return null as unknown as SandboxFrameCspConfig
      try {
        return JSON.parse(attr) as SandboxFrameCspConfig
      } catch {
        return {} // malformed JSON — never throws (SPEC-N4)
      }
    },
    to(value) {
      return JSON.stringify(value)
    },
  },
  default: DEFAULT_CSP,
  attribute: false,
}

const props = {
  // The GenuiEnvelope.surfaceId passthrough (SPEC §5) — a future (B2) wire consumer sets this alongside
  // `html`; carried on the `action` event detail (SPEC-R8). Multi-word camelCase ⇒ an explicit kebab
  // `attribute:` override (naming.md §3).
  surfaceId: { ...prop.string(''), attribute: 'surface-id' },
  // The GenuiEnvelope.html passthrough (SPEC-R2) — ONE whole HTML document, applied ATOMICALLY (never
  // chunked/streamed). Not reflected: an unbounded-size blob is never an HTML attribute in practice.
  html: prop.string(''),
  // SandboxFrameCspConfig (SPEC-R4) — the four-category allow-list; absent categories default-deny.
  csp: cspConfigProp,
} satisfies PropsSchema

export interface UISandboxFrameElement extends ReactiveProps<typeof props> {}
export class UISandboxFrameElement extends UIElement {
  static props = props

  #iframe: HTMLIFrameElement | null = null
  #fallback: HTMLElement | null = null
  #handshaken = false
  #droppedMessages = 0
  #themeObserver: MutationObserver | null = null

  /** SPEC-R7's observable drop counter — every out-of-vocabulary/malformed/foreign-source frame message
   *  increments this, never throws, never emits a DOM event for the rejected message.
   *  OBSERVABILITY CAVEAT (component-review): with MULTIPLE `ui-sandbox-frame` instances on one page,
   *  every instance's `window` `message` listener sees every OTHER instance's frame's normal, well-formed
   *  traffic too — that traffic fails THIS instance's source-identity check (it isn't from THIS
   *  instance's own iframe) and increments THIS instance's counter, even though nothing is wrong. A
   *  nonzero count is therefore not itself an attack signal in a multi-surface page — it is a genuine
   *  drop/reject count, but "dropped" here includes ordinary sibling cross-talk, not only hostile input. */
  get droppedMessages(): number {
    return this.#droppedMessages
  }

  protected connected(): void {
    this.listen(window, 'message', (event) => this.#onMessage(event as MessageEvent))

    // Live-theme detection (SPEC-R6): broad by design (subtree + style/class only) so an ancestor
    // ui-theme-provider's inline color-scheme write is caught regardless of nesting depth. Filters out
    // mutations whose target is THIS host itself — `#onMessage`'s own `--content-height` write (the
    // auto-height JS seam) is a `style` attribute mutation on `this`, which would otherwise self-trigger
    // a spurious sync on every `size-changed` report (measured: a real cross-engine race — the frame's
    // proactive initial size report fired a sync BEFORE a deliberate ambient flip in the same test tick,
    // reporting the stale color first and starving the real one from the test's first `waitFor`).
    this.#themeObserver = new MutationObserver((records) => {
      if (records.some((r) => r.target !== this)) this.#syncTheme()
    })
    this.#themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['style', 'class'], subtree: true })

    this.effect(() => {
      const html = this.html
      const cspConfig = this.csp
      this.#build(html, cspConfig)
    })
  }

  protected disconnected(): void {
    this.#themeObserver?.disconnect()
    this.#themeObserver = null
    this.#teardownFrame()
  }

  // ── build / replace / teardown (SPEC-R5) ──────────────────────────────────────────────────────────

  #build(html: string, cspConfig: SandboxFrameCspConfig): void {
    if (html === '') {
      this.#renderFallback()
      return
    }
    if (utf8ByteLength(html) > GENUI_MAX_HTML_BYTES) {
      this.#renderFallback() // never-paint: oversize (SPEC-R2/R5)
      return
    }
    if (!canEstablishPosture()) {
      this.#renderFallback() // never-paint: unestablishable posture (SPEC-R3/R5)
      return
    }
    const policy = buildCsp(cspConfig)
    if (policy === undefined) {
      this.#renderFallback() // never-paint: CSP build failure (SPEC-R4/R5)
      return
    }
    const tokens = readTokenMap(this)
    const colorScheme = getComputedStyle(this).colorScheme
    const srcdoc = buildSrcdoc(html, policy, tokens, colorScheme)
    if (srcdoc === undefined) {
      // Defense-in-depth only — bootstrap.ts's own HONEST SCOPE note: DOMParser's 'text/html' mode never
      // actually returns undefined for a string `html` (no proven-reachable "malformed markup" input);
      // this branch still routes to the SAME fail-closed fallback should that ever change.
      this.#renderFallback()
      return
    }
    this.#renderFrame(srcdoc)
  }

  #renderFrame(srcdoc: string): void {
    this.#fallback?.remove()
    this.#fallback = null

    if (this.#iframe && this.#iframe.isConnected) {
      // Replace (SPEC-R5): an already-rendered surface rebuilds atomically; a best-effort `teardown`
      // precedes the swap; frame-internal state is lost BY DESIGN (the atomicity law).
      this.#postToFrame({ type: 'teardown' })
      this.#handshaken = false
      this.#iframe.setAttribute('sandbox', 'allow-scripts')
      this.#iframe.srcdoc = srcdoc
      return
    }

    const iframe = document.createElement('iframe')
    iframe.setAttribute('data-part', 'frame')
    iframe.setAttribute('sandbox', 'allow-scripts') // SPEC-R3 — exactly this, no other token
    iframe.srcdoc = srcdoc
    this.appendChild(iframe)
    this.#iframe = iframe
    this.#handshaken = false
  }

  #renderFallback(): void {
    this.#teardownFrame()
    if (!this.#fallback) {
      const div = document.createElement('div')
      div.setAttribute('data-part', 'fallback')
      div.textContent = 'Not rendered'
      this.#fallback = div
    }
    if (this.#fallback.parentNode !== this) this.appendChild(this.#fallback)
  }

  #teardownFrame(): void {
    if (!this.#iframe) return
    this.#postToFrame({ type: 'teardown' }) // best-effort advisory (SPEC-R5)
    this.#iframe.remove()
    this.#iframe = null
    this.#handshaken = false
    this.style.removeProperty('--content-height')
  }

  // ── the bridge, host side (SPEC-R7/R8) ────────────────────────────────────────────────────────────

  #postToFrame(msg: HostToFrameMessage): void {
    // targetOrigin '*' is the only legal target for an opaque origin (SPEC-R7) — recorded so nobody
    // "tightens" this into breakage.
    this.#iframe?.contentWindow?.postMessage(msg, '*')
  }

  /** Source-identity + vocabulary guard (SPEC-R7): a message is accepted ONLY when BOTH (a)
   *  `event.source` is this instance's OWN frame's `contentWindow` (the opaque origin's null
   *  `event.origin` cannot substitute for identity), AND (b) `parseFrameMessage` recognizes its shape.
   *  Anything failing either check is dropped + counted, never surfaced, never a throw. */
  #onMessage(event: MessageEvent): void {
    if (!this.#iframe || event.source !== this.#iframe.contentWindow) {
      this.#droppedMessages += 1
      return
    }
    const parsed = parseFrameMessage(event.data as unknown)
    if (!parsed) {
      this.#droppedMessages += 1
      return
    }
    if (parsed.type === 'size-changed') {
      // The auto-height law (SPEC-R7): the host CLAMPS to the control's min/max size tokens in CSS
      // (sandbox-frame.css's clamp()) — this only publishes the raw reported height as the JS seam.
      const clamped = Math.max(0, parsed.height)
      this.style.setProperty('--content-height', `${clamped}px`)
      return
    }
    if (parsed.type === 'initialize') {
      this.#handshaken = true
      this.#postToFrame({ type: 'initialized', tokens: readTokenMap(this), colorScheme: getComputedStyle(this).colorScheme })
      return
    }
    // parsed.type === 'action' — the fleet's seventh event (ADR-0153), reused verbatim (SPEC-R8).
    this.emit<GenuiActionDetail>('action', { surfaceId: this.surfaceId, name: parsed.name, payload: parsed.payload })
  }

  // ── live theme (SPEC-R6) ──────────────────────────────────────────────────────────────────────────

  #syncTheme(): void {
    if (!this.#iframe) return
    if (this.#handshaken) {
      this.#postToFrame({ type: 'host-context-changed', tokens: readTokenMap(this), colorScheme: getComputedStyle(this).colorScheme })
    } else {
      // The no-bridge fallback (SPEC-R6): a full rebuild, themed correctly, frame-internal state lost —
      // the stated, accepted consequence (PRD §8 m2).
      this.#build(this.html, this.csp)
    }
  }
}

if (!customElements.get('ui-sandbox-frame')) customElements.define('ui-sandbox-frame', UISandboxFrameElement)
