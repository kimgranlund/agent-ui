// site/pages/theming.ts — the theming guide: ui-theme-provider's three live axes (scheme/scale/density), how the
// --md-sys-color-{family}-{role} role system is shaped, how a consumer overrides a token at a subtree, and how
// theme packs swap whole token palettes (ADR-0141/TKT-0087) — this site's own header picker is the live demo.
// Live demos throughout — the scheme demo puts a real light and a real dark
// subtree side by side (each its own <ui-theme-provider>), the override demo repoints a real token on a real
// wrapper around a real ui-button. Source of truth for the CONTRACT: the shipped `ui-theme-provider` control
// (`@agent-ui/components/controls/theme-provider`, ADR-0117) — this page cites it rather than re-implementing it.
// The role-system SHAPE is illustrated here; the full derived table of every role lives on the token reference
// page (tokens.html), linked below rather than restated.
import { mountPage, pageLead } from './_page.ts' // FIRST — foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './theming.css'
import '@agent-ui/components/controls/theme-provider' // self-defining <ui-theme-provider> (ADR-0117)
import { heading } from '../lib/doc-page.ts'
import { codeBlock } from '../lib/code-block.ts'
import { el } from '../lib/specimens.ts'

const { content } = mountPage({
  title: 'Theming',
  intro:
    'One theming subtree, three live axes: scheme (light/dark), scale, and density. This page shows each in a ' +
    'real, running subtree — never a static screenshot.',
})

content.append(
  pageLead(
    'ui-theme-provider is a real, shipped control (@agent-ui/components/controls/theme-provider) — a pure ' +
      'coordination/carrier element with no visual voice of its own. scheme is the one axis with a JS-side ' +
      'effect (it maps to the element’s own color-scheme, which every light-dark() token resolves against per ' +
      'subtree via inheritance — an unset scheme imposes no override and inherits the ambient scheme). scale ' +
      'and density are pure attribute carriers: dimensions.css’s [scale]/[density] selectors key off them in ' +
      'CSS alone.',
  ),
)

function code(s: string): HTMLElement {
  const el2 = document.createElement('code')
  el2.textContent = s
  return el2
}

// ── 1 · scheme — a real light subtree beside a real dark subtree ────────────────────────────────────────────
content.append(heading(2, '1 · scheme — light and dark, side by side'))
content.append(
  el('p', {}, [
    document.createTextNode('Each panel below is its own '),
    code("<ui-theme-provider scheme=\"…\">"),
    document.createTextNode(
      ', independent of your OS or browser preference — the same live specimens, rendered under both schemes ' +
        'at once so you can compare them directly.',
    ),
  ]),
)

function schemeCard(scheme: 'light' | 'dark'): HTMLElement {
  const provider = document.createElement('ui-theme-provider')
  provider.setAttribute('scheme', scheme)
  provider.className = 'theming-panel'

  const label = el('p', { class: 'theming-panel-label' }, [document.createTextNode(`scheme="${scheme}"`)])
  const button = document.createElement('ui-button')
  button.setAttribute('variant', 'solid')
  button.textContent = 'Solid'
  const soft = document.createElement('ui-button')
  soft.setAttribute('variant', 'soft')
  soft.textContent = 'Soft'
  const field = document.createElement('ui-text-field')
  field.setAttribute('label', 'Name')
  field.setAttribute('placeholder', 'Ada Lovelace')
  const row = el('div', { class: 'theming-panel-row' }, [button, soft])

  provider.append(label, row, field)
  return provider
}

content.append(el('div', { class: 'theming-scheme-row' }, [schemeCard('light'), schemeCard('dark')]))

// ── 2 · scale & density — a compact demo of both remaining axes ─────────────────────────────────────────────
content.append(heading(2, '2 · scale & density'))
content.append(
  el('p', {}, [
    document.createTextNode(
      'scale re-tables a control’s frame (height + font + icon) to a different §1 row; density multiplies only ' +
        'the icon-to-label rhythm gap, never the frame. Both are plain attributes on any ancestor — ' +
        'ui-theme-provider carries them for free, but any wrapper element works identically.',
    ),
  ]),
)

