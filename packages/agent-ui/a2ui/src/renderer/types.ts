// types.ts — renderer inter-module signature types (renderer LLD-C7, SPEC-R9).
//
// The runtime-free call-signatures that one renderer build slice compiles against while a sibling
// slice's implementation is still being built in an isolated worktree. Only the signatures that cross
// a slice boundary live here; module-internal types stay in their own module. `import type` only.

import type { A2uiComponent } from '../protocol.ts'
import type { Surface } from './surface.ts'

/**
 * Resolve + instantiate the live control for one component node (renderer LLD-C7, SPEC-R9). Looks the
 * `node.component` type up in the surface's catalog, instantiates the `WidgetFactory`'s element, sets
 * static props, and installs a scope-owned effect per bound prop. An unknown type emits `error{CATALOG}`
 * and returns a non-fatal placeholder so siblings still render (SPEC-R9 AC2) — hence it always returns
 * an element. The tree reconstructor (renderer LLD-C4) calls this; pinned so the tree slice can build
 * against a stub while the widget slice is built in parallel.
 */
export type CreateWidget = (node: A2uiComponent, surface: Surface) => HTMLElement
