// site/pages/text-demo.ts — the ui-text demo (the ratified display-tier `demo`, GH #1279 batch): a REAL
// article typeset entirely in <ui-text> — one specimen per variant (kicker/overline/display/headline/title/
// lead/body/label/quote) with realistic copy, every heading STAMPED via `as` (so the page outline is real),
// a gated `as="a"` link, and the two orthogonal intents (`truncate` / `emphasis`) in the contexts they were
// built for. Pairs with the descriptor-derived API doc, site/pages/text-doc.ts (the 27-cell variant×size
// matrix lives THERE — this page shows the roles doing their editorial job, not the grid). ui-text emits no
// events (display leaf), so there is no event log — the article itself is the proof.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css' // shared demo chrome (section spacing + .demo-figure/.demo-caption)
import { applyDemoWidth, captioned, el, exampleSection } from '../lib/specimens.ts'

const { content } = mountPage({
  title: 'ui-text — demo',
  intro:
    'The typographic leaf, doing its editorial job: a release-notes article set entirely in ui-text — kicker, ' +
    'overline, display, headline, title, lead, body, label and quote — every heading a REAL heading through ' +
    'the `as` stamp, the link a REAL gated `<a href>`. Below the article: `truncate` in a card title that ' +
    'cannot fit, and `emphasis` used the sole-signifier-safe way. The API table is on the ui-text API page.',
})

const text = (s: string): Text => document.createTextNode(s)

/** t — one <ui-text> at a role, with optional semantics + extra attributes; the article is a stack of these. */
function t(variant: string, copy: string, attrs: Record<string, string> = {}): HTMLElement {
  return el('ui-text', { variant, ...attrs }, [text(copy)])
}

// ── the article — a believable product changelog entry, one role per editorial job ────────────────────────
const article = el('ui-column', { gap: 'sm', align: 'stretch' }, [
  t('kicker', 'Release notes', { as: 'p' }), // uppercase, tracked — the section eyebrow
  t('display', 'Receipts, ready to ship', { as: 'h1', size: 'sm' }), // the one display-role line on the page
  t('lead',
    'Version 1.6 adds the key–value receipt primitive, a hardened description-list codec, and the composition ' +
    'patterns hub — the three pieces a confirm step needs before an agent commits a booking.',
    { as: 'p' }),
  t('overline', 'What changed', { as: 'p' }), // uppercase, quieter than kicker — the sub-eyebrow
  t('headline', 'A receipt is data, not children', { as: 'h2', size: 'sm' }),
  t('body',
    'ui-description-list renders a record whole: per row a label on the secondary plane and its value ' +
    'adjacent at a fixed pair gap. Rows are a hardened JSON prop — an absent attribute or malformed JSON ' +
    'yields an empty list, never a throw — and a field with no value never renders at all, by construction.',
    { as: 'p' }),
  t('title', 'Why omission is a law, not a hint', { as: 'h3' }),
  t('body',
    'A booking flow gathers fields it may never fill: a late-checkout request, a dietary note, a promo code. ' +
    'Rendering an empty row teaches the reader to scan past blanks; dropping it keeps the receipt honest and ' +
    'the eye on what was actually decided.',
    { as: 'p' }),
  t('quote',
    'The receipt should read like the confirmation email you wish you had received — every line a decision, ' +
    'no line a placeholder.',
    { as: 'blockquote' }),
  t('label', 'Filed under: display leaves · A2UI catalog · confirm step', { as: 'p' }),
  el('ui-text', { variant: 'body', as: 'p' }, [
    text('Read the decision record on the '),
    el('ui-text', { variant: 'body', as: 'a', href: 'https://github.com/nonoun/agent-ui' }, [text('agent-ui repository')]),
    text(' — the link is a real, gated '),
    el('code', {}, [text('<a href>')]),
    text(': https/http/mailto pass, anything else is denied and stamps an inert placeholder (ADR-0114).'),
  ]),
])
applyDemoWidth(article, 'min(100%, 44rem)') // a reading measure — long lines are the enemy of body copy

const articleNote = el('p', {}, [
  text('Every heading above is a real '), el('code', {}, [text('<h1>')]), text('–'), el('code', {}, [text('<h3>')]),
  text(' (the page outline is honest), the pull-quote a real '), el('code', {}, [text('<blockquote>')]),
  text('. variant/size are VISUAL only — the '), el('code', {}, [text('as')]),
  text(' axis alone carries semantics (ADR-0078 cl.4).'),
])

// ── truncate — a card title that cannot fit its column; the full value survives in `title` ───────────────
const truncated = t('title', 'Quarterly business review — EMEA field operations, consolidated draft v3 (final)', {
  as: 'h3', truncate: '',
})
applyDemoWidth(truncated, '18rem')
const truncateFigure = captioned('truncate — single-line + ellipsis inside an 18rem card title; hover for the full text', truncated)

// ── emphasis — the sole-signifier-safe way: the label ALSO carries the distinction ────────────────────────
const emphasisRow = el('ui-row', { gap: 'md', align: 'baseline' }, [
  el('ui-text', { variant: 'body' }, [text('Status: ')]),
  el('ui-text', { variant: 'body', emphasis: '' }, [text('Confirmed')]),
  el('ui-text', { variant: 'body' }, [text('· Assignee: ')]),
  el('ui-text', { variant: 'body', emphasis: '' }, [text('Priya Natarajan')]),
])
const emphasisFigure = captioned('emphasis — weight 700 on the value only; the "Status:" / "Assignee:" labels carry the meaning too', emphasisRow)

const emphasisNote = el('p', {}, [
  text('Weight is not announced by assistive tech, so '), el('code', {}, [text('emphasis')]),
  text(' is never the ONLY carrier of a distinction (ADR-0109) — the surrounding label does the semantic work; the bold merely helps the eye land.'),
])

content.append(
  exampleSection('The article — every role in its editorial job', article, articleNote),
  exampleSection('Truncate', truncateFigure),
  exampleSection('Emphasis', emphasisFigure, emphasisNote),
)
