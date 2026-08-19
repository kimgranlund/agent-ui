// site/pages/avatar-demo.ts — the ui-avatar demo (the ratified pattern `demo`; pairs with the avatar-doc.html
// API page). Mounts the REAL Indicator-class identity mark in a believable team roster and shows every link of
// its fallback chain in situ (image → initials → glyph, avatar.md), a stacked "assignees" cluster, every [size]
// tier, and the `label` override. ui-avatar is display-only — it emits nothing (avatar.md events: []), so this
// page has no event log; the presence dot beside each roster row is PAGE chrome layered next to the control,
// not an avatar prop — stated honestly rather than faked as API.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css' // shared demo chrome (section spacing)
import { captioned, el, exampleSection } from '../lib/specimens.ts'

const { content } = mountPage({
  title: 'ui-avatar — demo',
  intro:
    'The identity mark, live in a team roster. Each row is a real ui-avatar walking its fallback chain — a ' +
    'portrait, a broken image falling back to initials, initials-only, and the generic glyph — beside a ' +
    'page-authored presence dot. Display-only: no events, no keyboard. The API table is on the ui-avatar API page.',
})

const text = (s: string): Text => document.createTextNode(s)
const code = (s: string): HTMLElement => el('code', {}, [text(s)])

// Self-contained inline-SVG portraits — no network fetch, deterministic in every engine and test run.
const portrait = (bg: string): string =>
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="${bg}"/>` +
    '<circle cx="32" cy="24" r="12" fill="#fff"/><rect x="12" y="40" width="40" height="20" rx="10" fill="#fff"/></svg>',
  )
// An intentionally malformed data URI — decodes to nothing with no network round-trip, so the link 1 → 2
// fallback demonstrates honestly rather than depending on a flaky live URL.
const BROKEN_SRC = 'data:image/png;base64,not-a-real-image'

type Presence = 'online' | 'away' | 'offline'
interface Member { identity: string; role: string; src?: string; presence: Presence }

const TEAM: readonly Member[] = [
  { identity: 'Priya Natarajan', role: 'Engineering lead', src: portrait('#6750a4'), presence: 'online' },
  { identity: 'Marcus Oyelaran', role: 'Design', src: portrait('#386a20'), presence: 'away' },
  { identity: 'Ingrid Sørensen', role: 'Product', src: BROKEN_SRC, presence: 'online' }, // image 404s → initials
  { identity: 'Tomás Herrera', role: 'Support', presence: 'offline' }, // no portrait → initials
  { identity: '', role: 'Pending invite', presence: 'offline' }, // no identity → glyph
]

const PRESENCE_COLOR: Record<Presence, string> = {
  online: 'var(--md-sys-color-primary)',
  away: 'var(--md-sys-color-tertiary)',
  offline: 'var(--md-sys-color-outline)',
}

const avatar = (attrs: Record<string, string>): HTMLElement => el('ui-avatar', attrs)

// Page chrome — a presence dot beside the mark (NOT an avatar prop; ui-avatar has no presence API).
const presenceDot = (presence: Presence): HTMLElement =>
  el('span', {
    'aria-label': presence,
    role: 'img',
    style: `display:inline-block; inline-size:0.6rem; block-size:0.6rem; border-radius:50%; background:${PRESENCE_COLOR[presence]};`,
  })

// ── the roster — one row per member: avatar · name/role · presence ──────────────────────────────────────
const rosterRow = (m: Member): HTMLElement =>
  el('li', { style: 'display:grid; grid-template-columns:auto 1fr auto; gap:0.75rem; align-items:center; padding:0.4rem 0;' }, [
    avatar(m.src ? { src: m.src, identity: m.identity } : { identity: m.identity }),
    el('div', {}, [
      el('div', {}, [text(m.identity || 'Invited teammate')]),
      el('div', { class: 'demo-caption' }, [text(m.role)]),
    ]),
    el('div', { style: 'display:flex; gap:0.4rem; align-items:center;' }, [
      presenceDot(m.presence),
      el('span', { class: 'demo-caption' }, [text(m.presence)]),
    ]),
  ])
const roster = el('ul', { style: 'list-style:none; margin:0; padding:0; max-inline-size:28rem;', 'aria-label': 'Team roster' },
  TEAM.map(rosterRow))
const rosterNote = el('p', {}, [
  text('Row 3 has a portrait URL that fails to decode — the control drops to initials by itself. Row 4 has no '),
  code('src'), text(' at all. Row 5 has neither '), code('src'), text(' nor '), code('identity'),
  text(' and renders the generic person glyph. The presence dot is page chrome beside the mark, not an avatar prop.'),
])

// ── assignees cluster — overlapping avatars, the "who is on this issue" pattern ────────────────────────────
const cluster = el('div', { style: 'display:flex; align-items:center;', 'aria-label': 'Assignees' },
  TEAM.slice(0, 4).map((m, i) =>
    el('span', { style: i === 0 ? '' : 'margin-inline-start:-0.5rem;' }, [
      avatar({ ...(m.src ? { src: m.src } : {}), identity: m.identity, size: 'sm' }),
    ])),
)
cluster.append(el('span', { class: 'demo-caption', style: 'margin-inline-start:0.5rem;' }, [text('4 assignees')]))

// ── sizes — every [size] tier off the widget-box ramp ────────────────────────────────────────────────────
const sizeRow = el('div', { style: 'display:flex; gap:1rem; align-items:center; flex-wrap:wrap;' }, [
  captioned('size="sm"', avatar({ src: portrait('#6750a4'), identity: 'Priya Natarajan', size: 'sm' })),
  captioned('size="md"', avatar({ src: portrait('#6750a4'), identity: 'Priya Natarajan', size: 'md' })),
  captioned('size="lg"', avatar({ src: portrait('#6750a4'), identity: 'Priya Natarajan', size: 'lg' })),
])

// ── label override — an accessible name that differs from the identity the initials derive from ─────────
const labelled = el('div', { style: 'display:flex; gap:1rem; align-items:center; flex-wrap:wrap;' }, [
  captioned('identity="Priya Natarajan"', avatar({ identity: 'Priya Natarajan' })),
  captioned('… label="Priya (you)"', avatar({ identity: 'Priya Natarajan', label: 'Priya (you)' })),
])
const labelNote = el('p', {}, [
  code('identity'), text(' feeds the initials and is NOT announced (the avatar is decorative beside the visible ' +
    'name); a non-empty '), code('label'),
  text(' is the a11y escape hatch — the avatar becomes a named role="img" when it stands alone.'),
])

content.append(
  exampleSection('Team roster', roster, rosterNote),
  exampleSection('Assignees cluster', cluster),
  exampleSection('Sizes', sizeRow),
  exampleSection('Label override', labelled, labelNote),
)
