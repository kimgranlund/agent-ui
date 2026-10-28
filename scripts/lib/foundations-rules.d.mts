/** Type surface for the TS readers of foundations-rules.mjs (the generate-foundations.d.mts precedent): the glyph
 *  box helper (n + 6, T-0374), the page root register (Amendment 8), which the browser tests share
 *  with the generator, the dogfood allowlist owner check (T-0170), the derived-token set (T-0169) and the renamed type
 *  labels (T-0373). */
import type { Step, Tier } from './foundations-model.mjs'

export const DERIVED: ReadonlySet<string>
export const RENAMED: Readonly<Record<string, string>>
export interface Finding { readonly index: number; readonly text: string }
export function findingsIn(path: string, src: string): Record<'tokens' | 'px' | 'glyph' | 'axes', Finding[]>
export function glyphBox(r: { readonly n: number }): number
export const ROOT_REGISTER: { readonly tier: Tier; readonly scale: Step }
export const STEP: Readonly<Record<Step, number>>
export const OWNER_REF: RegExp
export function hasOwner(why: unknown): boolean
