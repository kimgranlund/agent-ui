import type { IconPack } from '../types.ts'
import { iconRegistry } from '../registry.ts'
import { phosphorIcons } from './icons.gen.ts'

export const phosphorPack: IconPack = { id: 'phosphor', viewBox: '0 0 256 256', icons: phosphorIcons }

// Self-register + activate on import (the fleet's self-define-on-import idiom; ADR-0066 clause 4).
iconRegistry.registerPack(phosphorPack)
