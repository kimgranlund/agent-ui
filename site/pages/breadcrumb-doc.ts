// site/pages/breadcrumb-doc.ts — the ui-breadcrumb API doc page (GH #1515, the frozen design intake
// `.claude/docs/spec/breadcrumb.intake.md` §4/§7 slices S1+S2). DERIVED from breadcrumb.md via the shared
// doc-page.ts renderer (the attribute table is label/inline/collapse/collapse-keep-trailing). One
// representative LIVE specimen mounts the real element, populated with a real 4-crumb path (not a lorem
// stub — the representative-specimen law); the interaction walkthrough (incl. collapse="menu") is the
// Breadcrumb demo.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css' // shared demo-content chrome; never restyles a ui-* control
import { loadBreadcrumbDoc } from '../lib/frontmatter.ts'
import { composeDocPage } from '../lib/doc-page.ts'
import { el, exampleSection } from '../lib/specimens.ts'

const { descriptor, body } = loadBreadcrumbDoc()

const { content } = mountPage({
  title: 'ui-breadcrumb — API',
  intro: 'A Pattern-class wayfinding trail — tag-agnostic author crumbs, an optional slotted separator ' +
    'template, an auto-stamped current-page leaf, and an optional `collapse="menu"` fold of the middle ' +
    'behind a composed overflow ui-menu. Generated from breadcrumb.md (descriptor-derived tables). See ' +
    'the Breadcrumb demo for the interaction, incl. collapse.',
})

// A representative live ui-breadcrumb — a real 4-level path ending in the current page (the reference
// shape breadcrumb.md itself documents).
const breadcrumb = el('ui-breadcrumb', { label: 'Breadcrumb' }, [
  el('a', { href: '/' }, [document.createTextNode('Home')]),
  el('a', { href: '/docs' }, [document.createTextNode('Docs')]),
  el('a', { href: '/docs/components' }, [document.createTextNode('Components')]),
  el('span', {}, [document.createTextNode('Breadcrumb')]),
])

composeDocPage(content, descriptor, body, exampleSection('Example', breadcrumb))
