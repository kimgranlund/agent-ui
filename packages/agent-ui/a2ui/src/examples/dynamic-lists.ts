// dynamic-lists.ts — the four A2UI v1.0 dynamic-list seeds (ADR-0055 §3): a container whose `children`
// is a TEMPLATE (`{path, componentId}`) over a data array, instantiated one item per element,
// POSITIONALLY (ADR-0024 — index-based, no per-item key). In order of value: (1) a leaf display list;
// (2) a CONTAINER template (a Card subtree per item) whose labels are `${…}` DynamicString templates
// (ADR-0027); (3) an INTERACTIVE list whose edits round-trip into the data model; (4) a NESTED list (a
// template whose items hold their own template).

import type { ExampleSeed } from './types.ts'

const DISPLAY_ID = 'list-display'
export const listDisplaySeed: ExampleSeed = {
  name: 'list-display',
  description: 'A leaf Text template over an array of tags — one ui-text per element.',
  promptText: 'Show a wrapping row of tag chips for: signals, web-components, zero-dep, A2UI.',
  surfaceId: DISPLAY_ID,
  protocolVersion: 'v1.0',
  catalogId: 'agent-ui',
  messages: [
    { version: 'v1.0', createSurface: { surfaceId: DISPLAY_ID, catalogId: 'agent-ui' } },
    {
      version: 'v1.0',
      updateDataModel: {
        surfaceId: DISPLAY_ID,
        value: { tags: [{ name: 'signals' }, { name: 'web-components' }, { name: 'zero-dep' }, { name: 'A2UI' }] },
      },
    },
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: DISPLAY_ID,
        components: [
          { id: 'root', component: 'Row', gap: 'md', wrap: true, children: { path: '/tags', componentId: 'tag_chip' } },
          { id: 'tag_chip', component: 'Text', variant: 'body', text: { path: 'name' } },
        ],
      },
    },
  ],
}

const PEOPLE_ID = 'list-people'
export const listPeopleSeed: ExampleSeed = {
  name: 'list-people',
  description: 'A Card template per person, each label composed from data with ${…} interpolation.',
  promptText: 'Show a team directory: one card per person with their name, role, and team.',
  surfaceId: PEOPLE_ID,
  protocolVersion: 'v1.0',
  catalogId: 'agent-ui',
  messages: [
    { version: 'v1.0', createSurface: { surfaceId: PEOPLE_ID, catalogId: 'agent-ui' } },
    {
      version: 'v1.0',
      updateDataModel: {
        surfaceId: PEOPLE_ID,
        value: {
          people: [
            { name: 'Ada Lovelace', role: 'Engineer', team: 'Reactive' },
            { name: 'Grace Hopper', role: 'Architect', team: 'Compiler' },
            { name: 'Lin Clark', role: 'Writer', team: 'Docs' },
          ],
        },
      },
    },
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: PEOPLE_ID,
        components: [
          { id: 'root', component: 'Column', gap: 'md', children: { path: '/people', componentId: 'person_card' } },
          { id: 'person_card', component: 'Card', elevation: '1', children: ['person_content'] },
          { id: 'person_content', component: 'CardContent', children: ['person_col'] },
          { id: 'person_col', component: 'Column', gap: 'xs', children: ['person_name', 'person_meta'] },
          // Two ${…} TEMPLATES, each over RELATIVE item paths — composed by the agent, not single-path binds.
          { id: 'person_name', component: 'Text', variant: 'h5', text: '${name} — ${role}' },
          { id: 'person_meta', component: 'Text', variant: 'caption', text: '${role} · ${team} team' },
        ],
      },
    },
  ],
}

const FORM_ID = 'list-form'
export const listFormSeed: ExampleSeed = {
  name: 'list-form',
  description: 'An interactive list of text fields whose edits round-trip into the data model.',
  promptText: 'Show an editable list of name fields the user can update and send back.',
  surfaceId: FORM_ID,
  protocolVersion: 'v1.0',
  catalogId: 'agent-ui',
  messages: [
    { version: 'v1.0', createSurface: { surfaceId: FORM_ID, catalogId: 'agent-ui', sendDataModel: true } },
    {
      version: 'v1.0',
      updateDataModel: {
        surfaceId: FORM_ID,
        value: {
          fields: [
            { label: 'First name', value: 'Ada' },
            { label: 'Last name', value: 'Lovelace' },
          ],
        },
      },
    },
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: FORM_ID,
        components: [
          { id: 'root', component: 'Column', gap: 'md', children: ['fields_col', 'send_btn'] },
          { id: 'fields_col', component: 'Column', gap: 'sm', children: { path: '/fields', componentId: 'field_input' } },
          { id: 'field_input', component: 'TextField', label: { path: 'label' }, value: { path: 'value' } },
          { id: 'send_btn', component: 'Button', variant: 'solid', label: 'Send to agent', action: { action: 'submit' } },
        ],
      },
    },
  ],
}

const NESTED_ID = 'list-nested'
export const listNestedSeed: ExampleSeed = {
  name: 'list-nested',
  description: 'A list of section cards, each holding its own nested (relative-path) list.',
  promptText: 'Show two sections — Fruit and Reactive primitives — each with a row of its own items.',
  surfaceId: NESTED_ID,
  protocolVersion: 'v1.0',
  catalogId: 'agent-ui',
  messages: [
    { version: 'v1.0', createSurface: { surfaceId: NESTED_ID, catalogId: 'agent-ui' } },
    {
      version: 'v1.0',
      updateDataModel: {
        surfaceId: NESTED_ID,
        value: {
          sections: [
            { title: 'Fruit', items: [{ name: 'Apple' }, { name: 'Pear' }] },
            { title: 'Reactive primitives', items: [{ name: 'signal' }, { name: 'effect' }, { name: 'scope' }] },
          ],
        },
      },
    },
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: NESTED_ID,
        components: [
          { id: 'root', component: 'Column', gap: 'md', children: { path: '/sections', componentId: 'section_card' } },
          { id: 'section_card', component: 'Card', elevation: '1', children: ['section_content'] },
          { id: 'section_content', component: 'CardContent', children: ['section_col'] },
          { id: 'section_col', component: 'Column', gap: 'sm', children: ['section_title', 'items_row'] },
          { id: 'section_title', component: 'Text', variant: 'h4', text: { path: 'title' } },
          // A RELATIVE template path ('items', no leading slash) → /sections/{i}/items — the inner list.
          { id: 'items_row', component: 'Row', gap: 'md', wrap: true, children: { path: 'items', componentId: 'item_chip' } },
          { id: 'item_chip', component: 'Text', variant: 'body', text: { path: 'name' } },
        ],
      },
    },
  ],
}

/** Every seed this module defines — the barrel's family-array precedent (index.ts derives `allSeeds`
 *  length from these, never a hand-counted literal). */
export const dynamicListSeeds: readonly ExampleSeed[] = [listDisplaySeed, listPeopleSeed, listFormSeed, listNestedSeed]
