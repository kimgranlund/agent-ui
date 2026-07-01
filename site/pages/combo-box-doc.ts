// site/pages/combo-box-doc.ts — the ui-combo-box API doc page (Wave 4 S5). DERIVED from `combo-box.md` via the
// shared doc-page.ts renderer (the descriptor-derived tables cannot drift). One representative LIVE combo-box
// mounts the real form control (a contenteditable editor + a top-layer listbox); the free-text filter,
// active-descendant, strict mode, and change/select log are on the Combo-box demo.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css' // shared demo-content chrome; never restyles a ui-* control
import { loadComboBoxDoc } from '../lib/frontmatter.ts'
import { composeDocPage } from '../lib/doc-page.ts'
import { el, exampleSection } from '../lib/specimens.ts'

const { descriptor, body } = loadComboBoxDoc()

const { content } = mountPage({
  title: 'ui-combo-box — API',
  intro: 'The form-associated combo-box — a contenteditable editor filtering a top-layer listbox, with the ' +
    'active-descendant pattern (focus stays in the editor) and optional strict mode. Generated from combo-box.md ' +
    '(descriptor-derived tables). See the Combo-box demo for the live filter + change/select log.',
})

const text = (s: string): Text => document.createTextNode(s)

// A representative live ui-combo-box: the [role=option] children (each with a value key) are moved into the
// control-created listbox at connect time; typing filters them (strict off → free text allowed).
const comboBox = el('ui-combo-box', { placeholder: 'Search a fruit…' }, [
  el('div', { role: 'option', value: 'apple' }, [text('Apple')]),
  el('div', { role: 'option', value: 'banana' }, [text('Banana')]),
  el('div', { role: 'option', value: 'cherry' }, [text('Cherry')]),
  el('div', { role: 'option', value: 'grape' }, [text('Grape')]),
])

composeDocPage(content, descriptor, body, exampleSection('Example', comboBox))
