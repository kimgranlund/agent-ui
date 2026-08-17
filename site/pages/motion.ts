// site/pages/motion.ts — the View Transitions / motion GUIDE (T6, site-authoring taxonomy): the ONE shared
// `withViewTransition` seam (`dom/view-transition.ts`, ADR-0183/GH #740) and its four opt-in surfaces
// (ui-super-shell, ui-surface-host, ui-drill, ui-router-outlet). ui-super-shell/ui-surface-host live in
// @agent-ui/app, ui-router-outlet in @agent-ui/router — all three OUTSIDE the components/src/controls fleet
// the site-coverage/site-toc drift gates enumerate — so, like router-doc.ts/traits-doc.ts before it, this is
// an UNGROUPED site-level GUIDE page, not a per-component {name}-{type}.html set.
//
// DERIVE-FIRST: every attribute row below is read straight from its owning `{name}.md` descriptor through the
// SAME canonical parser (parseDoc/findAttr, `site/lib/frontmatter.ts` + `site/lib/doc-page.ts`) every control
// API doc uses — never hand-retyped (motion-attrs.ts's `requireAttrs` THROWS if a name is renamed/removed, a
// real drift gate pinned by motion.test.ts against the SAME real descriptors, GH #1043). Every seam function
// signature is sliced VERBATIM out of `dom/view-transition.ts` at build time (the traits-doc.ts extractor
// precedent) — never hand-retyped either.
//
// What is hand-authored, flagged: the opt-in-law framing prose (a synthesis of ADR-0183 cl.1/cl.6's amendment/
// the 2026-08-16 amendment, cited by ID rather than restated verbatim), and the live demo's page-chrome markup.
import { mountPage, pageLead } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css' // shared demo-content chrome; never restyles a ui-* control
import { heading, renderApiTable } from '../lib/doc-page.ts'
import { codeBlock } from '../lib/code-block.ts'
import { el, exampleSection } from '../lib/specimens.ts'
import { parseDoc, loadDrillDoc, loadSurfaceHostDoc, loadRouterOutletDoc, type ComponentDoc } from '../lib/frontmatter.ts'
import { requireAttrs, SURFACE_ATTR_NAMES } from './motion-attrs.ts'
import shellMd from '../../packages/agent-ui/app/src/controls/super-shell/super-shell.md?raw'
import viewTransitionSrc from '../../packages/agent-ui/components/src/dom/view-transition.ts?raw'
import { viewTransitionAvailable } from '@agent-ui/components'

// ── local derivation helpers (the traits-doc.ts precedent — verbatim slice, throw if the marker is gone) ─────
function extractSignature(source: string, name: string): string {
  const marker = `export function ${name}(`
  const start = source.indexOf(marker)
  if (start === -1) throw new Error(`motion: function "${name}" not found in view-transition.ts — renamed or removed?`)
  const bodyStart = source.indexOf('{', start)
  return source.slice(start, bodyStart).trim()
}
function bannerLines(source: string, n: number): string {
  return source
    .split('\n')
    .slice(0, n)
    .map((l) => l.replace(/^\/\/ ?/, ''))
    .join('\n')
}

function para(...parts: (string | Node)[]): HTMLElement {
  const p = document.createElement('p')
  for (const part of parts) p.append(typeof part === 'string' ? document.createTextNode(part) : part)
  return p
}
function code(text: string): HTMLElement {
  const c = document.createElement('code')
  c.textContent = text
  return c
}
function link(href: string, text: string): HTMLAnchorElement {
  const a = document.createElement('a')
  a.href = href
  a.textContent = text
  return a
}

const { content } = mountPage({
  title: 'View transitions',
  intro:
    'ADR-0183 (+ two amendments, GH #740) is the fleet’s ONE shared View Transitions seam — ' +
    'progressive-enhancement-only, default off everywhere. This page documents the opt-in law once, then the ' +
    'four surfaces that expose it: ui-super-shell, ui-surface-host, ui-drill, and ui-router-outlet.',
})

