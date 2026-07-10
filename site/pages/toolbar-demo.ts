// site/pages/toolbar-demo.ts — the ui-toolbar interaction demo (the ratified pattern-tier `demo`; ADR-0121;
// toolbar.lld.md LLD-C12/§5). Shows BOTH postures on one page (TKT-0009's own requirement): an embedded
// document-header action bar (elevation=0, flush) and a floating raised formatting palette (elevation=2), each
// populated with multiple real ui-buttons, plus the one-Tab-stop roving-keyboard callout. The control owns all
// ARIA/roving/posture (toolbar.ts/.css) — this page only stages representative content.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css' // shared demo chrome (section spacing)
import { el, exampleSection, uiButton } from '../lib/specimens.ts'

const { content } = mountPage({
  title: 'ui-toolbar — demo',
  intro: 'ui-toolbar, live — both postures. There is no posture prop: floating vs embedded is entirely the ' +
    'existing elevation/brightness surface axis. The API table is on the ui-toolbar API page.',
})

const text = (s: string): Text => document.createTextNode(s)
const strong = (s: string): HTMLElement => el('strong', {}, [text(s)])
const code = (s: string): HTMLElement => el('code', {}, [text(s)])

// ── embedded posture — a document-header action bar (elevation=0, flush into its header) ──────────────────────
const embedded = el('ui-toolbar', { label: 'Document actions', justify: 'between', elevation: '0' }, [
  el('ui-row', { gap: 'xs' }, [uiButton('Bold', 'ghost'), uiButton('Italic', 'ghost'), uiButton('Underline', 'ghost')]),
  uiButton('Share', 'ghost'),
])

// ── floating posture — a raised formatting palette (elevation=2, a real shadowed plane) ────────────────────────
const floating = el('ui-toolbar', { label: 'Format selection', elevation: '2', gap: 'sm' }, [
  uiButton('Bold', 'ghost'),
  uiButton('Link', 'ghost'),
  uiButton('Comment', 'ghost'),
])

const keyboard = el('p', {}, [
  text('Both bars use the shared '), strong('roving-focus'), text(' trait, decoupled from selection: '),
  strong('Tab'), text(' enters the whole bar as one stop. Within it, '), strong('ArrowLeft / ArrowRight'),
  text(' (or '), strong('ArrowUp / ArrowDown'), text(' when '), code('orientation="vertical"'),
  text(') move focus and '), strong('STOP at the ends'), text(' — unlike '), code('ui-tabs'),
  text(', a toolbar does not wrap. '), strong('Home / End'), text(' jump to the first / last item. No key ' +
    'ever commits a selection or emits an event — a toolbar arranges and roves focus only.'),
])

content.append(
  exampleSection('Embedded — a document-header action bar (elevation=0)', embedded),
  exampleSection('Floating — a raised formatting palette (elevation=2)', floating),
  exampleSection('Keyboard & roving focus', keyboard),
)
