// crud-entry-list.ts — GH #1355 (the 2026-08-18 preset-vs-catalog gap analysis): the CRUD entry-list
// idiom's corpus seed. The catalog can already express "a List of named entries, each toggleable and
// editable, with an add-from-library affordance" (7 in-repo instantiations at
// `packages/agent-ui/app/src/controls/entry-list/entry-list.ts`, and a corner of it — the Drawer +
// bindable `open` — already covered by `catalog-coverage.ts`'s `agent-roster-drawer` seed), but no
// mini-skill or exemplar taught the FULL composition end to end. This seed is that missing exemplar,
// grounded in `entry-list.ts`'s real row shape (`[switch | label | … | Edit]`, GH #917's drawered-CRUD
// variant) and `agent-roster-drawer`'s Drawer+bindable-`open` precedent — never invented from memory.
//
// Three real traps this seed teaches by CONSTRUCTION (all verified against `catalog.json`, not assumed):
//
// (1) `Switch.label` maps to `textContent` but carries NO `"bindable": true` — a templated row cannot
//     vary the switch's own visible name per item. AND a merely-adjacent sibling Text never
//     programmatically NAMES the switch for assistive tech (the first judged pass scored exactly that
//     shape qualityScore 2, failing D1 on P7 — a nameless `role=switch` per row). The catalog-available
//     repair, taught here: `Field.label` IS bindable, so a per-row Field wrap with `label: {path:
//     'label'}` (the ADR-0051 seam — the same relative-bind machinery `dynamic-lists.ts`'s templated
//     TextField label already uses) names each switch AND paints the visible per-item name in one move.
//
// (2) `MenuItem` (`catalog.json`) declares only `value`/`label` — no `action` slot — and
//     `renderer.ts`'s `A2uiClientMessage` union is exactly `ActionMessage | ErrorMessage |
//     FunctionResponseMessage`: a bare `MenuItem` pick has NO wire-visible commit at all (confirmed
//     against `factories.ts`'s own `MenuItem → div[role=menuitem]`, a plain non-`ui-*` div with no event
//     wiring). The add-from-library menu here uses BUTTON rows instead — each carrying its own `action`
//     — so picking a library entry is actually observable server-side, never a dead click.
//
// (3) The edit Drawer sits BESIDE the Card (a root Column of [card, drawer]) — the `agent-roster-drawer`
//     placement precedent — never inside `CardContent`: an overlay is not card substance, and parking it
//     there drags the drawer's own form-action Row into the Card's anatomy (the P9 exposure the first
//     judged pass named alongside the P7 fail).
//
// Judged against `a2ui-corpus.md` (the `a2ui-review-agent` critic); verdict + admission recorded in
// `corpus/verdicts/` per ADR-0165/ADR-0068. First pass: qualityScore 2, failing D1 (P7) — repaired at
// source per the judge's own named fix (this revision), then re-judged fresh before first import.

import type { ExampleSeed } from './types.ts'

const CRUD_ENTRY_LIST_ID = 'crud-entry-list-drawer'

/** The CRUD entry-list idiom — a List of named, toggleable entries, each editable through a validated
 *  FormProvider inside an end-docked Drawer, plus an add-from-library affordance. */
