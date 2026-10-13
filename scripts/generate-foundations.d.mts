/** Type surface for generate-foundations.mjs, shared by the CLI and foundations.test.ts (the
 *  generate-agent-assets.d.mts precedent: a `.mjs` runtime file paired with a sibling `.d.mts`). */
export const OUT_REL: string
export const ROOT_DEFAULT: boolean
export const ROOT_INPUTS: { readonly tier: string; readonly scale: string }
export function renderFoundationsCss(opts?: { rootDefault?: boolean }): string
export const BRIDGE_REL: string
export const LEGACY: Readonly<Record<string, string>>
export function recomputeList(rootDefault?: boolean): string
export function renderBridgeCss(opts?: { rootDefault?: boolean }): string
