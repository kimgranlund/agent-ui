// site/pages/accessibility.ts — the fleet accessibility conventions guide (T6, GH #1044). Every claim below
// cites its owning source by file:path (or ADR/reference-doc ID) rather than restating it — CLAUDE.md's
// "Conventions (non-obvious only)" section (ARIA via ElementInternals, never host attributes; no native form
// elements; light DOM), `.claude/docs/references/interaction-states.md` (the focus ring + the disabled a11y
// contract + reduced motion), and the real trait/control source for roving focus, landmarks, live regions, and
// labelling. This is prose over a soft (non-mechanical) fact set — no descriptor/enum to derive a table from —
// so the T6 discipline applies (docs-author's method §5: cite the canonical source, keep hand-authored content
// minimal). The two live specimens at the bottom mount the REAL ui-field/ui-text-field and ui-toast-region
// controls, not a mock.
import { mountPage, pageLead } from './_page.ts' // FIRST — foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css' // shared demo chrome (.event-log + section spacing)
import './accessibility.css'
import type { UIToastRegionElement } from '@agent-ui/components/components'
import { heading } from '../lib/doc-page.ts'
import { codeBlock } from '../lib/code-block.ts'
import { el, exampleSection, uiButton } from '../lib/specimens.ts'

const { content } = mountPage({
  title: 'Accessibility conventions',
  intro:
    'How the fleet exposes roles and state, manages focus, and announces change — the conventions every ' +
    'control follows, cited to their source rather than restated, plus one small live example.',
})

const text = (s: string): Text => document.createTextNode(s)
const code = (s: string): HTMLElement => el('code', {}, [text(s)])
const p = (...parts: (string | Node)[]): HTMLElement =>
  el('p', {}, parts.map((part) => (typeof part === 'string' ? text(part) : part)))

content.append(
  pageLead(
    'Three load-bearing rules, stated once in the repo’s CLAUDE.md "Conventions" section and never repeated ' +
      'here: components are light-DOM by default; ARIA rides ',
    code('ElementInternals'),
    ', never a host attribute; and there are no native form elements underneath a control — a ui-text-field is ' +
      'a real, form-associated custom element, not an <input> wrapper (the same two-sentence framing ',
    code('getting-started.html'),
    ' opens with). What follows is how that shows up: roles/state, focus, landmarks, live regions, motion, ' +
      'and labelling — each cited to its owning source.',
  ),
)

// ── 1 · roles + state — ElementInternals, never a host attribute ────────────────────────────────────────────
content.append(heading(2, '1 · Roles and state — via ElementInternals only'))
content.append(
  p(
    'A control sets its own role and AX state on ',
    code('this.internals'),
    ' (a protected accessor a subclass alone can reach) — never ',
    code('setAttribute(\'role\', …)'),
    ' or ',
    code('setAttribute(\'aria-*\', …)'),
    ' on the host. The disabled contract is the canonical worked example (',
    code('.claude/docs/references/interaction-states.md'),
    ' §3): a reusable ',
    code('tabbable'),
    ' trait (',
    code('packages/agent-ui/components/src/traits/tabbable.ts'),
    ') owns focusability — ',
    code('tabindex=0'),
    ' by default, removed (not set to ',
    code('-1'),
    ') when disabled, native-parity — while the AX announcement is a control-level effect, because ',
    code('internals'),
    ' is protected and a trait only ever receives ',
    code('host: UIElement'),
    ':',
  ),
)
content.append(
  codeBlock(
    [
      "this.internals.role = '{role}'",
      'tabbable(this,       { disabled: () => this.disabled })',
      'pressActivation(this, { disabled: () => this.disabled })',
      'this.effect(() => { this.internals.ariaDisabled = this.disabled ? \'true\' : null })',
    ].join('\n'),
    'ts',
  ),
)
content.append(
  p(
    'The split is the reusable lesson: focusability recurs on every interactive control → a trait; ',
    code('ariaDisabled'),
    ' cannot be a trait (protected ',
    code('internals'),
    ') → a one-line control-level effect any control with a ',
    code('disabled'),
    ' prop copies (interaction-states.md §3). A ',
    code('UIFormElement'),
    '-based control (ui-text-field, …) is form-associated and gains a real platform ',
    code('disabled'),
    ' state instead — confirm the disabled channel per family before copying the ',
    code('UIElement'),
    ' shape onto a form control.',
  ),
)

