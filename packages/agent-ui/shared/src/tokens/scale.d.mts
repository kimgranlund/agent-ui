/** Type surface for scale.mjs, the byte-for-byte vendored copy of the mathematical-design-system skill's
 *  reference implementation (ADR-0245 clause 1, Amendment 3). The `.mjs` stays untouched; its types live here.
 *  The skill keeps its own role keys (`sectionKicker`, `groupKicker`); the tokens name them section label and
 *  group label (`--md-sys-type-section-label`, `--md-sys-type-group-label`). */
export type Step = 'sm' | 'md' | 'lg'
export type Tier = 'widget' | 'product' | 'content' | 'brand'
export type Density = 'compact' | 'default' | 'spacious'
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
  readonly density: string
  readonly n: number
  /** The container unit: n moved one tier step `a` by density, floored (widget, card and layout read it). */
  readonly m: number
  readonly h: number
  readonly minWidth: number
  readonly inset: number
  readonly icon: number
  readonly radius: number
  readonly c: number
  readonly glyph: number
  readonly gap: number
  readonly labelInset: number
  readonly type: Readonly<Record<Role, number>>
  readonly group: Level
  readonly widget: Level
  readonly card: Level
  readonly layout: Level
}

export const CFG: {
  ladder: [number, number]
  tiers: Record<Tier, [number, number, number, number]>
  density: Record<Density, number>
  linear: Record<'body' | 'control' | 'fieldLabel' | 'groupKicker', [number, number]>
  Q: [number, number]
  kicker: number
  titleBump: Record<Step, number>
  floor: number
  levels: Record<'widget' | 'card' | 'layout', [number, number, number]>
}

export function resolve(tier?: string, scale?: string, size?: string, density?: string): Resolved
export function check(): string[]
