import"./super-shell-D76CLu9A.js";import{n as e}from"./dom-OxgQ3tAy.js";import{n as t,r as n}from"./_page-DIBN49D1.js";import{t as r}from"./code-block-DEt2Scp8.js";import{a as i,i as a,o}from"./doc-page-H_CmxYv1.js";import{C as s,Ct as c,U as l,tt as u}from"./frontmatter-D6AIzGjv.js";/* empty css                   */import{a as d,i as f}from"./specimens-BSFejhGR.js";import{t as p}from"./super-shell-D5ZIlqZk.js";function m(e,t,n){return t.map(t=>{let r=a(e.descriptor,t);if(!r)throw Error(`motion: expected attribute "${t}" on ${n} — renamed or removed from its {name}.md?`);return r})}var h={"ui-super-shell":[`viewTransitions`,`viewTransitionNames`],"ui-surface-host":[`viewTransitions`],"ui-drill":[`viewTransitions`],"ui-router-outlet":[`viewTransitions`]},g=`// view-transition.ts — the fleet's ONE View Transitions seam (GH #740, ADR-0183): wrap a DOM mutation in
// \`document.startViewTransition\` when (and only when) the caller opted in, the API exists, and the user
// has not asked for reduced motion. Progressive enhancement by construction — on every other path the
// mutation runs synchronously, byte-identical to before this helper existed (no polyfill, no errors,
// no timing change).
//
// Lives in \`dom/\` (not shared/, not a trait) because every opted-in surface sits above components on the
// DAG (\`components ← {router, a2ui, code} ← app\`) and below it nothing swaps DOM — this is the single
// home all four ADR-0183 surfaces can import without a layering violation.
//
// THE ONE SEMANTIC CAVEAT, stated here because it is the only sharp edge: on the TRANSITION path the
// browser snapshots first and runs \`mutate\` asynchronously (typically next frame). A caller whose swap
// carries a staleness guard (the router outlet's last-navigation-wins token) MUST re-check that guard
// INSIDE \`mutate\`, not before the call — the fallback path's synchronous timing is not a contract the
// transition path keeps. Rapid successive calls are safe: the platform skips the previous transition
// when a new one starts (per spec), so the LAST mutate always lands.

/** \`true\` iff a transition would actually run for an opted-in caller right now — the exact gate
 *  \`withViewTransition\` applies, exported so a probe/test can assert WHICH path executed without
 *  duplicating the detection. lib.dom types \`startViewTransition\` as always-present; runtime reality
 *  (jsdom, Firefox) disagrees, so the \`typeof\` check is the truth here, not the type. */
export function viewTransitionAvailable(): boolean {
  const supported = typeof document.startViewTransition === 'function'
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
  return supported && !reduced
}

// GH #958 (ADR-0183 cl.4) — THE NAMED-MORPH CONVENTION. cl.4 shipped no fleet-default
// \`view-transition-name\`s (a consumer's own vocabulary, layered on top of the cross-fade this seam
// already provides); this is that vocabulary's first documented, proven scheme — still opt-in, still
// consumer/surface-decided, never a default any control applies on its own.
//
// SCHEME: \`ui-vt-{surface}-{token}\` — \`surface\` names the OWNING surface (a control's own tag-ish slug,
// e.g. \`super-shell-segment\`), \`token\` names the PERSISTENT IDENTITY within it (a slot name, a stable id
// — never an array index, which is not identity). \`viewTransitionName\` sanitizes both into one valid CSS
// custom-ident so a caller never hand-rolls the escaping.
//
// PAIRING LAW (why ONE name, not one per element): the platform pairs an "old" snapshot and a "new"
// snapshot that carry the SAME \`view-transition-name\` and animates between their rects — but a single
// flat snapshot may contain that name on AT MOST ONE painted (not \`display:none\`) element, or the
// transition throws. The trick a caller must know: give EVERY element that can occupy one visual "role"
// the SAME name (e.g. every segment in a segmented pane, only one ever visible at a time via CSS) —
// the browser then morphs whichever one was visible before into whichever one is visible after, even
// though they are different DOM nodes, because visibility (not presence) is what the snapshot sees.
// The flip side of that law: the token must be unique per DOCUMENT, not per surface INSTANCE — a surface
// that can be mounted more than once on a page (a shell, an outlet) folds an instance discriminator
// (its authored \`id\`, else a per-document counter) into the token, or two instances paint the same
// name in one snapshot and the platform aborts the whole transition (\`ui-super-shell\` does exactly this).
//
// OPT-IN, BYTE-IDENTICAL WHEN OFF (same law as \`withViewTransition\`): a caller applies a name ONLY when
// its own opt-in prop is set — never unconditionally — so a build with the opt-in off never touches
// \`style.viewTransitionName\` at all, not even to clear it. \`setViewTransitionName\` codifies that guard.

/** Builds one scoped \`view-transition-name\` value: \`ui-vt-{surface}-{token}\`, every character outside
 *  \`[a-zA-Z0-9-]\` in either part replaced with \`-\` (CSS custom-ident is otherwise unconstrained, but
 *  callers pass slot/id strings that may carry other characters — this keeps the result always valid,
 *  never a caller-visible \`DOMException\` from an untrusted token). The \`ui-vt-\` prefix scopes every
 *  fleet-convention name into one collision-free namespace, distinct from a consumer's own names.
 *  CAVEAT — the sanitizer is lossy on purpose: \`a b\`, \`a-b\` and \`a_b\` all collapse to \`a-b\`, so two
 *  tokens that differ only in such characters (or a \`surface\`/\`token\` pair whose boundary is ambiguous,
 *  \`foo\`+\`bar-x\` vs \`foo-bar\`+\`x\`) yield ONE name. Callers own token distinctness at the identity grain
 *  they care about (slot names, ids, instance counters — already \`[a-zA-Z0-9-]\` in the fleet). */
export function viewTransitionName(surface: string, token: string): string {
  const clean = (s: string): string => s.replace(/[^a-zA-Z0-9-]/g, '-')
  return \`ui-vt-\${clean(surface)}-\${clean(token)}\`
}

/** Applies (\`enabled\`) or leaves untouched (\`!enabled\`) a \`view-transition-name\` on \`el.style\` — the
 *  named-morph counterpart to \`withViewTransition\`'s own enabled-gate. Deliberately NEVER clears the
 *  property on the disabled path: a caller's own opt-in prop is compose-time/one-shot (the same timing
 *  as the surfaces that use it today), so "disabled" means "never called," not "called then undone" —
 *  matching \`withViewTransition\`'s byte-identical-when-off law without adding a mutation neither path
 *  needs. */
export function setViewTransitionName(el: HTMLElement, name: string, enabled: boolean): void {
  if (!enabled) return
  el.style.viewTransitionName = name
}

/**
 * Run \`mutate\` — inside \`document.startViewTransition\` when \`enabled\` and the platform allows it
 * (\`viewTransitionAvailable\`), synchronously otherwise. The return is deliberately \`void\`, not the
 * platform's \`ViewTransition\` object: exposing it would make the OPT-OUT path's shape diverge from the
 * opt-in path's, and no fleet consumer needs the finished/ready promises today (a future consumer that
 * does earns a widening, not a workaround).
 */
export function withViewTransition(mutate: () => void, enabled: boolean): void {
  if (!enabled || !viewTransitionAvailable()) {
    mutate()
    return
  }
  const transition = document.startViewTransition(mutate)
  // Rapid successive calls are the DESIGNED coalescing path (each new call skips the one in flight —
  // the file-header caveat), and a skipped transition REJECTS its \`ready\` promise with AbortError
  // ("Transition was skipped" / "Old view transition aborted by new view transition") — routine noise
  // here, never a caller-visible failure (found live: GH #742's re-render bursts). Only \`ready\` is
  // silenced: \`finished\`/\`updateCallbackDone\` stay untouched, so a mutate that genuinely THROWS keeps
  // surfacing as an unhandled rejection instead of being swallowed by the seam.
  // Optional-chained: the REAL API always returns a ViewTransition, but the fleet's jsdom tests stub
  // \`startViewTransition\` with bare callback-recorders (no ready promise) — the seam stays stub-tolerant.
  ;(transition as { ready?: Promise<unknown> } | undefined)?.ready?.catch(() => {})
}
`;function _(e,t){let n=`export function ${t}(`,r=e.indexOf(n);if(r===-1)throw Error(`motion: function "${t}" not found in view-transition.ts — renamed or removed?`);let i=e.indexOf(`{`,r);return e.slice(r,i).trim()}function v(e,t){return e.split(`
`).slice(0,t).map(e=>e.replace(/^\/\/ ?/,``)).join(`
`)}function y(...e){let t=document.createElement(`p`);for(let n of e)t.append(typeof n==`string`?document.createTextNode(n):n);return t}function b(e){let t=document.createElement(`code`);return t.textContent=e,t}function x(e,t){let n=document.createElement(`a`);return n.href=e,n.textContent=t,n}var{content:S}=t({title:`View transitions`,intro:`ADR-0183 (+ two amendments, GH #740) is the fleet’s ONE shared View Transitions seam — progressive-enhancement-only, default off everywhere. This page documents the opt-in law once, then the four surfaces that expose it: ui-super-shell, ui-surface-host, ui-drill, and ui-router-outlet.`});S.append(i(2,`The opt-in law`)),S.append(y(`Every surface below follows the SAME four rules, stated once here instead of on each surface’s own doc page (ADR-0183 cl.1, `,b(`packages/agent-ui/components/src/dom/view-transition.ts`),`):`));var C=document.createElement(`ul`);for(let[e,t]of[[`Default OFF`,`every opt-in boolean defaults to false — a build that never sets one is byte-identical to before ADR-0183 shipped.`],[`Progressive enhancement, never a polyfill`,`the transition path runs only when document.startViewTransition exists; every other path (no API, opt-in off) runs the same mutation synchronously — same behavior, same timing, zero errors.`],[`prefers-reduced-motion is respected`,`viewTransitionAvailable() checks the media query on every call; a reduced-motion environment takes the synchronous fallback exactly like a no-API one, even with the opt-in on.`],[`Pre-settle streaming NEVER transitions`,`ui-surface-host’s own settled-once boundary (its first finalize()) gates every wrap — first-paint streaming stays unwrapped by construction (progressive paint IS the surface’s value), only a RE-render after settle can transition (the 2026-08-12 amendment).`]]){let n=document.createElement(`li`),r=document.createElement(`strong`);r.textContent=`${e} — `,n.append(r,document.createTextNode(t)),C.append(n)}S.append(C),S.append(y(`Source: `,x(`https://github.com/kimgranlund/agent-ui/blob/main/.claude/docs/adr/0183-view-transitions-opt-in-family.md`,`ADR-0183`),` (accepted 2026-08-12) — the 2026-08-12 amendment (ui-surface-host’s grain, GH #742) and the 2026-08-16 amendment (the named-morph convention, GH #958) are append-only extensions of the same record, plus the 2026-08-16 measured appendix (GH #1005, §4 below) closing the ADR’s one browser-UNMEASURED line.`)),S.append(i(2,`The shared seam — dom/view-transition.ts`)),S.append(y(`Lives in `,b(`components/dom`),` (not shared/, not a trait) — the one home every opted-in surface can import without a layering violation (`,b(`components ← {router, a2ui, code, app}`),`). Verbatim from the file’s own header:`)),S.append(r(v(g,5),void 0)),S.append(i(3,`withViewTransition / viewTransitionAvailable — derived from source`)),S.append(r(_(g,`viewTransitionAvailable`),`ts`)),S.append(r(_(g,`withViewTransition`),`ts`)),S.append(y(`The one semantic caveat (stated at the seam, not repeated per surface): on the TRANSITION path the browser snapshots first and runs `,b(`mutate`),` asynchronously — a caller with a staleness guard (the router outlet’s last-navigation-wins token) MUST re-check that guard INSIDE `,b(`mutate`),`, not before the call.`)),S.append(i(3,`The named-morph convention — viewTransitionName / setViewTransitionName`)),S.append(y(`GH #958 (ADR-0183’s 2026-08-16 amendment): named-element morphs are the CONSUMER’s vocabulary, layered on top of the cross-fade above — the fleet ships no default names. `,b(`ui-vt-{surface}-{token}`),`, applied ONLY behind a surface’s own opt-in:`)),S.append(r(_(g,`viewTransitionName`),`ts`)),S.append(r(_(g,`setViewTransitionName`),`ts`)),S.append(y(`PAIRING LAW: at most one PAINTED element may carry a given `,b(`view-transition-name`),` in one snapshot, or the platform throws — every element that can occupy ONE visual role shares the SAME name (only one is ever visible via CSS), and the name is unique per DOCUMENT, not per surface instance.`)),S.append(i(2,`The four surfaces`)),S.append(y(`One table per surface, sliced from its own shipped descriptor (never hand-typed — a renamed attribute throws at build, motion-attrs.ts’s `,b(`requireAttrs`),`, pinned by motion.test.ts against these SAME four descriptors).`));function w(e,t,n,r){let a=h[t],s=m(r,a,e),c=document.createElement(`section`);return c.append(i(3,e)),c.append(y(x(n,`${e} — full API reference`))),c.append(o(s,4)),c}S.append(w(`ui-super-shell`,`ui-super-shell`,`./super-shell.html`,c(p))),S.append(w(`ui-surface-host`,`ui-surface-host`,`./surface-host-doc.html`,u())),S.append(w(`ui-drill`,`ui-drill`,`./drill-doc.html`,s())),S.append(w(`ui-router-outlet`,`ui-router-outlet`,`./router-doc.html`,l())),S.append(y(`A naming note: all four descriptors’ `,b(`attributes[].name`),` fields carry the camelCase PROP name (`,b(`viewTransitions`),`) plus an explicit `,b(`attribute:`),` override with the kebab-case DOM attribute (`,b(`view-transitions`),`) — uniform since GH #1079, when super-shell.md adopted its siblings’ majority grammar.`)),S.append(i(2,`Named-morph proof — real engines, GH #1005`)),S.append(y(`ADR-0183’s 2026-08-16 amendment shipped the named-morph convention browser-UNMEASURED; the 2026-08-16 appendix closed that line. `,b(`super-shell-named-morph.browser.test.ts`),` (`,b(`packages/agent-ui/app/src/controls/super-shell/`),`) mounts a wide-mode, both-opt-ins-on `,b(`ui-super-shell`),` with a segmented pane, intercepts the REAL `,b(`document.startViewTransition`),`, drives a real pane-tab click (the segment swap), and awaits `,b(`ready`),`. Measured on this repo’s pinned Playwright build (1.61.1):`));var T=document.createElement(`ul`);for(let e of[`Chromium: document.startViewTransition present — the transition path ran genuinely (not the sync fallback); ready resolved with no rejection.`,`WebKit: document.startViewTransition present — same result, ready resolved clean (this harness’s bundled WebKit build sits on the supporting side of ADR-0183’s version-gate concern; the graceful sync-fallback branch the same test file also carries went unexercised here, not unwritten).`,`The pairing-law invariant (at most one PAINTED element may carry a given view-transition-name) held both immediately before and immediately after the swap — asserted directly.`]){let t=document.createElement(`li`);t.textContent=e,T.append(t)}S.append(T),S.append(i(2,`Live demo — the opt-in, toggled on a real ui-drill`)),S.append(n(`A real `,b(`<ui-drill>`),` with the switch below wired directly to its `,b(`view-transitions`),` attribute — off by default (drill.md’s own law). Drill into “Appearance” to see the swap; whether it actually cross-fades depends on YOUR browser and motion settings, honestly, not on this page.`));var E=e=>document.createTextNode(e),D=f(`ui-drill`,{"aria-label":`Motion demo`},[f(`ui-drill-panel`,{key:`root`,heading:`Settings`},[f(`ul`,{style:`margin:0; padding-inline-start:1.25rem`},[f(`li`,{},[f(`button`,{"data-role":`drill-trigger`,"data-drill-key":`appearance`},[E(`Appearance`)])])])]),f(`ui-drill-panel`,{key:`appearance`,parent:`root`,heading:`Appearance`},[f(`p`,{style:`margin:0`},[E(`This panel swap runs through the SAME withViewTransition seam every surface above uses.`)])])]),O=f(`ui-switch`,{"aria-label":`view-transitions`}),k=document.createElement(`p`);function A(){let t=!!O.checked;D.toggleAttribute(`view-transitions`,t);let n=t&&e();k.textContent=`view-transitions=${String(t)} · viewTransitionAvailable() (this browser/motion-setting, right now) = ${String(e())} ⇒ this drill's next swap will ${n?`RUN a real startViewTransition`:`run the synchronous fallback (byte-identical to before ADR-0183)`}.`}O.addEventListener(`change`,A),A(),S.append(d(`ui-drill — view-transitions opt-in`,f(`div`,{style:`display:flex; align-items:center; gap:0.5rem; margin-block-end:0.75rem`},[f(`label`,{style:`display:flex; align-items:center; gap:0.5rem`},[O,E(`view-transitions`)])]),D,k));