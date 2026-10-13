/** Type surface for scale.mjs, the byte-for-byte vendored copy of the mathematical-design-system skill's
 *  reference implementation (ADR-0245 clause 1). The `.mjs` stays untouched; its types live here. */
export type Step = 'sm' | 'md' | 'lg'
export type Tier = 'widget' | 'product' | 'content' | 'brand'
export type Role =
  | 'display' | 'heading' | 'subhead' | 'sectionKicker' | 'title' | 'body' | 'control' | 'fieldLabel' | 'groupKicker'

export interface Level {
  readonly margin: number
  readonly gutter: number
  readonly radius: number
}

export interface Resolved {
  readonly tier: string
  readonly scale: string
  readonly size: string
  readonly n: number
  readonly h: number
  readonly inset: number
  readonly icon: number
  readonly radius: number
  readonly c: number
  readonly glyph: number
  readonly type: Readonly<Record<Role, number>>
  readonly group: Level
  readonly widget: Level
  readonly card: Level
  readonly layout: Level
}

export const CFG: {
  ladder: [number, number]
  tiers: Record<Tier, [number, number, number, number]>
  linear: Record<'body' | 'control' | 'fieldLabel' | 'groupKicker', [number, number]>
  Q: [number, number]
  kicker: number
  titleBump: Record<Step, number>
  floor: number
  levels: Record<'widget' | 'card' | 'layout', [number, number, number]>
}

export function resolve(tier?: string, scale?: string, size?: string): Resolved
export function check(): string[]
