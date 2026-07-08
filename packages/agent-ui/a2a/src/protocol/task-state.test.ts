// task-state.test.ts — S4 checkpoint: the FULL 9x9 (state x proposed-next) matrix (81 pairs: 35 legal /
// 46 illegal — submitted 7 · working 7 · input-required 6 · auth-required 6 · unknown 9 · four terminals
// 0), asserting EXACT table contents (SPEC-R4 AC1), not spot checks. A second assertion derives
// "terminals have zero outgoing edges" from TERMINAL_STATES rather than repeating literals.
import { describe, expect, it } from 'vitest'
import { canTransition, guardTransition, TASK_TRANSITIONS } from './task-state.ts'
import { TASK_STATES, TERMINAL_STATES, type TaskState } from './types.ts'

// The independently-authored expected legal set (LLD §4 table, transcribed — NOT derived from
// TASK_TRANSITIONS, or the test would be tautological).
const EXPECTED_LEGAL: Record<TaskState, TaskState[]> = {
  submitted: ['submitted', 'working', 'auth-required', 'canceled', 'rejected', 'failed', 'unknown'],
  working: ['working', 'input-required', 'auth-required', 'completed', 'canceled', 'failed', 'unknown'],
  'input-required': ['input-required', 'working', 'completed', 'canceled', 'failed', 'unknown'],
  'auth-required': ['auth-required', 'working', 'canceled', 'rejected', 'failed', 'unknown'],
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
  completed: [],
  canceled: [],
  rejected: [],
  failed: [],
}

describe('TASK_TRANSITIONS (LLD-C4) — the full 9x9 matrix', () => {
  it('counts: 81 pairs total, 35 legal, 46 illegal', () => {
    let legal = 0
    let illegal = 0
    for (const from of TASK_STATES) {
      for (const to of TASK_STATES) {
        if (canTransition(from, to)) legal++
        else illegal++
      }
    }
    expect(legal + illegal).toBe(81)
    expect(legal).toBe(35)
    expect(illegal).toBe(46)
  })

  it('per-row counts match the LLD table exactly', () => {
    expect(EXPECTED_LEGAL.submitted).toHaveLength(7)
    expect(EXPECTED_LEGAL.working).toHaveLength(7)
    expect(EXPECTED_LEGAL['input-required']).toHaveLength(6)
    expect(EXPECTED_LEGAL['auth-required']).toHaveLength(6)
    expect(EXPECTED_LEGAL.unknown).toHaveLength(9)
    for (const t of TERMINAL_STATES) expect(EXPECTED_LEGAL[t]).toHaveLength(0)
  })

  it('every one of the 81 pairs matches the expected legal/illegal verdict exactly', () => {
    for (const from of TASK_STATES) {
      for (const to of TASK_STATES) {
        const expectedLegal = EXPECTED_LEGAL[from].includes(to)
        expect(canTransition(from, to), `${from} -> ${to}`).toBe(expectedLegal)
      }
    }
  })

  it('terminals have zero outgoing edges — derived from TERMINAL_STATES, not repeated literals', () => {
    for (const t of TERMINAL_STATES) {
      expect(TASK_TRANSITIONS[t]).toEqual([])
      for (const to of TASK_STATES) expect(canTransition(t, to)).toBe(false)
    }
  })

  it('guardTransition returns [] for legal pairs and one A2A_STATE failure for illegal pairs', () => {
    expect(guardTransition('submitted', 'working')).toEqual([])
    expect(guardTransition('completed', 'working')).toEqual([
      { code: 'A2A_STATE', path: '/status/state', detail: expect.any(String) },
    ])
    // full sweep: every illegal pair yields exactly one A2A_STATE failure, every legal pair yields none
    for (const from of TASK_STATES) {
      for (const to of TASK_STATES) {
        const failures = guardTransition(from, to)
        if (EXPECTED_LEGAL[from].includes(to)) expect(failures).toEqual([])
        else expect(failures).toEqual([{ code: 'A2A_STATE', path: '/status/state', detail: expect.any(String) }])
      }
    }
  })

  it('non-terminal self-loops are legal (status re-emission)', () => {
    for (const s of TASK_STATES) {
      if (TERMINAL_STATES.includes(s as (typeof TERMINAL_STATES)[number])) continue
      expect(canTransition(s, s)).toBe(true)
    }
  })
})
