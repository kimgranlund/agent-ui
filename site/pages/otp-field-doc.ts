// site/pages/otp-field-doc.ts — the ui-otp-field API doc page (code-entry-control.lld.md, GH #490 S2-a).
// DERIVED from `otp-field.md` via the shared doc-page.ts renderer (composeDocPage threads the attribute/
// properties/events/parts tables through for free — including the Parts section the site-coverage
// parts-render gate requires). Only the live specimens are hand-authored here.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import { loadOtpFieldDoc } from '../lib/frontmatter.ts'
import { composeDocPage, findAttr, heading, specimenRow } from '../lib/doc-page.ts'
import type { ParsedDescriptor } from '@agent-ui/components/descriptor'

const { descriptor, body } = loadOtpFieldDoc()

const { content } = mountPage({
  title: 'ui-otp-field — API',
  intro: 'The identity family\'s one Lane-A control (code-entry-control.lld.md, GH #490 S2-a) — a segmented ' +
    'N-cell one-time-code entry field, ONE focusable editable surface with N presentational cells. This page ' +
    'is generated from otp-field.md: the API table and the size specimens are derived from the same ' +
    'frontmatter the contract trip-wire validates, so they cannot drift; see the Permutations and States ' +
    'pages for the full size/length matrix and the live interaction states. Permanently excluded from the ' +
    'A2UI default catalog (ADR-0176 cl.3) — a credential-bearing control is host-page-only, never agent-emittable.',
})

composeDocPage(content, descriptor, body, renderExamples(descriptor))

// ── live specimens (derived from the parsed `size` enum) ────────────────────────────────────────────────

function renderExamples(d: ParsedDescriptor): HTMLElement {
  const section = document.createElement('section')
  section.append(heading(2, 'Examples'))

  const size = findAttr(d, 'size')
  if (size?.values) {
    section.append(
      heading(3, 'Sizes'),
      specimenRow(size.values.map((s) => otpField({ label: `size = ${s}`, size: s }))),
    )
  }

  section.append(
    heading(3, 'Lengths'),
    specimenRow([
      otpField({ label: '4-digit PIN', length: '4' }),
      otpField({ label: '6-digit code (default)' }),
      otpField({ label: '8-digit code', length: '8' }),
    ]),
  )

  section.append(
    heading(3, 'States'),
    specimenRow([
      otpField({ label: 'Empty' }),
      otpField({ label: 'Partially filled', value: '42' }),
      otpField({ label: 'Complete', value: '424242' }),
      otpField({ label: 'Required', required: true }),
      otpField({ label: 'Disabled', value: '424242', disabled: true }),
    ]),
  )

  return section
}

interface OtpFieldSpec {
  readonly label: string
  readonly value?: string
  readonly length?: string
  readonly size?: string
  readonly required?: boolean
  readonly disabled?: boolean
}

function otpField(spec: OtpFieldSpec): HTMLElement {
  const el = document.createElement('ui-otp-field')
  el.setAttribute('label', spec.label)
  if (spec.value !== undefined) el.setAttribute('value', spec.value)
  if (spec.length) el.setAttribute('length', spec.length)
  if (spec.size) el.setAttribute('size', spec.size)
  if (spec.required) el.setAttribute('required', '')
  if (spec.disabled) el.setAttribute('disabled', '')
  return el
}
