// inert-prop-checks.test.ts: T-0556's two prop-hygiene checks. INERT_PROP sends back a Basic TextField
// `validationRegexp` or a ChoicePicker `displayStyle` / `filterable`, declared for upstream interop but rendering
// nothing here (ADR-0169 v1-inert). RECEIPT_TOTAL_PATH sends back a ConfirmReceipt `totalLabel` with no `totalPath`,
// which draws no total row. Each fires only on a prop this round adds, never on history the model cannot repair.

import { describe, expect, it } from 'vitest'
import { inertPropCheck, receiptTotalCheck } from './inert-prop-checks.ts'
import { gateChecksOnCatalog, runSemanticChecks } from './semantic-check.ts'
import type { SemanticCheck, SurfaceView } from './semantic-check.ts'
import type { A2uiComponent } from '../protocol.ts'
import { loadCatalog } from './catalog.ts'
import defaultCatalogRaw from './default/catalog.json'
import basicCatalogRaw from './a2ui-basic/catalog.json'

const view = (components: A2uiComponent[], prior?: A2uiComponent[]): SurfaceView => ({
  surfaceId: 's-1',
  components: new Map(components.map((c) => [c.id, c])),
  dataModel: undefined,
  ...(prior !== undefined ? { priorComponents: new Map(prior.map((c) => [c.id, c])) } : {}),
})
const findings = (check: SemanticCheck, components: A2uiComponent[], prior?: A2uiComponent[]) =>
  runSemanticChecks([check], { surfaces: [view(components, prior)] }).findings

const email: A2uiComponent = { id: 'email', component: 'TextField', label: 'Email', value: { path: '/email' }, variant: 'shortText' }
const topic: A2uiComponent = { id: 'topic', component: 'ChoicePicker', label: 'Topic', options: [{ label: 'Billing', value: 'billing' }], value: { path: '/topic' } }
const receipt: A2uiComponent = { id: 'receipt', component: 'ConfirmReceipt', title: 'Your order', items: [], status: 'pending' }

describe('inertPropCheck (T-0556 L1)', () => {
  it('flags each inert prop a round adds, naming the component and the prop to drop', () => {
    const f = findings(inertPropCheck, [{ ...email, validationRegexp: '^.+@.+$' }, { ...topic, displayStyle: 'chips', filterable: true }])
    expect(f.map((x) => [x.code, x.path])).toEqual([
      ['INERT_PROP', 's-1:email'],
      ['INERT_PROP', 's-1:topic'],
    ])
    expect(f[0]!.message).toMatch(/\bvalidationRegexp\b/)
    expect(f[1]!.message).toMatch(/\bdisplayStyle\b.*\bfilterable\b/)
  })

  it('stays quiet on the same components without the inert props, and on a prop an earlier round already shipped', () => {
    expect(findings(inertPropCheck, [email, topic])).toEqual([])
    const old = { ...email, validationRegexp: '^.+@.+$' }
    expect(findings(inertPropCheck, [old], [old])).toEqual([])
  })

  it('rides a2ui-basic only (the default catalog declares neither ChoicePicker nor the inert props)', () => {
    expect(gateChecksOnCatalog([inertPropCheck], loadCatalog(basicCatalogRaw))).toEqual([inertPropCheck])
    expect(gateChecksOnCatalog([inertPropCheck], loadCatalog(defaultCatalogRaw))).toEqual([])
  })
})

describe('receiptTotalCheck (T-0556 L3)', () => {
  it('flags a totalLabel with no totalPath (or an empty one)', () => {
    for (const totalPath of [undefined, '']) {
      const c = { ...receipt, totalLabel: 'Total', ...(totalPath !== undefined ? { totalPath } : {}) }
      const [f, ...rest] = findings(receiptTotalCheck, [c])
      expect(rest).toEqual([])
      expect(f?.code).toBe('RECEIPT_TOTAL_PATH')
      expect(f?.path).toBe('s-1:receipt')
      expect(f?.message).toMatch(/\btotalPath\b/)
    }
  })

  it('stays quiet with both props, with neither, and on a receipt an earlier round already shipped', () => {
    expect(findings(receiptTotalCheck, [{ ...receipt, totalLabel: 'Total', totalPath: '/cart/total' }])).toEqual([])
    expect(findings(receiptTotalCheck, [receipt])).toEqual([])
    const old = { ...receipt, totalLabel: 'Total' }
    expect(findings(receiptTotalCheck, [old], [old])).toEqual([])
  })

  it('rides the default catalog (a2ui-basic has no ConfirmReceipt)', () => {
    expect(gateChecksOnCatalog([receiptTotalCheck], loadCatalog(defaultCatalogRaw))).toEqual([receiptTotalCheck])
    expect(gateChecksOnCatalog([receiptTotalCheck], loadCatalog(basicCatalogRaw))).toEqual([])
  })
})
