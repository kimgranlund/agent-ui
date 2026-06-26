// renderer — the @agent-ui/a2ui renderer subsystem public surface. So far: the shared validator
// (LLD-C11) and the surface model (LLD-C3); the stream/dispatch/tree/binding/widget pipeline follows.
export { validateA2ui } from './validate.ts'
export type { ValidationVerdict } from './validate.ts'
export { createSurface, disposeSurface, SurfaceStore } from './surface.ts'
export type { Surface, SurfaceInit } from './surface.ts'
