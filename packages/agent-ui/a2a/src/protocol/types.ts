// types.ts — the typed A2A wire model (LLD-C1). Zero-dep, zero behavior: three small consts + types
// only. Field names/shapes are transcribed verbatim from the SPEC §2 HV-4/HV-5/HV-7/HV-11/HV-12
// resolutions (cross-checked against the pinned `types/src/types.ts@v0.3.0`). `erasableSyntaxOnly` bans
// `enum` — states are a literal union over an `as const` tuple, discriminators are literal fields.

/** The pinned protocol version (PRD-D3; SPEC-R2). Every pin-bearing artifact (the card, B1) is checked
 * against this constant by `validateA2a`. */
export const PROTOCOL_VERSION = '0.3.0'

/** The full 9-member TaskState set (HV-5, confirmed against upstream `TaskState` enum). */
export const TASK_STATES = [
  'submitted',
  'working',
  'input-required',
  'completed',
  'canceled',
  'failed',
  'rejected',
  'auth-required',
  'unknown',
] as const
export type TaskState = (typeof TASK_STATES)[number]

/** The four terminal states — "can't be restarted" (HV-5, [S] §6.1 verbatim). */
export const TERMINAL_STATES = ['completed', 'canceled', 'rejected', 'failed'] as const

// — Message / Part (HV-4) —————————————————————————————————————————————————————

export interface A2aMessage {
  kind: 'message' // REQUIRED discriminator — round-trip fails without it
  role: 'user' | 'agent'
  parts: A2aPart[]
  messageId: string
  taskId?: string
  contextId?: string // server-generated grouping (HV-10)
  referenceTaskIds?: string[]
  extensions?: string[]
  metadata?: Record<string, unknown>
}

export type A2aPart = A2aTextPart | A2aFilePart | A2aDataPart

export interface A2aTextPart {
  kind: 'text'
  text: string
  metadata?: Record<string, unknown>
}

export interface A2aDataPart {
  kind: 'data'
  data: Record<string, unknown>
  metadata?: Record<string, unknown>
}

export interface A2aFilePart {
  kind: 'file'
  file: A2aFileWithBytes | A2aFileWithUri
  metadata?: Record<string, unknown>
}

// Mutual exclusion typed via `never` (upstream's `FileBase` idiom flattened — no shared base needed).
export interface A2aFileWithBytes {
  bytes: string
  uri?: never
  name?: string
  mimeType?: string
}

export interface A2aFileWithUri {
  uri: string
  bytes?: never
  name?: string
  mimeType?: string
}

// — Task (HV-5, HV-11) ——————————————————————————————————————————————————————

export interface A2aTask {
  kind: 'task'
  id: string
  contextId: string
  status: A2aTaskStatus
  history?: A2aMessage[]
  artifacts?: A2aArtifact[]
  metadata?: Record<string, unknown>
}

export interface A2aTaskStatus {
  state: TaskState
  message?: A2aMessage
  timestamp?: string
}

export interface A2aArtifact {
  artifactId: string
  parts: A2aPart[]
  name?: string
  description?: string
  metadata?: Record<string, unknown>
  extensions?: string[]
}

// — AgentCard (HV-7, HV-11) ————————————————————————————————————————————————

export interface A2aAgentCard {
  protocolVersion: string // the protocol pin (upstream default "0.3.0")
  name: string
  description: string
  url: string
  version: string // the AGENT's own version — never conflated with the pin (SPEC-R2 reconcile note)
  capabilities: A2aAgentCapabilities
  defaultInputModes: string[]
  defaultOutputModes: string[]
  skills: A2aAgentSkill[]
  preferredTransport?: string // default "JSONRPC" (HV-2/HV-7)
  additionalInterfaces?: unknown[]
  securitySchemes?: Record<string, unknown>
  security?: unknown[]
  supportsAuthenticatedExtendedCard?: boolean
  signatures?: unknown[]
}

export interface A2aAgentCapabilities {
  streaming?: boolean
  pushNotifications?: boolean
  stateTransitionHistory?: boolean
  extensions?: unknown[]
}

export interface A2aAgentSkill {
  id: string
  name: string
  description: string
  tags: string[]
  examples?: string[]
  inputModes?: string[]
  outputModes?: string[]
  security?: { [scheme: string]: string[] }[] // HV-11 — the one addition the belief missed
}

// Streaming event types (TaskStatusUpdateEvent/TaskArtifactUpdateEvent, HV-6) are deliberately NOT typed
// in B1 — no B1 requirement consumes them (typing unconsumed shapes is gold-plating; LLD §2).
