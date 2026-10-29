// inert-prop-checks.ts: two prop-hygiene checks (T-0556, from the T-0546 conformance sweep), run on every catalog
// that holds their types.
//
// INERT_PROP: the Basic catalog keeps `TextField.validationRegexp` and `ChoicePicker.displayStyle` / `filterable` for
// upstream interop, but they render nothing here (ADR-0169 v1-inert: no pattern validation, both display styles draw the
// same dropdown, no filter field). The validator accepts them, so this check is what tells a producer they do not work.
// RECEIPT_TOTAL_PATH: a ConfirmReceipt draws its total row from `totalPath`; a `totalLabel` without one draws nothing
// (`confirmReceiptFactory`, default/factories.ts).
// Each fires only on a state this round brings (absent from the component the session's prior turns left), so a
// finished round is never sent back for history the model cannot repair.
// DOM-less and node-free, like `semantic-check.ts`: both server hosts import it.

import type { A2uiComponent } from '../protocol.ts'
import type { SemanticCheck, SemanticFinding, SurfaceView } from './semantic-check.ts'

/** Per component type, the props it declares that render nothing on this host. */
const INERT: Readonly<Record<string, readonly string[]>> = {
  TextField: ['validationRegexp'],
  ChoicePicker: ['displayStyle', 'filterable'],
}

/** Whether `c` sets `prop` and the component the prior turns left under the same id did not. */
const added = (view: SurfaceView, c: A2uiComponent, prop: string): boolean =>
  c[prop] !== undefined && view.priorComponents?.get(c.id)?.[prop] === undefined

/** A ConfirmReceipt with a `totalLabel` and no usable `totalPath`. */
const labelOnly = (c: A2uiComponent): boolean => c['totalLabel'] !== undefined && (typeof c['totalPath'] !== 'string' || c['totalPath'] === '')

const list = (words: readonly string[]): string => words.join(' and ')

export const inertPropCheck: SemanticCheck = {
  id: 'inert-prop',
  requires: ['TextField', 'ChoicePicker'],
  check({ surfaces }): readonly SemanticFinding[] {
    const findings: SemanticFinding[] = []
    for (const view of surfaces) {
      for (const c of view.components.values()) {
        const props = (INERT[c.component] ?? []).filter((p) => added(view, c, p))
        if (props.length === 0) continue
        findings.push({
          code: 'INERT_PROP',
          path: `${view.surfaceId}:${c.id}`,
          message:
            `${view.surfaceId} sets ${list(props)} on ${c.component} ${c.id}, which this catalog accepts for interop but renders nothing for ` +
            `(no pattern validation, one dropdown look, no filter field). Drop ${list(props)} from ${c.id}.`,
        })
      }
    }
    return findings
  },
}

export const receiptTotalCheck: SemanticCheck = {
  id: 'receipt-total-path',
  requires: ['ConfirmReceipt'],
  check({ surfaces }): readonly SemanticFinding[] {
    const findings: SemanticFinding[] = []
    for (const view of surfaces) {
      for (const c of view.components.values()) {
        if (c.component !== 'ConfirmReceipt' || !labelOnly(c)) continue
        const prior = view.priorComponents?.get(c.id)
        if (prior !== undefined && labelOnly(prior)) continue // already shipped this way
        findings.push({
          code: 'RECEIPT_TOTAL_PATH',
          path: `${view.surfaceId}:${c.id}`,
          message:
            `${view.surfaceId} gives ConfirmReceipt ${c.id} a totalLabel with no totalPath, so it draws no total row. ` +
            `Add totalPath (the data model path of the order total) beside totalLabel, or drop totalLabel.`,
        })
      }
    }
    return findings
  },
}
