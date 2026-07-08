// validate.ts — the total, batch A2A validator (LLD-C3, SPEC-R6/R3 AC2/R5 AC1/R2 AC1/N4). ONE
// implementation judges any wire artifact (message/task/card/rpc envelope) — no fork. Total: no `throw`
// in this module; every branch appends a failure and continues (SPEC-R6 AC1). Batch: the walk collects
// every failure, not just the first. `path` is JSON-Pointer style (`/parts/0/file`).
//
// Code ownership (LLD §3 design note): this module emits A2A_SCHEMA / A2A_PIN / A2A_CARD / A2A_RPC.
// A2A_STATE is emitted ONLY by the LLD-C4 lifecycle guard (task-state.ts), which returns the same
// `A2aFailure` shape — SPEC-R6's "one validator" is one judging subsystem with one closed code set and
// one failure shape, not one file.

export interface A2aFailure {
  code: 'A2A_SCHEMA' | 'A2A_PIN' | 'A2A_STATE' | 'A2A_RPC' | 'A2A_CARD'
  path: string
  detail: string
  /** True iff this failure originated from a raw `JSON.parse` throw (the LLD §5 3-tier RPC-error rule).
   * Carried EXPLICITLY by the producer (`decodeA2a` / `parseFrame`) — never sniffed from `detail` text
   * (review fix: a stringly-typed `detail.startsWith('parse error')` check coupled `errors.ts` to the
   * producers' message wording). Absent/false for every other failure. */
  parse?: boolean
}

export type A2aArtifactKind = 'message' | 'task' | 'card' | 'rpc-request' | 'rpc-response'

export interface ValidateA2aOptions {
  protocolVersion: string
  expect?: A2aArtifactKind | 'auto'
}

/** Judge any wire artifact. NEVER throws — every branch appends a failure and returns. */
export function validateA2a(artifact: unknown, opts: ValidateA2aOptions): A2aFailure[] {
  try {
    return run(artifact, opts)
  } catch (e) {
    // Totality safety net (mirrors the a2ui validateA2ui precedent): any unforeseen input still yields a
    // verdict, never a throw.
    return [{ code: 'A2A_SCHEMA', path: '/', detail: `unexpected validator exception: ${String(e)}` }]
  }
}

function run(artifact: unknown, opts: ValidateA2aOptions): A2aFailure[] {
  const failures: A2aFailure[] = []
  const kind = opts.expect === 'auto' || opts.expect === undefined ? detectKind(artifact) : opts.expect
  if (kind === undefined) {
    return [{ code: 'A2A_SCHEMA', path: '/', detail: 'could not classify artifact (expect: "auto")' }]
  }

  switch (kind) {
    case 'message':
      validateMessage(artifact, '', failures, opts)
      break
    case 'task':
      validateTask(artifact, '', failures, opts)
      break
    case 'card':
      validateCard(artifact, '', failures, opts)
      break
    case 'rpc-request':
      validateRpcRequest(artifact, '', failures)
      break
    case 'rpc-response':
      validateRpcResponse(artifact, '', failures)
      break
  }
  return failures
}

// — kind detection (LLD §3: `expect: 'auto'` is a convenience for gates over mixed artifacts; admission
// and fixtures pass an explicit `expect`) —————————————————————————————————————————————————————————————

function detectKind(artifact: unknown): A2aArtifactKind | undefined {
  if (!isObject(artifact)) return undefined
  if ('jsonrpc' in artifact) return 'method' in artifact ? 'rpc-request' : 'rpc-response'
  if (artifact.kind === 'message') return 'message'
  if (artifact.kind === 'task') return 'task'
  if (typeof artifact.protocolVersion === 'string' && typeof artifact.url === 'string') return 'card'
  return undefined
}

// — Message (SPEC-R3, HV-4) ————————————————————————————————————————————————————

function validateMessage(
  artifact: unknown,
  base: string,
  failures: A2aFailure[],
  opts: ValidateA2aOptions,
): void {
  if (!isObject(artifact)) return push(failures, 'A2A_SCHEMA', `${base}/`, 'expected an object')
  if (artifact.kind !== 'message') {
    return push(failures, 'A2A_SCHEMA', `${base}/kind`, 'missing or wrong "message" discriminator')
  }
  if (artifact.role !== 'user' && artifact.role !== 'agent') {
    push(failures, 'A2A_SCHEMA', `${base}/role`, 'role must be "user" | "agent"')
  }
  if (typeof artifact.messageId !== 'string') {
    push(failures, 'A2A_SCHEMA', `${base}/messageId`, 'messageId must be a string')
  }
  if (!Array.isArray(artifact.parts)) {
    push(failures, 'A2A_SCHEMA', `${base}/parts`, 'parts must be an array')
  } else {
    artifact.parts.forEach((p, i) => validatePart(p, `${base}/parts/${i}`, failures))
  }
  checkPin(artifact, base, failures, opts)
}

