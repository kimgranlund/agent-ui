// fixtures.ts — shared test material (a small valid catalog document + its loaded form).
// Imported by the catalog / conformance / validate test suites; not executed itself.

import { loadCatalog, type Catalog } from './catalog/catalog.ts'

/** A minimal but representative catalog document: primitives, an input, and two container models. */
export const demoCatalogDoc = {
  catalogId: 'demo',
  protocolVersion: 'v1.0',
  components: {
    Text: {
      properties: {
        text: { type: { type: 'string' }, bindable: true, mapsTo: 'textContent' },
        variant: { type: { type: 'string' }, mapsTo: 'variant' },
      },
    },
    Button: {
      properties: {
        label: { type: { type: 'string' }, bindable: true, mapsTo: 'textContent' },
        variant: { type: { type: 'string' }, mapsTo: 'variant' },
        disabled: { type: { type: 'boolean' }, mapsTo: 'disabled' },
      },
    },
    TextField: {
      properties: {
        label: { type: { type: 'string' }, mapsTo: 'label' },
        value: { type: { type: 'string' }, bindable: true, mapsTo: 'value' },
        maxLength: { type: { type: 'integer' }, mapsTo: 'maxLength' },
      },
      value: { prop: 'value', event: 'input' },
    },
    Column: {
      properties: {},
      children: 'children',
    },
    Card: {
      properties: {},
      children: 'child',
    },
  },
  // Named args per ADR-0026 (corrected from the prior positional JsonSchema[] shape).
  functions: {
    required: { args: { value: { type: ['string', 'null'] } }, returns: { type: 'object' } },
    email: { args: { value: { type: 'string' } }, returns: { type: 'object' } },
    regex: { args: { value: { type: 'string' }, pattern: { type: 'string' } }, returns: { type: 'object' } },
  },
} as const

export const demoCatalog: Catalog = loadCatalog(demoCatalogDoc)
