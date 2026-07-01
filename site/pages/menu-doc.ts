// site/pages/menu-doc.ts — the ui-menu API doc page (Wave 4 S3). DERIVED from `menu.md` via the shared
// doc-page.ts renderer (the descriptor-derived tables cannot drift). One representative LIVE menu mounts the real
// control (a button trigger over [role=menuitem] rows, one disabled); the Arrow-rove + type-ahead + commit→select
// log is on the Menu demo.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css' // shared demo-content chrome; never restyles a ui-* control
import { loadMenuDoc } from '../lib/frontmatter.ts'
import { composeDocPage } from '../lib/doc-page.ts'
import { el, exampleSection, uiButton } from '../lib/specimens.ts'

const { descriptor, body } = loadMenuDoc()

const { content } = mountPage({
  title: 'ui-menu — API',
  intro: 'The keyboard-navigable overlay menu — a trigger opening a top-layer panel of [role=menuitem] rows, ' +
    'with Arrow-rove, type-ahead, and a commit → select event. Generated from menu.md (descriptor-derived tables). ' +
    'See the Menu demo for the live roving + select log.',
})

const text = (s: string): Text => document.createTextNode(s)

// A representative live ui-menu: the first child is the trigger (positional child-move); the remaining children
// become menuitems (role=menuitem auto-assigned). The disabled row is skipped by roving + commit.
const menu = el('ui-menu', {}, [
  uiButton('Open menu', 'soft'),
  el('div', { 'data-value': 'new' }, [text('New file')]),
  el('div', { 'data-value': 'open' }, [text('Open file')]),
  el('div', { 'data-value': 'save', disabled: '' }, [text('Save (disabled)')]),
  el('div', { 'data-value': 'exit' }, [text('Exit')]),
])

composeDocPage(content, descriptor, body, exampleSection('Example', menu))
