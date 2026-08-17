// site/pages/nav-rail.ts — the ui-nav-rail COMPOSITION GUIDE (the master-detail.ts / settings.ts site-page
// precedent, ported): the nav-rail family lives in `@agent-ui/app`, OUTSIDE the `components/src` fleet the
// site-coverage/site-toc drift gates enumerate, so it carries no `{name}-{type}.html` page set and no
// per-component TOC group — it is an UNGROUPED site-level link (added once to `_page.ts` NAV).
//
// DERIVE-FIRST: the API tables at the foot are read straight from the three shipped descriptors
// (nav-rail.md / nav-rail-group.md / nav-rail-item.md) through the SAME canonical parser every control API
// doc uses — so a prop rename/default change flows here with no page edit. What is hand-authored is the
// teaching prose + the live examples.
//
// GH #368 — this page exists partly BECAUSE the arm being repaired had no site surface at all: nothing
// demonstrated `collapse="menu"` and nothing visually guarded it. So §3 shows the flyout in the band it
// actually lives in (a fixed 18rem frame, deliberately below the 40rem line) and §4 dogfoods the
// clipping-ancestor case the bug report was about — a real `overflow: hidden` box far too short to contain
// the panel, which the top-layer flyout escapes in front of the reader.
import { mountPage, pageLead } from './_page.ts' // FIRST — foundation CSS cascade + self-defining ui-* controls
import '@agent-ui/components/component-styles.css' // ui-menu's shipped CSS (composed by collapse="icon-popover")
import '@agent-ui/app/nav-rail.css'
import '@agent-ui/app/nav-rail' // self-defines ui-nav-rail + ui-nav-rail-group + ui-nav-rail-item
import './nav-rail.css' // page-local demo chrome only — never restyles a control's internals
import { renderApiTable, renderPropertiesTable, heading } from '../lib/doc-page.ts'
import { parseDoc } from '../lib/frontmatter.ts'
import navRailMd from '../../packages/agent-ui/app/src/controls/nav-rail/nav-rail.md?raw'
import navRailGroupMd from '../../packages/agent-ui/app/src/controls/nav-rail/nav-rail-group.md?raw'
import navRailItemMd from '../../packages/agent-ui/app/src/controls/nav-rail/nav-rail-item.md?raw'

const { content } = mountPage({
  title: 'Composing a ui-nav-rail',
  intro:
    'ui-nav-rail is ONE navigation-rail primitive with a closed `collapse` enum choosing its own ' +
    'narrow-width disposition — a grouped vertical list wide, and below the line either a top-layer flyout, ' +
    'nothing at all, icon-only popovers, or a drill-in the consumer composes. Three elements, no bespoke ' +
    'rail markup, active indication and ARIA role derived rather than declared.',
})

content.append(
  pageLead(
    'Author a plain ChildList of ui-nav-rail-group and ui-nav-rail-item children. An item with an `href` ' +
      'renders a real <a> (native navigation, never intercepted); a bare item renders a <button> and commits ' +
      'a selection as `select`/`change` on the rail. The rail derives its own ARIA role from that item ' +
      'SHAPE — all-link ⇒ navigation, all-bare ⇒ tablist — so you never declare it.',
  ),
)

function el(tag: string, className: string, text?: string): HTMLElement {
  const node = document.createElement(tag)
  node.className = className
  if (text !== undefined) node.textContent = text
  return node
}
function sectionHeading(text: string): HTMLElement {
  return heading(2, text)
}
function code(text: string): HTMLElement {
  return el('code', 'as-code', text)
}
function caption(text: string): HTMLElement {
  return el('p', 'as-caption', text)
}

/** One demo rail: a grouped, link-shaped rail in the given collapse mode (the shape both shipped
 *  consumers build programmatically — SPEC-R2). `tagged` adds the trailing name|tag cell (SPEC-R6). */
