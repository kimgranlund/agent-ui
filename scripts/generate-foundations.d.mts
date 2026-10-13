/** Type surface for generate-foundations.mjs, shared by the CLI and foundations.test.ts (the
 *  generate-agent-assets.d.mts precedent: a `.mjs` runtime file paired with a sibling `.d.mts`). */
export const OUT_REL: string
export const ROOT_DEFAULT: boolean
export const ROOT_INPUTS: { readonly tier: string; readonly scale: string }
export function renderFoundationsCss(opts?: { rootDefault?: boolean }): string
export const BRIDGE_REL: string
export const LEGACY: Readonly<Record<string, string>>
export function recomputeList(rootDefault?: boolean): string
/** The control-local formulas the stylesheets apply over the derived tokens; M14 holds each to the same law. */
export const CONTROL_RULES: Record<string, (r: import('../packages/agent-ui/shared/src/tokens/scale.mjs').Resolved) => number>
/** scale.mjs check() (M1 to M13), then agent-ui's M14: no derived px quantity shrinks as n grows. */
export function contract(): string[]
export function renderBridgeCss(opts?: { rootDefault?: boolean }): string
