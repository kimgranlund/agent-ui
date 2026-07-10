// site/pages/theme-provider-demo.ts — the ui-theme-provider composition demo (the ratified container `demo`,
// ADR-0117). NEW content, distinct from theming.ts's existing narrative — it demonstrates (a) two nested
// providers with different `scheme`s, proving subtree independence, and (b) one provider left `scheme`-unset
// nested inside a `scheme="dark"` ancestor, proven with a self-coloring control (ui-button — LOW-3, doc-review:
// NOT bare text, which would conflate this ancestor-inherit proof [a color-scheme/light-dark() question] with
// the separate ink-re-root defect class the gallery's own CSS fix handles [an inherited-color question]).
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css' // shared demo chrome (.event-log + section spacing)
import { el, exampleSection, uiButton } from '../lib/specimens.ts'

const { content } = mountPage({
  title: 'ui-theme-provider — demo',
  intro:
    'Two compositions: independent nested subtrees with different scheme values side by side, and — the ' +
    'promotion’s own correctness case — an unset provider nested inside a scheme="dark" ancestor, which ' +
    'resolves the ancestor’s scheme rather than silently forcing light (the fix over the site-local ' +
    'predecessor). The API table is on the ui-theme-provider API page.',
})

const label = (text: string): HTMLElement => el('p', { class: 'demo-caption' }, [document.createTextNode(text)])

// ── 1 · subtree independence — two nested providers, different schemes, side by side ───────────────────────
function schemePanel(scheme: 'light' | 'dark'): HTMLElement {
  const provider = el('ui-theme-provider', { scheme }, [
    label(`scheme="${scheme}"`),
    uiButton('Solid', 'solid'),
    uiButton('Soft', 'soft'),
  ])
  provider.style.cssText =
    'display: flex; flex-direction: column; gap: 0.6rem; padding: 1.25rem; border-radius: 0.75rem; ' +
    'border: 1px solid var(--md-sys-color-neutral-outline-variant); background: var(--md-sys-color-neutral-surface); flex: 1 1 14rem;'
  return provider
}
const independenceRow = el('div', {}, [schemePanel('light'), schemePanel('dark')])
independenceRow.style.cssText = 'display: flex; flex-wrap: wrap; gap: 1.25rem;'

// ── 2 · the ancestor-inherit fix — an UNSET provider nested inside a scheme="dark" ancestor ─────────────────
// The nested provider carries NO scheme attribute at all — SPEC-R3 AC4: it must resolve the ANCESTOR's dark
// scheme, not silently collapse to light (the site-local predecessor's bug this promotion corrects).
const ancestor = el('ui-theme-provider', { scheme: 'dark' }, [
  label('outer scheme="dark"'),
  uiButton('Ancestor button', 'solid'),
])
const nestedUnset = el('ui-theme-provider', {}, [
  label('inner — no scheme attribute (unset)'),
  uiButton('Nested unset button', 'solid'),
])
ancestor.append(nestedUnset)
ancestor.style.cssText =
  'display: flex; flex-direction: column; gap: 0.75rem; padding: 1.25rem; border-radius: 0.75rem; ' +
  'border: 1px solid var(--md-sys-color-neutral-outline-variant); background: var(--md-sys-color-neutral-surface); max-inline-size: 20rem;'
nestedUnset.style.cssText =
  'display: flex; flex-direction: column; gap: 0.6rem; padding: 1rem; border-radius: 0.6rem; border: 1px dashed var(--md-sys-color-neutral-outline-variant);'

content.append(
  exampleSection('Subtree independence', independenceRow),
  exampleSection('Nested-unset inherits the ancestor scheme', ancestor),
)