function axisRow(attr: 'scale' | 'density', value: string): HTMLElement {
  const cluster = el('div', { class: 'theming-axis-cluster' })
  cluster.setAttribute(attr, value)
  const label = el('span', { class: 'theming-axis-label' }, [document.createTextNode(`[${attr}="${value}"]`)])
  const btn = document.createElement('ui-button')
  btn.setAttribute('variant', 'soft')
  btn.textContent = 'Sample'
  cluster.append(label, btn)
  return cluster
}
content.append(
  el('div', { class: 'theming-axis-row' }, [axisRow('scale', 'ui-sm'), axisRow('scale', 'ui-md'), axisRow('scale', 'content-lg')]),
)
content.append(
  el('div', { class: 'theming-axis-row' }, [axisRow('density', 'compact'), axisRow('density', 'comfortable'), axisRow('density', 'spacious')]),
)
content.append(
  el('p', { class: 'theming-note' }, [
    document.createTextNode('The full [scale] × [size] stepping — every combination, tabulated — lives on the '),
    (() => {
      const a = document.createElement('a')
      a.href = './sizing.html'
      a.textContent = 'sizing guide'
      return a
    })(),
    document.createTextNode('.'),
  ]),
)

// ── 3 · the role system — family × role, light-dark() pairs ─────────────────────────────────────────────────
content.append(heading(2, '3 · the role system'))
content.append(
  el('p', {}, [
    document.createTextNode(
      'Every colour a control paints is a --md-sys-color-{family}-{role} custom property — never a bare hex or ' +
        'an oklch() literal in a control’s own CSS. family is the semantic channel (neutral · primary · ' +
        'secondary · tertiary · info · success · warning · danger, plus the dedicated focus-ring utility role); ' +
        'role is the usage (on-surface, container, outline-variant, …). Each role resolves through ',
    ),
    code('light-dark(lightValue, darkValue)'),
    document.createTextNode(
      ', so a role automatically repaints when its subtree’s color-scheme flips — no separate dark-mode ' +
        'stylesheet, ever. The full derived table of every role, live in both schemes, is the ',
    ),
    (() => {
      const a = document.createElement('a')
      a.href = './tokens.html'
      a.textContent = 'token reference'
      return a
    })(),
    document.createTextNode('.'),
  ]),
)

// ── 4 · overriding a token at a subtree — a real, live override ─────────────────────────────────────────────
content.append(heading(2, '4 · overriding a token at a subtree'))
content.append(
  el('p', {}, [
    document.createTextNode(
      'A role is a custom property, so a consumer repoints one the ordinary CSS way: declare it on an ancestor, ' +
        'and every descendant control that reads that role repaints — no control-specific override API. Below, ' +
        'a wrapper repoints --md-sys-color-primary; the solid button on the right reads it live, the one on the ' +
        'left does not.',
    ),
  ]),
)
content.append(
  codeBlock(
    ['.brand-accent {', '  --md-sys-color-primary: oklch(0.6 0.18 25); /* a custom hue, both schemes */', '}'].join('\n'),
    'css',
  ),
)
{
  const plain = document.createElement('ui-button')
  plain.setAttribute('variant', 'solid')
  plain.textContent = 'Default'

  const overridden = el('div', { class: 'theming-override' })
  overridden.style.setProperty('--md-sys-color-primary', 'oklch(0.6 0.18 25)')
  const overriddenBtn = document.createElement('ui-button')
  overriddenBtn.setAttribute('variant', 'solid')
  overriddenBtn.textContent = 'Overridden'
  overridden.append(overriddenBtn)

  content.append(el('div', { class: 'theming-override-row' }, [plain, overridden]))
}

// ── 5 · theme packs ───────────────────────────────────────────────────────────────────────────────────────────
content.append(heading(2, '5 · theme packs'))
content.append(
  el('p', {}, [
    document.createTextNode(
      'ui-theme-provider also carries a theme attribute — swapping whole token PACKAGES (a distinct palette, ' +
        "not just a subtree override). A pack is generated out-of-band from Ultimate Tokens' export, then " +
        "wrapped under a [theme='name'] selector; it only needs to declare the roles it actually changes — " +
        'anything it omits (the focus ring, the status colors) inherits the default from :root via ordinary CSS ' +
        "cascade. Pick a theme from this site's own header control to see it live: the shell around this very " +
        "page is one ui-theme-provider, and the picker lazy-loads each pack's stylesheet on first selection.",
    ),
    document.createTextNode(' '),
    (() => {
      const a = document.createElement('a')
      a.href = './adr-index.html'
      a.textContent = 'Decision records'
      return a
    })(),
    document.createTextNode('.'),
  ]),
)
