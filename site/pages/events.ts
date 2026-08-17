// site/pages/events.ts — the event vocabulary + interop reference (GH #1045). CLAUDE.md's Conventions
// section states the closed seven (`change · input · select · open · close · toggle · action`) as fleet
// law; this page is that law's SECOND consumer, not a restatement: the mechanics (bubbles/composed/
// cancelable) are sliced VERBATIM from `UIElement.emit` (dom/element.ts), and the per-control event
// inventory is DERIVED at build time from every shipped `{name}.md` descriptor's `events[]` sequence via
// `renderEventsTable` — the SAME renderer every T4 control doc page (button-doc.ts, select-doc.ts, …)
// already uses for its own Events section, so this reference table cannot drift from either a control's
// descriptor or from what that control's own doc page shows (one render path, two consumers).
//
// What is hand-authored, flagged: the PROVENANCE table (which ADR minted each vocabulary member — no
// machine-readable "which ADR named this event" index exists to parse, the same underivable-provenance
// posture doc-page.ts's own renderChangelogTable comment states) and the commit-semantics/`toggle`-two-
// shapes prose (paraphrased from naming.md §4, cited by file:line so a reader can re-verify against the
// real law rather than trusting this page's restatement).
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003) — already registers ui-select/ui-switch
import './containers.css' // shared demo chrome (.event-log)
import { heading, tableHead, tableRow, textCell, codeCell, renderEventsTable } from '../lib/doc-page.ts'
import { el, exampleSection } from '../lib/specimens.ts'
import { codeBlock } from '../lib/code-block.ts'
import { controlsWithEvents } from '../lib/frontmatter.ts'
import elementSrc from '../../packages/agent-ui/components/src/dom/element.ts?raw'
import descriptorPkgRaw from '../../packages/agent-ui/components/package.json?raw'

