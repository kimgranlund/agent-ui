// bootstrap.ts — the HOST-owned bootstrap script (genui-surface.spec.md §2 "Bootstrap"): injected
// ahead of any model byte, it owns the FRAME side of the bridge (the `initialize` handshake, a
// `ResizeObserver` → `size-changed`, token/color-scheme application on `initialized`/
// `host-context-changed`) and exposes the ONE model-facing API, `genui.action(name, payload)`. Model
// code never speaks a raw postMessage shape — the bootstrap is the vocabulary's single frame-side home.
//
// Plain, non-module inline script TEXT — executed synchronously, first, inside the sandboxed srcdoc
// document (never a `.ts` module the frame imports). `window`/`document`/`ResizeObserver` are the
// ambient sandboxed-frame globals this script runs against; `targetOrigin: '*'` is the only legal
// target for an opaque origin (SPEC-R7 — recorded so nobody "tightens" it into breakage).

export const BOOTSTRAP_SCRIPT = `
(function () {
  'use strict';
  function post(msg) { try { window.parent.postMessage(msg, '*'); } catch (e) {} }
  function applyContext(ctx) {
    try {
      var root = document.documentElement;
      var tokens = (ctx && ctx.tokens) || {};
      for (var name in tokens) {
        if (Object.prototype.hasOwnProperty.call(tokens, name)) root.style.setProperty(name, tokens[name]);
      }
      if (ctx && typeof ctx.colorScheme === 'string') root.style.colorScheme = ctx.colorScheme;
    } catch (e) {}
  }
  window.addEventListener('message', function (event) {
    var data = event.data;
    if (!data || typeof data !== 'object') return;
    if (data.type === 'initialized' || data.type === 'host-context-changed') applyContext(data);
    // 'teardown' is advisory-only (SPEC-R5) — no required frame-side action.
  });
  window.genui = {
    action: function (name, payload) { post({ type: 'action', name: name, payload: payload }); },
  };
  function reportSize() {
    var height = document.documentElement.scrollHeight;
    post({ type: 'size-changed', height: height });
  }
  if (typeof ResizeObserver !== 'undefined') {
    var ro = new ResizeObserver(reportSize);
    ro.observe(document.documentElement);
  }
  post({ type: 'initialize' });
  if (document.readyState === 'complete') reportSize();
  else window.addEventListener('load', reportSize);
})();
`.trim()

/**
 * Compose the atomic srcdoc document (SPEC-R5 "build"): the SPEC-R4 CSP active before any model byte
 * evaluates, the SPEC-R6 token bridge available at first style resolution, and the bootstrap installed
 * before model script runs — insertion order in `<head>` is CSP meta, then the token `<style>`, then the
 * bootstrap `<script>` (each unshifted ahead of the last), so all three precede every original `<head>`
 * child (the model's own script/style/meta). Pure DOM string-in/string-out; `DOMParser` exists in both
 * jsdom and every real engine, so this is jsdom-testable (unlike the live iframe/postMessage legs, which
 * need a real browser gate).
 *
 * HONEST SCOPE (component-review finding): `DOMParser`'s `'text/html'` mode is deliberately forgiving —
 * per the HTML5 parsing algorithm it NEVER throws and NEVER yields a `parsererror` document for a STRING
 * input (that behavior is XML-mode-only); this function's `try`/`catch` and `parsererror` check are
 * therefore defensive-only for the html-markup input class, not a proven-reachable trigger — there is no
 * "malformed HTML markup" input this function can actually reject (and no fake detector is built here to
 * manufacture one; a real one would itself be an unproven, over-fitted heuristic). The genuinely reachable
 * SPEC-R5 never-paint triggers this control proves are: the oversize-html byte cap and a CSP-config
 * build failure (both exercised in `sandbox-frame.ts`/its tests) — "malformed html" as a THIRD, distinct
 * trigger is not one this leg can demonstrate and is not claimed as proven; `undefined` here still routes
 * to the same fail-closed fallback should some future engine or input ever exercise it.
 */
export function buildSrcdoc(html: string, cspPolicy: string, tokens: Record<string, string>, colorScheme: string): string | undefined {
  let doc: Document
  try {
    doc = new DOMParser().parseFromString(html, 'text/html')
  } catch {
    return undefined // defensive-only for this input class — see the HONEST SCOPE note above
  }
  if (doc.querySelector('parsererror') !== null) return undefined // ditto — text/html mode never produces one

  const head = doc.head ?? doc.documentElement.insertBefore(doc.createElement('head'), doc.documentElement.firstChild)

  const meta = doc.createElement('meta')
  meta.setAttribute('http-equiv', 'Content-Security-Policy')
  meta.setAttribute('content', cspPolicy)

  const tokenDecls = Object.entries(tokens)
    .map(([name, value]) => `${name}: ${value};`)
    .join(' ')
  const style = doc.createElement('style')
  style.textContent = `:root { ${tokenDecls} color-scheme: ${colorScheme}; }`

  const script = doc.createElement('script')
  script.textContent = BOOTSTRAP_SCRIPT

  head.insertBefore(script, head.firstChild)
  head.insertBefore(style, head.firstChild)
  head.insertBefore(meta, head.firstChild)

  return `<!DOCTYPE html>${doc.documentElement.outerHTML}`
}