// ── 2 · focus management ─────────────────────────────────────────────────────────────────────────────────────
content.append(heading(2, '2 · Focus management'))
content.append(
  p(
    'The keyboard focus ring is a fleet CONSTANT, not a per-control opinion (interaction-states.md §2): every ' +
      'control’s ',
    code('@scope'),
    ' block applies the identical rule, reading three shared tokens from ',
    code('@agent-ui/shared'),
    ':',
  ),
)
content.append(
  codeBlock(
    [
      ':scope:focus-visible {',
      '  outline: var(--ui-focus-ring-width) solid var(--md-sys-color-focus-ring);',
      '  outline-offset: var(--ui-focus-ring-offset);',
      '}',
    ].join('\n'),
    'css',
  ),
)
content.append(
  p(
    code('outline'),
    ' (not ',
    code('box-shadow'),
    ') so it paints outside the box without affecting layout and survives ',
    code('forced-colors'),
    '; ',
    code(':focus-visible'),
    ' (not ',
    code(':focus'),
    ') so the ring is keyboard-only — no ring on a mouse click.',
  ),
)
content.append(heading(3, 'Roving tabindex'))
content.append(
  p(
    'A set of items with one moving focus stop (a nav rail, a tablist, a listbox) uses the shared ',
    code('rovingFocus'),
    ' trait (',
    code('packages/agent-ui/components/src/traits/roving-focus.ts'),
    '): exactly one item holds ',
    code('tabindex=0'),
    ', the rest ',
    code('-1'),
    '; Arrow keys (+ Home/End, + optional type-ahead) move the roving index AND transfer real focus; ',
    code('loop'),
    ' wraps at the ends. Two real consumers on this site: ',
    code('ui-nav-rail'),
    ' (', code('role="tablist"'), ' when every item is bare, ', code('role="navigation"'), ' otherwise — ',
    code('nav-rail.ts:158'),
    ') and ',
    code('ui-tabs'),
    ' (the trait’s original extraction site, ',
    code('tabs.ts'),
    ').',
  ),
)
content.append(
  p(
    'Where an item can be REORDERED rather than merely focused, a pointer-drag mechanism alone fails WCAG 2.2 ' +
      'SC 2.5.7 (Dragging Movements) — the reusable ',
    code('list-reorder'),
    ' trait (',
    code('packages/agent-ui/components/src/traits/list-reorder.ts'),
    ') pairs pointer-capture drag with a keyboard fallback: Up/Down while a handle is armed and focused ' +
      'commits the same move as a drag, converging on one ',
    code('onCommit(from, to)'),
    ' + one ',
    code('change'),
    ' event either way. The trait writes no ARIA of its own (the fleet’s ElementInternals-only law again) — ' +
      'the accessible story is the consumer’s own labelled handle, e.g. a real ',
    code('aria-label="Move X up"'),
    ' button.',
  ),
)

// ── 3 · landmarks in the shells ──────────────────────────────────────────────────────────────────────────────
content.append(heading(2, '3 · Landmarks in the app-surface shells'))
content.append(
  p(
    'The same ',
    code('this.internals.role'),
    ' mechanism (§1) is how a shell composes real ARIA landmarks — no host attribute, ever:',
  ),
)
{
  const rows: readonly { control: string; role: string; source: string }[] = [
    { control: 'ui-nav-rail', role: 'navigation (tablist when every item is bare)', source: 'nav-rail.ts:158' },
    { control: 'ui-pagination', role: 'navigation', source: 'pagination.ts:44' },
    { control: 'ui-drill', role: 'group (a labelled navigation region)', source: 'drill.ts:86' },
    { control: 'ui-drill-panel', role: 'region', source: 'drill-panel.ts:45' },
    { control: 'ui-surface-host', role: 'region', source: 'surface-host.ts:155' },
  ]
  const table = document.createElement('table')
  const thead = document.createElement('thead')
  const headRow = document.createElement('tr')
  for (const label of ['Control', 'Role', 'Source']) {
    const th = document.createElement('th')
    th.textContent = label
    headRow.append(th)
  }
  thead.append(headRow)
  const tbody = document.createElement('tbody')
  for (const row of rows) {
    const tr = document.createElement('tr')
    const c1 = document.createElement('td')
    c1.append(code(row.control))
    const c2 = document.createElement('td')
    c2.textContent = row.role
    const c3 = document.createElement('td')
    c3.append(code(row.source))
    tr.append(c1, c2, c3)
    tbody.append(tr)
  }
  table.append(thead, tbody)
  content.append(table)
}