function validatePart(part: unknown, path: string, failures: A2aFailure[]): void {
  if (!isObject(part)) return push(failures, 'A2A_SCHEMA', path, 'expected a part object')
  switch (part.kind) {
    case 'text':
      if (typeof part.text !== 'string') push(failures, 'A2A_SCHEMA', `${path}/text`, 'text must be a string')
      return
    case 'data':
      if (!isObject(part.data)) push(failures, 'A2A_SCHEMA', `${path}/data`, 'data must be an object')
      return
    case 'file':
      return validateFile(part.file, `${path}/file`, failures)
    default:
      return push(failures, 'A2A_SCHEMA', `${path}/kind`, `unknown part kind: ${String(part.kind)}`)
  }
}

function validateFile(file: unknown, path: string, failures: A2aFailure[]): void {
  if (!isObject(file)) return push(failures, 'A2A_SCHEMA', path, 'expected a file object')
  const hasBytes = typeof file.bytes === 'string'
  const hasUri = typeof file.uri === 'string'
  if (hasBytes === hasUri) {
    // both or neither — HV-4 mutual exclusion
    push(failures, 'A2A_SCHEMA', path, 'file must carry exactly one of bytes|uri')
  }
}

// — Task (SPEC-R4/R3, HV-5/HV-11) —————————————————————————————————————————————

function validateTask(
  artifact: unknown,
  base: string,
  failures: A2aFailure[],
  opts: ValidateA2aOptions,
): void {
  if (!isObject(artifact)) return push(failures, 'A2A_SCHEMA', `${base}/`, 'expected an object')
  if (artifact.kind !== 'task') {
    return push(failures, 'A2A_SCHEMA', `${base}/kind`, 'missing or wrong "task" discriminator')
  }
  if (typeof artifact.id !== 'string') push(failures, 'A2A_SCHEMA', `${base}/id`, 'id must be a string')
  if (typeof artifact.contextId !== 'string') {
    push(failures, 'A2A_SCHEMA', `${base}/contextId`, 'contextId must be a string')
  }
  validateTaskStatus(artifact.status, `${base}/status`, failures)
  if (artifact.history !== undefined) {
    if (!Array.isArray(artifact.history)) {
      push(failures, 'A2A_SCHEMA', `${base}/history`, 'history must be an array')
    } else {
      artifact.history.forEach((m, i) => validateMessage(m, `${base}/history/${i}`, failures, opts))
    }
  }
  checkPin(artifact, base, failures, opts)
}

const KNOWN_TASK_STATES = new Set([
  'submitted',
  'working',
  'input-required',
  'completed',
  'canceled',
  'failed',
  'rejected',
  'auth-required',
  'unknown',
])

function validateTaskStatus(status: unknown, path: string, failures: A2aFailure[]): void {
  if (!isObject(status)) return push(failures, 'A2A_SCHEMA', path, 'expected a status object')
  if (typeof status.state !== 'string' || !KNOWN_TASK_STATES.has(status.state)) {
    // out-of-union is a SHAPE defect, not a lifecycle one — A2A_STATE is the guard's code (LLD §3/§8)
    push(failures, 'A2A_SCHEMA', `${path}/state`, `unknown TaskState: ${String(status.state)}`)
  }
}

// — AgentCard (SPEC-R5, HV-7/HV-11) ———————————————————————————————————————————

