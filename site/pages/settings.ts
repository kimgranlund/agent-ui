// site/pages/settings.ts — the ui-settings COMPOSITION GUIDE (the master-detail.ts site-page precedent,
// ported): `ui-settings` lives in `@agent-ui/app`, OUTSIDE the `components/src` fleet the site-coverage/
// site-toc drift gates enumerate, so it carries no `{name}-{type}.html` page set and no per-component TOC
// group — it is an UNGROUPED site-level link (added once to `_page.ts` NAV).
//
// DERIVE-FIRST: the API table at the foot is read straight from the shipped descriptor (settings.md)
// through the SAME canonical parser every control API doc uses — so a prop rename/default change flows
// here with no page edit. What is hand-authored is the teaching prose + the live example (a real
// `<ui-settings>` driven by a real schema + a real `localStorage`-backed store the reader can reload the
// page against to see the persistence round-trip).
import { mountPage, pageLead } from './_page.ts' // FIRST — foundation CSS cascade + self-defining ui-* controls
import '@agent-ui/components/component-styles.css' // ui-split/ui-text-field/ui-switch/etc.'s shipped CSS (composed by ui-settings)
import '@agent-ui/app/master-detail-pane.css'
import '@agent-ui/app/master-detail.css'
import '@agent-ui/app/settings.css'
import '@agent-ui/app/master-detail-pane' // self-defines ui-master-detail-pane (composed by ui-settings)
import '@agent-ui/app/master-detail' // self-defines ui-master-detail (composed by ui-settings)
import '@agent-ui/app/settings' // self-defines ui-settings
import './settings.css' // page-local demo chrome only (the resizable frame) — never restyles a control's internals
import { renderApiTable, renderPropertiesTable, heading } from '../lib/doc-page.ts'
import { parseDoc } from '../lib/frontmatter.ts'
import settingsMd from '../../packages/agent-ui/app/src/controls/settings/settings.md?raw'
import { createMemoryStore } from '@agent-ui/app/settings-memory-store'
import type { UISettingsElement } from '@agent-ui/app/settings'
import type { SettingsSchema } from '@agent-ui/app/settings-schema'

const { content } = mountPage({
  title: 'Composing a ui-settings surface',
  intro:
    'ui-settings is a sections rail + panel, composing the shipped ui-master-detail for the rail|panel ' +
    'drill-in, with every panel generated from a typed schema over the fleet’s own form spine ' +
    '(ui-form-provider/ui-field). No app-authored form CSS — the generated tree is fleet controls only.',
})

content.append(
  pageLead(
    'Set `schema` (a versioned SettingsSchema) and an optional `store` (a SettingsStore adapter) as ' +
      'properties — ui-settings generates the rail buttons and every section’s form from them. Both are ' +
      'reactive: assigning a schema after mount (an async-loaded schema) rebuilds; a mere reconnect with the ' +
      'SAME objects does not.',
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
function para(...nodes: (string | Node)[]): HTMLElement {
  const p = document.createElement('p')
  p.className = 'as-prose'
  for (const n of nodes) p.append(typeof n === 'string' ? document.createTextNode(n) : n)
  return p
}
function code(text: string): HTMLElement {
  return el('code', 'as-code', text)
}

const DEMO_SCHEMA: SettingsSchema = {
  version: 1,
  sections: [
    {
      id: 'profile',
      label: 'Profile',
      description: 'How you appear to others.',
      fields: [
        { key: 'displayName', type: 'text', label: 'Display name', description: 'Shown on your posts and comments.', default: 'Ada Lovelace', validation: { required: true } },
        { key: 'bio', type: 'text', label: 'Bio', default: '' },
      ],
    },
    {
      id: 'appearance',
      label: 'Appearance',
      fields: [
        { key: 'darkMode', type: 'boolean', label: 'Dark mode', default: false },
        {
          key: 'density', type: 'select', label: 'Density', default: 'comfortable',
          options: [
            { value: 'compact', label: 'Compact' },
            { value: 'comfortable', label: 'Comfortable' },
            { value: 'spacious', label: 'Spacious' },
          ],
        },
        { key: 'fontScale', type: 'slider', label: 'Font scale', description: '0.5× – 2×', default: 1, validation: { min: 0.5, max: 2, step: 0.1 } },
      ],
    },
    {
      id: 'notifications',
      label: 'Notifications',
      fields: [
        { key: 'emailDigest', type: 'boolean', label: 'Weekly email digest', default: true },
        { key: 'quietHoursStart', type: 'number', label: 'Quiet hours start (24h)', default: 22, validation: { min: 0, max: 23, step: 1 } },
      ],
    },
  ],
}

/** A live, dogfooded ui-settings — a real schema + a real localStorage-backed store (reload the page to
 *  see the round-trip: values you change persist under the `docs-settings-demo` key). */
function demo(): HTMLElement {
  const settings = document.createElement('ui-settings') as UISettingsElement
  settings.className = 'settings-demo'
  settings.schema = DEMO_SCHEMA
  settings.store = createMemoryStore({ persistKey: 'docs-settings-demo' })
  return settings
}

content.append(sectionHeading('1 · Schema-driven fields'))
content.append(
  para(
    'Each field’s ', code('type'), ' maps to a fleet control: ', code('text'), '/', code('number'), '/',
    code('date'), ' → ', code('ui-text-field'), ', ', code('boolean'), ' → ', code('ui-switch'), ', ',
    code('select'), ' → ', code('ui-select'), ', ', code('slider'), ' → ', code('ui-slider'), '. Resize the ' +
      'frame below narrower than 40rem (ui-master-detail’s own container width) to see the drill-in.',
  ),
)
const resizeFrame = el('div', 'settings-resize')
resizeFrame.append(demo())
content.append(resizeFrame, el('p', 'as-caption', '↑ Reload the page after changing a value — it persists via the store.'))

content.append(sectionHeading('2 · The SettingsStore seam'))
content.append(
  para(
    'A field reads ', code('store.get(key) ?? field.default'), ' at generation time and commits ',
    code('store.set(key, value)'), ' on its own ', code('change'), ' (per-field-on-change). No store supplied ' +
      '⇒ every field still renders from its schema ', code('default'), ', and changes are simply not ' +
      'persisted — ', code('ui-settings'), ' itself never imports a concrete store, only the interface.',
  ),
)

content.append(el('pre', 'as-snippet', `const el = document.querySelector('ui-settings')
el.schema = {
  version: 1,
  sections: [{ id: 'general', label: 'General', fields: [
    { key: 'displayName', type: 'text', label: 'Display name', default: '' },
  ] }],
}
el.store = createMemoryStore({ persistKey: 'my-app-settings' })`))

content.append(sectionHeading('API reference'))
content.append(
  para(
    'Read straight from the shipped descriptor (settings.md) through the same parser the package’s ' +
      'contract trip-wire validates.',
  ),
)

const settingsDoc = parseDoc(settingsMd)
if (settingsDoc.descriptor.attributes.length > 0) content.append(renderApiTable(settingsDoc.descriptor.attributes, 4))
{
  const props = renderPropertiesTable(settingsDoc.descriptor, 4)
  if (props) content.append(props)
}