export const crudEntryListDrawerSeed: ExampleSeed = {
  name: 'crud-entry-list-drawer',
  description:
    'A CRUD entry-list — a List of named prompt sections, each row a Field-wrapped Switch (Field’s bindable label names the switch per item; Switch’s own label prop is not bindable) plus an Edit button opening a validated FormProvider inside an end-docked Drawer that sits beside the Card, and an add-from-library affordance built from action-carrying Buttons inside a Menu (never bare MenuItem, which carries no action slot and would commit nothing).',
  promptText:
    'Let me manage my prompt sections: each one has a toggle to turn it on or off, an Edit button that opens a side panel to change its name and content with validation, and a way to add new ones from a library of starter sections.',
  surfaceId: CRUD_ENTRY_LIST_ID,
  protocolVersion: 'v1.0',
  catalogId: 'agent-ui',
  messages: [
    { version: 'v1.0', createSurface: { surfaceId: CRUD_ENTRY_LIST_ID, catalogId: 'agent-ui', sendDataModel: true } },
    {
      version: 'v1.0',
      updateDataModel: {
        surfaceId: CRUD_ENTRY_LIST_ID,
        value: {
          sections: [
            { id: 'voice', label: 'Voice and tone', enabled: true },
            { id: 'research', label: 'Research method', enabled: true },
            { id: 'citations', label: 'Citation style', enabled: false },
          ],
          editingLabel: '',
          editingContent: '',
          drawerOpen: false,
          libraryMenuOpen: false,
        },
      },
    },
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: CRUD_ENTRY_LIST_ID,
        components: [
          // Trap 3 (module header): the Drawer is the Card's SIBLING, never CardContent's child.
          { id: 'root', component: 'Column', gap: 'md', children: ['card', 'edit_drawer'] },
          { id: 'card', component: 'Card', elevation: '1', children: ['hd', 'ct', 'ft'] },
          { id: 'hd', component: 'CardHeader', children: ['title'] },
          { id: 'title', component: 'Text', variant: 'h4', text: 'Prompt sections' },
          { id: 'ct', component: 'CardContent', children: ['list'] },
          // Trap 1 (module header): the Field wrap is what NAMES each templated switch — Field.label is
          // bindable (relative per-item bind), Switch.label is not, and an adjacent Text would only be
          // visually adjacent, never the switch's accessible name.
          { id: 'list', component: 'List', gap: 'sm', children: { path: '/sections', componentId: 'section_row' } },
          {
            id: 'section_row', component: 'Row', gap: 'md', justify: 'between', align: 'center',
            children: ['row_field', 'row_edit'],
          },
          { id: 'row_field', component: 'Field', label: { path: 'label' }, child: 'row_switch' },
          { id: 'row_switch', component: 'Switch', checked: { path: 'enabled' } },
          { id: 'row_edit', component: 'Button', variant: 'ghost', label: 'Edit', action: { action: 'edit_section' } },
          { id: 'edit_drawer', component: 'Drawer', edge: 'end', open: { path: '/drawerOpen' }, children: ['drawer_col'] },
          { id: 'drawer_col', component: 'Column', gap: 'md', children: ['drawer_title', 'form'] },
          { id: 'drawer_title', component: 'Text', variant: 'h4', text: 'Edit section' },
          { id: 'form', component: 'FormProvider', children: ['form_col'] },
          { id: 'form_col', component: 'Column', gap: 'md', children: ['f_label', 'f_content', 'form_actions'] },
          { id: 'f_label', component: 'Field', label: 'Name', child: 'in_label' },
          {
            id: 'in_label', component: 'TextField', name: 'label', required: true, value: { path: '/editingLabel' },
            checks: [{ call: 'required', args: { value: { path: '/editingLabel' } }, message: 'Name is required' }],
          },
          { id: 'f_content', component: 'Field', label: 'Content', child: 'in_content' },
          {
            id: 'in_content', component: 'Textarea', name: 'content', required: true, rows: 5, value: { path: '/editingContent' },
            checks: [{ call: 'required', args: { value: { path: '/editingContent' } }, message: 'Content is required' }],
          },
          { id: 'form_actions', component: 'Row', gap: 'md', justify: 'end', children: ['btn_save', 'btn_cancel'] },
          { id: 'btn_save', component: 'Button', variant: 'solid', label: 'Save section', action: { action: 'save_section', submit: true } },
          { id: 'btn_cancel', component: 'Button', variant: 'ghost', label: 'Cancel', action: { action: 'cancel_edit', wantResponse: false } },
          // Trap 2 (module header): rows are BUTTONS, each its own `action` carrying the picked library
          // id — never bare MenuItem, which has no wire-visible commit at all.
          {
            id: 'add_menu', component: 'Menu', placement: 'bottom-start', open: { path: '/libraryMenuOpen' },
            children: ['btn_add', 'mi_advanced_style', 'mi_fact_checking', 'mi_apa_citations'],
          },
          { id: 'btn_add', component: 'Button', variant: 'soft', label: 'Add from library' },
          {
            id: 'mi_advanced_style', component: 'Button', variant: 'ghost', label: 'Advanced style guide',
            action: { action: 'add_from_library', context: { libraryId: 'advanced-style' } },
          },
          {
            id: 'mi_fact_checking', component: 'Button', variant: 'ghost', label: 'Fact-checking checklist',
            action: { action: 'add_from_library', context: { libraryId: 'fact-checking' } },
          },
          {
            id: 'mi_apa_citations', component: 'Button', variant: 'ghost', label: 'APA citations',
            action: { action: 'add_from_library', context: { libraryId: 'apa-citations' } },
          },
          { id: 'ft', component: 'CardFooter', children: ['add_menu'] },
        ],
      },
    },
  ],
}

/** Every seed this module defines — the barrel's family-array precedent. */
export const crudEntryListSeeds: readonly ExampleSeed[] = [crudEntryListDrawerSeed]
