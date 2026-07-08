// task-state.ts — the task lifecycle transition table + guard (LLD-C4, SPEC-R4). Upstream normative
// facts (HV-5): the 9-member state set + the four terminals admit no restart. Everything else in
// TASK_TRANSITIONS is FAMILY POLICY — upstream v0.3.0 defines no full transition matrix; this module is
// the owning record for the edge set (LLD §4). `A2A_STATE` is emitted ONLY here (validate.ts never
// emits it) — same `A2aFailure` shape, one closed code set (SPEC-R6's "one validator" = one judging
// subsystem).
import type { A2aFailure } from './validate.ts'
import type { TaskState } from './types.ts'

export const TASK_TRANSITIONS: Record<TaskState, readonly TaskState[]> = {
  // accept/decline/authgate before work; no input-required/completed without work starting
  submitted: ['submitted', 'working', 'auth-required', 'canceled', 'rejected', 'failed', 'unknown'],
  // the live arm; no regression to submitted, no post-acceptance rejected
  working: ['working', 'input-required', 'auth-required', 'completed', 'canceled', 'failed', 'unknown'],
  // resume on input; -> completed is arena-driven (game ends by forfeit while a move is pending)
  'input-required': ['input-required', 'working', 'completed', 'canceled', 'failed', 'unknown'],
  // auth resolves to work or decline; no direct input-required
  'auth-required': ['auth-required', 'working', 'canceled', 'rejected', 'failed', 'unknown'],
  // the indeterminacy wildcard: knowledge lost (any non-terminal -> unknown is legal) and regained
  unknown: [
    'submitted',
    'working',
    'input-required',
    'completed',
    'canceled',
    'failed',
    'rejected',
    'auth-required',
    'unknown',
  ],
  // terminals sealed (HV-5) — empty by construction, re-asserted by test
  completed: [],
  canceled: [],
  rejected: [],
  failed: [],
}

/** True iff `from -> to` is a legal transition (self-loops on non-terminals are legal re-emission). */
export function canTransition(from: TaskState, to: TaskState): boolean {
  return TASK_TRANSITIONS[from].includes(to)
}

/** Judge a proposed transition. `[]` if legal; `[A2A_STATE at /status/state]` if not. Never throws. */
export function guardTransition(from: TaskState, to: TaskState): A2aFailure[] {
  if (canTransition(from, to)) return []
  return [
    {
      code: 'A2A_STATE',
      path: '/status/state',
      detail: `illegal transition: ${from} -> ${to}`,
    },
  ]
}