function validateCard(
  artifact: unknown,
  base: string,
  failures: A2aFailure[],
  opts: ValidateA2aOptions,
): void {
  if (!isObject(artifact)) return push(failures, 'A2A_CARD', `${base}/`, 'expected an object')
  requireCardStr(artifact, 'protocolVersion', base, failures)
  requireCardStr(artifact, 'name', base, failures)
  requireCardStr(artifact, 'description', base, failures)
  requireCardStr(artifact, 'url', base, failures)
  requireCardStr(artifact, 'version', base, failures)
  if (!isObject(artifact.capabilities)) {
    push(failures, 'A2A_CARD', `${base}/capabilities`, 'capabilities must be an object')
  }
  if (!Array.isArray(artifact.defaultInputModes)) {
    push(failures, 'A2A_CARD', `${base}/defaultInputModes`, 'defaultInputModes must be an array')
  }
  if (!Array.isArray(artifact.defaultOutputModes)) {
    push(failures, 'A2A_CARD', `${base}/defaultOutputModes`, 'defaultOutputModes must be an array')
  }
  if (!Array.isArray(artifact.skills)) {
    push(failures, 'A2A_CARD', `${base}/skills`, 'skills must be an array')
  } else {
    artifact.skills.forEach((s, i) => validateSkill(s, `${base}/skills/${i}`, failures))
  }
  // protocolVersion/version reconcile note (SPEC-R2): two distinct required fields, checked
  // independently — the pin check below re-checks `protocolVersion` specifically for A2A_PIN.
  checkPin(artifact, base, failures, opts)
}

function requireCardStr(obj: Record<string, unknown>, key: string, base: string, failures: A2aFailure[]): void {
  if (typeof obj[key] !== 'string') push(failures, 'A2A_CARD', `${base}/${key}`, `${key} must be a string`)
}

function validateSkill(skill: unknown, path: string, failures: A2aFailure[]): void {
  if (!isObject(skill)) return push(failures, 'A2A_CARD', path, 'expected a skill object')
  if (typeof skill.id !== 'string') push(failures, 'A2A_CARD', `${path}/id`, 'id must be a string')
  if (typeof skill.name !== 'string') push(failures, 'A2A_CARD', `${path}/name`, 'name must be a string')
  if (typeof skill.description !== 'string') {
    push(failures, 'A2A_CARD', `${path}/description`, 'description must be a string')
  }
  if (!Array.isArray(skill.tags)) push(failures, 'A2A_CARD', `${path}/tags`, 'tags must be an array')
}

// — RPC envelopes (SPEC-R7) ————————————————————————————————————————————————————

function validateRpcRequest(artifact: unknown, base: string, failures: A2aFailure[]): void {
  if (!isObject(artifact)) return push(failures, 'A2A_RPC', `${base}/`, 'expected an object')
  if (artifact.jsonrpc !== '2.0') push(failures, 'A2A_RPC', `${base}/jsonrpc`, 'jsonrpc must be "2.0"')
  if (typeof artifact.method !== 'string') push(failures, 'A2A_RPC', `${base}/method`, 'method must be a string')
  const id = artifact.id
  if (id !== undefined && typeof id !== 'string' && typeof id !== 'number' && id !== null) {
    push(failures, 'A2A_RPC', `${base}/id`, 'id must be string | number | null')
  }
}

function validateRpcResponse(artifact: unknown, base: string, failures: A2aFailure[]): void {
  if (!isObject(artifact)) return push(failures, 'A2A_RPC', `${base}/`, 'expected an object')
  if (artifact.jsonrpc !== '2.0') push(failures, 'A2A_RPC', `${base}/jsonrpc`, 'jsonrpc must be "2.0"')
  const hasResult = 'result' in artifact
  const hasError = 'error' in artifact
  if (hasResult === hasError) {
    push(failures, 'A2A_RPC', base, 'response must carry exactly one of result|error')
  }
  if (hasError) {
    const err = artifact.error
    if (!isObject(err) || typeof err.code !== 'number' || typeof err.message !== 'string') {
      push(failures, 'A2A_RPC', `${base}/error`, 'error must be {code:number, message:string, ...}')
    }
  }
}

// — pin enforcement (SPEC-R2) ——————————————————————————————————————————————————

function checkPin(
  artifact: Record<string, unknown>,
  base: string,
  failures: A2aFailure[],
  opts: ValidateA2aOptions,
): void {
  if (typeof artifact.protocolVersion !== 'string') return // bare messages/tasks are version-silent (LLD §3)
  if (artifact.protocolVersion !== opts.protocolVersion) {
    push(
      failures,
      'A2A_PIN',
      `${base}/protocolVersion`,
      `unsupported protocolVersion "${artifact.protocolVersion}" (expected "${opts.protocolVersion}")`,
    )
  }
}

// — small helpers —————————————————————————————————————————————————————————————

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function push(failures: A2aFailure[], code: A2aFailure['code'], path: string, detail: string): void {
  failures.push({ code, path, detail })
}