// ── 4 · live regions ─────────────────────────────────────────────────────────────────────────────────────────
content.append(heading(2, '4 · Live regions'))
content.append(
  p(
    code('ui-status-stream'),
    ' and ',
    code('ui-app/conversation-dialog'),
    ' both set ',
    code("internals.role = 'log'"),
    ' (a POLITE live region — ARIA’s ',
    code('role=log'),
    ' carries an implicit ',
    code('aria-live="polite"'),
    ') — ',
    code('status-stream.ts:366'),
    ' and ',
    code('conversation-dialog.ts:45'),
    '. ',
    code('ui-toast'),
    ' sets ',
    code('role="status"'),
    ' in its CONSTRUCTOR, not ',
    code('connected()'),
    ' — the live-region semantics must exist BEFORE the element is inserted, since content present at append ' +
      'time is what announces (',
    code('toast.ts'),
    ', SPEC-R15 AC2); ',
    code('connected()'),
    ' may later flip ',
    code('status'),
    ' → ',
    code('alert'),
    ' for an urgent toast.',
  ),
)
content.append(
  p(
    'A soft-drift note, not a claim this page makes structural: ',
    code('ui-combo-box'),
    '’s "No matches" empty row (',
    code('combo-box.ts:427'),
    ') is ',
    code('role="presentation"'),
    ' with no ',
    code('aria-live'),
    ' anywhere in the control — it renders visually but is not announced to assistive tech when a filter empties ' +
      'the list. Flagged below in Findings rather than fixed here (this page derives from the shipped behaviour, ' +
      'it does not change it).',
  ),
)

// ── 5 · reduced motion ───────────────────────────────────────────────────────────────────────────────────────
content.append(heading(2, '5 · Reduced motion'))
content.append(
  p(
    'State-paint transitions (never geometry, never ', code('all'), ') are gated behind a post-first-paint ',
    code(':state(ready)'),
    ' custom state, and every control zeroes them under the media query — non-negotiable (interaction-states.md ' +
      '§4c):',
  ),
)
content.append(
  codeBlock(
    ['@media (prefers-reduced-motion: reduce) {', '  :scope:state(ready) { transition: none; }', '}'].join('\n'),
    'css',
  ),
)

// ── 6 · labelling a control — aria-labelledby forwarding ────────────────────────────────────────────────────
content.append(heading(2, '6 · How a consumer labels a control'))
content.append(
  p(
    'A wrapper composes its own accessible-name delivery rather than asking the wrapped control to read a plain ' +
      '<label for>. Two shapes, same mechanism (a real DOM id wired through ',
    code('aria-labelledby'),
    '):',
  ),
)
content.append(
  p(
    '· ', code('ui-field'), ' (', code('packages/agent-ui/components/src/controls/field/field.ts'),
    ') wraps ONE control and supplies its ', code('label'), '/', code('description'),
    ' as real DOM parts; the ADR-0051 labelling seam sets ', code('aria-labelledby'),
    ' on the WRAPPED control’s own ElementInternals to the label part’s id — so the accessible name is correct ' +
      'even though the control never received a label attribute directly.',
  ),
)
content.append(
  p(
    '· ', code('ui-drawer'), ' (', code('packages/agent-ui/components/src/controls/drawer/drawer.ts:159'),
    ') FORWARDS an author-supplied ', code('aria-label'), '/', code('aria-labelledby'),
    ' off the HOST onto the internal ', code('<dialog data-part="dialog">'), ' part, then strips it from the ' +
      'host (ADR-0017 cl.5) — the host stays role/aria-clean while the real top-layer surface carries the name.',
  ),
)

// ── 7 · live example — a labelled field + a status live region ──────────────────────────────────────────────
content.append(heading(2, '7 · Live example'))
content.append(
  p(
    'A real ', code('ui-field'), '-wrapped ', code('ui-text-field'),
    ' (§6’s labelling seam) beside a real ', code('ui-toast-region'), ' (§4’s ', code('role="status"'),
    ' live region). Save announces through the live region — inspect either with a screen reader or the ' +
      'accessibility tree in devtools; both are the real controls, not a mock.',
  ),
)

const region = document.createElement('ui-toast-region') as UIToastRegionElement
const field = el('ui-field', { label: 'Display name', description: 'Shown on your public profile' }, [
  el('ui-text-field', { name: 'display-name', placeholder: 'Ada Lovelace' }),
])
field.style.cssText = 'max-inline-size:24rem;'

const saveBtn = uiButton('Save', 'solid')
saveBtn.addEventListener('click', () => {
  const input = field.querySelector('ui-text-field') as (HTMLElement & { value?: string }) | null
  const value = input?.value ?? ''
  region.show({ message: value === '' ? 'Enter a display name first.' : `Saved “${value}”.`, urgent: value === '' })
})

content.append(exampleSection('Labelled field + status live region', field, saveBtn, region))

// ── cross-links ───────────────────────────────────────────────────────────────────────────────────────────────
content.append(
  el('p', { class: 'a11y-crosslinks' }, [
    text('See also: '),
    el('a', { href: './getting-started.html' }, [text('Getting started')]),
    text(' (the light-DOM/ElementInternals framing this page expands on) and '),
    el('a', { href: './forms.html' }, [text('Forms')]),
    text(' (the ui-field labelling seam §6 cites, walked end-to-end).'),
  ]),
)
