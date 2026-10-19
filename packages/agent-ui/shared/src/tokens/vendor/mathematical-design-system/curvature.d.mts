/** Type surface for curvature.mjs, the byte-for-byte vendored copy of the mathematical-design-system skill's radius
 *  policy (`scripts/lib/curvature.mjs`, T-0372). The `.mjs` stays untouched; its types live here. No token reads it
 *  yet: the radius presets reach the library in T-0374. */
export interface Frame {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

export interface RadiusLayer {
  readonly width: number
  readonly height: number
  readonly cap: number
  readonly offset: number
  readonly radius: number
  readonly candidate: number
  readonly floor: number
  readonly parentRadius: number | null
  readonly referenceHeight: number
  readonly inset: number
  readonly physicalExcess: number
}

export const radiusPercentagePresets: Record<'sharp' | 'crisp' | 'balanced' | 'round', number>

export function resolvePercentageRadiusGroup(opts: {
  amount?: number
  retained?: number
  family?: 'control' | 'container'
  rootMargin?: number
  parentRadius?: number
  frames: readonly Frame[]
  referenceHeights?: readonly number[]
  mode?: 'standalone' | 'nested' | 'pill'
}): {
  mode: string
  layers: RadiusLayer[]
  totalInset: number
  issues: string[]
  valid: boolean
  amount: number
  retained: number
  family: string
  rootMargin: number
}