// ════════════════ 1 · The opt-in law ════════════════
content.append(heading(2, 'The opt-in law'))
content.append(
  para(
    'Every surface below follows the SAME four rules, stated once here instead of on each surface’s own doc ' +
      'page (ADR-0183 cl.1, ',
    code('packages/agent-ui/components/src/dom/view-transition.ts'),
    '):',
  ),
)
const lawList = document.createElement('ul')
for (const [term, desc] of [
  ['Default OFF', 'every opt-in boolean defaults to false — a build that never sets one is byte-identical to before ADR-0183 shipped.'],
  ['Progressive enhancement, never a polyfill', 'the transition path runs only when document.startViewTransition exists; every other path (no API, opt-in off) runs the same mutation synchronously — same behavior, same timing, zero errors.'],
  ['prefers-reduced-motion is respected', 'viewTransitionAvailable() checks the media query on every call; a reduced-motion environment takes the synchronous fallback exactly like a no-API one, even with the opt-in on.'],
  ['Pre-settle streaming NEVER transitions', 'ui-surface-host’s own settled-once boundary (its first finalize()) gates every wrap — first-paint streaming stays unwrapped by construction (progressive paint IS the surface’s value), only a RE-render after settle can transition (the 2026-08-12 amendment).'],
] as const) {
  const li = document.createElement('li')
  const strong = document.createElement('strong')
  strong.textContent = `${term} — `
  li.append(strong, document.createTextNode(desc))
  lawList.append(li)
}
content.append(lawList)
content.append(
  para(
    'Source: ',
    link('https://github.com/kimgranlund/agent-ui/blob/main/.claude/docs/adr/0183-view-transitions-opt-in-family.md', 'ADR-0183'),
    ' (accepted 2026-08-12) — the 2026-08-12 amendment (ui-surface-host’s grain, GH #742) and the 2026-08-16 ' +
      'amendment (the named-morph convention, GH #958) are append-only extensions of the same record, plus the ' +
      '2026-08-16 measured appendix (GH #1005, §4 below) closing the ADR’s one browser-UNMEASURED line.',
  ),
)

// ════════════════ 2 · The shared seam — dom/view-transition.ts ════════════════
content.append(heading(2, 'The shared seam — dom/view-transition.ts'))
content.append(
  para(
    'Lives in ',
    code('components/dom'),
    ' (not shared/, not a trait) — the one home every opted-in surface can import without a layering ' +
      'violation (',
    code('components ← {router, a2ui, code, app}'),
    '). Verbatim from the file’s own header:',
  ),
)
content.append(codeBlock(bannerLines(viewTransitionSrc, 5), undefined))
content.append(heading(3, 'withViewTransition / viewTransitionAvailable — derived from source'))
content.append(codeBlock(extractSignature(viewTransitionSrc, 'viewTransitionAvailable'), 'ts'))
content.append(codeBlock(extractSignature(viewTransitionSrc, 'withViewTransition'), 'ts'))
content.append(
  para(
    'The one semantic caveat (stated at the seam, not repeated per surface): on the TRANSITION path the ' +
      'browser snapshots first and runs ',
    code('mutate'),
    ' asynchronously — a caller with a staleness guard (the router outlet’s last-navigation-wins token) ' +
      'MUST re-check that guard INSIDE ',
    code('mutate'),
    ', not before the call.',
  ),
)

content.append(heading(3, 'The named-morph convention — viewTransitionName / setViewTransitionName'))
content.append(
  para(
    'GH #958 (ADR-0183’s 2026-08-16 amendment): named-element morphs are the CONSUMER’s vocabulary, layered on ' +
      'top of the cross-fade above — the fleet ships no default names. ',
    code('ui-vt-{surface}-{token}'),
    ', applied ONLY behind a surface’s own opt-in:',
  ),
)
content.append(codeBlock(extractSignature(viewTransitionSrc, 'viewTransitionName'), 'ts'))
content.append(codeBlock(extractSignature(viewTransitionSrc, 'setViewTransitionName'), 'ts'))
content.append(
  para(
    'PAIRING LAW: at most one PAINTED element may carry a given ',
    code('view-transition-name'),
    ' in one snapshot, or the platform throws — every element that can occupy ONE visual role shares the SAME ' +
      'name (only one is ever visible via CSS), and the name is unique per DOCUMENT, not per surface instance.',
  ),
)

// ════════════════ 3 · The four surfaces ════════════════
content.append(heading(2, 'The four surfaces'))
content.append(
  para(
    'One table per surface, sliced from its own shipped descriptor (never hand-typed — a renamed attribute ' +
      'throws at build, motion-attrs.ts’s ',
    code('requireAttrs'),
    ', pinned by motion.test.ts against these SAME four descriptors).',
  ),
)

function surfaceSection(label: string, tag: string, href: string, doc: ComponentDoc): HTMLElement {
  const names = SURFACE_ATTR_NAMES[tag as keyof typeof SURFACE_ATTR_NAMES]
  const attrs = requireAttrs(doc, names, label)
  const section = document.createElement('section')
  section.append(heading(3, label))
  section.append(para(link(href, `${label} — full API reference`)))
  section.append(renderApiTable(attrs, 4))
  return section
}

