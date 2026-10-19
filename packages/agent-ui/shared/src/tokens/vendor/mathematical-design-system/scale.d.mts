/** Type surface for scale.mjs, the byte-for-byte vendored copy of the mathematical-design-system skill's current
 *  resolver (`scripts/lib/scale.mjs`, T-0372). The `.mjs` stays untouched; its types live here. Lengths stay
 *  unrounded floats; the generator rounds only at CSS emission. The repo's own resolver is `tokens/scale.mjs`. */
export type Step = 'sm' | 'md' | 'lg'
export type Tier = 'widget' | 'product' | 'content' | 'brand'
export type Density = 'tight' | 'compact' | 'regular' | 'spacious' | 'loose'
export type Container = 'tile' | 'card' | 'section'
export type Role =
  | 'display' | 'heading' | 'subhead' | 'sectionKicker' | 'title' | 'body' | 'control' | 'fieldLabel' | 'groupKicker' | 'smallControl'

export const CFG: {
  ladder: [number, number]
  tiers: Record<Tier, [number, number, number, number]>
  linear: Record<'body' | 'control' | 'fieldLabel' | 'groupKicker' | 'smallControl', [number, number]>
  Q: [number, number]
  kicker: number
  titleBump: Record<Step, number>
  floor: number
}
export const CONTAINER_FACTORS: Record<Container, number>
export const DENSITIES: Record<Density, number>
export const SPACING_ROLES: Readonly<Record<'page' | 'container' | 'group' | 'control', number>>

export interface ControlSurface {
  readonly innerHeight: number
  readonly slotHeight: number
  readonly slotPadding: number
  readonly iconSlotWidth: number
  readonly iconInset: number
  readonly iconContentSeparation: number
  readonly glyphSlotWidth: number
  readonly glyphInset: number
  readonly glyphContentSeparation: number
  readonly slotGap: number
  readonly contentSeparation: number
  readonly margin: number
  readonly gutter: number
  readonly height: number
  readonly icon: number
  readonly glyph: number
}

export interface Geometry {
  readonly tier: Tier
  readonly scale: Step
  readonly size: Step
  readonly density: Density
  readonly n: number
  readonly d: number
  readonly c: number
  readonly surface: ControlSurface
  readonly containers: Readonly<Record<Container, { readonly margin: number }>>
  readonly groupMarginReference: number
  readonly type: Readonly<Record<Role, number>>
  readonly table: { readonly cellMargin: number; readonly clearance: number; readonly rowHeight: number }
}

export interface Spacing {
  readonly margin: number
  readonly gutter: number
}

export function resolveGeometry(tier?: Tier, scale?: Step, size?: Step, density?: Density): Geometry
export function resolveControlSurface(n: number, density?: Density, gutterPercent?: number): ControlSurface
export function composeContainer(margin: number, gutterPercent?: number): Spacing
export function resolveSpacingRoles(
  marginReference: number,
  opts?: {
    pagePercent?: number
    containerPercent?: number
    groupPercent?: number
    controlPercent?: number
    controlMargin?: number
    controlUnit?: number
    controlGutter?: number
  },
): {
  page: Spacing
  container: Spacing
  group: { margin: number; marginReference: number; gutter: number }
  control: { margin: number; marginReference: number; gutter: number; slotPadding: number; slotGap: number }
}
export function resolveButtonPadding(opts: {
  margin: number
  wrapperInset: number
  radius: number
  hasLeading?: boolean
  hasTrailing?: boolean
}): { inlinePadding: number; compensation: number; labelStart: number; labelEnd: number; exposedLabelInset: number }
