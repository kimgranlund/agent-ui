// renderer — the @agent-ui/a2ui renderer subsystem public surface (renderer LLD §10). The host
// (LLD-C13) is the entry the wave-4 canvas consumes (`createRenderer`); the stream/dispatch/tree/
// widget/action/surface/validate pieces are re-exported for the transport + corpus callers and for
// composing a custom host.
export { createRenderer } from './renderer.ts'
export type { RendererHost, RendererOptions, ClientMessageListener, A2uiClientMessage, A2uiErrorMessage } from './renderer.ts'

export { dispatch } from './dispatch.ts'
export type { DispatchHandlers } from './dispatch.ts'

export { parseLine, ParseError, isParseError } from './parser.ts'

export { SurfaceTree } from './tree.ts'
export type { TreeDeps, UpdateComponentsMessage } from './tree.ts'

export { makeCreateWidget } from './widget.ts'
export type { WidgetDeps } from './widget.ts'

export { ActionDispatcher } from './action.ts'
export type { A2uiAction, A2uiActionMessage, ActionDeps, EmitActionOptions } from './action.ts'

export { createSurface, disposeSurface, SurfaceStore } from './surface.ts'
export type { Surface, SurfaceInit } from './surface.ts'

export { validateA2ui } from './validate.ts'
export type { ValidationVerdict } from './validate.ts'

export type { CreateWidget } from './types.ts'