content.append(surfaceSection('ui-super-shell', 'ui-super-shell', './super-shell.html', parseDoc(shellMd)))
content.append(surfaceSection('ui-surface-host', 'ui-surface-host', './surface-host-doc.html', loadSurfaceHostDoc()))
content.append(surfaceSection('ui-drill', 'ui-drill', './drill-doc.html', loadDrillDoc()))
content.append(surfaceSection('ui-router-outlet', 'ui-router-outlet', './router-doc.html', loadRouterOutletDoc()))

content.append(
  para(
    'A naming note: all four descriptors’ ',
    code('attributes[].name'),
    ' fields carry the camelCase PROP name (',
    code('viewTransitions'),
    ') plus an explicit ',
    code('attribute:'),
    ' override with the kebab-case DOM attribute (',
    code('view-transitions'),
    ') — uniform since GH #1079, when super-shell.md adopted its siblings’ majority grammar.',
  ),
)

// ════════════════ 4 · Named-morph proof (GH #1005) ════════════════
content.append(heading(2, 'Named-morph proof — real engines, GH #1005'))
content.append(
  para(
    'ADR-0183’s 2026-08-16 amendment shipped the named-morph convention browser-UNMEASURED; the 2026-08-16 ' +
      'appendix closed that line. ',
    code('super-shell-named-morph.browser.test.ts'),
    ' (',
    code('packages/agent-ui/app/src/controls/super-shell/'),
    ') mounts a wide-mode, both-opt-ins-on ',
    code('ui-super-shell'),
    ' with a segmented pane, intercepts the REAL ',
    code('document.startViewTransition'),
    ', drives a real pane-tab click (the segment swap), and awaits ',
    code('ready'),
    '. Measured on this repo’s pinned Playwright build (1.61.1):',
  ),
)
const proofList = document.createElement('ul')
for (const line of [
  'Chromium: document.startViewTransition present — the transition path ran genuinely (not the sync fallback); ready resolved with no rejection.',
  'WebKit: document.startViewTransition present — same result, ready resolved clean (this harness’s bundled WebKit build sits on the supporting side of ADR-0183’s version-gate concern; the graceful sync-fallback branch the same test file also carries went unexercised here, not unwritten).',
  'The pairing-law invariant (at most one PAINTED element may carry a given view-transition-name) held both immediately before and immediately after the swap — asserted directly.',
] as const) {
  const li = document.createElement('li')
  li.textContent = line
  proofList.append(li)
}
content.append(proofList)

// ════════════════ 5 · Live demo — toggling the opt-in on a real ui-drill ════════════════
content.append(heading(2, 'Live demo — the opt-in, toggled on a real ui-drill'))
content.append(
  pageLead(
    'A real ',
    code('<ui-drill>'),
    ' with the switch below wired directly to its ',
    code('view-transitions'),
    ' attribute — off by default (drill.md’s own law). Drill into “Appearance” to see the swap; whether it ' +
      'actually cross-fades depends on YOUR browser and motion settings, honestly, not on this page.',
  ),
)

const text = (s: string): Text => document.createTextNode(s)
const drill = el('ui-drill', { 'aria-label': 'Motion demo' }, [
  el('ui-drill-panel', { key: 'root', heading: 'Settings' }, [
    el('ul', { style: 'margin:0; padding-inline-start:1.25rem' }, [
      el('li', {}, [el('button', { 'data-role': 'drill-trigger', 'data-drill-key': 'appearance' }, [text('Appearance')])]),
    ]),
  ]),
  el('ui-drill-panel', { key: 'appearance', parent: 'root', heading: 'Appearance' }, [
    el('p', { style: 'margin:0' }, [text('This panel swap runs through the SAME withViewTransition seam every surface above uses.')]),
  ]),
]) as HTMLElement & { viewTransitions?: boolean }

const toggle = el('ui-switch', { 'aria-label': 'view-transitions' }) as HTMLElement & { checked?: boolean }
const availability = document.createElement('p')
function renderAvailability(): void {
  const enabled = Boolean(toggle.checked)
  drill.toggleAttribute('view-transitions', enabled)
  const willRun = enabled && viewTransitionAvailable()
  availability.textContent =
    `view-transitions=${String(enabled)} · viewTransitionAvailable() (this browser/motion-setting, right now) = ${String(viewTransitionAvailable())} ` +
    `⇒ this drill's next swap will ${willRun ? 'RUN a real startViewTransition' : 'run the synchronous fallback (byte-identical to before ADR-0183)'}.`
}
toggle.addEventListener('change', renderAvailability)
renderAvailability()

content.append(
  exampleSection(
    'ui-drill — view-transitions opt-in',
    el('div', { style: 'display:flex; align-items:center; gap:0.5rem; margin-block-end:0.75rem' }, [
      el('label', { style: 'display:flex; align-items:center; gap:0.5rem' }, [toggle, text('view-transitions')]),
    ]),
    drill,
    availability,
  ),
)