function demoRail(collapse: string, opts: { tagged?: boolean; container?: string } = {}): HTMLElement {
  const rail = document.createElement('ui-nav-rail')
  rail.className = 'nr-demo'
  rail.setAttribute('collapse', collapse)
  rail.setAttribute('aria-label', `${collapse} demo`)
  if (opts.container) rail.setAttribute('collapse-container', opts.container)

  const groups: [string, [string, string, boolean][]][] = [
    [
      'Components',
      [
        ['Button', '#button', true],
        ['Select', '#select', false],
        ['Text Field', '#text-field', false],
      ],
    ],
    [
      'Guides',
      [
        ['Theming', '#theming', false],
        ['Sizing', '#sizing', false],
      ],
    ],
  ]

  for (const [label, items] of groups) {
    const group = document.createElement('ui-nav-rail-group')
    group.setAttribute('label', label)
    for (const [text, href, selected] of items) {
      const item = document.createElement('ui-nav-rail-item')
      item.setAttribute('href', href)
      if (selected) item.setAttribute('selected', '')
      item.textContent = text
      // The tag rides a NON-selected item deliberately. `collapse="menu"`'s trigger label derives from the
      // selected item's whole `textContent`, which today CONCATENATES the label and this trailing cell
      // ("Buttonnew") — a pre-existing defect in that derivation, reported separately rather than papered
      // over here; putting the tag on a non-selected row demonstrates SPEC-R6's name|tag cell without
      // teaching the glitch as if it were the contract.
      if (opts.tagged && text === 'Select') {
        const tag = document.createElement('span')
        tag.slot = 'trailing'
        tag.setAttribute('data-role', 'tag')
        tag.textContent = 'new'
        item.append(tag)
      }
      group.append(item)
    }
    rail.append(group)
  }
  return rail
}

// ════════════════ 1 · Composition ════════════════

content.append(sectionHeading('1 · Composition — three elements, no rail CSS of your own'))
content.append(
  pageLead(
    'A ', code('ui-nav-rail-group'), ' carries a context-label heading; each ', code('ui-nav-rail-item'),
    ' is one row. A trailing ', code('data-role="tag"'), ' cell right-justifies a badge and truncates ' +
      'with an ellipsis rather than wrapping the row (SPEC-R6). The active item gets a real border ' +
      'indicator, not a colour-only one, so it survives forced-colors.',
  ),
)
content.append(el('pre', 'as-snippet', `<ui-nav-rail collapse="menu">
  <ui-nav-rail-group label="Components">
    <ui-nav-rail-item href="/button" selected>
      Button<span slot="trailing" data-role="tag">new</span>
    </ui-nav-rail-item>
    <ui-nav-rail-item href="/select">Select</ui-nav-rail-item>
  </ui-nav-rail-group>
</ui-nav-rail>`))

{
  const frame = el('div', 'nr-resize')
  frame.append(demoRail('menu', { tagged: true }))
  content.append(frame)
  content.append(
    caption('↑ collapse="menu", wide. Drag the resize handle (bottom-right) below 40rem to watch it collapse.'),
  )
}

// ════════════════ 2 · The four dispositions ════════════════

content.append(sectionHeading('2 · `collapse` — the four narrow dispositions'))
content.append(
  pageLead(
    'One closed enum picks what the rail does below its own container-width threshold. It is measured ' +
      'against the RAIL’S OWN box by default, never the viewport — so a rail in a narrow column behaves ' +
      'the same wherever the window is.',
  ),
)
const dispositions: [string, string][] = [
  ['menu', 'the default — collapses into one trigger that opens the list as a top-layer flyout card'],
  ['none', 'never collapses; the plain grouped vertical list at every band, for a consumer whose own shell owns narrow'],
  ['icon-popover', 'items render icon-only; a group of 2+ discloses its items through a composed ui-menu'],
  ['drill-in', 'the rail never reflows at all — it contributes anatomy only, and YOU compose ui-master-detail around it'],
]
{
  const list = document.createElement('ul')
  list.className = 'as-prose'
  for (const [name, text] of dispositions) {
    const li = document.createElement('li')
    li.append(code(`collapse="${name}"`), document.createTextNode(` — ${text}`))
    list.append(li)
  }
  content.append(list)
}

// ════════════════ 3 · collapse="menu" narrow — the flyout ════════════════

content.append(sectionHeading('3 · collapse="menu" narrow — a top-layer flyout card'))
content.append(
  pageLead(
    'Below the line the rail becomes a single button naming the current item. Activating it — click, ',
    code('Enter'), ' or ', code('Space'), ' — opens the whole grouped list as a card anchored under that ' +
      'button, in the browser’s TOP LAYER. It is the fleet’s one overlay mechanism, so dismissal is the ' +
      'platform’s: ', code('Escape'), ' or a click outside, with focus moving into the panel on open and ' +
      'back to the button on close. The card is sized by its CONTENT between a floor and a ceiling — never ' +
      'stretched to the rail’s own width, which would read as the shell’s edge rather than the menu’s.',
  ),
)
{
  const frame = el('div', 'nr-narrow')
  frame.append(demoRail('menu', { tagged: true }))
  content.append(frame)
  content.append(caption('↑ A fixed 18rem frame — already below the 40rem line. Open the trigger to see the card.'))
}

