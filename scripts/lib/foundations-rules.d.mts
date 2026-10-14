/** Type surface for the TS readers of foundations-rules.mjs (the generate-foundations.d.mts precedent): the glyph
 *  floor helper (ADR-0245 Amendment 7), the page root register (Amendment 8), which the browser tests share
 *  with the generator, and the dogfood allowlist owner check (T-0170). */
import type { Density, Resolved, Step, Tier } from '../../packages/agent-ui/shared/src/tokens/scale.mjs'

export const GLYPH_FLOOR: number
export function glyphBox(r: { readonly glyph: number }): number
export const ROOT_REGISTER: { readonly tier: Tier; readonly scale: Step }
export const STEP: Readonly<Record<Step, number>>
export function rootResolve(size?: Step, density?: Density): Resolved
export const OWNER_REF: RegExp
export function hasOwner(why: unknown): boolean
