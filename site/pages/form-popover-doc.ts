// site/pages/form-popover-doc.ts — the ui-form-popover API doc page (GH #294 F4). DERIVED from
// `form-popover.md` via the shared doc-page.ts renderer (the descriptor-derived tables cannot drift). One
// representative LIVE form-popover mounts the real control: a control-created trigger (its visible `label`
// carries the consumer-authored summary state) over a top-layer panel holding real form content. See the
// form-popover Demo for the live label-summary + open/close event log.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css' // shared demo-content chrome; never restyles a ui-* control
import { loadFormPopoverDoc } from '../lib/frontmatter.ts'
import { composeDocPage } from '../lib/doc-page.ts'
import { el, exampleSection } from '../lib/specimens.ts'

const { descriptor, body } = loadFormPopoverDoc()

const { content } = mountPage({
  title: 'ui-form-popover — API',
  intro: 'The packaged popover + form-spine recipe — a control-created trigger whose visible label carries ' +
    'consumer-authored summary state, opening a floating, light-dismiss panel of arbitrary real form content, ' +
    'edited live-apply. Generated from form-popover.md (descriptor-derived tables). See the form-popover demo ' +
    'for the live label-summary + close/toggle event log.',
})

const text = (s: string): Text => document.createTextNode(s)

// A representative live ui-form-popover: ALL author children move into the control-created panel at connect
// (there is no author trigger — unlike ui-popover, the trigger is control-created from the `label` prop). The
// panel holds real form content: a 6-item check group, a radio group, and a text field.
const checkbox = (value: string, label: string): HTMLElement => {
  const el2 = document.createElement('ui-checkbox')
  el2.setAttribute('name', 'opt')
  el2.setAttribute('value', value)
  el2.textContent = label
  return el2
}
const checkGroup = el('fieldset', { role: 'group', 'aria-label': 'Options' }, [
  el('legend', {}, [text('Options')]),
  ...(['a', 'b', 'c', 'd', 'e', 'f'] as const).map((v, i) => checkbox(v, `Option ${String.fromCharCode(65 + i)}`)),
])

// A plain native radio group (the form-popover.md example markup's own idiom) — NOT `ui-radio-group`: its
// rovingFocus trait's connection wiring does not survive the #ensureParts() child-move-then-reconnect cycle
// (a real cross-control interaction gap; a fleet fix is out of this docs-only slice's scope, tracked
// separately, GH #302 (GH #294 follow-up)).
const radio = (value: string, label: string): HTMLElement => {
  const wrapper = el('label', {})
  const input = el('input', { type: 'radio', name: 'sort', value })
  wrapper.append(input, text(` ${label}`))
  return wrapper
}
const radioGroup = el('fieldset', { role: 'radiogroup', 'aria-label': 'Sort by' }, [
  el('legend', {}, [text('Sort by')]),
  radio('newest', 'Newest'),
  radio('oldest', 'Oldest'),
  radio('relevant', 'Most relevant'),
])

const search = el('ui-text-field', { label: 'Search' })

const formPopover = el('ui-form-popover', { label: 'Filters · 0 selected' }, [checkGroup, radioGroup, search])

composeDocPage(content, descriptor, body, exampleSection('Example', formPopover))