// ── local derivation helper — slice a class method verbatim out of `source` (the traits-doc.ts convention:
// extractInterface's brace-balance, applied to a method body instead of an interface). Throws — a real
// build-time drift gate — if the method is renamed/removed. ─────────────────────────────────────────────
function extractMethod(source: string, marker: string): string {
  const start = source.indexOf(marker)
  if (start === -1) throw new Error(`events.ts: method "${marker}" not found in dom/element.ts — renamed or removed?`)
  const bodyOpen = source.indexOf('{', start)
  let depth = 0
  let i = bodyOpen
  for (; i < source.length; i++) {
    if (source[i] === '{') depth++
    else if (source[i] === '}') {
      depth--
      if (depth === 0) {
        i++
        break
      }
    }
  }
  return source.slice(start, i)
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
const { content } = mountPage({
  title: 'Events',
  intro:
    'The closed event vocabulary every `ui-*` control emits from — seven names, no more (CLAUDE.md’s Conventions ' +
    'section; naming.md §4). This page derives the mechanics from the real `UIElement.emit` seam, the per-control ' +
    'inventory from every shipped descriptor’s `events[]` sequence, and cites the ADR that minted each name — plus ' +
    'a live event log over a real ui-select and ui-switch.',
})

// ════════════════ 1 · The closed seven — provenance ════════════════
content.append(heading(2, 'The closed seven — provenance'))
content.append(
  para(
    'A new event name is an ADR-level decision, never a drive-by addition (naming.md §4, ',
    code('.claude/docs/references/naming.md:95'),
    '). Hand-authored — no machine-readable "which ADR minted this name" index exists to parse (the same ' +
      'underivable-provenance posture ',
    code('doc-page.ts'),
    '’s own ',
    code('renderChangelogTable'),
    ' comment states); re-verify each row against the cited record.',
  ),
)
{
  const table = document.createElement('table')
  table.append(tableHead('Event', 'Minted by', 'Note'))
  const tbody = document.createElement('tbody')
  const rows: readonly [string, string, string][] = [
    ['change · input · select · open · close · toggle', 'plan.md §9', 'The original six (plan.md:292 — "simple names only"), mechanized as a gate by ADR-0081 (2026-07-05), which also carves out native `click` for a pure-activation control (Amendment 2).'],
    ['toggle — Shape 1 (POST-commit lifecycle)', 'ADR-0101', '2026-07-08 — "overlay open-state transitions always announce": the trait becomes the sole announcer, firing AFTER the host’s own state write settles.'],
    ['toggle — Shape 2 (PRE-commit, cancelable)', 'ADR-0179 (GH #686 Amendment S7-a)', '2026-08-09 — ui-toggle mint (a pressed-state pill button) reuses `toggle`, PRE-commit via the base `emit()` seam’s `cancelable:true` default, rather than minting an eighth name.'],
    ['action', 'ADR-0153 (GH #147)', '2026-07-20 — ui-status-stream’s inline retry affordance: the seventh member, "a user committed a per-entry action" (naming.md §4:92).'],
  ]
  for (const [event, adr, note] of rows) tbody.append(tableRow(codeCell(event), textCell(adr), textCell(note)))
  table.append(tbody)
  content.append(table)
}

// ════════════════ 2 · UIElement.emit — the mechanics, sliced from source ════════════════
content.append(heading(2, 'UIElement.emit — the mechanics'))
content.append(
  para(
    'Every event a control emits rides this ONE seam (',
    code('packages/agent-ui/components/src/dom/element.ts:262'),
    ') — sliced verbatim, never retyped:',
  ),
)
content.append(codeBlock(extractMethod(elementSrc, 'emit<D = undefined>(type: string, detail?: D): boolean {'), 'ts'))
content.append(
  para(
    'Every emitted event is ',
    code('bubbles: true'),
    ', ',
    code('composed: true'),
    ' (crosses a shadow boundary, though the fleet is light-DOM by default), and ',
    code('cancelable: true'),
    ' — a listener’s ',
    code('preventDefault()'),
    ' returns ',
    code('false'),
    ' from ',
    code('emit()'),
    ', which a control MAY honour (', code('ui-toggle'), '’s Shape-2 pre-commit `toggle` is the one shipped consumer that does, below).',
  ),
)

// ════════════════ 3 · Commit semantics ════════════════
content.append(heading(2, 'Commit semantics'))
content.append(
  para(
    'Paraphrased from naming.md §4 (',
    code('.claude/docs/references/naming.md:96'),
    '–101) — cite the source, don’t trust this restatement:',
  ),
)
{
  const table = document.createElement('table')
  table.append(tableHead('Event', 'Timing', 'Never fires from'))
  const tbody = document.createElement('tbody')
  const rows: readonly [string, string, string][] = [
    ['change', 'A user commit', 'A programmatic property write'],
    ['select', 'A user commit (a list-item/option selection)', 'A programmatic property write'],
    ['input', 'Live, on every interim edit', '—'],
    ['open · close · toggle', 'Overlay/disclosure lifecycle, announced by the transition itself', '—'],
    ['action', 'A user-committed per-entry action click', 'A programmatic update()/appendEntry() write'],
  ]
  for (const [event, timing, never] of rows) tbody.append(tableRow(codeCell(event), textCell(timing), textCell(never)))
  table.append(tbody)
  content.append(table)
}

// ════════════════ 4 · toggle — two shapes, one name ════════════════
content.append(heading(2, 'toggle — two shapes, one name'))
content.append(
  para(
    'A vocabulary member is closed on NAME, not on timing/cancelability (naming.md §4:103–118). ',
    strongText('Shape 1'),
    ' (the original, overlay/disclosure lifecycle) fires ',
    strongText('after'),
    ' the host’s own state write has settled — ',
    code('traits/overlay.ts'),
    ' is the sole announcer (ADR-0101). ',
    strongText('Shape 2'),
    ' (', code('ui-toggle'), ', ADR-0179 GH #686 Amendment S7-a) fires ',
    strongText('before'),
    ' the host’s own ',
    code('pressed'),
    ' write, riding the base ',
    code('emit()'),
    ' seam’s ',
    code('cancelable: true'),
    ' default — a listener’s ',
    code('preventDefault()'),
    ' refuses the press. A consumer distinguishes the two only by which control it listens to, never by ' +
      'inspecting the event itself.',
  ),
)

function strongText(s: string): HTMLElement {
  const strong = document.createElement('strong')
  strong.textContent = s
  return strong
}

// ════════════════ 5 · Per-control event inventory — derived ════════════════
content.append(heading(2, 'Per-control event inventory'))
content.append(
  para(
    'Every shipped control (',
    code('components/src/controls/*/*.md'),
    ') whose descriptor declares at least one event, rendered through ',
    code('renderEventsTable'),
    ' — the SAME table a control’s own API doc page renders. Router/code/app-tier descriptors sit outside ' +
      'this components-scoped glob (the same boundary ',
    code('site-coverage.test.ts'),
    ' holds) — not covered here.',
  ),
)
{
  const withEvents = controlsWithEvents()
  if (withEvents.length === 0) throw new Error('events.ts: 0 controls with events[] found — descriptor glob broken?')
  for (const member of withEvents) {
    const table = renderEventsTable(member.doc.descriptor)
    if (!table) continue
    content.append(heading(3, member.tag))
    content.append(table)
  }
}

// ════════════════ 6 · @agent-ui/components/descriptor — the export surface ════════════════
content.append(heading(2, '@agent-ui/components/descriptor'))
content.append(
  para(
    'The subpath (',
    code((JSON.parse(descriptorPkgRaw) as { exports: Record<string, string> }).exports['./descriptor']),
    ', from the real package.json exports map) barrels the canonical `{name}.md` frontmatter reader (',
    code('parseDescriptor'),
    ' / ',
    code('splitFrontmatter'),
    ') and its `ParsedDescriptor` schema (ADR-0004). Every control doc page — and this page’s own per-' +
      'control event inventory above — is a SECOND consumer of that ONE parser, the same one the in-package ' +
      'contract trip-wire (',
    code('component-descriptor-driftwire.test.ts'),
    ') validates against: one parser, many consumers, never a forked frontmatter dialect (',
    code('site/lib/frontmatter.ts'),
    ', the same adapter every ',
    code('*-doc.ts'),
    ' page uses).',
  ),
)

// ════════════════ 7 · Live — ui-select + ui-switch event log ════════════════
content.append(heading(2, 'Live — ui-select + ui-switch'))
content.append(para('Two real controls, one shared log — every emitted event, in commit order:'))

const log = document.createElement('ul')
log.className = 'event-log'
log.setAttribute('aria-live', 'polite')
let seq = 0
function logEvent(line: string): void {
  seq += 1
  const li = document.createElement('li')
  li.textContent = `#${String(seq).padStart(2, '0')}  ${line}`
  log.append(li)
  log.scrollTop = log.scrollHeight
}

const select = el('ui-select', { name: 'plan', placeholder: 'Choose a plan…' }, [
  el('div', { role: 'option', value: 'free' }, [document.createTextNode('Free')]),
  el('div', { role: 'option', value: 'pro' }, [document.createTextNode('Pro')]),
])
select.addEventListener('select', (e) => logEvent(`ui-select   select  detail=${JSON.stringify((e as CustomEvent<string>).detail)}`))
select.addEventListener('toggle', () => logEvent('ui-select   toggle  (open-state transition)'))
select.addEventListener('close', () => logEvent('ui-select   close'))

const toggleSwitch = el('ui-switch', { name: 'notifications' })
toggleSwitch.addEventListener('change', () => logEvent(`ui-switch   change  checked=${(toggleSwitch as unknown as { checked: boolean }).checked}`))
toggleSwitch.addEventListener('input', () => logEvent(`ui-switch   input   checked=${(toggleSwitch as unknown as { checked: boolean }).checked}`))

const row = el('div', {}, [select, toggleSwitch])
row.style.cssText = 'display:flex; gap:1.5rem; align-items:center; flex-wrap:wrap;'

content.append(exampleSection('Live ui-select + ui-switch', row), exampleSection('Event log', log))
