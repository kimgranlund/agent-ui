// site/pages/breadcrumb-demo.ts — the ui-breadcrumb interaction demo (GH #1515, the frozen design intake
// `.claude/docs/spec/breadcrumb.intake.md` §4/§7 slices S1+S2). Mounts the REAL control across four real
// habitats: a realistic multi-level path, a slotted-separator variant, a `collapse="menu"` fold deep enough
// to actually fold crumbs behind the composed overflow ui-menu, and the `inline` sizing opt-out beside the
// fill-by-default posture. Every crumb is a REAL `<a href>` — a genuine click would navigate away from this
// demo page, so ONE delegated listener (the file's own honesty seam) intercepts every crumb click at the
// page level and logs the intent instead of leaving; this is demo plumbing, not a `ui-breadcrumb` event —
// the control itself emits none of its own (breadcrumb.md `events: []`). The control owns all anatomy/
// collapse/relay mechanics (breadcrumb.ts/.css); this page only stages it and logs.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css' // shared demo chrome (.event-log + section spacing)
import { specimenRow } from '../lib/doc-page.ts'
import { captioned, el, exampleSection } from '../lib/specimens.ts'

const { content } = mountPage({
  title: 'ui-breadcrumb — demo',
  intro: 'ui-breadcrumb, live. A realistic path, a slotted-separator variant, a collapse="menu" fold deep ' +
    'enough to actually fold crumbs behind a composed overflow menu, and the inline sizing opt-out. Every ' +
    'crumb click is logged below (a real <a> would otherwise navigate away from this demo). The API table ' +
    'is on the ui-breadcrumb API page.',
})

const text = (s: string): Text => document.createTextNode(s)
const code = (s: string): HTMLElement => el('code', {}, [text(s)])

// ── event log — demo-only click interception (the file banner's honesty seam) ───────────────────────────────
const log = document.createElement('ul')
log.className = 'event-log'
log.setAttribute('aria-live', 'polite')
let seq = 0
const record = (kind: string, detail: unknown): void => {
  seq += 1
  const line = document.createElement('li')
  line.textContent = `#${String(seq).padStart(2, '0')}  ${kind}  detail=${JSON.stringify(detail)}`
  log.append(line)
  log.scrollTop = log.scrollHeight
}

// ONE delegated interceptor for every crumb anchor on this page: a real user click on a visible crumb, OR the
// control's OWN commit relay (`.click()` on a hidden folded crumb after a menu selection) both bubble a real
// click through the DOM tree — display:none does not stop bubbling, only painting (breadcrumb.ts's own
// documented mechanism). preventDefault stops navigation; the log proves which crumb actually fired.
content.addEventListener('click', (event) => {
  const anchor = (event.target as Element | null)?.closest?.('a')
  if (!anchor) return
  event.preventDefault()
  record('navigate', { href: anchor.getAttribute('href'), label: anchor.textContent })
})

// ── a realistic multi-level path ──────────────────────────────────────────────────────────────────────────
const standalone = el('ui-breadcrumb', { label: 'Breadcrumb' }, [
  el('a', { href: '/' }, [text('Home')]),
  el('a', { href: '/docs' }, [text('Docs')]),
  el('a', { href: '/docs/components' }, [text('Components')]),
  el('span', {}, [text('Breadcrumb')]),
])

// ── a slotted-separator variant — the per-instance template, cloned per gap ─────────────────────────────────
const withSeparator = el('ui-breadcrumb', { label: 'Breadcrumb' }, [
  el('a', { href: '/' }, [text('Home')]),
  el('a', { href: '/settings' }, [text('Settings')]),
  el('span', {}, [text('Profile')]),
  el('span', { slot: 'separator' }, [text('→')]),
])
const separatorNote = el('p', {}, [
  text('The '), code('<span slot="separator">→</span>'), text(' child is a per-instance TEMPLATE — the ' +
    'control clones it into every gap; unslotted (the path above), it falls back to a control-created '),
  code('/'), text(' glyph.'),
])

// ── collapse="menu" — 6 crumbs, deep enough that the default collapse-keep-trailing=2 actually folds a
// non-empty middle (pin Home + the last 2; fold the 3 in between behind the composed overflow ui-menu) ───────
const collapsed = el('ui-breadcrumb', { label: 'Breadcrumb', collapse: 'menu' }, [
  el('a', { href: '/' }, [text('Home')]),
  el('a', { href: '/a' }, [text('Section A')]),
  el('a', { href: '/a/b' }, [text('Subsection B')]),
  el('a', { href: '/a/b/c' }, [text('Subsection C')]),
  el('a', { href: '/a/b/c/d' }, [text('Subsection D')]),
  el('span', {}, [text('Current page')]),
])
collapsed.id = 'breadcrumb-collapse-demo' // the page-level browser test's stable hook
const collapsedNote = el('p', {}, [
  text('Six crumbs, '), code('collapse="menu"'), text(' (keep-trailing defaults to 2): Home stays pinned, ' +
    'the last two crumbs stay pinned, and the three in between fold behind the '), code('dots-three'),
  text(' overflow trigger. Selecting a folded row in the opened menu RELAYS activation to the real hidden ' +
    'crumb (never reparented) — logged below like any other crumb click. The fold is author-driven, ' +
    'viewport-independent (no ResizeObserver): a narrow-viewport layout is simply the author choosing '),
  code('collapse="menu"'), text(' up front.'),
])

// ── states — the `inline` sizing opt-out beside the fill-by-default posture (ADR-0223) ──────────────────────
const fillCrumb = el('ui-breadcrumb', { label: 'Breadcrumb' }, [
  el('a', { href: '/' }, [text('Home')]),
  el('span', {}, [text('Fill (default)')]),
])
const inlineCrumb = el('ui-breadcrumb', { label: 'Breadcrumb', inline: '' }, [
  el('a', { href: '/' }, [text('Home')]),
  el('span', {}, [text('Inline (hug)')]),
])
const states = specimenRow([
  captioned('fill (default, block-level)', fillCrumb),
  captioned('inline (hug, inline-flex)', inlineCrumb),
])

content.append(
  exampleSection('A realistic path', standalone),
  exampleSection('Slotted separator', withSeparator, separatorNote),
  exampleSection('collapse="menu" — a deep trail folds behind an overflow menu', collapsed, collapsedNote),
  exampleSection('States — inline vs fill', states),
  exampleSection('Crumb-click event log', log),
)
