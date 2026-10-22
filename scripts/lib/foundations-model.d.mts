/** Type surface for foundations-model.mjs (T-0372, T-0373, T-0374): the generator's inputs, resolve() (the sheet's tokens
 *  as px, plus the control surface anatomy) and the guards on both. */
import type { Density, Step, Tier } from '../../packages/agent-ui/shared/src/tokens/vendor/mathematical-design-system/scale.mjs'

/** The axes resolve() takes, the vendored resolver's: density is its five names, tight to loose (T-0374 step 4). */
export type { Density, Step, Tier }

export type SpacingRole = 'page' | 'container' | 'group' | 'control'

export interface Anchors {
  slotPerN: number
  marginPerN: number
  iconPerN: number
  marginReference: number
  roles: Record<SpacingRole, number>
  Q: [number, number]
  floor: number
  titleBump: Record<Step, number>
  kicker: number
  linear: Record<'body' | 'control' | 'fieldLabel' | 'smallControl' | 'groupKicker', [number, number]>
  /** The vendored curvature percentages (0 to 100) and the preset resolve() reads (T-0374 step 6). */
  radiusPresets: Record<'sharp' | 'crisp' | 'balanced' | 'round', number>
  radiusPreset: RadiusPreset
}

/** The `data-radius` values: the four percentage presets plus pill (the control family at h/2). */
export type RadiusPreset = 'sharp' | 'crisp' | 'balanced' | 'round' | 'pill'

export interface EmittedLevel {
  readonly margin: number
  readonly gutter: number
  readonly radius: number
}

/** The control anatomy (resolveControlSurface): a 3n slot per wrapper, the margin around it, and the icon (2n) and
 *  glyph (n + 6) artwork centered in square slots. Height, margin, icon, glyph and slot are emitted. */
export interface ControlSurface {
  readonly slot: number
  readonly margin: number
  readonly height: number
  readonly icon: number
  readonly iconInset: number
  readonly glyph: number
  readonly glyphInset: number
}

export interface Emitted {
  readonly n: number
  readonly m: number
  readonly c: number
  readonly height: number
  readonly controlMargin: number
  readonly inset: number
  readonly labelInset: number
  readonly radius: number
  readonly controlRadius: number
  /** T-0374 step 7: the wrapper padding W = n/4 and the label-edge compensation max(0, R - m - W). */
  readonly controlGutter: number
  readonly labelCompensation: number
  readonly iconBox: number
  readonly glyphBox: number
  readonly glyphSlot: number
  readonly glyphStroke: number
  readonly checkboxRadius: number
  readonly surface: ControlSurface
  readonly type: Readonly<Record<'display' | 'heading' | 'subhead' | 'sectionKicker' | 'title' | 'body' | 'control' | 'fieldLabel' | 'smallControl' | 'groupKicker', number>>
  readonly chip: EmittedLevel
  readonly group: EmittedLevel
  readonly widget: EmittedLevel
  readonly card: EmittedLevel
  readonly layout: EmittedLevel
}

export const LEGACY_PATH: {
  linear: Record<'groupKicker', [number, number]>
}
export function anchors(): Anchors
export const RADIUS_PRESETS: RadiusPreset[]
export function radiusAmounts(preset?: RadiusPreset, a?: Anchors): { container: number; control: number }
export function radiusFailures(a?: Anchors): string[]
export function heightPerN(a?: Anchors): number
export function marginPerNAt(density?: Density, a?: Anchors): number
export function containerUnit(n: number, density?: Density): number
export function widgetOverGroup(a?: Anchors, unit?: (n: number, density: Density) => number): string[]
export function roomyLevels(a?: Anchors): Array<[string, number, number]>
export function resolve(tier?: Tier, scale?: Step, size?: Step, density?: Density, a?: Anchors): Emitted
export function checkAnchors(a?: Anchors): string[]
export function checkEmitted(a?: Anchors): string[]
