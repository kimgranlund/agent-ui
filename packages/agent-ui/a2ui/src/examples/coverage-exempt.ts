// coverage-exempt.ts: the explicit allowlist of the every-catalog coverage gate (`every-catalog-coverage.test.ts`).
// Keyed by catalog id, then by component type, each entry naming why that type has no seed. The gate's residue
// leg fails on an entry whose catalog id is not shipped, whose type is not one of that catalog's own types, or
// whose type a seed now renders, so an exemption cannot outlive its reason.

/** Catalog id to component type to the reason no seed renders it. */
export const CATALOG_COVERAGE_EXEMPT: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  'a2ui-basic': {
    Card: 'Basic Card wraps one child and has no header or footer slots (basic-exemplars.ts module header).',
  },
  'agent-ui--hospitality': {
    BookingConfirmation:
      'On agent-ui a confirmed booking settles its BookingForm in place as a ConfirmReceipt (grammar G2b, T-0397, T-0403), so ' +
      'no agent-ui seed shows a BookingConfirmation; persona-basic-concierge-booking-confirmed previews it on a2ui-basic--hospitality.',
  },
}
