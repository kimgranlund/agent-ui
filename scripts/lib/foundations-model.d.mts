/** Type surface for foundations-model.mjs (T-0372, T-0373): the generator's inputs, resolve() (the sheet's tokens
 *  as px, plus the control surface anatomy) and the guards on both. */
import type { Density, Step, Tier } from '../../packages/agent-ui/shared/src/tokens/scale.mjs'

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
  linear: Record<'body' | 'control' | 'fieldLabel' | 'groupKicker', [number, number]>
}

export interface EmittedLevel {
  readonly margin: number
  readonly gutter: number
  readonly radius: number
}

/** The control anatomy (resolveControlSurface): a 3n slot per wrapper, the margin around it, and the icon and glyph
 *  artwork centered in square slots, at today's artwork sizes. Not emitted. */
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
  readonly inset: number
  readonly labelInset: number
  readonly radius: number
  readonly controlRadius: number
  readonly iconBox: number
  readonly glyphBox: number
  readonly glyphStroke: number
  readonly checkboxRadius: number
  readonly surface: ControlSurface
  readonly type: Readonly<Record<'display' | 'heading' | 'subhead' | 'sectionKicker' | 'title' | 'body' | 'control' | 'fieldLabel' | 'groupKicker', number>>
  readonly chip: EmittedLevel
  readonly group: EmittedLevel
  readonly widget: EmittedLevel
  readonly card: EmittedLevel
  readonly layout: EmittedLevel
}

export const LEGACY_PATH: {
  tiers: Record<Tier, [number, number, number, number]>
  density: Record<Density, number>
  linear: Record<'fieldLabel' | 'groupKicker', [number, number]>
}
export function anchors(): Anchors
export function heightPerN(a?: Anchors): number
export function roomyLevels(a?: Anchors): Array<[string, number, number]>
export function resolve(tier?: Tier, scale?: Step, size?: Step, density?: Density, a?: Anchors): Emitted
export function checkAnchors(a?: Anchors): string[]
export function checkEmitted(a?: Anchors): string[]
