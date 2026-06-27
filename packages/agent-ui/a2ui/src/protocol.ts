// protocol.ts — A2UI v1.0 wire contracts shared by the renderer and catalog subsystems.
//
// These are protocol facts (Constraint C1), transcribed from the runtime SPEC §5.1/§5.2 and the
// catalog component model — not design choices. They live at the package root so both `src/renderer`
// and `src/catalog` import them *downward*: `validate.ts` (renderer) composes catalog `conformance.ts`,
// and `conformance.ts` needs the component + failure shapes, so a shared root avoids a renderer↔catalog
// import cycle while keeping one definition of the wire types.

/** Client→server error codes (runtime SPEC §5.2). Catalog-load diagnostics live in `catalog/catalog.ts`. */
export type ErrorCode =
  | 'PARSE'
  | 'SCHEMA'
  | 'CATALOG'
  | 'CATALOG_UNKNOWN'
  | 'IDGRAPH'
  | 'POINTER'
  | 'VERSION_UNSUPPORTED'
  | 'FUNCTION'

/** A structured client→server error payload (runtime SPEC §5.2). */
export interface A2uiError {
  code: ErrorCode
  surfaceId?: string
  path?: string
  message: string
}

/** A bound value: a literal, or a JSON-Pointer reference (RFC 6901), relative in child scope. */
export type Binding<T> = T | { path: string }

/** A flat adjacency-list component node (runtime SPEC §5.1). */
export interface A2uiComponent {
  id: string
  component: string
  child?: string
  children?: string[]
  [prop: string]: unknown
}

/** Inbound server→client envelopes (runtime SPEC §5.1). */
export interface A2uiCreateSurface {
  surfaceId: string
  catalogId: string
  surfaceProperties?: object
  theme?: object
  sendDataModel?: boolean
}
export interface A2uiUpdateComponents {
  surfaceId: string
  components: A2uiComponent[]
}
export interface A2uiUpdateDataModel {
  surfaceId: string
  path?: string
  value?: unknown
}
export interface A2uiDeleteSurface {
  surfaceId: string
}
export interface A2uiActionResponse {
  surfaceId: string
  actionId: string
  value?: unknown
  error?: A2uiError
}

export type A2uiServerMessage =
  | { version: string; createSurface: A2uiCreateSurface }
  | { version: string; updateComponents: A2uiUpdateComponents }
  | { version: string; updateDataModel: A2uiUpdateDataModel }
  | { version: string; deleteSurface: A2uiDeleteSurface }
  | { version: string; actionResponse: A2uiActionResponse }

/** An ordered A2UI message stream — the generated/streamed output (corpus LLD `A2uiOutput`). */
export type A2uiOutput = A2uiServerMessage[]

/**
 * Supported protocol versions — the pinned set every inbound message's `version` is gated against
 * (runtime SPEC-R13: default v1.0, v0.9.1 supported). The SINGLE source shared by the dispatch router
 * (LLD-C2) and the shared validator (LLD-C11) so the two can't drift on which versions are routable.
 */
export const SUPPORTED_VERSIONS: ReadonlySet<string> = new Set(['v1.0', 'v0.9.1'])

// Outbound client→server envelopes (runtime SPEC §5.2). The `error` arm (`A2uiErrorMessage`) is the
// renderer host's (it owns error emission); the `action` arm's wire types live here with the rest of
// the contract so the action dispatcher (LLD-C9) and the host import one definition.

/** The v1.0 `action` body the renderer sends on a triggered action (runtime SPEC §5.2). */
export interface A2uiAction {
  surfaceId: string
  actionId: string
  name: string
  sourceComponentId: string
  timestamp: string
  context: Record<string, unknown>
  wantResponse?: boolean
  dataModel?: unknown
}

/** The `action` client→server envelope (runtime SPEC §5.2). */
export interface A2uiActionMessage {
  version: string
  action: A2uiAction
}

/** One validation failure: a wire error code paired with the offending location. */
export interface Failure {
  code: ErrorCode
  path: string
}