// ════════════════ 4 · Why the top layer ════════════════

content.append(sectionHeading('4 · Why the top layer — a clipping ancestor cannot trap it'))
content.append(
  pageLead(
    'The frame below is only ', code('3.5rem'), ' tall with ', code('overflow: hidden'), ' — far too short ' +
      'to contain the open panel, and it really does clip its own content. Open the trigger anyway: the ' +
      'flyout renders in the top layer, so it escapes the clip entirely. An ', code('position: absolute'),
    ' panel could not, and would be cut off at the dashed edge — the failure this arm used to have, and the ' +
      'reason the fix was to adopt the overlay controller rather than to nudge a z-index.',
  ),
)
{
  const clipper = el('div', 'nr-clipper')
  clipper.append(demoRail('menu'))
  content.append(clipper)
  content.append(caption('↑ A deliberately clipping ancestor. The open flyout is unaffected by it.'))
}

// ════════════════ 5 · collapse-container ════════════════

content.append(sectionHeading('5 · `collapse-container` — WHICH box the threshold measures'))
content.append(
  pageLead(
    'A rail in a genuinely narrow sidebar (say a 15rem docs nav column) is ALWAYS below 40rem against its ' +
      'own box, so it would collapse forever. ', code('collapse-container="ancestor"'), ' relinquishes the ' +
      'rail’s own containment so the threshold resolves against the nearest ancestor that opts in:',
  ),
)
content.append(el('pre', 'as-snippet', `.app-shell {
  container-type: inline-size;
  container-name: ui-nav-rail-collapse;
}

<div class="app-shell">
  <ui-nav-rail collapse="menu" collapse-container="ancestor">…</ui-nav-rail>
</div>`))
content.append(
  pageLead(
    'If no ancestor names the container the query simply never matches and the rail never collapses — a ' +
      'safe failure, never the opposite. The JS that arms the flyout watches that SAME resolved box, so the ' +
      'CSS threshold and the overlay can never disagree about which band the rail is in.',
  ),
)
{
  const ancestor = el('div', 'nr-named-ancestor')
  const column = el('div', 'nr-column')
  column.append(demoRail('menu', { container: 'ancestor' }))
  ancestor.append(column)
  content.append(ancestor)
  content.append(
    caption(
      '↑ A 15rem column inside a WIDE named ancestor: the vertical rail stays, even though the rail’s own ' +
        'box is far below 40rem. Drag the outer frame narrow and it collapses — tracking the ancestor, not itself.',
    ),
  )
}

// ════════════════ 6 · icon-popover + drill-in ════════════════

content.append(sectionHeading('6 · icon-popover and drill-in'))
content.append(
  pageLead(
    code('collapse="icon-popover"'), ' renders items icon-only, keeping each label as the accessible name ' +
      '(visually clipped, never removed), and a group of 2+ items discloses them through an internally ' +
      'composed ', code('ui-menu'), ' — roving focus, commit-and-close and dismissal inherited wholesale, ' +
      'with at most one group open at a time. ', code('collapse="drill-in"'), ' is the anatomy-only mode: ' +
      'the rail renders identically at every width and the CONSUMER composes it as the list pane of its own ',
    code('ui-master-detail'), ', whose shipped narrow drill-in is untouched by this family.',
  ),
)
{
  const frame = el('div', 'nr-narrow')
  frame.append(demoRail('drill-in', { tagged: true }))
  content.append(frame)
  content.append(caption('↑ collapse="drill-in" in the same 18rem frame: no collapse, no trigger — anatomy only.'))
}

// ════════════════ API reference ════════════════

content.append(sectionHeading('API reference'))
content.append(
  pageLead(
    'Read straight from the three shipped descriptors (nav-rail.md · nav-rail-group.md · nav-rail-item.md) ' +
      "through the same parser the package's contract trip-wire validates.",
  ),
)

for (const [tag, raw] of [
  ['ui-nav-rail', navRailMd],
  ['ui-nav-rail-group', navRailGroupMd],
  ['ui-nav-rail-item', navRailItemMd],
] as const) {
  const doc = parseDoc(raw)
  content.append(el('h3', 'as-api-tag', tag))
  if (doc.descriptor.attributes.length > 0) content.append(renderApiTable(doc.descriptor.attributes, 4))
  const props = renderPropertiesTable(doc.descriptor, 4)
  if (props) content.append(props)
}
