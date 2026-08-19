// site/pages/badge-demo.ts — the ui-badge demo (the ratified display-tier `demo`, GH #1279 batch): the REAL
// intent-keyed status token in the list it was built for — a deployment/CI run list where each row carries a
// SHORT status or count badge (a badge is a token, never a headline — the GH #1279 law), plus a bound-status
// specimen (buttons write `intent`/`label` as PROPERTIES at runtime — the bound-data lane — incl. an
// out-of-enum write hardened back to neutral, SPEC-R11 AC2) and the count-pill / empty-label floor. Pairs with the descriptor-derived API doc,
// site/pages/badge-doc.ts (the parsed-enum intent strip lives THERE). ui-badge emits no events (display
// leaf) — the runtime status specimen logs the WRITES this page makes, so the hardening is visibly proven.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css' // shared demo chrome (.event-log + section spacing)
import { applyDemoWidth, captioned, el, exampleSection, uiButton } from '../lib/specimens.ts'
import { whenFlushed } from '@agent-ui/components' // the kernel's microtask flush — effects (incl. the hardening) settle before the log reads

const { content } = mountPage({
  title: 'ui-badge — demo',
  intro:
    'The status token in its natural habitat: a run list where every row ends in a SHORT badge — a state ' +
    '(Passing, Failing), a count (3 warnings) — never a sentence. Below it, a live status write re-points one ' +
    "badge's intent at runtime (an out-of-enum value snaps back to neutral), and the count-pill / empty-label " +
    'floor. The API table is on the ui-badge API page.',
})

const text = (s: string): Text => document.createTextNode(s)

/** badge — a real <ui-badge label intent>; the label is a TOKEN (≤ ~2 words or a count), by law. */
function badge(label: string, intent: string): HTMLElement {
  return el('ui-badge', { label, intent })
}

// ── the run list — a believable CI/deploy view; one row = name + meta + a short status/count badge ────────
const runs: readonly [name: string, meta: string, badges: readonly [string, string][]][] = [
  ['main · deploy-site', '2 min ago · 1m 42s', [['Passing', 'success']]],
  ['pr-1279 · demo-tabs', '9 min ago · 3m 05s', [['Failing', 'danger'], ['2 flaky', 'warning']]],
  ['pr-1264 · highlight-fix', '14 min ago · 2m 51s', [['Passing', 'success'], ['3 warnings', 'warning']]],
  ['release/1.6 · package', 'queued', [['Pending', 'info']]],
  ['nightly · browser-shards', '6 h ago · 18m 20s', [['Passing', 'success'], ['6 shards', 'neutral']]],
  ['docs · llms-txt', '1 d ago · 0m 40s', [['Skipped', 'neutral']]],
]
const runList = el('ui-list', { gap: 'xs' }, runs.map(([name, meta, badges]) =>
  el('ui-row', { gap: 'md', align: 'center', justify: 'between' }, [
    el('ui-column', { gap: 'none' }, [
      el('ui-text', { variant: 'body' }, [text(name)]),
      el('ui-text', { variant: 'label', size: 'sm' }, [text(meta)]),
    ]),
    el('ui-row', { gap: 'xs', align: 'center' }, badges.map(([label, intent]) => badge(label, intent))),
  ]),
))
applyDemoWidth(runList, 'min(100%, 36rem)')

const listNote = el('p', {}, [
  text('Every badge is a token: one state word or a count. Colour never travels alone — each non-neutral intent draws its own pairwise-distinct glyph (tick / cross / triangle / disc, ADR-0057); '),
  el('code', {}, [text('neutral')]), text(' draws none, absence being its signifier.'),
])

// ── a bound status — a real runtime `intent` write, incl. the out-of-enum hardening path ───────────────────
const live = badge('Queued', 'info')
const log = document.createElement('ul')
log.className = 'event-log'
log.setAttribute('aria-live', 'polite')
let seq = 0
async function write(intent: string, label: string): Promise<void> {
  // The PROPERTY path — the same lane an A2UI bound `intent` write takes (not setAttribute): the codec's snap
  // covers only the attribute path, so the connected() hardening effect is what proves SPEC-R11 AC2 here.
  const host = live as HTMLElement & { intent: string; label: string }
  host.intent = intent
  host.label = label
  await whenFlushed() // the hardening effect + attribute reflection run on the kernel's microtask flush
  seq += 1
  const line = document.createElement('li')
  const settled = live.getAttribute('intent') // reflected — what the token actually shows
  line.textContent = `#${String(seq).padStart(2, '0')}  intent ← ${JSON.stringify(intent)}  →  rendered intent=${JSON.stringify(settled)}  label=${JSON.stringify(label)}`
  log.append(line)
  log.scrollTop = log.scrollHeight
}
const writes = el('ui-row', { gap: 'sm', align: 'center', wrap: '' }, [
  ['info', 'Queued'], ['warning', 'Retrying'], ['success', 'Passing'], ['danger', 'Failing'], ['neutral', 'Skipped'],
].map(([intent, label]) => {
  const b = uiButton(`${intent} · ${label}`, 'soft')
  b.addEventListener('click', () => { void write(intent, label) })
  return b
}))
const garbage = uiButton('bound garbage: "purple"', 'ghost')
garbage.addEventListener('click', () => { void write('purple', 'Unknown') })
writes.append(garbage)

const liveNote = el('p', {}, [
  text('Each button writes the '), el('code', {}, [text('intent')]), text(' + '), el('code', {}, [text('label')]),
  text(' PROPERTIES (the bound-data lane). The last button simulates a bad bind — '), el('code', {}, [text('"purple"')]),
  text(' is not in the enum, so the connected() hardening snaps the rendered intent back to '), el('code', {}, [text('neutral')]),
  text(' (SPEC-R11 AC2). The log lists what was written vs. what the token actually renders.'),
])

// ── count pills + the empty-label floor ────────────────────────────────────────────────────────────────────
const counts = el('ui-row', { gap: 'md', align: 'center' }, [
  captioned('label="3"', badge('3', 'info')),
  captioned('label="12"', badge('12', 'danger')),
  captioned('label="99+"', badge('99+', 'warning')),
  captioned('label="" — the min-inline-size floor: a dot, never a sliver', badge('', 'success')),
  captioned('label="" intent="neutral" — a plain dot', badge('', 'neutral')),
])

content.append(
  exampleSection('A run list — status + count tokens', runList, listNote),
  exampleSection('A bound status, written live', el('ui-row', { gap: 'md', align: 'center' }, [live]), writes, liveNote),
  exampleSection('write log', log),
  exampleSection('Count pills + the empty-label floor', counts),
)
