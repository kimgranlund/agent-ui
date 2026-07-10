// site/pages/theme-provider-doc.ts — the ui-theme-provider API doc page (ADR-0117). DERIVED from
// its own `controls/theme-provider/theme-provider.md` descriptor via the shared doc-page.ts renderer — the
// standard descriptor-derived API page shape
// (the form-provider-doc.ts / code-doc.ts precedent): an Attributes table (scheme/scale/density/theme, each
// with its default + reflect state), the default slot, and the prose body (axes, reflection, nesting, the
// catalog disposition). One LIVE specimen shows two nested providers side by side, distinct from the
// interaction demo (nesting + the ancestor-inherit proof) on the ui-theme-provider demo page.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css' // shared demo-content chrome; never restyles a ui-* control
import { loadThemeProviderDoc } from '../lib/frontmatter.ts'
import { composeDocPage } from '../lib/doc-page.ts'
import { applyDemoWidth, el, exampleSection, uiButton } from '../lib/specimens.ts'

const { descriptor, body } = loadThemeProviderDoc()

const { content } = mountPage({
  title: 'ui-theme-provider — API',
  intro:
    'A real, shipped theming element — a pure coordination/carrier layer establishing a color-scheme ' +
    'subtree plus two pure attribute carriers (scale/density) and a reserved package seam (theme). Generated ' +
    'from its own descriptor. See the ui-theme-provider demo for the nesting + ancestor-inherit proof.',
})

// A representative themed subtree — the markup shape the descriptor documents (a real self-coloring
// control, per the LOW-3 doc-review rationale: bare text would conflate this shape specimen with the
// separate ink-inheritance question the demo page is not trying to teach here).
const specimen = el('ui-theme-provider', { scheme: 'dark' }, [uiButton('Solid', 'solid')])
applyDemoWidth(specimen, '16rem')

composeDocPage(content, descriptor, body, exampleSection('Themed subtree', specimen))
