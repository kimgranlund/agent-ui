/** Type surface for foundations-model.mjs (T-0372): the generator's inputs and resolve(), the sheet's tokens as px. */
import type { Density, Step, Tier } from '../../packages/agent-ui/shared/src/tokens/scale.mjs'

export interface Anchors {
  heightPerN: number
  iconPerN: number
  containers: Record<'widget' | 'card' | 'layout', number>
  Q: [number, number]
  floor: number
  titleBump: Record<Step, number>
  kicker: number
  linear: Record<'body' | 'control' | 'fieldLabel' | 'groupLabel', [number, number]>
}

export interface EmittedLevel {
  readonly margin: number
  readonly gutter: number
  readonly radius: number
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
  readonly type: Readonly<Record<'display' | 'heading' | 'subhead' | 'sectionLabel' | 'title' | 'body' | 'control' | 'fieldLabel' | 'groupLabel', number>>
  readonly chip: EmittedLevel
  readonly group: EmittedLevel
  readonly widget: EmittedLevel
  readonly card: EmittedLevel
  readonly layout: EmittedLevel
}

export const LEGACY_PATH: {
  tiers: Record<Tier, [number, number, number, number]>
  density: Record<Density, number>
  levels: Record<string, [string, string?, string?]>
  linear: Record<'fieldLabel' | 'groupLabel', [number, number]>
}
export function anchors(): Anchors
export function roomyLevels(a?: Anchors): Array<[string, number, number]>
export function resolve(tier?: Tier, scale?: Step, size?: Step, density?: Density, a?: Anchors): Emitted
export function checkAnchors(a?: Anchors): string[]
